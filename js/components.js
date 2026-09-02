// ============================================================
// atoms
// ============================================================
// 气泡皮肤：聊天气泡的样子全在这一个盒子里改（Lisa v1 → v2：渐变/描边/阴影/角落贴纸）
// 底色字段可以填纯色 "#f7b6c2"，也可以填一整段渐变 "linear-gradient(180deg, #CDE2F8 0%, #E4EFFB 100%)"
// ⚠️渐变没法用「hex+两位透明度」那招——所以带透明度的取值处一律走 skinAlpha()（非六位 #hex 原样返回）
const BUBBLE_SKIN = {
  myBg: "#f7b6c2",    //我的气泡底色（可渐变）
  myText: "#16330a",  //我的气泡文字色
  myBorder: "",       //我的气泡描边，如 "2px solid rgba(170,200,235,0.55)"；留空=无
  mySticker: "",      //我的气泡右上角贴纸图 URL；留空=无
  charBg: "#a8c8e8",  //TA 的气泡底色（可渐变）
  charText: "",       //TA 的气泡文字色；留空=跟随主题墨色
  charBorder: "",     //TA 的气泡描边；留空=无
  charSticker: "",    //TA 的气泡左上角贴纸图 URL；留空=无
  stickerSize: 52,    //贴纸边长(px)
  radius: 20,         //圆角
  shadow: "0 1px 2px rgba(0,0,0,0.05)", //气泡投影
  chatBg: ""          //聊天页全局背景（纯色/渐变；每个聊天单独设过图的优先）；留空=主题默认
};
// v3（第六课）：皮肤从写死常量升级成可换装——localStorage x_bubbleSkin 覆盖上面的默认值。
// 设置→主题→气泡皮肤 里改；BUBBLE_SKIN_DEFAULTS 留一份出厂快照给「恢复默认」。
const BUBBLE_SKIN_DEFAULTS = Object.assign({}, BUBBLE_SKIN);
try { Object.assign(BUBBLE_SKIN, JSON.parse(localStorage.getItem("x_bubbleSkin") || "{}")); } catch (e) {}
// 给皮肤底色追加两位透明度（如 "eb"≈92%）：只有六位 #hex 能拼，渐变/rgba 原样返回
function skinAlpha(c, a) { return (typeof c === "string" && c[0] === "#" && c.length === 7) ? c + a : c; }
// OOC 有两种历史形态：普通 OOC 气泡，以及单聊里保留旧视觉的 SYSTEM RESPONSE。
// components.js 不能依赖 engine.js 的顶层 helper 是否被浏览器挂到 window；在渲染层自己认全，
// 否则单聊回复会出现“看得见删除键/分支，实际判断不到这是一条 OOC”的脆弱行为。
function isOocRecord(m) {
  return !!(m && (m.kind === "ooc" || (m.turnId && String(m.turnId).indexOf("ooc_") === 0)));
}
// 气泡角落贴纸：绝对定位悬在气泡外沿（我的在右上、TA 的在左上并水平翻转），不挡点击
function bubbleSticker(isU) {
  const src = isU ? BUBBLE_SKIN.mySticker : BUBBLE_SKIN.charSticker;
  if (!src) return null;
  const sz = BUBBLE_SKIN.stickerSize || 52;
  const pos = { position: "absolute", top: -sz / 2, width: sz, height: sz, objectFit: "contain", pointerEvents: "none", zIndex: 2 };
  if (isU) pos.right = -10; else { pos.left = -10; pos.transform = "scaleX(-1)"; }
  return h("img", { src: src, alt: "", style: pos });
}
function Avatar({
  character,
  size = 40,
  radius
}) {
  const rad = radius != null ? radius : size / 2;
  // 图片仓库：avatarImage 可能是 iv_ 键（IndexedDB）→ resolveImg 换成 objectURL；base64/http 原样。
  // 缓存没命中（iv_ 键但库里没图）→ src 为空 → 落到下面首字母兜底，不显示破图。
  const src = character && character.avatarImage ? (typeof resolveImg === "function" ? resolveImg(character.avatarImage) : character.avatarImage) : "";
  if (src) return /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: "",
    className: "object-cover shrink-0",
    style: {
      width: size,
      height: size,
      borderRadius: rad
    }
  });
  // 她自己设过 emoji 就还用 emoji（那是她挑的）；否则不再摆首字母方块，
  // 按 id/名字哈希给一张自动头像（有池子用池子里的图，没有就程序化画）。
  if (character && character.avatarEmoji) return /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-center shrink-0",
    style: { width: size, height: size, borderRadius: rad, background: character.color || "#c2bdb1", color: "#f6f4ef", fontSize: size * 0.4, fontFamily: F_DISPLAY }
  }, character.avatarEmoji);
  const seed = (character && (character.id || character.handle || character.name)) || "?";
  return /*#__PURE__*/React.createElement("img", {
    src: typeof autoAvatarSrc === "function" ? autoAvatarSrc(seed) : "",
    alt: "", className: "object-cover shrink-0",
    style: { width: size, height: size, borderRadius: rad }
  });
}
function Eyebrow({
  children,
  style
}) {
  const t = useTheme();
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Archivo',sans-serif",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      fontSize: 10,
      color: t.fog,
      ...style
    }
  }, children);
}
// 跑马灯文字：内容宽于容器时来回滚动，否则静止（用于聊天顶栏日程等一行放不下的地方）
function Marquee({ children, style, className }) {
  const box = React.useRef(null), inner = React.useRef(null);
  const [dist, setDist] = React.useState(0);
  React.useEffect(() => {
    const b = box.current, i = inner.current;
    if (!b || !i) return;
    const over = i.scrollWidth - b.clientWidth;
    setDist(over > 4 ? over + 6 : 0);
  });
  return h("div", { ref: box, className, style: Object.assign({ overflow: "hidden", whiteSpace: "nowrap" }, style) },
    h("span", { ref: inner, style: dist
      ? { display: "inline-block", "--mq": (-dist) + "px", animation: "wk-marquee " + Math.max(6, Math.round(dist / 14)) + "s ease-in-out infinite" }
      : { display: "inline-block" } }, children));
}
function Empty({
  text,
  sub
}) {
  const t = useTheme();
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col items-center justify-center text-center px-12 py-20 gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 16,
      color: t.fog
    }
  }, text), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 12,
      color: t.line
    }
  }, sub));
}
function Spinner({
  label
}) {
  const t = useTheme();
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col items-center justify-center py-16 gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1.5"
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "w-2 h-2 rounded-full animate-pulse",
    style: {
      background: t.fog,
      animationDelay: i * 0.15 + "s"
    }
  }))), label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 12,
      color: t.fog
    }
  }, label));
}

// standard interior header (calm, editorial)
function Head({
  zh,
  en,
  onBack,
  right
}) {
  const t = useTheme();
  return /*#__PURE__*/React.createElement("div", {
    className: "shrink-0 px-6 pb-3",
    style: {
      background: t.bg,
      paddingTop: safeTop(20)
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    className: "active:opacity-50 -ml-3 flex items-center justify-center",
    style: { width: 44, height: 44 }
  }, /*#__PURE__*/React.createElement(IArrow, {
    size: 19,
    color: t.ink
  })), right || /*#__PURE__*/React.createElement("div", {
    className: "w-5"
  })), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: F_DISPLAY,
      fontWeight: 400,
      fontSize: 30,
      lineHeight: 1,
      color: t.ink
    }
  }, zh), en && /*#__PURE__*/React.createElement("div", {
    className: "mt-2"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, en)));
}
function AvatarPicker({
  character,
  onGenerate,
  genBusy,
  size = 72,
  radius,
  imageMaxDim = 400,
  imageQuality = 0.85,
  onPick,
  onClear
}) {
  const t = useTheme();
  const ref = useRef(null);
  const handle = async e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      onPick(await resizeImageFile(f, imageMaxDim, imageQuality));
    } catch {}
    e.target.value = "";
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col items-center gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => ref.current && ref.current.click(),
    className: "relative active:opacity-70"
  }, /*#__PURE__*/React.createElement(Avatar, {
    character: character,
    size: size,
    radius: radius
  }), /*#__PURE__*/React.createElement("div", {
    className: "absolute -bottom-1 -right-1 rounded-full flex items-center justify-center",
    style: {
      width: 24,
      height: 24,
      background: t.ink
    }
  }, /*#__PURE__*/React.createElement(ICamera, {
    size: 12,
    color: t.bg2
  }))), /*#__PURE__*/React.createElement("input", {
    ref: ref,
    type: "file",
    accept: "image/*",
    className: "hidden",
    onChange: handle
  }), h("div", { className: "flex items-center gap-3" },
    onGenerate ? h("button", {
      onClick: () => { if (!genBusy) onGenerate(); },
      className: "active:opacity-60",
      style: { fontFamily: "'Archivo',sans-serif", fontSize: 10, color: genBusy ? t.fog : t.tint }
    }, genBusy ? "生成中…" : (character && character.avatarImage ? "重新生成" : "生成头像")) : null,
    character && character.avatarImage && /*#__PURE__*/React.createElement("button", {
    onClick: onClear,
    style: {
      fontFamily: "'Archivo',sans-serif",
      fontSize: 10,
      color: t.fog
    }
  }, "移除照片")));
}
function Sheet({
  children,
  onClose,
  tall,
  lift,
  scrollKey
}) {
  const t = useTheme();
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollKey == null || !scrollRef.current) return;
    const node = scrollRef.current;
    const resetScroll = () => { node.scrollTop = 0; };
    resetScroll();
    const frame = requestAnimationFrame(resetScroll);
    return () => cancelAnimationFrame(frame);
  }, [scrollKey]);
  return /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-0 flex items-end z-50",
    style: {
      background: "rgba(20,19,15,0.4)",
      backdropFilter: "blur(2px)"
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    ref: scrollRef,
    onClick: e => e.stopPropagation(),
    className: "w-full p-6 pb-9",
    style: {
      background: t.bg2,
      borderRadius: "26px 26px 0 0",
      animation: "fadeUp .3s ease both",
      maxHeight: tall ? "88%" : "72%",
      overflowY: "auto",
      overflowAnchor: "none",
      marginBottom: lift ? lift : 0,
      transition: "margin-bottom .18s ease"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-9 h-1 rounded-full mx-auto mb-5",
    style: {
      background: t.line
    }
  }), children));
}
// iOS 软键盘弹出时可视视口会缩短，但底部弹层是 absolute 定位（相对 100vh 容器）不会自动上移、被键盘挡住。
// 这个 hook 返回键盘当前遮住的高度（px），底部弹层拿去做 marginBottom/位移，把自己顶到键盘上方。
function useKbLift() {
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onR = () => { setLift(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))); };
    vv.addEventListener("resize", onR); vv.addEventListener("scroll", onR); onR();
    return () => { vv.removeEventListener("resize", onR); vv.removeEventListener("scroll", onR); };
  }, []);
  return lift;
}
// 全 App 共用的确认入口。iOS/PWA 允许用户永久屏蔽原生 confirm；一旦被屏蔽，
// 所有“先 confirm 再删除”的按钮都会静默 no-op，看起来就是删不掉。
// 各独立 App 只提交动作，真正的可见弹层由 App 根节点统一承载。
function requestAppConfirm(title, body, onConfirm, confirmLabel, onCancel) {
  if (typeof onConfirm !== "function") return false;
  const open = typeof window !== "undefined" && window.__appConfirmOpen;
  if (typeof open !== "function") {
    if (typeof window !== "undefined" && typeof window.__toast === "function") window.__toast("确认层还没准备好，请再点一次");
    return false;
  }
  open({ title: title || "确认操作？", body: body || "", onConfirm, confirmLabel: confirmLabel || "确定", onCancel: typeof onCancel === "function" ? onCancel : null });
  return true;
}
// 风格统一的确认弹窗（替掉不可靠的原生 confirm）。danger=true 时确认键用强调色。
function ConfirmDialog({ title, body, confirmLabel, cancelLabel, danger, onConfirm, onCancel }) {
  const t = useTheme();
  return h("div", { className: "fixed inset-0 z-[220] flex items-center justify-center", style: { background: "rgba(20,19,15,0.5)", backdropFilter: "blur(3px)", padding: 24 }, onClick: onCancel },
    h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", maxWidth: 300, background: t.bg2, borderRadius: 20, padding: "22px 20px 18px", animation: "fadeUp .2s ease both" } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: t.ink, marginBottom: body ? 8 : 18, textAlign: "center" } }, title),
      body ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, lineHeight: 1.6, textAlign: "center", marginBottom: 18 } }, body) : null,
      h("div", { className: "flex gap-3" },
        h("button", { onClick: onCancel, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 14, color: t.sub, padding: "11px 0", borderRadius: 12, border: "1px solid " + t.line, background: "transparent" } }, cancelLabel || "取消"),
        h("button", { onClick: onConfirm, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#fff", background: danger ? t.accent : t.ink, padding: "12px 0", borderRadius: 12, border: "none" } }, confirmLabel || "确定"))));
}
// ⚠️居中不许再靠 -translate-x-1/2 -translate-y-1/2（她 2026-09-01：「这种黑框一直
//   都是在屏幕右侧出现而不是中间」）。病根：这一层自己带着 animation:fadeUp，
//   而 fadeUp 的末帧写的是 transform:translateY(0)、fill-mode 又是 both——
//   动画的 transform 整个盖掉那两个 translate 类，于是框的【左边缘】正好钉在屏幕中线上，
//   看起来永远偏在右半边、还往下掉半屏。
//   居中交给外面那层 flex，transform 从此只归动画自己用，两者不再抢同一个属性。
function Toast({
  msg
}) {
  const t = useTheme();
  if (!msg) return null;
  return h("div", {
    className: "absolute inset-0 z-[60] flex items-center justify-center pointer-events-none",
    style: { padding: 24 }
  }, h("div", {
    className: "px-4 py-2.5 rounded-2xl text-center",
    style: {
      maxWidth: "100%",
      background: t.ink,
      color: t.bg2,
      fontFamily: F_BODY,
      fontSize: 12.5,
      lineHeight: 1.5,
      animation: "fadeUp .2s ease both",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word"
    }
  }, msg));
}
function Toggle({
  on,
  onChange
}) {
  const t = useTheme();
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => onChange(!on),
    style: {
      width: 46,
      height: 27,
      borderRadius: 999,
      background: on ? t.ink : t.line,
      position: "relative",
      transition: "background .2s"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 3,
      left: on ? 22 : 3,
      width: 21,
      height: 21,
      borderRadius: 999,
      background: "#fff",
      transition: "left .2s"
    }
  }));
}
function Slider({
  value,
  min,
  max,
  step,
  onChange
}) {
  const t = useTheme();
  return /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: min,
    max: max,
    step: step || 1,
    value: value,
    onChange: e => onChange(parseFloat(e.target.value)),
    className: "w-full",
    style: {
      accentColor: t.ink
    }
  });
}
function LineField({
  zh,
  en,
  children,
  right
}) {
  const t = useTheme();
  return /*#__PURE__*/React.createElement("div", {
    className: "pt-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-baseline justify-between mb-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-baseline gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 14,
      color: t.sub
    }
  }, zh), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Archivo',sans-serif",
      letterSpacing: "0.16em",
      fontSize: 10,
      color: t.fog
    }
  }, "/ ", en)), right), children, /*#__PURE__*/React.createElement("div", {
    className: "mt-3 h-px w-full",
    style: {
      background: t.line
    }
  }));
}
function LineInput(props) {
  const t = useTheme();
  return /*#__PURE__*/React.createElement("input", {
    ...props,
    className: "w-full bg-transparent outline-none",
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 18,
      color: t.ink,
      ...(props.style || {})
    }
  });
}
function LineArea(props) {
  const t = useTheme();
  return /*#__PURE__*/React.createElement("textarea", {
    ...props,
    className: "w-full bg-transparent outline-none resize-none",
    style: {
      fontFamily: F_BODY,
      fontSize: 14,
      lineHeight: 1.7,
      color: t.ink,
      ...(props.style || {})
    }
  });
}
// ============================================================
// 液态玻璃（她 2026-08-30：「主界面背景和图标能不能弄更液态玻璃风格，
// 然后就算放背景图也会保留液态显示」）
// ------------------------------------------------------------
// 原来那块「玻璃」其实是一片 85% 白的塑料板：铺了张壁纸也只看得见一层奶白，
// 底下什么都透不上来。真玻璃靠三件事，这里三件都做：
//   ① 透——填色压到两成多，靠 backdrop-filter 的 blur+saturate+brightness 把底下的东西
//      吸上来（saturate 是关键：玻璃会把背后的颜色【提亮加浓】，不是磨白）
//   ② 边——边缘要有一圈折光：内圈上下各一道亮线，四周一圈更亮的白边
//   ③ 高光——左上一道斜的镜面反光，右下一团回弹的软光
// 没壁纸时也成立：亮度提一点＋这一圈边，在米白底上照样看得出是一片玻璃。
const GLASS_BLUR = "blur(14px) saturate(1.9) brightness(1.06)";
function glassLayers(radius) {
  return [
    // ③ 镜面高光：左上一道斜的，右下一团软的
    h("span", {
      key: "spec", "aria-hidden": "true",
      style: {
        position: "absolute", inset: 0, borderRadius: radius, pointerEvents: "none",
        background: "linear-gradient(148deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.16) 24%, rgba(255,255,255,0) 44%), radial-gradient(76% 54% at 76% 110%, rgba(255,255,255,0.32), rgba(255,255,255,0) 64%)"
      }
    }),
    // ② 折光边：内圈四道亮线（上最亮，下次之），像光在玻璃壁上弯了一下
    h("span", {
      key: "rim", "aria-hidden": "true",
      style: {
        position: "absolute", inset: 0, borderRadius: radius, pointerEvents: "none",
        boxShadow: "inset 0 1.2px 0.6px rgba(255,255,255,0.96), inset 0 -1.4px 1.4px rgba(255,255,255,0.46), inset 1.2px 0 1.2px rgba(255,255,255,0.52), inset -1.2px 0 1.2px rgba(255,255,255,0.40), inset 0 0 12px rgba(255,255,255,0.16)"
      }
    })
  ];
}
// 图标底下那行字：铺了壁纸就翻成白字压深影（壁纸亮起来的地方墨字会糊掉），
// 没壁纸还是墨字加一圈白晕
function glassLabelInk(onWallpaper, t) {
  return onWallpaper
    ? { color: "#fff", textShadow: "0 1px 3px rgba(20,18,15,0.6), 0 0 10px rgba(20,18,15,0.35)" }
    : { color: t.sub, textShadow: "0 1px 2px rgba(255,255,255,0.7)" };
}
// 一片玻璃：radius 圆角，tone 是这个 app 自己的光（可空），children 放在玻璃上面
function GlassPane({ radius = 17, tone, style, className, children }) {
  return h("div", {
    className: className,
    style: Object.assign({
      position: "relative",
      borderRadius: radius,
      // 填色只剩两成多，剩下的交给 backdrop-filter——这一步是「塑料板 → 玻璃」的分水岭
      background: (tone ? tone.wash + ", " : "") + "linear-gradient(160deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.09) 52%, rgba(255,255,255,0.19) 100%)",
      backdropFilter: GLASS_BLUR,
      WebkitBackdropFilter: GLASS_BLUR,
      border: "1px solid rgba(255,255,255,0.55)",
      boxShadow: "0 6px 18px rgba(30,28,24,0.14), 0 1px 3px rgba(30,28,24,0.10)"
    }, style || {})
  }, glassLayers(radius), children);
}
function GlassCard({
  children,
  style,
  onClick
}) {
  const t = useTheme();
  // 跟图标同一块玻璃（GLASS_BLUR），只是填得厚一点——卡里装的是字，得压得住。
  // 铺了壁纸时组件不再是一块奶白纸板，底下的图会透上来。
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      background: "linear-gradient(160deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.18) 55%, rgba(255,255,255,0.29) 100%)",
      backdropFilter: GLASS_BLUR,
      WebkitBackdropFilter: GLASS_BLUR,
      border: "1px solid rgba(255,255,255,0.58)",
      borderRadius: 22,
      boxShadow: "0 8px 26px rgba(30,28,24,0.10), inset 0 1.2px 0.6px rgba(255,255,255,0.92), inset 0 -1.4px 1.4px rgba(255,255,255,0.38)",
      ...style
    }
  }, children);
}
// ============================================================
// HOME — iOS liquid-glass springboard, paged, with dock
// ============================================================
function GlassIcon({
  G,
  label,
  onClick,
  badge,
  soon,
  appKey,
  onWallpaper
}) {
  const t = useTheme();
  const [, redrawThemeIcon] = useState(0);
  useEffect(() => {
    const fn = () => redrawThemeIcon(x => x + 1);
    window.addEventListener("lisa-theme-change", fn);
    return () => window.removeEventListener("lisa-theme-change", fn);
  }, []);
  // 她自己换过图标的那几个不上色（那是她的图，别去染它）
  const customIcon = appKey && window.ThemeStudio ? window.ThemeStudio.iconRef(appKey) : "";
  const tone = (!customIcon && appKey && typeof appTone === "function") ? appTone(appKey) : null;
  const customSrc = customIcon ? (typeof resolveImg === "function" ? resolveImg(customIcon) : customIcon) : "";
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    className: "flex flex-col items-center gap-1.5 active:scale-90 transition-transform",
    style: soon ? { opacity: 0.5 } : null
  }, h(GlassPane, {
    className: "flex items-center justify-center",
    radius: 17,
    tone: tone,
    style: { width: 62, height: 62 }
  }, customSrc ? /*#__PURE__*/React.createElement("img", {
    src: customSrc,
    alt: "",
    style: { width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }
  }) : /*#__PURE__*/React.createElement(G, {
    size: 27,
    color: tone ? tone.glyph : t.ink,
    sw: 1.7
  }), soon && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      bottom: -4,
      right: -4,
      fontSize: 8,
      fontFamily: "'Archivo',sans-serif",
      letterSpacing: "0.08em",
      color: "#fff",
      background: t.ink,
      borderRadius: 999,
      padding: "1px 5px"
    }
  }, "SOON"), badge > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: -3,
      right: -3,
      minWidth: 18,
      height: 18,
      borderRadius: 999,
      background: t.accent,
      color: "#fff",
      fontSize: 10,
      fontFamily: F_BODY,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 5px"
    }
  }, badge)), /*#__PURE__*/React.createElement("span", {
    style: Object.assign({ fontFamily: F_BODY, fontSize: 11 }, glassLabelInk(onWallpaper, t))
  }, label));
}
// 文件夹磁贴：格子里放前 4 个 app 的 2x2 迷你预览，点开弹出内部 app 网格
function FolderIcon({ apps, label, onOpen, onWallpaper }) {
  const t = useTheme();
  const preview = (apps || []).slice(0, 4);
  return h("button", { onClick: onOpen, className: "flex flex-col items-center gap-1.5 active:scale-90 transition-transform" },
    h(GlassPane, { radius: 17, style: { width: 62, height: 62, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 4, padding: 8 } },
      preview.map((a, i) => h("div", { key: i, className: "flex items-center justify-center", style: { background: "rgba(255,255,255,0.52)", borderRadius: 7, boxShadow: "inset 0 0.8px 0.6px rgba(255,255,255,0.9)" } }, h(a.G, { size: 15, color: t.ink, sw: 1.7 }))),
      Array.from({ length: Math.max(0, 4 - preview.length) }).map((_, i) => h("div", { key: "e" + i }))),
    h("span", { style: Object.assign({ fontFamily: F_BODY, fontSize: 11 }, glassLabelInk(onWallpaper, t)) }, label));
}
// 文件夹展开层：半透明背景 + 内部 app 网格 + 改名 + 整理模式（✕ 移回主屏）
function FolderOverlay({ apps, label, onPick, onClose, onRename, onRemove }) {
  const t = useTheme();
  const [arrange, setArrange] = useState(false);
  const [editName, setEditName] = useState(false);
  const [nm, setNm] = useState(label || "文件夹");
  const saveName = () => { onRename && onRename(nm); setEditName(false); };
  return h("div", { onClick: onClose, className: "absolute inset-0 z-40 flex items-center justify-center px-8", style: { background: "rgba(40,36,30,0.32)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" } },
    h("div", { onClick: e => e.stopPropagation(), className: "w-full", style: { background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.6)", borderRadius: 28, padding: "22px 20px", boxShadow: "0 20px 50px rgba(30,28,24,0.25)" } },
      editName
        ? h("div", { className: "flex items-center gap-2 justify-center", style: { marginBottom: 18 } },
            h("input", { value: nm, onChange: e => setNm(e.target.value), autoFocus: true, onKeyDown: e => { if (e.key === "Enter") saveName(); }, style: { width: 150, textAlign: "center", outline: "none", fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, background: "rgba(255,255,255,0.7)", border: "1px solid " + t.line, borderRadius: 10, padding: "5px 10px" } }),
            h("button", { onClick: saveName, style: { fontFamily: F_BODY, fontSize: 13, fontWeight: 600, color: t.ink } }, "好"))
        : h("button", { onClick: () => { if (onRename) { setNm(label || "文件夹"); setEditName(true); } }, className: "w-full flex items-center justify-center gap-1.5 active:opacity-70", style: { marginBottom: 18 } },
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink } }, label),
            onRename ? h(IPencil, { size: 13, color: t.fog }) : null),
      // 3 列 + 明确行列距：4 列时图标(62px)把宽度挤满、贴在一起没空隙
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", rowGap: 20, columnGap: 14, justifyItems: "center" } },
        (apps || []).map(a => h("div", { key: a.key, className: "relative", style: { animation: arrange ? "wk-jiggle .32s ease-in-out infinite" : "none" } },
          h(GlassIcon, { G: a.G, label: a.zh, appKey: a.key, soon: a.soon, onWallpaper: true, onClick: () => { if (!arrange) onPick(a); } }),
          arrange && h("button", { onClick: () => onRemove && onRemove(a.key), className: "absolute flex items-center justify-center active:opacity-70", style: { top: -7, left: 2, width: 21, height: 21, borderRadius: 999, background: t.ink, color: "#fff", fontSize: 12, lineHeight: 1, boxShadow: "0 2px 8px rgba(0,0,0,0.3)", zIndex: 3 } }, "✕")))),
      onRemove ? h("div", { className: "flex justify-center", style: { marginTop: 18 } },
        h("button", { onClick: () => setArrange(a => !a), style: { fontFamily: F_BODY, fontSize: 12.5, color: arrange ? t.ink : t.fog, fontWeight: arrange ? 700 : 400, padding: "5px 16px", borderRadius: 999, background: "rgba(255,255,255,0.55)", border: "1px solid " + t.line } }, arrange ? "完成" : "整理（取出 app）")) : null,
      arrange ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, textAlign: "center", marginTop: 8 } }, "点 ✕ 把 app 放回主屏；取空了文件夹自动消失") : null));
}
// ============================================================
// 日历 CALENDAR —— 首页组件 + 全屏月历（世界/角色多视角、AI 生成、事件编辑）
// ============================================================
const CAL_DOW = ["日", "一", "二", "三", "四", "五", "六"];
function calKey(y, m, d) { return y + "-" + (m + 1) + "-" + d; } // m 0-based
function calCells(year, month) {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return cells;
}
function calAnyEvent(calendar, y, m, d) {
  const k = calKey(y, m, d);
  if (calendar.world && calendar.world[k] && calendar.world[k].length) return true;
  const cc = calendar.chars || {};
  return Object.keys(cc).some(cid => cc[cid] && cc[cid][k] && cc[cid][k].length);
}
// 首页 2x2 小组件：当月实时月历 + 有事件的日子下方圆点
function CalWidget({ now, calendar, onOpen, period }) {
  const t = useTheme();
  const y = now.getFullYear(), m = now.getMonth(), today = now.getDate();
  const cal = calendar || { world: {}, chars: {} };
  const pm = periodMap(period); // 经期各阶段：{ 'y-m-d': {t:'period'|'fertile'|'ov'|'safe'} }
  const showPeriod = period && period.visibleOnHome !== false && Object.keys(pm).length > 0;
  return h("button", {
    onClick: onOpen,
    className: "col-span-3 row-span-3 active:opacity-80 text-left",
    // height:100% + flex 列：日历撑满 3 行格高、日期行均匀铺开，下沿和旁边的 app 对齐（之前内容矮一截、底下空一块）
    style: { height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(160deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.18) 55%, rgba(255,255,255,0.29) 100%)", backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR, border: "1px solid rgba(255,255,255,0.58)", borderRadius: 24, padding: "14px 16px", boxShadow: "0 8px 30px rgba(30,28,24,0.12), inset 0 1.2px 0.6px rgba(255,255,255,0.92)" }
  },
    h("div", { className: "flex items-baseline justify-between mb-2", style: { flexShrink: 0 } },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.ink } }, (m + 1) + "月"),
      h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, y)),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, flex: 1, alignContent: "space-between", minHeight: 0 } },
      CAL_DOW.map((w, i) => h("div", { key: "h" + i, style: { textAlign: "center", fontFamily: F_BODY, fontSize: 10, color: t.fog, marginBottom: 2 } }, w)),
      calCells(y, m).map((d, i) => {
        if (d === null) return h("div", { key: i });
        const pk = showPeriod ? pm[y + "-" + (m + 1) + "-" + d] : null;
        const pcol = pk ? PERIOD_COLORS[pk.t] : null;
        const isToday = d === today;
        return h("div", { key: i, style: { position: "relative", textAlign: "center", padding: "2px 0" } },
          h("span", { style: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 999, fontFamily: F_BODY, fontSize: 12.5, color: isToday ? "#fff" : (pcol || t.sub), background: isToday ? t.accent : (pcol ? pcol + "26" : "transparent"), border: pcol && !isToday ? "1px solid " + pcol + "66" : "none" } }, d),
          calAnyEvent(cal, y, m, d) && h("span", { style: { position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 999, background: isToday ? "#fff" : t.tint } }));
      })));
}
// 一起听·主屏音乐组件（展示型，不真放声音）：左唱片 + 正在听的歌 + 装饰进度条
// 天气小组件（Open-Meteo 免费无 key）：你所在地实时天气，2 小时缓存；点开=天气详情页（逐小时+7天），不再借地图的门（她 8/20 抓的）
function WeatherWidget({ userGeo, onOpen }) {
  const t = useTheme();
  const [w, setW] = useState(function () { return userGeo && typeof weatherCached === "function" ? weatherCached(userGeo.lat, userGeo.lng) : null; });
  const [open, setOpen] = useState(false);
  const [fx, setFx] = useState(null); // {hourly:[{h,t,p,code}], daily:[{d,code,hi,lo}]}
  useEffect(() => {
    let alive = true;
    if (userGeo && typeof weatherFor === "function") weatherFor(userGeo.lat, userGeo.lng).then(x => { if (alive && x) setW(x); }).catch(() => {});
    return () => { alive = false; };
  }, [userGeo && userGeo.lat, userGeo && userGeo.lng]);
  const openDetail = function () {
    if (!userGeo) { onOpen && onOpen(); return; } // 没定位就还走老门（地图里能开定位）
    setOpen(true);
    if (fx) return;
    fetch("https://api.open-meteo.com/v1/forecast?latitude=" + userGeo.lat + "&longitude=" + userGeo.lng + "&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=auto")
      .then(r => r.json())
      .then(d => {
        const nowH = new Date().getHours();
        const hs = []; const H = d.hourly || {};
        for (let i = 0; i < (H.time || []).length && hs.length < 24; i++) {
          const dt = new Date(H.time[i]); if (dt < new Date(Date.now() - 3600000)) continue;
          hs.push({ h: dt.getHours(), t: Math.round(H.temperature_2m[i]), p: H.precipitation_probability ? H.precipitation_probability[i] : null, code: H.weather_code[i] });
        }
        const ds = []; const D = d.daily || {};
        for (let i = 0; i < (D.time || []).length; i++) ds.push({ d: new Date(D.time[i]), code: D.weather_code[i], hi: Math.round(D.temperature_2m_max[i]), lo: Math.round(D.temperature_2m_min[i]) });
        setFx({ hourly: hs, daily: ds });
      }).catch(() => {});
  };
  const wk = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const detail = open ? h(Sheet, { onClose: function () { setOpen(false); }, tall: true },
    h("div", { className: "flex items-center justify-between", style: { marginBottom: 2 } },
      h("div", null,
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink } }, (userGeo && userGeo.label ? String(userGeo.label).slice(0, 14) : "你所在地") + " 天气"),
        w ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, marginTop: 2 } }, wmoEmoji(w.code) + " " + wmoZh(w.code) + " · 现在 " + w.t + "° · 今日 " + w.lo + "~" + w.hi + "°") : null),
      h("button", { onClick: function () { setOpen(false); onOpen && onOpen(); }, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, "好友地图 ›")),
    fx ? h("div", null,
      // 逐小时横滑条
      h("div", { style: { display: "flex", gap: 4, overflowX: "auto", padding: "12px 0 10px", borderBottom: "1px solid " + t.line } },
        fx.hourly.map(function (x, i) {
          return h("div", { key: i, className: "shrink-0", style: { textAlign: "center", width: 46 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, i === 0 ? "现在" : x.h + "时"),
            h("div", { style: { fontSize: 16, margin: "3px 0" } }, wmoEmoji(x.code)),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink } }, x.t + "°"),
            (x.p != null && x.p >= 20) ? h("div", { style: { fontFamily: F_BODY, fontSize: 9, color: "#4a7fa5" } }, x.p + "%") : h("div", { style: { height: 12 } }));
        })),
      // 7 天列表
      h("div", { style: { paddingTop: 4 } }, fx.daily.map(function (x, i) {
        return h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", borderBottom: i < fx.daily.length - 1 ? "1px solid " + t.line : "none" } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, width: 44 } }, i === 0 ? "今天" : wk[x.d.getDay()]),
          h("span", { style: { fontSize: 17 } }, wmoEmoji(x.code)),
          h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, flex: 1 } }, wmoZh(x.code)),
          h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, x.lo + "°"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, x.hi + "°"));
      }))) : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "24px 0", textAlign: "center" } }, "拉预报中…")) : null;
  return h(React.Fragment, null, detail, h(GlassCard, { onClick: openDetail, style: { padding: "10px 12px", cursor: "pointer", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" } },
    w ? h("div", null,
      h("div", { className: "flex items-center gap-1.5" },
        h("span", { style: { fontSize: 21, lineHeight: 1 } }, wmoEmoji(w.code)),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: t.ink, lineHeight: 1 } }, w.t + "°")),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.sub, marginTop: 4 } }, wmoZh(w.code) + " · " + w.lo + "~" + w.hi + "°"),
      userGeo && userGeo.label ? h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, String(userGeo.label).slice(0, 12)) : null)
    : h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.6, whiteSpace: "pre-line" } }, "🌤 天气\n" + (userGeo ? "获取中…" : "设置里开定位后显示"))));
}
// 记账小组件（2 格宽）：本月各币种支出一眼看（数据走 ledger.js 的 window.ledgerWidgetData，纯本地零 API）
function LedgerWidget({ onOpen }) {
  const t = useTheme();
  const rows = (typeof window !== "undefined" && typeof window.ledgerWidgetData === "function" ? window.ledgerWidgetData() : []) || [];
  const fmt = n => { const v = Math.round((Number(n) || 0) * 100) / 100; return v >= 10000 ? (Math.round(v / 100) / 100) + "w" : v.toLocaleString("en-US", { maximumFractionDigits: v >= 100 ? 0 : 2 }); };
  return h(GlassCard, { onClick: onOpen, style: { padding: "10px 12px", cursor: "pointer", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" } },
    rows.length ? h("div", null,
      h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: "0.1em", color: t.fog, marginBottom: 3 } }, "本月支出"),
      rows.slice(0, 2).map(r => h("div", { key: r.code, className: "flex items-baseline gap-1", style: { minWidth: 0 } },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: rows.length > 1 ? 16 : 20, color: t.ink, lineHeight: 1.25, whiteSpace: "nowrap" } }, r.symbol + fmt(r.exp)),
        h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.code + (r.inc > 0 ? " · 入" + fmt(r.inc) : "")))),
      rows[0] && rows[0].topCat ? h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.sub, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "花最多：" + rows[0].topCat) : null)
    : h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.6, whiteSpace: "pre-line" } }, "📒 记账\n本月还没记账"));
}
// 备忘录小组件：最近 3 条未完成提醒（逾期红字优先），点开进备忘录
function MemoWidget({ onOpen }) {
  const t = useTheme();
  const items = (typeof window !== "undefined" && window.memoUpcoming) ? window.memoUpcoming(3) : [];
  const lbl = d => d === 0 ? "今天" : (d > 0 ? d + " 天后" : "逾期 " + (-d) + " 天");
  return h(GlassCard, { onClick: onOpen, style: { padding: "12px 16px", cursor: "pointer" } },
    h("div", { className: "flex items-center gap-2", style: { marginBottom: items.length ? 8 : 0 } },
      h("span", { style: { fontSize: 14 } }, "📌"),
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, "备忘录"),
      h("span", { className: "flex-1" }),
      items.length ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "最近提醒") : null),
    items.length
      ? h("div", { className: "flex flex-col", style: { gap: 4 } }, items.map((it, i) =>
          h("div", { key: i, className: "flex items-center gap-2" },
            h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: it.days < 0 ? "#c25a4a" : (it.days === 0 ? t.accent : t.fog), fontWeight: it.days <= 0 ? 700 : 400, flexShrink: 0, minWidth: 52 } }, lbl(it.days)),
            h("span", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, it.title))))
      : h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2 } }, "没有待办提醒，记一条？"));
}
// 命运转盘（v47.81 全屏化）：主屏 2x2 小组件只是入口（静态小盘预览+上次结果），点开进全屏大转盘——
// 点大盘开转，落定后随机一位在聊角色起哄（气泡完整显示不截断，带头像）。✎ 编辑主题/选项
const WHEEL_COLORS = ["#f2cfd2", "#bcd3f0", "#c3e0b0", "#f2c88f", "#d9c7ee", "#f0dc8f", "#bfe3c6", "#eea3a3"];
function wheelSlicePath(i, n) {
  const a0 = (i * 360 / n - 90) * Math.PI / 180, a1 = ((i + 1) * 360 / n - 90) * Math.PI / 180;
  const R = 46;
  return "M50,50 L" + (50 + R * Math.cos(a0)).toFixed(2) + "," + (50 + R * Math.sin(a0)).toFixed(2) + " A" + R + "," + R + " 0 " + (360 / n > 180 ? 1 : 0) + " 1 " + (50 + R * Math.cos(a1)).toFixed(2) + "," + (50 + R * Math.sin(a1)).toFixed(2) + " Z";
}
function wheelLabelPos(i, n, r) { const a = ((i + 0.5) * 360 / n - 90) * Math.PI / 180; return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) }; }
// 转盘 SVG（小组件和全屏共用）：size=像素宽高，labels=要不要画选项字
function WheelDisc({ items, angle, spinning, size, labels, dur }) {
  return h("svg", { viewBox: "0 0 100 100", width: size, height: size, style: { transform: "rotate(" + angle + "deg)", transition: spinning ? "transform " + (dur || 3.2) + "s cubic-bezier(0.12,0.6,0.08,1)" : "none", display: "block" } },
    items.length >= 2 ? items.map((it, i) => h("g", { key: i },
      h("path", { d: wheelSlicePath(i, items.length), fill: WHEEL_COLORS[i % WHEEL_COLORS.length], stroke: "rgba(255,255,255,0.85)", strokeWidth: 1 }),
      labels ? h("text", { x: wheelLabelPos(i, items.length, 29).x, y: wheelLabelPos(i, items.length, 29).y, textAnchor: "middle", dominantBaseline: "middle", style: { fontSize: items.length > 5 ? 6.5 : 8, fontFamily: "'Noto Sans SC',sans-serif", fill: "rgba(60,50,40,0.88)" } }, it.slice(0, 5)) : null))
      : h("circle", { cx: 50, cy: 50, r: 46, fill: "#eee" }),
    h("circle", { cx: 50, cy: 50, r: 6.5, fill: "#fff", stroke: "rgba(0,0,0,0.12)" }));
}
// 全屏大转盘（portal 挂 body）：氛围感主场——大盘+大结果+角色起哄完整气泡
function WheelFull({ data, items, onSave, onReact, onClose }) {
  const t = useTheme();
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [quip, setQuip] = useState(null);        // {name,text,char}
  const [quipBusy, setQuipBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const [eTitle, setETitle] = useState("");
  const [eItems, setEItems] = useState("");
  const lastReact = useRef(0);
  const spin = () => {
    if (spinning || items.length < 2) return;
    const idx = Math.floor(Math.random() * items.length);
    const seg = 360 / items.length;
    const target = 360 * (5 + Math.floor(Math.random() * 3)) + (360 - (idx * seg + seg / 2));
    setSpinning(true); setResult(null); setQuip(null);
    setAngle(a => a - (a % 360) + target);
    setTimeout(() => {
      setSpinning(false); setResult(items[idx]);
      try { saveJSON("x_wheel", Object.assign({}, data, { last: { item: items[idx], ts: Date.now() } })); } catch (e) {}
      if (onReact && Date.now() - lastReact.current > 90000) {   // 连转别连环轰 API
        lastReact.current = Date.now();
        setQuipBusy(true);
        Promise.resolve(onReact(data.title || "", items, items[idx])).then(q => { if (q && q.text) setQuip(q); }).catch(() => {}).finally(() => setQuipBusy(false));
      }
    }, 4200);
  };
  const openEdit = () => { setETitle(data.title || ""); setEItems(items.join("\n")); setEdit(true); };
  const saveEdit = () => {
    const its = eItems.split(/\n+/).map(s => s.trim()).filter(Boolean).slice(0, 8);
    if (its.length < 2) return;
    onSave({ title: eTitle.trim(), items: its });
    setResult(null); setQuip(null); setEdit(false);
  };
  // ⚠根节点必须 stopPropagation：portal 的点击沿 React 树冒泡回小组件的 onClick=setOpen(true)，
  // 否则点 ✕ 关掉的瞬间又被重新打开（表现=「点不了叉」）
  return ReactDOM.createPortal(h("div", { onClick: e => e.stopPropagation(), className: "fixed inset-0 z-[85] flex flex-col items-center", style: { background: "linear-gradient(170deg,#2a2532 0%,#1c1a22 55%,#241f1c 100%)" } },
    // 顶栏：避开刘海/灵动岛（safe-area）+ 大热区（她报「点不到」）
    h("div", { className: "w-full flex items-center justify-between shrink-0", style: { padding: "calc(env(safe-area-inset-top, 0px) + 22px) 10px 4px" } },
      h("button", { onClick: onClose, className: "active:opacity-60", style: { color: "rgba(255,255,255,0.85)", fontSize: 24, lineHeight: 1, padding: "12px 16px", whiteSpace: "nowrap" } }, "✕"),
      h("button", { onClick: openEdit, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 14.5, color: "rgba(255,255,255,0.8)", padding: "12px 16px", whiteSpace: "nowrap" } }, "✎ 编辑")),
    h("div", { className: "flex-1 min-h-0 w-full overflow-y-auto flex flex-col items-center", style: { padding: "0 24px 30px" } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: "#fff", marginTop: 6 } }, data.title || "命运转盘"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 3, letterSpacing: "0.15em" } }, "FATE DECIDES"),
      // 大转盘
      h("div", { onClick: spin, style: { position: "relative", width: 300, height: 300, marginTop: 26, cursor: "pointer", filter: "drop-shadow(0 14px 34px rgba(0,0,0,0.45))" } },
        h(WheelDisc, { items: items, angle: angle, spinning: spinning, size: 300, labels: true, dur: 4.1 }),
        h("div", { style: { position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "11px solid transparent", borderRight: "11px solid transparent", borderTop: "18px solid #e8b04d", filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))" } }),
        !spinning && !result ? h("div", { style: { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", background: "rgba(0,0,0,0.55)", color: "#fff", fontFamily: F_DISPLAY, fontSize: 13, padding: "7px 16px", borderRadius: 999, pointerEvents: "none", whiteSpace: "nowrap" } }, "点一下 开转") : null),
      // 结果
      h("div", { style: { minHeight: 46, marginTop: 22, textAlign: "center" } },
        spinning ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: "rgba(255,255,255,0.6)" } }, "命运旋转中…")
        : result ? h("div", { style: { animation: "fadeUp .35s ease both" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "rgba(255,255,255,0.5)" } }, "命运说——"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 30, color: "#f5d78e", marginTop: 3, fontWeight: 600 } }, result)) : null),
      // 角色起哄（完整气泡，不截断）
      quipBusy ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(255,255,255,0.4)", marginTop: 14 } }, "有人闻着味来了…") : null,
      quip ? h("div", { className: "flex items-start gap-2.5", style: { marginTop: 14, maxWidth: 320, animation: "fadeUp .3s ease both" } },
        quip.char ? h(Avatar, { character: quip.char, size: 36, radius: 999 }) : null,
        h("div", { style: { background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 16, borderTopLeftRadius: 4, padding: "9px 13px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "rgba(255,255,255,0.55)", marginBottom: 2 } }, quip.name),
          h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.65, color: "#fff", whiteSpace: "pre-wrap" } }, quip.text))) : null,
      result && !spinning ? h("button", { onClick: spin, className: "active:opacity-70", style: { marginTop: 22, fontFamily: F_DISPLAY, fontSize: 14, color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 999, padding: "9px 26px" } }, "不服，再转一次") : null),
    // 编辑弹层
    edit ? h("div", { className: "absolute inset-0 z-10 flex items-end", style: { background: "rgba(0,0,0,0.45)" }, onClick: () => setEdit(false) },
      h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", background: t.bg2, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "18px 18px 24px" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, marginBottom: 10 } }, "编辑转盘"),
        h("input", { value: eTitle, onChange: e => setETitle(e.target.value), placeholder: "转盘主题（可空，如：今天吃什么）", style: { width: "100%", outline: "none", padding: "10px 12px", borderRadius: 11, fontFamily: F_BODY, fontSize: 13.5, background: t.bg, color: t.ink, border: "1px solid " + t.line, marginBottom: 10 } }),
        h("textarea", { value: eItems, onChange: e => setEItems(e.target.value), rows: 6, placeholder: "一行一个选项（2~8 个）", style: { width: "100%", outline: "none", resize: "none", padding: "10px 12px", borderRadius: 11, fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.7, background: t.bg, color: t.ink, border: "1px solid " + t.line } }),
        h("div", { className: "flex gap-2", style: { marginTop: 12 } },
          h("button", { onClick: saveEdit, className: "flex-1 active:opacity-70", style: { background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 14, padding: "11px 0", borderRadius: 12 } }, "保存"),
          h("button", { onClick: () => setEdit(false), className: "flex-1 active:opacity-60", style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub, background: t.bg, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 0" } }, "取消")))) : null), document.body);
}
function WheelWidget({ editMode, onReact }) {
  const t = useTheme();
  const [data, setData] = useState(() => loadJSON("x_wheel", { title: "今天吃什么", items: ["火锅", "日料", "麻辣烫", "随便"] }));
  const [open, setOpen] = useState(false);
  const items = (data.items || []).map(s => String(s).trim()).filter(Boolean);
  const save = n => { const merged = Object.assign({}, data, n); setData(merged); saveJSON("x_wheel", merged); };
  return h(GlassCard, { onClick: () => { if (!editMode) setOpen(true); }, style: { padding: "8px 10px", cursor: "pointer", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" } },
    data.title ? h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog, marginBottom: 3, maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, data.title) : null,
    h("div", { style: { position: "relative", width: 86, height: 86, flexShrink: 0 } },
      h(WheelDisc, { items: items, angle: 0, spinning: false, size: 86, labels: true }),
      h("div", { style: { position: "absolute", top: -3, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "8px solid " + t.accent } })),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12, color: t.fog, marginTop: 4, maxWidth: "94%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
      data.last && data.last.item ? "上次 → " + data.last.item : "点开 交给命运"),
    open ? h(WheelFull, { data: data, items: items, onSave: save, onReact: onReact, onClose: () => { setOpen(false); setData(loadJSON("x_wheel", data)); } }) : null);
}
// 电子木鱼小组件：点一下功德+1（纯本地零 API），飘 +1、右下角连击数（2 秒不敲就断）。点不进任何页面，只为敲。
function MuyuWidget({ editMode }) {
  const t = useTheme();
  // 5 秒不敲就清零、功德重新积——她要的「过期作废」型木鱼（v47.73 从 5 分钟收紧到 5 秒，停手当场看着归零）
  const MUYU_IDLE = 5000;
  const [total, setTotal] = useState(() => { try { const v = JSON.parse(localStorage.getItem("x_muyu") || "{}"); return (v.last && Date.now() - v.last > MUYU_IDLE) ? 0 : (v.total || 0); } catch (e) { return 0; } });
  const [combo, setCombo] = useState(0);
  const [pops, setPops] = useState([]);
  const [pressed, setPressed] = useState(false);
  const comboT = useRef(null);
  const idleT = useRef(null);   // 停手清零计时器（不只在下次打开时判，当场归零）
  useEffect(() => {
    if (!document.getElementById("wk-muyu-style")) {
      const st = document.createElement("style"); st.id = "wk-muyu-style";
      st.textContent = "@keyframes wk-pop{0%{opacity:0;transform:translate(-50%,5px) scale(.92)}18%{opacity:1;transform:translate(-50%,0) scale(1)}100%{opacity:0;transform:translate(-50%,-25px) scale(.98)}}@keyframes wk-muyu-ring{0%{opacity:.38;transform:scale(.82)}100%{opacity:0;transform:scale(1.2)}}";
      document.head.appendChild(st);
    }
    return () => { if (comboT.current) clearTimeout(comboT.current); if (idleT.current) clearTimeout(idleT.current); };
  }, []);
  const knock = () => {
    if (editMode) return;
    if (idleT.current) clearTimeout(idleT.current);
    idleT.current = setTimeout(() => { setTotal(0); try { localStorage.setItem("x_muyu", JSON.stringify({ total: 0, last: Date.now() })); } catch (e) {} }, MUYU_IDLE);
    // 函数式更新：快速连敲会在同一渲染批次里触发多次，读闭包旧值会丢计数
    setTotal(prev => { const nt = prev + 1; try { localStorage.setItem("x_muyu", JSON.stringify({ total: nt, last: Date.now() })); } catch (e) {} return nt; });
    setCombo(c => c + 1);
    if (comboT.current) clearTimeout(comboT.current);
    comboT.current = setTimeout(() => setCombo(0), 2000);
    const pid = Date.now() + Math.random();
    setPops(p => [...p.slice(-2), pid]);
    setTimeout(() => setPops(p => p.filter(x => x !== pid)), 700);
    setPressed(true); setTimeout(() => setPressed(false), 90);
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
  };
  // 保留 2x2 透明占位；内部用纸感托盘和暖木雕刻呼应主屏材质，不另造卡片层级。
  const shownTotal = total > 99999 ? Math.floor(total / 1000) + "k" : total;
  return h("div", { onClick: knock, className: "relative flex flex-col items-center justify-center h-full", style: { userSelect: "none", WebkitUserSelect: "none", cursor: "pointer", isolation: "isolate" } },
    h("div", { style: { position: "relative", width: 116, height: 104, display: "flex", alignItems: "center", justifyContent: "center" } },
      h("div", { style: { position: "absolute", inset: "13px 3px 1px", borderRadius: "50%", background: "radial-gradient(ellipse at 50% 36%, rgba(255,255,255,.7) 0%, rgba(232,224,208,.52) 58%, rgba(151,126,93,.16) 100%)", border: "1px solid " + t.line, boxShadow: "inset 0 1px 0 rgba(255,255,255,.72), 0 9px 22px rgba(55,43,30,.12)" } }),
      pressed ? h("div", { style: { position: "absolute", width: 86, height: 68, borderRadius: "50%", border: "1px solid rgba(151,105,63,.35)", animation: "wk-muyu-ring .42s ease-out forwards" } }) : null,
      h("div", { style: { position: "relative", transform: pressed ? "translateY(3px) scale(.95)" : "translateY(0) scale(1)", transition: "transform .1s ease", filter: "drop-shadow(0 7px 7px rgba(62,40,22,.22))" } },
        h("svg", { width: 94, height: 76, viewBox: "0 0 94 76", fill: "none", "aria-hidden": true },
          h("defs", null,
            h("linearGradient", { id: "muyuWood", x1: 17, y1: 10, x2: 77, y2: 68, gradientUnits: "userSpaceOnUse" },
              h("stop", { stopColor: "#d4a56f" }), h("stop", { offset: ".5", stopColor: "#a96f3f" }), h("stop", { offset: "1", stopColor: "#704524" })),
            h("linearGradient", { id: "muyuMallet", x1: 67, y1: 9, x2: 83, y2: 58, gradientUnits: "userSpaceOnUse" },
              h("stop", { stopColor: "#d9b17f" }), h("stop", { offset: "1", stopColor: "#83522d" }))),
          h("ellipse", { cx: 44, cy: 64, rx: 31, ry: 5, fill: "rgba(73,45,25,.15)" }),
          h("path", { d: "M12 40C12 22 25 10 45 10c19 0 33 12 33 30 0 17-14 27-33 27S12 57 12 40Z", fill: "url(#muyuWood)", stroke: "rgba(82,49,25,.72)", strokeWidth: 1.2 }),
          h("path", { d: "M18 35c4-12 14-19 27-19 12 0 22 5 27 14", stroke: "rgba(255,234,202,.42)", strokeWidth: 2.2, strokeLinecap: "round" }),
          h("path", { d: "M28 47c7 7 27 8 36 0", stroke: "#5d371f", strokeWidth: 3.3, strokeLinecap: "round" }),
          h("path", { d: "M47 14c-3 10-3 21 0 31", stroke: "rgba(92,51,25,.55)", strokeWidth: 1.5, strokeLinecap: "round" }),
          h("circle", { cx: 31, cy: 36, r: 2.3, fill: "#5d371f" }),
          h("circle", { cx: 30.3, cy: 35.3, r: .7, fill: "rgba(255,255,255,.5)" }),
          h("g", { style: { transformOrigin: "73px 18px", transform: pressed ? "rotate(-9deg)" : "rotate(0deg)", transition: "transform .1s ease" } },
            h("path", { d: "M70 17 82 56", stroke: "url(#muyuMallet)", strokeWidth: 5, strokeLinecap: "round" }),
            h("ellipse", { cx: 68, cy: 14, rx: 8, ry: 6, transform: "rotate(22 68 14)", fill: "#8d5a33", stroke: "rgba(82,49,25,.7)" }),
            h("path", { d: "M63 12c2-2 6-2 9 0", stroke: "rgba(255,232,199,.4)", strokeWidth: 1.3, strokeLinecap: "round" }))))),
    pops.map(pid => h("span", { key: pid, style: { position: "absolute", left: "50%", top: 3, zIndex: 2, fontFamily: F_BODY, fontSize: 11, fontWeight: 700, letterSpacing: ".04em", color: "#83552f", background: "rgba(250,246,238,.9)", border: "1px solid rgba(142,103,67,.2)", borderRadius: 999, padding: "3px 8px", boxShadow: "0 3px 10px rgba(70,48,28,.1)", pointerEvents: "none", whiteSpace: "nowrap", animation: "wk-pop .65s ease-out forwards" } }, "+1 功德")),
    h("div", { style: { display: "flex", alignItems: "baseline", gap: 6, marginTop: 1 } },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: total > 0 ? 18 : 15, lineHeight: 1, color: t.ink } }, total > 0 ? shownTotal : "敲一敲"),
      total > 0 ? h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: ".12em", color: t.fog } }, "功德") : null),
    combo > 1 ? h("span", { style: { position: "absolute", right: 4, top: 9, zIndex: 2, fontFamily: "'Archivo',sans-serif", fontSize: 9.5, fontWeight: 700, letterSpacing: ".04em", color: "#91633d", background: "rgba(255,255,255,.72)", border: "1px solid rgba(145,99,61,.2)", borderRadius: 999, padding: "3px 6px", boxShadow: "0 3px 10px rgba(70,48,28,.08)" } }, combo + " COMBO") : null);
}
// 情侣空间轮播组件：多位正式在一起的 TA 轮流展示（每 6s 换一位），显示在一起天数+甜蜜值；点开进情侣空间
function UsWidget({ characters, couples, sweet, onOpen, dot }) {
  const t = useTheme();
  const partners = (characters || []).filter(c => couples && couples[c.id] && couples[c.id].status === "together");
  const [ix, setIx] = useState(0);
  useEffect(() => {
    if (partners.length < 2) return;
    const iv = setInterval(() => setIx(i => (i + 1) % partners.length), 6000);
    return () => clearInterval(iv);
  }, [partners.length]);
  const p = partners.length ? partners[ix % partners.length] : null;
  const cp = p ? couples[p.id] : null;
  const days = cp && cp.since ? Math.max(1, Math.floor((Date.now() - cp.since) / 86400000) + 1) : null;
  const svRaw = p && sweet && sweet[p.id] ? Number(sweet[p.id].value) : null;
  const sv = svRaw != null && isFinite(svRaw) ? Math.round(svRaw * 10) / 10 : null;
  return h(GlassCard, { onClick: onOpen, style: { padding: "12px 16px", cursor: "pointer", position: "relative" } },
    dot ? h("span", { style: { position: "absolute", top: 10, right: 12, width: 8, height: 8, borderRadius: 999, background: "#e0524a" } }) : null,
    p ? h("div", { key: p.id, className: "flex items-center gap-3", style: { animation: "fadeUp .35s ease both" } },
      h(Avatar, { character: p, size: 44, radius: 999 }),
      h("div", { className: "flex-1 min-w-0" },
        // 名字与纪念日共用一条弹性行：名字可收缩，天数紧贴在右侧；数字单独放大标粉。
        h("div", { className: "flex items-baseline min-w-0", style: { gap: 10, paddingRight: dot ? 12 : 0 } },
          h("div", { className: "truncate", style: { flex: "1 1 auto", minWidth: 0, fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, whiteSpace: "nowrap" } }, p.remark || p.name),
          days ? h("div", { className: "flex items-baseline", style: { flex: "0 0 auto", fontFamily: F_BODY, whiteSpace: "nowrap", lineHeight: 1 } },
            h("span", { style: { fontSize: 12.5, color: t.fog } }, "在一起第 "),
            h("span", { style: { margin: "0 2px", fontFamily: F_DISPLAY, fontSize: 21, fontWeight: 700, color: "#e78fa1", lineHeight: 1 } }, String(days)),
            h("span", { style: { fontSize: 12.5, color: t.fog } }, " 天")) : null),
        h("div", { style: { paddingRight: partners.length > 1 ? 48 : 24, fontFamily: F_BODY, fontSize: 12.5, color: t.sub, marginTop: 4 } },
          sv != null ? "💗 甜蜜值 " + sv : "点开去看看你们的小空间")),
      h("div", { className: "flex gap-1 items-center", style: { position: "absolute", right: 14, bottom: 9 } },
        partners.length > 1
          ? partners.map((x, i) => h("span", { key: x.id, style: { width: i === ix % partners.length ? 10 : 4, height: 4, borderRadius: 999, background: i === ix % partners.length ? t.accent : t.line, transition: "all .3s" } }))
          : h("span", { style: { fontSize: 14, lineHeight: 1 } }, "💗")))
    : h("div", { className: "flex items-center gap-3" },
        h("div", { className: "flex items-center justify-center", style: { width: 44, height: 44, borderRadius: 999, background: "rgba(255,255,255,0.6)", fontSize: 19 } }, "💗"),
        h("div", { className: "flex-1" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, "情侣空间"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 1 } }, "还没有正式在一起的 TA"))));
}
function MusicWidget({ listen, player, onOpen, homeSize }) {
  const t = useTheme();
  const data = listen || {};
  const songs = data.songs || [];
  // 实时反映全局播放器正在放的歌（可能在库/歌单/临时搜索结果里，都要找得到）
  const nowId = (player && player.songId) || null;
  const findSong = id => {
    if (!id) return null;
    if (id === KEEPALIVE_ID) return KEEPALIVE_SONG;
    if (data.nowSong && data.nowSong.id === id) return data.nowSong;
    let s = songs.find(x => x.id === id); if (s) return s;
    for (const pl of (data.playlists || [])) { const f = (pl.songs || []).find(x => x.id === id); if (f) return f; }
    return null;
  };
  const now = findSong(nowId) || songs[0] || null;
  const playing = !!(player && player.playing && now && now.id === nowId);
  const discImg = (now && now.cover) || data.disc || null;
  const frac = player && player.dur ? Math.max(0, Math.min(1, (player.t || 0) / player.dur)) : 0;
  const compact = homeSize === "short";
  const square = homeSize === "square";
  const forced = homeSize && homeSize !== "auto";
  const discSize = compact ? 38 : square ? 54 : 56;
  return h("button", { onClick: onOpen, className: "w-full active:opacity-85 text-left",
    style: { marginTop: forced ? 0 : 12, height: forced ? "100%" : "auto", minHeight: forced ? 0 : "auto", background: "linear-gradient(160deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.18) 55%, rgba(255,255,255,0.29) 100%)", backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR, border: "1px solid rgba(255,255,255,0.58)", borderRadius: 22, padding: compact ? "8px 10px" : square ? "12px 9px" : "12px 14px", boxShadow: "0 8px 30px rgba(30,28,24,0.12), inset 0 1.2px 0.6px rgba(255,255,255,0.92)", display: "flex", flexDirection: square ? "column" : "row", justifyContent: square ? "center" : "flex-start", alignItems: "center", gap: compact ? 8 : square ? 9 : 13, overflow: "hidden" } },
    h("div", { style: { flexShrink: 0, width: discSize, height: discSize, borderRadius: 999, background: discImg ? "center/cover no-repeat url(" + discImg + ")" : "radial-gradient(circle at 50% 50%, #4a4a52 0 34%, #2b2b30 35%)", boxShadow: "0 3px 12px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", animation: playing ? "wk-spin 9s linear infinite" : "none" } },
      h("div", { style: { width: 14, height: 14, borderRadius: 999, background: "rgba(255,255,255,0.85)", border: "3px solid rgba(0,0,0,0.25)" } })),
    h("div", { style: { flex: 1, minWidth: 0 } },
      !compact && h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: "0.12em", color: t.fog, marginBottom: 2, textAlign: square ? "center" : "left" } }, playing ? "正在播放" : "一起听"),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: compact ? 13 : square ? 14 : 16.5, textAlign: square ? "center" : "left", color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, now ? now.title : "还没有歌"),
      !compact && h("div", { style: { fontFamily: F_BODY, fontSize: square ? 10 : 11.5, textAlign: square ? "center" : "left", color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 } }, now ? (now.artist || "未知歌手") : "点这里添加你们在听的歌"),
      !compact && !square && h("div", { style: { height: 3, borderRadius: 999, background: "rgba(0,0,0,0.08)", marginTop: 8, position: "relative" } },
        h("div", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: (frac ? frac * 100 : 0) + "%", borderRadius: 999, background: t.accent } }))),
    !square && h("div", { style: { flexShrink: 0, width: compact ? 27 : 34, height: compact ? 27 : 34, borderRadius: 999, background: "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center" } },
      playing
        ? h("div", { style: { display: "flex", gap: 2 } }, h("div", { style: { width: 3, height: 12, borderRadius: 2, background: t.ink } }), h("div", { style: { width: 3, height: 12, borderRadius: 2, background: t.ink } }))
        : h("div", { style: { width: 0, height: 0, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: "10px solid " + t.ink, marginLeft: 2 } })));
}
// 全局悬浮迷你播放器：所有界面（含主屏）都浮着；可拖动换位置（存 x_miniPos）；点一下跳回播放器
// ⚠️层级只能是 45：比正文高（浮在所有普通界面上），但【低于半窗(z-50)和全屏 app 壳(z-60)】。
// 她 2026-08-30 报「跑团的 ✕ 点了没反应、连确认框都不弹」——查下来不是删除坏了，是这颗
// 药丸被她拖到了屏幕上半部，正好压在战役卡右上角的 ✕ 上：它和跑团的壳都是 zIndex 60，
// 平级时后画的赢，于是 elementFromPoint 在那个点上返回的是播放器，手指压根碰不到 ✕。
// （实测：✕ 中心 (353,272)，药丸停在 (142,257) 242×64 —— 正中。）
// 悬浮小工具不许盖住整页的操作位，这是通则，不是跑团一家的事。
const MINI_PLAYER_Z = 45;
function MiniPlayer({ song, playing, loading, onOpen, onToggle, onNext, onClose }) {
  const t = useTheme();
  const [pos, setPos] = useState(function () { try { const s = JSON.parse(localStorage.getItem("x_miniPos")); if (s && typeof s.x === "number") return s; } catch (e) {} return null; });
  const elRef = useRef(null);
  const drag = useRef(null);
  const didDrag = useRef(false);
  if (!song) return null;
  const cover = song.cover || null;
  const btnStop = (e, fn) => { e.stopPropagation(); fn(); };
  const onDown = e => { const el = elRef.current; if (!el) return; try { el.setPointerCapture(e.pointerId); } catch (x) {} const r = el.getBoundingClientRect(); drag.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false }; };
  const onMove = e => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.sx, dy = e.clientY - drag.current.sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.current.moved = true;
    if (!drag.current.moved) return;
    if (e.cancelable) e.preventDefault();
    const el = elRef.current, w = el.offsetWidth, hh = el.offsetHeight;
    const nx = Math.max(6, Math.min(window.innerWidth - w - 6, drag.current.ox + dx));
    const ny = Math.max(44, Math.min(window.innerHeight - hh - 8, drag.current.oy + dy));
    setPos({ x: nx, y: ny });
  };
  const onUp = e => { if (drag.current && drag.current.moved) { didDrag.current = true; try { localStorage.setItem("x_miniPos", JSON.stringify(pos)); } catch (x) {} setTimeout(() => { didDrag.current = false; }, 60); } drag.current = null; };
  // 点一下(没拖动)=跳回播放器；拖过就不触发跳转
  const onClick = () => { if (!didDrag.current) onOpen(); };
  const place = pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : { right: 12, bottom: 84 };
  return h("div", { ref: elRef, onClick: onClick, onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp,
    style: Object.assign({ position: "fixed", zIndex: MINI_PLAYER_Z, display: "flex", alignItems: "center", gap: 9, maxWidth: "78vw", touchAction: "none", cursor: "grab",
      background: "rgba(28,26,24,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderRadius: 999, padding: "6px 8px 6px 6px", boxShadow: "0 8px 26px rgba(0,0,0,0.35)" }, place) },
    h("div", { style: { flexShrink: 0, width: 38, height: 38, borderRadius: 999, background: cover ? "center/cover no-repeat url(" + cover + ")" : "radial-gradient(circle at 50% 50%, #55555c 0 36%, #2b2b30 37%)", animation: playing ? "wk-spin 9s linear infinite" : "none" } }),
    h("div", { style: { minWidth: 0, maxWidth: 118 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, song.title),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, song.artist || "")),
    h("button", { onPointerDown: e => e.stopPropagation(), onClick: e => btnStop(e, onToggle), className: "active:opacity-60 shrink-0 flex items-center justify-center", style: { width: 30, height: 30 } },
      loading ? h("span", { style: { color: "#fff", fontSize: 12 } }, "…")
      : playing ? h("svg", { width: 18, height: 18, viewBox: "0 0 24 24" }, h("rect", { x: 6, y: 5, width: 4, height: 14, rx: 1, fill: "#fff" }), h("rect", { x: 14, y: 5, width: 4, height: 14, rx: 1, fill: "#fff" }))
      : h("svg", { width: 18, height: 18, viewBox: "0 0 24 24" }, h("path", { d: "M8 5v14l11-7z", fill: "#fff" }))),
    h("button", { onPointerDown: e => e.stopPropagation(), onClick: e => btnStop(e, onNext), className: "active:opacity-60 shrink-0 flex items-center justify-center", style: { width: 28, height: 30 } },
      h("svg", { width: 16, height: 16, viewBox: "0 0 24 24" }, h("path", { d: "M5 5v14l10-7z", fill: "#fff" }), h("rect", { x: 15.6, y: 5, width: 2.4, height: 14, rx: 1, fill: "#fff" }))),
    // 叉：立刻停播、收起悬浮
    onClose ? h("button", { onPointerDown: e => e.stopPropagation(), onClick: e => btnStop(e, onClose), className: "active:opacity-60 shrink-0 flex items-center justify-center", style: { width: 26, height: 30, marginRight: 2 } },
      h("svg", { width: 14, height: 14, viewBox: "0 0 24 24" }, h("path", { d: "M6 6l12 12M18 6L6 18", stroke: "rgba(255,255,255,0.75)", strokeWidth: 2.2, strokeLinecap: "round" }))) : null);
}
// 全屏月历
// 经期预测
function pKeyDate(k) { const a = String(k).split("-").map(Number); return new Date(a[0], a[1] - 1, a[2]); }
function pDK(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
const PERIOD_COLORS = { period: "#c25a4a", fertile: "#a98bbf", ov: "#7a5aa0", safe: "#7faf7a" };
const PERIOD_LABELS = { period: "经期", fertile: "排卵期", ov: "排卵日", safe: "安全期" };
// 把 period 归一成 [{start,end}]（end 可为 null=还没记录结束）。兼容旧的 starts 数组。
function periodList(period) {
  if (!period) return [];
  const arr = Array.isArray(period.periods) ? period.periods.filter(p => p && p.start) : (period.starts || []).map(s => ({ start: s, end: null }));
  return arr.slice().sort((a, b) => pKeyDate(a.start) - pKeyDate(b.start));
}
function periodSpanLen(p, defLen) { return p.end ? (Math.round((pKeyDate(p.end) - pKeyDate(p.start)) / 86400000) + 1) : defLen; }
function periodMap(period) {
  const map = {};
  if (!period) return map;
  const list = periodList(period);
  const cyc = Math.max(15, period.cycleLen || 28), defLen = Math.max(1, period.periodLen || 5);
  // 实际记录的经期：有结束就按 start→end 实际天数；还没记结束就临时按默认长度显示
  list.forEach(p => {
    const sd = pKeyDate(p.start);
    const end = p.end ? pKeyDate(p.end) : (() => { const d = new Date(sd); d.setDate(d.getDate() + defLen - 1); return d; })();
    let cur = new Date(sd);
    while (cur <= end) { map[pDK(cur)] = { t: "period", actual: true }; cur.setDate(cur.getDate() + 1); }
  });
  if (!list.length) return map;
  // 2026-08-22 修「记新经期后历史全变白」：预测锚点不再只用最近一次——
  // 每一次实际记录都当自己那段的锚，把它到下一次记录之间的日子照常上色（排卵/安全期），
  // 历史区间从此有连续性；只有最后一次才往未来铺 8 个周期。
  const paintCycle = (S, predLen, stopAt) => {
    const ov = new Date(S); ov.setDate(ov.getDate() + cyc - 14);
    for (let i = -4; i <= 1; i++) { const d = new Date(ov); d.setDate(d.getDate() + i); if (stopAt && d >= stopAt) continue; const k = pDK(d); if (!map[k] || map[k].t === "safe") map[k] = { t: i === 0 ? "ov" : "fertile" }; }
    const lastDay = stopAt ? Math.round((stopAt - S) / 86400000) : cyc;
    for (let i = predLen; i < lastDay; i++) { const d = new Date(S); d.setDate(d.getDate() + i); const k = pDK(d); if (!map[k]) map[k] = { t: "safe" }; }
  };
  list.forEach((p, idx) => {
    const anchor = pKeyDate(p.start);
    const predLen = periodSpanLen(p, defLen); // 预测长度用该次的实际天数（没记结束就用默认）
    if (idx < list.length - 1) { paintCycle(anchor, predLen, pKeyDate(list[idx + 1].start)); return; }
    for (let c = 0; c < 8; c++) {
      const S = new Date(anchor); S.setDate(S.getDate() + c * cyc);
      if (c > 0) for (let i = 0; i < predLen; i++) { const d = new Date(S); d.setDate(d.getDate() + i); const k = pDK(d); if (!map[k]) map[k] = { t: "period" }; }
      paintCycle(S, predLen, null);
    }
  });
  return map;
}
// ── 日历（v56.31 重做）──────────────────────────────────────────
// 她 2026-08-26：「把日程合并到日历里面，然后把日历做成这种苹果日历，点开就可以看到本周事项」。
// 月视图（日期 + 农历 + 彩点）→ 点某天 → 两天并排的时间轴。合并显示三层，各存各的：
//   · x_schedules[charId][day].seqs —— AI 排的行程（带 end，画成块）
//   · x_calEvents ——— 手填的日程（带时刻、可跨天，也画成块）
//   · x_calendar ———— 无时刻的全天事件（三视角 + 可见名单，画在顶部全天条）
//   另加节日/生日/备忘录提醒，也走全天条。
function calPadKey(y, m0, d) { return y + "-" + String(m0 + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0"); }
function calMinOf(t) { const m = /(\d{1,2}):(\d{2})/.exec(String(t || "")); return m ? (+m[1]) * 60 + (+m[2]) : null; }
function calHM(min) { return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0"); }
const CAL_SEQ_TINT = { coffee: "#f7dcbb", work: "#bcd7f0", create: "#dbcdf0", meal: "#f6cdd6", rest: "#c2e6df", sleep: "#d8d5e8", social: "#c5e6c2", out: "#ffe0b8" };
const CAL_SEQ_ICON = { coffee: "☕", work: "💼", create: "🎨", meal: "🍽️", rest: "🛋️", sleep: "😴", social: "💬", out: "🚶" };
const CAL_PX_PER_MIN = 0.85;   // 1 小时 ≈ 51px，和参考图一个密度

function Calendar({ characters, calendar, calEvents, schedules, profile, period, busy, genWeekBusy, initialView, onBack, onSaveEvent, onDelEvent, onGenMonth, onSavePeriod, onRecordPeriod, onSaveTimed, onDelTimed, onGenWeek }) {
  const t = useTheme();
  const today = new Date();
  const todayKey = calPadKey(today.getFullYear(), today.getMonth(), today.getDate());
  const cal = calendar || { world: {}, chars: {}, mine: {} };
  const per = period || { cycleLen: 28, periodLen: 5, starts: [], visibleTo: null };
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  // 从聊天页「看 TA 的日程」进来时直接落在那个人身上（原来那个入口指向已退场的行程 app）
  const [view, setView] = useState(initialView || "mine");
  // 从聊天/线下点「看 TA 的日程」进来（initialView 是某个角色）时，直接落在【今天那一天】——
  // 她 2026-08-31：「现在从聊天进到行程那一页是日历整体 view，而不是进到那一天看到实际行程」。
  // 从主屏日历组件进来（没有 initialView）仍旧是整月，那一处她要的就是整月。
  const [mode, setMode] = useState(initialView && initialView !== "mine" ? "day" : "month"); // month | day
  const [daySel, setDaySel] = useState(todayKey);
  const [form, setForm] = useState(null);        // 新增/编辑手填日程
  const [fab, setFab] = useState(false);
  const [dayEv, setDayEv] = useState(null);      // 点开某个块看详情
  const [evTitle, setEvTitle] = useState("");
  const [genOpen, setGenOpen] = useState(false);
  const [genPrompt, setGenPrompt] = useState("");
  const [pSet, setPSet] = useState(false);
  const [pCyc, setPCyc] = useState(per.cycleLen || 28);
  const [pLen, setPLen] = useState(per.periodLen || 5);
  const [visPick, setVisPick] = useState(false);
  const scrollRef = useRef(null);

  const chars = characters || [];
  const curChar = chars.find(c => c.id === view) || null;
  const isCharView = !!curChar;
  // 「世界」并进「我的」：它原本只有全天事件、只往顶部那条塞东西，不值得占一个视角。
  // 数据仍然两个桶——世界事件是【所有角色都知道】的，我的日历要看可见名单，喂进提示词的
  // 也是两句不同的话。合并的只是这块屏。世界那条前面挂个 🌐 区分。
  const store = view === "mine" ? (cal.mine || {}) : ((cal.chars || {})[view] || {});
  const worldStore = cal.world || {};
  const pmap = view === "mine" ? periodMap(per) : {};
  const shift = n => setYm(p => { const dt = new Date(p.y, p.m + n, 1); return { y: dt.getFullYear(), m: dt.getMonth() }; });

  // ---- 一天有什么（三层合并）----
  const legacyKeyOf = dk => { const a = dk.split("-"); return Number(a[0]) + "-" + Number(a[1]) + "-" + Number(a[2]); };
  const parseBd = s => { const m = String(s || "").match(/(?:\d{4}[-/.年])?\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/); if (!m) return null; return { mo: +m[1], dd: +m[2] }; };
  const allDayOn = dk => {
    const out = [];
    const a = dk.split("-").map(Number), dt = new Date(a[0], a[1] - 1, a[2]);
    if (typeof FIXED_FESTIVALS !== "undefined" && FIXED_FESTIVALS[a[1] + "-" + a[2]]) out.push({ text: "🎊 " + FIXED_FESTIVALS[a[1] + "-" + a[2]], kind: "fest" });
    const lf = typeof lunarFestivalOn === "function" ? lunarFestivalOn(dt) : null;
    if (lf) out.push({ text: "🎊 " + lf, kind: "fest" });
    const bd = view === "mine" ? parseBd(profile && profile.birthday) : (curChar ? parseBd(curChar.birthday) : null);
    if (bd && bd.mo === a[1] && bd.dd === a[2]) out.push({ text: "🎂 " + (view === "mine" ? "我的生日" : (curChar.remark || curChar.name) + " 生日"), kind: "bd" });
    if (view === "mine" && window.memoRemindersOnDay) (window.memoRemindersOnDay(a[0], a[1], a[2]) || []).forEach(r => {
      if (r && r.startTime) return;   // 有时刻的画成块，不再挤在顶部
      out.push({ text: "⏰ " + (r.title || r), kind: "memo", id: r && r.id });
    });
    if (view === "mine") (worldStore[legacyKeyOf(dk)] || []).forEach(e => out.push({ text: "🌐 " + e.title, note: e.note, id: e.id, kind: "world" }));
    (store[legacyKeyOf(dk)] || []).forEach(e => out.push({ text: e.title, note: e.note, id: e.id, kind: "cal" }));
    calEventsOnDay(calEvents, view, dk).filter(e => e._allDay).forEach(e => out.push({ text: (e.icon ? e.icon + " " : "") + e.title, id: e.id, kind: "timed", ev: e }));
    return out;
  };
  // 异地：TA 的行程是按 TA 当地时刻排的，而这张表的刻度和「此刻」红线是【你的】时间。
  // 不换算的话，TA 的 16:20 会画在你的 16:20 上，红线和他的一天永远对不上（她 2026-08-26
  // 报的正是这个：角色在日本，日程却按正常时间画）。所以：位置按你的时间，块上写 TA 当地时刻。
  const tzShift = isCharView && typeof schedTzShiftMin === "function" ? schedTzShiftMin(curChar) : 0;
  const toMyMin = m => (m == null ? null : (((m - tzShift) % 1440) + 1440) % 1440);
  // 时间块：AI 行程 + 手填带时刻的
  const blocksOn = dk => {
    const out = [];
    if (isCharView) {
      const plan = ((schedules || {})[view] || {})[dk];
      const seqs = plan && Array.isArray(plan.seqs) ? (typeof schedFillEnds === "function" ? schedFillEnds(plan.seqs) : plan.seqs) : [];
      // 昨晚睡到跨日的那一截，接到今天凌晨（她 2026-08-26：24 点之后第二天不接着显示睡觉）
      if (typeof schedSleepCarry === "function") {
        const prevKey = typeof schedShiftDayKey === "function" ? schedShiftDayKey(dk, -1) : null;
        const carry = prevKey ? schedSleepCarry(((schedules || {})[view] || {})[prevKey], plan) : null;
        if (carry) {
          const st = toMyMin(carry.from), en = st + (carry.to - carry.from);
          if (st < 1440) out.push({ key: "carry", from: st, to: Math.min(1440, en), title: carry.title, location: carry.location,
            icon: CAL_SEQ_ICON.sleep, color: CAL_SEQ_TINT.sleep, ai: true, dev: null, carry: true,
            charFrom: tzShift ? "00:00" : "", charTo: tzShift ? calHM(carry.to) : "" });
        }
      }
      seqs.forEach((s, i) => {
        const cst = calMinOf(s.time); if (cst == null) return;
        let cen = calMinOf(s.end); if (cen == null || cen <= cst) cen = Math.min(1440, cst + 60);
        let st = toMyMin(cst), en = st + (cen - cst);
        // 换算后跨到你这边的前一天/后一天：截在这一天里画，别画成负高度或溢出
        if (en > 1440) en = 1440;
        if (st >= 1440) return;
        out.push({ key: "s" + i, from: st, to: en, title: s.title || "", location: s.location || "",
          icon: CAL_SEQ_ICON[s.type] || "📌", color: CAL_SEQ_TINT[s.type] || "#e6e2da", ai: true, dev: s.deviation || null, raw: s,
          // 块上仍写 TA 当地时刻——他嘴里说的是这个
          charFrom: tzShift ? s.time : "", charTo: tzShift ? (s.end || "") : "" });
      });
    }
    calEventsOnDay(calEvents, view, dk).filter(e => !e._allDay).forEach(e => {
      const st = calMinOf(e._from), en0 = calMinOf(e._to);
      if (st == null) return;
      out.push({ key: e.id, from: st, to: (en0 == null || en0 <= st) ? Math.min(1440, st + 60) : en0,
        title: e.title, location: e.location || "", icon: e.icon || "📌", color: e._color, ai: false, ev: e });
    });
    // 备忘录里填了时刻的提醒，也落在时间轴上（她 2026-08-26）。点开跳回备忘录看同一份详情。
    if (view === "mine" && window.memoRemindersOnDay) {
      const a = dk.split("-").map(Number);
      (window.memoRemindersOnDay(a[0], a[1], a[2]) || []).forEach(r => {
        if (!r || !r.startTime) return;
        const st = calMinOf(r.startTime); if (st == null) return;
        const en = calMinOf(r.endTime);
        out.push({ key: "memo:" + r.id, from: st, to: (en == null || en <= st) ? Math.min(1440, st + 60) : en,
          title: r.title || "提醒", location: r.note || "", icon: "⏰", color: "#e2d6f2", ai: false, memo: r, done: !!r.done });
      });
    }
    return out.sort((a, b) => a.from - b.from);
  };
  const dayHasAnything = dk => allDayOn(dk).length > 0 || blocksOn(dk).length > 0;
  const dotsOn = dk => {
    const cols = [];
    blocksOn(dk).slice(0, 3).forEach(b => cols.push(b.color));
    if (!cols.length && allDayOn(dk).length) cols.push(t.fog);
    return cols;
  };

  // ---- 月视图 ----
  // v56.37：她 2026-08-26 拿 float 那个日历对比，「他的每一个比我们的大」。
  // 「日历 / CALENDAR」那个大标题占掉了整整一屏顶——删掉，头像条上移，
  // 格子改成【按剩下的高度平分】(gridAutoRows:1fr)，六行铺满一屏，日期和农历都放大。
  const cells = calCells(ym.y, ym.m);
  const monthView = () => h("div", { className: "flex-1 flex flex-col min-h-0 px-3" },
    h("div", { className: "shrink-0 flex items-center justify-between px-2 pt-1 pb-1" },
      h("button", { onClick: () => shift(-1), className: "active:opacity-50 px-2 py-1", style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.fog } }, "‹"),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 34, color: t.ink, letterSpacing: "0.02em" } }, ["一","二","三","四","五","六","七","八","九","十","十一","十二"][ym.m] + "月"),
      h("button", { onClick: () => shift(1), className: "active:opacity-50 px-2 py-1", style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.fog } }, "›")),
    view === "mine" ? h("div", { className: "shrink-0 flex items-center gap-3 px-2 pb-1 flex-wrap" },
      ["period", "fertile", "ov", "safe"].map(k => h("span", { key: k, className: "flex items-center gap-1" },
        h("span", { style: { width: 9, height: 9, borderRadius: 999, background: PERIOD_COLORS[k] } }),
        h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, PERIOD_LABELS[k])))) : null,
    h("div", { className: "shrink-0", style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)" } },
      CAL_DOW.map((w, i) => h("div", { key: i, style: { textAlign: "center", fontFamily: F_BODY, fontSize: 12, color: t.fog, paddingBottom: 5 } }, w))),
    h("div", { className: "flex-1 min-h-0", style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gridAutoRows: "1fr", paddingBottom: 6 } },
      cells.map((d, i) => {
        if (d === null) return h("div", { key: i });
        const dk = calPadKey(ym.y, ym.m, d);
        const isT = dk === todayKey;
        const lun = typeof calLunarCell === "function" ? calLunarCell(new Date(ym.y, ym.m, d)) : { text: "", hi: false };
        const pk = pmap[ym.y + "-" + (ym.m + 1) + "-" + d];
        const dots = dotsOn(dk);
        return h("button", { key: i, onClick: () => { setDaySel(dk); setMode("day"); },
          className: "active:opacity-60 flex flex-col items-center justify-center", style: { minHeight: 0, borderTop: "1px solid " + t.line } },
          h("span", { style: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 999,
            background: isT ? "#c25a4a" : (pk ? PERIOD_COLORS[pk.t] + "33" : "transparent"),
            fontFamily: F_DISPLAY, fontSize: 19, color: isT ? "#fff" : t.ink } }, d),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10, lineHeight: 1.3, marginTop: 1, color: lun.hi ? "#c25a4a" : t.fog, maxWidth: "100%", overflow: "hidden", whiteSpace: "nowrap" } }, lun.text),
          h("span", { style: { display: "flex", gap: 2.5, height: 6, marginTop: 2 } },
            dots.map((c, j) => h("span", { key: j, style: { width: 5, height: 5, borderRadius: 999, background: c } }))));
      })));
  // ---- 日视图（两天并排 + 时间轴）----
  const dayList = (() => { const a = daySel.split("-").map(Number); const d0 = new Date(a[0], a[1] - 1, a[2]);
    const d1 = new Date(d0); d1.setDate(d0.getDate() + 1);
    return [calPadKey(d0.getFullYear(), d0.getMonth(), d0.getDate()), calPadKey(d1.getFullYear(), d1.getMonth(), d1.getDate())]; })();
  const weekStrip = (() => { const a = daySel.split("-").map(Number); const d = new Date(a[0], a[1] - 1, a[2]);
    const st = new Date(d); st.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => { const dd = new Date(st); dd.setDate(st.getDate() + i);
      return { key: calPadKey(dd.getFullYear(), dd.getMonth(), dd.getDate()), n: dd.getDate(), dow: CAL_DOW[dd.getDay()], date: dd }; }); })();
  // 时间轴永远是整 24 小时（v56.48）。原来按「当天有没有更早的块」现算范围，结果
  // 27 号第一件事在 05:00，00:00–05:00 就整段不画、怎么拉都拉不上去（她 2026-08-26）；
  // 而且每天起点还不一样，来回翻很晕。现在一律 00:00–24:00，靠自动滚到该看的地方。
  const range = { lo: 0, hi: 24 * 60 };
  const nowMin = today.getHours() * 60 + today.getMinutes();
  const yOf = min => (min - range.lo) * CAL_PX_PER_MIN;
  // 打开时滚到该看的地方：这两天里有今天就滚到「此刻」前一个半小时；
  // 否则滚到当天第一件事之前半小时——不然一进来面对的是一整片凌晨的空白。
  useEffect(() => {
    if (mode !== "day" || !scrollRef.current) return;
    let at;
    if (dayList.indexOf(todayKey) >= 0) at = nowMin - 90;
    else {
      const firsts = dayList.map(dk => { const b = blocksOn(dk); return b.length ? b[0].from : null; }).filter(x => x != null);
      at = (firsts.length ? Math.min.apply(null, firsts) : 8 * 60) - 30;
    }
    scrollRef.current.scrollTop = Math.max(0, yOf(Math.max(range.lo, at)));
  }, [mode, daySel]);

  const blockNode = (b, dk) => {
    const top = yOf(b.from), hgt = Math.max(26, (b.to - b.from) * CAL_PX_PER_MIN - 3);
    return h("button", { key: b.key, onClick: () => { if (b.memo && typeof window.memoOpenReminder === "function") window.memoOpenReminder(b.memo.id); else setDayEv({ b, dk }); },
      className: "absolute active:opacity-70 text-left",
      style: { left: 2, right: 2, top: top, height: hgt, background: b.color + (b.ai ? "88" : "cc"), borderLeft: "3px solid " + b.color,
        borderRadius: 7, padding: "4px 6px", overflow: "hidden", boxShadow: b.dev ? "0 0 0 1.5px #c25a4a inset" : "none" } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: t.ink, lineHeight: 1.25, textDecoration: b.done ? "line-through" : "none" } }, (b.icon ? b.icon + " " : "") + b.title),
      hgt > 40 && h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.sub, marginTop: 1, lineHeight: 1.3 } },
        (b.charFrom ? b.charFrom + "–" + (b.charTo || "") : calHM(b.from) + "–" + (b.to >= 1440 ? "24:00" : calHM(b.to))) + (b.location ? " · " + b.location : "")));
  };
  // 表头和时间轴必须【分开两层】：刻度列和事件列共用同一个滚动内容的 y=0。
  // v56.33 那版把表头塞在滚动区里、刻度列拿 paddingTop:52 去凑——表头高度是变的
  // （日期两行 + 最多三条全天事件），凑不准，块就整体往下错一格（她 2026-08-26 截图：
  // 17:00 的块贴在 19:00 的刻度旁边）。现在表头独立成一行，谁也不用猜谁的高度。
  const dayHeader = dk => {
    const a = dk.split("-").map(Number);
    const ad = allDayOn(dk);
    const lun = typeof calLunarCell === "function" ? calLunarCell(new Date(a[0], a[1] - 1, a[2])) : { text: "" };
    return h("div", { key: dk, className: "px-2 pt-2 pb-1.5", style: { flex: 1, minWidth: 0, borderLeft: "1px solid " + t.line } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: dk === todayKey ? "#c25a4a" : t.ink, textAlign: "center" } },
        a[1] + "月" + a[2] + "日 · " + CAL_DOW[new Date(a[0], a[1] - 1, a[2]).getDay()]),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, textAlign: "center" } }, lun.text),
      ad.length ? h("div", { style: { marginTop: 4, display: "flex", flexDirection: "column", gap: 2 } },
        ad.slice(0, 3).map((x, i) => h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 9.5, color: t.sub, background: t.bg2, borderRadius: 5, padding: "2px 5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.text))) : null);
  };
  const hourRows = (range.hi - range.lo) / 60 + 1;
  const gridH = (range.hi - range.lo) * CAL_PX_PER_MIN;
  const dayColumn = dk => h("div", { key: dk, style: { flex: 1, minWidth: 0, position: "relative", height: gridH, borderLeft: "1px solid " + t.line } },
    Array.from({ length: hourRows }, (_, i) => h("div", { key: i, style: { position: "absolute", left: 0, right: 0, top: i * 60 * CAL_PX_PER_MIN, height: 1, background: t.line, opacity: 0.55 } })),
    blocksOn(dk).map(b => blockNode(b, dk)),
    dk === todayKey && nowMin >= range.lo && nowMin <= range.hi
      ? h("div", { style: { position: "absolute", left: 0, right: 0, top: yOf(nowMin), height: 2, background: "#c25a4a", zIndex: 5 } }) : null);
  const dayView = () => h("div", { className: "flex-1 flex flex-col min-h-0" },
    h("div", { className: "shrink-0 px-3 pb-2", style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 } },
      weekStrip.map(d => h("button", { key: d.key, onClick: () => setDaySel(d.key), className: "flex flex-col items-center active:opacity-60", style: { padding: "3px 0" } },
        h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, d.dow),
        h("span", { style: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 999, marginTop: 2,
          background: d.key === daySel ? t.ink : "transparent", color: d.key === daySel ? t.bg2 : (d.key === todayKey ? "#c25a4a" : t.ink),
          fontFamily: F_DISPLAY, fontSize: 15 } }, d.n)))),
    tzShift ? h("div", { className: "shrink-0 px-4 pb-1", style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.5 } },
      "TA 比你" + (tzShift > 0 ? "快 " : "慢 ") + (Math.abs(tzShift) % 60 ? (Math.abs(tzShift) / 60).toFixed(1) : Math.abs(tzShift) / 60) + " 小时 · 格子按你的时间，块上写的是 TA 当地时刻") : null,
    // 表头行（不滚）
    h("div", { className: "shrink-0 flex", style: { borderBottom: "1px solid " + t.line, background: t.bg } },
      h("div", { className: "shrink-0", style: { width: 44 } }),
      h("div", { style: { flex: 1, display: "flex" } }, dayList.map(dayHeader))),
    // 时间轴（滚）：刻度列和事件列都从内容 y=0 起算，天然对齐
    h("div", { ref: scrollRef, className: "flex-1 overflow-y-auto", style: { display: "flex", alignItems: "flex-start" } },
      h("div", { className: "shrink-0", style: { width: 44, position: "relative", height: gridH + 90 } },
        Array.from({ length: hourRows }, (_, i) => h("div", { key: i, style: { position: "absolute", right: 5, top: i * 60 * CAL_PX_PER_MIN - 6, fontFamily: F_BODY, fontSize: 10, color: t.fog } }, calHM(range.lo + i * 60))),
        nowMin >= range.lo && nowMin <= range.hi && dayList.indexOf(todayKey) >= 0
          ? h("div", { style: { position: "absolute", right: 3, top: yOf(nowMin) - 8, background: "#c25a4a", color: "#fff", fontFamily: F_BODY, fontSize: 9, borderRadius: 4, padding: "1px 4px" } }, calHM(nowMin)) : null),
      // 底下多留 90px：最后一格不会被右下角那个 ＋ 压住
      h("div", { style: { flex: 1, display: "flex", height: gridH + 90 } }, dayList.map(dayColumn))));
  // ---- 人物条 ----
  const personRow = h("div", { className: "shrink-0 flex gap-3 px-4 pb-2 overflow-x-auto", style: { WebkitOverflowScrolling: "touch" } },
    [{ id: "mine", name: "我", c: null }]
      .concat(chars.map(c => ({ id: c.id, name: c.remark || c.name, c })))
      .map(v => h("button", { key: v.id, onClick: () => setView(v.id), className: "shrink-0 flex flex-col items-center gap-1 active:opacity-60", style: { width: 54 } },
        h("span", { style: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 42, height: 42, borderRadius: 999,
          border: view === v.id ? "2px solid " + t.ink : "2px solid transparent", background: t.bg2, overflow: "hidden" } },
          v.c ? h(Avatar, { character: v.c, size: 38, radius: 999 }) : h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.sub } }, "我")),
        h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: view === v.id ? t.ink : t.fog, maxWidth: 54, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, v.name))));

  const visSet = per.visibleTo || [];
  const toggleVis = id => onSavePeriod({ visibleTo: visSet.includes(id) ? visSet.filter(x => x !== id) : [...visSet, id] });

  return h("div", { className: "h-full flex flex-col", style: { position: "relative" } },
    // 顶栏收成一行：返回 + 年份在左，经期/今天在右。原来那个「日历 / CALENDAR」大标题
    // 白占掉小半屏，删了（她 2026-08-26 对比 float：「他的每一个比我们的大」）。
    h("div", { className: "shrink-0 flex items-center justify-between px-4 pb-2", style: { paddingTop: safeTop(16) } },
      h("button", { onClick: mode === "day" ? () => setMode("month") : onBack, className: "flex items-center gap-1.5 active:opacity-50 -ml-1", style: { padding: "4px 6px" } },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.fog, lineHeight: 1 } }, "‹"),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, mode === "day" ? (ym.m + 1) + "月" : ym.y + "年")),
      h("div", { className: "flex items-center gap-3" },
        view === "mine" && h("button", { onClick: () => { setPCyc(per.cycleLen || 28); setPLen(per.periodLen || 5); setPSet(true); }, className: "active:opacity-50", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.tint } }, "经期"),
        h("button", { onClick: () => { setDaySel(todayKey); setYm({ y: today.getFullYear(), m: today.getMonth() }); setMode("month"); }, className: "active:opacity-50", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.tint } }, "今天"))),
    personRow,
    mode === "month" ? monthView() : dayView(),

    // FAB
    h("div", { style: { position: "absolute", right: 18, bottom: 22, zIndex: 30 } },
      fab && h("div", { style: { position: "absolute", right: 0, bottom: 62, width: 190, background: "#fff", borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.16)", overflow: "hidden" } },
        h("button", { onClick: () => { setFab(false); setForm({ owner: view, startDate: daySel, endDate: daySel, startTime: "09:00", endTime: "10:00" }); }, className: "w-full text-left active:opacity-60", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, padding: "13px 16px" } }, "＋　新增日程"),
        isCharView && h("button", { onClick: () => { setFab(false); onGenWeek && onGenWeek(curChar); }, disabled: genWeekBusy, className: "w-full text-left active:opacity-60 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, padding: "13px 16px", borderTop: "1px solid " + t.line } }, genWeekBusy ? "　　正在排…" : "✨　AI 排剩下这几天"),
        // 角色那档不再给这个：他们的日子现在由「AI 排剩下这几天」整天整天地排出来，
        // 再来一层月度事件是重复的（她 2026-08-26）。手填照常，旧数据照常显示、照常喂给角色。
        // 世界大事是另一回事——所有角色都知道的公共事件，留在「我」这档。
        view === "mine" && h("button", { onClick: () => { setFab(false); setGenOpen(true); }, disabled: busy, className: "w-full text-left active:opacity-60 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, padding: "13px 16px", borderTop: "1px solid " + t.line } },
          "🌐　AI 生成本月世界大事")),
      h("button", { onClick: () => setFab(v => !v), className: "active:opacity-70 flex items-center justify-center", style: { width: 52, height: 52, borderRadius: 999, background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 26, boxShadow: "0 8px 22px rgba(0,0,0,0.22)" } }, fab ? "×" : "＋")),

    form && h(CalEventForm, { initial: form, owner: view, ownerName: view === "mine" ? "我" : view === "world" ? "世界" : (curChar ? (curChar.remark || curChar.name) : ""), 
      onClose: () => setForm(null),
      onSave: ev => { onSaveTimed && onSaveTimed(ev); setForm(null); },
      onDelete: id => { onDelTimed && onDelTimed(id); setForm(null); } }),

    // 块详情
    dayEv && h(Sheet, { onClose: () => setDayEv(null) },
      h("div", { className: "px-1 pb-2" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: t.ink } }, (dayEv.b.icon ? dayEv.b.icon + " " : "") + dayEv.b.title),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, marginTop: 4 } },
          calHM(dayEv.b.from) + "–" + (dayEv.b.to >= 1440 ? "24:00" : calHM(dayEv.b.to)) + (dayEv.b.location ? " · " + dayEv.b.location : "") + (dayEv.b.ai ? " · AI 排的" : "")),
        dayEv.b.dev && h("div", { style: { marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#c25a4a11", border: "1px solid #c25a4a44", fontFamily: F_BODY, fontSize: 12.5, color: t.sub, lineHeight: 1.7 } },
          "原本要：" + (dayEv.b.dev.plan || "—") + "\n后来：" + (dayEv.b.dev.actual || "—") + "\n因为：" + (dayEv.b.dev.reason || "—")),
        (() => {
          const plan = isCharView ? ((schedules || {})[view] || {})[dayEv.dk] : null;
          const ms = plan && Array.isArray(plan.murmurs) ? plan.murmurs : [];
          const near = ms.filter(m => { const mm = calMinOf(m.time); return mm != null && mm >= dayEv.b.from - 30 && mm <= dayEv.b.to + 30; });
          return near.length ? h("div", { style: { marginTop: 10 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 4 } }, "这会儿的碎碎念"),
            near.map((m, i) => h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, lineHeight: 1.7 } }, (m.time || "") + "　" + m.text))) : null;
        })(),
        calPlanLoadLine(schedules, view, dayEv.dk, isCharView, t),
        !dayEv.b.ai && h("div", { className: "flex gap-2", style: { marginTop: 14 } },
          h("button", { onClick: () => { setForm(Object.assign({}, dayEv.b.ev)); setDayEv(null); }, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 0" } }, "编辑"),
          h("button", { onClick: () => { onDelTimed && onDelTimed(dayEv.b.ev.id); setDayEv(null); }, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, color: "#c25a4a", border: "1px solid #c25a4a55", borderRadius: 12, padding: "11px 0" } }, "删除")))),

    // 经期设置
    pSet && h(Sheet, { onClose: () => setPSet(false) },
      h("div", { className: "px-1 pb-2" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, marginBottom: 10 } }, "经期"),
        h("div", { className: "flex gap-3", style: { marginBottom: 12 } },
          h("label", { style: { flex: 1, fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "周期（天）",
            h("input", { type: "number", value: pCyc, onChange: e => setPCyc(e.target.value), className: "w-full outline-none", style: { marginTop: 4, padding: "9px 12px", borderRadius: 10, background: t.bg2, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 14, color: t.ink } })),
          h("label", { style: { flex: 1, fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "经期长度（天）",
            h("input", { type: "number", value: pLen, onChange: e => setPLen(e.target.value), className: "w-full outline-none", style: { marginTop: 4, padding: "9px 12px", borderRadius: 10, background: t.bg2, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 14, color: t.ink } }))),
        h("button", { onClick: () => { onRecordPeriod(daySel); setPSet(false); }, className: "w-full active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 0", marginBottom: 8 } }, "把 " + daySel.slice(5) + " 记为这次经期的第一天"),
        h("button", { onClick: () => setVisPick(true), className: "w-full active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, color: t.tint, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 0", marginBottom: 8 } }, "谁能看到我的日历和经期（" + visSet.length + " 位）"),
        h("button", { onClick: () => { onSavePeriod({ cycleLen: Number(pCyc) || 28, periodLen: Number(pLen) || 5 }); setPSet(false); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 13.5, color: t.bg2, background: t.ink, borderRadius: 12, padding: "12px 0" } }, "保存"))),
    visPick && h(Sheet, { onClose: () => setVisPick(false), tall: true },
      h("div", { className: "px-1 pb-2" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, marginBottom: 4 } }, "谁能看到我的日历和经期"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 12 } }, "选中的角色才知道你的生日、私人日历与经期"),
        chars.map(c => h("button", { key: c.id, onClick: () => toggleVis(c.id), className: "w-full flex items-center gap-3 active:opacity-70", style: { padding: "10px 0", borderBottom: "1px solid " + t.line } },
          h(Avatar, { character: c, size: 34, radius: 10 }),
          h("span", { style: { flex: 1, textAlign: "left", fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.remark || c.name),
          h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: visSet.includes(c.id) ? t.tint : t.fog } }, visSet.includes(c.id) ? "可见" : "不可见"))))),

    // AI 生成本月（沿用旧的全天事件那一层）
    genOpen && h(Sheet, { onClose: () => setGenOpen(false) },
      h("div", { className: "px-1 pb-2" },
        h(Eyebrow, { style: { marginBottom: 8 } }, "AI 生成 " + (ym.m + 1) + " 月 · " + (view === "mine" ? "世界大事" : (curChar ? (curChar.remark || curChar.name) : ""))),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 10, lineHeight: 1.5 } }, view === "mine" ? "生成整月的公共大事（所有角色都知道的那种，会挂 🌐 显示）" : "生成这位角色这个月自己的事"),
        h("input", { value: genPrompt, onChange: e => setGenPrompt(e.target.value), placeholder: "想要什么样的事件？（可留空）", className: "w-full outline-none", style: { padding: "10px 12px", borderRadius: 10, background: t.bg2, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 13.5, color: t.ink, marginBottom: 10 } }),
        h("button", { onClick: () => { onGenMonth(view === "mine" ? "world" : view, ym.y, ym.m, genPrompt); setGenOpen(false); setGenPrompt(""); }, disabled: busy, className: "w-full active:opacity-80 disabled:opacity-50", style: { fontFamily: F_BODY, fontSize: 13.5, color: t.bg2, background: t.ink, borderRadius: 12, padding: "12px 0" } }, busy ? "生成中…" : "生成"))),
    busy && h("div", { className: "absolute inset-x-0 bottom-6 flex justify-center" }, h(Spinner, { label: "AI 正在生成…" })));
}
// 负荷/工时那一行（只有角色视角、且当天有 AI 排的行程才显示）
function calPlanLoadLine(schedules, view, dk, isCharView, t) {
  if (!isCharView) return null;
  const plan = ((schedules || {})[view] || {})[dk];
  if (!plan) return null;
  return h("div", { style: { marginTop: 12, fontFamily: F_BODY, fontSize: 11, color: t.fog } },
    "这天：" + (plan.load || "NORMAL") + (plan.estTime ? " · 约 " + plan.estTime + " 小时" : "") + (plan.kind === "plan" ? " · 还没到的计划" : ""));
}
// 新增/编辑日程（v56.31，照她 2026-08-26 给的那张表单做）：
// 开始/结束日期 + 开始/结束时间 + 事项 + 地点 + 图标（点选，再点一次取消）+ 颜色（自动或指定）。
// 时间留空 = 全天。给角色视角也能加，所以顶上标清楚这条记在谁名下。
function CalEventForm({ initial, owner, ownerName, onClose, onSave, onDelete }) {
  const t = useTheme();
  const ini = initial || {};
  const [sd, setSd] = useState(ini.startDate || "");
  const [ed, setEd] = useState(ini.endDate || ini.startDate || "");
  const [stt, setStt] = useState(ini.startTime || "");
  const [ett, setEtt] = useState(ini.endTime || "");
  const [title, setTitle] = useState(ini.title || "");
  const [loc, setLoc] = useState(ini.location || "");
  const [icon, setIcon] = useState(ini.icon || "");
  const [color, setColor] = useState(ini.color || "");
  // 重复（v56.35，她 2026-08-26：「跟备忘录一样」）——用的是同一套规则（calRepeatOn）
  const [repeat, setRepeat] = useState(ini.repeat || "none");
  const allDay = !stt;
  const rec = repeat !== "none";
  const inSt = { width: "100%", outline: "none", padding: "11px 13px", borderRadius: 12, background: t.bg2, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 14.5, color: t.ink };
  const lbl = s => h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 5 } }, s);
  const save = () => {
    if (!title.trim() || !sd) return;
    // 重复的一律单日：跨天 + 重复叠在一起讲不清楚，备忘录那边也是单日
    onSave({ id: ini.id, owner: ini.owner || owner, startDate: sd, endDate: rec ? sd : (ed || sd), startTime: stt, endTime: stt ? ett : "", title: title.trim(), location: loc.trim(), icon, color, repeat, createdAt: ini.createdAt });
  };
  return h(Sheet, { onClose, tall: true },
    h("div", { className: "px-1 pb-3" },
      h("div", { className: "flex items-center justify-between", style: { marginBottom: 14 } },
        h("button", { onClick: onClose, className: "active:opacity-60", style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.fog } }, "‹"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, ini.id ? "编辑日程" : "新增日程"),
        h("button", { onClick: save, className: "active:opacity-60", style: { fontFamily: F_DISPLAY, fontSize: 20, color: title.trim() && sd ? t.ink : t.line } }, "✓")),
      ownerName && h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 12 } }, "记在「" + ownerName + "」名下"),
      h("div", { className: "flex gap-3", style: { marginBottom: 12 } },
        h("div", { style: { flex: 1, minWidth: 0 } }, lbl("开始日期"), h("input", { type: "date", value: sd, onChange: e => { setSd(e.target.value); if (!ed || ed < e.target.value) setEd(e.target.value); }, style: inSt })),
        h("div", { style: { flex: 1, minWidth: 0 } }, lbl("结束日期"), h("input", { type: "date", value: rec ? sd : ed, min: sd, disabled: rec, onChange: e => setEd(e.target.value), style: Object.assign({}, inSt, rec ? { opacity: 0.45 } : null) }))),
      rec ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: -6, marginBottom: 12 } }, "重复的日程按单日算，日期这一栏只用来定从哪天起") : null,
      h("div", { className: "flex gap-3", style: { marginBottom: 12 } },
        h("div", { style: { flex: 1, minWidth: 0 } }, lbl("开始时间"), h("input", { type: "time", value: stt, onChange: e => setStt(e.target.value), style: inSt })),
        h("div", { style: { flex: 1, minWidth: 0 } }, lbl("结束时间"), h("input", { type: "time", value: ett, disabled: allDay, onChange: e => setEtt(e.target.value), style: Object.assign({}, inSt, allDay ? { opacity: 0.45 } : null) }))),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: -6, marginBottom: 12 } }, allDay ? "开始时间留空 = 全天事件（画在顶部那条）" : "留空开始时间就变回全天"),
      h("div", { style: { marginBottom: 12 } }, lbl("事项"), h("input", { value: title, onChange: e => setTitle(e.target.value), placeholder: "例如：部门周会", style: inSt })),
      h("div", { style: { marginBottom: 14 } }, lbl("地点"), h("input", { value: loc, onChange: e => setLoc(e.target.value), placeholder: "例如：公司会议室 / 家里 / 商场", style: inSt })),
      lbl("重复"),
      h("div", { className: "flex gap-2 flex-wrap", style: { marginBottom: 6 } },
        (typeof CAL_REPEAT_OPTIONS !== "undefined" ? CAL_REPEAT_OPTIONS : [["none", "不重复"]]).map(([v, l]) =>
          h("button", { key: v, onClick: () => setRepeat(v), className: "active:opacity-70 shrink-0",
            style: { fontFamily: F_BODY, fontSize: 12.5, padding: "7px 13px", borderRadius: 999,
              background: repeat === v ? t.ink : "transparent", color: repeat === v ? t.bg2 : t.sub, border: "1px solid " + (repeat === v ? t.ink : t.line) } }, l))),
      rec ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.tint, lineHeight: 1.6, background: t.bg2, borderRadius: 10, padding: "8px 11px", marginBottom: 14 } },
        (() => {
          const d = sd ? new Date(sd.split("-")[0], sd.split("-")[1] - 1, sd.split("-")[2]) : null;
          const W = ["日", "一", "二", "三", "四", "五", "六"];
          if (!d) return "选个日期";
          if (repeat === "weekly") return "从这天起，每周" + W[d.getDay()] + "一次。";
          if (repeat === "biweekly") return "从这天起，每两周的周" + W[d.getDay()] + "一次。";
          if (repeat === "monthly") return "每月 " + d.getDate() + " 号" + (d.getDate() >= 29 ? "（碰上没这天的短月，自动落到当月最后一天）" : "") + "。";
          if (repeat === "monthlyEnd") return "每月最后一天（自动适配 28/29/30/31）。";
          return "每年 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日。";
        })()) : h("div", { style: { marginBottom: 8 } }),
      lbl("图标（点选，再点一次取消）"),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 7, marginBottom: 14 } },
        CAL_EVENT_ICONS.map(ic => h("button", { key: ic, onClick: () => setIcon(icon === ic ? "" : ic), className: "active:opacity-60",
          style: { aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, borderRadius: 11,
            background: icon === ic ? t.ink : t.bg2, border: "1px solid " + (icon === ic ? t.ink : t.line) } }, ic))),
      lbl("颜色"),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 9, alignItems: "center", marginBottom: 6 } },
        h("button", { onClick: () => setColor(""), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, padding: "8px 16px", borderRadius: 999, background: color ? t.bg2 : t.ink, color: color ? t.sub : t.bg2, border: "1px solid " + t.line } }, "自动"),
        CAL_EVENT_COLORS.map(c => h("button", { key: c, onClick: () => setColor(c), className: "active:opacity-70",
          style: { width: 34, height: 34, borderRadius: 999, background: c, border: color === c ? "2.5px solid " + t.ink : "1px solid " + t.line } }))),
      ini.id && h("button", { onClick: () => onDelete(ini.id), className: "w-full active:opacity-70", style: { marginTop: 16, fontFamily: F_BODY, fontSize: 13, color: "#c25a4a", border: "1px solid #c25a4a55", borderRadius: 12, padding: "11px 0" } }, "删除这条日程")));
}
// 主屏装饰组件共用的外观预设。预设不只换颜色，也同时规定圆角、边框、材质与留白。
// native 专门给旧组件保留原样；其余预设既能套旧组件，也能套新加的照片框/字句卡/日期签。
const HOME_WIDGET_PRESETS = [
  { id: "native", name: "原生", note: "保持组件原来的样子", chip: "linear-gradient(135deg,#eee8df,#d9d0c4)" },
  { id: "soft", name: "雾面", note: "柔软玻璃与大圆角", chip: "linear-gradient(135deg,rgba(255,255,255,.94),rgba(225,218,209,.75))" },
  { id: "paper", name: "纸页", note: "暖纸、细线和轻阴影", chip: "linear-gradient(135deg,#fffaf0,#e8dcc8)" },
  { id: "polaroid", name: "拍立得", note: "白边与宽下沿", chip: "linear-gradient(135deg,#fff,#e7e3dc)" },
  { id: "film", name: "胶片", note: "深色框与内侧描边", chip: "linear-gradient(135deg,#393733,#111)" },
  { id: "editorial", name: "编辑部", note: "利落直角和黑色细框", chip: "linear-gradient(135deg,#f6f0e6,#d9cfbf)" }
];
// 尺寸和外观是两条独立轴：换成拍立得不会偷偷改占格，改成方块也不会丢掉当前皮肤。
// 4 列主屏里，短条=2×1、方块=2×2、长条=4×1、大卡=4×2；auto 沿用组件自己的尺寸。
const HOME_SIZE_PRESETS = [
  { id: "auto", name: "原尺寸", note: "跟随组件默认占格", cols: 0, rows: 0, glyph: "▭" },
  { id: "short", name: "短条", note: "2 × 1", cols: 2, rows: 1, glyph: "▬" },
  { id: "square", name: "方块", note: "2 × 2", cols: 2, rows: 2, glyph: "■" },
  { id: "wide", name: "长条", note: "4 × 1", cols: 4, rows: 1, glyph: "━" },
  { id: "large", name: "大卡", note: "4 × 2", cols: 4, rows: 2, glyph: "▰" }
];
// 装饰不是换图标的文字卡：每一种都有自己的内容语义、默认尺寸和渲染骨架。
const HOME_DECOR_TYPES = [
  { id: "photo", glyph: "▣", name: "照片框", text: "", detail: "" },
  { id: "quote", glyph: "“", name: "字句卡", text: "把喜欢的日子，慢慢摆在桌面上。", detail: "" },
  { id: "date", glyph: "31", name: "日期签", text: "今天", detail: "" },
  { id: "ticket", glyph: "票", name: "票根夹", text: "今晚的入场券", detail: "留住一场值得记住的事" },
  { id: "letter", glyph: "✉", name: "信封", text: "给未来的一封信", detail: "慢一点拆开，也没关系。" },
  { id: "note", glyph: "✓", name: "便利贴", text: "今天要记得：", detail: "把重要的小事留在眼前" },
  { id: "cassette", glyph: "◉", name: "录音磁带", text: "这一刻的声音", detail: "00:00 · 留声" },
  { id: "trinket", glyph: "◇", name: "小物陈列盒", text: "一枚被留下的小东西", detail: "它的故事还没有写完。" }
];
function homeDecorMeta(type) {
  return HOME_DECOR_TYPES.find(function (x) { return x.id === type; }) || HOME_DECOR_TYPES[1];
}
function homeDecorHasDetail(type) {
  return type !== "photo";
}
const HOME_DECOR_SURFACES = [
  { id: "paper", name: "保留纸面" },
  { id: "tint", name: "强调色底" },
  { id: "glass", name: "半透明玻璃" },
  { id: "transparent", name: "透明底" }
];
const HOME_DECOR_BORDERS = [
  { id: "line", name: "细边" },
  { id: "dashed", name: "虚线" },
  { id: "none", name: "无边框" }
];
const HOME_DECOR_TILTS = [
  { value: -8, name: "左斜" },
  { value: -4, name: "微左" },
  { value: 0, name: "摆正" },
  { value: 4, name: "微右" },
  { value: 8, name: "右斜" }
];
const HOME_DECOR_ACCENTS = ["#b65f57", "#c08a43", "#67806f", "#57758b", "#765f83", "#2e2b28"];
function normalizeHomeDecorTilt(value) {
  var n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-12, Math.min(12, Math.round(n)));
}
function homeDecorRgba(hex, alpha) {
  var raw = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(raw)) return "rgba(182,95,87," + alpha + ")";
  return "rgba(" + parseInt(raw.slice(0, 2), 16) + "," + parseInt(raw.slice(2, 4), 16) + "," + parseInt(raw.slice(4, 6), 16) + "," + alpha + ")";
}
function homeDecorMaterialStyle(item, t) {
  item = item || {};
  var accent = item.accent || "#b65f57";
  var surface = item.surface || "paper";
  var borderMode = item.borderMode || "line";
  var tilt = normalizeHomeDecorTilt(item.tilt);
  var style = { textAlign: item.align || "left", transform: "rotate(" + tilt + "deg)", transformOrigin: "center center", transition: "transform .18s ease" };
  if (surface === "transparent") Object.assign(style, { background: "transparent", boxShadow: "none", backdropFilter: "none", WebkitBackdropFilter: "none" });
  if (surface === "tint") Object.assign(style, { background: "linear-gradient(145deg," + homeDecorRgba(accent, .19) + "," + homeDecorRgba(accent, .07) + ")", boxShadow: "0 8px 22px " + homeDecorRgba(accent, .12) });
  if (surface === "glass") Object.assign(style, { background: "rgba(255,255,255,.32)", boxShadow: "0 9px 26px rgba(40,34,28,.10)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" });
  if (borderMode === "none") style.border = "none";
  else if (borderMode === "dashed") style.border = "1px dashed " + homeDecorRgba(accent, .78);
  else style.border = "1px solid " + homeDecorRgba(accent, .52);
  return style;
}
const HOME_PHOTO_FRAMES = [
  { id: "single", name: "单张", note: "一张照片完整铺开", need: 1 },
  { id: "film3", name: "三格胶卷", note: "横向三连，适合长条", need: 3 },
  { id: "fan3", name: "V 形拍立得", note: "三张错落重叠", need: 3 },
  { id: "torn4", name: "撕页拼贴", note: "四张像从手账里撕下", need: 4 },
  { id: "contact6", name: "胶片印样", note: "六格暗房接触印样", need: 6 },
  { id: "envelope", name: "信封夹层", note: "照片从一封信里露出来", need: 1 },
  { id: "evidence2", name: "证物档案", note: "两张照片钉进调查页", need: 2 },
  { id: "audioPhoto", name: "留声照片", note: "一张带唱片与波形的照片", need: 1 },
  { id: "booth4", name: "四格大头贴", note: "竖向四连的照相亭纸条", need: 4 },
  { id: "window4", name: "窗格四联", note: "四张照片嵌进一扇窗", need: 4 },
  { id: "postcard2", name: "旅行明信片", note: "两张带邮戳的错落卡片", need: 2 },
  { id: "locket2", name: "双页吊坠", note: "两张心形纪念照并排收藏", need: 2 },
  { id: "magazine3", name: "杂志剪版", note: "一张头图配两格边栏", need: 3 },
  { id: "route3", name: "旅行轨迹", note: "三张照片沿路线散开", need: 3 },
  { id: "drawer4", name: "标本抽屉", note: "四格编号收藏柜", need: 4 },
  { id: "timeline5", name: "记忆时间轴", note: "五张照片串成一段故事", need: 5 }
];
function homePhotoSlotCount(frame) {
  var found = HOME_PHOTO_FRAMES.find(function (x) { return x.id === frame; });
  return found ? found.need : 1;
}
// 空槽也必须是数据的一部分：三格相框可以先摆空框，之后逐格补图，不能因数组稀疏而吞掉位置。
function normalizeHomePhotoSlots(refs, frame) {
  var old = Array.isArray(refs) ? refs : [];
  return Array.from({ length: homePhotoSlotCount(frame) }, function (_, i) { return old[i] || ""; });
}
function defaultHomeItemSpan(it) {
  if (!it || (it.kind !== "widget" && it.kind !== "decor")) return [1, 1];
  if (it.kind === "decor") {
    if (it.which === "photo") return [2, 2];
    if (it.which === "quote") return [4, 1];
    if (it.which === "ticket" || it.which === "cassette") return [4, 1];
    if (it.which === "letter" || it.which === "note" || it.which === "trinket") return [2, 2];
    return [2, 1];
  }
  if (it.which === "cal") return [3, 3];
  if (it.which === "map" || it.which === "muyu" || it.which === "wheel") return [2, 2];
  if (it.which === "weather" || it.which === "ledger") return [2, 1];
  return [4, 1];
}
function homeItemSpan(key, it, sizes) {
  var wanted = sizes && sizes[key];
  var p = HOME_SIZE_PRESETS.find(function (x) { return x.id === wanted; });
  return p && p.cols && p.rows ? [p.cols, p.rows] : defaultHomeItemSpan(it);
}
function homeWidgetPresetStyle(id, t, kind) {
  if (!id || id === "native") return null;
  var base = { width: "100%", height: "100%", boxSizing: "border-box", position: "relative" };
  if (id === "soft") return Object.assign(base, { padding: kind === "photo" ? 7 : 9, borderRadius: 25, overflow: "hidden", background: "rgba(255,255,255,.52)", border: "1px solid rgba(255,255,255,.78)", boxShadow: "0 10px 28px rgba(40,34,28,.13)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" });
  if (id === "paper") return Object.assign(base, { padding: kind === "photo" ? 9 : 12, borderRadius: 11, overflow: "hidden", background: "#fbf4e8", border: "1px solid rgba(101,83,61,.22)", boxShadow: "0 7px 18px rgba(67,51,34,.12)" });
  if (id === "polaroid") return Object.assign(base, { padding: kind === "photo" ? "9px 9px 23px" : "12px 12px 20px", borderRadius: 6, overflow: "hidden", background: "#fffdf8", border: "1px solid rgba(35,31,27,.12)", boxShadow: "0 9px 21px rgba(35,31,27,.18)" });
  if (id === "film") return Object.assign(base, { padding: kind === "photo" ? 9 : 12, borderRadius: 13, overflow: "hidden", color: "#f6f0e7", background: "#1f1e1b", border: "1px solid #080808", boxShadow: "inset 0 0 0 2px rgba(255,255,255,.12),0 10px 22px rgba(20,18,15,.24)" });
  return Object.assign(base, { padding: kind === "photo" ? 7 : 11, borderRadius: 2, overflow: "hidden", background: "rgba(248,243,234,.96)", border: "1.5px solid " + t.ink, boxShadow: "4px 4px 0 rgba(30,28,24,.12)" });
}
function HomeDecorItem({ item, preset, now }) {
  const t = useTheme();
  const dark = preset === "film";
  const ink = dark ? "#f7f1e8" : t.ink;
  const sub = dark ? "rgba(247,241,232,.62)" : t.fog;
  const accent = item.accent || (dark ? "#d7b16b" : t.accent);
  if (item.type === "photo") {
    var refs = Array.isArray(item.imageRefs) && item.imageRefs.length ? item.imageRefs : (item.imageRef ? [item.imageRef] : []);
    var frame = item.frame || "single";
    var srcs = normalizeHomePhotoSlots(refs, frame).map(function (ref) { return ref && typeof resolveImg === "function" ? resolveImg(ref) : ref; });
    var caption = item.caption || item.text || "";
    var photo = function (src, i, style) {
      return h("div", { key: i, style: Object.assign({ overflow: "hidden", background: dark ? "#0d0d0c" : t.bg2 }, style || {}) },
        src ? h("img", { src: src, alt: caption || "桌面照片", draggable: false, style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } }) : h("div", { "aria-label": "空照片位", style: { width: "100%", height: "100%" } }));
    };
    var body;
    if (frame === "film3") {
      body = h("div", { style: { width: "100%", height: "100%", minHeight: 72, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 4, padding: "11px 5px", background: "repeating-linear-gradient(90deg,#161513 0 8px,#292724 8px 12px)", position: "relative" } },
        [0, 1, 2].map(function (i) { return photo(srcs[i], i, { border: "2px solid rgba(255,255,255,.82)", borderRadius: 1 }); }),
        h("div", { style: { position: "absolute", left: 4, right: 4, top: 3, height: 4, background: "repeating-linear-gradient(90deg,rgba(255,255,255,.75) 0 5px,transparent 5px 12px)" } }),
        h("div", { style: { position: "absolute", left: 4, right: 4, bottom: 3, height: 4, background: "repeating-linear-gradient(90deg,rgba(255,255,255,.75) 0 5px,transparent 5px 12px)" } }));
    } else if (frame === "fan3") {
      body = h("div", { style: { width: "100%", height: "100%", minHeight: 145, position: "relative", overflow: "hidden", background: dark ? "#171613" : "rgba(239,232,220,.55)" } },
        [0, 1, 2].map(function (i) {
          var turns = [-10, 0, 10], lefts = [7, 27, 47];
          return photo(srcs[i], i, { position: "absolute", width: "47%", height: "76%", left: lefts[i] + "%", top: i === 1 ? "8%" : "15%", transform: "translateX(-10%) rotate(" + turns[i] + "deg)", transformOrigin: "50% 100%", border: "6px solid #fffdf8", borderBottomWidth: 17, borderRadius: 2, boxShadow: "0 7px 18px rgba(30,26,22,.24)", zIndex: i === 1 ? 2 : 1 });
        }));
    } else if (frame === "torn4") {
      var tornPos = [
        { left: "4%", top: "5%", width: "55%", height: "48%", transform: "rotate(-4deg)", clipPath: "polygon(2% 3%,98% 0,96% 96%,4% 100%,0 46%)" },
        { right: "3%", top: "9%", width: "42%", height: "42%", transform: "rotate(5deg)", clipPath: "polygon(3% 0,100% 4%,96% 100%,0 95%)" },
        { left: "7%", bottom: "4%", width: "42%", height: "45%", transform: "rotate(3deg)", clipPath: "polygon(0 5%,96% 0,100% 94%,4% 100%)" },
        { right: "5%", bottom: "5%", width: "50%", height: "47%", transform: "rotate(-3deg)", clipPath: "polygon(4% 0,100% 5%,96% 100%,0 94%)" }
      ];
      body = h("div", { style: { width: "100%", height: "100%", minHeight: 145, position: "relative", overflow: "hidden", background: dark ? "#24211e" : "#eee3d2" } },
        h("div", { style: { position: "absolute", left: "47%", top: "2%", width: 18, height: "48%", background: "rgba(215,184,126,.55)", transform: "rotate(14deg)", zIndex: 5 } }),
        tornPos.map(function (pos, i) { return photo(srcs[i], i, Object.assign({ position: "absolute", border: "5px solid #fffaf0", boxShadow: "0 5px 13px rgba(40,30,22,.23)" }, pos)); }));
    } else if (frame === "contact6") {
      body = h("div", { style: { width: "100%", height: "100%", minHeight: 145, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gridTemplateRows: "repeat(2,minmax(0,1fr))", gap: 5, padding: "18px 8px 16px", background: "#171412", border: "1px solid #050505", position: "relative" } },
        srcs.map(function (src, i) { return h("div", { key: i, style: { minWidth: 0, minHeight: 0, position: "relative" } },
          photo(src, i, { width: "100%", height: "100%", border: "1px solid rgba(244,225,187,.55)" }),
          h("span", { style: { position: "absolute", right: 2, bottom: 1, color: "rgba(255,239,207,.72)", fontFamily: "monospace", fontSize: 6, lineHeight: 1 } }, String(i + 1).padStart(2, "0")));
        }),
        h("div", { style: { position: "absolute", left: 8, top: 4, color: "rgba(255,234,192,.72)", fontFamily: "monospace", fontSize: 7, letterSpacing: ".15em" } }, "CONTACT / 36"));
    } else if (frame === "envelope") {
      body = h("div", { style: { width: "100%", height: "100%", minHeight: 145, position: "relative", overflow: "hidden", background: dark ? "#24201b" : "#e8dcc8" } },
        h("div", { style: { position: "absolute", left: "18%", top: "6%", width: "64%", height: "73%", padding: 6, paddingBottom: 16, background: "#fffdf6", transform: "rotate(-3deg)", boxShadow: "0 8px 18px rgba(54,41,29,.2)" } }, photo(srcs[0], 0, { width: "100%", height: "100%" })),
        h("div", { style: { position: "absolute", left: "3%", right: "3%", bottom: "3%", height: "47%", background: "#d8c29e", clipPath: "polygon(0 0,50% 58%,100% 0,100% 100%,0 100%)", boxShadow: "0 -1px 0 rgba(98,72,42,.18)", zIndex: 3 } }),
        h("div", { style: { position: "absolute", left: "3%", right: "3%", bottom: "3%", height: "47%", background: "rgba(246,231,203,.88)", clipPath: "polygon(0 100%,0 25%,50% 68%,100% 25%,100% 100%)", zIndex: 4 } }),
        h("div", { style: { position: "absolute", right: "12%", bottom: "12%", width: 25, height: 25, borderRadius: 999, background: "#9d5547", boxShadow: "inset 0 0 0 3px rgba(91,35,31,.18)", color: "rgba(255,238,213,.78)", fontFamily: "Georgia,serif", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 } }, "L"));
    } else if (frame === "evidence2") {
      body = h("div", { style: { width: "100%", height: "100%", minHeight: 145, position: "relative", overflow: "hidden", background: dark ? "#242321" : "#eee9dc", border: "1px solid rgba(62,55,43,.24)" } },
        h("div", { style: { position: "absolute", left: 8, top: 7, fontFamily: "monospace", fontSize: 7, color: dark ? "rgba(255,255,255,.5)" : "#725f50", letterSpacing: ".12em" } }, "EVIDENCE / " + String((now instanceof Date ? now : new Date()).getDate()).padStart(2, "0")),
        photo(srcs[0], 0, { position: "absolute", left: "6%", top: "20%", width: "52%", height: "58%", transform: "rotate(-3deg)", border: "5px solid #fbfaf4", boxShadow: "0 5px 12px rgba(30,28,24,.2)" }),
        photo(srcs[1], 1, { position: "absolute", right: "5%", bottom: "8%", width: "46%", height: "53%", transform: "rotate(4deg)", border: "5px solid #fbfaf4", boxShadow: "0 5px 12px rgba(30,28,24,.2)" }),
        h("div", { style: { position: "absolute", right: "9%", top: "8%", border: "2px solid #a94e42", color: "#a94e42", padding: "3px 5px", transform: "rotate(7deg)", fontFamily: "monospace", fontSize: 7, letterSpacing: ".1em" } }, "ARCHIVED"),
        h("div", { style: { position: "absolute", left: "27%", top: "15%", width: 9, height: 25, border: "2px solid #777", borderRadius: 999, transform: "rotate(8deg)", zIndex: 4 } }));
    } else if (frame === "audioPhoto") {
      body = h("div", { style: { width: "100%", height: "100%", minHeight: 145, position: "relative", overflow: "hidden", background: dark ? "#161514" : "#e8e0d5" } },
        photo(srcs[0], 0, { position: "absolute", left: "6%", top: "8%", width: "66%", height: "76%", border: "6px solid #fffdf8", borderBottomWidth: 19, boxShadow: "0 7px 16px rgba(31,27,23,.2)" }),
        h("div", { style: { position: "absolute", right: "3%", bottom: "7%", width: "43%", aspectRatio: "1", borderRadius: 999, background: "repeating-radial-gradient(circle,#2a2825 0 3px,#171614 3px 5px)", boxShadow: "0 6px 14px rgba(20,18,16,.28)", display: "flex", alignItems: "center", justifyContent: "center" } },
          h("div", { style: { width: "28%", height: "28%", borderRadius: 999, background: "#b95f59", border: "3px solid #e8c99f" } })),
        h("div", { style: { position: "absolute", left: "13%", right: "35%", bottom: "8%", height: 12, display: "flex", alignItems: "center", gap: 2, zIndex: 4 } }, [5, 9, 4, 11, 7, 3, 8, 5].map(function (n, i) { return h("span", { key: i, style: { flex: 1, height: n, background: "rgba(74,60,50,.62)", borderRadius: 3 } }); })));
    } else if (frame === "booth4") {
      body = h("div", { style: { width: "100%", height: "100%", minHeight: 145, position: "relative", overflow: "hidden", background: dark ? "#171614" : "#d9d2c6" } },
        h("div", { style: { position: "absolute", left: "27%", top: "3%", width: "46%", height: "94%", padding: "6px 7px 15px", display: "grid", gridTemplateRows: "repeat(4,minmax(0,1fr))", gap: 3, background: "#fffdf8", boxShadow: "0 7px 18px rgba(28,24,20,.24)", transform: "rotate(-1.5deg)" } },
          srcs.map(function (src, i) { return photo(src, i, { minHeight: 0, border: "1px solid rgba(34,30,26,.12)" }); }),
          h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 4, textAlign: "center", fontFamily: "monospace", fontSize: 6, letterSpacing: ".15em", color: "#7a7065" } }, "PHOTO BOOTH")),
        h("div", { style: { position: "absolute", right: "9%", top: "9%", width: 19, height: 38, border: "1px dashed rgba(78,66,54,.38)", borderRadius: 999, transform: "rotate(9deg)" } }));
    } else if (frame === "window4") {
      body = h("div", { style: { width: "100%", height: "100%", minHeight: 145, padding: 11, position: "relative", overflow: "hidden", background: dark ? "#282522" : "#ded4c2", boxShadow: "inset 0 0 0 5px rgba(91,70,48,.16)" } },
        h("div", { style: { width: "100%", height: "100%", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gridTemplateRows: "repeat(2,minmax(0,1fr))", gap: 7, padding: 4, background: dark ? "#4b4036" : "#f7f0e4", border: "3px solid " + (dark ? "#67584a" : "#9d8263"), boxShadow: "inset 0 0 0 2px rgba(255,255,255,.45),0 6px 13px rgba(40,31,22,.18)" } },
          srcs.map(function (src, i) { return photo(src, i, { minWidth: 0, minHeight: 0, border: "1px solid rgba(67,50,34,.18)" }); })),
        h("div", { style: { position: "absolute", left: "50%", top: 8, bottom: 8, width: 3, background: dark ? "#67584a" : "#9d8263", transform: "translateX(-50%)", pointerEvents: "none" } }),
        h("div", { style: { position: "absolute", left: 8, right: 8, top: "50%", height: 3, background: dark ? "#67584a" : "#9d8263", transform: "translateY(-50%)", pointerEvents: "none" } }));
    } else if (frame === "postcard2") {
      body = h("div", { style: { width: "100%", height: "100%", minHeight: 145, position: "relative", overflow: "hidden", background: dark ? "#211f1c" : "#e8dece" } },
        [0, 1].map(function (i) {
          var pos = i === 0 ? { left: "5%", top: "9%", transform: "rotate(-5deg)", zIndex: 1 } : { right: "4%", bottom: "8%", transform: "rotate(5deg)", zIndex: 2 };
          return h("div", { key: i, style: Object.assign({ position: "absolute", width: "62%", height: "57%", padding: "6px 6px 15px", background: "#fffaf0", border: "1px solid rgba(92,69,43,.2)", boxShadow: "0 6px 14px rgba(36,29,22,.2)" }, pos) },
            photo(srcs[i], i, { width: "100%", height: "100%" }),
            h("span", { style: { position: "absolute", left: 7, bottom: 4, fontFamily: "Georgia,serif", fontSize: 7, color: "#76614d", fontStyle: "italic" } }, i ? "wish you were here" : "from somewhere"),
            h("span", { style: { position: "absolute", right: 6, bottom: 3, width: 15, height: 12, border: "1px dashed #a56b5d", color: "#a56b5d", fontFamily: "monospace", fontSize: 6, display: "flex", alignItems: "center", justifyContent: "center" } }, "AIR"));
        }),
        h("div", { style: { position: "absolute", right: "8%", top: "8%", width: 31, height: 31, border: "2px solid rgba(153,77,66,.55)", borderRadius: 999, color: "rgba(153,77,66,.7)", fontFamily: "monospace", fontSize: 6, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(12deg)" } }, "POST"));
    } else if (frame === "locket2") {
      body = h("div", { style: { width: "100%", height: "100%", minHeight: 145, position: "relative", overflow: "hidden", background: dark ? "radial-gradient(circle at 50% 45%,#332923,#171514 72%)" : "radial-gradient(circle at 50% 45%,#f3e6d0,#ddd0ba 72%)" } },
        h("div", { style: { position: "absolute", left: "50%", top: "2%", width: 16, height: 22, border: "3px solid " + (dark ? "#ad8b55" : "#a98249"), borderRadius: 999, transform: "translateX(-50%)" } }),
        [0, 1].map(function (i) {
          var left = i === 0 ? "7%" : "50%";
          return h("div", { key: i, style: { position: "absolute", left: left, top: "19%", width: "43%", height: "65%", padding: 6, background: dark ? "#8d6a3e" : "#b38a50", clipPath: "polygon(50% 8%,61% 0,78% 2%,92% 14%,100% 31%,97% 48%,86% 65%,50% 100%,14% 65%,3% 48%,0 31%,8% 14%,22% 2%,39% 0)", filter: "drop-shadow(0 6px 5px rgba(34,25,18,.24))" } },
            photo(srcs[i], i, { width: "100%", height: "100%", clipPath: "polygon(50% 8%,62% 1%,78% 4%,91% 17%,96% 32%,92% 48%,82% 63%,50% 94%,18% 63%,8% 48%,4% 32%,9% 17%,22% 4%,38% 1%)", background: dark ? "#1c1916" : "#eee3d1" }));
        }),
        h("div", { style: { position: "absolute", left: "49.6%", top: "23%", bottom: "21%", width: 2, background: dark ? "rgba(224,188,116,.66)" : "rgba(119,83,38,.55)", zIndex: 4 } }));
    } else if (frame === "magazine3") {
      body = h("div", { style: { width: "100%", height: "100%", minHeight: 145, position: "relative", overflow: "hidden", padding: 8, background: dark ? "#121212" : "#f4efe6", color: dark ? "#f6efe6" : "#201d19" } },
        h("div", { style: { position: "absolute", left: 9, top: 5, fontFamily: "Arial Black,Arial,sans-serif", fontSize: 10, letterSpacing: "-.05em", zIndex: 4 } }, "WEEKEND"),
        h("div", { style: { position: "absolute", right: 9, top: 6, fontFamily: "monospace", fontSize: 6, letterSpacing: ".14em", opacity: .55, zIndex: 4 } }, "VOL. 01"),
        h("div", { style: { position: "absolute", left: 8, right: 8, top: 21, bottom: 8, display: "grid", gridTemplateColumns: "1.58fr .82fr", gridTemplateRows: "repeat(2,minmax(0,1fr))", gap: 5 } },
          photo(srcs[0], 0, { gridRow: "1 / 3", minWidth: 0, minHeight: 0 }),
          photo(srcs[1], 1, { minWidth: 0, minHeight: 0 }),
          photo(srcs[2], 2, { minWidth: 0, minHeight: 0 })),
        h("div", { style: { position: "absolute", left: 13, bottom: 14, maxWidth: "58%", padding: "3px 5px", background: dark ? "#f2e8d9" : "#201d19", color: dark ? "#181614" : "#fffaf0", fontFamily: F_DISPLAY, fontSize: 9, lineHeight: 1.15, zIndex: 5 } }, caption || "A SMALL STORY"));
    } else if (frame === "route3") {
      body = h("div", { style: { width: "100%", height: "100%", minHeight: 145, position: "relative", overflow: "hidden", background: dark ? "#1e211f" : "#e8e2d2", backgroundImage: "linear-gradient(" + (dark ? "rgba(255,255,255,.04)" : "rgba(98,91,74,.08)") + " 1px,transparent 1px),linear-gradient(90deg," + (dark ? "rgba(255,255,255,.04)" : "rgba(98,91,74,.08)") + " 1px,transparent 1px)", backgroundSize: "17px 17px" } },
        h("div", { style: { position: "absolute", left: "15%", top: "24%", width: "70%", height: "48%", border: "2px dashed " + (dark ? "rgba(226,196,132,.55)" : "rgba(117,84,52,.45)"), borderColor: (dark ? "rgba(226,196,132,.55)" : "rgba(117,84,52,.45)") + " transparent " + (dark ? "rgba(226,196,132,.55)" : "rgba(117,84,52,.45)"), borderRadius: "50%", transform: "rotate(-8deg)" } }),
        [
          { left: "4%", top: "8%", transform: "rotate(-6deg)" },
          { right: "5%", top: "13%", transform: "rotate(5deg)" },
          { left: "29%", bottom: "5%", transform: "rotate(2deg)" }
        ].map(function (pos, i) { return h("div", { key: i, style: Object.assign({ position: "absolute", width: "42%", height: "42%", padding: "4px 4px 12px", background: "#fffaf0", boxShadow: "0 5px 12px rgba(33,27,21,.19)", zIndex: i === 2 ? 3 : 2 }, pos) },
          photo(srcs[i], i, { width: "100%", height: "100%" }),
          h("span", { style: { position: "absolute", left: 5, bottom: 3, fontFamily: "monospace", fontSize: 6, color: "#746757" } }, "0" + (i + 1)));
        }),
        ["14%", "76%", "50%"].map(function (left, i) { return h("span", { key: i, style: { position: "absolute", left: left, top: i === 2 ? "68%" : "45%", width: 9, height: 9, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", background: i === 1 ? "#b85d54" : "#496f6b", boxShadow: "0 2px 4px rgba(0,0,0,.18)", zIndex: 5 } }); }));
    } else if (frame === "drawer4") {
      body = h("div", { style: { width: "100%", height: "100%", minHeight: 145, position: "relative", overflow: "hidden", padding: "21px 8px 8px", background: dark ? "#24201b" : "#cdbb9c", border: "4px solid " + (dark ? "#4a3b2c" : "#927657"), boxShadow: "inset 0 0 0 2px rgba(255,255,255,.14)" } },
        h("div", { style: { position: "absolute", left: 9, top: 5, fontFamily: "Georgia,serif", fontSize: 8, letterSpacing: ".16em", color: dark ? "#dac39d" : "#5f4934" } }, "CABINET OF MOMENTS"),
        h("div", { style: { width: "100%", height: "100%", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gridTemplateRows: "repeat(2,minmax(0,1fr))", gap: 6 } },
          srcs.map(function (src, i) { return h("div", { key: i, style: { position: "relative", minWidth: 0, minHeight: 0, padding: 4, background: dark ? "#332b23" : "#e8dcc5", border: "1px solid " + (dark ? "#65513d" : "#9f8568"), boxShadow: "inset 0 2px 7px rgba(35,25,17,.18)" } },
            photo(src, i, { width: "100%", height: "100%", border: "1px solid rgba(67,48,31,.22)" }),
            h("span", { style: { position: "absolute", right: 3, bottom: 2, minWidth: 13, padding: "1px 2px", background: "rgba(247,238,217,.83)", color: "#604b38", fontFamily: "monospace", fontSize: 6, textAlign: "center" } }, String(i + 1).padStart(2, "0")));
          })));
    } else if (frame === "timeline5") {
      var timelinePos = [
        { left: "5%", top: "8%", width: "34%", height: "34%", transform: "rotate(-5deg)" },
        { left: "38%", top: "5%", width: "28%", height: "31%", transform: "rotate(3deg)" },
        { right: "4%", top: "13%", width: "30%", height: "34%", transform: "rotate(6deg)" },
        { left: "11%", bottom: "6%", width: "36%", height: "39%", transform: "rotate(3deg)" },
        { right: "12%", bottom: "5%", width: "39%", height: "42%", transform: "rotate(-4deg)" }
      ];
      body = h("div", { style: { width: "100%", height: "100%", minHeight: 145, position: "relative", overflow: "hidden", background: dark ? "#17191a" : "#ece7dc" } },
        h("div", { style: { position: "absolute", left: "12%", right: "11%", top: "50%", height: 2, background: dark ? "rgba(223,192,135,.48)" : "rgba(103,84,57,.36)", transform: "rotate(4deg)" } }),
        h("div", { style: { position: "absolute", left: "48%", top: "27%", bottom: "25%", width: 2, background: dark ? "rgba(223,192,135,.48)" : "rgba(103,84,57,.36)", transform: "rotate(-18deg)" } }),
        timelinePos.map(function (pos, i) { return h("div", { key: i, style: Object.assign({ position: "absolute", padding: 3, paddingBottom: 9, background: "#fffdf7", boxShadow: "0 4px 10px rgba(35,29,24,.19)", zIndex: 2 + i }, pos) },
          photo(srcs[i], i, { width: "100%", height: "100%" }),
          h("span", { style: { position: "absolute", left: 4, bottom: 2, fontFamily: "monospace", fontSize: 5.5, color: "#786d61" } }, String(i + 1).padStart(2, "0")));
        }),
        h("span", { style: { position: "absolute", left: "48%", top: "45%", width: 12, height: 12, borderRadius: 999, background: "#b45d53", border: "3px solid " + (dark ? "#2a2520" : "#eee7da"), zIndex: 9 } }));
    } else {
      body = h("div", { style: { width: "100%", height: "100%", minHeight: 72, position: "relative", overflow: "hidden", borderRadius: preset === "editorial" ? 0 : 7, background: dark ? "#0d0d0c" : t.bg2 } }, photo(srcs[0], 0, { width: "100%", height: "100%" }));
    }
    return h("div", { style: { width: "100%", height: "100%", position: "relative", minWidth: 0, overflow: "hidden" } }, body,
      caption && frame !== "magazine3" ? h("div", { style: { position: "absolute", left: 8, right: 8, bottom: 7, color: "#fff", fontFamily: F_DISPLAY, fontSize: 12, textShadow: "0 1px 6px rgba(0,0,0,.75)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", zIndex: 4 } }, caption) : null);
  }
  var meta = homeDecorMeta(item.type);
  var title = item.text || meta.text;
  var detail = item.detail || meta.detail;
  if (item.type === "ticket") {
    return h("div", { style: { width: "100%", height: "100%", minHeight: 68, display: "flex", alignItems: "stretch", color: ink, overflow: "hidden", position: "relative" } },
      h("div", { style: { flex: 1, minWidth: 0, padding: "8px 12px 8px 10px", border: "1px solid " + (dark ? "rgba(255,255,255,.28)" : "rgba(89,68,46,.28)"), borderRight: "1px dashed " + (dark ? "rgba(255,255,255,.38)" : "rgba(89,68,46,.42)"), background: dark ? "rgba(255,255,255,.035)" : "rgba(199,156,91,.10)", clipPath: "polygon(0 0,100% 0,100% 42%,96% 50%,100% 58%,100% 100%,0 100%)" } },
        h("div", { style: { fontFamily: "monospace", fontSize: 7, letterSpacing: ".18em", color: sub } }, "ADMIT ONE · " + String(new Date(item.createdAt || Date.now()).getFullYear())),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, lineHeight: 1.22, marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, title),
        h("div", { style: { fontFamily: F_BODY, fontSize: 9, color: sub, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, detail)),
      h("div", { style: { width: "25%", minWidth: 47, padding: "7px 5px", border: "1px solid " + (dark ? "rgba(255,255,255,.28)" : "rgba(89,68,46,.28)"), borderLeft: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", background: dark ? "rgba(255,255,255,.06)" : "rgba(184,119,66,.13)" } },
        h("span", { style: { fontFamily: "monospace", fontSize: 6.5, color: sub, writingMode: "vertical-rl", letterSpacing: ".12em" } }, "NO. " + String((item.createdAt || 1) % 10000).padStart(4, "0")),
        h("span", { style: { width: "80%", height: 12, background: "repeating-linear-gradient(90deg," + ink + " 0 1px,transparent 1px 3px," + ink + " 3px 5px,transparent 5px 7px)", opacity: .6 } })));
  }
  if (item.type === "letter") {
    return h("div", { style: { width: "100%", height: "100%", minHeight: 130, position: "relative", color: ink, overflow: "hidden" } },
      h("div", { style: { position: "absolute", left: "12%", right: "12%", top: "5%", height: "60%", padding: "11px 10px", background: dark ? "#eee5d7" : "#fffaf0", color: "#4f4437", border: "1px solid rgba(87,65,42,.18)", transform: "rotate(-2deg)", boxShadow: "0 5px 13px rgba(45,33,23,.16)" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, title),
        h("div", { style: { fontFamily: F_BODY, fontSize: 8.5, lineHeight: 1.45, color: "#877868", marginTop: 5 } }, detail)),
      h("div", { style: { position: "absolute", left: "3%", right: "3%", bottom: "4%", height: "57%", background: dark ? "#38322b" : "#dbc9ab", border: "1px solid " + (dark ? "#554b40" : "#b9a17c"), clipPath: "polygon(0 0,50% 55%,100% 0,100% 100%,0 100%)", zIndex: 2 } }),
      h("div", { style: { position: "absolute", left: "3%", right: "3%", bottom: "4%", height: "55%", background: dark ? "#41392f" : "#ead9bb", clipPath: "polygon(0 100%,0 28%,50% 72%,100% 28%,100% 100%)", zIndex: 3 } }),
      h("div", { style: { position: "absolute", left: "50%", bottom: "17%", width: 28, height: 28, transform: "translateX(-50%)", borderRadius: 999, background: "#a64d45", color: "rgba(255,238,216,.78)", boxShadow: "inset 0 0 0 3px rgba(91,35,31,.20)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4, fontFamily: "Georgia,serif", fontSize: 12 } }, "L"));
  }
  if (item.type === "note") {
    return h("div", { style: { width: "100%", height: "100%", minHeight: 126, position: "relative", overflow: "hidden", color: dark ? "#302b24" : "#4c4437" } },
      h("div", { style: { position: "absolute", inset: "3% 4% 5% 3%", padding: "18px 14px 12px", background: dark ? "#d8c88a" : "#f3e3a2", transform: "rotate(-1.5deg)", boxShadow: "0 8px 18px rgba(48,39,24,.18)", clipPath: "polygon(0 0,100% 0,100% 82%,87% 100%,0 100%)" } },
        h("span", { style: { position: "absolute", width: 44, height: 11, left: "50%", top: 4, transform: "translateX(-50%) rotate(2deg)", background: "rgba(255,255,255,.48)" } }),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, lineHeight: 1.25 } }, title),
        h("div", { style: { display: "flex", alignItems: "flex-start", gap: 6, marginTop: 11, color: "#746650", fontFamily: F_BODY, fontSize: 9.5, lineHeight: 1.4 } }, h("span", { style: { width: 10, height: 10, border: "1px solid #8a795f", flexShrink: 0, marginTop: 1 } }), h("span", null, detail)),
        h("div", { style: { position: "absolute", right: 0, bottom: 0, width: "13%", height: "18%", background: "linear-gradient(135deg,#d3bd70 0 49%,rgba(255,255,255,.45) 51% 100%)" } })));
  }
  if (item.type === "cassette") {
    return h("div", { style: { width: "100%", height: "100%", minHeight: 72, display: "flex", alignItems: "center", gap: 11, color: ink, overflow: "hidden" } },
      h("div", { style: { width: "44%", maxWidth: 138, height: 60, flexShrink: 0, position: "relative", borderRadius: 7, background: dark ? "#2e2c29" : "#e6ded0", border: "2px solid " + (dark ? "#8b8173" : "#74695c"), boxShadow: "inset 0 0 0 2px " + (dark ? "#151412" : "#f8f2e8") } },
        h("div", { style: { position: "absolute", left: 10, right: 10, top: 8, height: 28, borderRadius: 4, background: dark ? "#ddd2c0" : "#f8f2e7", border: "1px solid #9e9080", display: "flex", alignItems: "center", justifyContent: "space-around" } },
          [0, 1].map(function (i) { return h("span", { key: i, style: { width: 19, height: 19, borderRadius: 999, border: "4px dotted #72675b", background: "#d7cbb9" } }); }),
          h("span", { style: { position: "absolute", left: "36%", right: "36%", height: 2, background: "#8c7e6e" } })),
        h("div", { style: { position: "absolute", left: "23%", right: "23%", bottom: 4, height: 13, clipPath: "polygon(11% 0,89% 0,100% 100%,0 100%)", border: "1px solid #897b6d", background: dark ? "#171614" : "#c9bcaa" } })),
      h("div", { style: { minWidth: 0, flex: 1 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, title),
        h("div", { style: { height: 14, display: "flex", alignItems: "center", gap: 2, marginTop: 6 } }, [5, 10, 7, 13, 8, 4, 11, 6, 9, 5].map(function (n, i) { return h("span", { key: i, style: { width: 2, height: n, borderRadius: 2, background: accent, opacity: .75 } }); })),
        h("div", { style: { fontFamily: "monospace", fontSize: 8, color: sub, marginTop: 2 } }, detail)));
  }
  if (item.type === "trinket") {
    return h("div", { style: { width: "100%", height: "100%", minHeight: 132, position: "relative", overflow: "hidden", color: ink, border: "1px solid " + (dark ? "rgba(255,255,255,.25)" : "rgba(85,70,52,.28)"), background: dark ? "linear-gradient(150deg,#262522,#111)" : "linear-gradient(150deg,rgba(255,255,255,.46),rgba(214,201,181,.38))", boxShadow: "inset 0 0 20px rgba(255,255,255,.20)" } },
      h("div", { style: { position: "absolute", left: "18%", right: "18%", top: "12%", height: "45%", borderRadius: "50% 50% 48% 48%", border: "1px solid " + (dark ? "#d7b872" : "#9d7744"), background: "radial-gradient(circle at 50% 38%,rgba(255,255,255,.55),transparent 36%),linear-gradient(150deg,transparent 35%," + (dark ? "#b79858" : "#bc8849") + " 36% 42%,transparent 43%)", boxShadow: "0 11px 18px rgba(40,30,20,.15)" } },
        h("span", { style: { position: "absolute", left: "50%", top: "34%", width: 20, height: 20, transform: "translate(-50%,-50%) rotate(45deg)", border: "2px solid " + (dark ? "#e6ca85" : "#a77b42"), background: dark ? "#31302c" : "#f5ead8" } })),
      h("div", { style: { position: "absolute", left: "9%", right: "9%", top: "59%", height: 1, background: dark ? "rgba(255,255,255,.18)" : "rgba(75,61,45,.2)" } }),
      h("div", { style: { position: "absolute", left: 10, right: 10, bottom: 9, textAlign: "center" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, title),
        h("div", { style: { fontFamily: F_BODY, fontSize: 7.5, color: sub, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, detail)));
  }
  if (item.type === "date") {
    var d = now instanceof Date ? now : new Date();
    return h("div", { style: { width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 10, color: ink } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 36, lineHeight: .9, letterSpacing: "-.04em" } }, String(d.getDate()).padStart(2, "0")),
      h("div", { style: { minWidth: 0, borderLeft: "1px solid " + (dark ? "rgba(255,255,255,.24)" : t.line), paddingLeft: 10 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 9, letterSpacing: ".18em", color: sub } }, d.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, item.text || d.toLocaleDateString("zh-CN", { weekday: "long" }))));
  }
  return h("div", { style: { width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 10, color: ink, minWidth: 0 } },
    h("div", { style: { fontFamily: "Georgia,serif", fontSize: 35, lineHeight: .7, color: accent, alignSelf: "flex-start", paddingTop: 7 } }, "“"),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, lineHeight: 1.45, minWidth: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, item.text || "把喜欢的日子，慢慢摆在桌面上。"));
}
function HomePresetGrid({ value, onChange, allowNative }) {
  const t = useTheme();
  return h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 } },
    HOME_WIDGET_PRESETS.filter(function (p) { return allowNative || p.id !== "native"; }).map(function (p) {
      var active = value === p.id;
      return h("button", { key: p.id, onClick: function () { onChange(p.id); }, className: "active:opacity-70", style: { textAlign: "left", borderRadius: 16, padding: 10, background: active ? t.ink : t.bg, color: active ? t.bg2 : t.ink, border: "1px solid " + (active ? t.ink : t.line) } },
        h("div", { style: { height: 34, borderRadius: p.id === "editorial" ? 2 : p.id === "polaroid" ? 5 : 11, background: p.chip, border: p.id === "editorial" ? "1px solid #24211d" : "1px solid rgba(50,45,39,.10)", marginBottom: 8, boxShadow: p.id === "polaroid" ? "0 4px 9px rgba(0,0,0,.12)" : "none" } }),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14 } }, p.name),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: active ? "rgba(255,255,255,.62)" : t.fog, marginTop: 2 } }, p.note));
    }));
}
function HomeSizeGrid({ value, onChange }) {
  const t = useTheme();
  return h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 } },
    HOME_SIZE_PRESETS.map(function (p) {
      var active = (value || "auto") === p.id;
      return h("button", { key: p.id, onClick: function () { onChange(p.id); }, className: "active:opacity-70", style: { minHeight: 76, borderRadius: 15, padding: "9px 6px", background: active ? t.ink : t.bg, color: active ? t.bg2 : t.ink, border: "1px solid " + (active ? t.ink : t.line), textAlign: "center" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 23, lineHeight: 1 } }, p.glyph),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, marginTop: 7 } }, p.name),
        h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: active ? "rgba(255,255,255,.6)" : t.fog, marginTop: 2 } }, p.note));
    }));
}
function HomePhotoFrameGrid({ value, onChange }) {
  const t = useTheme();
  return h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 } },
    HOME_PHOTO_FRAMES.map(function (p) {
      var active = (value || "single") === p.id;
      return h("button", { key: p.id, onClick: function () { onChange(p.id); }, className: "active:opacity-70", style: { minHeight: 82, borderRadius: 15, padding: "10px 5px", background: active ? t.ink : t.bg, color: active ? t.bg2 : t.ink, border: "1px solid " + (active ? t.ink : t.line) } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12.5 } }, p.name),
        h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, lineHeight: 1.35, color: active ? "rgba(255,255,255,.62)" : t.fog, marginTop: 5 } }, p.note));
    }));
}
function HomePhotoSlotEditor({ value, frame, busy, onPick, onClear }) {
  const t = useTheme();
  var photos = normalizeHomePhotoSlots(value, frame);
  return h("div", { style: { display: "grid", gridTemplateColumns: "repeat(" + Math.min(3, photos.length) + ",minmax(0,1fr))", gap: 8, marginTop: 10 } },
    photos.map(function (ref, i) {
      var src = ref && typeof resolveImg === "function" ? resolveImg(ref) : ref;
      return h("div", { key: i, style: { position: "relative", minWidth: 0 } },
        h("label", { className: "active:opacity-70", style: { minHeight: photos.length === 1 ? 92 : 78, borderRadius: 15, border: "1px dashed " + t.line, background: t.bg, overflow: "hidden", color: t.sub, display: "flex", alignItems: "center", justifyContent: "center", cursor: busy ? "default" : "pointer", position: "relative" } },
          src ? h("img", { src: src, alt: "相框第 " + (i + 1) + " 张照片", style: { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", objectFit: "cover" } }) :
            h("div", { style: { fontFamily: F_BODY, fontSize: photos.length === 1 ? 13 : 11.5, textAlign: "center", lineHeight: 1.45, padding: 6 } }, busy ? "正在放入…" : "＋ 第 " + (i + 1) + " 张"),
          h("input", { type: "file", accept: "image/*", className: "hidden", disabled: busy, onChange: function (e) { var file = e.target.files && e.target.files[0]; if (file) onPick(file, i); e.target.value = ""; } })),
        ref ? h("button", { type: "button", onClick: function (e) { e.preventDefault(); e.stopPropagation(); onClear(i); }, className: "active:opacity-65", "aria-label": "清空第 " + (i + 1) + " 张照片", style: { position: "absolute", right: 5, top: 5, zIndex: 2, width: 23, height: 23, borderRadius: 999, background: "rgba(20,19,17,.72)", color: "#fff", fontFamily: F_BODY, fontSize: 15, lineHeight: "23px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,.2)" } }, "×") : null);
    }));
}
function HomeDecorAppearanceEditor({ surface, borderMode, accent, align, badge, tilt, onSurface, onBorderMode, onAccent, onAlign, onBadge, onTilt }) {
  const t = useTheme();
  function choiceRow(items, value, onChange) {
    return h("div", { style: { display: "grid", gridTemplateColumns: "repeat(" + items.length + ",minmax(0,1fr))", gap: 7 } }, items.map(function (x) {
      var active = value === x.id;
      return h("button", { key: x.id, type: "button", onClick: function () { onChange(x.id); }, className: "active:opacity-70", style: { minWidth: 0, borderRadius: 12, padding: "9px 4px", background: active ? t.ink : t.bg, color: active ? t.bg2 : t.ink, border: "1px solid " + (active ? t.ink : t.line), fontFamily: F_BODY, fontSize: 10.5, whiteSpace: "nowrap" } }, x.name);
    }));
  }
  return h("div", { style: { marginTop: 17, padding: 13, borderRadius: 17, background: t.bg, border: "1px solid " + t.line } },
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: ".14em", color: t.fog, marginBottom: 9 } }, "材质与底色"),
    choiceRow(HOME_DECOR_SURFACES, surface || "paper", onSurface),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: ".14em", color: t.fog, marginTop: 15, marginBottom: 9 } }, "边线（可完全透明）"),
    choiceRow(HOME_DECOR_BORDERS, borderMode || "line", onBorderMode),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: ".14em", color: t.fog, marginTop: 15, marginBottom: 9 } }, "强调色"),
    h("div", { style: { display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" } },
      HOME_DECOR_ACCENTS.map(function (c) { var active = (accent || HOME_DECOR_ACCENTS[0]).toLowerCase() === c.toLowerCase(); return h("button", { key: c, type: "button", onClick: function () { onAccent(c); }, "aria-label": "使用颜色 " + c, style: { width: 29, height: 29, borderRadius: 999, background: c, border: active ? "3px solid " + t.ink : "2px solid " + t.bg2, boxShadow: active ? "0 0 0 2px " + t.bg2 + ",0 0 0 3px " + t.ink : "0 0 0 1px " + t.line } }); }),
      h("label", { style: { width: 32, height: 32, borderRadius: 999, overflow: "hidden", border: "1px solid " + t.line, position: "relative", background: accent || HOME_DECOR_ACCENTS[0] } },
        h("input", { type: "color", value: accent || HOME_DECOR_ACCENTS[0], onChange: function (e) { onAccent(e.target.value); }, "aria-label": "自定义强调色", style: { position: "absolute", inset: -8, width: 48, height: 48, opacity: .01, cursor: "pointer" } }),
        h("span", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15, textShadow: "0 1px 3px rgba(0,0,0,.5)", pointerEvents: "none" } }, "+"))),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 9, marginTop: 15 } },
      h("div", null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 7 } }, "文字对齐"),
        choiceRow([{ id: "left", name: "居左" }, { id: "center", name: "居中" }], align || "left", onAlign)),
      h("label", { style: { minWidth: 0 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 7 } }, "角标（可留空）"),
        h("input", { value: badge || "", onChange: function (e) { onBadge(e.target.value); }, maxLength: 12, placeholder: "NEW / 私藏 / 01", style: { width: "100%", height: 38, outline: "none", borderRadius: 11, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: 11.5, padding: "0 9px" } }))),
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16, marginBottom: 8 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: ".14em", color: t.fog } }, "摆放角度"),
      h("div", { style: { minWidth: 42, textAlign: "right", fontFamily: "monospace", fontSize: 11.5, color: t.ink } }, (normalizeHomeDecorTilt(tilt) > 0 ? "+" : "") + normalizeHomeDecorTilt(tilt) + "°")),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 6 } },
      HOME_DECOR_TILTS.map(function (x) {
        var active = normalizeHomeDecorTilt(tilt) === x.value;
        return h("button", { key: x.value, type: "button", onClick: function () { onTilt(x.value); }, className: "active:opacity-70", style: { minWidth: 0, borderRadius: 11, padding: "8px 2px", background: active ? t.ink : t.bg2, color: active ? t.bg2 : t.ink, border: "1px solid " + (active ? t.ink : t.line), fontFamily: F_BODY, fontSize: 9.5, whiteSpace: "nowrap" } }, x.name);
      })),
    h("input", { type: "range", min: -12, max: 12, step: 1, value: normalizeHomeDecorTilt(tilt), onChange: function (e) { onTilt(normalizeHomeDecorTilt(e.target.value)); }, "aria-label": "微调装饰倾斜角度", style: { width: "100%", marginTop: 10, accentColor: accent || HOME_DECOR_ACCENTS[0] } }),
    h("div", { style: { display: "flex", justifyContent: "space-between", fontFamily: F_BODY, fontSize: 9.5, color: t.fog, marginTop: 2 } }, h("span", null, "左斜 12°"), h("span", null, "右斜 12°")));
}
function Home({
  now,
  characters,
  profile,
  wallpaper,
  unread,
  calendar,
  period,
  listen,
  player,
  homeCard,
  notif,
  memoDue,
  mapStatus,
  userGeo,
  couples,
  coupleSweet,
  onOpenApp,
  onOpenChar,
  onEditProfile,
  onEditCard,
  onWheelReact,
  onSoon
}) {
  const t = useTheme();
  // 记住上次所在页（从别的 app 返回后回到原页）
  const [page, setPage] = useState(function () { const v = parseInt(localStorage.getItem("x_homePage") || "0", 10); return isNaN(v) ? 0 : v; });
  const [drag, setDrag] = useState(0); // 跟手拖动位移(px)
  const [openFolder, setOpenFolder] = useState(null); // 展开的文件夹
  const dragRef = useRef(null);
  const tx = useRef(null);
  // 长按拖拽自定义 app 图标位置（同页内重排，存 x_homeLayout={pageIndex:[key...]}）
  const [editMode, setEditMode] = useState(false);
  const [dragKey, setDragKey] = useState(null);
  const [layout, setLayout] = useState(function () { return loadJSON("x_homeLayout", {}); });
  // 自由添加的装饰内容与外观分开保存：换皮不碰照片/文字，移动也不碰样式。
  const [decorations, setDecorations] = useState(function () { var v = loadJSON("x_homeDecorations", []); return Array.isArray(v) ? v : []; });
  const decorationsRef = useRef(decorations); decorationsRef.current = decorations;
  const [widgetStyles, setWidgetStyles] = useState(function () { var v = loadJSON("x_homeWidgetStyles", {}); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; });
  const [widgetSizes, setWidgetSizes] = useState(function () { var v = loadJSON("x_homeWidgetSizes", {}); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; });
  const [styleKey, setStyleKey] = useState(null);
  const [showDecorLibrary, setShowDecorLibrary] = useState(false);
  const [decorDraftType, setDecorDraftType] = useState("photo");
  const [decorDraftPreset, setDecorDraftPreset] = useState("soft");
  const [decorDraftText, setDecorDraftText] = useState("");
  const [decorDraftDetail, setDecorDraftDetail] = useState("");
  const [decorDraftFrame, setDecorDraftFrame] = useState("single");
  const [decorDraftPhotos, setDecorDraftPhotos] = useState([]);
  const [decorDraftSurface, setDecorDraftSurface] = useState("paper");
  const [decorDraftBorderMode, setDecorDraftBorderMode] = useState("line");
  const [decorDraftAccent, setDecorDraftAccent] = useState(HOME_DECOR_ACCENTS[0]);
  const [decorDraftAlign, setDecorDraftAlign] = useState("left");
  const [decorDraftBadge, setDecorDraftBadge] = useState("");
  const [decorDraftTilt, setDecorDraftTilt] = useState(0);
  const [styleDecorText, setStyleDecorText] = useState("");
  const [styleDecorDetail, setStyleDecorDetail] = useState("");
  const [styleDecorFrame, setStyleDecorFrame] = useState("single");
  const [styleDecorPhotos, setStyleDecorPhotos] = useState([]);
  const [styleDecorSurface, setStyleDecorSurface] = useState("paper");
  const [styleDecorBorderMode, setStyleDecorBorderMode] = useState("line");
  const [styleDecorAccent, setStyleDecorAccent] = useState(HOME_DECOR_ACCENTS[0]);
  const [styleDecorAlign, setStyleDecorAlign] = useState("left");
  const [styleDecorBadge, setStyleDecorBadge] = useState("");
  const [styleDecorTilt, setStyleDecorTilt] = useState(0);
  const [decorBusy, setDecorBusy] = useState(false);
  // 用户自建文件夹：x_homeFolders = { "f_<ts>": { name, keys:[appKey...] } }；fid 直接躺在 layout 数组里当一个可摆放项
  const [folders, setFolders] = useState(function () { return loadJSON("x_homeFolders", {}); });
  const foldersRef = useRef(folders); foldersRef.current = folders;
  const [hoverKey, setHoverKey] = useState(null); // 拖拽悬停的合并目标（放大提示）
  const hoverRef = useRef({ key: null, timer: null });
  const [dropKey, setDropKey] = useState(null); // 松手将落到的目标（空格/交换对象，虚线高亮）
  const dropRef = useRef(null);
  const ghostRef = useRef(null); // 跟手浮影（直接改 DOM 位置，不走 setState 防卡）
  const lpRef = useRef(null);       // 长按计时器
  const dragKeyRef = useRef(null);  // 当前拖起的 key（事件闭包里读，避免过期）
  dragKeyRef.current = dragKey;
  useEffect(function () {
    if (document.getElementById("wk-jiggle-style")) return;
    var st = document.createElement("style"); st.id = "wk-jiggle-style";
    st.textContent = "@keyframes wk-jiggle{0%{transform:rotate(-1.5deg)}50%{transform:rotate(1.5deg)}100%{transform:rotate(-1.5deg)}}";
    document.head.appendChild(st);
  }, []);
  const flipRef = useRef(0); // 跨页拖拽翻页节流时间戳
  const goPage = function (np) { setPage(np); try { localStorage.setItem("x_homePage", String(np)); } catch (e) {} };
  // 注册表：所有可摆放的项（组件 w_ / app 图标 / 文件夹），供布局按 key 查
  // ⚠️日记和备忘录【不进 REG】：日记的正门在底部 dock 上，备忘录有 w_memo 组件，
  // 主屏再放一个图标是重复入口（她 2026-08-30 让删的）。不在 REG 里 = valid() 会把存档里
  // 残留的这两个滤掉，安全网也不会再把它们补回主屏——v47.73 只清了一次，安全网又给补回来了。
  const REG = {
    w_card: { kind: "widget", which: "card" },
    w_cal: { kind: "widget", which: "cal" },
    w_music: { kind: "widget", which: "music" },
    w_map: { kind: "widget", which: "map" },
    w_us: { kind: "widget", which: "us" },
    w_memo: { kind: "widget", which: "memo" },
    w_weather: { kind: "widget", which: "weather" },
    w_muyu: { kind: "widget", which: "muyu" },
    w_ledger: { kind: "widget", which: "ledger" },
    w_wheel: { kind: "widget", which: "wheel" },
    cast: { kind: "app", zh: "人格档案馆", G: GCast },
    ties: { kind: "app", zh: "关系", G: GTies },
    phone: { kind: "app", zh: "查手机", G: GPhone },
    shop: { kind: "app", zh: "购物", G: GShop },
    carry: { kind: "app", zh: "随身物", G: GCarry },
    dwell: { kind: "app", zh: "去处", G: GDwell },
    cwallet: { kind: "app", zh: "钱包", G: GWallet },
    lore: { kind: "app", zh: "世界书", G: GLore },
    memlib: { kind: "app", zh: "记忆库", G: GMem },
    anon: { kind: "app", zh: "匿名问答", G: GForum },

    // 记账 app 图标退场：已有 w_ledger 记账组件，点组件即可进记账（onOpenApp("ledger")）。从 REG 删掉后，
    // 存档里残留的 "ledger" key 会被 valid() 判无效丢弃、安全网也不会回填。ledger 路由本身还在，不影响功能。

    study: { kind: "app", zh: "一起学", G: GStudy },
    fanfic: { kind: "app", zh: "同人文", G: GFanfic },
    weekly: { kind: "app", zh: "周刊", G: GWeekly },
    read: { kind: "app", zh: "一起读", G: IShelf },
    debate: { kind: "app", zh: "擂台", G: GDebate },
    dream: { kind: "app", zh: "梦境", G: GDream },
    tarot: { kind: "app", zh: "塔罗", G: GTarot },
    pomodoro: { kind: "app", zh: "番茄钟", G: GFocus },
    games: { kind: "app", zh: "小游戏", G: GGame },
    dreamjournal: { kind: "app", zh: "解梦馆", G: window.GDreamBook || GDream },
    yanqiu: { kind: "app", zh: "秋声", G: window.GYanqiuLeaf || GDiary },
    rescue: { kind: "app", zh: "互救台", G: GRescue },
    vpscodex: { kind: "app", zh: "值班室", G: GDuty },
    loungeapp: { kind: "app", zh: "三席会客", G: GLounge },
    theater: { kind: "app", zh: "小剧场", G: window.GTheater || GDream },
    trpg: { kind: "app", zh: "跑团", G: window.GTrpg || GGame },
    impression: { kind: "app", zh: "月度印象", G: window.GImpression || GDream },
    assistant: { kind: "app", zh: "帮手", G: window.GAssist || GDuty },
    stylelab: { kind: "app", zh: "文风台", G: window.GStyleLab || GDuty }
  };
  // 装饰也是主屏注册项，但不进入安全网：用户删掉后不会被系统当成“丢失组件”补回来。
  decorations.forEach(function (d) { if (d && d.id) REG[d.id] = { kind: "decor", which: d.type, decor: d }; });
  // 默认布局：哪个 key 在哪页、什么顺序（组件也在里面，可跨页拖）
  // v47.73：memo/diary 图标退场（备忘录有 w_memo 组件、日记进 dock 顶了情侣的位）；天气组件搬第四页
  const DEFAULT_LAYOUT = [
    ["w_card", "cast", "ties", "phone", "w_music", "w_map"],
    ["w_cal", "shop", "carry", "cwallet", "w_ledger", "w_us", "w_memo"],
    ["lore", "memlib", "anon", "study", "fanfic", "theater", "impression", "weekly", "read", "debate", "dream", "tarot", "pomodoro", "games", "trpg", "dreamjournal", "yanqiu", "loungeapp", "rescue", "vpscodex", "assistant", "stylelab"],
    ["w_muyu", "w_weather", "w_wheel"]
  ];
  // 空格（sp_ 开头）：真实占一格的「洞」，自由摆放的基础——拖到空格＝挪过去，原位留洞
  const SP_RE = /^sp_/;
  // 每项占几列几行（4 列制）——必须和 renderItem 里写的 gridColumn/gridRow 一模一样
  const spanOf = function (key) {
    if (SP_RE.test(key)) return [1, 1];
    var it = key && key.slice(0, 2) === "f_" ? { kind: "folder" } : REG[key];
    if (!it) return null;
    if (it.kind !== "widget" && it.kind !== "decor") return [1, 1];
    return homeItemSpan(key, it, widgetSizes);
  };
  // 每项占的格子数（4 列制）：app/文件夹/空格=1，日历 3x3=9，地图 2x2=4，整行组件=4
  const wOf = function (key) { var s = spanOf(key); return s ? s[0] * s[1] : 0; };
  // 照着 CSS 的 grid-auto-flow:dense 排一遍，算这一页真占几【行】。
  // 屏幕限的是行、不是格：24 格只有严丝合缝时才等于 6 行。2×2 的组件会留下填不满的洞，
  // 同样 24 格能排成 7 行——多出来那一行落在 overflow-hidden 的下面，看不见也点不到，跟丢了一样。
  function placeDense(keys) {
    var grid = [], rows = 0, at = [];
    var free = function (r, c, w, hh) {
      for (var i = r; i < r + hh; i++) { var row = grid[i]; if (row) for (var j = c; j < c + w; j++) if (row[j]) return false; }
      return true;
    };
    (keys || []).forEach(function (k, idx) {
      var s = spanOf(k); if (!s) { at[idx] = -1; return; }
      var w = s[0], hh = s[1];
      for (var r = 0; ; r++) {
        for (var c = 0; c + w <= 4; c++) {
          if (!free(r, c, w, hh)) continue;
          for (var i = r; i < r + hh; i++) { if (!grid[i]) grid[i] = []; for (var j = c; j < c + w; j++) grid[i][j] = 1; }
          at[idx] = r + hh - 1;
          if (r + hh > rows) rows = r + hh;
          return;
        }
      }
    });
    return { rows: rows, at: at };
  }
  function rowsOf(keys) { return placeDense(keys).rows; }
  // 平时把尾巴上那几排纯空格去掉。空格是编辑态的落点，不编辑的时候它只是白占一整排（≈90px）——
  // 她 2026-08-30：「组件之间也没那么紧凑了，原来日历底部能完全显示在屏幕上现在不行了」，
  // 「每一页都还是可以滑动就算下面没东西」，说的都是这排看不见的空行把底下那排顶出了屏幕。
  // 只去掉【最后一个真东西那一排之后】的空格；跟真东西同排的空格留着，那是她自己摆的洞。
  function trimTailRows(keys) {
    var p = placeDense(keys), last = -1;
    (keys || []).forEach(function (k, i) { if (!SP_RE.test(k) && p.at[i] > last) last = p.at[i]; });
    return (keys || []).filter(function (k, i) { return !SP_RE.test(k) || p.at[i] <= last; });
  }
  // 存档 + 注册表 → 完整布局：套用存档顺序，未放置的新功能补到默认页，丢弃已删除的 key
  // 文件夹（f_ 开头）也是合法项；躺在文件夹里的 app 视作已放置，不再回填到页面
  // 最后做「槽位规整」：去尾部空格 → 补空格到整行；恰好铺满且没超载时多送一空行（留挪动余地）
  function buildLayout(saved) {
    saved = saved || {};
    var F = foldersRef.current || {};
    var seen = {};
    Object.keys(F).forEach(function (fid) { (F[fid].keys || []).forEach(function (k) { seen[k] = true; }); });
    var valid = function (key) {
      if (!key) return false;
      if (SP_RE.test(key)) return true;
      if (key.slice(0, 2) === "f_") return !!(F[key] && (F[key].keys || []).length);
      return !!REG[key];
    };
    var out;
    if (!Object.keys(saved).length) out = DEFAULT_LAYOUT.map(function (p) { return p.filter(function (k) { return !seen[k]; }); });
    else {
      var maxPage = DEFAULT_LAYOUT.length - 1;
      Object.keys(saved).forEach(function (k) { var n = parseInt(k, 10); if (!isNaN(n)) maxPage = Math.max(maxPage, n); });
      out = [];
      for (var i = 0; i <= maxPage; i++) {
        out[i] = (saved[i] || []).filter(function (key) { if (valid(key) && !seen[key]) { seen[key] = true; return true; } return false; });
      }
      DEFAULT_LAYOUT.forEach(function (p, dp) {
        p.forEach(function (key) { if (!seen[key]) { if (!out[dp]) out[dp] = []; out[dp].push(key); seen[key] = true; } });
      });
    }
    // ⭐安全网（防「排序时把 app 拖进文件夹、文件夹又从页面掉了」这类导致 app 凭空消失）：
    // 任何 REG 里的 app，只要既不在任何页、也不在【当前真的摆在某页上的】文件夹里，就强制补回它的默认页（不知道默认页就补末页）。
    // 保证任何 app 都不可能从主屏彻底消失、找不回来。
    (function () {
      var placedFolders = {};
      out.forEach(function (arr) { (arr || []).forEach(function (k) { if (k && k.slice(0, 2) === "f_" && F[k]) placedFolders[k] = 1; }); });
      var reach = {};
      out.forEach(function (arr) { (arr || []).forEach(function (k) { reach[k] = 1; }); });
      Object.keys(placedFolders).forEach(function (fid) { (F[fid].keys || []).forEach(function (k) { reach[k] = 1; }); });
      var defPage = {};
      DEFAULT_LAYOUT.forEach(function (p, dp) { p.forEach(function (k) { defPage[k] = dp; }); });
      // v57.86 安全网扩容：widget 也救（widget 没有任何「重新添加」的 UI，掉了就是永久失踪；
      // app/widget 一视同仁。故意退场的入口走「从 REG 删除」这条老路，见 v47.73 的 memo/diary）
      Object.keys(REG).forEach(function (key) {
        if (REG[key] && (REG[key].kind === "app" || REG[key].kind === "widget") && !reach[key]) {
          var dp = defPage[key] != null ? defPage[key] : (out.length - 1);
          if (!out[dp]) out[dp] = [];
          out[dp].push(key);
          reach[key] = 1;
        }
      });
    })();
    // 页容量界限：一页最多 24 格【并且】最多 6 行——两条都要卡，一页才不会无限长下去。
    // ⚠️这两条【保证不了】东西一定看得见：行高是按内容撑的，名片有没有 #标签、
    // 日历这个月是五周还是六周，都会让同样的「6 行」时高时矮。真正兜住看不见的是
    // 每一页自己能上下滑（见下面渲染那段）；这里只负责别让一页堆到离谱。
    // 超出容量的项按原顺序整体溢到下一页开头（连锁下去，最后一页放不下就自动开新页）；空格不搬、下一页会重新补
    var CAP = 24, ROWCAP = 6;
    for (var ci = 0; ci < out.length; ci++) {
      var cw = 0, ckeep = [], cspill = [];
      (out[ci] || []).forEach(function (k) {
        var wk = wOf(k);
        if (!cspill.length && cw + wk <= CAP && rowsOf(ckeep.concat([k])) <= ROWCAP) { ckeep.push(k); cw += wk; }
        else if (!SP_RE.test(k)) cspill.push(k);
      });
      out[ci] = ckeep;
      if (cspill.length) out[ci + 1] = cspill.concat(out[ci + 1] || []);
    }
    return out.map(function (arr, pi) {
      arr = (arr || []).slice();
      while (arr.length && SP_RE.test(arr[arr.length - 1])) arr.pop();
      var wsum = 0;
      arr.forEach(function (k) { wsum += wOf(k); });
      // v47.73 空格铺满整页（24 格）：平时隐形、编辑态整页虚线——右下角任何位置都能当落点，
      // 不再是「旁边有东西才有洞」（之前保底 2 格导致想放页面远端放不了）
      var target = CAP;
      var n = 0;
      var have = {};
      arr.forEach(function (k) { have[k] = 1; });
      // 补位是 1×1 的，只会去填 6 行以内的洞：真项已经卡在 24 格 / 6 行以内，
      // 剩下的洞正好是 24-wsum 个，补满不会多出第七行，所以这里不用再判一次行数
      while (wsum < target) { var sid = "sp_" + pi + "_" + n++; if (!have[sid]) { arr.push(sid); have[sid] = 1; wsum += 1; } }
      return arr;
    });
  }
  function persistLayout(L) { var o = {}; L.forEach(function (arr, i) { o[i] = arr; }); saveJSON("x_homeLayout", o); return o; }
  function persistFolders(nf) { foldersRef.current = nf; saveJSON("x_homeFolders", nf); setFolders(nf); }
  function persistDecorations(nd) { decorationsRef.current = nd; saveJSON("x_homeDecorations", nd); setDecorations(nd); }
  function setWidgetPreset(key, preset) {
    setWidgetStyles(function (prev) { var n = Object.assign({}, prev); n[key] = preset; saveJSON("x_homeWidgetStyles", n); return n; });
  }
  function setWidgetSize(key, size) {
    setWidgetSizes(function (prev) { var n = Object.assign({}, prev); n[key] = size; saveJSON("x_homeWidgetSizes", n); return n; });
  }
  function updateDecoration(id, patch) {
    persistDecorations((decorationsRef.current || []).map(function (d) { return d.id === id ? Object.assign({}, d, patch) : d; }));
  }
  function openStylePanel(key) {
    var it = REG[key];
    if (it && it.kind === "decor" && it.decor) {
      var d = it.decor;
      setStyleDecorText(d.caption || d.text || "");
      setStyleDecorDetail(d.detail || homeDecorMeta(it.which).detail || "");
      var frame = d.frame || "single";
      setStyleDecorFrame(frame);
      setStyleDecorPhotos(normalizeHomePhotoSlots(Array.isArray(d.imageRefs) && d.imageRefs.length ? d.imageRefs : (d.imageRef ? [d.imageRef] : []), frame));
      setStyleDecorSurface(d.surface || "paper");
      setStyleDecorBorderMode(d.borderMode || "line");
      setStyleDecorAccent(d.accent || HOME_DECOR_ACCENTS[0]);
      setStyleDecorAlign(d.align || "left");
      setStyleDecorBadge(d.badge || "");
      setStyleDecorTilt(normalizeHomeDecorTilt(d.tilt));
    }
    setStyleKey(key);
  }
  function resetDecorDraft() { setDecorDraftType("photo"); setDecorDraftPreset("soft"); setDecorDraftText(""); setDecorDraftDetail(""); setDecorDraftFrame("single"); setDecorDraftPhotos([]); setDecorDraftSurface("paper"); setDecorDraftBorderMode("line"); setDecorDraftAccent(HOME_DECOR_ACCENTS[0]); setDecorDraftAlign("left"); setDecorDraftBadge(""); setDecorDraftTilt(0); setDecorBusy(false); }
  async function takeDecorPhoto(file, target, slot) {
    if (!file) return;
    setDecorBusy(true);
    try {
      var data = typeof resizeImageFile === "function" ? await resizeImageFile(file, 1000, .84) : "";
      var ref = data && typeof imgToVault === "function" ? await imgToVault(data) : data;
      if (!ref) throw new Error("empty photo");
      var frame = target === "style" ? styleDecorFrame : decorDraftFrame;
      var setter = target === "style" ? setStyleDecorPhotos : setDecorDraftPhotos;
      setter(function (prev) { var next = normalizeHomePhotoSlots(prev, frame); next[slot] = ref; return next; });
    } catch (e) { if (typeof toast === "function") toast("这张照片没能放进相框"); }
    setDecorBusy(false);
  }
  function clearDecorPhoto(target, slot) {
    var frame = target === "style" ? styleDecorFrame : decorDraftFrame;
    var setter = target === "style" ? setStyleDecorPhotos : setDecorDraftPhotos;
    setter(function (prev) { var next = normalizeHomePhotoSlots(prev, frame); next[slot] = ""; return next; });
  }
  function addDecoration() {
    var id = "d_" + Date.now().toString(36) + Math.floor(Math.random() * 100).toString(36);
    var text = decorDraftText.trim();
    var meta = homeDecorMeta(decorDraftType);
    var item = { id: id, type: decorDraftType, text: decorDraftType === "photo" ? "" : (text || meta.text), detail: decorDraftType === "photo" ? "" : (decorDraftDetail.trim() || meta.detail || ""), caption: decorDraftType === "photo" ? text : "", imageRefs: decorDraftType === "photo" ? normalizeHomePhotoSlots(decorDraftPhotos, decorDraftFrame) : [], frame: decorDraftType === "photo" ? decorDraftFrame : "", surface: decorDraftSurface, borderMode: decorDraftBorderMode, accent: decorDraftAccent, align: decorDraftAlign, badge: decorDraftBadge.trim(), tilt: normalizeHomeDecorTilt(decorDraftTilt), createdAt: Date.now() };
    REG[id] = { kind: "decor", which: item.type, decor: item }; // 同一轮先让布局识得它，下一轮由 decorations 重建
    persistDecorations((decorationsRef.current || []).concat([item]));
    setWidgetStyles(function (prev) { var n = Object.assign({}, prev); n[id] = decorDraftPreset; saveJSON("x_homeWidgetStyles", n); return n; });
    if (decorDraftType === "photo" && decorDraftFrame !== "single") setWidgetSizes(function (prev) { var n = Object.assign({}, prev); n[id] = decorDraftFrame === "film3" ? "wide" : "large"; saveJSON("x_homeWidgetSizes", n); return n; });
    if (decorDraftType !== "photo" && decorDraftType !== "quote" && decorDraftType !== "date") setWidgetSizes(function (prev) { var n = Object.assign({}, prev); n[id] = (decorDraftType === "ticket" || decorDraftType === "cassette") ? "wide" : "square"; saveJSON("x_homeWidgetSizes", n); return n; });
    setLayout(function (prev) {
      var L = buildLayout(prev).map(function (a) { return trimTailRows(a).slice(); });
      var pi = Math.max(0, Math.min(page, L.length - 1));
      if (!L[pi]) L[pi] = [];
      L[pi].push(id);
      var saved = persistLayout(L);
      setTimeout(function () { try { var p2 = findSlot(buildLayout(saved), id); if (p2) goPage(p2.p); } catch (e) {} }, 0);
      return saved;
    });
    setShowDecorLibrary(false); resetDecorDraft();
    if (typeof toast === "function") toast("装饰已经放到桌面上");
  }
  function saveStyleDecoration() {
    var it = styleKey && REG[styleKey];
    if (!it || it.kind !== "decor" || !it.decor) return;
    if (it.which === "photo") {
      updateDecoration(styleKey, { caption: styleDecorText.trim(), imageRefs: normalizeHomePhotoSlots(styleDecorPhotos, styleDecorFrame), frame: styleDecorFrame, surface: styleDecorSurface, borderMode: styleDecorBorderMode, accent: styleDecorAccent, align: styleDecorAlign, badge: styleDecorBadge.trim(), tilt: normalizeHomeDecorTilt(styleDecorTilt) });
    } else {
      var meta = homeDecorMeta(it.which);
      updateDecoration(styleKey, { text: styleDecorText.trim() || meta.text, detail: homeDecorHasDetail(it.which) ? styleDecorDetail.trim() : "", surface: styleDecorSurface, borderMode: styleDecorBorderMode, accent: styleDecorAccent, align: styleDecorAlign, badge: styleDecorBadge.trim(), tilt: normalizeHomeDecorTilt(styleDecorTilt) });
    }
    if (typeof toast === "function") toast("桌面内容已经更新");
  }
  function removeDecoration(id) {
    persistDecorations((decorationsRef.current || []).filter(function (d) { return d.id !== id; }));
    setLayout(function (prev) {
      var L = [], mx = Math.max(0, curLayout.length - 1);
      for (var i = 0; i <= mx; i++) L[i] = (prev[i] || []).filter(function (k) { return k !== id; });
      return persistLayout(L);
    });
    setWidgetStyles(function (prev) { var n = Object.assign({}, prev); delete n[id]; saveJSON("x_homeWidgetStyles", n); return n; });
    setWidgetSizes(function (prev) { var n = Object.assign({}, prev); delete n[id]; saveJSON("x_homeWidgetSizes", n); return n; });
    setStyleKey(null);
    if (typeof toast === "function") toast("装饰已从桌面移走");
  }
  const kindOf = function (key) { if (key && key.slice(0, 2) === "f_") return "folder"; var it = REG[key]; return it ? it.kind : null; };
  // 在整个布局里找 key 的位置 {p,i}
  function findSlot(L, key) {
    for (var p = 0; p < L.length; p++) { var i = (L[p] || []).indexOf(key); if (i >= 0) return { p: p, i: i }; }
    return null;
  }
  // 放下：from 和 to 交换位置（to 是空格＝挪过去原位留洞；to 是别的项＝互换；跨页同理）
  function placeDrop(fromKey, toKey) {
    setLayout(function (prev) {
      var L = buildLayout(prev).map(function (a) { return a.slice(); });
      var f = findSlot(L, fromKey), t2 = findSlot(L, toKey);
      if (!f || !t2) return prev;
      // 空格换过去时给个全新 id：补位生成器的 id 是「页内确定性」的（sp_<页>_<n>），
      // 原 id 跨页迁移后原页会再生成同名补位 → 两个页出现重复 data-appkey，命中就乱了
      L[f.p][f.i] = SP_RE.test(toKey) ? "sp_x" + Date.now().toString(36) + Math.floor(Math.random() * 100) : toKey;
      L[t2.p][t2.i] = fromKey;
      return persistLayout(L);
    });
  }
  // 拖 A 叠到 B 上（B 是 app）→ 新建文件夹装下两个；B 的位置换成文件夹，A 的原位留洞
  function makeFolder(targetKey, draggedKey) {
    setLayout(function (prev) {
      var L = buildLayout(prev).map(function (a) { return a.slice(); }); // folders 还没动，两个 key 都还在布局里
      var tPos = findSlot(L, targetKey), dPos = findSlot(L, draggedKey);
      if (!tPos || !dPos) return prev;
      var fid = "f_" + Date.now();
      var nf = Object.assign({}, foldersRef.current);
      nf[fid] = { name: "文件夹", keys: [targetKey, draggedKey] };
      persistFolders(nf);
      L[tPos.p][tPos.i] = fid;
      L[dPos.p][dPos.i] = "sp_m" + Date.now().toString(36);
      return persistLayout(L);
    });
  }
  function addToFolder(fid, key) {
    setLayout(function (prev) {
      var L = buildLayout(prev).map(function (a) { return a.slice(); });
      var pos = findSlot(L, key);
      var nf = Object.assign({}, foldersRef.current);
      var f = nf[fid];
      if (!f || (f.keys || []).indexOf(key) >= 0) return prev;
      nf[fid] = { name: f.name, keys: (f.keys || []).concat([key]) };
      persistFolders(nf);
      if (pos) L[pos.p][pos.i] = "sp_a" + Date.now().toString(36); // 原位留洞
      return persistLayout(L);
    });
  }
  // 从文件夹取出：优先放进文件夹所在页的空格（文件夹后面最近的），没有就追加；空了自动解散（位置原地还给）
  function removeFromFolder(fid, key) {
    setLayout(function (prev) {
      var L = buildLayout(prev).map(function (a) { return a.slice(); });
      var fPos = findSlot(L, fid);
      var pi = fPos ? fPos.p : page;
      var nf = Object.assign({}, foldersRef.current);
      var f = nf[fid];
      if (!f) return prev;
      var nk = (f.keys || []).filter(function (k) { return k !== key; });
      if (nk.length) nf[fid] = { name: f.name, keys: nk }; else delete nf[fid];
      persistFolders(nf);
      var arr = L[pi];
      if (!nf[fid] && fPos) { arr[fPos.i] = key; return persistLayout(L); }
      var si = -1;
      var after = fPos ? fPos.i : -1;
      for (var j = 0; j < arr.length; j++) { if (SP_RE.test(arr[j])) { if (si < 0) si = j; if (j > after) { si = j; break; } } }
      if (si >= 0) arr[si] = key; else arr.push(key);
      var saved = persistLayout(L);
      // ⚠️她 2026-08-30 报「从第一页的文件夹整理出来就找不到了」。
      // 东西其实没丢：这一页满了的话 push 进来会被容量规整挤到下一页去，
      // 而她还站在这一页上看——一声不吭地换了页，跟丢了没区别。
      // 所以落在哪一页要按【规整之后】的布局算，然后翻过去给她看。
      try {
        var pos2 = findSlot(buildLayout(saved), key);
        if (pos2 && pos2.p !== page) setTimeout(function () { goPage(pos2.p); }, 0);
      } catch (e) {}
      return saved;
    });
  }
  function renameFolder(fid, name) {
    var nf = Object.assign({}, foldersRef.current);
    if (!nf[fid]) return;
    nf[fid] = { name: String(name || "").trim() || "文件夹", keys: nf[fid].keys };
    persistFolders(nf);
  }
  const clearHover = function () { if (hoverRef.current.timer) clearTimeout(hoverRef.current.timer); hoverRef.current = { key: null, timer: null }; setHoverKey(null); };
  const moveGhost = function (x, y) { var g = ghostRef.current; if (g) { g.style.left = x - 34 + "px"; g.style.top = y - 74 + "px"; } };
  function exitEdit() { setEditMode(false); setDragKey(null); dragKeyRef.current = null; dropRef.current = null; setDropKey(null); }
  const curLayout = buildLayout(layout);
  // 页数变化后夹住越界的历史页码
  useEffect(function () { if (page > curLayout.length - 1) goPage(curLayout.length - 1); }, []);
  // v47.73 一次性迁移老存档：memo/diary 图标清走（含文件夹里的，清空的文件夹解散）、w_weather 挪到第四页
  useEffect(function () {
    try {
      if (localStorage.getItem("x_layoutMig73")) return;
      localStorage.setItem("x_layoutMig73", "1");
      var F = Object.assign({}, foldersRef.current), fchg = false;
      Object.keys(F).forEach(function (fid) {
        var ks = F[fid].keys || [];
        var nk = ks.filter(function (k) { return k !== "memo" && k !== "diary"; });
        if (nk.length !== ks.length) { fchg = true; if (nk.length) F[fid] = { name: F[fid].name, keys: nk }; else delete F[fid]; }
      });
      if (fchg) persistFolders(F);
      setLayout(function (prev) {
        if (!Object.keys(prev || {}).length) return prev;   // 没自定义过布局：直接吃新默认
        var mx = 3;
        Object.keys(prev).forEach(function (k) { var n = parseInt(k, 10); if (!isNaN(n)) mx = Math.max(mx, n); });
        var L = [];
        for (var i = 0; i <= mx; i++) L[i] = (prev[i] || []).filter(function (k) { return k !== "memo" && k !== "diary" && k !== "w_weather"; });
        L[3] = (L[3] || []).concat(["w_weather"]);
        return persistLayout(L);
      });
    } catch (e) {}
  }, []);
  const nf = notif || {};
  const dock = [{
    key: "messages",
    zh: "信息",
    G: GMsg,
    badge: (unread || 0) + (nf.moments || 0)
  }, {
    key: "forum",
    zh: "论坛",
    G: GForum,
    badge: nf.forum || 0
  }, {
    // v47.73 dock 的情侣换成日记（情侣空间入口由 w_us 组件顶上，悄悄话红点也挪去组件）
    key: "diary",
    zh: "日记",
    G: GDiary
  }, {
    key: "config",
    zh: "设置",
    G: GConfig
  }];
  const clearLP = function () { if (lpRef.current) { clearTimeout(lpRef.current); lpRef.current = null; } };
  const onTS = e => {
    const tch = e.touches[0];
    dragRef.current = { x: tch.clientX, y: tch.clientY, w: e.currentTarget.offsetWidth || 360, dir: null, d: 0 };
    // 长按某个图标/组件 → 进入编辑并把它「拿起」；已在编辑态则摸到就拿起（跟 iOS 一样）
    clearLP();
    const startEl = document.elementFromPoint(tch.clientX, tch.clientY);
    const iconEl = startEl && startEl.closest && startEl.closest("[data-appkey]");
    if (iconEl) {
      const key = iconEl.getAttribute("data-appkey");
      if (SP_RE.test(key)) return; // 空格不能被拿起
      const pickUp = function () {
        setEditMode(true); setDragKey(key); dragKeyRef.current = key;
        dragRef.current = null; // 取消翻页手势
        requestAnimationFrame(function () { moveGhost(tch.clientX, tch.clientY); });
        if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) {}
      };
      if (editMode) pickUp();
      else lpRef.current = setTimeout(function () {
        lpRef.current = null;
        // 普通 app / 文件夹沿用 iOS 式长按整理；组件和装饰先开共用换皮面板，面板里仍可进入整理。
        if (kindOf(key) === "widget" || kindOf(key) === "decor") {
          dragRef.current = null;
          openStylePanel(key);
          if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) {}
        } else pickUp();
      }, 320);
    }
  };
  const onTM = e => {
    const tch = e.touches[0];
    // 正在拖：浮影跟手；边缘翻页（东西还拿在手里，落点在松手时才定）；
    // app 中心悬停≥600ms 合并成文件夹；其余情况只标记落点（空格/交换对象），松手才生效
    if (dragKeyRef.current) {
      if (e.cancelable) e.preventDefault();
      moveGhost(tch.clientX, tch.clientY);
      const cw = (dragRef.current && dragRef.current.w) || e.currentTarget.offsetWidth || 375;
      const x = tch.clientX, nowT = Date.now();
      if (x < 34 && page > 0 && nowT - flipRef.current > 650) {
        clearHover(); dropRef.current = null; setDropKey(null); flipRef.current = nowT; goPage(page - 1); return;
      }
      if (x > cw - 34 && page < curLayout.length - 1 && nowT - flipRef.current > 650) {
        clearHover(); dropRef.current = null; setDropKey(null); flipRef.current = nowT; goPage(page + 1); return;
      }
      const el = document.elementFromPoint(x, tch.clientY);
      const overEl = el && el.closest && el.closest("[data-appkey]");
      const overKey = overEl ? overEl.getAttribute("data-appkey") : null;
      const dragged = dragKeyRef.current;
      if (overKey && overKey !== dragged) {
        // 拖 app 悬停在另一个 app/文件夹的中间区域 → 蓄力合并
        const rect = overEl.getBoundingClientRect();
        const rx = (x - rect.left) / Math.max(1, rect.width);
        const canMerge = kindOf(dragged) === "app" && (kindOf(overKey) === "app" || kindOf(overKey) === "folder");
        if (canMerge && rx > 0.25 && rx < 0.75) {
          if (hoverRef.current.key !== overKey) {
            clearHover();
            dropRef.current = null; setDropKey(null);
            hoverRef.current.key = overKey; setHoverKey(overKey);
            hoverRef.current.timer = setTimeout(function () {
              const tgt = hoverRef.current.key;
              clearHover();
              const dk = dragKeyRef.current;
              if (!dk || !tgt) return;
              if (tgt.slice(0, 2) === "f_") addToFolder(tgt, dk); else makeFolder(tgt, dk);
              if (navigator.vibrate) try { navigator.vibrate(24); } catch (x2) {}
              setDragKey(null); dragKeyRef.current = null; // 合并即放手
            }, 600);
          }
          return; // 蓄力期间不标落点
        }
        clearHover();
        if (dropRef.current !== overKey) { dropRef.current = overKey; setDropKey(overKey); }
      } else if (!overKey) { clearHover(); if (dropRef.current) { dropRef.current = null; setDropKey(null); } }
      return;
    }
    const r = dragRef.current;
    if (!r) return;
    const dx = tch.clientX - r.x, dy = tch.clientY - r.y;
    // 手指移动超过阈值 → 判定为滑动，取消长按
    if (lpRef.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) clearLP();
    if (r.dir == null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) r.dir = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    if (r.dir !== "h") return;
    if (e.cancelable) e.preventDefault(); // 抢下横向手势，别让安卓浏览器/系统当成滚动或前进后退
    let d = dx;
    // 到头/到尾继续拉时加阻尼（橡皮筋）
    if ((page === 0 && d > 0) || (page === curLayout.length - 1 && d < 0)) d *= 0.32;
    r.d = d;
    setDrag(d);
  };
  const onTE = () => {
    clearLP();
    clearHover();
    if (dragKeyRef.current) {
      // 放下：有落点就落到那里（空格=挪过去原位留洞；别的项=互换位置）
      const dragged = dragKeyRef.current, dst = dropRef.current;
      dropRef.current = null; setDropKey(null);
      setDragKey(null); dragKeyRef.current = null; setDrag(0);
      if (dst && dst !== dragged) placeDrop(dragged, dst);
      return;
    }
    const r = dragRef.current;
    if (!r) { setDrag(0); return; }
    const w = r.w || 360, d = r.d || 0;
    dragRef.current = null;
    let np = page;
    if (d < -w * 0.2) np = Math.min(curLayout.length - 1, page + 1);
    else if (d > w * 0.2) np = Math.max(0, page - 1);
    goPage(np);
    setDrag(0);
  };
  // 渲染单个可摆放项（app / 用户文件夹 / 组件 / 空格），带 data-appkey + 抖动/拖起/合并目标样式；编辑态下禁点
  function renderItem(key) {
    // 空格：平时隐形占位（就是「洞」），编辑态显示虚线框，拖拽落点高亮
    if (SP_RE.test(key)) {
      const isDrop = dropKey === key;
      return h("div", {
        key: key, "data-appkey": key,
        style: {
          gridColumn: "span 1", minHeight: 78, borderRadius: 17,
          border: editMode ? "1.5px dashed " + (isDrop ? t.accent : "rgba(30,28,24,0.16)") : "none",
          background: isDrop ? "rgba(194,90,74,0.10)" : "transparent",
          transform: isDrop ? "scale(1.06)" : "none",
          transition: "all .15s ease"
        }
      });
    }
    const isFolder = key && key.slice(0, 2) === "f_";
    const it = isFolder ? { kind: "folder" } : REG[key];
    if (!it) return null;
    if (isFolder && !folders[key]) return null;
    const isDrag = dragKey === key;
    const isHoverTgt = hoverKey === key; // 有 app 悬停在我头上蓄力合并
    // 所有组件/装饰都从同一份占格设置取尺寸；spanOf/placeDense 也走这条，视觉和落位不会各算各的。
    const span = (it.kind === "widget" || it.kind === "decor") ? homeItemSpan(key, it, widgetSizes) : [1, 1];
    const gCol = "span " + span[0], gRow = "span " + span[1];
    const homeSize = widgetSizes[key] || "auto";
    let inner;
    if (it.kind === "app") inner = h(GlassIcon, { G: it.G, label: it.zh, appKey: key, onWallpaper: !!wallpaper, soon: it.soon, badge: key === "memo" ? (memoDue || 0) : 0, onClick: function () { if (editMode) return; it.soon ? (onSoon && onSoon(it.zh)) : onOpenApp(key); } });
    else if (isFolder) {
      const fApps = (folders[key].keys || []).map(function (k) { return Object.assign({ key: k }, REG[k] || {}); }).filter(function (a) { return a.zh; });
      inner = h(FolderIcon, { apps: fApps, label: folders[key].name || "文件夹", onWallpaper: !!wallpaper, onOpen: function () { if (!editMode) setOpenFolder(key); } });
    }
    else if (it.which === "card") inner = h(HomeCard, { card: homeCard, profile: profile, onEditCard: onEditCard, onEditProfile: onEditProfile, onOpenCodex: function () { if (!editMode) onOpenApp("codex"); } });
    else if (it.which === "cal") inner = h(CalWidget, { now: now, calendar: calendar, period: period, onOpen: function () { return onOpenApp("calendar"); } });
    else if (it.which === "music") inner = h(MusicWidget, { listen: listen, player: player, homeSize: homeSize, onOpen: function () { return onOpenApp("listen"); } });
    else if (it.which === "us") inner = h(UsWidget, { characters: characters, couples: couples, sweet: coupleSweet, dot: nf.whisper || 0, onOpen: function () { return onOpenApp("us"); } });
    else if (it.which === "memo") inner = h(MemoWidget, { onOpen: function () { return onOpenApp("memo"); } });
    else if (it.which === "muyu") inner = h(MuyuWidget, { editMode: editMode });
    else if (it.which === "weather") inner = h(WeatherWidget, { userGeo: userGeo, onOpen: function () { return onOpenApp("map"); } });
    else if (it.which === "ledger") inner = h(LedgerWidget, { onOpen: function () { return onOpenApp("ledger"); } });
    else if (it.which === "wheel") inner = h(WheelWidget, { editMode: editMode, onReact: onWheelReact });
    else if (it.which === "map") inner = (window.MapKit ? h(window.MapKit.MapWidget, { characters: characters, status: mapStatus, userGeo: userGeo, onOpen: function () { return onOpenApp("map"); } }) : null);
    else if (it.kind === "decor") inner = h(HomeDecorItem, { item: it.decor, preset: widgetStyles[key] || "soft", now: now });
    const presetId = widgetStyles[key] || (it.kind === "decor" ? "soft" : "native");
    let presetStyle = (it.kind === "widget" || it.kind === "decor") ? homeWidgetPresetStyle(presetId, t, it.kind === "decor" ? it.which : it.which) : null;
    if (it.kind === "decor" && it.decor) {
      presetStyle = Object.assign({}, presetStyle || {
        width: "100%", height: "100%", minWidth: 0, minHeight: 0,
        position: "relative", boxSizing: "border-box"
      }, homeDecorMaterialStyle(it.decor, t));
      if (it.decor.badge) {
        inner = h("div", { style: { width: "100%", height: "100%", minWidth: 0, minHeight: 0, position: "relative" } },
          inner,
          h("span", { style: { position: "absolute", right: 7, top: 6, zIndex: 8, maxWidth: "62%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderRadius: 999, padding: "2px 7px", background: it.decor.accent || "#b65f57", color: "#fff", fontFamily: F_BODY, fontSize: 8.5, letterSpacing: ".08em", boxShadow: "0 2px 7px rgba(30,28,24,.13)" } }, it.decor.badge));
      }
    }
    if (presetStyle) inner = h("div", { style: presetStyle }, inner);
    return h("div", {
      key: key, "data-appkey": key,
      style: {
        gridColumn: gCol, gridRow: gRow,
        animation: editMode && !isDrag && !isHoverTgt ? "wk-jiggle .32s ease-in-out infinite" : "none",
        transform: isDrag ? "scale(1.08)" : (isHoverTgt ? "scale(1.2)" : "none"),
        opacity: isDrag ? 0.28 : 1,
        pointerEvents: isDrag ? "none" : "auto",
        zIndex: isDrag ? 5 : "auto",
        outline: dropKey === key && dragKey && dragKey !== key ? "2px dashed " + t.accent : "none",
        outlineOffset: 3,
        borderRadius: 17,
        transition: "transform .15s ease"
      }
    }, h("div", { style: { pointerEvents: editMode ? "none" : "auto", width: "100%", height: "100%", minWidth: 0, minHeight: 0, overflow: it.kind === "decor" ? "visible" : (homeSize === "auto" ? "visible" : "hidden") } }, inner));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col relative",
    style: {
      height: "100vh", // 保持 100vh（底部白边最终解法，勿改成 100%/dvh）
      // 底一律由 app 根节点铺满（含刘海区），这里透明让它透上来，避免顶部出现拼接白边。
      // 有没有壁纸都一样——没壁纸那块纸底是 core.js 的 HOME_PAPER_BG，也画在根节点上。
      background: "transparent"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "relative flex-1 min-h-0 overflow-hidden pt-3 flex flex-col",
    // touchAction:pan-y 把横向手势交给我们自己处理（安卓比 iOS 严：不锁就把横滑当浏览器滚动/导航抢走→翻页难）
    style: { touchAction: "pan-y" },
    onTouchStart: onTS,
    onTouchMove: onTM,
    onTouchEnd: onTE,
    onTouchCancel: onTE
  }, h("div", {
    className: "flex-1 min-h-0",
    style: {
      display: "flex",
      transform: "translateX(calc(" + (-page * 100) + "% + " + drag + "px))",
      transition: dragRef.current ? "none" : "transform .34s cubic-bezier(.22,.61,.36,1)"
    }
  }, curLayout.map(function (keys, pi) {
    return h("div", { key: pi, className: "px-6", style: { width: "100%", flexShrink: 0 } },
      // 时钟跟图标下面那行字同一条规矩：铺了壁纸就翻白压深影，不然墨字加白晕（尺寸一个没动）
      pi === 0 && h("div", { className: "text-center mb-3" },
        h("div", { style: Object.assign({ fontFamily: F_DISPLAY, fontWeight: 300, fontSize: 62, lineHeight: 1, letterSpacing: "0.01em" },
          wallpaper ? { color: "#fff", textShadow: "0 2px 10px rgba(20,18,15,0.45), 0 0 24px rgba(20,18,15,0.25)" } : { color: t.ink }) }, fmtClock(now)),
        h("div", { style: Object.assign({ fontFamily: F_BODY, fontSize: 13, marginTop: 2 }, glassLabelInk(!!wallpaper, t), wallpaper ? {} : { color: t.sub }) }, now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" }))),
      h("div", { className: "grid grid-cols-4 gap-y-3 gap-x-3", style: { gridAutoFlow: "dense" } },
        (editMode ? (keys || []) : trimTailRows(keys)).map(function (key) { return renderItem(key); })));
  })), curLayout.length > 1 && h("div", { className: "flex justify-center gap-1.5 pt-2 shrink-0" }, curLayout.map(function (_, pi) { return h("span", { key: pi, style: { width: pi === page ? 16 : 6, height: 6, borderRadius: 999, background: pi === page ? (wallpaper ? "rgba(255,255,255,0.95)" : t.ink) : (wallpaper ? "rgba(255,255,255,0.45)" : t.line), transition: "all .25s" } }); }))), /*#__PURE__*/React.createElement("div", {
    className: "relative shrink-0 px-4 pt-1",
    style: { paddingBottom: "calc(env(safe-area-inset-bottom) + 26px)" }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-around px-3 py-3",
    style: {
      borderRadius: 28,
      // dock 跟图标同一块玻璃，只是更大更厚（no-half-sheet 之外的另一条：一层做法只写一处）
      background: "linear-gradient(160deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.08) 55%, rgba(255,255,255,0.16) 100%)",
      backdropFilter: "blur(22px) saturate(1.9) brightness(1.05)",
      WebkitBackdropFilter: "blur(22px) saturate(1.9) brightness(1.05)",
      border: "1px solid rgba(255,255,255,0.5)",
      boxShadow: "0 10px 34px rgba(30,28,24,0.16), inset 0 1.2px 0.6px rgba(255,255,255,0.9), inset 0 -1.4px 1.4px rgba(255,255,255,0.4)"
    }
  }, dock.map(a => /*#__PURE__*/React.createElement(GlassIcon, {
    key: a.key,
    appKey: a.key,
    G: a.G,
    label: a.zh,
    badge: a.badge,
    onWallpaper: !!wallpaper,
    onClick: () => onOpenApp(a.key)
  })))), editMode && h("button", {
    onClick: exitEdit,
    style: {
      position: "absolute", top: "calc(env(safe-area-inset-top) + 10px)", right: 16, zIndex: 40,
      padding: "7px 20px", borderRadius: 999, background: t.ink, color: t.bg2,
      fontFamily: F_BODY, fontSize: 14, fontWeight: 600, boxShadow: "0 6px 20px rgba(30,28,24,0.25)"
    }
  }, "完成"), editMode && h("button", {
    onClick: function () { resetDecorDraft(); setShowDecorLibrary(true); },
    style: {
      position: "absolute", top: "calc(env(safe-area-inset-top) + 10px)", left: 16, zIndex: 40,
      padding: "7px 17px", borderRadius: 999, background: "rgba(255,255,255,.78)", color: t.ink,
      border: "1px solid rgba(255,255,255,.9)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
      fontFamily: F_BODY, fontSize: 14, fontWeight: 600, boxShadow: "0 6px 20px rgba(30,28,24,0.16)"
    }
  }, "＋ 装饰"), editMode && h("div", {
    style: { position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom) + 150px)", textAlign: "center", zIndex: 40, fontFamily: F_BODY, fontSize: 11.5, color: t.fog, pointerEvents: "none" }
  }, "拖到虚线空格＝放到那里 · 拖到别的图标＝互换位置 · 叠在图标上停一下＝合成文件夹 · 拖到屏幕边缘换页"), dragKey && h("div", {
    ref: ghostRef,
    style: { position: "fixed", left: -120, top: -120, zIndex: 60, width: 68, height: 68, borderRadius: 19, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.78)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,0.85)", boxShadow: "0 14px 34px rgba(30,28,24,0.32)", transform: "scale(1.1)" }
  }, (function () {
    if (dragKey.slice(0, 2) === "f_") return h("span", { style: { fontSize: 24 } }, "📁");
    const gi = REG[dragKey];
    if (!gi) return null;
    if (gi.kind === "app") return h(gi.G, { size: 32, color: t.ink, sw: 1.6 });
    if (gi.kind === "decor") return h("span", { style: { fontSize: 25 } }, homeDecorMeta(gi.which).glyph);
    return h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub } }, { card: "名片", cal: "日历", music: "音乐", map: "地图" }[gi.which] || "组件");
  })()), openFolder && folders[openFolder] && h(FolderOverlay, {
    apps: (folders[openFolder].keys || []).map(function (k) { return Object.assign({ key: k }, REG[k] || {}); }).filter(function (a) { return a.zh; }),
    label: folders[openFolder].name || "文件夹",
    onRename: function (nm) { renameFolder(openFolder, nm); },
    onRemove: function (k) { removeFromFolder(openFolder, k); },
    onClose: function () { return setOpenFolder(null); },
    onPick: function (a) { setOpenFolder(null); if (a.soon) { onSoon && onSoon(a.zh); } else { onOpenApp(a.key); } }
  }), styleKey && REG[styleKey] && h(Sheet, { onClose: function () { setStyleKey(null); }, tall: true },
    h("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 18 } },
      h("div", null,
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.ink } }, "桌面组件"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 4 } }, REG[styleKey].kind === "decor" ? "内容、占格与外观分开保存，改一项不会碰另外两项。" : "尺寸与外观分开设置，不改组件原来的功能。")),
      h("button", { onClick: function () { setStyleKey(null); setEditMode(true); }, className: "active:opacity-65", style: { flexShrink: 0, borderRadius: 999, padding: "8px 13px", background: t.bg, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 12, color: t.ink } }, "整理位置")),
    REG[styleKey].kind === "decor" ? h("div", { style: { marginBottom: 20 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: ".14em", color: t.fog, marginBottom: 9 } }, REG[styleKey].which === "photo" ? "照片与相框" : "卡片内容"),
      REG[styleKey].which === "photo" ? h(React.Fragment, null,
        h(HomePhotoFrameGrid, { value: styleDecorFrame, onChange: function (id) { setStyleDecorFrame(id); setStyleDecorPhotos(function (prev) { return normalizeHomePhotoSlots(prev, id); }); } }),
        h(HomePhotoSlotEditor, { value: styleDecorPhotos, frame: styleDecorFrame, busy: decorBusy, onPick: function (file, slot) { takeDecorPhoto(file, "style", slot); }, onClear: function (slot) { clearDecorPhoto("style", slot); } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 7 } }, "每格单独点选；也可以留空，先把相框摆在桌面上。"),
        h("input", { value: styleDecorText, onChange: function (e) { setStyleDecorText(e.target.value); }, maxLength: 50, placeholder: "照片旁的一句小字（可不填）", style: { width: "100%", marginTop: 10, outline: "none", borderRadius: 14, border: "1px solid " + t.line, background: t.bg, color: t.ink, fontFamily: F_BODY, fontSize: 13.5, padding: "11px 12px" } })) :
        h("div", null,
          h("textarea", { value: styleDecorText, onChange: function (e) { setStyleDecorText(e.target.value); }, rows: 2, maxLength: 120, placeholder: "改写" + homeDecorMeta(REG[styleKey].which).name + "的主标题", style: { width: "100%", resize: "none", outline: "none", borderRadius: 15, border: "1px solid " + t.line, background: t.bg, color: t.ink, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, padding: 12 } }),
          homeDecorHasDetail(REG[styleKey].which) ? h("textarea", { value: styleDecorDetail, onChange: function (e) { setStyleDecorDetail(e.target.value); }, rows: 2, maxLength: 140, placeholder: "补一句说明、日期或留给自己的小字", style: { width: "100%", marginTop: 9, resize: "none", outline: "none", borderRadius: 15, border: "1px solid " + t.line, background: t.bg, color: t.ink, fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55, padding: 12 } }) : null),
      h(HomeDecorAppearanceEditor, {
        surface: styleDecorSurface,
        borderMode: styleDecorBorderMode,
        accent: styleDecorAccent,
        align: styleDecorAlign,
        badge: styleDecorBadge,
        tilt: styleDecorTilt,
        onSurface: setStyleDecorSurface,
        onBorderMode: setStyleDecorBorderMode,
        onAccent: setStyleDecorAccent,
        onAlign: setStyleDecorAlign,
        onBadge: setStyleDecorBadge,
        onTilt: setStyleDecorTilt
      }),
      h("button", { onClick: saveStyleDecoration, disabled: decorBusy, className: "w-full active:opacity-70", style: { marginTop: 10, borderRadius: 14, padding: "11px 0", background: t.ink, color: t.bg2, opacity: decorBusy ? .45 : 1, fontFamily: F_DISPLAY, fontSize: 14 } }, "保存内容")) : null,
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: ".14em", color: t.fog, marginBottom: 9 } }, "占格尺寸"),
    h(HomeSizeGrid, { value: widgetSizes[styleKey] || "auto", onChange: function (id) { setWidgetSize(styleKey, id); } }),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: ".14em", color: t.fog, marginTop: 20, marginBottom: 9 } }, "外观样式"),
    h(HomePresetGrid, { value: widgetStyles[styleKey] || (REG[styleKey].kind === "decor" ? "soft" : "native"), allowNative: REG[styleKey].kind !== "decor", onChange: function (id) { setWidgetPreset(styleKey, id); } }),
    REG[styleKey].kind === "decor" ? h("button", { onClick: function () { removeDecoration(styleKey); }, className: "w-full active:opacity-65", style: { marginTop: 18, padding: "12px 0", borderRadius: 14, border: "1px solid rgba(194,90,74,.45)", fontFamily: F_BODY, fontSize: 13, color: "#b34f43" } }, "移除这件装饰") : null),
  showDecorLibrary && h(Sheet, { onClose: function () { setShowDecorLibrary(false); resetDecorDraft(); }, tall: true },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.ink } }, "桌面装饰"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 4, marginBottom: 16 } }, "内容、材质、边线和强调色都能分别编辑；透明底与无边框也可以独立选择。"),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 } },
      HOME_DECOR_TYPES.map(function (x) {
        var active = decorDraftType === x.id;
        return h("button", { key: x.id, onClick: function () { setDecorDraftType(x.id); setDecorDraftText(x.text || ""); setDecorDraftDetail(x.detail || ""); }, className: "active:opacity-70", style: { borderRadius: 15, padding: "13px 4px 11px", background: active ? t.ink : t.bg, color: active ? t.bg2 : t.ink, border: "1px solid " + (active ? t.ink : t.line) } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 23, lineHeight: 1 } }, x.glyph), h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, marginTop: 7, whiteSpace: "nowrap" } }, x.name));
      })),
    decorDraftType === "photo" ? h("div", { style: { marginBottom: 17 } },
      h(HomePhotoFrameGrid, { value: decorDraftFrame, onChange: function (id) { setDecorDraftFrame(id); setDecorDraftPhotos(function (prev) { return normalizeHomePhotoSlots(prev, id); }); } }),
      h(HomePhotoSlotEditor, { value: decorDraftPhotos, frame: decorDraftFrame, busy: decorBusy, onPick: function (file, slot) { takeDecorPhoto(file, "draft", slot); }, onClear: function (slot) { clearDecorPhoto("draft", slot); } }),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 7 } }, "照片可以先不放。三格相框以后也是逐格补，不会要求一次选满。"),
      h("input", { value: decorDraftText, onChange: function (e) { setDecorDraftText(e.target.value); }, maxLength: 50, placeholder: "照片旁的一句小字（可不填）", style: { width: "100%", marginTop: 10, outline: "none", borderRadius: 14, border: "1px solid " + t.line, background: t.bg, color: t.ink, fontFamily: F_BODY, fontSize: 13.5, padding: "11px 12px" } })) :
      h("div", { style: { marginBottom: 17 } },
        h("textarea", { value: decorDraftText, onChange: function (e) { setDecorDraftText(e.target.value); }, rows: 2, maxLength: 120, placeholder: "写下" + homeDecorMeta(decorDraftType).name + "的主标题", style: { width: "100%", resize: "none", outline: "none", borderRadius: 15, border: "1px solid " + t.line, background: t.bg, color: t.ink, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, padding: 12 } }),
        homeDecorHasDetail(decorDraftType) ? h("textarea", { value: decorDraftDetail, onChange: function (e) { setDecorDraftDetail(e.target.value); }, rows: 2, maxLength: 140, placeholder: "补一句说明、日期或留给自己的小字", style: { width: "100%", marginTop: 9, resize: "none", outline: "none", borderRadius: 15, border: "1px solid " + t.line, background: t.bg, color: t.ink, fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55, padding: 12 } }) : null),
    h(HomeDecorAppearanceEditor, {
      surface: decorDraftSurface,
      borderMode: decorDraftBorderMode,
      accent: decorDraftAccent,
      align: decorDraftAlign,
      badge: decorDraftBadge,
      tilt: decorDraftTilt,
      onSurface: setDecorDraftSurface,
      onBorderMode: setDecorDraftBorderMode,
      onAccent: setDecorDraftAccent,
      onAlign: setDecorDraftAlign,
      onBadge: setDecorDraftBadge,
      onTilt: setDecorDraftTilt
    }),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: ".14em", color: t.fog, marginBottom: 9 } }, "基础版式"),
    h(HomePresetGrid, { value: decorDraftPreset, allowNative: false, onChange: setDecorDraftPreset }),
    h("button", { onClick: addDecoration, disabled: decorBusy, className: "w-full active:opacity-70", style: { marginTop: 18, borderRadius: 15, padding: "13px 0", background: t.ink, color: t.bg2, opacity: decorBusy ? .45 : 1, fontFamily: F_DISPLAY, fontSize: 15 } }, "放到桌面上")));
}
// 主页名片（与聊天「我」人设解耦）：昵称 + 签名 + #标签；铅笔改名片，点头像改聊天人设/头像
function HomeCard({ card, profile, onEditCard, onEditProfile, onOpenCodex }) {
  const t = useTheme();
  const c = card || {};
  const name = c.name || profile.name || "点此设置昵称";
  const sign = c.sign || "";
  const tags = (c.tags || []).filter(Boolean);
  return h(GlassCard, { style: { padding: 16, marginBottom: 14 } },
    h("div", { className: "flex items-start gap-4" },
      h("button", { onClick: onEditProfile, className: "active:opacity-70", style: { flexShrink: 0 } }, h(Avatar, { character: { name: profile.name, avatarImage: profile.avatarImage, color: profile.color || t.accent }, size: 56, radius: 999 })),
      h("div", { className: "flex-1 min-w-0", style: { paddingTop: 1 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.ink, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, name),
        // 签名锁单行（省略号）：多行/长签名都不再把名片撑大，卡片高度固定
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, fontStyle: "italic", color: t.fog, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, sign ? "“" + sign.replace(/\s*\n\s*/g, " ") + "”" : "点铅笔写一句签名"),
        // #标签紧凑横排：缩小内边距/字号/间距，让标签在同一行流式排布（不再一个一行竖着堆），窄了自动换行、一行通常放得下三个左右
        tags.length ? h("div", { className: "flex flex-wrap gap-1.5", style: { marginTop: 8 } }, tags.map((tg, i) => h("span", { key: i, style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, background: "rgba(255,255,255,0.5)", border: "1px solid " + t.line, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0 } }, "#" + tg))) : null),
      h("div", { className: "flex flex-col gap-1.5", style: { flexShrink: 0 } },
        h("button", { onClick: onEditCard, className: "active:opacity-60 flex items-center justify-center", style: { width: 30, height: 30, borderRadius: 999, background: "rgba(255,255,255,0.5)", border: "1px solid " + t.line } }, h(IPencil, { size: 14, color: t.fog })),
        onOpenCodex ? h("button", { onClick: onOpenCodex, className: "active:opacity-60 flex items-center justify-center", title: "攻略", style: { width: 30, height: 30, borderRadius: 999, background: "rgba(255,255,255,0.5)", border: "1px solid " + t.line, fontFamily: F_DISPLAY, fontSize: 14, color: t.fog } }, "?") : null)));
}
// 编辑名片：昵称 / 签名 / 标签(逗号隔开)
function HomeCardSheet({ card, onSave, onClose }) {
  const t = useTheme();
  const c = card || {};
  const [name, setName] = useState(c.name || "");
  const [sign, setSign] = useState(c.sign || "");
  const [tagStr, setTagStr] = useState((c.tags || []).join(", "));
  const inp = { width: "100%", outline: "none", padding: "10px 2px", fontFamily: F_BODY, fontSize: 16, color: t.ink, background: "transparent", border: "none", borderBottom: "1px solid " + t.line };
  const save = () => onSave({ name: name.trim(), sign: sign.trim(), tags: tagStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) });
  return h(Sheet, { onClose: onClose, tall: true },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: t.ink, marginBottom: 18 } }, "编辑名片"),
    h("input", { value: name, onChange: e => setName(e.target.value), placeholder: "昵称", style: Object.assign({}, inp, { marginBottom: 22 }) }),
    h("input", { value: sign, onChange: e => setSign(e.target.value), placeholder: "签名", style: Object.assign({}, inp, { marginBottom: 22 }) }),
    h("input", { value: tagStr, onChange: e => setTagStr(e.target.value), placeholder: "标签，逗号隔开", style: Object.assign({}, inp, { marginBottom: 6 }) }),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 22 } }, "标签会显示成 #Design #Mood。名片和聊天里的「我」是分开的，改这里不影响角色对你的认知。"),
    h("div", { className: "flex gap-3" },
      h("button", { onClick: onClose, className: "flex-1 active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "13px 0" } }, "取消"),
      h("button", { onClick: save, className: "flex-1 active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.bg2, background: t.ink, borderRadius: 14, padding: "13px 0" } }, "保存")));
}
function ProfileSheet({
  profile,
  onSave,
  onClose
}) {
  const t = useTheme();
  const [name, setName] = useState(profile.name || "");
  const [tagline, setTagline] = useState(profile.tagline || "");
  const [persona, setPersona] = useState(profile.persona || "");
  const [avatarImage, setAvatarImage] = useState(profile.avatarImage || null);
  const [color, setColor] = useState(profile.color || AV_COLORS[0]);
  const [birthday, setBirthday] = useState(profile.birthday || "");
  const [appearance, setAppearance] = useState(profile.appearance || "");
  const [refPhoto, setRefPhoto] = useState(profile.refPhoto || null);
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose,
    tall: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-2"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 20,
      color: t.ink
    }
  }, "我的面具"), /*#__PURE__*/React.createElement("button", {
    onClick: () => onSave(Object.assign({}, profile, {
      name,
      tagline,
      persona,
      avatarImage,
      color,
      birthday: birthday.trim(),
      appearance: appearance.trim(),
      refPhoto: refPhoto
    }))
  }, /*#__PURE__*/React.createElement(ICheck, {
    size: 19,
    color: t.ink
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-center py-3"
  }, /*#__PURE__*/React.createElement(AvatarPicker, {
    character: {
      name,
      avatarImage,
      color
    },
    size: 78,
    radius: 18,
    onPick: setAvatarImage,
    onClear: () => setAvatarImage(null)
  })), /*#__PURE__*/React.createElement(LineField, {
    zh: "昵称",
    en: "Name"
  }, /*#__PURE__*/React.createElement(LineInput, {
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "角色如何称呼你"
  })), /*#__PURE__*/React.createElement(LineField, {
    zh: "签名",
    en: "Tagline"
  }, /*#__PURE__*/React.createElement(LineInput, {
    value: tagline,
    onChange: e => setTagline(e.target.value),
    placeholder: "一句话签名",
    style: {
      fontSize: 15,
      fontFamily: F_BODY
    }
  })), /*#__PURE__*/React.createElement(LineField, {
    zh: "生日",
    en: "Birthday"
  }, /*#__PURE__*/React.createElement(LineInput, {
    value: birthday,
    onChange: e => setBirthday(e.target.value),
    placeholder: "如 3-15 或 1998-3-15（可留空）",
    style: {
      fontSize: 15,
      fontFamily: F_BODY
    }
  })), /*#__PURE__*/React.createElement(LineField, {
    zh: "人设",
    en: "Persona"
  }, /*#__PURE__*/React.createElement(LineArea, {
    value: persona,
    onChange: e => setPersona(e.target.value),
    rows: 5,
    placeholder: "会注入给所有角色：你的身份、性格、处境……"
  })), h(LineField, { zh: "外貌 · 合照用", en: "Appearance" },
    h("div", null,
      h("div", { className: "flex items-center gap-3 mb-2" },
        h(AvatarPicker, { character: { name, avatarImage: refPhoto, color }, size: 56, radius: 12, imageMaxDim: 1024, imageQuality: 0.94, onPick: setRefPhoto, onClear: () => setRefPhoto(null) }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.5 } }, "传张你的参考照(可选)锁住长相；接了图像 API 后，角色发『我俩合照』时会照着画你")),
      h(LineArea, { value: appearance, onChange: e => setAppearance(e.target.value), rows: 4, placeholder: "你的长相/发型/身材/气质/常穿风格……越具体，合照里的你越像本人。填了才开放『合照』。" }))));
}
// ============================================================
// MESSAGES — WeChat-style: 聊天 / 通讯录 / 朋友圈
// ============================================================
function Messages({
  characters,
  allChars,
  groups,
  chats,
  groupChats,
  moments,
  profile,
  unreadMap,
  offlineLastTs,
  pinned,
  onTogglePin,
  onBack,
  onOpenThread,
  onOpenGroup,
  onNewGroup,
  onOpenContact,
  onGenMoment,
  genMoment,
  onLikeMoment,
  onCommentMoment,
  onDelMoment,
  onOpenMomProfile,
  onEditProfile,
  onOpenWallet,
  onOpenFavorites,
  onOpenMyCloset,
  walletBalance,
  friendGroups,
  onSaveGroups,
  onPostMoment,
  tab: tabProp,
  onTab
}) {
  const t = useTheme();
  // tab 提到 App 层受控（v48.40）：进角色资料卡再返回时不丢，还回原来的通讯录/朋友圈 tab。无 prop 时回退内部 state（旧行为）
  const [tabInner, setTabInner] = useState("chats");
  const tab = tabProp != null ? tabProp : tabInner;
  const setTab = onTab || setTabInner;
  const [composeOpen, setComposeOpen] = useState(false);
  const [groupMgr, setGroupMgr] = useState(false);
  const [groupList, setGroupList] = useState(false);   // 通讯录里的「群聊」入口
  const [q, setQ] = useState("");                       // 聊天列表顶部搜索（她 2026-08-26）
  const TITLES = {
    chats: "聊天",
    contacts: "通讯录",
    moments: "朋友圈",
    me: "我"
  };
  const NP = d => h("path", {
    d
  });
  const NAV = [["chats", "聊天", [NP("M21 11.5a8.5 8.5 0 01-8.5 8.5 8.5 8.5 0 01-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 013.5 11.5 8.5 8.5 0 0112 3a8.5 8.5 0 019 8.5z")]], ["contacts", "通讯录", [h("circle", {
    cx: 9,
    cy: 7,
    r: 3
  }), NP("M15 21v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1"), NP("M16 3.5a3 3 0 010 6"), NP("M22 21v-1a4 4 0 00-3-3.8")]], ["moments", "朋友圈", [NP("M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"), h("circle", {
    cx: 12,
    cy: 13,
    r: 3.5
  })]], ["me", "我", [h("circle", {
    cx: 12,
    cy: 8,
    r: 4
  }), NP("M5 21v-1a7 7 0 0114 0v1")]]];
  // 聊天列表：群+角色合并，置顶的排最前，其余按最后一条消息时间倒序（最近的在上）
  const pinnedSet = new Set(pinned || []);
  const offLast = offlineLastTs || {};
  // 排序时间取【线上最后一条】和【线下最后一条】里更晚的——线下角色自己冒泡也会把这个聊天顶上来（她 2026-07-23）
  const chatItems = [
    ...groups.map(g => { const msgs = groupChats[g.id] || []; const last = msgs[msgs.length - 1]; return { key: "g_" + g.id, id: g.id, type: "group", g: g, last: last, ts: Math.max(last ? (last.ts || 0) : 0, offLast[g.id] || 0) }; }),
    ...characters.map(c => { const msgs = chats[c.id] || []; const last = msgs[msgs.length - 1]; return { key: "c_" + c.id, id: c.id, type: "char", c: c, last: last, ts: Math.max(last ? (last.ts || 0) : 0, offLast[c.id] || 0) }; })
  ];
  chatItems.sort((a, b) => { const pa = pinnedSet.has(a.id), pb = pinnedSet.has(b.id); if (pa !== pb) return pa ? -1 : 1; return b.ts - a.ts; });
  // 搜索：名字/备注/群名先匹配，再看最后一条消息的正文——想找哪个聊天框就直接打字
  const kw = q.trim().toLowerCase();
  const hitItem = it => {
    if (!kw) return true;
    const nm = it.type === "group" ? (it.g.name || "") : ((it.c.remark || "") + " " + (it.c.name || ""));
    if (nm.toLowerCase().indexOf(kw) >= 0) return true;
    const lastTxt = it.last && (it.last.content || "");
    return String(lastTxt).toLowerCase().indexOf(kw) >= 0;
  };
  const shownItems = chatItems.filter(hitItem);
  // 长按置顶：按住 ~0.5s 触发 onTogglePin，并拦掉随后的点击（避免误进聊天）
  const pressT = useRef({}); const longFired = useRef(false);
  const startPress = id => { longFired.current = false; clearTimeout(pressT.current[id]); pressT.current[id] = setTimeout(() => { longFired.current = true; onTogglePin && onTogglePin(id); }, 500); };
  const endPress = id => clearTimeout(pressT.current[id]);
  const guardClick = fn => { if (longFired.current) { longFired.current = false; return; } fn(); };
  const longProps = id => ({ onPointerDown: () => startPress(id), onPointerUp: () => endPress(id), onPointerLeave: () => endPress(id), onPointerCancel: () => endPress(id) });
  const unreadBadge = un => un > 0 && h("span", { style: { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 999, background: t.accent, color: "#fff", fontSize: 10, fontFamily: F_BODY, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" } }, un > 99 ? "99+" : un);
  const rowBg = id => pinnedSet.has(id) ? "rgba(0,0,0,0.035)" : "transparent";
  const renderCharRow = it => { const c = it.c, last = it.last, un = unreadMap[c.id] || 0; return h("button", Object.assign({ key: it.key, onClick: () => guardClick(() => onOpenThread(c)), className: "w-full flex items-center gap-3 px-5 py-3.5 active:bg-black/5", style: { borderBottom: "1px solid " + t.line, background: rowBg(c.id) } }, longProps(c.id)),
    h("div", { className: "relative shrink-0" }, h(Avatar, { character: c, size: 50, radius: 10 }), unreadBadge(un)),
    h("div", { className: "flex-1 text-left min-w-0" },
      h("div", { className: "flex items-center gap-1.5" }, pinnedSet.has(c.id) && h(IPin, { size: 12, color: t.fog }), h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, c.remark || c.name)),
      h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog }, className: "truncate" }, last ? last.content : "打个招呼吧")),
    last && h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.line } }, fmtStamp(last.ts))); };
  const renderGroupRow = it => { const g = it.g, last = it.last, un = unreadMap[g.id] || 0; return h("button", Object.assign({ key: it.key, onClick: () => guardClick(() => onOpenGroup(g)), className: "w-full flex items-center gap-3 px-5 py-3.5 active:bg-black/5", style: { borderBottom: "1px solid " + t.line, background: rowBg(g.id) } }, longProps(g.id)),
    h("div", { className: "relative shrink-0" }, h("div", { className: "grid grid-cols-2 gap-0.5 p-0.5", style: { width: 50, height: 50, borderRadius: 10, background: t.bg, overflow: "hidden" } }, (g.memberIds || []).slice(0, 4).map((mid, k) => { const m = (allChars || characters).find(x => x.id === mid); return h("div", { key: k, style: { overflow: "hidden", borderRadius: 3 } }, m ? h(Avatar, { character: m, size: 23, radius: 3 }) : null); })), unreadBadge(un)),
    h("div", { className: "flex-1 text-left min-w-0" },
      h("div", { className: "flex items-center gap-1.5" }, pinnedSet.has(g.id) && h(IPin, { size: 12, color: t.fog }), h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, g.name), h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "(" + (g.memberIds || []).length + ")")),
      h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog }, className: "truncate" }, last ? (last.senderName ? last.senderName + "：" : "") + last.content : "群聊已创建")),
    last && h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.line } }, fmtStamp(last.ts))); };
  return /*#__PURE__*/React.createElement("div", {
    className: "h-full flex flex-col",
    style: {
      background: t.bg2
    }
  }, h("div", {
    className: "shrink-0 px-5 pb-3",
    style: {
      paddingTop: safeTop(20),
      background: t.bg2,
      borderBottom: `1px solid ${t.line}`
    }
  }, h("div", {
    className: "flex items-center justify-between"
  }, h("div", {
    className: "flex items-center gap-2"
  }, h("button", {
    onClick: onBack,
    className: "active:opacity-50 -ml-1"
  }, h(IArrow, {
    size: 19,
    color: t.ink
  })), h("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 24,
      color: t.ink
    }
  }, TITLES[tab])), tab === "chats" ? h("button", {
    onClick: onNewGroup,
    className: "active:opacity-50"
  }, h(IPlus, {
    size: 20,
    color: t.ink
  })) : null)), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-y-auto"
  }, tab === "chats" && /*#__PURE__*/React.createElement("div", null,
    h("div", { className: "px-4 pt-1 pb-2" },
      h("div", { className: "flex items-center gap-2 px-3", style: { background: t.bg2, borderRadius: 10, border: "1px solid " + t.line } },
        h(Svg, { size: 15, color: t.fog, sw: 1.9 }, h("circle", { cx: 11, cy: 11, r: 7 }), h("path", { d: "M20 20l-3.5-3.5" })),
        h("input", { value: q, onChange: e => setQ(e.target.value), placeholder: "搜索",
          className: "flex-1 outline-none", style: { background: "transparent", padding: "8px 0", fontFamily: F_BODY, fontSize: 14, color: t.ink } }),
        q ? h("button", { onClick: () => setQ(""), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 15, color: t.fog, padding: "0 2px" } }, "×") : null)),
    characters.length === 0 && groups.length === 0 && h(Empty, { text: "还没有对话", sub: "先去通讯录或人格档案馆录入角色" }),
    kw && shownItems.length === 0 ? h(Empty, { text: "没搜到「" + q.trim() + "」", sub: "换个名字或关键词试试" }) : null,
    shownItems.map(it => it.type === "group" ? renderGroupRow(it) : renderCharRow(it))
  ), tab === "contacts" && (() => {
    // 通讯录（v56.40，她 2026-08-26 要微信那样）：顶上两个收纳入口，下面按首字母分组，右边一条 A-Z 索引。
    // 有备注按备注的首字母，没备注按本名——她明说的。
    const secs = typeof pinyinSections === "function" ? pinyinSections(characters) : [{ letter: "#", items: characters }];
    const entry = (label, sub, colors, icon, onClick) => h("button", { key: label, onClick: onClick,
      className: "w-full flex items-center justify-between px-5 py-3 active:bg-black/5", style: { borderBottom: "1px solid " + t.line } },
      h("div", { className: "flex items-center gap-3" },
        h("span", { className: "flex items-center justify-center shrink-0", style: { width: 34, height: 34, borderRadius: 9, background: colors } },
          h(Svg, { size: 19, color: "#fff", sw: 1.9 }, icon)),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, label),
        sub ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, sub) : null),
      h(IChevR, { size: 15, color: t.line }));
    const jump = L => { try { const el = document.getElementById("mcontact-" + L); if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" }); } catch (e) {} };
    return h("div", { className: "py-1", style: { position: "relative" } },
      entry("群聊", (groups || []).length ? (groups || []).length + " 个" : "", "#4cae4c",
        [h("circle", { key: "a", cx: 9, cy: 7, r: 3 }), h("path", { key: "b", d: "M15 21v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1" }), h("path", { key: "c", d: "M16 3.5a3 3 0 010 6" }), h("path", { key: "d", d: "M22 21v-1a4 4 0 00-3-3.8" })],
        () => setGroupList(true)),
      entry("标签", friendGroups.length ? friendGroups.length + " 组" : "", "#3d7de0",
        [h("path", { key: "a", d: "M20.6 12.6L12 4H4v8l8.6 8.6a2 2 0 002.8 0l5.2-5.2a2 2 0 000-2.8z" }), h("circle", { key: "b", cx: 8, cy: 8, r: 1.3 })],
        () => setGroupMgr(true)),
      characters.length === 0
        ? h(Empty, { text: "通讯录是空的", sub: "去人格档案馆录入角色" })
        : h("div", { style: { paddingRight: 22 } }, secs.map(sec => h("div", { key: sec.letter, id: "mcontact-" + sec.letter },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, letterSpacing: "0.08em", color: t.fog, background: t.bg2, padding: "3px 20px" } }, sec.letter),
            sec.items.map(c => h("button", { key: c.id, onClick: () => onOpenContact(c),
              className: "w-full flex items-center gap-3 px-5 py-3 active:bg-black/5", style: { borderBottom: "1px solid " + t.line } },
              h(Avatar, { character: c, size: 42, radius: 9 }),
              h("div", { className: "flex-1 text-left" },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.remark || c.name),
                c.remark ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 1 } }, c.name) : null,
                friendGroups.filter(g => g.memberIds.includes(c.id)).length
                  ? h("div", { className: "flex flex-wrap gap-1 mt-1" }, friendGroups.filter(g => g.memberIds.includes(c.id)).map(g => h("span", { key: g.id,
                      style: { fontFamily: F_BODY, fontSize: 10, color: t.sub, background: t.bg, border: "1px solid " + t.line, borderRadius: 999, padding: "1px 7px" } }, g.name)))
                  : null),
              h(IChevR, { size: 15, color: t.line }))))))
      ,
      // 右侧 A-Z 索引条：只列真的有人的那些字母
      characters.length > 6 && secs.length > 1
        ? h("div", { style: { position: "absolute", right: 2, top: 96, bottom: 8, width: 18, display: "flex", flexDirection: "column", justifyContent: "center", gap: 1, zIndex: 5 } },
            secs.map(sec => h("button", { key: sec.letter, onClick: () => jump(sec.letter), className: "active:opacity-50",
              style: { fontFamily: F_BODY, fontSize: 9.5, lineHeight: 1.15, color: t.fog, padding: "0" } }, sec.letter)))
        : null);
  })(), tab === "moments" && /*#__PURE__*/React.createElement(MomentsFeed, {
    characters: characters,
    moments: moments,
    profile: profile,
    friendGroups: friendGroups,
    onGen: onGenMoment,
    onCompose: () => setComposeOpen(true),
    gen: genMoment,
    onLike: onLikeMoment,
    onComment: onCommentMoment,
    onDelete: onDelMoment,
    onOpenProfile: cid => onOpenMomProfile && onOpenMomProfile(cid, false)
  }), tab === "me" && h("div", {
    className: "p-5"
  }, h("button", {
    onClick: onEditProfile,
    className: "w-full flex items-center gap-4 p-4 active:opacity-70",
    style: {
      background: t.bg,
      borderRadius: 16,
      border: `1px solid ${t.line}`
    }
  }, h(Avatar, {
    character: {
      name: profile.name || "我",
      avatarImage: profile.avatarImage,
      color: profile.color
    },
    size: 60,
    radius: 16
  }), h("div", {
    className: "flex-1 min-w-0 text-left"
  }, h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 19,
      color: t.ink
    }
  }, profile.name || "设置昵称"), h("div", {
    className: "truncate",
    style: {
      fontFamily: F_BODY,
      fontSize: 12,
      color: t.fog,
      marginTop: 3
    }
  }, profile.tagline || "编辑你的面具、昵称与人设")), h(IChevR, {
    size: 16,
    color: t.line
  })), h("button", {
    onClick: () => onOpenMomProfile && onOpenMomProfile("me", true),
    className: "w-full flex items-center gap-4 p-4 mt-3 active:opacity-70",
    style: { background: t.bg, borderRadius: 16, border: `1px solid ${t.line}` }
  }, h("div", {
    className: "flex items-center justify-center shrink-0",
    style: { width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#5a6b8a,#33415c)" }
  }, h(PGlyph, { k: "wechat", size: 22, color: "#fff" })), h("div", {
    className: "flex-1 min-w-0 text-left"
  }, h("div", {
    style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink }
  }, "我的朋友圈"), h("div", {
    style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 2 }
  }, "看我发过的 · 换封面 · 删动态")), h(IChevR, {
    size: 16,
    color: t.line
  })), h("button", {
    onClick: onOpenWallet,
    className: "w-full flex items-center gap-4 p-4 mt-3 active:opacity-70",
    style: { background: t.bg, borderRadius: 16, border: `1px solid ${t.line}` }
  }, h("div", {
    className: "flex items-center justify-center shrink-0",
    style: { width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#2f3a42,#171d21)" }
  }, h(PGlyph, { k: "wallet", size: 22, color: "#fff" })), h("div", {
    className: "flex-1 min-w-0 text-left"
  }, h("div", {
    style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink }
  }, "我的钱包"), h("div", {
    style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 2 }
  }, "余额 ¥" + (walletBalance == null ? 0 : walletBalance) + " · 流水 / 转账 / 亲属卡")), h(IChevR, {
    size: 16,
    color: t.line
  })), h("button", {
    // 我的衣柜：v59.27 曾经在主屏单开一格，她当天就说「删掉独立入口，放微信聊天
    // 『我的』那里吧，刚好人设也是在那里写的」——她的衣服和她的人设是同一类东西，
    // 都该在「我」这一屏里，不该是主屏上一个跟角色 app 并排的格子。
    onClick: onOpenMyCloset,
    className: "w-full flex items-center gap-4 p-4 mt-3 active:opacity-70",
    style: { background: t.bg, borderRadius: 16, border: `1px solid ${t.line}` }
  }, h("div", {
    className: "flex items-center justify-center shrink-0",
    style: { width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#8a7a5c,#5c5040)" }
  }, h(GCarry, { size: 22, color: "#fff" })), h("div", {
    className: "flex-1 min-w-0 text-left"
  }, h("div", {
    style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink }
  }, "我的衣柜"), h("div", {
    style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 2 }
  }, "出图和线下从这里取你穿什么")), h(IChevR, {
    size: 16,
    color: t.line
  })), h("button", {
    onClick: onOpenFavorites,
    className: "w-full flex items-center gap-4 p-4 mt-3 active:opacity-70",
    style: { background: t.bg, borderRadius: 16, border: `1px solid ${t.line}` }
  }, h("div", {
    className: "flex items-center justify-center shrink-0",
    style: { width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#c25a4a,#8a3a30)" }
  }, h("span", { style: { fontSize: 22, color: "#fff" } }, "★")), h("div", {
    className: "flex-1 min-w-0 text-left"
  }, h("div", {
    style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink }
  }, "收藏"), h("div", {
    style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 2 }
  }, "按角色查看收藏的消息")), h(IChevR, {
    size: 16,
    color: t.line
  })))), composeOpen && h(MomentCompose, {
    friendGroups,
    characters,
    onPost: onPostMoment,
    onClose: () => setComposeOpen(false)
  }), groupList && h(Sheet, { onClose: () => setGroupList(false), tall: true },
    h("div", { className: "px-1 pb-2" },
      h("div", { className: "flex items-center justify-between", style: { marginBottom: 12 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink } }, "群聊"),
        h("button", { onClick: () => { setGroupList(false); onNewGroup && onNewGroup(); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.tint } }, "＋ 新建群聊")),
      (groups || []).length === 0
        ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", padding: "40px 0", lineHeight: 1.9 } }, "还没有群聊\n点右上角建一个")
        : (groups || []).map(g => h("button", { key: g.id, onClick: () => { setGroupList(false); onOpenGroup && onOpenGroup(g); },
            className: "w-full flex items-center gap-3 py-2.5 active:opacity-70", style: { borderBottom: "1px solid " + t.line, textAlign: "left" } },
            h("div", { className: "grid grid-cols-2 gap-0.5 p-0.5 shrink-0", style: { width: 40, height: 40, borderRadius: 9, background: t.bg, overflow: "hidden" } },
              (g.memberIds || []).slice(0, 4).map((mid, k) => { const m = (allChars || characters).find(x => x.id === mid);
                return h("div", { key: k, style: { overflow: "hidden", borderRadius: 3 } }, m ? h(Avatar, { character: m, size: 18, radius: 3 }) : null); })),
            h("div", { className: "flex-1 min-w-0" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, g.name),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 1 } }, (g.memberIds || []).length + " 人")),
            h(IChevR, { size: 15, color: t.line })))))
  , groupMgr && h(GroupManager, {
    friendGroups,
    characters,
    onSave: list => {
      onSaveGroups(list);
      setGroupMgr(false);
    },
    onClose: () => setGroupMgr(false)
  }), h("div", {
    className: "shrink-0 flex",
    style: {
      background: t.bg2,
      borderTop: `1px solid ${t.line}`
    }
  }, NAV.map(([k, zh, icon]) => h("button", {
    key: k,
    onClick: () => setTab(k),
    className: "flex-1 flex flex-col items-center gap-1 py-2.5 active:opacity-60"
  }, h(Svg, {
    size: 22,
    color: tab === k ? t.tint : t.fog,
    sw: 1.7
  }, icon), h("span", {
    style: {
      fontFamily: F_BODY,
      fontSize: 10.5,
      color: tab === k ? t.tint : t.fog
    }
  }, zh)))));
}
// 我发朋友圈：正文 + 可选配图(文字描述) + 可见范围
function MomentCompose({
  friendGroups,
  characters,
  onPost,
  onClose
}) {
  const t = useTheme();
  const [text, setText] = useState("");
  const [withImg, setWithImg] = useState(false);
  const [img, setImg] = useState("");
  const [vis, setVis] = useState("all");
  const [sel, setSel] = useState([]);
  const fileRef = useRef(null);
  const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const pickGroup = g => setSel(s => {
    const all = g.memberIds.length && g.memberIds.every(id => s.includes(id));
    return all ? s.filter(id => !g.memberIds.includes(id)) : [...new Set([...s, ...g.memberIds])];
  });
  const post = () => {
    const body = text.trim();
    const image = withImg && img.trim() ? img.trim() : null;
    if (!body && !image) {
      onClose();
      return;
    }
    onPost({
      content: body,
      image,
      visibleTo: vis === "all" ? null : sel
    });
    onClose();
  };
  return h(Sheet, {
    onClose,
    tall: true
  }, h("div", {
    className: "flex items-center justify-between mb-3"
  }, h("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 20,
      color: t.ink
    }
  }, "发朋友圈"), h("button", {
    onClick: post
  }, h(ICheck, {
    size: 19,
    color: t.ink
  }))), h("textarea", {
    value: text,
    onChange: e => setText(e.target.value),
    rows: 4,
    placeholder: "这一刻的想法…",
    className: "w-full outline-none",
    style: {
      fontFamily: F_BODY,
      fontSize: 15,
      lineHeight: 1.6,
      color: t.ink,
      background: "transparent",
      resize: "none"
    }
  }), h("div", {
    className: "flex items-center gap-2 py-3",
    style: {
      borderTop: `1px solid ${t.line}`
    }
  }, h("button", {
    onClick: () => setWithImg(v => !v),
    className: "px-3 py-1.5 flex items-center gap-1.5",
    style: {
      borderRadius: 8,
      border: `1px solid ${withImg ? t.ink : t.line}`,
      fontFamily: F_BODY,
      fontSize: 12,
      color: withImg ? t.ink : t.fog
    }
  }, h(PGlyph, {
    k: "album",
    size: 14,
    color: withImg ? t.ink : t.fog
  }), withImg ? "已配图" : "配图"),
    withImg && h("button", { onClick: () => fileRef.current && fileRef.current.click(), className: "px-3 py-1.5 flex items-center gap-1.5 active:opacity-70", style: { borderRadius: 8, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "📷 从相册选真图"),
    h("input", { ref: fileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; if (f) resizeImageFile(f, 1080, 0.82).then(d => setImg(d)); } })),
    withImg && (String(img).startsWith("data:")
      ? h("div", { className: "mb-2 relative", style: { display: "inline-block" } },
          h("img", { src: img, style: { maxWidth: 140, maxHeight: 140, borderRadius: 10, display: "block" } }),
          h("button", { onClick: () => setImg(""), className: "absolute active:opacity-70", style: { top: -8, right: -8, width: 22, height: 22, borderRadius: 999, background: t.ink, color: "#fff", fontFamily: F_BODY, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" } }, "×"))
      : h("input", {
    value: img,
    onChange: e => setImg(e.target.value),
    placeholder: "描述这张图（点开会看到），或点上面从相册选真图",
    className: "w-full outline-none px-3 py-2 mb-2 rounded-lg",
    style: {
      fontFamily: F_BODY,
      fontSize: 13,
      background: t.bg,
      color: t.ink,
      border: `1px solid ${t.line}`
    }
  })), h(Eyebrow, {
    style: {
      margin: "6px 0 8px"
    }
  }, "谁可以看"), h("div", {
    className: "flex gap-2 mb-3"
  }, [["all", "公开"], ["pick", "部分可见"]].map(([k, l]) => h("button", {
    key: k,
    onClick: () => setVis(k),
    className: "px-4 py-1.5",
    style: {
      borderRadius: 999,
      fontFamily: F_BODY,
      fontSize: 12.5,
      background: vis === k ? t.ink : "transparent",
      color: vis === k ? t.bg2 : t.fog,
      border: `1px solid ${vis === k ? t.ink : t.line}`
    }
  }, l))), vis === "pick" && h("div", null, friendGroups.length > 0 && h("div", {
    className: "flex flex-wrap gap-2 mb-3"
  }, friendGroups.map(g => h("button", {
    key: g.id,
    onClick: () => pickGroup(g),
    className: "px-3 py-1",
    style: {
      borderRadius: 999,
      fontFamily: F_BODY,
      fontSize: 11.5,
      color: t.sub,
      background: t.bg,
      border: `1px solid ${t.line}`
    }
  }, "＋" + g.name))), h("div", {
    className: "max-h-52 overflow-y-auto"
  }, characters.map(c => h("button", {
    key: c.id,
    onClick: () => toggle(c.id),
    className: "w-full flex items-center gap-3 py-2 active:opacity-60"
  }, h(Avatar, {
    character: c,
    size: 32,
    radius: 8
  }), h("span", {
    className: "flex-1 text-left",
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 15,
      color: t.ink
    }
  }, c.remark || c.name), h("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: 999,
      border: `1.5px solid ${sel.includes(c.id) ? t.ink : t.line}`,
      background: sel.includes(c.id) ? t.ink : "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, sel.includes(c.id) && h(ICheck, {
    size: 12,
    color: t.bg2
  })))))));
}
// 好友分组管理
function GroupManager({
  friendGroups,
  characters,
  onSave,
  onClose
}) {
  const t = useTheme();
  const [list, setList] = useState(friendGroups);
  const [name, setName] = useState("");
  const add = () => {
    if (!name.trim()) return;
    setList(l => [...l, {
      id: "fg_" + Date.now(),
      name: name.trim(),
      memberIds: []
    }]);
    setName("");
  };
  const toggle = (gid, cid) => setList(l => l.map(g => g.id === gid ? {
    ...g,
    memberIds: g.memberIds.includes(cid) ? g.memberIds.filter(x => x !== cid) : [...g.memberIds, cid]
  } : g));
  const del = gid => setList(l => l.filter(g => g.id !== gid));
  return h(Sheet, {
    onClose,
    tall: true
  }, h("div", {
    className: "flex items-center justify-between mb-3"
  }, h("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 20,
      color: t.ink
    }
  }, "好友分组"), h("button", {
    onClick: () => onSave(list)
  }, h(ICheck, {
    size: 19,
    color: t.ink
  }))), h("div", {
    className: "flex gap-2 mb-4"
  }, h("input", {
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "新分组名（如 密友、同事）",
    className: "flex-1 outline-none px-3 py-2 rounded-lg",
    style: {
      fontFamily: F_BODY,
      fontSize: 13,
      background: t.bg,
      color: t.ink,
      border: `1px solid ${t.line}`
    }
  }), h("button", {
    onClick: add,
    className: "px-4 rounded-lg",
    style: {
      background: t.ink,
      color: t.bg2,
      fontFamily: F_BODY,
      fontSize: 13
    }
  }, "添加")), list.length === 0 && h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 12.5,
      color: t.fog,
      textAlign: "center",
      padding: "16px 0"
    }
  }, "还没有分组"), list.map(g => h("div", {
    key: g.id,
    className: "mb-4 pb-3",
    style: {
      borderBottom: `1px solid ${t.line}`
    }
  }, h("div", {
    className: "flex items-center justify-between mb-2"
  }, h("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 16,
      color: t.ink
    }
  }, g.name, h("span", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11,
      color: t.fog,
      marginLeft: 8
    }
  }, g.memberIds.length + " 人")), h("button", {
    onClick: () => del(g.id)
  }, h(ITrash, {
    size: 15,
    color: t.fog
  }))), h("div", {
    className: "flex flex-wrap gap-2"
  }, characters.map(c => h("button", {
    key: c.id,
    onClick: () => toggle(g.id, c.id),
    className: "px-2.5 py-1 flex items-center gap-1.5",
    style: {
      borderRadius: 999,
      fontFamily: F_BODY,
      fontSize: 12,
      color: g.memberIds.includes(c.id) ? t.bg2 : t.sub,
      background: g.memberIds.includes(c.id) ? t.ink : t.bg,
      border: `1px solid ${g.memberIds.includes(c.id) ? t.ink : t.line}`
    }
  }, c.remark || c.name))))));
}
function MomentsFeed({
  characters,
  moments,
  profile,
  friendGroups,
  onGen,
  onCompose,
  gen,
  onLike,
  onComment,
  onDelete,
  onOpenProfile
}) {
  const t = useTheme();
  const [pick, setPick] = useState(false);
  const [commenting, setCommenting] = useState(null);
  const [cText, setCText] = useState("");
  const [cReply, setCReply] = useState(null); // 点某条评论=定向回复 TA
  const [imgView, setImgView] = useState(null);
  const [delId, setDelId] = useState(null);
  return /*#__PURE__*/React.createElement("div", {
    className: "pb-8"
  }, delId && h(ConfirmDialog, { title: "删掉这条朋友圈？", body: "删掉后连同点赞评论一起没了。", confirmLabel: "删掉", danger: true, onConfirm: () => { onDelete(delId); setDelId(null); }, onCancel: () => setDelId(null) }), imgView && h(Sheet, {
    onClose: () => setImgView(null),
    tall: true
  }, h(Eyebrow, {
    style: {
      marginBottom: 8
    }
  }, "图片"), isImgRef(imgView) && h("div", null, h("img", { src: resolveImg(imgView), style: { width: "100%", borderRadius: 12, display: "block" } }), h("button", { onClick: () => { window.saveImgOriginal && window.saveImgOriginal(imgView, "小手机原图").then(ok => { if (!ok && typeof toast === "function") toast("这张取不到原图"); }); }, className: "active:opacity-70", style: { marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 10, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY, fontSize: 13 } }, "⬇ 保存原图（无损）")), !isImgRef(imgView) && h("div", {
    style: {
      width: "100%",
      height: 150,
      borderRadius: 12,
      background: "linear-gradient(135deg,#d8d3c8,#b3ada0)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12
    }
  }, h(PGlyph, {
    k: "album",
    size: 30,
    color: "rgba(255,255,255,0.9)"
  })), !isImgRef(imgView) && h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 14,
      lineHeight: 1.8,
      color: t.ink,
      whiteSpace: "pre-wrap"
    }
  }, imgView)), /*#__PURE__*/React.createElement("div", {
    className: "px-5 py-4 flex items-center justify-between",
    style: {
      borderBottom: `1px solid ${t.line}`
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Moments · 朋友圈"), h("div", {
    className: "flex items-center gap-4"
  }, h("button", {
    onClick: onCompose,
    className: "flex items-center gap-1.5",
    style: {
      fontFamily: F_BODY,
      fontSize: 12,
      color: t.ink
    }
  }, h(PGlyph, {
    k: "album",
    size: 14,
    color: t.ink
  }), " 发朋友圈"), h("button", {
    onClick: () => setPick(true),
    className: "flex items-center gap-1.5",
    style: {
      fontFamily: F_BODY,
      fontSize: 12,
      color: t.fog
    }
  }, h(IRefresh, {
    size: 13,
    color: t.fog
  }), " 角色发"))), gen && /*#__PURE__*/React.createElement(Spinner, {
    label: "正在发朋友圈…"
  }), !gen && moments.length === 0 && /*#__PURE__*/React.createElement(Empty, {
    text: "朋友圈还没有动态",
    sub: "点右上「发朋友圈」或「角色发」"
  }), moments.map(m => {
    const isMine = m.mine;
    const c = isMine ? null : characters.find(x => x.id === m.characterId);
    if (!isMine && !c) return null;
    const author = isMine ? {
      name: profile.name || "我",
      avatarImage: profile.avatarImage,
      color: profile.color
    } : c;
    const authorName = isMine ? profile.name || "我" : c.remark || c.name;
    return /*#__PURE__*/React.createElement("div", {
      key: m.id,
      className: "px-5 py-4 flex gap-3",
      style: {
        borderBottom: `1px solid ${t.line}`
      }
    }, (!isMine && c && onOpenProfile) ? h("button", { onClick: () => onOpenProfile(c.id), className: "shrink-0 active:opacity-70" }, h(Avatar, { character: author, size: 40, radius: 9 })) : /*#__PURE__*/React.createElement(Avatar, {
      character: author,
      size: 40,
      radius: 9
    }), /*#__PURE__*/React.createElement("div", {
      className: "flex-1 min-w-0"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: F_DISPLAY,
        fontSize: 15,
        color: t.tint
      }
    }, authorName), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: F_BODY,
        fontSize: 14,
        lineHeight: 1.6,
        color: t.ink,
        marginTop: 3,
        whiteSpace: "pre-wrap"
      }
    }, m.content), m.image && (isImgRef(m.image) ? h("button", {
      onClick: () => setImgView(m.image),
      className: "mt-2.5 block active:opacity-80"
    }, h("img", { src: resolveImg(m.image), style: { maxWidth: 160, maxHeight: 160, borderRadius: 10, display: "block" } })) : h("button", {
      onClick: () => setImgView(m.image),
      className: "mt-2.5 flex items-center gap-2 px-3 py-2.5 active:opacity-70",
      style: {
        background: t.bg,
        borderRadius: 10,
        border: `1px solid ${t.line}`
      }
    }, h("div", {
      style: {
        width: 34,
        height: 34,
        borderRadius: 8,
        flexShrink: 0,
        background: "linear-gradient(135deg,#d8d3c8,#b3ada0)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, h(PGlyph, {
      k: "album",
      size: 16,
      color: "rgba(255,255,255,0.9)"
    })), h("span", {
      className: "truncate",
      style: {
        fontFamily: F_BODY,
        fontSize: 12,
        color: t.fog
      }
    }, "[图片] 点开看描述"))), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-4 mt-2"
    },/*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: F_BODY,
        fontSize: 10.5,
        color: t.fog
      }
    }, timeAgo(m.ts)), /*#__PURE__*/React.createElement("button", {
      onClick: () => onLike(m.id),
      className: "active:opacity-60 flex items-center gap-1"
    }, /*#__PURE__*/React.createElement(IHeart, {
      size: 13,
      color: m.liked ? t.accent : t.fog,
      filled: m.liked
    }), (m.likeCount || 0) > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: F_BODY,
        fontSize: 10.5,
        color: t.fog
      }
    }, m.likeCount)), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setCommenting(m.id);
        setCReply(null);
        setCText("");
      },
      style: {
        fontFamily: F_BODY,
        fontSize: 11,
        color: t.fog
      }
    }, "评论"), onDelete && h("button", {
      onClick: () => setDelId(m.id),
      style: { fontFamily: F_BODY, fontSize: 11, color: t.fog }
    }, "删除")), m.likers && m.likers.length > 0 && h("div", {
      className: "flex items-center gap-1.5 mt-2"
    }, h(IHeart, {
      size: 12,
      color: t.accent,
      filled: true
    }), h("span", {
      style: {
        fontFamily: F_BODY,
        fontSize: 11.5,
        color: t.tint
      }
    }, m.likers.join("、"))), (m.comments || []).length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "mt-2.5 rounded-xl px-3 py-2",
      style: {
        background: t.bg
      }
    }, m.comments.map((cm, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "active:opacity-60",
      onClick: () => { const me = (profile && profile.name) || "我"; if (cm.author && cm.author !== me && cm.author !== "我") { setCommenting(m.id); setCReply(cm.author); setCText(""); } },
      style: {
        fontFamily: F_BODY,
        fontSize: 12.5,
        lineHeight: 1.7
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: t.tint,
        fontWeight: 500
      }
    }, cm.author), /*#__PURE__*/React.createElement("span", {
      style: {
        color: t.sub
      }
    }, "：", cm.text)))), commenting === m.id && /*#__PURE__*/React.createElement("div", {
      className: "mt-2 flex gap-2"
    }, /*#__PURE__*/React.createElement("input", {
      value: cText,
      onChange: e => setCText(e.target.value),
      placeholder: cReply ? "回复 " + cReply + "…" : "说点什么…",
      autoFocus: true,
      className: "flex-1 outline-none px-3 py-1.5 rounded-full",
      style: {
        fontFamily: F_BODY,
        fontSize: 13,
        background: t.bg,
        color: t.ink,
        border: `1px solid ${t.line}`
      }
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        if (cText.trim()) {
          onComment(m.id, cText.trim(), cReply || undefined);
        }
        setCommenting(null);
        setCReply(null);
        setCText("");
      },
      className: "px-3 rounded-full",
      style: {
        background: t.ink,
        color: t.bg2,
        fontFamily: F_BODY,
        fontSize: 12
      }
    }, "发送"))));
  }), pick && /*#__PURE__*/React.createElement(Sheet, {
    onClose: () => setPick(false)
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      marginBottom: 12
    }
  }, "让谁发一条"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-1 max-h-72 overflow-y-auto"
  }, characters.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.id,
    onClick: () => {
      setPick(false);
      onGen(c);
    },
    className: "w-full flex items-center gap-3 py-2.5 active:opacity-60"
  }, /*#__PURE__*/React.createElement(Avatar, {
    character: c,
    size: 34,
    radius: 7
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 16,
      color: t.ink
    }
  }, c.name))))));
}
// 朋友圈个人页（仿微信「我的相册/TA 的朋友圈」）：封面 + 头像 + 签名 + 此人所有动态；me 可发/删/换封面
function MomentsProfile({ isMe, character, profile, characters, moments, cover, gen, friendGroups, signature, onSetCover, onDelMoment, onLikeMoment, onCommentMoment, onPostMoment, onBack }) {
  const t = useTheme();
  const [compose, setCompose] = useState(false);
  const [commenting, setCommenting] = useState(null);
  const [cText, setCText] = useState("");
  const [cReply, setCReply] = useState(null); // 点某条评论=定向回复 TA
  const [imgView, setImgView] = useState(null);
  const [delId, setDelId] = useState(null);
  const coverRef = useRef(null);
  if (!isMe && !character) return null;
  const author = isMe ? { name: profile.name || "我", avatarImage: profile.avatarImage, color: profile.color } : character;
  const name = isMe ? (profile.name || "我") : (character.remark || character.name);
  // 签名：优先用传进来的（角色页=匿名箱生成的 bio 签名），否则回落到 motto/tagline
  const sign = (signature != null && String(signature).trim()) ? signature : (isMe ? (profile.tagline || "") : (character.motto || character.tagline || ""));
  const list = (moments || []).filter(m => isMe ? m.mine : (m.characterId === character.id && !m.mine)).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const pickCover = e => { const f = e.target.files && e.target.files[0]; if (f) resizeImageFile(f, 1400, 0.82).then(d => onSetCover(d)); e.target.value = ""; };
  const sendC = m => { if (cText.trim()) { onCommentMoment(m.id, cText.trim(), cReply || undefined); setCommenting(null); setCReply(null); setCText(""); } };

  const momentRow = m => h("div", { key: m.id, className: "px-5 py-4", style: { borderBottom: "1px solid " + t.line } },
    h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.6, color: t.ink, whiteSpace: "pre-wrap" } }, m.content),
    m.image ? (isImgRef(m.image)
      ? h("button", { onClick: () => setImgView(m.image), className: "mt-2.5 block active:opacity-80" }, h("img", { src: resolveImg(m.image), style: { maxWidth: 160, maxHeight: 160, borderRadius: 10, display: "block" } }))
      : h("button", { onClick: () => setImgView(m.image), className: "mt-2 flex items-center gap-2 px-3 py-2 active:opacity-70", style: { background: t.bg, borderRadius: 10, border: "1px solid " + t.line } }, h(PGlyph, { k: "album", size: 16, color: t.fog }), h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "[图片] 点开看描述"))) : null,
    h("div", { className: "flex items-center gap-4 mt-2" },
      h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, timeAgo(m.ts)),
      h("button", { onClick: () => onLikeMoment(m.id), className: "active:opacity-60 flex items-center gap-1" }, h(IHeart, { size: 13, color: m.liked ? t.accent : t.fog, filled: m.liked }), (m.likeCount || 0) > 0 && h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, m.likeCount)),
      h("button", { onClick: () => { setCommenting(m.id); setCReply(null); setCText(""); }, style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "评论"),
      onDelMoment && h("button", { onClick: () => setDelId(m.id), style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "删除")),
    (m.likers && m.likers.length) ? h("div", { className: "flex items-center gap-1.5 mt-2" }, h(IHeart, { size: 12, color: t.accent, filled: true }), h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, m.likers.join("、"))) : null,
    (m.comments && m.comments.length) ? h("div", { className: "mt-2.5 rounded-xl px-3 py-2", style: { background: t.bg } }, m.comments.map((cm, i) => h("div", { key: i, className: "active:opacity-60", onClick: () => { const me = (profile && profile.name) || "我"; if (cm.author && cm.author !== me && cm.author !== "我") { setCommenting(m.id); setCReply(cm.author); setCText(""); } }, style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7 } }, h("span", { style: { color: t.tint, fontWeight: 500 } }, cm.author), h("span", { style: { color: t.ink } }, "：", cm.text)))) : null,
    commenting === m.id ? h("div", { className: "flex gap-2 mt-2" },
      h("input", { value: cText, onChange: e => setCText(e.target.value), autoFocus: true, placeholder: cReply ? "回复 " + cReply + "…" : "评论…", onKeyDown: e => { if (e.key === "Enter") sendC(m); }, className: "flex-1 outline-none px-3 py-1.5 rounded-full", style: { fontFamily: F_BODY, fontSize: 13, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
      h("button", { onClick: () => sendC(m), className: "px-3 rounded-full", style: { background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12 } }, "发")) : null);

  return h("div", { className: "h-full flex flex-col" },
    h("div", { style: { position: "relative", height: 210, flexShrink: 0, background: cover ? ("center/cover no-repeat url(\"" + resolveImg(cover) + "\")") : "linear-gradient(135deg,#8a8577,#5f5b50)" } },
      h("button", { onClick: onBack, className: "active:opacity-60", style: { position: "absolute", top: "calc(env(safe-area-inset-top) + 10px)", left: 14, width: 34, height: 34, borderRadius: 999, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center" } }, h(IArrow, { size: 19, color: "#fff" })),
      h("button", { onClick: () => coverRef.current && coverRef.current.click(), className: "active:opacity-70", style: { position: "absolute", top: "calc(env(safe-area-inset-top) + 12px)", right: 14, padding: "6px 12px", borderRadius: 999, background: "rgba(0,0,0,0.32)", fontFamily: F_BODY, fontSize: 11.5, color: "#fff" } }, cover ? "换封面" : "设封面"),
      h("input", { ref: coverRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: pickCover }),
      h("div", { style: { position: "absolute", right: 16, bottom: -30, display: "flex", alignItems: "flex-start", gap: 12 } },
        h("div", { style: { textAlign: "right", maxWidth: 190, paddingTop: 2 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, lineHeight: 1, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.55)" } }, name)),
        h(Avatar, { character: author, size: 64, radius: 14 }))),
    h("div", { className: "flex-1 overflow-y-auto", style: { paddingTop: 44 } },
      // 签名放头像下面（头像悬在封面下缘，签名落在内容区右侧、深色）
      sign && h("div", { style: { textAlign: "right", padding: "0 18px", marginBottom: 6 } },
        h("span", { style: { fontFamily: F_BODY, fontSize: 12, fontStyle: "italic", color: t.sub, lineHeight: 1.5 } }, "“" + sign + "”")),
      isMe && h("div", { className: "px-5 pb-1 flex justify-end" }, h("button", { onClick: () => setCompose(true), className: "flex items-center gap-1.5 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink } }, h(PGlyph, { k: "album", size: 14, color: t.ink }), " 发一条")),
      gen && h(Spinner, { label: "正在发朋友圈…" }),
      list.length === 0 && !gen && h(Empty, { text: isMe ? "你还没发过朋友圈" : name + " 还没有朋友圈", sub: isMe ? "点右上「发一条」" : "" }),
      list.map(momentRow)),
    delId && h(ConfirmDialog, { title: "删掉这条朋友圈？", body: "删掉后连同点赞评论一起没了。", confirmLabel: "删掉", danger: true, onConfirm: () => { onDelMoment(delId); setDelId(null); }, onCancel: () => setDelId(null) }),
    imgView && h(Sheet, { onClose: () => setImgView(null), tall: true }, h(Eyebrow, { style: { marginBottom: 8 } }, "图片"), isImgRef(imgView) ? h("div", null, h("img", { src: resolveImg(imgView), style: { width: "100%", borderRadius: 12, display: "block" } }), h("button", { onClick: () => { window.saveImgOriginal && window.saveImgOriginal(imgView, "小手机原图").then(ok => { if (!ok && typeof toast === "function") toast("这张取不到原图"); }); }, className: "active:opacity-70", style: { marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 10, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY, fontSize: 13 } }, "⬇ 保存原图（无损）")) : h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.8, color: t.ink, whiteSpace: "pre-wrap" } }, imgView)),
    compose && h(MomentCompose, { friendGroups, characters, onPost: payload => { onPostMoment(payload); setCompose(false); }, onClose: () => setCompose(false) }));
}

function VoiceEarComposer({ onSend, onClose, senderName, ownerKey, toast }) {
  const t = useTheme();
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(0);
  const [speechNote, setSpeechNote] = useState("");
  const [capture, setCapture] = useState(null);
  const [info, setInfo] = useState(() => window.Ears ? window.Ears.profileInfo(ownerKey) : { count: 0, ready: false, target: 8 });
  const sessionRef = useRef(null);

  useEffect(() => () => {
    if (sessionRef.current) sessionRef.current.cancel().catch(() => {});
    sessionRef.current = null;
  }, []);

  const begin = async () => {
    if (!window.Ears) { toast && toast("声音分析模块没加载出来，刷新页面再试"); return; }
    if (!window.isSecureContext) {
      toast && toast("麦克风需要安全连接（https 或本机预览）");
      return;
    }
    setBusy(true); setSpeechNote(""); setCapture(null);
    try {
      sessionRef.current = await window.Ears.start({
        lang: "zh-CN",
        ownerKey,
        onLevel: setLevel,
        onTranscript: setText,
        onSpeechError: () => setSpeechNote("自动听写没接上，可以停下后自己改文字")
      });
      setRecording(true);
    } catch (e) {
      toast && toast((e && e.message) || "没能打开麦克风");
    } finally { setBusy(false); }
  };
  const finish = async () => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null; setBusy(true); setRecording(false); setLevel(0);
    try {
      const result = await session.stop();
      if (result) {
        setCapture(result);
        if (result.transcript) setText(result.transcript);
        setInfo(window.Ears.profileInfo(ownerKey));
        if (!result.valid) setSpeechNote("这段太轻或几乎都是静音，没有拿来学习你的声音");
      }
    } catch (e) { toast && toast((e && e.message) || "这段录音没分析成功"); }
    finally { setBusy(false); }
  };
  const send = () => {
    const v = text.trim();
    if (!v) { toast && toast("先说点什么，或者手动补上文字"); return; }
    const dur = capture ? Math.max(1, Math.min(60, Math.round(capture.duration))) : Math.max(1, Math.min(60, Math.round(v.replace(/\s/g, "").length / 3)));
    onSend({ role: "user", ...(senderName ? { senderName } : {}), kind: "voice", content: v, dur, ...(capture && capture.tone ? { voiceTone: capture.tone } : {}) });
    onClose();
  };
  const progress = Math.min(info.count, info.target) + "/" + info.target;
  return h(React.Fragment, null,
    h(Eyebrow, { style: { marginBottom: 8 } }, "让 TA 听见你怎么说"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 10, lineHeight: 1.6 } },
      "声音在这台设备上分析，录音不会保存。自动听写可能经过浏览器或系统服务；文字可在发送前修改。"),
    h("button", { onClick: recording ? finish : begin, disabled: busy, className: "w-full py-3 active:opacity-70 disabled:opacity-50", style: { borderRadius: 12, background: recording ? "#9f5149" : t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 14 } },
      busy ? "请稍等…" : recording ? "■ 停下并分析" : "● 按下开始说"),
    recording && h("div", { style: { height: 5, borderRadius: 9, background: t.line, marginTop: 8, overflow: "hidden" } },
      h("div", { style: { width: Math.max(4, level * 100) + "%", height: "100%", background: t.tint, transition: "width .1s" } })),
    h("textarea", { value: text, onChange: e => setText(e.target.value), rows: 3, placeholder: "听写会出现在这里，也可以自己输入或修改…", className: "w-full outline-none p-3 rounded-lg", style: { marginTop: 10, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, color: t.ink, background: t.bg2, border: "1px solid " + t.line, resize: "none" } }),
    speechNote && h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#9f5149", marginTop: 6 } }, speechNote),
    capture && capture.tone && h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, background: t.bg, borderRadius: 9, padding: "8px 10px", marginTop: 8, lineHeight: 1.6 } },
      capture.tone.baselineReady
        ? (capture.tone.observations.length ? "这条听起来：" + capture.tone.observations.join("、") : "这条和你平时的声音接近")
        : "正在认识你的声音（" + progress + "）；满 8 条后才做相对比较"),
    h("div", { className: "flex items-center justify-between", style: { marginTop: 9 } },
      h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, info.ready ? "个人声音基线 · 本机 " + info.count + " 条" : "个人声音基线 · " + progress),
      h("div", { className: "flex gap-3" },
        info.count > 0 && h("button", { onClick: () => { setInfo(window.Ears.forgetLast(ownerKey)); setCapture(null); toast && toast("已忘掉最近一次声音样本"); }, style: { fontFamily: F_BODY, fontSize: 10.5, color: t.sub } }, "撤回上次"),
        info.count > 0 && h("button", { onClick: () => requestAppConfirm("重建声音基线？", "只会清掉本机保存的声学数字，不会删聊天。", () => { setInfo(window.Ears.resetProfile(ownerKey)); setCapture(null); toast && toast("声音基线已重建"); }, "重建"), style: { fontFamily: F_BODY, fontSize: 10.5, color: "#9f5149" } }, "重建基线"))),
    h("button", { onClick: send, disabled: recording || busy || !text.trim(), className: "w-full mt-3 py-2.5 active:opacity-70 disabled:opacity-40", style: { borderRadius: 8, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13 } }, capture ? "带着这条语气发送" : "按文字发送成语音")
  );
}

// ---- chat thread (single) ----
// 线下经过卡：默认显示短总结（当分隔），点「看完整经过」展开逐条 transcript。
// 澄清她的疑问：卡片短≠细节丢——喂给模型的一直是完整 transcript（app.js 注入），这里只是让她也能翻看。
function OfflineLogCard({ m, t, sel }) {
  const [open, setOpen] = useState(false);
  return h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: t.sub, background: t.bg2, border: "1px dashed " + t.line, borderRadius: 12, padding: "10px 13px", whiteSpace: "pre-wrap", outline: sel ? `2px solid ${t.tint}` : "none", outlineOffset: 2 } },
    h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: "0.18em", color: t.fog, marginBottom: 5 } }, "线下经过 · OFFLINE"),
    m.content,
    m.transcript ? h("button", { onClick: e => { e.stopPropagation(); setOpen(o => !o); }, className: "active:opacity-60", style: { display: "block", marginTop: 8, fontFamily: F_BODY, fontSize: 11, color: t.tint } }, open ? "▾ 收起完整经过" : "▸ 看完整经过（" + Math.round(String(m.transcript).length / 100) / 10 + "k 字）") : null,
    (open && m.transcript) ? h("div", { style: { marginTop: 8, paddingTop: 8, borderTop: "1px dashed " + t.line, fontSize: 12, color: t.fog, whiteSpace: "pre-wrap", lineHeight: 1.75 } }, m.transcript) : null);
}
function ChatThread({
  character,
  characters,
  groups,
  messages,
  sending,
  onBack,
  onSend,
  onOpenState,
  schedNow,
  onOpenSched,
  onLongPress,
  onOpenSettings,
  room,
  onOpenRooms,
  onRecall,
  onReroll,
  onReply,
  onForward,
  onDeleteMessages,
  onSendRich,
  onPat,
  onStartCall,
  onCallBack,
  onAskCouple,
  askingCouple,
  onAcceptListen,
  onOpenStudyInvite,
  onSendTransfer,
  onRespondTransfer,
  onOpenMoments,
  onOffline,
  onOOC,
  block,
  onSendUnblockReq,
  onRespondUnblock,
  profile,
  disp,
  myBalance,
  emotes,
  onManageEmotes,
  archCount,
  onLoadOlder,
  toast
}) {
  const t = useTheme();
  const bk = block || {};
  const dsp = disp || {};
  const [recallView, setRecallView] = useState(null);
  const [fwdView, setFwdView] = useState(null);   // 点开的转发聊天记录卡
  const [archView, setArchView] = useState(null); // null | "loading" | [归档消息数组]
  const meAv = { name: (profile && profile.name) || "我", color: (profile && profile.color) || t.tint, avatarImage: profile && profile.avatarImage };
  const fmtT = ts => { const d = new Date(ts || Date.now()); const p = n => String(n).padStart(2, "0"); return p(d.getHours()) + ":" + p(d.getMinutes()) + (dsp.timeSec ? ":" + p(d.getSeconds()) : ""); };
  const subLine = m => { const parts = []; if (m.crossSource === "cc") parts.push("来自 CC"); else if (m.crossSource === "stackchan") parts.push("来自 Stack-chan"); if (dsp.read) parts.push(m.role === "user" ? (m.read ? "已读" : "已送达") : "已读"); if (dsp.time) parts.push(fmtT(m.ts)); return parts.join(" "); };
  const [input, setInput] = useState("");
  const [chatMode, setChatMode] = useState("chat"); // chat | narr | ooc
  const [quoted, setQuoted] = useState(null); // { id, text, senderId, senderName }；旧字符串仍兼容
  const [unblockDraft, setUnblockDraft] = useState(null); // 点感叹号后的「求解除」草稿框：null=没开
  const [menu, setMenu] = useState(null);
  const [selMode, setSelMode] = useState(false);
  const [selIds, setSelIds] = useState([]);
  const [fwdPick, setFwdPick] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [specialKind, setSpecialKind] = useState(null); // photo
  const [specialText, setSpecialText] = useState("");
  const [specialImg, setSpecialImg] = useState("");
  const [photoSendMode, setPhotoSendMode] = useState("real"); // real | describe
  const photoFileRef = useRef(null);
  const [descView, setDescView] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [geoOpen, setGeoOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [voiceMsgOpen, setVoiceMsgOpen] = useState(false);
  const [callLogOpen, setCallLogOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  const ref = useRef(null);
  const inited = useRef(false); // 首次进入聊天：瞬间落底，不用 smooth（否则从顶部慢慢滚像跳到很上面）
  const pressTimer = useRef(null);
  const cName = character.remark || character.name;
  // 「念出来」(v60.25 她要的「气泡转语音」)：不是语音条也能听。
  // 门槛跟语音条那一条完全一样——配了 TTS + 这个角色选了音色，而且只有他说的话才有嗓子；
  // 她自己那句没有音色，菜单里就不该出现这一项。
  const tp = useTtsPlayer();
  const speakerOf = m => (m && m.role === "user") ? null : character;
  const canSpeakMsg = m => {
    const spk = speakerOf(m);
    return !!(m && m.content && spk && spk.voiceId && typeof ttsReady === "function" && ttsReady());
  };
  const speakMsg = (i, m) => {
    const spk = speakerOf(m);
    if (!spk || !spk.voiceId) return;
    tp.toggle("say" + i, String(m.content || ""), spk.voiceId);
  };
  // 气泡上那颗播放键：跟长按菜单里的「念出来」同一个门槛、同一个动作，
  // 只是常驻在那儿——她不用每次长按，而且实心/空心一眼看得出这一句花没花过钱。
  // 气泡底下那一行：「听一下」和「已读 20:19」并排。
  // 原来那颗圆钮是【气泡的兄弟】，自己占一格、把整行撑宽（她 2026-09-02：「放的略丑」）；
  // 现在它是【这条消息的页脚】的一项——本来就是同一档信息，字号字色也跟着它。
  const sayDot = (i, m) => {
    if (!canSpeakMsg(m)) return null;
    const k = m && m.kind;
    if (k && k !== "photo" && k !== "location") return null;   // 语音条自己气泡上已经有一个
    const spk = speakerOf(m);
    const on = tp.play && tp.play.k === "say" + i;
    return h(TtsBubbleDot, { key: "d", text: String(m.content || ""), voiceId: spk.voiceId,
      st: on ? tp.play.st : "idle", onTap: () => speakMsg(i, m) });
  };
  const msgFoot = (i, m, sub) => {
    const dot = sayDot(i, m);
    if (!dot && !sub) return null;
    return h("span", { className: "flex items-center", style: { gap: 7, marginTop: 2, fontFamily: F_BODY, fontSize: 9.5, color: t.fog } },
      dot, sub ? h("span", null, sub) : null);
  };
  // 「你之前发过」:从这个聊天里自己发过的位置卡去重,最近的在前
  const geoRecent = React.useMemo(() => {
    const out = [];
    (messages || []).forEach(x => {
      if (x && x.kind === "geo" && x.role === "user" && x.name && out.indexOf(x.name) < 0) out.unshift(x.name);
    });
    return out.slice(0, 5);
  }, [messages]);
  const PANEL = [["location", "位置", "pin"], ["sticker", "表情包", "sticker"], ["photo", "照片", "picture"], ["voicemsg", "发语音", "wave"], ["voice", "语音通话", "handset"], ["video", "视频通话", "camcorder"], ["calllog", "通话记录", "clock"], ["chatsearch", "查找记录", "magnifier"], ["moments", "朋友圈", "grid"], ["transfer", "转账", "bill"], ["pat", "拍一拍", "hand"]].filter(([key]) => room && !room.main ? !["moments", "transfer"].includes(key) : true);
  const sendRich = msg => {
    onSendRich({
      ts: Date.now(),
      read: false,
      ...msg
    });
    setPanelOpen(false);
  };
  const onPanelTap = k => {
    if (k === "location") {
      setGeoOpen(true);
      setPanelOpen(false);
    } else if (k === "photo") {
      setSpecialKind(k);
      setSpecialText("");
      setSpecialImg("");
      setPhotoSendMode("real");
      setPanelOpen(false);
    } else if (k === "pat") {
      // 拍一拍：交给 app 侧 onPat（追加消息 + 触发角色真反应）；没接就退回只显示一行
      setPanelOpen(false);
      if (onPat) onPat();
      else sendRich({ role: "user", kind: "pat", content: "你拍了拍 " + cName + (character.patSig ? " " + character.patSig : "") });
    } else if (k === "voice" || k === "video") {
      setPanelOpen(false);
      onStartCall && onStartCall(k);
    } else if (k === "voicemsg") {
      setPanelOpen(false);
      setVoiceMsgOpen(true);
    } else if (k === "calllog") {
      setPanelOpen(false);
      setCallLogOpen(true);
    } else if (k === "chatsearch") {
      setPanelOpen(false);
      setSearchOpen(true);
    } else if (k === "transfer") {
      setTransferOpen(true);
      setPanelOpen(false);
    } else if (k === "moments") {
      setPanelOpen(false);
      onOpenMoments && onOpenMoments();
    } else if (k === "sticker") {
      setPanelOpen(false);
      setStickerOpen(true);
    } else {
      toast && toast("该功能即将上线");
    }
  };
  const onModeTap = mk => {
    setPanelOpen(false);
    if (mk === "offline") {
      onOffline && onOffline();
    } else {
      setChatMode(mk);
    }
  };
  const submitSpecial = async () => {
    const v = specialText.trim();
    if (specialKind === "photo" && photoSendMode === "real" && !specialImg) {
      toast && toast("先从相册选一张，或直接拍一张");
      return;
    }
    if (specialKind === "photo" && photoSendMode === "describe" && !v) {
      toast && toast("写一句照片里有什么，角色才看得见");
      return;
    }
    if (specialKind !== "photo" && !v) {
      setSpecialKind(null);
      return;
    }
    if (specialKind === "location") sendRich({
      role: "user",
      kind: "location",
      place: v,
      content: "[位置] " + v
    });else if (specialKind === "photo" && photoSendMode === "describe") {
      sendRich({ role: "user", kind: "photo", desc: v, photoMode: "describe", content: "[照片] " + v });
    }else if (specialKind === "photo") {
      let imageRef = specialImg;
      try { if (typeof imgToVault === "function") imageRef = await imgToVault(specialImg); } catch (e) {}
      await rememberRealPhoto(imageRef, v, "private-chat");
      sendRich({ role: "user", kind: "photo", imageRef, desc: v, photoMode: "real", content: v ? "[照片] " + v : "[照片]" });
    }
    setSpecialImg("");
    setSpecialKind(null);
  };
  const toggleSel = i => setSelIds(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i]);
  const exitSel = () => {
    setSelMode(false);
    setSelIds([]);
    setFwdPick(false);
  };
  const doDelete = () => {
    if (selIds.length) onDeleteMessages(selIds);
    exitSel();
  };
  const doForward = destination => {
    const picked = selIds.slice().sort((a, b) => a - b).map(i => messages[i]).filter(Boolean);
    if (picked.length) onForward(picked, destination);
    exitSel();
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!inited.current) {
      inited.current = true;
      return pinToBottom(el); // 首次进入：钉到底，直到图片/字体都加载完或她自己上翻
    }
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);
  // 送信：对话=入队消息；旁白注入=注入一段旁白；OOC=直接问模型
  const send = () => {
    if (!input.trim() || sending) return;
    const v = input.trim();
    setInput("");
    if (chatMode === "narr") sendRich({
      role: "narration",
      kind: "narration",
      content: v,
      read: true
    });else if (chatMode === "ooc") onOOC && onOOC(v);
    else if (quoted) { sendRich({ role: "user", content: v, replyTo: quoted, read: true }); setQuoted(null); }
    else onSend(v);
  };
  // 让 TA 回复：对话/旁白模式都触发一次生成；旁白模式先把输入当旁白注入
  const reply = () => {
    if (sending) return;
    const pending = input.trim();
    setInput("");
    if (chatMode === "narr") {
      if (pending) sendRich({
        role: "narration",
        kind: "narration",
        content: pending,
        read: true
      });
      onReply("");
    } else onReply(pending);
  };
  const startPress = idx => {
    pressTimer.current = setTimeout(() => setMenu(idx), 450);
  };
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "h-full flex flex-col",
    style: dsp.chatBg ? {
      backgroundImage: "url(\"" + resolveImg(dsp.chatBg) + "\")",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    } : {
      background: BUBBLE_SKIN.chatBg || t.bg // 皮肤的全局聊天背景；单聊自己设过图的优先
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "shrink-0 px-4 pb-3 flex items-center gap-3",
    style: {
      paddingTop: safeTop(20),
      background: dsp.chatBg ? "rgba(255,255,255,0.55)" : t.bg2,
      backdropFilter: dsp.chatBg ? "blur(8px)" : "none",
      WebkitBackdropFilter: dsp.chatBg ? "blur(8px)" : "none",
      borderBottom: `1px solid ${t.line}`
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    className: "active:opacity-50"
  }, /*#__PURE__*/React.createElement(IArrow, {
    size: 19,
    color: t.ink
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setModeOpen(true),
    className: "flex items-center gap-2.5 flex-1 active:opacity-70"
  }, /*#__PURE__*/React.createElement(Avatar, {
    character: character,
    size: 36,
    radius: 9
  }), /*#__PURE__*/React.createElement("div", {
    className: "text-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1",
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 16,
      color: t.ink
    }
  }, character.remark || character.name, h(IChevD, {
    size: 13,
    color: t.fog
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Archivo',sans-serif",
      fontSize: 9.5,
      letterSpacing: "0.08em",
      color: chatMode === "chat" ? t.fog : t.accent
    }
  }, (chatMode === "narr" ? "旁白注入" : chatMode === "ooc" ? "OOC 指令" : "对话") + " · 轻触切换"))), /*#__PURE__*/React.createElement("button", {
    onClick: onOpenSettings,
    className: "active:opacity-50"
  }, /*#__PURE__*/React.createElement(IDots, {
    size: 20,
    color: t.ink
  }))),
  room && !room.main && h("button", {
    onClick: onOpenRooms,
    className: "shrink-0 w-full flex items-center",
    style: { padding: "7px 16px", gap: 8, background: dsp.chatBg ? "rgba(255,255,255,0.45)" : t.bg2, borderBottom: "1px solid " + t.line }
  },
    h("span", { style: { width: 7, height: 7, borderRadius: 99, background: room.main ? t.fog : t.tint } }),
    h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink } }, room.name),
    !room.main && h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, room.scenario ? "长篇如果" : room.syncMode === "follow" ? "跟随主线" : room.syncMode === "ask" ? "按需补近况" : "独立时间线"),
    h("span", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 10, color: t.fog } }, "换房 ›")
  ),
  // 此刻日程条：联动今日行程，显示 TA 此刻在做什么/在哪，点一下进 TA 的完整行程
  (!room || room.main || !!(room.cognition && room.cognition.schedule)) && schedNow && h("button", {
    onClick: onOpenSched,
    className: "shrink-0 w-full flex items-center gap-2 active:opacity-70",
    style: { background: schedNow.dev ? "rgba(194,90,74,0.08)" : (dsp.chatBg ? "rgba(255,255,255,0.45)" : t.bg), borderBottom: "1px solid " + t.line, padding: "6px 16px" }
  },
    h("span", { style: { width: 6, height: 6, borderRadius: 999, background: schedNow.dev ? t.accent : t.tint, flexShrink: 0 } }),
    h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: "0.12em", color: t.fog, flexShrink: 0 } }, "NOW"),
    schedNow.time && h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, color: t.fog, flexShrink: 0 } }, schedNow.time),
    h(Marquee, { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 12, color: t.ink } }, schedNow.title + (schedNow.location ? " · " + schedNow.location : "")),
    schedNow.dev && h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.accent, flexShrink: 0 } }, "改"),
    h(IChevR, { size: 13, color: t.fog, style: { marginLeft: "auto", flexShrink: 0 } })),
  unblockDraft !== null && h("div", {
    style: { flexShrink: 0, background: t.bg2, borderBottom: "1px solid " + t.line, padding: "10px 14px" }
  },
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 6, lineHeight: 1.6 } },
      "跟 TA 说点什么。说到 TA 当初生气的那件事上，比笼统道歉管用得多。"),
    h("textarea", {
      value: unblockDraft, autoFocus: true, rows: 3,
      onChange: e => setUnblockDraft(e.target.value),
      placeholder: "写你想说的话…",
      style: { width: "100%", background: t.bg, border: "1px solid " + t.line, borderRadius: 10, padding: "9px 11px", fontFamily: F_BODY, fontSize: 13.5, color: t.ink, lineHeight: 1.7, outline: "none", resize: "none" }
    }),
    h("div", { style: { display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" } },
      h("button", { onClick: () => setUnblockDraft(null), style: { padding: "7px 14px", borderRadius: 999, border: "1px solid " + t.line, background: "none", fontFamily: F_BODY, fontSize: 12.5, color: t.sub } }, "取消"),
      h("button", {
        onClick: () => { const txt = String(unblockDraft || "").trim(); if (!txt) return; setUnblockDraft(null); onSendUnblockReq(txt); },
        style: { padding: "7px 16px", borderRadius: 999, border: "none", background: t.accent, fontFamily: F_BODY, fontSize: 12.5, color: "#fff", opacity: String(unblockDraft || "").trim() ? 1 : .45 }
      }, "发给 TA"))),
  (bk.iBlocked || bk.theyBlocked) && h("div", {
    style: { flexShrink: 0, background: "rgba(194,90,74,0.1)", borderBottom: "1px solid " + t.line, padding: "7px 16px", fontFamily: F_BODY, fontSize: 11.5, color: t.accent, textAlign: "center", lineHeight: 1.5 }
  }, bk.theyBlocked ? "TA 拉黑了你 · 你的消息 TA 看不到；点消息旁的 ! 写一句话求 TA" : "你已拉黑 TA · 按「回复」看 TA 的反应；到设置里可解除"), /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: { overflowX: "hidden", touchAction: "pan-y pinch-zoom" },
    className: "flex-1 overflow-y-auto px-4 py-4 space-y-1"
  }, archCount > 0 ? h("button", {
    onClick: async () => { if (archView === "loading") return; setArchView("loading"); const arr = onLoadOlder ? await onLoadOlder(character.id) : null; setArchView(Array.isArray(arr) ? arr : []); },
    className: "w-full active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12, color: t.tint, padding: "6px 0", marginBottom: 4 }
  }, archView === "loading" ? "加载中…" : ("☁ 更早的 " + archCount + " 条聊天在云端 · 点开查看")) : null,
  messages.length === 0 && /*#__PURE__*/React.createElement(Empty, {
    text: "和 " + character.name + " 的对话由此开始"
  }), messages.flatMap((m, i) => {
    // 账本回流（CC/Stack-chan）的一行可能是逐字摘录的长段落：显示时按空行拆成多个气泡，数据不动
    if (m && m.ledgerImported && !m.recalled && !m.kind && typeof m.content === "string" && /\n\s*\n/.test(m.content)) {
      const parts = m.content.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
      if (parts.length > 1) return [...((m.reasoning || (m.searched || []).length || (m.usedTools || []).length) ? [{ m, i, part: -1, last: false }] : []),
        ...parts.map((p, k) => ({ m: { ...m, content: p }, i, part: k, last: k === parts.length - 1 }))];
    }
    return (m.reasoning || (m.searched || []).length || (m.usedTools || []).length) ? [{ m, i, part: -1, last: false }, { m, i, part: 0, last: true }] : [{ m, i, part: 0, last: true }];
  }).map(({ m, i, part, last }) => {
    // 思考链画在这一组回复的上方（part:-1 是插进来的伪条目，不是真气泡）
    if (part === -1) return h(ReasoningBlock, { key: "rz" + i, m: m });
    if (m.recalled) return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "text-center py-1.5"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: F_BODY,
        fontSize: 11,
        color: t.fog
      }
    }, m.role === "user" ? "你" : character.name, "撤回了一条消息"));
    if (m.kind === "pat") return h("div", {
      key: i,
      className: "text-center py-1.5"
    }, h("span", {
      style: {
        fontFamily: F_BODY,
        fontSize: 11.5,
        color: t.fog
      }
    }, m.content));
    if (m.kind === "narration" || m.role === "narration") return h("div", {
      key: i,
      className: "flex items-start justify-center gap-2 my-3 px-6"
    }, h("span", {
      style: {
        fontFamily: F_BODY,
        fontSize: 12.5,
        fontStyle: "italic",
        lineHeight: 1.7,
        color: t.fog
      }
    }, m.content), onDeleteMessages ? h("button", {
      onClick: () => requestAppConfirm("删除这条旁白记录？", "删除后不能恢复。", () => onDeleteMessages([i]), "删除"),
      className: "active:opacity-50 shrink-0",
      style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, opacity: 0.6, padding: "1px 2px" },
      title: "删除旁白"
    }, "✕") : null);
    if (m.kind === "ooc") return h("div", {
      key: i,
      className: "flex justify-end my-2 items-start gap-1.5"
    }, onDeleteMessages ? h("button", {
      onClick: e => { e.preventDefault(); e.stopPropagation(); onDeleteMessages([i]); },
      className: "active:opacity-50 shrink-0",
      style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, opacity: 0.55, padding: "4px 4px 0 0", order: -1 }
    }, "✕") : null, h("div", {
      className: "px-3 py-1.5",
      style: {
        fontFamily: F_BODY,
        fontSize: 12.5,
        lineHeight: 1.5,
        color: t.fog,
        background: t.bg,
        border: `1px dashed ${t.line}`,
        borderRadius: 10,
        maxWidth: "78%"
      }
    }, "OOC · " + m.content));
    if (m.kind === "callend") return h(CallEndPill, { key: i, m, chars: [character] });
    if (m.kind === "offlinelog") return h("div", {
      key: i,
      onTouchStart: selMode ? undefined : () => startPress(i), onTouchEnd: endPress,
      onMouseDown: selMode ? undefined : () => startPress(i), onMouseUp: endPress, onMouseLeave: endPress,
      onClick: selMode ? () => toggleSel(i) : undefined,
      className: "my-4 mx-6"
    }, h(OfflineLogCard, { m: m, t: t, sel: selMode && selIds.includes(i) }));
    if (m.kind === "system") return h("div", {
      key: i,
      className: "text-center my-4 px-6"
    }, h("div", {
      style: {
        fontFamily: F_BODY,
        fontSize: 13.5,
        fontStyle: "italic",
        lineHeight: 1.75,
        color: t.accent,
        whiteSpace: "pre-wrap"
      }
    }, m.content), h("div", {
      style: {
        fontFamily: "'Archivo',sans-serif",
        fontSize: 9,
        letterSpacing: "0.18em",
        color: t.accent,
        opacity: 0.7,
        marginTop: 6
      }
    }, "SYSTEM RESPONSE",
      // OOC 回复（system 形态·turnId ooc_ 开头）也给删除口（和 OOC 提问一起清干净）
      (onDeleteMessages && isOocRecord(m)) ? h("button", {
        onClick: e => { e.preventDefault(); e.stopPropagation(); onDeleteMessages([i]); },
        className: "active:opacity-50",
        style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginLeft: 10, letterSpacing: 0 }
      }, "✕ 删除") : null));
    if (m.kind === "transfer") return h("div", {
      key: i,
      onTouchStart: selMode ? undefined : () => startPress(i), onTouchEnd: endPress,
      onMouseDown: selMode ? undefined : () => startPress(i), onMouseUp: endPress, onMouseLeave: endPress,
      onClick: selMode ? () => toggleSel(i) : undefined,
      className: "flex " + (m.role === "user" ? "justify-end" : "justify-start"),
      style: { outline: selMode && selIds.includes(i) ? `2px solid ${t.tint}` : "none", outlineOffset: 2, borderRadius: 14 }
    }, h(TransferCard, {
      m: m, isU: m.role === "user", onRespond: onRespondTransfer,
      avatar: h(Avatar, { character: character, size: 40, radius: 10 }),
      myAvatar: dsp.myAvatar && h(Avatar, { character: meAv, size: 40, radius: 10 })
    }));
    if (m.kind === "geo") return h(GeoCard, {
      key: i,
      m: m,
      isU: m.role === "user",
      who: cName,
      avatar: h(Avatar, { character: character, size: 40, radius: 10 }),
      myAvatar: dsp.myAvatar && h(Avatar, { character: meAv, size: 40, radius: 10 })
    });
    if (m.kind === "gift") return h(GiftCard, { key: i, m: m, isU: m.role === "user", now: now,
      avatar: h(Avatar, { character: character, size: 40, radius: 10 }),
      myAvatar: dsp.myAvatar && h(Avatar, { character: meAv, size: 40, radius: 10 }) });
    if (m.kind === "kinship") return h(KinshipIssueCard, { key: i, m: m, character: character });
    if (m.kind === "paylater") return h(PayLaterCard, { key: i, m: m });
    if (m.kind === "couple_invite") return h("div", { key: i, className: "py-1 flex items-start gap-2 justify-end" },
      h(CoupleInviteCard, { m: m, character: character, asking: askingCouple === m.cid, onAsk: onAskCouple }),
      dsp.myAvatar && h(Avatar, { character: meAv, size: 40, radius: 10 }));
    if (m.kind === "unblock_req") return h(UnblockReqCard, { key: i, m: m, character: character, onRespond: onRespondUnblock });
    if (m.kind === "recalled") return h("div", { key: i, className: "text-center my-2" }, h("button", { onClick: () => setRecallView(m), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, cName + " 撤回了一条消息 · 点看"));
    // 沉默权：TA 看了没回——一行居中灰斜体，已读不回本身就是态度
    if (m.kind === "silence") return h("div", { key: i, className: "text-center my-2" }, h("span", { style: { fontFamily: F_BODY, fontSize: 11, fontStyle: "italic", color: t.fog, opacity: 0.8 } }, cName + " 看了你的消息，没有回"));
    if (m.kind === "emote") return h("div", { key: i, className: "py-1 flex items-start gap-2 " + (m.role === "user" ? "justify-end" : "justify-start") },
      m.role !== "user" && h(Avatar, { character: character, size: 40, radius: 10 }),
      h("div", {
        onTouchStart: selMode ? undefined : () => startPress(i),
        onTouchEnd: endPress,
        onMouseDown: selMode ? undefined : () => startPress(i),
        onMouseUp: endPress,
        onMouseLeave: endPress,
        onClick: selMode ? () => toggleSel(i) : undefined,
        style: { borderRadius: 12, cursor: "pointer", outline: selMode && selIds.includes(i) ? `2px solid ${t.tint}` : "none", outlineOffset: 2 }
      }, h(EmoteBubble, { url: m.url, keyword: m.keyword, max: 118 })),
      m.role === "user" && dsp.myAvatar && h(Avatar, { character: meAv, size: 40, radius: 10 }));
    if (m.kind === "chatforward") return h("div", { key: i, className: "py-1 flex items-start gap-2 " + (m.role === "user" ? "justify-end" : "justify-start") },
      m.role !== "user" && h(Avatar, { character: character, size: 40, radius: 10 }),
      h("div", { className: "flex flex-col " + (m.role === "user" ? "items-end" : "items-start") },
        h(ChatForwardCard, { m: m, isU: m.role === "user", onOpen: setFwdView }),
        last && subLine(m) ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, margin: "1px 4px 0" } }, subLine(m)) : null),
      m.role === "user" && dsp.myAvatar && h(Avatar, { character: meAv, size: 40, radius: 10 }));
    if (m.kind === "forumshare") return h("div", { key: i, className: "py-1 flex items-start gap-2 " + (m.role === "user" ? "justify-end" : "justify-start") },
      m.role !== "user" && h(Avatar, { character: character, size: 40, radius: 10 }),
      h(ForumShareCard, { m: m, isU: m.role === "user" }),
      m.role === "user" && dsp.myAvatar && h(Avatar, { character: meAv, size: 40, radius: 10 }));
    if (m.kind === "ficshare") return h("div", { key: i, className: "py-1 flex items-start gap-2 " + (m.role === "user" ? "justify-end" : "justify-start") },
      m.role !== "user" && h(Avatar, { character: character, size: 40, radius: 10 }),
      h(FicShareCard, { m: m, isU: m.role === "user" }),
      m.role === "user" && dsp.myAvatar && h(Avatar, { character: meAv, size: 40, radius: 10 }));
    // 他替她记进备忘录 / 记了一笔账（v58.10）
    if (m.kind === "recorded") return h("div", { key: i, className: "py-1 flex items-start gap-2 justify-start" },
      h(Avatar, { character: character, size: 40, radius: 10 }),
      h(RecordedCard, { m: m }));
    // 逛购物 app 时拿给他看的那件东西（v57.98）
    if (m.kind === "shopask") return h("div", { key: i, className: "py-1 flex items-start gap-2 justify-end" },
      h(ShopAskCard, { m: m }),
      dsp.myAvatar && h(Avatar, { character: meAv, size: 40, radius: 10 }));
    if (m.kind === "phonepeek") return h("div", { key: i, className: "py-1 flex items-start gap-2 " + (m.role === "user" ? "justify-end" : "justify-start") },
      m.role !== "user" && h(Avatar, { character: character, size: 40, radius: 10 }),
      h(PhonePeekCard, { m: m, isU: m.role === "user" }),
      m.role === "user" && dsp.myAvatar && h(Avatar, { character: meAv, size: 40, radius: 10 }));
    if (m.kind === "voice") return h("div", { key: i, className: "py-1 flex items-start gap-2 " + (m.role === "user" ? "justify-end" : "justify-start") },
      m.role !== "user" && h(Avatar, { character: character, size: 40, radius: 10 }),
      h("div", {
        onTouchStart: selMode ? undefined : () => startPress(i), onTouchEnd: endPress,
        onMouseDown: selMode ? undefined : () => startPress(i), onMouseUp: endPress, onMouseLeave: endPress,
        onClick: selMode ? () => toggleSel(i) : undefined,
        style: { maxWidth: "72%", outline: selMode && selIds.includes(i) ? `2px solid ${t.tint}` : "none", outlineOffset: 2, borderRadius: 18 }
      }, h(VoiceMsg, { m: m, isU: m.role === "user", speaker: m.role === "user" ? null : character })),
      m.role === "user" && dsp.myAvatar && h(Avatar, { character: meAv, size: 40, radius: 10 }));
    if (m.kind === "callinvite") return h(CallReceipt, { key: i, m: m, isU: m.role === "user", who: cName,
      avatar: h(Avatar, { character: character, size: 40, radius: 10 }), onCallBack: onCallBack });
    if (m.kind === "selfie") return h("div", { key: i, className: "py-1 flex items-start gap-2 justify-start" },
      h(Avatar, { character: character, size: 40, radius: 10 }),
      h("div", {
        onTouchStart: selMode ? undefined : () => startPress(i), onTouchEnd: endPress,
        onMouseDown: selMode ? undefined : () => startPress(i), onMouseUp: endPress, onMouseLeave: endPress,
        onClick: selMode ? () => toggleSel(i) : undefined,
        style: { maxWidth: "72%", outline: selMode && selIds.includes(i) ? `2px solid ${t.tint}` : "none", outlineOffset: 2, borderRadius: 14 }
      }, h(SelfieBubble, { m: m })));
    if (m.kind === "photo" && m.imageRef) {
      const mine = m.role === "user";
      return h("div", { key: i, className: "py-1 flex items-start gap-2 " + (mine ? "justify-end" : "justify-start") },
        !mine && h(Avatar, { character: character, size: 40, radius: 10 }),
        h("button", {
          onClick: selMode ? () => toggleSel(i) : () => setDescView(m),
          onTouchStart: selMode ? undefined : () => startPress(i), onTouchEnd: endPress,
          onMouseDown: selMode ? undefined : () => startPress(i), onMouseUp: endPress, onMouseLeave: endPress,
          className: "active:opacity-80",
          style: { display: "block", maxWidth: "72%", textAlign: "left", borderRadius: 14, overflow: "hidden", outline: selMode && selIds.includes(i) ? `2px solid ${t.tint}` : "none", outlineOffset: 2 }
        }, h("img", { src: resolveImg(m.imageRef), alt: m.desc || "照片", style: { display: "block", width: "100%", maxWidth: 260, maxHeight: 310, objectFit: "cover", background: t.bg2 } }),
          m.desc ? h("div", { style: { padding: "7px 10px", background: mine ? BUBBLE_SKIN.myBg : BUBBLE_SKIN.charBg, color: mine ? BUBBLE_SKIN.myText : (BUBBLE_SKIN.charText || t.ink), fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.5 } }, m.desc) : null),
        mine && dsp.myAvatar && h(Avatar, { character: meAv, size: 40, radius: 10 }));
    }
    if (m.kind === "listeninvite") return h("div", { key: i, className: "py-1 flex items-start gap-2 justify-start" },
      h(Avatar, { character: character, size: 40, radius: 10 }),
      h("div", { style: { maxWidth: "72%", background: "linear-gradient(135deg,#2b2b30,#17171b)", borderRadius: 16, padding: "12px 14px", boxShadow: "0 6px 18px rgba(0,0,0,0.22)" } },
        h("div", { className: "flex items-center gap-1.5", style: { marginBottom: 6 } },
          h("span", { style: { fontSize: 13 } }, "🎧"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: 1, color: "rgba(255,255,255,0.7)" } }, "一起听邀请")),
        m.say ? h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: "#fff", lineHeight: 1.5, marginBottom: m.song ? 4 : 8 } }, m.say) : null,
        m.song ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: "#f0d9a8", marginBottom: 8 } }, "《" + m.song + "》") : null,
        h("button", { onClick: () => onAcceptListen && onAcceptListen(character.id, m.song || ""), className: "w-full active:opacity-80", style: { background: "#fff", color: "#17171b", fontFamily: F_DISPLAY, fontSize: 14, padding: "8px", borderRadius: 10 } }, "和 TA 一起听 →")));
    if (m.kind === "studyinvite") return h("div", { key: i, className: "py-2 flex items-start gap-2 justify-start" },
      h(Avatar, { character: character, size: 34, radius: 10 }),
      h("div", { style: { maxWidth: "82%", background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "11px 12px" } },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: ".14em", color: t.fog, marginBottom: 5 } }, m.mode === "resume" ? "继续一起学" : "一起学邀请"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, marginBottom: 4 } }, m.subject || m.sessionTitle || "一起学点什么"),
        m.say ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, lineHeight: 1.65, whiteSpace: "pre-wrap" } }, m.say) : null,
        h("button", { onClick: function () { onOpenStudyInvite && onOpenStudyInvite(m); }, className: "active:opacity-70", style: { marginTop: 9, width: "100%", padding: "8px 10px", borderRadius: 10, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12.5 } }, m.mode === "resume" ? "继续这门课" : "看看课程草案")));
    const isU = m.role === "user";
    return /*#__PURE__*/React.createElement("div", {
      key: part ? i + ":" + part : i,
      className: "py-1"
    }, part === 0 && (i === 0 || messages[i - 1].turnId !== m.turnId || m.ts - (messages[i - 1].ts || 0) > 180000) ? /*#__PURE__*/React.createElement("div", {
      className: "text-center mb-1"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: F_BODY,
        fontSize: 10,
        color: t.fog
      }
    }, fmtStamp(m.ts))) : null, /*#__PURE__*/React.createElement("div", {
      className: "flex items-start gap-2 " + (isU ? "justify-end" : "justify-start")
    }, !isU && /*#__PURE__*/React.createElement("button", {
      onClick: onOpenState,
      className: "shrink-0 active:opacity-70",
      title: "查看 " + cName + " 的心声"
    }, /*#__PURE__*/React.createElement(Avatar, {
      character: character,
      size: 40,
      radius: 10
    })), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col",
      style: {
        alignItems: isU ? "flex-end" : "flex-start",
        maxWidth: "72%",
        minWidth: 0
      }
    }, m.replyTo && h("div", {
      style: {
        fontFamily: F_BODY,
        fontSize: 11,
        color: t.fog,
        background: t.bg,
        borderLeft: "2px solid " + t.line,
        borderRadius: 4,
        padding: "2px 8px",
        marginBottom: 3,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, "❝ " + m.replyTo), /*#__PURE__*/React.createElement("div", {
      onTouchStart: selMode ? undefined : () => startPress(i),
      onTouchEnd: endPress,
      onMouseDown: selMode ? undefined : () => startPress(i),
      onMouseUp: endPress,
      onMouseLeave: endPress,
      onClick: selMode ? () => toggleSel(i) : m.kind === "photo" ? () => setDescView(m.desc) : undefined,
      style: {
        position: "relative", // 贴纸的锚点：贴纸对着气泡自己定位
        padding: m.kind === "photo" ? "8px 10px" : "9px 13px",
        fontFamily: F_BODY,
        fontSize: 14.5,
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        background: isU ? BUBBLE_SKIN.myBg : BUBBLE_SKIN.charBg,
        color: isU ? BUBBLE_SKIN.myText : (BUBBLE_SKIN.charText || t.ink),
        border: (isU ? BUBBLE_SKIN.myBorder : BUBBLE_SKIN.charBorder) || "none",
        borderRadius: BUBBLE_SKIN.radius,
        boxShadow: BUBBLE_SKIN.shadow || "none",
        outline: selMode && selIds.includes(i) ? `2px solid ${t.tint}` : "none",
        outlineOffset: 2,
        cursor: "pointer",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none"
      }
    }, bubbleSticker(isU), m.kind === "location" ? h("span", {
      className: "flex items-center gap-1.5"
    }, h(Svg, {
      size: 15,
      color: isU ? "#16330a" : t.tint,
      sw: 1.7
    }, h("path", {
      d: "M12 21s-7-6.3-7-11a7 7 0 1114 0c0 4.7-7 11-7 11z"
    }), h("circle", {
      cx: 12,
      cy: 10,
      r: 2.4
    })), m.place) : m.kind === "photo" ? h("span", {
      className: "flex items-center gap-2"
    }, h("div", {
      style: {
        width: 40,
        height: 40,
        borderRadius: 8,
        background: "linear-gradient(135deg,#d8d3c8,#b3ada0)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, h(PGlyph, {
      k: "album",
      size: 18,
      color: "rgba(255,255,255,0.9)"
    })), "[图片]") : m.kind === "transfer" ? h("span", {
      className: "flex items-center gap-2.5"
    }, h("div", {
      style: {
        width: 34,
        height: 34,
        borderRadius: 8,
        background: "rgba(255,255,255,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: F_DISPLAY,
        fontSize: 17,
        color: isU ? "#16330a" : t.ink
      }
    }, "¥"), h("span", null, h("div", {
      style: {
        fontFamily: F_DISPLAY,
        fontSize: 16
      }
    }, "¥" + m.amount), h("div", {
      style: {
        fontFamily: F_BODY,
        fontSize: 10.5,
        opacity: 0.7
      }
    }, m.dir === "toChar" ? "转账" : "转账给你"))) : h(TransText, { text: m.content, isU: isU, zhReady: m.zh })), msgFoot(i, m, !selMode && !m.kind && last && subLine(m))), isU && dsp.myAvatar && h(Avatar, { character: meAv, size: 40, radius: 10 }), m.blocked && h(isU && bk.theyBlocked ? "button" : "div", {
      onClick: (isU && bk.theyBlocked) ? () => setUnblockDraft(String(m.content || "")) : undefined,
      title: (isU && bk.theyBlocked) ? "点这里写一句话，求 TA 解除拉黑" : "拉黑中",
      className: "shrink-0 self-center active:opacity-60",
      style: { order: isU ? -1 : 1, width: 18, height: 18, borderRadius: 999, background: t.accent, color: "#fff", fontFamily: F_BODY, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", cursor: (isU && bk.theyBlocked) ? "pointer" : "default" }
    }, "!")));
  }), sending && /*#__PURE__*/React.createElement("div", {
    role: "status",
    "aria-live": "polite",
    "aria-label": character.name + " 正在输入",
    className: "flex items-start gap-2"
  }, /*#__PURE__*/React.createElement(Avatar, {
    character: character,
    size: 40,
    radius: 10
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 14px",
      background: "#fff",
      borderRadius: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1"
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "w-1.5 h-1.5 rounded-full animate-pulse",
    style: {
      background: t.fog,
      animationDelay: i * 0.15 + "s"
    }
  })))))), selMode ? h("div", {
    className: "flex items-center justify-between px-4 py-3 shrink-0",
    style: {
      background: t.bg2,
      borderTop: `1px solid ${t.line}`
    }
  }, h("button", {
    onClick: exitSel,
    style: {
      fontFamily: F_BODY,
      fontSize: 13,
      color: t.fog
    }
  }, "取消"), h("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 14,
      color: t.ink
    }
  }, "已选 " + selIds.length), h("div", {
    className: "flex gap-3 items-center"
  }, h("button", {
    onClick: doDelete,
    disabled: !selIds.length,
    className: "disabled:opacity-40",
    style: {
      fontFamily: F_BODY,
      fontSize: 13,
      color: t.accent
    }
  }, "删除"), h("button", {
    onClick: () => selIds.length && setFwdPick(true),
    disabled: !selIds.length,
    className: "disabled:opacity-40 px-3 py-1.5",
    style: {
      fontFamily: F_BODY,
      fontSize: 13,
      color: t.bg2,
      background: t.ink,
      borderRadius: 6
    }
  }, "转发"))) : h(Fragment, null, quoted && /*#__PURE__*/React.createElement("div", {
    className: "shrink-0",
    style: { background: t.bg2, borderTop: `1px solid ${t.line}`, padding: "6px 12px 0", display: "flex", alignItems: "center" }
  }, h("div", { style: { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, padding: "4px 9px", background: t.bg, borderRadius: 7, borderLeft: "2px solid " + t.accent } },
    h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 11.5, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "❝ " + quoted),
    h("button", { onClick: () => setQuoted(null), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 16, lineHeight: 1, color: t.fog, padding: "0 4px" } }, "×"))),
  /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 px-3 py-2.5 shrink-0",
    style: {
      background: t.bg2,
      borderTop: quoted ? "none" : `1px solid ${t.line}`,
      paddingBottom: COMPOSER_PAD_BOTTOM
    }
  }, h("button", {
    onClick: () => setPanelOpen(v => !v),
    className: "active:opacity-60 shrink-0 flex items-center justify-center",
    style: {
      width: 32,
      height: 32,
      transform: panelOpen ? "rotate(45deg)" : "none",
      transition: "transform .2s"
    }
  }, h(IPlus, {
    size: 22,
    color: t.fog
  })), /*#__PURE__*/React.createElement("input", {
    value: input,
    onChange: e => setInput(e.target.value),
    onKeyDown: e => e.key === "Enter" && send(),
    placeholder: chatMode === "narr" ? "写一段旁白 / 设定场景…" : chatMode === "ooc" ? "OOC：直接和模型说，可让它调整或问状态…" : "发一条消息…",
    className: "flex-1 outline-none px-4 py-2.5 rounded-full",
    style: {
      fontFamily: F_BODY,
      fontSize: 14,
      color: t.ink,
      background: "#fff",
      border: `1px solid ${t.line}`,
      minWidth: 0
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: send,
    disabled: sending || !input.trim(),
    className: "active:opacity-70 disabled:opacity-30 flex items-center justify-center shrink-0",
    style: {
      width: 40,
      height: 40,
      borderRadius: 999,
      background: BUBBLE_SKIN.myBg
    }
  }, /*#__PURE__*/React.createElement(ISend, {
    size: 16,
    color: "#16330a"
  })), chatMode !== "ooc" && /*#__PURE__*/React.createElement("button", {
    onClick: reply,
    disabled: sending || bk.theyBlocked,
    title: bk.theyBlocked ? "TA 拉黑了你，无法回复" : "让 TA 回复",
    className: "active:opacity-70 disabled:opacity-40 flex items-center justify-center shrink-0",
    style: {
      width: 40,
      height: 40,
      borderRadius: 999,
      background: t.ink
    }
  }, sending ? h("div", {
    className: "flex gap-0.5"
  }, [0, 1, 2].map(i => h("span", {
    key: i,
    className: "w-1 h-1 rounded-full animate-pulse",
    style: {
      background: t.bg2,
      animationDelay: i * 0.15 + "s"
    }
  }))) : h(ISpark, {
    size: 19,
    color: t.bg2
  })))), panelOpen && !selMode && h("div", {
    className: "shrink-0 grid grid-cols-4 gap-y-5 px-5 py-5",
    style: {
      background: t.bg2,
      borderTop: `1px solid ${t.line}`
    }
  }, PANEL.map(([k, zh, glyph]) => h("button", {
    key: k,
    onClick: () => onPanelTap(k),
    className: "flex flex-col items-center gap-1.5 active:opacity-60"
  }, h("div", {
    className: "flex items-center justify-center",
    style: {
      width: 52,
      height: 52,
      borderRadius: 14,
      background: t.bg,
      border: `1px solid ${t.line}`
    }
  }, h(CGlyph, {
    k: glyph,
    size: 24,
    color: t.sub
  })), h("span", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11,
      color: t.fog
    }
  }, zh)))), specialKind && h(Sheet, {
    onClose: () => setSpecialKind(null)
  }, h("div", {
    className: "flex items-center justify-between mb-3"
  }, h("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 19,
      color: t.ink
    }
  }, specialKind === "location" ? "发送位置" : "发送照片"), h("button", {
    onClick: submitSpecial
  }, h(ISend, {
    size: 18,
    color: t.ink
  }))), specialKind === "photo" ? h("div", null,
    h("div", { className: "flex gap-2 mb-3", style: { background: t.bg, borderRadius: 11, padding: 4 } },
      [["real", "发送真照片"], ["describe", "只发文字描述"]].map(([id, label]) => h("button", {
        key: id, onClick: () => setPhotoSendMode(id), className: "flex-1 active:opacity-75",
        style: { padding: "8px 5px", borderRadius: 8, fontFamily: F_BODY, fontSize: 12.5, color: photoSendMode === id ? t.bg2 : t.fog, background: photoSendMode === id ? t.ink : "transparent" }
      }, label))),
    h("input", { ref: photoFileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: e => {
      const f = e.target.files && e.target.files[0];
      if (f) resizeImageFile(f, 1600, 0.86).then(setSpecialImg).catch(() => toast && toast("这张照片没能读出来，换一张试试"));
      e.target.value = "";
    } }),
    photoSendMode === "real" && h("button", { onClick: () => photoFileRef.current && photoFileRef.current.click(), className: "w-full active:opacity-75", style: { minHeight: 150, borderRadius: 12, overflow: "hidden", background: t.bg, border: `1px dashed ${t.line}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 } },
      specialImg ? h("img", { src: specialImg, style: { display: "block", width: "100%", maxHeight: 280, objectFit: "contain" } }) : h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.fog, lineHeight: 1.8 } }, "点这里选择照片\n相机或相册都可以")),
    h("input", { value: specialText, onChange: e => setSpecialText(e.target.value), placeholder: photoSendMode === "real" ? "可以顺手说一句（选填）" : "描述照片里有什么（必填，不会上传图片）", className: "w-full outline-none px-3 py-2.5 rounded-lg", style: { fontFamily: F_BODY, fontSize: 14, background: t.bg, color: t.ink, border: `1px solid ${t.line}` } }),
    photoSendMode === "describe" && h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.5, marginTop: 7 } }, "角色只会收到你的文字描述；不会读取相册，也不会上传真实照片。")
  ) : h("input", {
    value: specialText,
    onChange: e => setSpecialText(e.target.value),
    autoFocus: true,
    placeholder: specialKind === "location" ? "输入地点名称，如：外滩十八号" : "描述这张照片，如：一只趴着的橘猫",
    className: "w-full outline-none px-3 py-2.5 rounded-lg",
    style: {
      fontFamily: F_BODY,
      fontSize: 14,
      background: t.bg,
      color: t.ink,
      border: `1px solid ${t.line}`
    }
  })), recallView && h(Sheet, { onClose: () => setRecallView(null) },
    h(Eyebrow, { style: { marginBottom: 8 } }, cName + " 撤回的消息"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.6, color: t.ink, background: t.bg, borderRadius: 12, padding: "12px 14px" } }, recallView.origText || "（空）"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: "0.12em", color: t.fog, marginTop: 14, marginBottom: 4 } }, "TA 为什么撤回"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.7, color: t.sub, fontStyle: "italic" } }, recallView.reason || "（没说）")),
  fwdView && h(ChatForwardSheet, { m: fwdView, onClose: () => setFwdView(null) }),
  Array.isArray(archView) && h(Sheet, { onClose: () => setArchView(null), tall: true },
    h(Eyebrow, { style: { marginBottom: 8 } }, "更早的聊天 · 云端归档"),
    archView.length === 0
      ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", padding: "30px 0" } }, "云端还没有更早的记录")
      : h("div", { style: { display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, textAlign: "center", marginBottom: 2 } }, "共 " + archView.length + " 条 · 只读回看（不占本地空间）"),
          archView.map((m, i) => {
            const mine = m.role === "user";
            const body = m.content != null && String(m.content) !== "" ? String(m.content) : (m.kind ? "[" + m.kind + "]" : "");
            return h("div", { key: i, style: { display: "flex", justifyContent: mine ? "flex-end" : "flex-start" } },
              h("div", { style: { maxWidth: "82%", padding: "7px 11px", borderRadius: 12, fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word", background: mine ? t.tint : t.bg2, color: mine ? "#fff" : t.ink, border: mine ? "none" : "1px solid " + t.line } }, body));
          }))), descView && h(Sheet, {
    onClose: () => setDescView(null),
    tall: true
  }, h(Eyebrow, {
    style: {
      marginBottom: 8
    }
  }, "照片"), !(typeof descView === "object" && descView.imageRef) && h("div", {
    style: {
      width: "100%",
      height: 140,
      borderRadius: 12,
      background: "linear-gradient(135deg,#d8d3c8,#b3ada0)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12
    }
  }, h(PGlyph, {
    k: "album",
    size: 28,
    color: "rgba(255,255,255,0.9)"
  })), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 14,
      lineHeight: 1.8,
      color: t.ink,
      whiteSpace: "pre-wrap"
    }
  }, typeof descView === "object" && descView.imageRef
    ? h("div", null,
        h("img", { src: resolveImg(descView.imageRef), style: { width: "100%", maxHeight: "68vh", objectFit: "contain", borderRadius: 12, display: "block" } }),
        descView.desc ? h("div", { style: { marginTop: 10, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.7, color: t.ink, whiteSpace: "pre-wrap" } }, descView.desc) : null)
    : descView)), transferOpen && h(TransferComposeSheet, {
    cName: cName,
    myBalance: myBalance,
    onClose: () => setTransferOpen(false),
    onSend: (amount, note) => {
      onSendTransfer(amount, note);
      setTransferOpen(false);
    }
  }), geoOpen && h(GeoStampSheet, {
    recent: geoRecent,
    onClose: () => setGeoOpen(false),
    onSend: name => {
      sendRich({ role: "user", kind: "geo", name: name, content: "[位置] " + name });
      setGeoOpen(false);
    }
  }), stickerOpen && h(Sheet, { onClose: () => setStickerOpen(false), tall: true },
    h("div", { className: "flex items-center justify-between", style: { marginBottom: 12 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1.2, color: t.fog } }, "表情包"),
      h("button", { onClick: () => { setStickerOpen(false); onManageEmotes && onManageEmotes(); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.tint } }, "管理表情库 ›")),
    (emotes || []).length === 0
      ? h("div", { className: "text-center", style: { padding: "30px 0", fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 1.9 } }, "还没有表情。\n点右上「管理表情库」批量导入。")
      : h("div", { className: "grid grid-cols-4 gap-2", style: { maxHeight: "46vh", overflowY: "auto" } }, (emotes || []).map(em => h("button", { key: em.id, onClick: () => { sendRich({ role: "user", kind: "emote", url: em.url, keyword: em.keyword, content: "[表情] " + em.keyword }); setStickerOpen(false); }, className: "active:opacity-70", style: { border: "1px solid " + t.line, borderRadius: 10, overflow: "hidden", background: t.bg2 } },
        h("div", { style: { width: "100%", aspectRatio: "1" } }, h("img", { src: em.url, referrerPolicy: "no-referrer", loading: "lazy", style: { width: "100%", height: "100%", objectFit: "cover", display: "block" }, onError: e => { e.target.style.display = "none"; } })))))
  ), callLogOpen && h(CallLogSheet, { calls: (messages || []).filter(x => x.kind === "callend"), chars: [character], onClose: () => setCallLogOpen(false) }), searchOpen && h(ChatSearchSheet, { messages, chars: [character], archCount: archCount, loadArch: onLoadOlder ? () => onLoadOlder(character.id) : null, onClose: () => setSearchOpen(false), onLocate: i => { setSearchOpen(false); setTimeout(() => locateMsgIn(ref.current, i, messages, archCount > 0), 130); } }), voiceMsgOpen && h(Sheet, { onClose: () => setVoiceMsgOpen(false) },
    h(VoiceEarComposer, { onSend: sendRich, onClose: () => setVoiceMsgOpen(false), ownerKey: profile && (profile.id || profile.name), toast })
  ), modeOpen && h(Sheet, {
    onClose: () => setModeOpen(false)
  }, h("div", {
    style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1.2, color: t.fog, marginBottom: 10 }
  }, "输入模式"), [["chat", "对话", "与角色直接交流"], ["offline", "赴约", "进入线下模式"], ["narr", "旁白注入", "设定背景与环境"], ["ooc", "OOC 指令", "越过角色下达指令"]].map(([mk, mzh, mdesc]) => h("button", {
    key: mk,
    onClick: () => {
      setModeOpen(false);
      onModeTap(mk);
    },
    className: "w-full flex items-center py-3 px-3 active:opacity-60 text-left",
    style: { borderRadius: 12, background: mk === chatMode ? t.bg : "transparent", marginBottom: 4 }
  }, h("div", {
    className: "flex-1"
  }, h("div", {
    style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink }
  }, mzh), h("div", {
    style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 1 }
  }, mdesc)), mk === chatMode && h(ICheck, {
    size: 18,
    color: t.tint
  }))), onOpenRooms && h("button", {
    onClick: () => { setModeOpen(false); onOpenRooms(); },
    className: "w-full flex items-center px-3 active:opacity-60 text-left",
    style: { marginTop: 8, paddingTop: 13, paddingBottom: 4, borderTop: "1px solid " + t.line }
  }, h("div", { className: "flex-1" },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "小房间"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 1 } }, room && !room.main ? "现在在「" + room.name + "」· 点这里换房" : "把一件想慢慢继续的事单独收起来")),
    h(IChevR, { size: 17, color: t.fog })
  )), menu != null && h(MsgMenu, {
    message: messages[menu],
    idx: menu,
    isMine: messages[menu] && messages[menu].role === "user",
    items: menuItemsForKind(messages[menu], canSpeakMsg(messages[menu])),
    onClose: () => setMenu(null),
    onAction: act => {
      if (act === "multi") {
        setSelMode(true);
        setSelIds([menu]);
      } else if (act === "quote") {
        const mm = messages[menu];
        if (mm && mm.content) setQuoted(String(mm.content));
      } else if (act === "speak") {
        speakMsg(menu, messages[menu]);
      } else onLongPress(act, menu);
      setMenu(null);
    }
  }), fwdPick && h(Sheet, {
    onClose: () => setFwdPick(false)
  }, h(Eyebrow, {
    style: {
      marginBottom: 12
    }
  }, "转发给谁"), h("div", {
    className: "space-y-1 max-h-72 overflow-y-auto"
  }, (characters || []).filter(c => c.id !== character.id).map(c => h("button", {
    key: c.id,
    onClick: () => doForward({ type: "chat", id: c.id }),
    className: "w-full flex items-center gap-3 py-2.5 active:opacity-60"
  }, h(Avatar, {
    character: c,
    size: 34,
    radius: 7
  }), h("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 16,
      color: t.ink
    }
  }, c.remark || c.name))), (groups || []).map(g => h("button", {
    key: "g_" + g.id,
    onClick: () => doForward({ type: "group", id: g.id }),
    className: "w-full flex items-center gap-3 py-2.5 active:opacity-60"
  }, h("div", { style: { width: 34, height: 34, borderRadius: 7, background: t.bg2, border: "1px solid " + t.line, display: "flex", alignItems: "center", justifyContent: "center" } }, "👥"),
  h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, g.name))), (characters || []).filter(c => c.id !== character.id).length === 0 && !(groups || []).length && h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 12.5,
      color: t.fog,
      padding: "12px 0"
    }
  }, "没有其他角色可转发"))));
}
// 仿微信语音/视频通话：发一句自动回一句
function CallScreen({
  participants,
  mode,
  msgs,
  sending,
  bye,
  bg,
  bgBusy,
  onShot,
  onSend,
  onHangup,
  minimized,
  onMinimize,
  onRestore
}) {
  const [sec, setSec] = useState(0);
  const [input, setInput] = useState("");
  const ref = useRef(null);
  const secRef = useRef(0);
  const [pos, setPos] = useState(null); // PiP 小屏拖动位置（null=默认右上）
  const dragRef = useRef({ dragging: false, moved: false, grabX: 0, grabY: 0 });
  // 通话台词懒 TTS：点那条才合成（缓存在 ttsSpeak 里，重播免费）；一次只放一条（共用 useTtsPlayer）
  const tp = useTtsPlayer();
  // —— 真声通话档 v2（v56.23）：主耳=浏览器原生 SpeechRecognition（免费/实时/自带断句），
  //    书房 whisper 降级为兜底；播放=Web Audio+手势解锁（iOS PWA 拦非手势 audio.play，
  //    点🎙那一瞬先播1帧静音点亮 AudioContext）。脑子不变：onSend 走这通电话原有引擎。
  const [live, setLive] = useState(false);
  const [liveSt, setLiveSt] = useState("");
  const lv = useRef({ rec: null, recWanted: false, recTimer: null, ctx: null, node: null, stream: null,
    buf: [], pre: [], preSamples: 0, talking: false, silent: 0, speech: 0, last: 0, busy: 0, played: 0,
    speaking: false, ttsCtx: null, src: null, session: 0, turn: 0, lastFinal: "", lastFinalAt: 0 });
  const liveRef = useRef(false); liveRef.current = live;
  // 他自己挂电话(v60.24)：App 那边只立了个牌子(bye)，真正收线在这儿——
  // 时长只有这里数着(secRef)，而且他最后那句得在屏幕上留一会儿，
  // 不能话音未落就黑屏。留 1.8 秒：够看完一句，也不至于像卡住。
  const byeRef = useRef(false);
  useEffect(() => {
    if (!bye || byeRef.current) return;
    byeRef.current = true;
    const tm = setTimeout(() => onHangup(secRef.current, "them"), 1800);
    return () => clearTimeout(tm);
  }, [!!bye]);
  const sendingRef = useRef(false); sendingRef.current = !!sending;
  const msgsRef = useRef(msgs); msgsRef.current = msgs || [];
  const lvCommitFinal = (raw, session) => {
    const st = lv.current, text = String(raw || "").trim();
    if (!text || !liveRef.current || st.session !== session) return false;
    const now = Date.now();
    // 原生识别在 restart 边界偶尔把同一句 final 再吐一次；不让它变成两条用户消息。
    if (text === st.lastFinal && now - st.lastFinalAt < 1800) return false;
    st.lastFinal = text; st.lastFinalAt = now; st.turn += 1;
    onSend(text); return true;
  };
  const lvEncode = chunks => { // Float32(16k) → 16k mono WAV（whisper 兜底路径用）
    let len = 0; chunks.forEach(c => len += c.length);
    const pcm = new Int16Array(len); let o = 0;
    chunks.forEach(c => { for (let i = 0; i < c.length; i++) pcm[o++] = Math.max(-1, Math.min(1, c[i])) * 0x7FFF; });
    const b = new ArrayBuffer(44 + pcm.length * 2), v = new DataView(b);
    const w = (pp, str) => { for (let i = 0; i < str.length; i++) v.setUint8(pp + i, str.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true); v.setUint32(28, 32000, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, pcm.length * 2, true);
    new Int16Array(b, 44).set(pcm); return new Blob([b], { type: "audio/wav" });
  };
  // —— 主耳：原生 SpeechRecognition ——
  const recStart = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    const st = lv.current;
    const session = st.session;
    const rec = new SR();
    rec.lang = "zh-CN"; rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => {
      if (!liveRef.current || st.session !== session) return;
      st.recAlive = true; // 看门狗：真吐过结果才算活
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const piece = ((e.results[i][0] || {}).transcript || "").trim();
        if (e.results[i].isFinal) { if (piece && !st.busy && !sendingRef.current) lvCommitFinal(piece, session); }
        else interim += piece;
      }
      if (interim) setLiveSt("你：" + interim.slice(-24));
    };
    rec.onend = () => { // continuous 也会自己断，450ms 自动重启是命门
      if (st.recWanted && liveRef.current && st.session === session) st.recTimer = setTimeout(() => { if (st.session === session) try { rec.start(); } catch (e2) {} }, 450);
    };
    rec.onaudiostart = () => { if (st.session === session) st.recAlive = true; };
    rec.onerror = ev => {
      if (st.session !== session) return;
      if (ev.error === "not-allowed") { setLiveSt("麦克风权限被拒"); lvStop(); }
      else if (ev.error === "service-not-allowed" || ev.error === "audio-capture") st.recDead = true; // 假货实锤，看门狗会切
    };
    st.rec = rec; st.recWanted = true;
    try { rec.start(); } catch (e2) { return false; }
    return true;
  };
  const recPause = () => { const st = lv.current; st.recWanted = false; clearTimeout(st.recTimer); try { st.rec && st.rec.stop(); } catch (e2) {} };
  const recResume = () => { const st = lv.current; if (!st.rec || !liveRef.current) return; st.recWanted = true; try { st.rec.start(); } catch (e2) {} };
  // —— 兜底耳：书房 whisper（老路径） ——
  const lvFlush = async () => {
    const st = lv.current, session = st.session; const chunks = st.buf;
    st.buf = []; st.pre = []; st.preSamples = 0; st.talking = false; st.speech = 0; st.silent = 0;
    const total = chunks.reduce((a, c) => a + c.length, 0);
    if (total < 16000 * 0.4) return;
    st.busy++; setLiveSt("识别中…");
    try {
      const d = await earsTranscribe(lvEncode(chunks));
      const text = (d && d.text || "").trim();
      if (text) lvCommitFinal(text, session);
    } catch (e) { setLiveSt("识别失败，再说一遍"); }
    finally { if (st.session === session) { st.busy = Math.max(0, st.busy - 1); if (liveRef.current) setLiveSt(s2 => s2 === "识别中…" ? "听着呢" : s2); } }
  };
  const workletStart = async () => {
    const st = lv.current;
    const session = st.session;
    st.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    st.ctx = new (window.AudioContext || window.webkitAudioContext)();
    try { await st.ctx.resume(); } catch (e2) {}
    if (!st.ctx.audioWorklet) throw new Error("这台设备不支持 AudioWorklet");
    const sr = st.ctx.sampleRate;
    await st.ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([
      "registerProcessor('cl-tap',class extends AudioWorkletProcessor{process(i){if(i[0]&&i[0][0])this.port.postMessage(i[0][0].slice(0));return true;}});"
    ], { type: "text/javascript" })));
    const src = st.ctx.createMediaStreamSource(st.stream);
    st.node = new AudioWorkletNode(st.ctx, "cl-tap"); src.connect(st.node);
    st.last = performance.now();
    st.node.port.onmessage = e => {
      const now = performance.now(), dt = now - st.last; st.last = now;
      if (!liveRef.current || st.session !== session) return;
      if (st.busy > 0 || sendingRef.current) { st.buf = []; st.pre = []; st.preSamples = 0; st.talking = false; st.silent = 0; return; }
      const f = e.data; let sum = 0; for (let i = 0; i < f.length; i++) sum += f[i] * f[i];
      const rms = Math.sqrt(sum / f.length);
      const voiced = rms > 0.012;
      // 书房耳预卷约 0.7 秒：VAD 真正判定开口前的音频也带进 ASR，别把第一个字吃掉。
      const ratio = sr / 16000, n = Math.floor(f.length / ratio), out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = f[Math.floor(i * ratio)];
      const wasTalking = st.talking;
      if (!wasTalking) {
        st.pre.push(out); st.preSamples += out.length;
        while (st.preSamples > 16000 * 0.7 && st.pre.length > 1) st.preSamples -= st.pre.shift().length;
      }
      if (voiced) {
        if (!st.talking) { st.talking = true; st.speech = 0; st.buf = st.pre.slice(); st.pre = []; st.preSamples = 0; }
        st.silent = 0;
      }
      else if (st.talking) st.silent += dt;
      if (st.talking) {
        st.speech += dt;
        if (wasTalking) st.buf.push(out); // 刚起声那帧已经包含在 pre 里，别重复塞一遍
        const limit = st.speech > 3000 ? 1350 : 900;
        if (st.silent >= limit || st.speech >= 60000) lvFlush();
      }
    };
  };
  const lvStart = async () => {
    try {
      const st = lv.current;
      st.session += 1; const session = st.session;
      st.turn = 0; st.lastFinal = ""; st.lastFinalAt = 0; st.pre = []; st.preSamples = 0;
      // 手势里点亮 TTS 的 AudioContext：播1帧静音解锁，之后异步语音 iOS 也放行
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!st.ttsCtx || st.ttsCtx.state === "closed") st.ttsCtx = new AC();
      try { await st.ttsCtx.resume(); } catch (e2) {}
      const ub = st.ttsCtx.createBuffer(1, 1, 22050);
      const us = st.ttsCtx.createBufferSource(); us.buffer = ub; us.connect(st.ttsCtx.destination); us.start(0);
      st.played = (msgs || []).length;
      let mode = "";
      st.recAlive = false; st.recDead = false;
      if (recStart()) {
        mode = "原生识别";
        // WKWebView 阴招：识别对象存在也肯 start，但永远不吐结果。6秒看门狗验活，假货自动切书房耳
        setTimeout(async () => {
          const st2 = lv.current;
          if (!liveRef.current || st2.session !== session || st2.recAlive) return;
          if (typeof voiceEarsReady === "function" && voiceEarsReady()) {
            recPause(); st2.rec = null;
            try { await workletStart(); setLiveSt("听着呢（原生哑了，切书房识别）"); }
            catch (e3) { setLiveSt("原生识别哑了，书房耳也开不了：" + (e3 && e3.message || e3)); }
          } else setLiveSt("原生识别没反应，且没配书房耳朵——去设置填「真声通话耳朵」");
        }, 6000);
      }
      else if (typeof voiceEarsReady === "function" && voiceEarsReady()) { await workletStart(); mode = "书房识别"; }
      else throw new Error("这台浏览器不支持语音识别，且没配书房耳朵");
      setLive(true); setLiveSt("听着呢（" + mode + "）");
    } catch (e) { setLiveSt("开不了麦：" + (e && e.message || e)); }
  };
  const lvStop = () => {
    const st = lv.current;
    st.session += 1; // 先让识别/TTS 的迟到 promise 全部失效，再拆设备
    recPause(); st.rec = null;
    try { st.node && st.node.disconnect(); } catch (e) {}
    try { st.ctx && st.ctx.close(); } catch (e) {}
    try { st.stream && st.stream.getTracks().forEach(t2 => t2.stop()); } catch (e) {}
    try { st.src && st.src.stop(); } catch (e) {}
    st.buf = []; st.pre = []; st.preSamples = 0; st.talking = false; st.busy = 0; st.speaking = false;
    setLive(false); setLiveSt("");
  };
  useEffect(() => () => lvStop(), []);
  // —— 嘴：对方新台词自动播（Web Audio 队列，半双工：播时暂停识别） ——
  useEffect(() => {
    if (!live) return;
    const st = lv.current;
    const session = st.session;
    if (st.speaking) return; // 播报锁：防多气泡齐唱
    st.speaking = true;
    (async () => {
      let paused = false;
      while (liveRef.current && st.played < msgsRef.current.length) {
        const m = msgsRef.current[st.played++];
        if (!m || m.role === "user" || m.act || !m.content) continue;
        const spk2 = m.senderId ? (participants || []).find(c => c.id === m.senderId) : primary;
        if (!spk2 || !spk2.voiceId) continue;
        if (!paused) { paused = true; recPause(); } // 说话前闭耳，防自问自答
        st.busy++; setLiveSt("对方说话中…");
        // ⭐流水线预取：播这条前先把下一条的合成悄悄发出去（ttsSpeak 自带缓存，轮到它时秒中）
        for (let k = st.played; k < msgsRef.current.length; k++) {
          const nm = msgsRef.current[k];
          if (nm && nm.role !== "user" && !nm.act && nm.content) {
            const nspk = nm.senderId ? (participants || []).find(c => c.id === nm.senderId) : primary;
            if (nspk && nspk.voiceId) { ttsSpeak(nm.content, nspk.voiceId).catch(() => {}); }
            break;
          }
        }
        try {
          const blob = await ttsSpeak(m.content, spk2.voiceId);
          if (!liveRef.current || st.session !== session) break;
          const abuf = await st.ttsCtx.decodeAudioData(await blob.arrayBuffer());
          if (!liveRef.current || st.session !== session) break;
          await new Promise(res => {
            const srcN = st.ttsCtx.createBufferSource(); st.src = srcN;
            srcN.buffer = abuf; srcN.connect(st.ttsCtx.destination);
            const safety = setTimeout(res, abuf.duration * 1000 + 3000);
            srcN.onended = () => { clearTimeout(safety); res(); };
            srcN.start(0);
          });
        } catch (e) {}
        finally { if (st.session === session) st.busy = Math.max(0, st.busy - 1); }
      }
      if (st.session === session) st.speaking = false;
      if (liveRef.current && st.session === session) { setLiveSt("听着呢"); if (paused) setTimeout(() => { if (st.session === session) recResume(); }, 300); }
    })();
  }, [live, (msgs || []).length]);
  useEffect(() => {
    const i = setInterval(() => setSec(s => { secRef.current = s + 1; return s + 1; }), 1000);
    return () => clearInterval(i);
  }, []);
  const list = msgs || [];
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [list.length, sending]);
  const mmss = String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0");
  const isVideo = mode === "video";
  const people = participants || [];
  const primary = people[0] || {};
  const isGroup = people.length > 1;
  const title = people.map(c => c.remark || c.name).join("、");
  // 真声档开关条件放这儿：isGroup/primary 声明之后（放前面吃过 TDZ 崩屏）
  // 有原生识别就不再要求书房耳朵；嗓子(ttsReady+音色)仍是硬条件
  const canLive = !isGroup && typeof ttsReady === "function" && ttsReady() && !!primary.voiceId
    && (!!(window.SpeechRecognition || window.webkitSpeechRecognition) || (typeof voiceEarsReady === "function" && voiceEarsReady()));
  const send = () => {
    if (!input.trim() || sending) return;
    onSend(input.trim());
    setInput("");
  };
  const avatarNode = (c, size) => { const av = c.avatarImage ? (typeof resolveImg === "function" ? resolveImg(c.avatarImage) : c.avatarImage) : ""; return av ? h("img", { src: av, style: { width: size, height: size, borderRadius: 999, objectFit: "cover" } }) : h("div", { style: { width: size, height: size, borderRadius: 999, background: c.color || "#c2bdb1", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: size * 0.42, color: "#fff" } }, (c.name || "?")[0]); };
  // —— PiP 小屏：悬浮在其它界面上，点一下回全屏，可拖动；计时/消息不中断 ——
  const recent = list.slice(-16);
  // ⚠️这两个必须排在【所有提前 return 之前】：下面 minimized 那一支会早退，
  //   hook 写在它后面＝按缩小键那一下少调一个 hook，React 当场崩
  //   （她 2026-09-02：「从视频界面按缩小键页面会崩」）。
  //   仓库里已经吃过一次同样的亏，见 test/translate-detect.test.js 那条。
  const bgUrl = useIdbImgUrl(bg);
  if (minimized) {
    const onTS = e => { const r = e.currentTarget.getBoundingClientRect(); const tt = e.touches[0]; dragRef.current = { dragging: true, moved: false, grabX: tt.clientX - r.left, grabY: tt.clientY - r.top }; };
    const onTM = e => { if (!dragRef.current.dragging) return; const tt = e.touches[0]; dragRef.current.moved = true; const w = window.innerWidth, hh = window.innerHeight; setPos({ x: Math.max(4, Math.min(w - 150, tt.clientX - dragRef.current.grabX)), y: Math.max(40, Math.min(hh - 60, tt.clientY - dragRef.current.grabY)) }); };
    const onTE = () => { dragRef.current.dragging = false; };
    return h("div", {
      onClick: () => { if (!dragRef.current.moved) onRestore(); },
      onTouchStart: onTS, onTouchMove: onTM, onTouchEnd: onTE,
      style: Object.assign({ position: "absolute", zIndex: 80, display: "flex", alignItems: "center", gap: 8, padding: "6px 13px 6px 6px", borderRadius: 999, background: "rgba(18,24,28,0.92)", boxShadow: "0 6px 22px rgba(0,0,0,0.4)", touchAction: "none", cursor: "pointer", backdropFilter: "blur(6px)" }, pos ? { left: pos.x, top: pos.y } : { right: 14, top: 82 })
    }, avatarNode(primary, 30), h("div", null,
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#fff", lineHeight: 1.1, maxWidth: 96, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, isGroup ? people.length + "人通话" : (primary.remark || primary.name || "通话")),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#95d16f", lineHeight: 1.2, marginTop: 1 } }, (isVideo ? "视频 " : "语音 ") + mmss)),
      h(IPulse, { size: 15, color: "#95d16f" }));
  }
  // 这一通的画面（v60.35 她点名）：视频通话原来只有一片深色底和一个头像圆，
  // 「看得见对方」这件事只写在提示词里、屏幕上一点都看不出来。
  // 有画面时它铺满整屏当底，上面压一层暗罩让台词还读得清；头像圈就收起来——
  // 人已经在画面里了，再摆一个圆头像是两份同样的东西。
  return h("div", {
    className: "absolute inset-0 z-[70] flex flex-col",
    style: {
      background: isVideo ? "linear-gradient(180deg,#2a2a2e,#111114)" : "linear-gradient(180deg,#3a4a52,#1c2429)",
      paddingTop: "env(safe-area-inset-top)"
    }
  }, bgUrl ? h("div", { style: { position: "absolute", inset: 0, pointerEvents: "none" } },
      h("img", { src: bgUrl, alt: "", style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } }),
      h("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(10,10,12,.58) 0,rgba(10,10,12,.42) 30%,rgba(10,10,12,.74) 100%)" } })) : null, onMinimize && h("button", {
    onClick: onMinimize,
    className: "absolute active:opacity-60 flex items-center justify-center",
    style: { top: "calc(env(safe-area-inset-top) + 14px)", left: 16, zIndex: 5, width: 34, height: 34, borderRadius: 999, background: "rgba(255,255,255,0.14)" }
  }, h(Svg, { size: 18, color: "#fff", sw: 2 }, h("path", { d: "M6 9l6 6 6-6" }))),
  onShot ? h("button", {
    onClick: () => !bgBusy && onShot(),
    disabled: bgBusy,
    "aria-label": bg ? "换一张这通的画面" : "拍一张这通的画面",
    className: "absolute active:opacity-60 flex items-center",
    style: { top: "calc(env(safe-area-inset-top) + 14px)", right: 16, zIndex: 5, gap: 5,
      height: 34, padding: "0 12px", borderRadius: 999, border: "none", background: "rgba(255,255,255,0.14)",
      fontFamily: F_BODY, fontSize: 11.5, color: "#fff" }
  },
    bgBusy
      ? h("span", { style: { width: 11, height: 11, borderRadius: 2, border: "1.6px solid #fff", borderTopColor: "transparent", animation: "wk-spin .7s linear infinite" } })
      : h(CGlyph, { k: "picture", size: 14, color: "#fff" }),
    h("span", null, bgBusy ? "在拍" : bg ? "换一张" : "看看画面")) : null,
  h("div", {
    className: "shrink-0 pt-10 pb-3 flex flex-col items-center"
  }, h("div", {
    className: "px-6 text-center",
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 22,
      color: "#fff"
    }
  }, title), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 13,
      color: "rgba(255,255,255,0.6)",
      marginTop: 4
    }
  }, (isVideo ? "视频通话" : "语音通话") + (isGroup ? " · " + people.length + "人" : "") + " · " + mmss)), h("div", {
    className: "shrink-0 flex justify-center py-3 gap-2 flex-wrap px-6"
  }, bgUrl ? [] : (isGroup ? people.slice(0, 4) : [primary]).map((c, ci) => h("div", {
    key: ci,
    style: {
      width: isGroup ? 64 : (isVideo ? 148 : 104),
      height: isGroup ? 64 : (isVideo ? 196 : 104),
      borderRadius: isGroup ? 14 : (isVideo ? 20 : 999),
      overflow: "hidden",
      boxShadow: "0 8px 30px rgba(0,0,0,0.4)"
    }
  }, (c.avatarImage && (typeof resolveImg === "function" ? resolveImg(c.avatarImage) : c.avatarImage)) ? h("img", {
    src: (typeof resolveImg === "function" ? resolveImg(c.avatarImage) : c.avatarImage),
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : h("div", {
    style: {
      width: "100%",
      height: "100%",
      background: c.color || "#c2bdb1",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: F_DISPLAY,
      fontSize: isGroup ? 26 : 44,
      color: "#fff"
    }
  }, (c.name || "?")[0])))), h("div", {
    ref: ref,
    className: "flex-1 overflow-y-auto px-5 py-3 space-y-2"
  }, recent.map((m, i) => {
    const isU = m.role === "user";
    if (m.act) return h("div", { key: i, className: "flex justify-center py-0.5" }, h("div", {
      style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 12, lineHeight: 1.4, color: "rgba(255,255,255,0.55)", textAlign: "center", maxWidth: "80%" }
    }, (isGroup && m.senderName ? m.senderName + " " : "") + "（" + m.content + "）"));
    // 台词可点听：这条的说话人配了音色 + TTS 开着才显示 ▶（点了才合成收费）
    const spk = m.senderId ? people.find(c => c.id === m.senderId) : (!isU && !isGroup ? primary : null);
    const canT = !isU && spk && spk.voiceId && m.content && typeof ttsReady === "function" && ttsReady();
    const meP = tp.play && tp.play.k === i;
    return h("div", {
      key: i,
      className: "flex flex-col " + (isU ? "items-end" : "items-start")
    }, !isU && isGroup && m.senderName && h("span", {
      style: { fontFamily: F_BODY, fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 1, marginLeft: 2 }
    }, m.senderName), h("div", { className: "flex items-center gap-1.5", style: { maxWidth: "88%" } }, h("div", {
      style: {
        maxWidth: canT ? "100%" : "78vw",
        padding: "7px 12px",
        borderRadius: 14,
        fontFamily: F_BODY,
        fontSize: 13.5,
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        background: isU ? skinAlpha(BUBBLE_SKIN.myBg, "eb") : skinAlpha(BUBBLE_SKIN.charBg, "24"),
        color: isU ? "#16330a" : "#fff"
      }
    }, m.content), canT ? h("button", {
      onClick: () => tp.toggle(i, m.content, spk.voiceId),
      className: "active:opacity-60 shrink-0",
      style: { width: 24, height: 24, borderRadius: 999, border: "1.5px solid rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: meP && tp.play.st === "gen" ? 9 : 10, background: "transparent" }
    }, meP ? (tp.play.st === "gen" ? "…" : "⏸") : "▶") : null));
  }),
    // 说完了在等他开口:跟主聊天一样给一个【气泡】,长在他下一句会出现的地方(她 2026-09-02)。
    // 原来这儿只有一行贴着输入栏的灰字「X 正在说…」——离他的话隔着大半屏，
    // 而且它取的 sending 是【聊天那条 lane】的，通话跑的是 "call" lane，那行灰字其实从来没亮过。
    bye && h("div", { key: "bye", className: "flex justify-center py-1" },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(255,255,255,0.55)" } },
        (bye.name || "对方") + "挂断了")),
    !bye && sending && h("div", { key: "typing", className: "flex flex-col items-start" },
      !isGroup ? null : h("span", {
        style: { fontFamily: F_BODY, fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 1, marginLeft: 2 }
      }, "对方"),
      h("div", {
        role: "status", "aria-live": "polite",
        "aria-label": (isGroup ? "对方" : (primary.remark || primary.name || "对方")) + " 正在说",
        style: { padding: "10px 14px", borderRadius: 14, background: skinAlpha(BUBBLE_SKIN.charBg, "24") }
      }, h("div", { className: "flex gap-1" }, [0, 1, 2].map(i => h("span", {
        key: i,
        className: "w-1.5 h-1.5 rounded-full animate-pulse",
        style: { background: "rgba(255,255,255,0.72)", animationDelay: i * 0.15 + "s" }
      }))))
    )), liveSt && h("div", {
    className: "px-6 pb-1",
    style: { fontFamily: F_BODY, fontSize: 11, color: live ? "#95d16f" : "#f0b06a" }
  }, "🎙 " + liveSt), h("div", {
    className: "shrink-0 flex items-center gap-2 px-4 py-3",
    style: {
      paddingBottom: "calc(env(safe-area-inset-bottom) + 4px)"
    }
  }, canLive && h("button", {
    onClick: () => live ? lvStop() : lvStart(),
    className: "shrink-0 flex items-center justify-center",
    style: { width: 42, height: 42, borderRadius: 999, background: live ? "#4a9d6e" : "rgba(255,255,255,0.2)" }
  }, h(Svg, { size: 18, color: "#fff", sw: 2 }, h("path", { d: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" }), h("path", { d: "M5 11a7 7 0 0 0 14 0" }), h("path", { d: "M12 18v3" }))), h("input", {
    value: input,
    onChange: e => setInput(e.target.value),
    onKeyDown: e => e.key === "Enter" && send(),
    placeholder: "说点什么…",
    className: "flex-1 outline-none px-4 py-2.5 rounded-full",
    style: {
      fontFamily: F_BODY,
      fontSize: 14,
      color: "#fff",
      background: "rgba(255,255,255,0.14)",
      border: "none",
      minWidth: 0
    }
  }), h("button", {
    onClick: send,
    disabled: sending || !input.trim(),
    className: "disabled:opacity-40 shrink-0 flex items-center justify-center",
    style: {
      width: 42,
      height: 42,
      borderRadius: 999,
      background: "rgba(255,255,255,0.2)"
    }
  }, h(ISend, {
    size: 17,
    color: "#fff"
  })), h("button", {
    onClick: () => onHangup(secRef.current, "me"),
    className: "shrink-0 flex items-center justify-center",
    style: {
      width: 42,
      height: 42,
      borderRadius: 999,
      background: "#e0524a"
    }
  }, h(Svg, {
    size: 20,
    color: "#fff",
    sw: 2,
    style: {
      transform: "rotate(135deg)"
    }
  }, h("path", {
    d: "M22 16.9v3a2 2 0 01-2.2 2A19.8 19.8 0 013.1 4.2 2 2 0 015 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L9 11.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"
  })))));
}
// 匿名问答的夜色（她 2026-08-30:「UI 和背景也弄符合主题一点」）。
// 匿名是【夜里投进去的一张纸条】：整块地方比 app 别处暗一档，像半夜亮着的一个页面。
// 底下压着两团很淡的光和一层极细的横扫线（老显示器那种），字全部换成亮色。
const ANON_INK = {
  bg: "#161b26", card: "rgba(255,255,255,.055)", card2: "rgba(255,255,255,.085)",
  line: "rgba(226,232,246,.13)", ink: "#e9ecf4", sub: "rgba(233,236,244,.74)",
  fog: "rgba(233,236,244,.44)", hot: "#e08a7a", cool: "#8fa4e0"
};
function anonNightBg() {
  return [
    "repeating-linear-gradient(0deg, rgba(255,255,255,.018) 0px, rgba(255,255,255,.018) 1px, transparent 1px, transparent 3px)",
    "radial-gradient(78% 44% at 8% -4%, rgba(120,104,168,.34), transparent 64%)",
    "radial-gradient(72% 42% at 100% 22%, rgba(58,104,142,.30), transparent 66%)",
    "radial-gradient(120% 78% at 50% 46%, rgba(8,10,16,0) 40%, rgba(8,10,16,.55) 100%)",
    "linear-gradient(168deg, #1b2130 0%, #161b26 52%, #11151e 100%)"
  ].join(", ");
}
// 匿名问答正门：全角色聚合。详情仍复用原来的单角色匿名主页，旧 x_anon 数据原样沿用。
// 布局遵守 mobile-ui-layout：紧凑顶栏 + 唯一主滚动容器；滚动位置离开后可恢复。
function AnonHub({ characters, data, busy, poolCount, onBrew, onOpen, onBack }) {
  const t = useTheme();
  const A = ANON_INK;
  const scrollRef = useRef(null);
  useEffect(function () {
    const n = Number(sessionStorage.getItem("x_anonHubScroll") || 0);
    if (scrollRef.current && n > 0) scrollRef.current.scrollTop = n;
  }, []);
  const rows = (characters || []).map(function (char) {
    const d = data && data[char.id] || {};
    const records = d.records || [];
    return { char, d, records, latest: records[0] || null };
  });
  return h("div", { className: "absolute inset-0 z-20 flex flex-col", style: { background: anonNightBg(), paddingTop: "env(safe-area-inset-top)" } },
    h("div", { className: "shrink-0 px-5 flex items-center justify-between", style: { height: 62, borderBottom: `1px solid ${A.line}` } },
      h("button", { onClick: onBack, className: "active:opacity-50", "aria-label": "返回" }, h(IArrow, { size: 19, color: A.ink })),
      h("div", { style: { textAlign: "center" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: A.ink } }, "匿名问答"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: ".16em", color: A.fog, marginTop: 1 } }, "ANONYMOUS Q&A")),
      h("div", { style: { width: 19 } })),
    h("div", { ref: scrollRef, onScroll: function (e) { sessionStorage.setItem("x_anonHubScroll", String(e.currentTarget.scrollTop || 0)); }, className: "flex-1 min-h-0 overflow-y-auto px-5 pt-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.65, color: A.sub, marginBottom: 12 } }, "每个人都有自己的匿名马甲。挑一个人进去看回答，或匿名问 Ta 一句话。"),
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "11px 13px", borderRadius: 14, background: A.card, border: `1px solid ${A.line}` } },
        h("div", { className: "min-w-0 flex-1" },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: A.ink } }, "匿名题库 · 还剩 " + (poolCount || 0) + " 条"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, lineHeight: 1.55, color: A.fog, marginTop: 2 } },
            "写这些问题的人不知道会是谁收到——所以它问不出你的身份，也没法照着答案倒着编。抽空了会自己补。")),
        h("button", { onClick: onBrew, disabled: busy, className: "shrink-0 active:opacity-70",
          style: { fontFamily: F_BODY, fontSize: 11.5, color: A.ink, border: `1px solid ${A.line}`, borderRadius: 999, padding: "6px 13px", opacity: busy ? .5 : 1 } }, busy ? "…" : "攒一批")),
      rows.length ? h("div", { className: "grid grid-cols-2 gap-3" }, rows.map(function (row) {
        const r = row.latest;
        return h("button", { key: row.char.id, onClick: function () { onOpen(row.char); }, className: "text-left active:opacity-70", style: { minHeight: 174, borderRadius: 18, overflow: "hidden", background: A.card, border: `1px solid ${A.line}`, boxShadow: "0 8px 24px rgba(35,31,27,.045)", display: "flex", flexDirection: "column" } },
          h("div", { style: { height: 58, flexShrink: 0, padding: "11px 12px", background: "linear-gradient(150deg,#7b6690,#3f6d8c)", color: "#fff", display: "flex", alignItems: "center", gap: 9, boxShadow: "inset 0 1px 0 rgba(255,255,255,.16)" } },
            h(Avatar, { character: row.char, size: 38, radius: 11 }),
            h("div", { style: { minWidth: 0 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, row.d.netname || row.char.remark || row.char.name),
              h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, opacity: .76, marginTop: 2 } }, row.records.length + " 则问答"))),
          h("div", { style: { padding: "12px 12px 13px", flex: 1, display: "flex", flexDirection: "column" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, lineHeight: 1.45, color: A.fog, minHeight: 31, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, row.d.bio || "点开生成 Ta 的匿名马甲"),
            h("div", { style: { marginTop: "auto", paddingTop: 9, borderTop: `1px solid ${A.line}`, fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.45, color: r ? A.sub : A.fog, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, r ? r.q : busy ? "正在准备…" : "还没有人问过 Ta")));
      })) : h(Empty, { text: "还没有可以问的人" })));
}

// 匿名箱：仿 QQ 主页 + 匿名问答，记录永久保留
function AnonBox({
  char,
  data,
  busy,
  onGenNetizen,
  onRefreshPersona,
  onDrop,
  onOpenBox,
  myMask,
  onGenMask,
  onDelRecord,
  onClose
}) {
  const t = useTheme();
  const A = ANON_INK;
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [replyTo, setReplyTo] = useState(null);   // 正在追问哪一条
  const [tab, setTab] = useState("all");          // all | me | netizen
  const [showTop, setShowTop] = useState(false);
  const scrollRef = useRef(null);
  const records = data && data.records || [];
  const pending = records.filter(function (r) { return r.pending; });
  const shown = records.filter(function (r) { return tab === "all" || (tab === "me" ? r.from === "me" : r.from !== "me"); });
  const byId = {};
  records.forEach(function (r) { byId[r.id] = r; });
  // 问的时候【只放进箱子】，不当场调用——攒够了再让他一次性打开（她 2026-08-30 要的）
  const submitAsk = () => {
    if (q.trim()) {
      onDrop(q.trim(), replyTo);
      setQ("");
      setAsking(false);
      setReplyTo(null);
    }
  };
  const dayOf = ts => { const d = new Date(ts || 0); return (d.getMonth() + 1) + "月" + d.getDate() + "日"; };
  return h("div", {
    className: "absolute inset-0 z-[70] flex flex-col",
    style: {
      background: anonNightBg(),
      paddingTop: "env(safe-area-inset-top)"
    }
  }, h("div", {
    className: "shrink-0 px-5 pt-5 pb-3 flex items-center gap-3",
    style: {
      borderBottom: `1px solid ${A.line}`
    }
  }, h("button", {
    onClick: onClose,
    className: "active:opacity-50"
  }, h(IArrow, {
    size: 19,
    color: A.ink
  })), h("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 20,
      color: A.ink
    }
  }, "匿名箱")), h("div", {
    ref: scrollRef,
    onScroll: e => setShowTop(e.target.scrollTop > 340),
    className: "flex-1 overflow-y-auto relative"
  }, h("div", {
    style: {
      position: "relative",
      height: 120,
      background: "linear-gradient(135deg,#6d5a78,#3f6d8c)"
    }
  }, h("div", {
    className: "absolute flex items-end gap-3",
    style: {
      left: 20,
      bottom: -28
    }
  }, h(Avatar, {
    character: char,
    size: 62,
    radius: 16
  }), h("div", {
    style: {
      paddingBottom: 6
    }
  }, h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 18,
      color: "#fff",
      textShadow: "0 1px 4px rgba(0,0,0,0.3)"
    }
  }, data && data.netname || "…"))), h("button", {
    onClick: onRefreshPersona,
    disabled: busy,
    title: "按此刻心情/成长刷新网名与签名",
    className: "absolute active:opacity-60 disabled:opacity-40",
    style: { right: 14, top: 12, width: 32, height: 32, borderRadius: 999, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }
  }, h(IRefresh, { size: 16, color: "#fff" })), data && data.bgDesc && h("div", {
    className: "absolute",
    style: { left: 20, top: 12, right: 56, fontFamily: F_BODY, fontSize: 10.5, lineHeight: 1.4, color: "rgba(255,255,255,0.85)", textShadow: "0 1px 3px rgba(0,0,0,0.4)" }
  }, "🖼 主页背景 · " + data.bgDesc)), h("div", {
    className: "px-5 pt-10 pb-4",
    style: {
      borderBottom: `1px solid ${A.line}`
    }
  }, h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 13,
      color: A.sub,
      lineHeight: 1.6
    }
  }, data && data.bio || "（生成中…）")),
  // 他看完箱子之后心里冒出来的那句猜测（第 7 条：我也有马甲，他会猜这马甲是谁）
  data && data.guess ? h("div", { className: "mx-5 mt-3 px-3 py-2.5", style: { borderRadius: 10, background: "rgba(143,164,224,.12)", border: `1px dashed ${A.line}` } },
    h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: A.fog, marginBottom: 3 } }, "Ta 好像在猜你是谁"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, color: A.cool } }, data.guess)) : null,
  // 我的马甲：他答的时候对着这个身份说话
  h("div", { className: "px-5 pt-4 pb-1 flex items-center gap-2" },
    h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: A.fog, flexShrink: 0 } }, "你的马甲"),
    h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: myMask ? A.ink : A.fog, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, myMask ? myMask.name : "还没有"),
    myMask && myMask.bio ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: A.fog, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, myMask.bio) : h("span", { style: { flex: 1 } }),
    h("button", { onClick: onGenMask, disabled: busy, className: "active:opacity-60 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: 10.5, color: A.cool, background: "none", border: `1px solid ${A.line}`, borderRadius: 8, padding: "2px 9px", flexShrink: 0 } }, myMask ? "换一个" : "生成")),
  h("div", {
    className: "px-5 py-3 flex gap-3",
    style: {
      borderBottom: `1px solid ${A.line}`
    }
  }, h("button", {
    onClick: onGenNetizen,
    disabled: busy,
    className: "flex-1 py-2.5 disabled:opacity-40 active:opacity-70",
    style: {
      borderRadius: 8,
      background: A.card,
      border: `1px solid ${A.line}`,
      fontFamily: F_BODY,
      fontSize: 12.5,
      color: A.ink
    }
  }, "网友匿名提问"), h("button", {
    onClick: () => { setReplyTo(null); setAsking(v => !v); },
    disabled: busy,
    className: "flex-1 py-2.5 disabled:opacity-40 active:opacity-70",
    style: {
      borderRadius: 8,
      background: A.card,
      border: `1px solid ${A.line}`,
      fontFamily: F_BODY,
      fontSize: 12.5,
      color: A.ink
    }
  }, "写一条放进箱子")),
  // 箱子里积着几条没看的 → 一次调用全答完
  pending.length ? h("div", { className: "px-5 pb-3" },
    h("button", { onClick: onOpenBox, disabled: busy, className: "w-full py-2.5 disabled:opacity-40 active:opacity-70", style: { borderRadius: 8, background: A.ink, color: A.bg, fontFamily: F_BODY, fontSize: 12.5 } },
      "让 Ta 打开箱子（" + pending.length + " 条等着）"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: A.fog, marginTop: 5, lineHeight: 1.6 } }, "一次看完，一次答完——他不一定每条都答。")) : null,
  asking && h("div", {
    className: "px-5 py-3",
    style: {
      borderBottom: `1px solid ${A.line}`
    }
  },
    replyTo && byId[replyTo] ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: A.fog, marginBottom: 6, lineHeight: 1.55 } }, "追问 · 针对 Ta 那句「" + String(byId[replyTo].a || "").slice(0, 28) + "…」") : null,
    h("div", { className: "flex gap-2" },
      h("input", {
        value: q,
        onChange: e => setQ(e.target.value),
        onKeyDown: e => e.key === "Enter" && submitAsk(),
        autoFocus: true,
        placeholder: replyTo ? "再追问一句…" : "匿名问 Ta 一个问题…",
        className: "flex-1 outline-none px-3 py-2 rounded-lg",
        style: {
          fontFamily: F_BODY,
          fontSize: 13,
          background: A.card,
          color: A.ink,
          border: `1px solid ${A.line}`
        }
      }), h("button", {
        onClick: submitAsk,
        className: "px-4 rounded-lg",
        style: {
          background: A.ink,
          color: A.bg,
          fontFamily: F_BODY,
          fontSize: 12
        }
      }, "放进去"))), busy && h(Spinner, {
    label: "匿名箱处理中…"
  }),
  // 我问的 / 网友问的分开看（她 2026-08-30 点名）
  records.length ? h("div", { className: "px-5 pt-3 pb-1 flex gap-2" },
    [["all", "全部", records.length], ["me", "我问的", records.filter(function (r) { return r.from === "me"; }).length], ["netizen", "网友问的", records.filter(function (r) { return r.from !== "me"; }).length]]
      .map(function (x) {
        return h("button", { key: x[0], onClick: function () { setTab(x[0]); }, className: "active:opacity-70",
          style: { fontFamily: F_BODY, fontSize: 11.5, padding: "4px 11px", borderRadius: 999, border: `1px solid ${tab === x[0] ? "transparent" : A.line}`, background: tab === x[0] ? A.ink : "transparent", color: tab === x[0] ? A.bg : A.sub } },
          x[1] + (x[2] ? " " + x[2] : ""));
      })) : null,
  records.length === 0 && !busy && h(Empty, {
    text: "匿名箱还是空的",
    sub: "让网友匿名提问，或写一条放进箱子"
  }),
  shown.map(function (r, i) {
    const src = r.re && byId[r.re];
    return h("div", { key: r.id || i, className: "px-5 py-4", style: { borderBottom: `1px solid ${A.line}` } },
      h("div", { className: "flex items-center gap-1.5 mb-1.5" },
        h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: A.bg, background: r.from === "me" ? A.hot : A.cool, borderRadius: 999, padding: "1px 8px", flexShrink: 0 } },
          r.from === "me" ? "我问的" : "网友问的"),
        // 日期 + 相对时间：她 2026-08-30「每个带日期」
        h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: A.fog } }, dayOf(r.ts) + " · " + timeAgo(r.ts)),
        onDelRecord && h("button", { onClick: () => onDelRecord(r.id || r.ts), className: "active:opacity-50", style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 11, color: A.hot } }, "删除")),
      src ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: A.fog, marginBottom: 4, paddingLeft: 10, borderLeft: `2px dashed ${A.line}` } }, "追问 · 「" + String(src.a || src.q || "").slice(0, 30) + "…」") : null,
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: A.ink, marginBottom: 6 } }, r.q),
      // 三种收场：还没看 / 看了不答 / 答了
      r.pending
        ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: A.fog, paddingLeft: 10, borderLeft: `2px dashed ${A.line}` } }, "还在箱子里，等 Ta 打开")
        : r.skip
          ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: A.fog, paddingLeft: 10, borderLeft: `2px solid ${A.hot}66`, fontStyle: "italic" } }, r.note ? "（" + r.note + "）" : "（Ta 看见了，没答）")
          : h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.6, color: A.sub, paddingLeft: 10, borderLeft: `2px solid ${A.line}` } }, r.a),
      // 追问：接着这一条再问一句，同样先放进箱子
      (!r.pending && !r.skip && r.a) ? h("button", {
        onClick: () => { setReplyTo(r.id); setQ(""); setAsking(true); if (scrollRef.current) scrollRef.current.scrollTo({ top: 0, behavior: "smooth" }); },
        className: "active:opacity-60",
        style: { marginTop: 8, marginLeft: 10, fontFamily: F_BODY, fontSize: 11, color: A.cool, background: "none", border: `1px solid ${A.line}`, borderRadius: 8, padding: "3px 10px" }
      }, "追问一句") : null);
  })), showTop && h("button", {
    onClick: () => scrollRef.current && scrollRef.current.scrollTo({ top: 0, behavior: "smooth" }),
    className: "active:opacity-60",
    style: { position: "absolute", right: 16, bottom: 22, width: 42, height: 42, borderRadius: 999, background: A.ink, color: A.bg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.25)", zIndex: 20 }
  }, h("span", { style: { fontSize: 20, fontWeight: 700, lineHeight: 1 } }, "↑")));
}
// 转账卡片：待接受/已收/已退回；收款方 pending 时可接受/退回
// 礼物卡（送礼/转赠）——送角色的显示送达倒计时
function giftFmtLeft(ms) {
  if (ms <= 0) return "即将送达";
  const m = Math.floor(ms / 60000);
  if (m >= 60) { const hh = Math.floor(m / 60); return hh + "小时" + (m % 60 ? (m % 60) + "分" : ""); }
  const s = Math.ceil(ms / 1000);
  return m > 0 ? m + "分" + (s % 60) + "秒" : (s % 60) + "秒";
}
// 进聊天必须落在最新一条上。旧写法是「立刻 + 60ms + 280ms」三枪定时器——
// 但头像、自拍、表情、贴纸、聊天背景、网页字体全是异步的：它们加载完内容会变高，
// 而这三枪早打完了，于是停在半空，她得自己往下翻（她 2026-08-25 报）。
// 改成【盯着内容高度】：进入后的一小段窗口里，内容一变高就重新落底。
// ⚠️她一旦自己往上翻就立刻停手，绝不跟她抢滚动条。
function pinToBottom(el, ms) {
  if (!el) return () => {};
  let stopped = false, lastH = -1;
  const halt = () => { stopped = true; };
  const pin = () => {
    if (stopped || !el.isConnected) return;
    if (el.scrollHeight !== lastH) { lastH = el.scrollHeight; el.scrollTop = el.scrollHeight; }
  };
  const opt = { passive: true };
  // 她自己动手的三种方式；纯 touchstart（点一下气泡）不算，所以听 touchmove
  el.addEventListener("touchmove", halt, opt);
  el.addEventListener("wheel", halt, opt);
  el.addEventListener("keydown", halt);
  // 图片解码完成会冒到这里（capture 才收得到 img 的 load）——这是最准的一枪
  el.addEventListener("load", pin, true);
  pin();
  const iv = setInterval(pin, 80);           // 字体/布局这类没有 load 事件的兜底
  const done = setTimeout(halt, ms || 2500);
  return () => {
    stopped = true;
    clearInterval(iv); clearTimeout(done);
    el.removeEventListener("touchmove", halt, opt);
    el.removeEventListener("wheel", halt, opt);
    el.removeEventListener("keydown", halt);
    el.removeEventListener("load", pin, true);
  };
}
// 外语气泡：点一下把气泡撑开、下面显示中文（她 2026-08-25 要的，形状照抄上面的语音转文字）。
// 绝大多数消息是中文 → translatableLang 返回空串 → 直接把原字符串还回去，不多包一层 DOM、零开销。
// 点了才调 API（她按次计费），译文按原文缓存，同一句再出现免费。
// zhReady = 模型生成这条的时候自己带出来的中译（双语开关，v56.56）。
// 有它就不再跑免费接口——那东西把「傘さすか迷うレベルで湿気すごい」翻成
// 「您可能会迷失在雨伞中」；说这句话的人自己译，根本不是一个水平。
// 译键的位置和展开样式一个字不改：她 2026-08-26 说了「我喜欢在旁边可以按翻译」。
function TransText({ text, isU, zhReady }) {
  const t = useTheme();
  const _lang = typeof translatableLang === "function" ? translatableLang(text) : "";
  // 自带中译时哪怕探不出语种也要给译键：模型都判定这句不是中文了，比正则准
  const lang = zhReady ? (_lang || "外语") : _lang;
  const [open, setOpen] = useState(false);
  const cached = lang && !zhReady && typeof transCacheGet === "function" ? transCacheGet(text) : null;
  const [zh, setZh] = useState(() => zhReady || (cached && cached.zh) || "");
  const [by, setBy] = useState(() => zhReady ? "他自己给的" : (cached && cached.by) || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // ⚠️提前 return 必须排在所有 hook 之后：卡在 useEffect 前面就是条件调用 hook，
  // 同一条消息文字一变（编辑过）hook 数量就对不上，React 会当场炸。
  const run = async () => {
    if (zh || busy) return;
    setBusy(true); setErr("");
    // 长消息走切块版：免费接口是 GET 带 query，整段太长会被截断或直接失败
    try { const r = await translateLongToZh(text, lang); setZh(r.zh); setBy(r.by || ""); }
    catch (x) { setErr(String((x && x.message) || x)); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (open && lang) run(); }, [open, lang]);
  if (!lang) return text;
  const fg = isU ? BUBBLE_SKIN.myText : (BUBBLE_SKIN.charText || t.ink);
  const MONO = "'Archivo','SF Mono',ui-monospace,monospace";
  const tap = e => { e.stopPropagation(); setOpen(v => !v); };
  return h("span", null,
    h("span", { onClick: tap, style: { cursor: "pointer" } }, text),
    h("span", {
      onClick: tap, className: "active:opacity-60",
      style: { display: "inline-block", marginLeft: 6, verticalAlign: "middle", cursor: "pointer",
        fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.08em", lineHeight: 1.6,
        padding: "0 5px", borderRadius: 5, border: "1px solid " + fg, opacity: 0.42, color: fg }
    }, open ? "收起" : "译"),
    open && h("span", { style: { display: "block", marginTop: 8, paddingTop: 7, borderTop: "1px solid " + (isU ? "rgba(0,0,0,0.13)" : t.line) } },
      h("span", { style: { display: "block", fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.25em", color: fg, opacity: 0.45, marginBottom: 4 } }, "译自" + lang + (by ? " · " + by : "")),
      h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 14, lineHeight: 1.55, color: fg, opacity: err ? 0.75 : 1 } },
        busy ? "翻译中…" : err ? "翻译失败：" + err : (zh || "（没有译文）"))));
}
// 语音消息（v60.17 她 2026-09-02：「这个语音也是参考别人的，也改成我们自己的吧」）
//
// 原来这条长这样：一排七根固定高度的柱子 + AUDIO_MEMO.WAV + 时长，
// 展开写着 TRANSCRIPT，合成中写着 SYNTH…。跟经纬度那次是同一个病——
//   · **根本没有那个文件**。AUDIO_MEMO.WAV 是凭空写的一个文件名，
//     这条消息是一句话，不是硬盘上的一段采样。
//   · 那七根柱子 `[4,9,6,12,7,10,5]` **每一条语音都一模一样**：
//     它不是这句话的波形，是一张贴纸。说一个字和说三十个字长得没有区别。
//   · 三处英文机器标签（AUDIO_MEMO.WAV／SYNTH…／TRANSCRIPT）是那套长相的一部分。
// 现在只留真东西：这句话【自己的】波形（长短、起伏都从这句话本身算出来）、
// 多长、他用什么语气说的（模型每条都标了 emo，一直只喂给 TTS，从没给她看过）。
// ⚠️语气写在【展开之后】那一行，不留在收起来那一行:
//   「声音低下去了」六个字比波形还宽,一秒的气泡会被它撑得跟六秒的一样长
//   (她 2026-09-02:「这两秒一秒的太长了吧」)。收起来时这条只说一件事——多长。
//   展开之后它跟转文字长在一起,读起来也是一句话:「他笑着说的」+ 那句话。
const VOICE_EMO_ZH = { happy: "笑着说的", sad: "声音低下去了", angry: "带着火气", fearful: "声音发紧", disgusted: "语气嫌恶", surprised: "有点意外" };
// 这一条自己的波形：根数按时长走(说得久柱子就多)，高低按这句话的字算——
// 同一句话每次画出来一样，不同的话长得不一样。
// ⚠️根数的下限就是这条气泡的长度下限(她 2026-09-02:「这两秒一秒的太长了吧」)：
//   原来下限 9 根、外面还写死 minWidth:196，于是一秒和六秒一样长，
//   一句「嗯」占掉大半行——语音条的长度本来就该是「他说了多久」，这是它唯一在说的事。
function voiceBars(text, dur) {
  const src = String(text || "");
  const n = Math.max(4, Math.min(34, Math.round((Number(dur) || 2) * 2.4)));
  const out = [];
  for (let k = 0; k < n; k++) {
    const c = src.charCodeAt(k % Math.max(1, src.length)) || 0;
    // 两个错开的取样合起来，免得中文连着几个同部首的字画出一条平线
    const v = (c * 7 + src.charCodeAt((k * 3 + 1) % Math.max(1, src.length)) * 3 + k * 11) % 100;
    out.push(4 + Math.round(v / 100 * 11));   // 4~15px
  }
  return out;
}
function VoiceMsg({ m, isU, speaker }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [pSt, setPSt] = useState("idle"); // idle | gen | playing
  const [pErr, setPErr] = useState(null);
  const audRef = useRef(null);
  useEffect(() => () => { if (audRef.current) { try { audRef.current.pause(); } catch (e) {} } }, []);
  const dur = m.dur || Math.max(1, Math.round(String(m.content || "").replace(/\s/g, "").length / 3));
  const mmss = Math.floor(dur / 60) + ":" + String(dur % 60).padStart(2, "0");
  const fg = isU ? "#16330a" : t.ink;
  const bars = voiceBars(m.content, dur);
  const emoZh = VOICE_EMO_ZH[m.emo] || "";
  // 有配语音 API + 这个角色选了音色 → 才显示播放按钮（懒生成：点了才合成收费，缓存后重播免费）
  const canTts = !isU && speaker && speaker.voiceId && m.content && typeof ttsReady === "function" && ttsReady();
  const playTts = async e => {
    e.stopPropagation();
    if (pSt === "gen") return;
    if (pSt === "playing") { try { audRef.current && audRef.current.pause(); } catch (x) {} setPSt("idle"); return; }
    const aud = new Audio();
    audRef.current = aud;
    aud.play().catch(() => {}); // 在用户手势里先解锁 iOS 音频，真数据到了才播
    setPErr(null); setPSt("gen");
    try {
      const blob = await ttsSpeak(m.content, speaker.voiceId, { emo: m.emo }); // v48.31 作者标注的语气优先
      const url = URL.createObjectURL(blob);
      aud.src = url;
      aud.onended = () => { setPSt("idle"); URL.revokeObjectURL(url); };
      aud.onerror = () => { setPSt("idle"); setPErr("音频播放失败"); URL.revokeObjectURL(url); };
      await aud.play();
      setPSt("playing");
    } catch (err) {
      setPSt("idle"); setPErr(String((err && err.message) || err)); setOpen(true);
    }
  };
  const line = isU ? "rgba(0,0,0,0.13)" : t.line;
  // ⚠️没有 minWidth：宽度由内容(播放键+这条自己的波形+时长)自己撑出来，
  //   于是「多长」这件事在列表里一眼看得见——一秒的就是一小截。
  return h("div", { onClick: () => setOpen(o => !o), className: "active:opacity-80 cursor-pointer", style: { maxWidth: "100%", borderRadius: 15, overflow: "hidden", background: isU ? BUBBLE_SKIN.myBg : t.bg2, border: isU ? "none" : `1px solid ${t.line}` } },
    h("style", null, "@keyframes vm-bar{0%,100%{transform:scaleY(.55)}50%{transform:scaleY(1.25)}}"),
    h("div", { className: "flex items-center gap-2.5 px-3.5", style: { minHeight: 42, paddingTop: 8, paddingBottom: 8 } },
      canTts ? h("button", {
        onClick: playTts, className: "active:opacity-60 shrink-0",
        style: { width: 27, height: 27, borderRadius: 999, border: "none", background: fg, display: "flex", alignItems: "center", justifyContent: "center" }
      }, pSt === "gen"
        ? h("span", { style: { width: 9, height: 9, borderRadius: 2, border: "1.6px solid " + (isU ? BUBBLE_SKIN.myBg : t.bg2), borderTopColor: "transparent", animation: "wk-spin .7s linear infinite" } })
        : h(Svg, { size: 12, color: isU ? BUBBLE_SKIN.myBg : t.bg2, sw: 0 },
            pSt === "playing"
              ? h("path", { d: "M8.5 5.5h2.6v13H8.5zM12.9 5.5h2.6v13h-2.6z", fill: isU ? BUBBLE_SKIN.myBg : t.bg2 })
              : h("path", { d: "M8.5 5.2l9.5 6.8-9.5 6.8z", fill: isU ? BUBBLE_SKIN.myBg : t.bg2 }))) : null,
      // 这一条自己的波形：长短起伏都是这句话算出来的，不是七根一成不变的贴纸
      h("div", { className: "flex items-center", style: { gap: 2, height: 16, minWidth: 0, overflow: "hidden", flexShrink: 1 } },
        bars.map((hh, j) => h("span", {
          key: j,
          style: { width: 2, height: hh, borderRadius: 2, background: fg, flexShrink: 0,
            opacity: pSt === "playing" ? 0.95 : 0.5,
            animation: pSt === "playing" ? "vm-bar .9s ease-in-out infinite" : "none",
            animationDelay: pSt === "playing" ? (j * 0.055) + "s" : undefined }
        }))),
      h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: fg, opacity: 0.7, flexShrink: 0 } }, mmss)),
    open && h("div", { className: "px-3.5 pb-3", style: { borderTop: `1px solid ${line}` } },
      pErr ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#c25a4a", margin: "8px 0 2px" } }, "没出声：" + pErr) : null,
      h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: fg, opacity: 0.45, margin: "8px 0 5px" } },
        (isU ? "我" : (window.PhonePronoun && speaker ? window.PhonePronoun.ta(speaker) : "TA")) + (emoZh || "说的是")),
      h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.55, color: fg } }, m.content || "")));
}
// 气泡上的播放键(v60.29 她 2026-09-02 要的)
// 「能不能给他气泡上面显示一个播放键跟比如塔罗差不多，这样我才知道哪些是缓存过的，
//   而且不用每次长按才能听」——两件事：**常驻**，而且**分得出花没花过钱**。
// 听过的那一句在 IDB 里躺着，重播免费；没听过的点一下才去合成、才收费。
// 所以实心＝听过了随便点，空心＝这一下要花一次。
const _ttsSeen = new Map();
// ⚠️光有这张表不够：合成成功时这一颗点【已经挂在屏幕上】了，
//   它的 cached 是自己的 state，表里改了它不会知道——点完一次还是空心的，
//   下次进这个聊天才变实。所以记一笔要通知出去。
const _ttsSubs = new Set();
const ttsMemoKey = (text, voiceId, emo) => String(voiceId || "") + "|" + String(emo || "") + "|" + String(text || "");
const markTtsCached = (text, voiceId, emo) => {
  _ttsSeen.set(ttsMemoKey(text, voiceId, emo), true);
  _ttsSubs.forEach(f => { try { f(); } catch (e) {} });
};
function TtsBubbleDot({ text, voiceId, emo, st, onTap }) {
  const t = useTheme();
  const key = ttsMemoKey(text, voiceId, emo);
  const [cached, setCached] = useState(() => !!_ttsSeen.get(key));
  useEffect(() => {
    if (_ttsSeen.has(key)) { setCached(!!_ttsSeen.get(key)); return; }
    if (typeof ttsCached !== "function") return;
    let dead = false;
    // 只读缓存，不打上游，不花钱；查过一次就记在这张表里，别每次重绘都翻一遍 IDB
    ttsCached(text, voiceId, { emo: emo }).then(v => { _ttsSeen.set(key, v); if (!dead) setCached(v); }).catch(() => {});
    return () => { dead = true; };
  }, [key]);
  useEffect(() => {
    const f = () => setCached(!!_ttsSeen.get(key));
    _ttsSubs.add(f);
    return () => { _ttsSubs.delete(f); };
  }, [key]);
  // ⚠️v60.33 换了位置和长相（她 2026-09-02：「现在放的略丑，难道只能隐藏它不要这个键了嘛」）：
  //   原来是一颗悬在气泡右边的圆钮——它自己占一格、把整行撑宽，
  //   在一列气泡里像个没归属的黑点。现在落进气泡底下那一行【和「已读 20:19」并排】：
  //   那本来就是这条消息的页脚，「这条能听」正是该待在那儿的信息，字号字色都跟它一致。
  const on = st === "playing" || st === "gen";
  const ink = st === "gen" ? t.fog : (cached || on) ? t.tint : t.fog;
  const label = st === "gen" ? "合成中" : st === "playing" ? "停" : cached ? "听一下" : "听一下";
  return h("button", {
    onClick: e => { e.stopPropagation(); onTap(); },
    "aria-label": cached ? "重播这一句（听过了，不花钱）" : "念出来（这一句要先合成一次）",
    title: cached ? "听过了 · 重播不花钱" : "还没合成过 · 点一下会花一次",
    className: "flex items-center active:opacity-60",
    // 可点区域比看上去大一圈（负 margin 抵掉，排版一点不变）。
    // ⚠️没做到 40px：再往上撑就会盖住气泡底边，而长按气泡是核心操作，不能被它抢走。
    style: { gap: 3, padding: "5px 6px", margin: "-3px -6px", background: "transparent", border: "none",
      fontFamily: F_BODY, fontSize: 9.5, color: ink, opacity: cached || on ? 1 : 0.75 }
  },
    h(Svg, { size: 9, color: ink, sw: 0 },
      st === "playing"
        ? h("path", { d: "M8.5 5.5h2.6v13H8.5zM12.9 5.5h2.6v13h-2.6z", fill: ink })
        : cached
          ? h("path", { d: "M8.5 5.2l9.5 6.8-9.5 6.8z", fill: ink })
          // 还没合成过：空心三角——形状也不一样，不只靠颜色（色弱和阳光下只剩形状可依）
          : h("path", { d: "M9 6.4l7.4 5.6L9 17.6z", fill: "none", stroke: ink, strokeWidth: 1.6, strokeLinejoin: "round" })),
    h("span", null, label));
}
// 懒 TTS 小播放器（通话台词/转录回听共用）：一次只放一条，点了才合成收费；放过的在 ttsSpeak 缓存里，回听免费
function useTtsPlayer() {
  const [play, setPlay] = useState(null); // {k, st:"gen"|"playing"}
  const audRef = useRef(null);
  useEffect(() => () => { if (audRef.current) { try { audRef.current.pause(); } catch (e) {} } }, []);
  const toggle = async (k, text, voiceId, opts) => {
    if (play && play.st === "gen") return;
    if (play && play.k === k && play.st === "playing") { try { audRef.current && audRef.current.pause(); } catch (e) {} setPlay(null); return; }
    if (audRef.current) { try { audRef.current.pause(); } catch (e) {} }
    const aud = new Audio();
    audRef.current = aud;
    aud.play().catch(() => {}); // 用户手势里先解锁 iOS 音频
    setPlay({ k, st: "gen" });
    try {
      const blob = await ttsSpeak(text, voiceId, opts);
      markTtsCached(text, voiceId, opts && opts.emo);   // 这一句从此免费重播，点亮它
      const url = URL.createObjectURL(blob);
      aud.src = url;
      aud.onended = () => { setPlay(p => p && p.k === k ? null : p); URL.revokeObjectURL(url); };
      aud.onerror = () => { setPlay(p => p && p.k === k ? null : p); URL.revokeObjectURL(url); };
      await aud.play();
      setPlay({ k, st: "playing" });
    } catch (e) { setPlay(null); }
  };
  return { play, toggle };
}
// 转录行的回听小按钮（角色台词旁）：spk 配了音色 + TTS 开着才显示
function TtsDot({ k, text, spk, tp, dark }) {
  const canT = spk && spk.voiceId && text && typeof ttsReady === "function" && ttsReady();
  if (!canT) return null;
  const me = tp.play && tp.play.k === k;
  const c = dark ? "rgba(255,255,255,0.55)" : "currentColor";
  return h("button", {
    onClick: e => { e.stopPropagation(); tp.toggle(k, text, spk.voiceId); },
    className: "active:opacity-60 shrink-0",
    style: { width: 20, height: 20, borderRadius: 999, border: "1.2px solid " + c, display: "inline-flex", alignItems: "center", justifyContent: "center", color: c, fontSize: me && tp.play.st === "gen" ? 8 : 9, background: "transparent", verticalAlign: "middle", marginLeft: 6, opacity: 0.75 }
  }, me ? (tp.play.st === "gen" ? "…" : "⏸") : "▶");
}
// 通话结束气泡：点开回看整通转录（log 由 endCall 存进消息；老消息没 log 就是纯提示条）；sum=挂断后生成的摘要
function CallEndPill({ m, chars }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const tp = useTtsPlayer();
  const spkOf = l => l.senderId && chars ? (chars.find(c => c.id === l.senderId) || null) : null;
  const log = Array.isArray(m.log) ? m.log : [];
  // 「他挂了」和「聊完了」在她这儿完全是两件事，这条回执要认出来(v60.24)
  const label = m.dur ? (m.callMode === "video" ? "视频通话" : "语音通话") + (m.endedBy ? " · " + m.endedBy + "挂断了 · 时长 " : " 已结束 · 时长 ") + m.dur : String(m.content || "").split("\n")[0];
  return h("div", { className: "flex flex-col items-center my-2" },
    h("span", {
      onClick: log.length ? () => setOpen(o => !o) : undefined,
      className: "flex items-center gap-1.5" + (log.length ? " active:opacity-60" : ""),
      style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, background: t.bg2, padding: "4px 12px", borderRadius: 999, border: "1px solid " + t.line, maxWidth: "88%" }
    }, h(PGlyph, { k: m.callMode === "video" ? "video" : "calls", size: 13, color: t.fog }), label + (log.length ? (open ? " · 收起" : " · 回看") : "")),
    // 这一通里拍过的画面留在这儿（她 2026-09-02：「结束了要留在聊天不能没了」）——
    // 电话挂了那张图不该跟着没，它是这通电话的一部分。
    (m.shots || []).length ? h("div", { className: "flex justify-center", style: { gap: 6, marginTop: 7, flexWrap: "wrap", maxWidth: "88%" } },
      m.shots.map(k => h(CallShotThumb, { key: k, imgKey: k }))) : null,
    m.sum && !open ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4, maxWidth: "76%", textAlign: "center", lineHeight: 1.5 } }, m.sum) : null,
    open ? h("div", { style: { marginTop: 8, width: "88%", background: t.bg2, border: "1px dashed " + t.line, borderRadius: 12, padding: "10px 13px", maxHeight: 300, overflowY: "auto" } },
      log.map((l, j) => l.act
        ? h("div", { key: j, style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 11.5, color: t.fog, textAlign: "center", margin: "5px 0" } }, (l.senderName ? l.senderName + " " : "") + "（" + l.content + "）")
        : h("div", { key: j, style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, color: t.ink, margin: "3px 0" } },
            l.ts ? h("span", { style: { fontFamily: "'Archivo','SF Mono',ui-monospace,monospace", fontSize: 9.5, color: t.fog, marginRight: 6 } }, String(new Date(l.ts).getHours()).padStart(2, "0") + ":" + String(new Date(l.ts).getMinutes()).padStart(2, "0")) : null,
            h("span", { style: { color: l.role === "user" ? t.tint : t.sub, fontWeight: 600 } }, (l.role === "user" ? "我" : (l.senderName || "TA")) + "："), l.content,
            l.role !== "user" ? h(TtsDot, { k: "pill" + j, text: l.content, spk: spkOf(l), tp }) : null)),
      m.sum ? h("div", { style: { marginTop: 8, paddingTop: 8, borderTop: "1px dashed " + t.line, fontFamily: F_BODY, fontSize: 11.5, color: t.sub, lineHeight: 1.6 } }, "小结：" + m.sum) : null) : null);
}
// 通话里拍过的那一张：卡上是缩略图，点开看整张
function CallShotThumb({ imgKey }) {
  const t = useTheme();
  const [zoom, setZoom] = useState(false);
  const url = useIdbImgUrl(imgKey);
  if (!url) return null;
  return h(Fragment, null,
    h("img", {
      src: url, alt: "这通电话里的画面", onClick: () => setZoom(true),
      className: "active:opacity-80",
      style: { width: 76, height: 76, objectFit: "cover", borderRadius: 10, border: "1px solid " + t.line, display: "block", cursor: "pointer" }
    }),
    zoom && ReactDOM.createPortal(
      h("div", {
        onClick: () => setZoom(false),
        style: { position: "fixed", inset: 0, zIndex: 300, background: "rgba(12,11,9,.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }
      }, h("img", { src: url, alt: "", style: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" } })),
      document.body));
}
// 通话记录中心（+面板入口）：这个聊天里所有语音/视频通话按时间列出，点一通回看整通转录——不用回聊天里翻楼
function CallLogSheet({ calls, chars, onClose }) {
  const t = useTheme();
  const [openId, setOpenId] = useState(null);
  const tp = useTtsPlayer();
  const spkOf = l => l.senderId && chars ? (chars.find(c => c.id === l.senderId) || null) : null;
  const list = (calls || []).slice().reverse(); // 最新在前
  const fmtFull = ts => { const d = new Date(ts); return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const fmtHM = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  return h(Sheet, { onClose, tall: true },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, marginBottom: 4 } }, "通话记录"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 14 } }, list.length ? "共 " + list.length + " 通 · 点一通回看当时说了什么" : ""),
    list.length === 0
      ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", padding: "34px 0" } }, "还没打过电话。")
      : h("div", { style: { display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" } }, list.map((m, i) => {
          const key = m.id || "c" + i;
          const on = openId === key;
          const log = Array.isArray(m.log) ? m.log : [];
          return h("div", { key, style: { border: "1px solid " + t.line, borderRadius: 14, overflow: "hidden", background: t.bg2, flexShrink: 0 } },
            h("button", { onClick: () => setOpenId(on ? null : key), className: "w-full active:opacity-70 flex items-center gap-2.5", style: { padding: "11px 14px", textAlign: "left", background: "transparent", border: "none" } },
              h(PGlyph, { k: m.callMode === "video" ? "video" : "calls", size: 15, color: t.sub }),
              h("div", { className: "flex-1 min-w-0" },
                h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, (m.callMode === "video" ? "视频通话" : "语音通话") + (m.dur ? " · " + m.dur : "")),
                h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 1 } }, (m.ts ? fmtFull(m.ts) : "") + (log.length ? "" : " · 这通没留转录"))),
              log.length ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, flexShrink: 0 } }, on ? "收起" : "回看") : null),
            on && log.length ? h("div", { style: { borderTop: "1px dashed " + t.line, padding: "10px 14px", maxHeight: 280, overflowY: "auto" } },
              log.map((l, j) => l.act
                ? h("div", { key: j, style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 11.5, color: t.fog, textAlign: "center", margin: "5px 0" } }, (l.senderName ? l.senderName + " " : "") + "（" + l.content + "）")
                : h("div", { key: j, style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, color: t.ink, margin: "3px 0" } },
                    l.ts ? h("span", { style: { fontFamily: "'Archivo','SF Mono',ui-monospace,monospace", fontSize: 9.5, color: t.fog, marginRight: 6 } }, fmtHM(l.ts)) : null,
                    h("span", { style: { color: l.role === "user" ? t.tint : t.sub, fontWeight: 600 } }, (l.role === "user" ? "我" : (l.senderName || "TA")) + "："), l.content,
                    l.role !== "user" ? h(TtsDot, { k: key + "_" + j, text: l.content, spk: spkOf(l), tp }) : null)),
              m.sum ? h("div", { style: { marginTop: 8, paddingTop: 8, borderTop: "1px dashed " + t.line, fontFamily: F_BODY, fontSize: 11.5, color: t.sub, lineHeight: 1.6 } }, "小结：" + m.sum) : null) : null);
        })));
}
// 查找聊天记录（微信式）：关键词 + 类型（语音/图片/转账/通话/位置/红包）+ 按日期定位。
// 点结果/点日期 → 就地展开那天的完整记录（只读简版、命中高亮自动滚到），不用回聊天里翻楼。
// 查找记录「定位到聊天原位」：滚到第 i 条消息并闪一下高亮。
// DOM 早已不是 messages 一对一：顶部可能有「云端旧记录」，CC 回流长段还会拆成多个气泡。
function locateMsgIn(container, i, messages, hasArchiveLead) {
  try {
    let domIndex = hasArchiveLead ? 1 : 0;
    const list = messages || [];
    for (let j = 0; j < i; j++) {
      const m = list[j];
      if (m && m.ledgerImported && !m.recalled && !m.kind && typeof m.content === "string" && /\n\s*\n/.test(m.content)) {
        domIndex += Math.max(1, m.content.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).length);
      } else domIndex++;
    }
    const node = container && container.children && container.children[domIndex];
    if (!node || !node.scrollIntoView) return;
    node.scrollIntoView({ block: "center" });
    const oldT = node.style.transition, oldR = node.style.borderRadius;
    node.style.transition = "background .3s"; node.style.borderRadius = "12px"; node.style.background = "rgba(184,145,80,0.28)";
    setTimeout(() => { node.style.background = "transparent"; setTimeout(() => { node.style.transition = oldT; node.style.borderRadius = oldR; }, 400); }, 1600);
  } catch (e) {}
}
function ChatSearchSheet({ messages, chars, meName, onClose, onLocate, archCount, loadArch }) {
  const t = useTheme();
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState(null);
  const [day, setDay] = useState(null);
  const [focusKey, setFocusKey] = useState(null);
  const hitRef = useRef(null);
  // 云端归档并入搜索（v48.12 她要搜 200 条之外的旧聊天）：点按钮拉一次、缓存住，
  // 归档消息标 cloud=true——搜索/按天浏览都包含，但不能「定位到聊天原位」（本地已经没有那条了）
  const [arch, setArch] = useState(null); // null | "loading" | "error" | [归档消息]
  const pullArch = async () => {
    if (arch === "loading" || Array.isArray(arch)) return;
    setArch("loading");
    try { const arr = loadArch ? await loadArch() : null; setArch(Array.isArray(arr) ? arr : "error"); } catch (e) { setArch("error"); }
  };
  const archMsgs = Array.isArray(arch) ? arch.map((m, i) => ({ m, i, cloud: true })).filter(x => x.m && !x.m.recalled && x.m.kind !== "ooc") : [];
  // 归档在前（时间更早），整体仍按时间先后排
  const msgs = archMsgs.concat((messages || []).map((m, i) => ({ m, i })).filter(x => !x.m.recalled && x.m.kind !== "ooc"));
  const nameOf = m => m.role === "user" ? (meName || "我") : (m.senderName || (chars && chars[0] && (chars[0].remark || chars[0].name)) || "TA");
  const dayOf = ts => { const d = new Date(ts || 0); return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日"; };
  const hm = ts => { const d = new Date(ts || 0); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const kindTag = m => m.kind === "chatforward" ? "💬聊天记录" : m.kind === "voice" ? "🎤语音" : m.kind === "selfie" ? "📷自拍" : m.kind === "photo" ? "📷照片" : m.kind === "transfer" ? "💸转账" : m.kind === "callend" ? "📞通话" : m.kind === "geo" ? "📍位置" : m.kind === "redpacket" ? "🧧红包" : m.kind === "gift" ? "🎁礼物" : m.kind === "emote" ? "表情" : null;
  const textOf = m => m.kind === "transfer" ? ("转账" + (m.amount != null ? " ¥" + m.amount : "") + (m.note ? " · " + m.note : "")) : m.kind === "redpacket" ? ("红包" + (m.message ? " · " + m.message : "")) : m.kind === "geo" ? (m.name || "") : m.kind === "poll" ? (m.title || "") : (m.content || m.desc || "");
  const matchType = m => !typeF ? true : typeF === "image" ? (m.kind === "selfie" || m.kind === "photo") : m.kind === typeF;
  const kw = q.trim();
  const hits = (kw || typeF) ? msgs.filter(x => matchType(x.m) && (!kw || String(textOf(x.m)).indexOf(kw) >= 0)) : [];
  const dayGroups = [];
  { const seen = {}; msgs.forEach(x => { if (!x.m.ts) return; const d = dayOf(x.m.ts); if (!seen[d]) { seen[d] = { day: d, n: 0 }; dayGroups.push(seen[d]); } seen[d].n++; if (x.cloud) seen[d].cloud = true; }); dayGroups.reverse(); }
  const itemKey = x => (x.cloud ? "a:" : "l:") + x.i;
  useEffect(() => { if (day && hitRef.current) setTimeout(() => { try { hitRef.current.scrollIntoView({ block: "center" }); } catch (e) {} }, 80); }, [day, focusKey]);
  const openDay = (d, key) => { setDay(d); setFocusKey(key || null); };
  const dayMsgs = day ? msgs.filter(x => x.m.ts && dayOf(x.m.ts) === day) : [];
  let focused = false;
  return h(Sheet, { onClose, tall: true },
    day
      ? h(Fragment, null,
          h("div", { className: "flex items-center gap-2 shrink-0", style: { marginBottom: 10 } },
            h("button", { onClick: () => setDay(null), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: t.tint, background: "transparent", border: "none" } }, "‹ 返回"),
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, day),
            h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, dayMsgs.length + " 条"),
            onLocate ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginLeft: "auto" } }, "点条目跳到聊天原位") : null),
          h("div", { style: { flex: "1 1 auto", minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" } },
            dayMsgs.map((x, di) => {
              const m = x.m; const tag = kindTag(m); const txt = String(textOf(m));
              const isHit = !focused && focusKey && itemKey(x) === focusKey ? (focused = true) : false;
              const canLoc = onLocate && !x.cloud; // 归档消息本地没有原位，只读
              return h("div", { key: (x.cloud ? "a" + di : "l" + x.i), ref: isHit ? hitRef : null,
                onClick: canLoc ? () => onLocate(x.i) : undefined,
                className: canLoc ? "active:opacity-70" : "",
                style: { padding: "7px 10px", borderRadius: 10, marginBottom: 2, background: isHit ? "rgba(184,145,80,0.16)" : "transparent", cursor: canLoc ? "pointer" : "default" } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 2 } }, hm(m.ts) + " · " + (m.role === "system" && !tag ? "系统" : nameOf(m)) + (tag ? " · " + tag : "") + (x.cloud ? " · ☁ 云端归档" : (onLocate ? " · 定位 ›" : ""))),
                // 自拍带真图（v47.81 她点名「只看到描述看不到图」）：有 imgKey 直接渲染 SelfieBubble
                m.kind === "selfie" && m.imgKey ? h("div", { onClick: e => e.stopPropagation(), style: { margin: "4px 0" } }, h(SelfieBubble, { m: m })) : null,
                h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, txt.slice(0, 300) || "（无文字）"));
            })))
      : h(Fragment, null,
          h("div", { className: "shrink-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, marginBottom: 10 } }, "查找聊天记录"),
            h("input", { value: q, onChange: e => setQ(e.target.value), placeholder: "搜关键词…", style: { width: "100%", outline: "none", padding: "10px 13px", borderRadius: 12, fontFamily: F_BODY, fontSize: 14, background: t.bg, color: t.ink, border: "1px solid " + t.line, marginBottom: 10 } }),
            h("div", { className: "flex flex-wrap", style: { gap: 6, marginBottom: 12 } },
              [[null, "全部"], ["voice", "🎤语音"], ["image", "📷图片"], ["transfer", "💸转账"], ["callend", "📞通话"], ["geo", "📍位置"], ["redpacket", "🧧红包"]].map(p =>
                h("button", { key: String(p[0]), onClick: () => setTypeF(p[0]), className: "active:opacity-70",
                  style: { fontFamily: F_BODY, fontSize: 11.5, padding: "5px 11px", borderRadius: 999, background: typeF === p[0] ? t.ink : t.bg, color: typeF === p[0] ? t.bg2 : t.sub, border: "1px solid " + (typeF === p[0] ? t.ink : t.line) } }, p[1]))),
            archCount > 0 && loadArch ? h("button", { onClick: pullArch, className: "w-full active:opacity-70", disabled: arch === "loading",
              style: { fontFamily: F_BODY, fontSize: 11.5, padding: "8px 11px", borderRadius: 10, marginBottom: 12, textAlign: "center",
                background: Array.isArray(arch) ? "rgba(90,150,90,0.1)" : t.bg, color: Array.isArray(arch) ? "#4a7a4a" : (arch === "error" ? "#b0503f" : t.sub),
                border: "1px dashed " + (Array.isArray(arch) ? "#8ab88a88" : (arch === "error" ? "#c25a4a88" : t.line)) } },
              arch === "loading" ? "☁ 正在拉取云端归档…"
                : Array.isArray(arch) ? ("✓ 已连云端归档一起搜（含更早的 " + arch.length + " 条）")
                : arch === "error" ? "☁ 拉取云端归档失败 · 点击重试"
                : ("☁ 本地只有最近的记录 · 点击连云端归档的 " + archCount + " 条一起搜")) : null),
          h("div", { style: { flex: "1 1 auto", minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" } },
            (kw || typeF)
              ? (hits.length === 0
                ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, textAlign: "center", padding: "26px 0" } }, "没搜到。")
                : hits.slice(-200).reverse().map((x, hi) => {
                    const m = x.m; const tag = kindTag(m); const txt = String(textOf(m));
                    const pos = kw ? txt.indexOf(kw) : -1;
                    const snip = pos > 12 ? "…" + txt.slice(pos - 10, pos + 60) : txt.slice(0, 70);
                    return h("button", { key: (x.cloud ? "a" + hi : "l" + x.i), onClick: () => openDay(dayOf(m.ts), itemKey(x)), className: "w-full active:opacity-70", style: { textAlign: "left", padding: "9px 10px", background: "transparent", border: "none", borderBottom: "1px solid " + t.line } },
                      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 2 } }, dayOf(m.ts) + " " + hm(m.ts) + " · " + nameOf(m) + (tag ? " · " + tag : "") + (x.cloud ? " · ☁ 云端" : "")),
                      h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } }, snip || "（无文字）"));
                  }))
              : h(Fragment, null,
                  h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 8 } }, "或按日期定位（点一天看当天完整记录）"),
                  dayGroups.length === 0 ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, textAlign: "center", padding: "20px 0" } }, "还没聊过。") :
                  dayGroups.map(g => h("button", { key: g.day, onClick: () => openDay(g.day, null), className: "w-full active:opacity-70 flex items-center", style: { textAlign: "left", padding: "11px 10px", background: "transparent", border: "none", borderBottom: "1px solid " + t.line } },
                    h("span", { className: "flex-1", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink } }, g.day + (g.cloud ? " ☁" : "")),
                    h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, g.n + " 条")))))));
}
// 来电（v60.17，她 2026-09-02：「能不能做顶部浮层的来电显示跟微信语音和视频那样
// 然后接听和没接听才有聊天记录卡片回执」）
//
// 原来角色打电话来是在聊天流里落一张【常驻的卡】，上面挂着「接听／拒绝」两个按钮。
// 三处不对：
//   · 电话是【此刻在响】的一件事，不是一条留在记录里的消息。那张卡永远停在那儿，
//     十天后翻回去还写着「点接听进入通话」——按下去真的会打起来。
//   · 只有正在看这个聊天时才看得见。人在主屏或别的聊天里，电话响了完全不知道。
//   · 没接的情况根本没有：不接也不拒，它就永远是「待接听」，聊天记录里没有「未接来电」。
// 现在分成两样东西：【响的时候】是顶部一条浮层，【响完之后】聊天里留一条回执。
const CALL_RING_SEC = 30;                     // 响多久没人接就算未接
const CALL_RING_MS = CALL_RING_SEC * 1000;
// 一条 callinvite 此刻该显示成什么：响着的不进聊天流（浮层在管），响完的才留回执。
// ⚠️没标 answered 又已经过了响铃时长的，一律按【未接】显示——
//   PWA 后台不跑代码，App 关着的时候没人来标记它，光靠标记那一路会漏。
function callInviteState(m) {
  if (m.answered) return m.answered;
  return Date.now() - (Number(m.ts) || 0) > CALL_RING_MS ? "missed" : "ringing";
}
// 顶部来电浮层：一部正在响的电话该有的样子——头像上一圈扩散的铃波，
// 底下一根随时间抽干的细线（那是它还能响多久），两颗真正的话筒键：扣下去的和拿起来的。
function CallRing({ name, avatar, mode, ts, onAccept, onDecline, onMiss }) {
  const t = useTheme();
  const video = mode === "video";
  const [now, setNow] = useState(Date.now());
  // 用挂钟算剩余时间，不用倒计时累加：App 切后台时 setInterval 会被节流甚至冻住，
  // 回到前台再按「还剩几拍」算就会多响很久。
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);
  const left = Math.max(0, CALL_RING_MS - (now - (Number(ts) || 0)));
  useEffect(() => { if (left <= 0 && onMiss) onMiss(); }, [left <= 0]);
  if (left <= 0) return null;
  const key = mode === "video" ? "camcorder" : "handset";
  const btn = (bg, rot, act, label) => h("button", {
    onClick: act,
    "aria-label": label,
    className: "flex items-center justify-center active:opacity-70",
    style: { width: 44, height: 44, borderRadius: 999, background: bg, border: "none", flexShrink: 0 }
  }, h("span", { style: { display: "block", transform: "rotate(" + rot + "deg)" } },
    h(CGlyph, { k: "handset", size: 21, color: "#fff" })));
  return ReactDOM.createPortal(
    h("div", {
      style: { position: "fixed", top: safeTop(8), left: 10, right: 10, zIndex: 300,
        animation: "callring-in .22s ease both" }
    },
      h("style", null,
        "@keyframes callring-in{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:none}}" +
        "@keyframes callring-wave{0%{opacity:.55;transform:scale(1.02)}100%{opacity:0;transform:scale(1.5)}}"),
      h("div", {
        style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 18,
          boxShadow: "0 12px 34px rgba(0,0,0,.26)", overflow: "hidden" }
      },
        h("div", { className: "flex items-center gap-3", style: { padding: "11px 12px" } },
          h("div", { style: { position: "relative", flexShrink: 0 } },
            [0, 0.65].map(d => h("div", {
              key: d,
              style: { position: "absolute", inset: -3, borderRadius: 15, border: "1.5px solid " + t.tint,
                animation: "callring-wave 1.3s ease-out infinite", animationDelay: d + "s", pointerEvents: "none" }
            })),
            avatar),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, name || "TA"),
            h("div", { className: "flex items-center", style: { gap: 4, marginTop: 1 } },
              h(CGlyph, { k: key, size: 12, color: t.fog }),
              h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } },
                (video ? "视频通话" : "语音通话") + "邀请"))),
          h("div", { className: "flex", style: { gap: 9 } },
            btn("#d9534f", 135, onDecline, "拒绝"),
            btn("#3faa63", 0, onAccept, "接听"))),
        // 抽干的这根线就是「还能响多久」——不写数字，电话本来也不报数
        h("div", { style: { height: 2, background: t.line } },
          h("div", { style: { height: "100%", width: (left / CALL_RING_MS * 100) + "%", background: t.tint } })))),
    document.body);
}
// 聊天记录里的回执：只有【响完之后】才有这一条。
// 接听过的不在这儿——那一通结束时会落一条「通话已结束 · 时长」，回执就是它，不重复。
function CallReceipt({ m, isU, who, avatar, onCallBack }) {
  const t = useTheme();
  const st = callInviteState(m);
  if (st === "ringing" || st === "accepted") return null;
  const video = m.mode === "video";
  const missed = st === "missed";
  const hh = new Date(m.ts || Date.now());
  const clock = String(hh.getHours()).padStart(2, "0") + ":" + String(hh.getMinutes()).padStart(2, "0");
  const color = missed ? "#c2705a" : t.fog;
  return h("div", { className: "py-1 flex items-start gap-2 " + (isU ? "justify-end" : "justify-start") },
    !isU && avatar,
    h("button", {
      onClick: () => onCallBack && onCallBack(m),
      className: "flex items-center active:opacity-60",
      style: { gap: 7, padding: "9px 13px", borderRadius: 13, background: t.bg2,
        border: "1px solid " + t.line, textAlign: "left" }
    },
      h("span", { style: { display: "block", transform: "rotate(135deg)", flexShrink: 0 } },
        h(CGlyph, { k: "handset", size: 15, color: color })),
      h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: color } },
        (missed ? "未接" + (video ? "视频" : "语音") + "通话" : "你拒绝了" + (who ? who + "的" : "") + (video ? "视频" : "语音") + "通话邀请") + " · " + clock),
      onCallBack ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.tint, marginLeft: 2 } }, "回拨") : null));
}
// 转发的贴吧帖子卡片（私聊/群聊都用）
// 模型思考链（v56.42，她 2026-08-26 要的）。用途她说得很清楚：
//   ① 出了奇怪的回复，能看见它当时在想什么，好对症下药；
//   ② 中转有没有偷偷换便宜模型——会不会返回思考链本身就是一条线索。
// 默认收起，点箭头展开。这是【模型】在想「我该怎么回」，和角色的「心声」不是一回事，
// 所以样式上刻意做得像调试面板，不像剧情。
function ReasoningBlock({ m }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [zh, setZh] = useState("");
  const [tBusy, setTBusy] = useState(false);
  const [tErr, setTErr] = useState("");
  const [showZh, setShowZh] = useState(false);
  const secs = m.reasonMs ? (m.reasonMs / 1000).toFixed(1) + "s" : "";
  // 思考链基本都是英文，给它一个译键（走和气泡同一条免费链，长文自动切块）
  const rLang = typeof translatableLang === "function" ? translatableLang(m.reasoning) : "";
  const doTrans = async () => {
    if (zh) { setShowZh(v => !v); return; }
    setTBusy(true); setTErr("");
    try { const r = await translateLongToZh(m.reasoning, rLang); setZh(r.zh); setShowZh(true); }
    catch (e) { setTErr(String((e && e.message) || e)); }
    finally { setTBusy(false); }
  };
  // v56.45：她说别飘在屏幕中间，要贴左边。左边距归零＝和头像那一列对齐，
  // 整块顶到消息区最左侧；模型名 flex:1 + 省略号，箭头 shrink-0，长名字也压不出第二行。
  // 上网（v58.74）：他这一轮去查了什么。跟思考链同一条线上，但各自独立——
  // 有的轮只查不深想，有的只深想不查，一个有一个没有都要画得出来。
  const searched = Array.isArray(m.searched) ? m.searched : [];
  const usedTools = Array.isArray(m.usedTools) ? m.usedTools : [];
  // 工具名前面带着服务器前缀（sid__name），画给她看的时候把前缀去掉
  const toolZh = usedTools.map(x => {
    const n = window.MCP ? window.MCP.unqualify(x && x.name).name : String((x && x.name) || "");
    return n + ((x && x.ok === false) ? "（没调通）" : "");
  });
  const bits = [];
  if (searched.length) bits.push("去查了 " + searched.map(q => "「" + q + "」").join(" "));
  if (toolZh.length) bits.push("用了 " + toolZh.join("、"));
  // 花了几次调用：只有超过一次才写——她按次计费，多花的那几次必须自己冒出来
  if (m.callCount > 1) bits.push("这一轮花了 " + m.callCount + " 次调用");
  const webLine = bits.length ? h("div", { className: "flex items-start gap-1.5", style: { padding: "1px 0" } },
    h("span", { className: "shrink-0", style: { fontSize: 10.5, opacity: 0.75 } }, "🔎"),
    h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.6, minWidth: 0 } },
      bits.join(" · "))) : null;
  if (!m.reasoning) return webLine ? h("div", { style: { margin: "0 0 2px 0", maxWidth: "100%" } }, webLine) : null;
  return h("div", { style: { margin: "0 0 2px 0", maxWidth: "100%" } }, webLine,
    h("button", { onClick: () => setOpen(v => !v), className: "flex items-center gap-1.5 active:opacity-60",
      style: { textAlign: "left", width: "100%", padding: "1px 0", overflow: "hidden" } },
      h("span", { className: "shrink-0", style: { fontSize: 10.5, opacity: 0.75 } }, "💡"),
      h("span", { className: "shrink-0", style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, whiteSpace: "nowrap" } },
        "深度思考" + (secs ? " " + secs : "")),
      m.reasonModel ? h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 10.5, color: t.line, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "· " + m.reasonModel) : h("span", { style: { flex: 1 } }),
      h("span", { className: "shrink-0", style: { fontFamily: F_BODY, fontSize: 9.5, color: t.line, transform: open ? "rotate(180deg)" : "none", transition: "transform .18s" } }, "˅")),
    open ? h("div", { style: { borderLeft: "2px solid " + t.line, paddingLeft: 9, margin: "3px 0 5px" } },
      h("div", { className: "flex items-center gap-2", style: { marginBottom: 3 } },
        m.reasonFrom ? h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.line } }, "来自字段 " + m.reasonFrom) : null,
        rLang ? h("button", { onClick: doTrans, disabled: tBusy, className: "active:opacity-60 disabled:opacity-50",
          style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog, border: "1px solid " + t.line, borderRadius: 5, padding: "0 5px" } },
          tBusy ? "翻译中…" : zh ? (showZh ? "看原文" : "看译文") : "译") : null),
      tErr ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: "#c25a4a", marginBottom: 3 } }, tErr) : null,
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.75, color: t.fog, whiteSpace: "pre-wrap" } }, showZh && zh ? zh : m.reasoning)) : null);
}
// 转发的聊天记录（v56.38）。原来是把整段原话直接塞进一个气泡里——十条八条的
// 转过去就是一堵墙（她 2026-08-26 截图）。改成微信那种卡片：标题 + 两行预览 + 「聊天记录」，
// 点开才看全部。标题按 items 里出现过几个人算：两个人＝「A和B的聊天记录」，三个以上＝「群聊的聊天记录」，
// 所以老消息不用迁移也能显示对。
function chatForwardItems(m) {
  const f = (m && m.forward) || {};
  if (Array.isArray(f.items) && f.items.length) return f.items;
  // 极老的消息只有正文：从「【转发的聊天记录】」那段文本里还原
  const lines = String((m && m.content) || "").split("\n").slice(1);
  return lines.map(l => { const k = l.indexOf("："); return k > 0 ? { name: l.slice(0, k), text: l.slice(k + 1) } : { name: "", text: l }; }).filter(x => x.text);
}
function chatForwardTitle(m) {
  const items = chatForwardItems(m);
  const names = [];
  items.forEach(it => { const n = (it && it.name) || ""; if (n && names.indexOf(n) < 0) names.push(n); });
  if (names.length >= 3) return "群聊的聊天记录";
  if (names.length === 2) return names[0] + "和" + names[1] + "的聊天记录";
  if (names.length === 1) return names[0] + "的聊天记录";
  return "聊天记录";
}
// 「8月26日 13:05」；今年内不写年份，跨年才写
function chatForwardTime(ts) {
  const n = Number(ts); if (!n) return "";
  const d = new Date(n), now = new Date();
  const hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  const md = (d.getMonth() + 1) + "月" + d.getDate() + "日";
  return (d.getFullYear() === now.getFullYear() ? "" : d.getFullYear() + "年") + md + " " + hm;
}
function ChatForwardCard({ m, isU, onOpen }) {
  const t = useTheme();
  const items = chatForwardItems(m);
  const preview = items.slice(0, 2);
  return h("div", { className: "py-1 flex " + (isU ? "justify-end" : "justify-start") },
    h("button", { onClick: () => onOpen && onOpen(m), className: "active:opacity-70 text-left",
      style: { width: 242, borderRadius: 14, overflow: "hidden", background: t.bg2, border: "1px solid " + t.line } },
      h("div", { className: "px-3.5 pt-3 pb-2.5" },
        h("div", { className: "line-clamp-2", style: { fontFamily: F_DISPLAY, fontSize: 15, lineHeight: 1.35, color: t.ink } }, chatForwardTitle(m)),
        h("div", { style: { marginTop: 6 } }, preview.map((it, i) => h("div", { key: i, className: "line-clamp-1",
          style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.6, color: t.fog } }, (it.name ? it.name + ": " : "") + it.text))),
        items.length > preview.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.6, color: t.fog } }, "…") : null),
      h("div", { className: "px-3.5 py-2", style: { borderTop: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "聊天记录")));
}
// 点开看全部
function ChatForwardSheet({ m, onClose }) {
  const t = useTheme();
  const items = chatForwardItems(m);
  return h(Sheet, { onClose: onClose, tall: true },
    h("div", { className: "px-1 pb-2" },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, marginBottom: 2 } }, chatForwardTitle(m)),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 14 } }, items.length + " 条 · 转发的聊天记录"),
      items.map((it, i) => h("div", { key: i, style: { marginBottom: 12 } },
        (it.name || it.ts) ? h("div", { className: "flex items-baseline gap-2", style: { marginBottom: 3 } },
          it.name ? h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, it.name) : null,
          it.ts ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.line } }, chatForwardTime(it.ts)) : null) : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.65, color: t.ink, whiteSpace: "pre-wrap" } }, it.text)))));
}
function ForumShareCard({ m, isU }) {
  const t = useTheme();
  const p = m.post || {};
  return h("div", { className: "py-1 flex " + (isU ? "justify-end" : "justify-start") },
    h("div", { style: { width: 242, borderRadius: 14, overflow: "hidden", background: t.bg2, border: `1px solid ${t.line}` } },
      h("div", { className: "px-3.5 pt-3 pb-3" },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: "0.16em", color: t.fog } }, "贴吧 · " + (p.board || "")),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, lineHeight: 1.3, color: t.ink, marginTop: 5 } }, p.title || ""),
        p.body && h("div", { className: "line-clamp-2", style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.5, color: t.sub, marginTop: 4 } }, p.body),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6 } }, p.anon ? "匿名 · " + (p.authorName || "") : (p.authorName || "")))));
}
// 查手机偷看卡：她把他手机里的一样东西摆到了他面前。
// tier 决定这张卡长什么样——藏起来的那一档要一眼看得出气氛不一样。
// 「这个好不好看」——拿给他看的那件商品。用购物页那套橙，一眼认得出是从哪儿来的。
// 他替她记下的那一条：备忘录用备忘录的紫、账本用账本的墨绿——
// 跟那两个 app 打开时看到的是同一个颜色，一眼知道这笔落在哪儿了。
// ⚠️只有【真的落盘成功】才会走到这里（见 app.js：memoAddByChar/ledgerAddByChar 返回 null 就不出卡片）。
// 显示「已记下」却其实没记，比不记更坏——她多半不会再去核对。
function RecordedCard({ m }) {
  const t = useTheme();
  const isMemo = m.what === "memo";
  const tone = isMemo ? "122,106,154" : "79,109,90";
  return h("div", {
    style: {
      maxWidth: "78%", borderRadius: 14, padding: "10px 13px",
      background: "rgba(" + tone + ",0.07)", border: "1px solid rgba(" + tone + ",0.22)",
      borderLeft: "3px solid rgba(" + tone + ",0.65)"
    }
  },
    h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: "0.14em", color: "rgba(" + tone + ",0.95)", marginBottom: 4 } },
      isMemo ? "已记进备忘录" : "已记进账本"),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink, lineHeight: 1.3 } }, m.title || ""),
    m.sub ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginTop: 3 } }, m.sub) : null,
    m.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 4, lineHeight: 1.5 } }, m.note) : null);
}
function ShopAskCard({ m }) {
  const t = useTheme();
  const a = m.ask || {};
  return h("div", { style: { width: 216, borderRadius: 14, overflow: "hidden", background: "#fff", border: "1px solid #ececf0", boxShadow: "0 1px 4px rgba(0,0,0,.06)" } },
    h("div", { style: { height: 4, background: "linear-gradient(90deg,#ff5000,#ff9500)" } }),
    h("div", { style: { padding: "10px 12px 11px" } },
      h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: "0.16em", color: "#ff5000" } }, "SHOPPING"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: "#20202a", lineHeight: 1.45, marginTop: 5 } }, a.name || ""),
      a.desc ? h("div", { className: "inline-block", style: { marginTop: 5, padding: "1.5px 6px", fontFamily: F_BODY, fontSize: 10, color: "#ff5000", background: "#fff2ea", borderRadius: 3 } }, a.desc) : null,
      h("div", { className: "flex items-end justify-between", style: { marginTop: 7 } },
        a.price != null ? h("div", { style: { lineHeight: 1 } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 11, fontWeight: 700, color: "#ff4000" } }, "¥"),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 18, fontWeight: 700, color: "#ff4000" } }, a.price)) : h("span"),
        h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#9a9aa6" } }, "在问你的意见"))));
}
function PhonePeekCard({ m, isU }) {
  const t = useTheme();
  const p = m.peek || {};
  const hid = p.tier === "hidden";
  return h("div", { className: "py-1 flex " + (isU ? "justify-end" : "justify-start") },
    h("div", { style: { width: 242, borderRadius: 14, overflow: "hidden", background: hid ? "rgba(182,71,60,.07)" : t.bg2, border: "1px solid " + (hid ? "rgba(182,71,60,.32)" : t.line) } },
      h("div", { className: "px-3.5 pt-3 pb-3" },
        // what：翻的是手机还是他的包／衣柜（v57.96 随身物也能摆到他面前了）
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: "0.16em", color: hid ? "#b6473c" : t.fog } }, "翻他" + (p.what || "手机") + " · " + (p.label || "")),
        p.title && h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, lineHeight: 1.3, color: t.ink, marginTop: 5 } }, p.title),
        p.text && h("div", { className: "line-clamp-3", style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.55, color: t.sub, marginTop: 4 } }, p.text),
        hid && h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#b6473c", marginTop: 7 } }, "这是他藏起来的"))));
}
// 同人文分享卡
function FicShareCard({ m, isU }) {
  const t = useTheme();
  const f = m.fic || {};
  return h("div", { className: "py-1 flex " + (isU ? "justify-end" : "justify-start") },
    h("div", { style: { width: 242, borderRadius: 14, overflow: "hidden", background: t.bg2, border: `1px solid ${t.line}` } },
      h("div", { className: "px-3.5 pt-3 pb-3" },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: "0.16em", color: t.fog } }, "同人文" + (f.cpText ? " · " + f.cpText : "")),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, lineHeight: 1.3, color: t.ink, marginTop: 5 } }, f.title || ""),
        f.excerpt && h("div", { className: "line-clamp-2", style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.5, color: t.sub, marginTop: 4 } }, f.excerpt),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6 } }, "文 / " + (f.author || "佚名")))));
}
function GiftCard({ m, isU, now, avatar, myAvatar }) {
  const t = useTheme();
  const name = (m.item && m.item.name) || m.name || "礼物";
  const toChar = m.dir === "toChar";
  let footer;
  if (toChar) footer = m.delivered ? "已送达 · TA 收到了" : (m.arriveTs ? "在路上 · 还有 " + giftFmtLeft(m.arriveTs - (now || Date.now())) : "已送出");
  else footer = "TA 给你寄的 · 在「我的」查看物流";
  return h("div", { className: "py-1 flex items-start gap-2 " + (isU ? "justify-end" : "justify-start") },
    !isU && avatar ? avatar : null,
    h("div", { style: { width: 224, borderRadius: 16, overflow: "hidden", background: "linear-gradient(135deg,#c25a4a,#9a3f37)", color: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" } },
      h("div", { className: "px-4 pt-3.5 pb-3" },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: "0.2em", opacity: 0.85 } }, "GIFT · 礼物"),
        h("div", { className: "flex items-center gap-2.5 mt-2" },
          h(IHeart, { size: 22, color: "#fff" }),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, lineHeight: 1.2 } }, name))),
      h("div", { className: "px-4 py-1.5", style: { background: "rgba(0,0,0,0.14)", fontFamily: F_BODY, fontSize: 10.5, letterSpacing: "0.06em" } }, footer)),
    isU && myAvatar ? myAvatar : null);
}
// 亲属卡发放卡
function KinshipIssueCard({ m, character }) {
  const t = useTheme();
  const c = character || {};
  return h("div", { className: "py-1 flex justify-start" },
    h("div", { style: { width: 240, borderRadius: 16, overflow: "hidden", background: "linear-gradient(135deg," + (c.color || "#6b7a8f") + "," + (c.color || "#3a4652") + ")", color: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" } },
      h("div", { className: "p-4" },
        h("div", { className: "flex items-center justify-between mb-5" },
          h("span", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: "0.14em", opacity: 0.85 } }, "亲属卡 · KINSHIP"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, opacity: 0.9 } }, c.name || "")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, opacity: 0.75 } }, "额度"),
        h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 26, lineHeight: 1 } }, "¥" + (m.limit || 0)),
        m.note && h("div", { className: "mt-2.5", style: { fontFamily: F_BODY, fontSize: 12, opacity: 0.92, lineHeight: 1.5 } }, "「" + m.note + "」")),
      h("div", { className: "px-4 py-1.5", style: { background: "rgba(0,0,0,0.16)", fontFamily: F_BODY, fontSize: 10.5 } }, "给你的亲属卡 · 刷 TA 的钱")));
}
// 代付请求卡
function PayLaterCard({ m }) {
  const t = useTheme();
  const paid = m.status === "paid", declined = m.status === "declined";
  const badge = paid ? "已代付" : declined ? "未代付" : "等待对方决定";
  const bc = paid ? "#3f8a54" : declined ? t.fog : t.tint;
  const names = (m.items || []).map(x => x.name).join("、");
  return h("div", { className: "py-1 flex justify-end" },
    h("div", { style: { width: 236, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid " + t.line } },
      h("div", { className: "px-4 pt-3.5 pb-3" },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: "0.18em", color: t.fog } }, "PAY FOR ME · 代付请求"),
        h("div", { className: "mt-1.5", style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, lineHeight: 1.3 } }, names || "购物清单"),
        h("div", { className: "mt-1", style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.accent } }, "¥" + m.total)),
      h("div", { className: "px-4 py-2", style: { background: t.bg2, fontFamily: F_BODY, fontSize: 11, letterSpacing: "0.04em", color: bc } }, badge)));
}
function TransferCard({
  m,
  isU,
  onRespond,
  avatar,
  myAvatar
}) {
  const t = useTheme();
  const pending = m.status === "pending";
  const canAct = pending && m.dir === "toMe"; // 我是收款方，可操作
  const statusLabel = m.status === "accepted" ? "已收款" : m.status === "returned" ? "已退回" : m.dir === "toChar" ? "等待 TA 接受" : "待接收";
  const stamp = m.status === "accepted" ? "RECEIVED" : m.status === "returned" ? "RETURNED" : "SENT";
  // 头像跟位置卡同一个摆法：对方的在左、我的在右（她 2026-08-27：「转账旁边没有头像」）
  return h("div", {
    className: "py-1 flex items-start gap-2 " + (isU ? "justify-end" : "justify-start")
  }, !isU && avatar, h("div", {
    style: {
      width: 250,
      background: "#fff",
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      opacity: m.status === "returned" ? 0.6 : 1
    }
  }, h("div", {
    className: "flex items-stretch justify-between px-4 pt-4 pb-3"
  }, h("div", null, h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11,
      letterSpacing: "0.14em",
      color: t.fog
    }
  }, "CNY"), h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontStyle: "italic",
      fontSize: 30,
      color: t.ink,
      lineHeight: 1.05
    }
  }, m.amount), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 12,
      color: t.fog,
      marginTop: 4
    }
  }, m.note || "转账")), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 9.5,
      letterSpacing: "0.15em",
      color: t.line,
      writingMode: "vertical-rl",
      transform: "rotate(180deg)",
      alignSelf: "stretch"
    }
  }, stamp)), canAct ? h("div", {
    className: "flex",
    style: {
      borderTop: "1px solid " + t.line
    }
  }, h("button", {
    onClick: () => onRespond(m.tid, false),
    className: "flex-1 py-2.5 active:opacity-60",
    style: {
      fontFamily: F_BODY,
      fontSize: 13,
      color: t.sub,
      borderRight: "1px solid " + t.line
    }
  }, "退回"), h("button", {
    onClick: () => onRespond(m.tid, true),
    className: "flex-1 py-2.5 active:opacity-70",
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 15,
      color: t.ink
    }
  }, "接受")) : h("div", {
    className: "px-4 py-2",
    style: {
      borderTop: "1px solid " + t.line,
      fontFamily: F_BODY,
      fontSize: 11,
      color: t.fog
    }
  }, statusLabel)), isU && myAvatar);
}
// 情侣邀请卡片（用户发出，角色自行接受/婉拒）
// ⚠️不自动回应：她 2026-08-30「还会自动回复不等我说完」——发出去之后她还想再说几句，
//   所以回应由她点这张卡上的按钮触发，那时候她说的话会一起递给 TA。
function CoupleInviteCard({
  m,
  character,
  asking,
  onAsk
}) {
  const t = useTheme();
  const nm = (character && character.remark) || (character && character.name) || "TA";
  const info = m.status === "accepted"
    ? { stamp: "TOGETHER", label: nm + " 接受了 ♥ 你们在一起了", accent: t.accent }
    : m.status === "declined"
      ? { stamp: "DECLINED", label: nm + " 婉拒了这份邀请", accent: t.fog }
      : m.status === "failed"
        ? { stamp: "—", label: "邀请没有得到回应，可以再问一次", accent: t.fog }
        : { stamp: "PENDING", label: "想说的话说完了，再让 TA 回应", accent: t.accent };
  const canAsk = (m.status === "pending" || m.status === "failed") && typeof onAsk === "function";
  return h("div", {
    style: {
      width: 250,
      background: "#fff",
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      border: "1px solid " + (m.status === "accepted" ? t.accent : t.line)
    }
  }, h("div", {
    className: "flex items-center gap-3 px-4 pt-4 pb-3"
  }, h(IHeart, { size: 26, color: info.accent }), h("div", null, h("div", {
    style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: "0.14em", color: t.fog }
  }, "COUPLE INVITE"), h("div", {
    style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 19, color: t.ink, lineHeight: 1.1 }
  }, "想和你在一起"))), h("div", {
    className: "px-4 py-2",
    style: { borderTop: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 11.5, color: info.accent }
  }, asking ? nm + " 正在看……" : info.label),
    canAsk && h("button", {
      onClick: function () { if (!asking) onAsk(m.cid); },
      disabled: !!asking,
      className: "w-full py-2.5 active:opacity-70",
      style: { borderTop: "1px solid " + t.line, fontFamily: F_DISPLAY, fontSize: 15, color: asking ? t.fog : t.ink, background: "transparent" }
    }, asking ? "等 TA 回话" : "让 TA 回应"));
}
// 解除拉黑申请卡片（char→我 我可接受/拒绝；我→char 显示状态）
function UnblockReqCard({ m, character, onRespond }) {
  const t = useTheme();
  const nm = (character && character.remark) || (character && character.name) || "TA";
  const fromChar = m.from === "char";
  const isU = m.role === "user";
  const pending = m.status === "pending";
  const body = fromChar ? (m.reason || "想和你和好") : (m.plea || "希望你能解除拉黑");
  const statusLabel = m.status === "accepted" ? "已接受 · 解除拉黑" : m.status === "declined" ? (fromChar ? "你拒绝了" : nm + " 拒绝了 · 可继续尝试") : (fromChar ? "" : "等待 " + nm + " 回应……");
  return h("div", { className: "py-1 flex " + (isU ? "justify-end" : "justify-start") },
    h("div", { style: { width: 250, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid " + (pending ? t.accent : t.line) } },
      h("div", { className: "px-4 pt-3.5 pb-3" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: "0.12em", color: t.accent, marginBottom: 4 } }, "解除拉黑申请"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.5, color: t.ink } }, body)),
      fromChar && pending
        ? h("div", { className: "flex", style: { borderTop: "1px solid " + t.line } },
            h("button", { onClick: () => onRespond(m.cid, false), className: "flex-1 py-2.5 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, borderRight: "1px solid " + t.line } }, "拒绝"),
            h("button", { onClick: () => onRespond(m.cid, true), className: "flex-1 py-2.5 active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, "接受"))
        : statusLabel && h("div", { className: "px-4 py-2", style: { borderTop: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 11, color: m.status === "accepted" ? t.tint : t.fog } }, statusLabel)));
}
// 聊天 +面板的图标(v60.12)
// 原来这排直接借了【查手机那套 app 图标】(PGlyph),于是:
//   · 「发语音」和「视频通话」在那套里压根没有对应的 key → 两个格子是空白的(她 2026-09-02 截图)
//   · 群里的「红包」同样没有,只好临时拿一个「¥」字顶着
//   · 剩下的四对撞车:位置和查找记录都是罗盘、表情包和照片都是相册、
//     语音通话和通话记录都是听筒、朋友圈和拍一拍都是微信气泡——
//     一排十一个格子只认得出七个。
// 借一套现成的没错(见 mobile-ui-layout.md),但借的得是【意思对得上】的那一套。
// 这一排说的是「往聊天里放什么」,跟手机里装了哪些 app 是两件事,所以给它自己一套。
function CGlyph({ k, size = 24, color = "#1b1a17" }) {
  const P = d => h("path", { d: d });
  const C = (cx, cy, r) => h("circle", { cx: cx, cy: cy, r: r });
  const R = (x, y, w, ht, rx) => h("rect", { x: x, y: y, width: w, height: ht, rx: rx });
  const kids = {
    pin: [P("M12 21.5s-6.6-6.2-6.6-10.6a6.6 6.6 0 1113.2 0c0 4.4-6.6 10.6-6.6 10.6z"), C(12, 10.9, 2.3)],
    sticker: [P("M4.5 4.5h10.8L19.5 8.7v10.8h-15z"), P("M15.3 4.5v4.2h4.2"), P("M9 13c.9 1.4 4.1 1.4 5 0"), P("M9.3 9.6v.7M14.7 9.6v.7")],
    picture: [R(3.5, 5, 17, 14, 2), C(8.6, 10, 1.6), P("M20.5 16.5l-5.2-5.2L5 19")],
    wave: [P("M3.5 10.5v3M7.5 7.5v9M11.5 5v14M15.5 8.5v7M19.5 10.8v2.4")],
    handset: [P("M21.5 16.9v2.6a1.9 1.9 0 01-2.1 1.9A18.6 18.6 0 013.1 4.6 1.9 1.9 0 015 2.5h2.6a1.9 1.9 0 011.9 1.6c.1 1 .4 1.9.7 2.7a1.9 1.9 0 01-.5 2L8.5 10a15 15 0 005.5 5.5l1.2-1.2a1.9 1.9 0 012-.5c.8.3 1.7.6 2.7.7a1.9 1.9 0 011.6 1.9z")],
    camcorder: [R(3, 7, 12.5, 10, 2.4), P("M15.5 11.6l5.5-3.1v7l-5.5-3.1z")],
    clock: [C(12, 12, 8.6), P("M12 7.3V12l3.2 1.9")],
    magnifier: [C(10.8, 10.8, 6.4), P("M15.4 15.4L20.5 20.5")],
    grid: [R(4, 4, 7, 7, 1.6), R(13, 4, 7, 7, 1.6), R(4, 13, 7, 7, 1.6), R(13, 13, 7, 7, 1.6)],
    bill: [R(2.8, 6.4, 18.4, 11.2, 2), C(12, 12, 2.6), P("M6.4 10v4M17.6 10v4")],
    hand: [P("M8.4 12.6V6.3a1.6 1.6 0 013.2 0v5.1"), P("M11.6 11.4V5.3a1.6 1.6 0 013.2 0v6.1"), P("M14.8 11.7V7.5a1.6 1.6 0 013.2 0v6.8c0 3.5-2.4 6-5.7 6-2.4 0-3.9-.9-5.2-2.7l-2.2-3a1.6 1.6 0 012.5-2l1.4 1.6")],
    bars: [P("M4 20.2h16"), P("M7.4 20.2v-8.4M12 20.2V5.4M16.6 20.2v-5.6")],
    packet: [R(4.2, 3.6, 15.6, 16.8, 2.4), P("M4.2 10.2h15.6"), C(12, 14.2, 2.2)],
    // 长按菜单那一列(v60.25)
    copy: [R(8.4, 3.4, 12, 14.4, 2), P("M15.6 20.6h-9a2 2 0 01-2-2V7.4")],
    bookmark: [P("M6.2 3.6h11.6v16.8L12 16.2l-5.8 4.2z")],
    quote: [P("M9.6 6.2C7 7.4 5.6 9.4 5.6 12v5.8h5.6V12H8.4c0-2 .6-3.4 2.2-4.3zM19.4 6.2c-2.6 1.2-4 3.2-4 5.8v5.8H21V12h-2.8c0-2 .6-3.4 2.2-4.3z")],
    pencil: [P("M16.4 3.6l4 4L8.2 19.8l-4.6 1.2 1.2-4.6z"), P("M14.2 5.8l4 4")],
    redo: [P("M20 5.6v5.2h-5.2"), P("M19.3 10.8a7.6 7.6 0 10-1.6 6.6")],
    checklist: [P("M4 6.6l1.8 1.8L9 5"), P("M4 15.6l1.8 1.8L9 13"), P("M12 7.2h8M12 16.2h8")],
    undo: [P("M4 5.6v5.2h5.2"), P("M4.7 10.8a7.6 7.6 0 111.6 6.6")]
  };
  return h(Svg, { size: size, color: color, sw: 1.5 }, ...(kids[k] || []));
}
// 位置卡:一枚图钉把一张字条按在聊天里(v60.12)
//
// 原来这张卡叫 GEO-STAMP:英文小字标头、一个准星、地名用意大利体、底下一行经纬度。
// 她 2026-09-02:「当初是完全参考了别人的」。病不只是长相像别人——
// **那行经纬度是随机掷出来的**(makeCoords:lat/lng 全随机),79.6472°N 落在北冰洋里。
// 这个 app 没有地图也没有 GPS,那张卡却在扮演一台定位仪器,于是它必须借仪器的长相。
// 现在照实说它是什么:一个人告诉你他在哪儿——**一张递过来的字条**,
// 纸是这个 app 从头到尾在用的材料(信纸/账簿/周刊/卷宗),图钉是「就在这儿」。
// 没有坐标,所以不需要装成地图;有的只是地名、谁在那儿、什么时候说的。
function GeoCard({ m, isU, who, avatar, myAvatar }) {
  const t = useTheme();
  const hh = new Date(m.ts || Date.now());
  const clock = String(hh.getHours()).padStart(2, "0") + ":" + String(hh.getMinutes()).padStart(2, "0");
  return h("div", {
    className: "py-1 flex items-start gap-2 " + (isU ? "justify-end" : "justify-start")
  }, !isU && avatar,
    h("div", { style: { position: "relative", width: 214, marginTop: 7 } },
      // 图钉:钉帽压在纸的上沿外面,底下一小片影子——纸是被按上去的,不是画上去的
      h("div", {
        style: { position: "absolute", top: -7, left: 16, width: 15, height: 15, borderRadius: 999,
          background: t.tint, boxShadow: "0 2px 4px rgba(0,0,0,.28)", zIndex: 2 }
      }),
      h("div", {
        style: { position: "absolute", top: 5, left: 22.5, width: 2, height: 13, background: t.tint, opacity: .5, zIndex: 1 }
      }),
      h("div", {
        style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 3,
          padding: "18px 16px 13px", boxShadow: "0 4px 12px rgba(0,0,0,.09)" }
      },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16.5, lineHeight: 1.5, color: t.ink, wordBreak: "break-word" } }, m.name || "某处"),
        h("div", { style: { height: 1, background: t.line, margin: "10px 0 7px" } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } },
          (isU ? "我在这儿" : (who || "TA") + " 在这儿") + " · " + clock))),
    isU && myAvatar);
}
// 我转给 TA 的输入卡（只有「我转给 TA」，接受由对方决定）
function TransferComposeSheet({
  cName,
  myBalance,
  onClose,
  onSend
}) {
  const t = useTheme();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const submit = () => {
    const a = Number(amount);
    if (a > 0) onSend(a, note.trim());
  };
  return h(Sheet, {
    onClose: onClose,
    tall: true
  }, h("div", {
    className: "text-center mb-1"
  }, h("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 22,
      color: t.ink
    }
  }, "转账给 " + cName)), h("div", {
    className: "flex items-end gap-2 mt-5 mb-1",
    style: {
      borderBottom: "1px solid " + t.line,
      paddingBottom: 8
    }
  }, h("span", {
    style: {
      fontFamily: F_BODY,
      fontSize: 13,
      letterSpacing: "0.12em",
      color: t.fog,
      marginBottom: 6
    }
  }, "CNY"), h("input", {
    value: amount,
    onChange: e => setAmount(e.target.value.replace(/[^0-9.]/g, "")),
    inputMode: "decimal",
    autoFocus: true,
    placeholder: "0.00",
    className: "flex-1 outline-none",
    style: {
      fontFamily: F_DISPLAY,
      fontStyle: "italic",
      fontSize: 32,
      color: t.ink,
      background: "transparent"
    }
  })), h("input", {
    value: note,
    onChange: e => setNote(e.target.value),
    placeholder: "附言（如：诚意金）",
    className: "w-full outline-none rounded-xl px-4 py-3 mt-3 mb-2",
    style: {
      fontFamily: F_BODY,
      fontSize: 14,
      background: t.bg,
      color: t.ink
    }
  }), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11.5,
      color: t.fog,
      marginBottom: 16
    }
  }, "我的余额 ¥" + (myBalance != null ? myBalance : "—") + " · TA 接受后才扣款"), h("div", {
    className: "flex gap-3"
  }, h("button", {
    onClick: onClose,
    className: "flex-1 rounded-full py-3",
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 16,
      background: t.bg,
      color: t.sub
    }
  }, "取消"), h("button", {
    onClick: submit,
    className: "flex-1 rounded-full py-3",
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 16,
      background: t.ink,
      color: t.bg2
    }
  }, "确认转账")));
}
// 发位置:写一个地名,或者点一个你之前发过的(v60.12)
//
// 原来这一页是 Geo-Stamp / SET YOUR LOCATION / CONFIRM & SEND,中间一行随机经纬度,
// 旁边一个「换一个坐标」的刷新键,底下两颗中英文双语胶囊。她说这是照着别人的做的——
// 除了长相,它整页都在围着一个【假读数】转:那行坐标是 Math.random() 掷出来的,
// 刷新键刷的是随机数,「当前位置 / Current」按下去发出去的字面就是「当前位置 / Current」。
// 现在只留真东西:你写的那个地名,和你之前发过的几个。
//
// ⚠️为什么这一层还留半窗(见 .claude/rules/no-half-sheet.md):
//   它是「选一下就走」的那一种,而且下面那一层【正是它要发进去的那个聊天】——
//   正好踩中那条规矩里半窗仅有的两种合格形状之一。
function GeoStampSheet({ recent, onClose, onSend }) {
  const t = useTheme();
  const [name, setName] = useState("");
  const lift = useKbLift();
  const v = name.trim();
  const past = (recent || []).slice(0, 5);
  return h(Sheet, { onClose: onClose, lift: lift },
    h(Eyebrow, null, "发个位置"),
    // 输入行做成纸上的一根横线,不是一个圆角输入框:这一层写的是【一个地名】,不是一段话
    h("div", { className: "flex items-end gap-2", style: { marginTop: 16, marginBottom: past.length ? 20 : 24 } },
      h(Svg, { size: 19, color: t.tint, sw: 1.6 },
        h("path", { d: "M12 21.5s-6.6-6.2-6.6-10.6a6.6 6.6 0 1113.2 0c0 4.4-6.6 10.6-6.6 10.6z" }),
        h("circle", { cx: 12, cy: 10.9, r: 2.3 })),
      h("input", {
        value: name,
        onChange: e => setName(e.target.value),
        placeholder: "你现在在哪儿",
        className: "flex-1 outline-none bg-transparent",
        style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, borderBottom: "1px solid " + t.line, paddingBottom: 7 }
      })),
    past.length ? h("div", { style: { marginBottom: 24 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 8 } }, "你之前发过"),
      past.map((x, k) => h("button", {
        key: k,
        onClick: () => setName(x),
        className: "w-full text-left active:opacity-60",
        style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.sub, padding: "9px 0",
          borderTop: k ? "1px solid " + t.line : "none" }
      }, x))) : null,
    h("button", {
      onClick: () => v && onSend(v),
      disabled: !v,
      className: "w-full active:opacity-80",
      style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 700, borderRadius: 12, padding: "13px",
        background: v ? t.ink : t.bg, color: v ? t.bg2 : t.fog }
    }, "发出去"));
}
// 按消息类型给出可用的长按菜单项：纯文本/图片/位置给全套；表情/语音/转账/红包等
// 卡片类只给能用的（收藏/多选删除/撤回）——复制/编辑/引用/重Roll 对它们没意义。
// 表情图：加载失败时【不要】塌成 0 尺寸（那样气泡看不见、也没法长按/多选删除），
// 改显一个带关键词的占位框，保持尺寸 + 可长按，用户能认出是哪张、也删得掉。
function EmoteBubble({ url, keyword, max }) {
  const t = useTheme();
  const [broken, setBroken] = useState(!url);
  const kw = keyword || "表情";
  max = max || 116;
  if (broken) return h("div", {
    style: { width: max, height: max, borderRadius: 12, background: t.bg2, border: "1px dashed " + t.line,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: 8, boxSizing: "border-box" }
  },
    h("div", { style: { fontSize: 22, opacity: 0.45, lineHeight: 1 } }, "🖼"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, textAlign: "center", lineHeight: 1.3, wordBreak: "break-all", maxHeight: 30, overflow: "hidden" } }, kw),
    h("div", { style: { fontFamily: F_BODY, fontSize: 9, color: t.fog } }, "图裂了"));
  // 无尺寸的 SVG data URI（只有 viewBox、没 width/height）在只给 maxWidth/maxHeight 的 img 里没有固有尺寸→0×0 看不见。
  // 给 SVG 显式 width（height:auto 按 viewBox 比例走）兜底，raster 图仍按固有尺寸 max 内约束、保持长宽比。
  const isSvg = /^data:image\/svg/i.test(url || "");
  const style = isSvg
    ? { width: max, height: "auto", maxWidth: max, maxHeight: max, borderRadius: 12, display: "block", objectFit: "contain" }
    : { maxWidth: max, maxHeight: max, borderRadius: 12, display: "block", objectFit: "contain" };
  return h("img", { src: url, alt: kw, title: kw, referrerPolicy: "no-referrer", loading: "lazy",
    style: style, onError: () => setBroken(true) });
}
// 长按一句话能做的事(v60.25 重做)
//
// 原来这一列是【大号英文衬线 + 右边一个小号中文】：Copy 复制 / Save 收藏 / Edit 编辑…
// 她 2026-09-02:「这块样式也是参考别人的」。那两栏一模一样的中英对照，
// 换个 app 照样成立——它没有从「这是一句谁说过的话」里长出来。
// 现在只留中文，按【这个动作对这句话做了什么】分三组，组与组之间空一档：
//   拿走它(复制/收藏/引用) · 动它(编辑/重Roll/念出来) · 撤掉它(多选/撤回)
// 每条左边一枚字形，撤回单独落在最后一组、用强调色。
// speak = 她 2026-09-02 要的「气泡转语音」：不是语音条也能听。
const MSG_MENU = {
  copy: ["复制", "copy"], fav: ["收藏", "bookmark"], quote: ["引用", "quote"],
  edit: ["编辑", "pencil"], reroll: ["重Roll", "redo"], speak: ["念出来", "wave"],
  multi: ["多选", "checklist"], recall: ["撤回", "undo"]
};
// 一组一个数组；空组会被丢掉，所以不用担心某一档一条都不剩时留下一道空隔断
function menuItemsForKind(m, canSpeak) {
  const k = m && m.kind;
  const textLike = !k || k === "photo" || k === "location";
  const listen = canSpeak ? ["speak"] : [];
  if (textLike) return [["copy", "fav", "quote"], ["edit", "reroll"].concat(listen), ["multi", "recall"]];
  // 语音有转文字内容 → 可复制/引用（引用的是转文字），别只给收藏/删除；它自己气泡上就有 ▶，不再给念出来
  if (k === "voice") return [["copy", "fav", "quote"], [], ["multi", "recall"]];
  return [[  "fav"], listen, ["multi", "recall"]];
}
// 编辑消息弹层：替掉难看又不能放大的原生 prompt。大号可拉伸文本框，长内容自动撑高+可滚，风格随 app。
function MsgEditSheet({ init, onCancel, onSave }) {
  const t = useTheme();
  const [txt, setTxt] = useState(init || "");
  const ref = useRef(null);
  const lift = useKbLift();
  const grow = () => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.5)) + "px"; } };
  // 弹层挂载后聚焦拉起键盘；聚焦前先 grow。用两次 rAF 让 Sheet 的进场动画先落定，聚焦更稳（避免 iOS 首次不弹）
  useEffect(() => {
    const el = ref.current; if (!el) return;
    grow();
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => { el.focus({ preventScroll: true }); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }));
    return () => cancelAnimationFrame(raf);
  }, []);
  return h(Sheet, { onClose: onCancel, tall: true, lift: lift },
    h("div", { className: "flex items-center justify-between", style: { marginBottom: 12 } },
      h(Eyebrow, null, "编辑消息"),
      // ⚠️原来这儿写着「可拖右下角放大」——**iOS Safari 根本没有那个拖拽角**，
      //   而她只用手机。而且下面 grow() 本来就是随内容自己长高的，那句话既不成立也用不上。
      h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "写多长都行，框会自己长")),
    h("textarea", { ref: ref, value: txt, onChange: e => { setTxt(e.target.value); grow(); },
      style: { width: "100%", minHeight: 150, maxHeight: "50vh", resize: "none", boxSizing: "border-box", fontFamily: F_BODY, fontSize: 15, lineHeight: 1.7, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "13px 15px", outline: "none", overflowY: "auto" } }),
    h("div", { className: "flex items-center gap-3", style: { marginTop: 16 } },
      h("button", { onClick: onCancel, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 14, color: t.sub, padding: "11px 22px", borderRadius: 12, border: "1px solid " + t.line } }, "取消"),
      h("button", { onClick: () => onSave(txt), className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 700, color: t.bg2, background: t.ink, padding: "12px", borderRadius: 12 } }, "保存")));
}
function MsgMenu({ message, idx, onClose, onAction, items, isMine }) {
  const t = useTheme();
  if (!items) items = [["copy", "fav", "quote"], ["edit", "reroll"], ["multi", "recall"]];
  const groups = items.filter(g => g && g.length);
  const txt = String((message && message.content) || "").trim();
  const row = (k, gi, ri, last) => {
    const d = MSG_MENU[k];
    if (!d) return null;
    const kill = k === "recall";
    return h("button", {
      key: k,
      onClick: () => onAction(k),
      className: "w-full flex items-center active:bg-black/5",
      style: { gap: 12, padding: "12px 18px", background: "transparent", border: "none",
        borderTop: ri ? "1px solid " + t.line : "none", textAlign: "left" }
    },
      h(CGlyph, { k: d[1], size: 17, color: kill ? t.accent : t.fog }),
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, letterSpacing: 1, color: kill ? t.accent : t.ink } }, d[0]));
  };
  return h("div", {
    className: "absolute inset-0 z-50 flex items-center justify-center",
    style: { background: "rgba(20,19,15,0.55)", backdropFilter: "blur(3px)" },
    onClick: onClose
  }, h("div", { onClick: e => e.stopPropagation(), className: "w-[74%]", style: { maxWidth: 268 } },
    // 被长按的那句话【原样端上来】：还是它在聊天里的那个气泡形状和颜色，
    // 所以这一列动作明摆着是对着这一句的，不是一张浮在半空的通用菜单。
    txt ? h("div", {
      className: "mb-3",
      style: { display: "flex", justifyContent: isMine ? "flex-end" : "flex-start" }
    }, h("div", {
      style: { maxWidth: "100%", maxHeight: 96, overflow: "hidden", padding: "9px 13px", borderRadius: 15,
        fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55,
        background: isMine ? BUBBLE_SKIN.myBg : BUBBLE_SKIN.charBg,
        color: isMine ? BUBBLE_SKIN.myText : (BUBBLE_SKIN.charText || t.ink) }
    }, txt)) : null,
    groups.map((g, gi) => h("div", {
      key: gi,
      className: "overflow-hidden",
      style: { background: "rgba(255,255,255,0.96)", borderRadius: 16, marginTop: gi ? 8 : 0 }
    }, g.map((k, ri) => row(k, gi, ri))))));
}

// ---- state card: live mood/affinity/wearing/action/thought (auto from chat) ----
// ── 心声卡（v59.77 重做）────────────────────────────────────────────
// 她 2026-09-01：「重做心声卡样式吧，现在的有点无聊，而且是半屏，改成屏幕中间的框。
// 然后我发现我们这个和最后一张图的 category 完全一样是不是得改改」。
//
// 【分栏是真撞了】原来五栏：实时心情 / 对你的好感度 / 穿着 / 动作 / 内心想法——
// 跟她截图里那个参考一字不差。光改名字不算改：那五栏本身就是「状态面板」这个
// 通用形状，一排一模一样的圆角卡竖着摞，换个 app 照样成立
//（.claude/rules/tabs-not-plain-pills.md 那条判据）。
//
// 【改成三栏，按「一帧」来分】这张卡答的是「此刻他是什么样」：
//   ① 此刻 —— 心情长在抬头那一行上，不单独占一张卡
//   ② 看得见的 —— 穿着和动作【合成一段】，那本来就是同一眼看到的东西，
//      拆成两张并排的卡才是状态面板的做法
//   ③ 没说出口的 —— 那句心声，压低的底、引号撑开，跟上面那半明显不是一类
//   ④ 分数只有一个，就别做成一排进度条：一条 0-100 的刻度，墨点站在当下的位置
//
// 【形状】屏幕正中的一个框，不是半窗。
// ⚠️ .claude/rules/no-half-sheet.md 说默认整页，但那条针对的是「从底下掀起来、
//   上半屏糊着上一层」的半窗。这张卡是【贴在某一轮对话上的一帧】，看得见底下
//   那层聊天是它成立的前提，而且内容就三段——正中一个框才是它该有的形状。
//   这是她 2026-09-01 直接点的。
const HEART_D = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
function CenterCard({ children, onClose, maxWidth }) {
  const t = useTheme();
  return h("div", {
    className: "absolute inset-0 z-50 flex items-center justify-center",
    style: { padding: 18, background: "rgba(20,19,15,.46)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" },
    onClick: onClose
  }, h("div", {
    onClick: e => e.stopPropagation(),
    className: "w-full flex flex-col",
    style: {
      maxWidth: maxWidth || 400, maxHeight: "82vh",
      // 一张白框太空（她 2026-09-01：「这一个白框还是无聊」）：加一层极淡的纸纹，
      // 斜着走的一道道细线——不抢字，但这张卡不再是一块纯色。
      background: "repeating-linear-gradient(112deg,rgba(120,110,95,.028) 0 1px,transparent 1px 7px)," + t.bg2,
      borderRadius: 20, border: "1px solid " + t.line,
      borderTop: "3px solid " + t.accent,
      boxShadow: "0 24px 60px rgba(20,19,15,.34)", overflow: "hidden",
      animation: "fadeUp .22s ease both"
    }
  }, children));
}
function StateCard({
  character, affinity, isNpc, mood, state, history, hideWearAction,
  onClose, gazeOn, uName, onGazeSeed, gazeSeedBusy, roomName
}) {
  const t = useTheme();
  const [showHist, setShowHist] = useState(false);
  const [page, setPage] = useState("now"); // 此刻 | Ta 眼里
  const hist = history || [];
  const dmRaw = decayMood(mood) || (roomName ? null : { label: "平静", def: true });
  const dm = window.MoodLabel ? window.MoodLabel.normalizeMood(dmRaw) : dmRaw;
  const aff = typeof affinity === "number" ? affinity : 50;
  const S = v => String(v == null ? "" : v).trim();
  // 这张卡上的「他」也跟着角色性别走（她 2026-09-01）；判断表只有 charTa 这一份，别再各写一遍
  const scTa = window.PhonePronoun ? window.PhonePronoun.ta(character) : "他";
  const seen = [S(state && state.wearing), S(state && state.action)].filter(Boolean);
  const label = (txt, c) => h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: ".2em", color: c || t.fog } }, txt);
  // 抬头：谁、此刻什么心情、上次动是什么时候。心情不再单独占一张卡。
  // ⚠️名字和心情不许同行挤（她 2026-09-01 截图：Primrose Hawthorn 把抬头撑成三行、
  //   「上一次变是 25分钟前」也断成两截）。名字自己一行、超了打点；心情和时间挤在
  //   第二行，也打点。两行都 nowrap，多长的名字都撑不坏这个框。
  const head = h("div", { className: "shrink-0 flex items-center gap-3", style: { padding: "15px 16px 12px", borderBottom: "1px solid " + t.line } },
    h(Avatar, { character: character, size: 42, radius: 12 }),
    h("div", { className: "flex-1 min-w-0" },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, character.name),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, marginTop: 2, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: t.fog } },
        roomName ? h("span", { style: { color: t.accent } }, roomName + " · 心声只留在本房") : (!isNpc && dm) ? h("span", { style: { color: t.accent } }, dm.label) : null,
        (!roomName && !isNpc && dm) ? " · " : "",
        roomName ? "" : dm && dm.def ? "聊几句就会变"
          : dm && dm.faded ? "已经平复下去了"
            : (dm && dm.ts ? timeAgo(dm.ts) + "变的" : "此刻"))),
    h("div", { className: "shrink-0 flex items-center", style: { gap: 6 } },
      h("button", { onClick: onClose, "aria-label": "关掉", className: "active:opacity-60", style: { width: 28, height: 28, borderRadius: 999, border: "1px solid " + t.line, color: t.sub, fontFamily: F_BODY, fontSize: 13, lineHeight: 1 } }, "✕")));
  const tabs = gazeOn && window.GazePage ? h("div", { className: "shrink-0 flex", style: { borderBottom: "1px solid " + t.line } },
    [["now", "此刻"], ["gaze", "Ta 眼里"]].map(([k, lb]) => h("button", {
      key: k, onClick: () => { setPage(k); setShowHist(false); }, "aria-pressed": page === k ? "true" : "false",
      style: { position: "relative", flex: 1, padding: "9px 0", fontFamily: F_DISPLAY, fontSize: 13, letterSpacing: 2, color: page === k ? t.ink : t.fog, background: "transparent", border: "none", borderBottom: "2px solid " + (page === k ? t.accent : "transparent") }
    }, lb,
      (k === "gaze" && window.Gaze && window.Gaze.unseenCount && window.Gaze.unseenCount(character.id) > 0)
        ? h("span", { style: { display: "inline-block", width: 6, height: 6, borderRadius: 999, background: t.accent, marginLeft: 5, verticalAlign: "middle" } }) : null))) : null;
  // 好感度＝一颗会灌满的心（她 2026-09-01：「做个心形的水位表，心形中间显示好感，
  // 根据数字决定颜色多满」）。一条带刻度的尺是通用件，一颗按分数上水位、按分数变色
  // 的心不是——这一栏本来就该长成心的样子。
  // 颜色从冷到暖：没什么感觉是灰蓝的，一路暖到深红。
  const heartInk = aff >= 80 ? "#b83b4e" : aff >= 60 ? "#c4606f" : aff >= 40 ? "#c58089" : aff >= 20 ? "#b08a86" : "#8794a6";
  const lvl = Math.max(0, Math.min(100, aff)) / 100;
  const scale = (isNpc || roomName) ? null : h("div", { className: "flex items-center", style: { gap: 15, padding: "13px 17px 15px", borderTop: "1px solid " + t.line } },
    h("div", { style: { position: "relative", width: 78, height: 78, flexShrink: 0 } },
      h("svg", { viewBox: "0 0 24 24", width: 78, height: 78, "aria-hidden": "true", style: { display: "block", overflow: "visible" } },
        h("defs", null, h("clipPath", { id: "sc-heart" }, h("path", { d: HEART_D }))),
        h("path", { d: HEART_D, fill: t.line, opacity: .45 }),
        h("g", { clipPath: "url(#sc-heart)" },
          h("rect", { x: 0, y: 24 * (1 - lvl), width: 24, height: 24 * lvl + 0.4, fill: heartInk, opacity: .9 }),
          // 水面那一道亮边：不加的话就是块色，看不出是「灌到这儿」
          lvl > 0 && lvl < 1 ? h("rect", { x: 0, y: 24 * (1 - lvl), width: 24, height: .45, fill: "#fff", opacity: .5 }) : null),
        h("path", { d: HEART_D, fill: "none", stroke: heartInk, strokeWidth: 1, opacity: .85 })),
      // 数字压在心中间：描一圈卡片底色，压在水位上也读得清
      h("span", { style: {
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        paddingTop: 4, fontFamily: F_DISPLAY, fontSize: 23, color: t.ink,
        WebkitTextStroke: "3px " + t.bg2, paintOrder: "stroke"
      } }, aff)),
    h("div", { className: "flex-1 min-w-0" },
      label("好感度"),
      state && state.affinityLabel ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: heartInk, marginTop: 6 } }, state.affinityLabel) : null,
      h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 7, lineHeight: 1.6 } }, "跟着聊天自己更新，不额外花额度")));
  // ⚠️「翻旧的」原来钉在抬头上，可它翻的只有【此刻】这一栏；站在「Ta 眼里」按它，
  //   画面一动不动（她 2026-09-01：「在他眼里按翻旧的没反应有点不对劲」）。
  //   一个键管不着眼下这一栏，就不该摆在管着两栏的抬头上——挪进此刻自己这一栏里。
  //   两头方向相反：此刻的底下是「底下还有旧的」，旧的那一叠顶上是「回此刻」。
  const histBtn = (back) => hist.length > 0 ? h("button", {
    onClick: () => setShowHist(!back), className: "w-full active:opacity-60",
    style: {
      fontFamily: F_BODY, fontSize: 11.5, color: back ? t.accent : t.sub, background: "transparent",
      border: "none", borderTop: back ? "none" : "1px dashed " + t.line, borderBottom: back ? "1px dashed " + t.line : "none",
      padding: back ? "0 0 11px" : "12px 0 2px", margin: back ? "0 0 13px" : "4px 0 0"
    }
  }, back ? "← 回此刻" : "底下还有 " + hist.length + " 条旧的 · 翻旧的") : null;
  const body = showHist
    ? h("div", { style: { padding: "13px 17px 18px" } },
      histBtn(true),
      label(scTa + "心里闪过的那些 · " + hist.length + " 条"),
      h("div", { style: { marginTop: 10 } }, hist.map((s2, i) => h("div", { key: i, style: { paddingBottom: 11, marginBottom: 11, borderBottom: i === hist.length - 1 ? "none" : "1px solid " + t.line } },
        h("div", { className: "flex items-center gap-2", style: { marginBottom: 4 } },
          s2.mood ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.accent } }, window.MoodLabel ? window.MoodLabel.localize(s2.mood) : s2.mood) : null,
          h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, s2.ts ? timeAgo(s2.ts) : "")),
        h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 13.5, lineHeight: 1.65, color: t.ink } }, "“" + (s2.thought || "") + "”"),
        !hideWearAction && (s2.wearing || s2.action) ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4 } }, [s2.action, s2.wearing].filter(Boolean).join(" · ")) : null))))
    : h(Fragment, null,
      (!state || (!S(state.thought) && roomName)) ? h(Empty, { text: roomName ? "这间房还没有心声" : "还没有状态", sub: roomName ? "在这里聊过或赴约后，会只为本房留下" : "和" + scTa + "聊几句，状态会自动生成" }) : null,
      // 看得见的：穿着和动作本来就是同一眼看到的东西，合成一段——
      // 拆成两张并排的卡，那是状态面板的做法。
      // 还是一块（不拆成两张并排的卡），但分两拍念：身上什么样是轻的一行，
      // 手在做什么才是这一帧的主句。一个「　」把两句黏在一起会读成一长串。
      (!hideWearAction && seen.length) ? h("div", { style: { position: "relative", padding: "14px 17px 15px" } },
        // 四角的取景框：这张卡讲的是「此刻的一帧」，那就让它真有个取景框
        ["nwse", "nesw"].map((k, i) => h("span", { key: k, "aria-hidden": "true", style: Object.assign(
          { position: "absolute", width: 13, height: 13, borderColor: t.line, borderStyle: "solid" },
          i === 0 ? { left: 8, top: 10, borderWidth: "1px 0 0 1px" } : { right: 8, top: 10, borderWidth: "1px 1px 0 0" }) })),
        ["swne", "senw"].map((k, i) => h("span", { key: k, "aria-hidden": "true", style: Object.assign(
          { position: "absolute", width: 13, height: 13, borderColor: t.line, borderStyle: "solid" },
          i === 0 ? { left: 8, bottom: 6, borderWidth: "0 0 1px 1px" } : { right: 8, bottom: 6, borderWidth: "0 1px 1px 0" }) })),
        label("看得见的"),
        S(state && state.wearing) ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.7, color: t.sub, marginTop: 8 } }, S(state.wearing)) : null,
        S(state && state.action) ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, lineHeight: 1.75, color: t.ink, marginTop: S(state && state.wearing) ? 5 : 8 } }, S(state.action)) : null) : null,
      // 没说出口的：跟上面那半明显不是一类
      (state && S(state.thought)) ? h("div", { style: { position: "relative", margin: "0 13px 15px", padding: "14px 15px 15px", borderRadius: 14, background: t.bg, border: "1px solid " + t.line, overflow: "hidden" } },
        // 压在底下的那个大引号：这一块是「他心里那句」，得跟上面那半一眼分得开
        h("span", { "aria-hidden": "true", style: { position: "absolute", right: 6, bottom: -22, fontFamily: F_DISPLAY, fontSize: 92, lineHeight: 1, color: t.accent, opacity: .07, pointerEvents: "none" } }, "”"),
        label("心里想的", t.accent),
        h("div", { style: { position: "relative", fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 15.5, lineHeight: 1.85, color: t.ink, marginTop: 8 } }, "“" + S(state.thought) + "”")) : null,
      h("div", { style: { padding: "0 15px" } }, histBtn(false)));
  return h(CenterCard, { onClose: onClose }, head, tabs,
    h("div", { className: "flex-1 min-h-0 overflow-y-auto" },
      (page === "gaze" && gazeOn && window.GazePage)
        ? h("div", { style: { padding: "13px 15px 18px" } }, h(window.GazePage, { charId: character.id, charName: character.name, uName: uName || "你", ta: scTa, onSeed: onGazeSeed, seedBusy: gazeSeedBusy }))
        : body),
    (page === "now" && !showHist) ? scale : null);
}

// ============================================================
// 线下模式（赴约）—— 全屏叙事界面。setup 选开场白+文风；live 只留输入框+回复键+心声
// ============================================================
async function readOfflineStyleDocument(file) {
  const name = String(file && file.name || "").toLowerCase();
  if (!name.endsWith(".docx")) {
    const text = String(await file.text()).trim();
    if (text.length > 250000) throw new Error("文风文件超过 25 万字，请拆小后导入");
    return text;
  }
  const buf = await file.arrayBuffer();
  const view = new DataView(buf);
  let eocd = -1;
  for (let i = Math.max(0, buf.byteLength - 65557); i <= buf.byteLength - 22; i++) {
    if (view.getUint32(i, true) === 0x06054b50) eocd = i;
  }
  if (eocd < 0) throw new Error("不是有效的 DOCX 文件");
  const entries = view.getUint16(eocd + 10, true);
  let pos = view.getUint32(eocd + 16, true), found = null;
  const decoder = new TextDecoder("utf-8");
  for (let i = 0; i < entries && pos + 46 <= buf.byteLength; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    const method = view.getUint16(pos + 10, true);
    const size = view.getUint32(pos + 20, true);
    const rawSize = view.getUint32(pos + 24, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const filename = decoder.decode(new Uint8Array(buf, pos + 46, nameLen));
    if (filename === "word/document.xml") found = { method, size, rawSize, localOffset };
    pos += 46 + nameLen + extraLen + commentLen;
  }
  if (!found) throw new Error("DOCX 里找不到正文");
  if (found.rawSize > 2000000) throw new Error("DOCX 正文过大，请另存为较短的 txt 后导入");
  const localNameLen = view.getUint16(found.localOffset + 26, true);
  const localExtraLen = view.getUint16(found.localOffset + 28, true);
  const dataStart = found.localOffset + 30 + localNameLen + localExtraLen;
  const compressed = new Uint8Array(buf, dataStart, found.size);
  let xmlBytes;
  if (found.method === 0) xmlBytes = compressed;
  else if (found.method === 8 && typeof DecompressionStream !== "undefined") {
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    xmlBytes = new Uint8Array(await new Response(stream).arrayBuffer());
  } else throw new Error("当前浏览器不能解压这个 DOCX；请另存为 .txt 后导入");
  const xml = new DOMParser().parseFromString(decoder.decode(xmlBytes), "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("DOCX 正文解析失败");
  const paras = Array.from(xml.getElementsByTagNameNS("*", "p")).map(p =>
    Array.from(p.getElementsByTagNameNS("*", "t")).map(t => t.textContent || "").join("")
  ).map(s => s.trim()).filter(Boolean);
  const text = paras.join("\n").trim();
  if (text.length > 250000) throw new Error("文风正文超过 25 万字，请拆小后导入");
  return text;
}
// 文风文档解析器供线下与同人文共用；只在本机浏览器读取，不上传原文件。
window.readWritingStyleDocument = readOfflineStyleDocument;
function OfflineStylePromptPreview({ style, t }) {
  const prompt = String(style && style.prompt || "");
  const shown = style && style.imported && prompt.length > 520 ? prompt.slice(0, 520) + "…" : prompt;
  return h("div", null,
    style && style.imported ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.tint, marginBottom: 5 } }, "本地导入 · " + prompt.length + " 字 · 只在选中时注入") : null,
    h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: t.sub, whiteSpace: "pre-wrap" } }, shown || "不额外指定文风，由角色本身的人设决定叙事口吻。"));
}
// 「吃入文风预设」小节。线下单人和群线下共用一份——两边这块以前各写各的，
// 一改就得改两遍还容易只改一边（自定义文风那块就吃过这个亏）。
// 开关默认关：不开＝下面那套原本的文风预选照旧生效，一个字都不变。
function OfflineStylePresetSection({ t, presetOn, setPresetOn, presetId, setPresetId, onOpenStyleLab }) {
  const SP = window.StylePresets;
  const presets = SP ? SP.list() : [];
  const cur = presetId && SP ? SP.byId(presetId) : null;
  const body = SP && cur ? SP.textFor(cur, "offline", {}) : "";
  return h("div", { className: "pt-5", style: { borderTop: "1px solid " + t.line, marginTop: 18 } },
    h("div", { className: "flex items-center justify-between" },
      h("div", { className: "pr-3" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.sub } }, "吃入文风预设"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2, lineHeight: 1.5 } },
          "开：这一局改用预设台里搭好的那份写法。关：还是用下面的文风预选，和以前完全一样。")),
      h(Toggle, { on: !!presetOn, onChange: () => setPresetOn(v => !v) })),
    presetOn
      ? h("div", { className: "mt-3" },
          presets.length
            ? h("div", { className: "flex flex-wrap gap-2 mb-2" }, presets.map(p => h("button", {
                key: p.id, onClick: () => setPresetId(p.id), className: "px-3 py-1.5",
                style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 999, border: "1px solid " + (presetId === p.id ? t.ink : t.line), background: presetId === p.id ? t.ink : "transparent", color: presetId === p.id ? t.bg2 : t.sub }
              }, p.name)))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 8, lineHeight: 1.6 } }, "预设台里还一条都没有——先去搭一条。"),
          cur
            ? h("div", { className: "p-3", style: { background: t.bg, borderRadius: 8, border: "1px solid " + t.line } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1, color: t.fog, marginBottom: 4 } },
                  (cur.mods || []).length + " 个模块" + (String(cur.free || "").trim() ? " ＋ 手写" : "") + " · 共 " + String(body).replace(/\s/g, "").length + " 字"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.7, color: t.sub, whiteSpace: "pre-wrap", maxHeight: 110, overflow: "hidden" } }, body || "（这条预设是空的）"))
            : null)
      : null,
    h("button", { onClick: () => onOpenStyleLab && onOpenStyleLab(), className: "mt-3 px-3 py-1.5 active:opacity-60",
      style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 999, border: "1px dashed " + t.line, background: "transparent", color: t.tint } },
      "去文风预设台 →"));
}
function OfflineTastePanel({ t, pace, setPace, focus, setFocus, density, setDensity, compact }) {
  const row = (label, value, setter, options) => h("div", { className: compact ? "mb-3" : "mb-4" },
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: .6, color: t.fog, marginBottom: 7 } }, label),
    h("div", { className: "flex flex-wrap gap-1.5" }, options.map(o => h("button", {
      key: o.v, onClick: () => setter(o.v), className: "active:opacity-60",
      style: { fontFamily: F_BODY, fontSize: 11.5, padding: "5px 10px", borderRadius: 999, border: "1px solid " + (value === o.v ? t.ink : t.line), background: value === o.v ? t.ink : "transparent", color: value === o.v ? t.bg2 : t.sub }
    }, o.t))));
  return h("div", { className: compact ? "mb-5" : "pt-5", style: compact ? { padding: 12, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10 } : { borderTop: "1px solid " + t.line, marginTop: 18 } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.sub, marginBottom: 3 } }, "本场口味"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.55, marginBottom: 11 } }, "不是固定模板，只是把这一场的镜头往你喜欢的方向轻推。"),
    row("节奏", pace, setPace, [{ v: "auto", t: "自然" }, { v: "slow", t: "慢慢磨" }, { v: "forward", t: "往前走" }]),
    row("镜头", focus, setFocus, [{ v: "auto", t: "自己找" }, { v: "dialogue", t: "多说话" }, { v: "action", t: "多行动" }, { v: "atmosphere", t: "多氛围" }]),
    row("文字", density, setDensity, [{ v: "auto", t: "自然疏密" }, { v: "airy", t: "多留白" }, { v: "rich", t: "更饱满" }]));
}
function OfflineMode({
  char,
  room,
  profile,
  sessions,
  activeSession,
  sending,
  settings,
  registerTelemetry,
  onSaveSettings,
  onStart,
  onSend,
  onSendPhoto,
  onShoot,
  canShoot,
  canShootDuo,
  onReply,
  onOOC,
  onAddNote,
  onChangeStyle,
  onSaveExample,
  onDeleteExample,
  onEditMsg,
  onRerollMsg,
  onDelMsg,
  onDelSession,
  onEnd,
  onClose,
  onExit,
  onOpenState,
  schedNow,
  onOpenSched,
  onOpenStyleLab
}) {
  const t = useTheme();
  const exit = onExit || onClose; // 顶栏「离开」直接退回聊天列表；没传 onExit 就退回线上（兜底）
  const kbLift = useKbLift(); // iOS 键盘弹起时把底部输入栏顶上来，别被键盘挡住（v47.91）
  const cName = char.remark || char.name;
  const [view, setView] = useState(activeSession ? "live" : "setup");
  const [opening, setOpening] = useState("");
  const [styleKey, setStyleKey] = useState(activeSession && activeSession.styleKey ? activeSession.styleKey : "default");
  const [presetOn, setPresetOn] = useState(() => activeSession ? !!activeSession.presetOn : !!(settings && settings.presetOn));
  const [presetId, setPresetId] = useState(() => (activeSession && activeSession.presetId) || (settings && settings.presetId) || "");
  const [input, setInput] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoImg, setPhotoImg] = useState("");
  const [photoDesc, setPhotoDesc] = useState("");
  const photoFileRef = useRef(null);
  const [oocMode, setOocMode] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [endConfirm, setEndConfirm] = useState(false);
  const [readView, setReadView] = useState(null); // 回看往期
  const [modeOpen, setModeOpen] = useState(false); // 顶栏下拉：切回线上/线下
  const [pastOpen, setPastOpen] = useState(false); // 往期场次选择
  const [customStyles, setCustomStyles] = useState(() => loadJSON("x_offlineStyles", []));
  const [styleSheet, setStyleSheet] = useState(false); // 新建自定义预设
  const [custOpen, setCustOpen] = useState(false);     // 设置里内联新建自定义文风
  const [cName2, setCName2] = useState("");
  const [cPrompt, setCPrompt] = useState("");
  const [editingStyleKey, setEditingStyleKey] = useState("");   // 非空=正在改这条自定义文风，保存时原地覆盖
  const styleFileRef = useRef(null);
  const os = settings || {};
  const [setOpen, setSetOpen] = useState(false);
  const [sMax, setSMax] = useState(os.maxTokens || 4000);
  const [sMinW, setSMinW] = useState(os.minWords || 0);
  const [sLengthMode, setSLengthMode] = useState(os.lengthMode === "immersive" ? "immersive" : "natural");
  const [sMemN, setSMemN] = useState(os.memN != null ? os.memN : 6);
  const [sOnlineN, setSOnlineN] = useState(os.onlineCtxN != null ? os.onlineCtxN : 50);
  const [sSelf, setSSelf] = useState(os.selfP || "first");
  const [sUser, setSUser] = useState(os.userP || "second");
  const [sDesc, setSDesc] = useState(!!os.describeMe);
  const [sTastePace, setSTastePace] = useState(activeSession && activeSession.taste && activeSession.taste.pace || os.tastePace || "auto");
  const [sTasteFocus, setSTasteFocus] = useState(activeSession && activeSession.taste && activeSession.taste.focus || os.tasteFocus || "auto");
  const [sTasteDensity, setSTasteDensity] = useState(activeSession && activeSession.taste && activeSession.taste.density || os.tasteDensity || "auto");
  const [sBg, setSBg] = useState(os.bg || "");
  const bgFileRef = useRef(null);
  const persRow = (label, val, set, opts) => h("div", { className: "flex items-center justify-between pt-3" },
    h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, label),
    h("div", { className: "flex gap-1" }, opts.map(o => h("button", { key: o.v, onClick: () => set(o.v), style: { fontFamily: F_BODY, fontSize: 12, padding: "5px 11px", borderRadius: 999, background: val === o.v ? t.ink : "transparent", color: val === o.v ? t.bg2 : t.fog, border: "1px solid " + (val === o.v ? t.ink : t.line) } }, o.t))));
  const offlineSetSheet = () => setOpen && onSaveSettings && h(Sheet, { onClose: () => setSetOpen(false), tall: true },
    h("div", { className: "flex items-center justify-between mb-1" },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.ink } }, "线下设置"),
      h("button", { onClick: () => { onSaveSettings({ presetOn, presetId, maxTokens: sMax, minWords: sMinW, lengthMode: sLengthMode, memN: sMemN, onlineCtxN: sOnlineN, selfP: sSelf, userP: sUser, describeMe: sDesc, tastePace: sTastePace, tasteFocus: sTasteFocus, tasteDensity: sTasteDensity, bg: sBg }); onChangeStyle && onChangeStyle({ styleKey, presetOn, presetId, stylePrompt: (curStyle && curStyle.prompt) || "", taste: { pace: sTastePace, focus: sTasteFocus, density: sTasteDensity } }); setSetOpen(false); } }, h(ICheck, { size: 19, color: t.ink }))),
    h("div", { style: { marginTop: 14, padding: "9px 11px", borderRadius: 9, border: "1px dashed " + t.line, background: t.bg, fontFamily: "monospace", fontSize: 10.5, lineHeight: 1.65, color: t.fog } },
      h("div", null, ".87 immersive fine-grained editor · 仅内存诊断"),
      registerTelemetry
        ? h(React.Fragment, null,
          h("div", { style: { color: registerTelemetry.registerCalibrationInjected ? t.tint : t.sub } },
            "transition: " + registerTelemetry.transitionBefore + " → " + registerTelemetry.transitionAfter,
            h("br"),
            "user beat / preflight / post-draft: " + registerTelemetry.registerInputBeat + " / " + registerTelemetry.registerPreflightActive + " / " + registerTelemetry.registerActive),
          h("div", null,
            "rewrite requested: " + registerTelemetry.rewriteRequested,
            h("br"),
            "character supply: " + (registerTelemetry.characterSupplyInjected ? "injected" : "not injected"),
            h("br"),
            "archetype guard: " + (registerTelemetry.archetypeRevisionRequested ? "injected" : "not injected"),
            h("br"),
            registerTelemetry.minimumLengthTarget
              ? "minimum chars: " + registerTelemetry.minimumLengthChars + " / " + registerTelemetry.minimumLengthTarget
                + (registerTelemetry.minimumLengthRepairApplied
                  ? " · repaired ×" + registerTelemetry.minimumLengthRepairAttempts
                  : " · direct")
                + (registerTelemetry.minimumLengthSatisfied ? " · satisfied" : " · failed")
              : "minimum chars: off",
            h("br"),
            "rewrite: " + (registerTelemetry.rewriteApplied ? "applied" : "not applied"),
            registerTelemetry.rewriteApplied ? h(React.Fragment, null,
              h("br"),
              "chars: " + registerTelemetry.rewriteDraftChars + " → " + registerTelemetry.rewriteFinalChars + " (" + Math.round((registerTelemetry.rewriteLengthRatio || 0) * 100) + "%)",
              h("br"),
              "renderer residue: " + registerTelemetry.rendererScoreBefore + " → " + registerTelemetry.rendererScoreAfter,
              h("br"),
              "dimension repeats: " + registerTelemetry.rendererRepeatsBefore + " → " + registerTelemetry.rendererRepeatsAfter,
              h("br"),
              "fact coverage: " + registerTelemetry.rewriteCoveredFactUnits + "/" + registerTelemetry.rewriteFactUnits + " (" + Math.round((registerTelemetry.rewriteFactCoverage || 0) * 100) + "%)",
              h("br"),
              "character coverage: " + registerTelemetry.rewriteCoveredCharacterUnits + "/" + registerTelemetry.rewriteCharacterUnits + " (" + Math.round((registerTelemetry.rewriteCharacterCoverage || 0) * 100) + "%)",
              registerTelemetry.rewriteOpCounts ? h(React.Fragment, null,
                h("br"),
                "ops K/R/D: " + (registerTelemetry.rewriteOpCounts.KEEP || 0) + "/" + (registerTelemetry.rewriteOpCounts.REWRITE || 0) + "/" + (registerTelemetry.rewriteOpCounts.DELETE || 0)) : null,
              registerTelemetry.rewriteDraft ? h("details", { style: { marginTop: 5 } },
                h("summary", { style: { cursor: "pointer" } }, "查看首遍草稿（不入 history）"),
                h("div", { style: { whiteSpace: "pre-wrap", marginTop: 4, maxHeight: 180, overflow: "auto" } }, registerTelemetry.rewriteDraft)) : null) : null))
        : h("div", null, "还没有本轮记录")),
    h("div", { className: "flex items-center justify-between pt-5" },
      h("div", { className: "pr-3" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.sub } }, "场景背景图"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, sBg ? "已设置 · 可更换或清除" : "从相册选一张图当这次赴约的背景")),
      h("div", { className: "flex items-center gap-2 shrink-0" },
        sBg ? h("div", { style: { width: 38, height: 38, borderRadius: 8, background: "center/cover no-repeat url(\"" + sBg + "\")", border: "1px solid " + t.line } }) : null,
        h("button", { onClick: () => bgFileRef.current && bgFileRef.current.click(), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, border: "1px solid " + t.line, borderRadius: 8, padding: "7px 12px" } }, sBg ? "更换" : "选择"),
        sBg ? h("button", { onClick: () => setSBg(""), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent } }, "清除") : null,
        h("input", { ref: bgFileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; if (f) resizeImageFile(f, 1200, 0.82).then(d => setSBg(d)); e.target.value = ""; } }))),
    h("div", { className: "pt-5" },
      h("div", { className: "flex items-baseline justify-between mb-1" },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, "关联记忆条数"),
        h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 16, color: t.ink } }, sMemN + " 条")),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 10, lineHeight: 1.55 } }, "线下场景带入最近多少条记忆库条目（含单聊和群聊沉淀的）。"),
      h(Slider, { value: sMemN, min: 0, max: 20, step: 1, onChange: setSMemN })),
    h("div", { className: "pt-5" },
      h("div", { className: "flex items-baseline justify-between mb-1" },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, "带入线上私聊条数"),
        h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 16, color: t.ink } }, sOnlineN + " 条")),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 10, lineHeight: 1.55 } }, "每轮线下按真实时间带入最近多少条线上私聊；开场前和线下进行中后来发的消息都会参与，并与线下记录按时间合流。"),
      h(Slider, { value: sOnlineN, min: 0, max: 100, step: 5, onChange: setSOnlineN })),
    h("div", { className: "pt-4" },
      h("div", { className: "flex items-baseline justify-between mb-1" },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, "单次输出上限"),
        h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 16, color: t.ink } }, sMax + " tok")),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 10 } }, "这是输出容量上限，不会强迫模型把简单场景写长。"),
      h(Slider, { value: sMax, min: 400, max: 24000, step: 400, onChange: setSMax })),
    h("div", { className: "pt-5" },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub, marginBottom: 4 } }, "篇幅模式"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 8, lineHeight: 1.55 } }, sLengthMode === "immersive" ? "允许这一轮多生活一会儿：有内容才继续，到了需要你回应的位置就停。" : "由当前事件决定长短；简单反应可以短，有真实推进时自然展开。"),
      h("div", { className: "flex gap-2" },
        [{ v: "natural", t: "自然长度" }, { v: "immersive", t: "沉浸长文" }].map(o => h("button", { key: o.v, onClick: () => setSLengthMode(o.v), style: { fontFamily: F_BODY, fontSize: 12.5, padding: "7px 13px", borderRadius: 999, background: sLengthMode === o.v ? t.ink : "transparent", color: sLengthMode === o.v ? t.bg2 : t.fog, border: "1px solid " + (sLengthMode === o.v ? t.ink : t.line) } }, o.t)))),
    h("div", { className: "pt-5" },
      h("div", { className: "flex items-baseline justify-between mb-1" },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, "高级 · 最低字数目标"),
        h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 16, color: t.ink } }, sMinW ? sMinW + " 字" : "不限")),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 10, lineHeight: 1.55 } }, "只有明确需要字数时再开；固定下限可能增加扩写感，0 为关闭。"),
      h(Slider, { value: sMinW, min: 0, max: 3000, step: 100, onChange: setSMinW })),
    persRow("角色称自己", sSelf, setSSelf, [{ v: "first", t: "我" }, { v: "third", t: "她/他/名字" }]),
    persRow("角色称我", sUser, setSUser, [{ v: "second", t: "你" }, { v: "third", t: "她/他/名字" }]),
    h("div", { className: "flex items-center justify-between pt-5" },
      h("div", { className: "pr-3" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.sub } }, "让角色描写我的行动"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, "开：角色会替你写动作、推动走向（如「你摇了摇头说…」）；关：只写它自己。")),
      h(Toggle, { on: sDesc, onChange: () => setSDesc(v => !v) })),
    h(OfflineTastePanel, { t, pace: sTastePace, setPace: setSTastePace, focus: sTasteFocus, setFocus: setSTasteFocus, density: sTasteDensity, setDensity: setSTasteDensity }),
    h(OfflineStylePresetSection, { t, presetOn, setPresetOn, presetId, setPresetId, onOpenStyleLab }),
    styleSection,
    exampleSection);
  const scroller = useRef(null);
  const past = (sessions || []).filter(s => s.endTs);
  const allStyles = [...OFFLINE_STYLES, ...customStyles];
  const curStyle = allStyles.find(s => s.key === styleKey) || allStyles[0];
  const saveCustomStyle = () => {
    const nm = cName2.trim();
    const pr = cPrompt.trim();
    if (!nm || !pr) return;
    const key = editingStyleKey || ("custom_" + Date.now());
    const next = editingStyleKey
      ? customStyles.map(x => x.key === editingStyleKey ? { ...x, name: nm, prompt: pr } : x)
      : [...customStyles, { key, name: nm, prompt: pr, custom: true }];
    setCustomStyles(next);
    saveJSON("x_offlineStyles", next);
    setStyleKey(key);
    setEditingStyleKey("");
    setCName2("");
    setCPrompt("");
    setStyleSheet(false);
    setCustOpen(false);
  };
  const delCustomStyle = key => {
    const next = customStyles.filter(s => s.key !== key);
    if (!saveJSON("x_offlineStyles", next)) return toast && toast("这次没删成功，原预设还在");
    setCustomStyles(next);
    if (styleKey === key) setStyleKey("default");
  };
  // 自定义文风以前只能删了重贴——她那份有四千字，删一次就得重来一遍（她 2026-08-22）。
  // 装回输入框改，保存时按 key 原地覆盖，正在用的那局不用重选。
  const editCustomStyle = key => {
    const cur = customStyles.find(x => x.key === key);
    if (!cur) return;
    setCName2(cur.name || "");
    setCPrompt(cur.prompt || "");
    setEditingStyleKey(key);
  };
  const importStyleFile = async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const prompt = await readOfflineStyleDocument(file);
      if (!prompt) throw new Error("文件里没有读到文字");
      const name = file.name.replace(/\.(docx|txt|md)$/i, "").trim() || "导入文风";
      const key = "custom_" + Date.now();
      const next = [...customStyles, { key, name, prompt, custom: true, imported: true }];
      setCustomStyles(next); saveJSON("x_offlineStyles", next); setStyleKey(key);
      toast("已导入文风 · " + name + "（" + prompt.length + " 字）");
    } catch (err) { alert("导入失败：" + (err && err.message || "请改用 txt 文件")); }
  };
  const styleImportControl = h("span", { className: "inline-flex" },
    h("button", { onClick: () => styleFileRef.current && styleFileRef.current.click(), className: "px-3 py-1.5 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 999, border: "1px dashed " + t.line, background: "transparent", color: t.fog } }, "⇧ 导入文件"),
    h("input", { ref: styleFileRef, type: "file", accept: ".docx,.txt,.md,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document", style: { display: "none" }, onChange: importStyleFile }));
  // 设置弹层里的「文风预设」小节（进行中随时改）
  const styleSection = h("div", { className: "pt-5", style: { borderTop: "1px solid " + t.line, marginTop: 18 } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.sub, marginBottom: 2 } }, "文风预设"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 10, lineHeight: 1.6 } }, "剧情不同段落想换个笔调，随时切换，保存后下次演绎生效。"),
    h("div", { className: "flex flex-wrap gap-2 mb-2" }, allStyles.map(s => h("button", {
      key: s.key, onClick: () => { setStyleKey(s.key); setCustOpen(false); },
      className: "px-3 py-1.5", style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 999, border: "1px solid " + (styleKey === s.key ? t.ink : t.line), background: styleKey === s.key ? t.ink : "transparent", color: styleKey === s.key ? t.bg2 : t.sub }
    }, s.name)).concat([h("button", {
      key: "__add", onClick: () => setCustOpen(v => !v),
      className: "px-3 py-1.5", style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 999, border: "1px dashed " + t.line, background: "transparent", color: t.fog }
    }, "＋ 自定义"), styleImportControl])),
    custOpen
      ? h("div", { className: "p-3", style: { background: t.bg, borderRadius: 8, border: "1px solid " + t.line } },
          (editingStyleKey ? h("div", { className: "flex items-center gap-3 mb-2" },
            h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, "正在改「" + ((customStyles.find(x => x.key === editingStyleKey) || {}).name || "") + "」·保存后原地覆盖"),
            h("button", { onClick: () => { setEditingStyleKey(""); setCName2(""); setCPrompt(""); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "取消")) : null),
          h("input", { value: cName2, onChange: e => setCName2(e.target.value), placeholder: "预设名称，如 冷冽克制", className: "w-full outline-none p-2.5 mb-2", style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, background: "#fff", border: "1px solid " + t.line, borderRadius: 8 } }),
          h("textarea", { value: cPrompt, onChange: e => setCPrompt(e.target.value), rows: 3, placeholder: "写给 AI 的文风提示词，如：多用短句，冷色调意象，情绪藏在动作里…", className: "w-full outline-none p-2.5 mb-2", style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, color: t.ink, background: "#fff", border: "1px solid " + t.line, borderRadius: 8, resize: "none" } }),
          h("button", { onClick: saveCustomStyle, className: "w-full py-2.5", style: { fontFamily: F_BODY, fontSize: 13, background: t.ink, color: t.bg2, borderRadius: 8 } }, "保存并选用"))
      : h("div", { className: "p-3", style: { background: t.bg, borderRadius: 8, border: "1px solid " + t.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1, color: t.fog, marginBottom: 4 } }, "提示词 · " + (curStyle ? curStyle.name : "")),
          h(OfflineStylePromptPreview, { style: curStyle, t }),
          curStyle && curStyle.custom && h("div", { className: "mt-2 flex items-center gap-4" }, h("button", { onClick: () => editCustomStyle(curStyle.key), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, "编辑此预设"), h("button", { onClick: () => requestAppConfirm("删掉「" + (curStyle.name || "这条预设") + "」？", "内容不会留档。", () => delCustomStyle(curStyle.key), "删除"), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.accent } }, "删除此预设"))));
  const exampleSection = h("div", { className: "pt-5", style: { borderTop: "1px solid " + t.line, marginTop: 18 } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.sub } }, "好吃片段库 · " + ((os.examples || []).length) + "/12"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 3, marginBottom: 10, lineHeight: 1.6 } }, "在角色写得特别对味的卡片上点 ✦ 收藏。生成时本地挑最多两段，只学声纹和节奏，不照抄旧剧情，也不额外调用模型。"),
    (os.examples || []).length
      ? h("div", { className: "flex flex-col gap-2" }, (os.examples || []).slice().reverse().map(x => h("div", { key: x.id, className: "flex gap-2 items-start", style: { padding: "9px 10px", border: "1px solid " + t.line, borderRadius: 9, background: t.bg } },
          h("div", { className: "flex-1", style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.55, color: t.sub } }, String(x.text || "").replace(/\s+/g, " ").slice(0, 100) + (String(x.text || "").length > 100 ? "…" : "")),
          h("button", { onClick: () => onDeleteExample && onDeleteExample(x.id), className: "active:opacity-50 shrink-0", style: { fontFamily: F_BODY, fontSize: 14, color: t.fog }, title: "移出片段库" }, "×"))))
      : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "还没有收藏。先在线下演几轮，遇到好吃的就点 ✦。"));
  useEffect(() => {
    if (activeSession && view === "setup") setView("live");
  }, [activeSession]);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [activeSession && activeSession.msgs.length, sending, view]);

  const enter = () => {
    onSaveSettings && onSaveSettings({ tastePace: sTastePace, tasteFocus: sTasteFocus, tasteDensity: sTasteDensity });
    onStart({ opening: opening.trim(), styleKey, presetOn, presetId, stylePrompt: (curStyle && curStyle.prompt) || "", taste: { pace: sTastePace, focus: sTasteFocus, density: sTasteDensity } });
    setView("live");
  };
  const send = () => {
    if (!input.trim() || sending) return;
    if (oocMode) { onOOC && onOOC(input.trim()); setInput(""); return; }
    onSend(input.trim());
    setInput("");
  };
  const reply = () => {
    if (sending) return;
    const v = input.trim();
    setInput("");
    onReply(v);
  };
  const sendPhoto = async () => {
    if (!photoImg || sending || !onSendPhoto) return;
    const imageRef = await imgToVault(photoImg);
    await rememberRealPhoto(imageRef, photoDesc.trim(), "offline");
    onSendPhoto({ kind: "photo", imageRef, desc: photoDesc.trim(), content: photoDesc.trim() ? "[照片] " + photoDesc.trim() : "[照片]" });
    setPhotoImg(""); setPhotoDesc(""); setPhotoOpen(false);
  };
  const saveNote = () => {
    if (note.trim()) onAddNote(note.trim());
    setNote("");
    setNoteOpen(false);
  };

  const sheet = (title, children) => h("div", {
    className: "absolute inset-0 z-30 flex items-end", style: { background: "rgba(0,0,0,.35)" }, onClick: () => { setPhotoOpen(false); setNoteOpen(false); setEndConfirm(false); setStyleSheet(false); setModeOpen(false); setPastOpen(false); }
  }, h("div", {
    onClick: e => e.stopPropagation(), className: "w-full p-5 pb-8", style: { background: t.bg2, borderTopLeftRadius: 18, borderTopRightRadius: 18 }
  }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, marginBottom: 12 } }, title), children));

  // ---- 往期回看 ----
  if (readView) {
    return h("div", { className: "absolute inset-0 z-20 flex flex-col", style: { background: t.bg, paddingTop: safeTop(0) } },
      h("div", { className: "flex items-center gap-3 px-4 py-3 shrink-0", style: { borderBottom: `1px solid ${t.line}` } },
        h("button", { onClick: () => setReadView(null), className: "active:opacity-50" }, h(IArrow, { size: 22, color: t.ink })),
        h("div", { className: "flex-1", style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "线下记录 · " + fmtStamp(readView.startTs)),
        onDelSession && h("button", { onClick: () => { const id = readView.id, idx = sessions.indexOf(readView); setReadView(null); onDelSession(id, idx); }, className: "active:opacity-50 shrink-0", title: "删除这条记录" }, h(ITrash, { size: 18, color: t.fog }))),
      h("div", { className: "flex-1 overflow-y-auto px-5 py-5" },
        readView.summary && h("div", { className: "mb-4 p-3", style: { background: t.bg2, borderRadius: 10, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: t.sub } }, "【当时总结】" + readView.summary),
        (readView.msgs || []).map((m, i) => h(OffCard, { key: m.id || i, m: m, t: t, char: char, meProfile: profile, editable: false }))));
  }

  // ---- setup ----
  if (view === "setup") {
    return h("div", { className: "absolute inset-0 z-20 flex flex-col", style: { background: t.bg, paddingTop: safeTop(0) } },
      h("div", { className: "flex items-center gap-3 px-4 py-3 shrink-0", style: { borderBottom: `1px solid ${t.line}` } },
        h("button", { onClick: exit, className: "active:opacity-50" }, h(IArrow, { size: 22, color: t.ink })),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "赴约 · " + cName),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginLeft: "auto" } }, room && !room.main ? room.name + " · 独立" : "线下面对面")),
      h("div", { className: "flex-1 overflow-y-auto px-5 py-5" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: t.fog, marginBottom: 18 } }, "进入线下后，你和 " + cName + " 默认身处同一个地方，Ta 会带动作、心理与旁白地演绎。" + (room && !room.main ? "这场只属于「" + room.name + "」，心声和记录不写回主时间线。" : "") + "可以先铺垫一句开场，选一个文风。"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, marginBottom: 6 } }, "开场白 / 铺垫第一句剧情"),
        h("textarea", { value: opening, onChange: e => setOpening(e.target.value), rows: 3, placeholder: "如：*雨下得很大，我推门进了那家咖啡馆，看见你已经坐在窗边*（留空则由 Ta 起头）", className: "w-full outline-none p-3 mb-5", style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.6, color: t.ink, background: "#fff", border: `1px solid ${t.line}`, borderRadius: 8, resize: "none" } }),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, marginBottom: 8 } }, "文风预设"),
        h("div", { className: "flex flex-wrap gap-2 mb-3" }, allStyles.map(s => h("button", {
          key: s.key, onClick: () => setStyleKey(s.key),
          className: "px-3 py-1.5", style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 999, border: `1px solid ${styleKey === s.key ? t.ink : t.line}`, background: styleKey === s.key ? t.ink : "transparent", color: styleKey === s.key ? t.bg2 : t.sub }
        }, s.name)).concat([h("button", {
          key: "__add", onClick: () => setStyleSheet(true),
          className: "px-3 py-1.5", style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 999, border: `1px dashed ${t.line}`, background: "transparent", color: t.fog }
        }, "＋ 自定义"), styleImportControl])),
        // 选中预设的提示词原文
        h("div", { className: "mb-6 p-3", style: { background: t.bg2, borderRadius: 8, border: `1px solid ${t.line}` } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1, color: t.fog, marginBottom: 4 } }, "提示词 · " + (curStyle ? curStyle.name : "")),
          h(OfflineStylePromptPreview, { style: curStyle, t }),
          curStyle && curStyle.custom && h("div", { className: "mt-2 flex items-center gap-4" }, h("button", { onClick: () => editCustomStyle(curStyle.key), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, "编辑此预设"), h("button", { onClick: () => requestAppConfirm("删掉「" + (curStyle.name || "这条预设") + "」？", "内容不会留档。", () => delCustomStyle(curStyle.key), "删除"), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.accent } }, "删除此预设"))),
        h(OfflineTastePanel, { t, compact: true, pace: sTastePace, setPace: setSTastePace, focus: sTasteFocus, setFocus: setSTasteFocus, density: sTasteDensity, setDensity: setSTasteDensity }),
        h("button", { onClick: enter, className: "w-full py-3 mb-8", style: { fontFamily: F_BODY, fontSize: 14, background: t.ink, color: t.bg2, borderRadius: 8 } }, "进入线下 →"),
        past.length > 0 && h("div", null,
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: t.fog, marginBottom: 8 } }, "往期线下记录"),
          past.map(s => h("div", { key: s.id, className: "mb-2 p-3 flex items-start gap-2", style: { background: t.bg2, borderRadius: 10, border: `1px solid ${t.line}` } },
            h("button", { onClick: () => setReadView(s), className: "flex-1 text-left active:opacity-70" },
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 3 } }, fmtStamp(s.startTs)),
              h("div", { className: "line-clamp-2", style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, color: t.sub } }, s.summary || (s.msgs[0] && s.msgs[0].content) || "（无总结）")),
            onDelSession && h("button", { onClick: () => onDelSession(s.id, sessions.indexOf(s)), className: "active:opacity-50 shrink-0 pt-0.5", title: "删除这条记录" }, h(ITrash, { size: 16, color: t.fog })))))),
      styleSheet && sheet("自定义文风预设", h("div", null,
        (editingStyleKey ? h("div", { className: "flex items-center gap-3 mb-2" },
            h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, "正在改「" + ((customStyles.find(x => x.key === editingStyleKey) || {}).name || "") + "」·保存后原地覆盖"),
            h("button", { onClick: () => { setEditingStyleKey(""); setCName2(""); setCPrompt(""); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "取消")) : null),
          h("input", { value: cName2, onChange: e => setCName2(e.target.value), placeholder: "预设名称，如 冷冽克制", className: "w-full outline-none p-3 mb-3", style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, background: "#fff", border: `1px solid ${t.line}`, borderRadius: 8 } }),
        h("textarea", { value: cPrompt, onChange: e => setCPrompt(e.target.value), rows: 4, placeholder: "写给 AI 的文风提示词，如：多用短句，冷色调意象，情绪藏在动作里，少直白抒情…", className: "w-full outline-none p-3 mb-3", style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.6, color: t.ink, background: "#fff", border: `1px solid ${t.line}`, borderRadius: 8, resize: "none" } }),
        h("button", { onClick: saveCustomStyle, className: "w-full py-3", style: { fontFamily: F_BODY, fontSize: 13.5, background: t.ink, color: t.bg2, borderRadius: 8 } }, "保存并选用"))));
  }

  // ---- live ----
  const msgs = activeSession ? activeSession.msgs : [];
  return h("div", { className: "absolute inset-0 z-20 flex flex-col", style: os.bg ? { backgroundImage: "url(\"" + resolveImg(os.bg) + "\")", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" } : offSceneBg(t) },
    h("div", { className: "flex items-center gap-3 px-4 py-3 shrink-0", style: { paddingTop: safeTop(12), borderBottom: `1px solid ${t.line}`, background: os.bg ? "rgba(255,255,255,0.5)" : t.bg2, backdropFilter: os.bg ? "blur(8px)" : "none", WebkitBackdropFilter: os.bg ? "blur(8px)" : "none" } },
      h("button", { onClick: exit, className: "active:opacity-50 flex items-center gap-1" }, h(IArrow, { size: 20, color: t.ink }), h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, "离开")),
      h("button", { onClick: () => setModeOpen(true), className: "flex-1 text-center active:opacity-60" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, cName + " ⌄"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: 1, color: t.fog } }, room && !room.main ? room.name + " · 独立线下" : "OFFLINE · 线下 · 轻触切换")),
      h("button", { onClick: () => setNoteOpen(true), className: "active:opacity-50", title: "给 Ta 一个提示" }, h(IPlus, { size: 20, color: t.fog })),
      onSaveSettings && h("button", { onClick: () => setSetOpen(true), className: "active:opacity-50", title: "线下设置（人称/输出长度）", style: { fontFamily: F_BODY, fontSize: 17, color: t.fog } }, "⚙"),
      h("button", { onClick: () => setEndConfirm(true), className: "active:opacity-60 px-2 py-1", style: { fontFamily: F_BODY, fontSize: 12, color: t.accent } }, "结束")),
    (!room || room.main || !!(room.cognition && room.cognition.schedule)) && schedNow && h("button", { onClick: onOpenSched, className: "shrink-0 w-full flex items-center gap-2 active:opacity-70", style: { background: schedNow.dev ? "rgba(194,90,74,0.08)" : (os.bg ? "rgba(255,255,255,0.45)" : t.bg2), borderBottom: "1px solid " + t.line, padding: "6px 16px" } },
      h("span", { style: { width: 6, height: 6, borderRadius: 999, background: schedNow.dev ? t.accent : t.tint, flexShrink: 0 } }),
      h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: "0.12em", color: t.fog, flexShrink: 0 } }, "NOW"),
      schedNow.time && h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, color: t.fog, flexShrink: 0 } }, schedNow.time),
      h(Marquee, { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 12, color: t.ink } }, schedNow.title + (schedNow.location ? " · " + schedNow.location : "")),
      schedNow.dev && h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.accent, flexShrink: 0 } }, "改"),
      onOpenSched && h(IChevR, { size: 13, color: t.fog, style: { marginLeft: "auto", flexShrink: 0 } })),
    // 当前这局用的是哪个文风（v55.44）。她 2026-08-22 放了份自定义文风进去却完全没生效，
    // 而界面上根本看不出这局到底挂着哪一个——排查全靠猜。摆出来，没挂上一眼就看见。
    (function () {
      const sess = (sessions || []).find(x => x && !x.endTs);
      if (!sess) return null;
      const key = sess.styleKey || "default";
      const own = (sess.stylePrompt || "").trim();
      const named = [...OFFLINE_STYLES, ...customStyles].find(x => x.key === key);
      const usingPreset = !!(sess.presetOn && sess.presetId && window.StylePresets && window.StylePresets.byId(sess.presetId));
      const presetName = usingPreset ? window.StylePresets.byId(sess.presetId).name : "";
      const on = usingPreset || !!(own || (named && named.prompt));
      return h("div", { onClick: () => setSetOpen(true), className: "shrink-0 w-full flex items-center gap-1.5 px-4 pb-1 active:opacity-60" },
        h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: ".12em", color: t.fog } }, "STYLE"),
        h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: on ? t.sub : t.fog } },
          usingPreset ? presetName + "（预设台）" : on ? (named ? named.name : "自定义") + (named && named.custom ? "（自定义）" : "") : "未设文风 · 走通用叙事"));
    })(),
    offlineSetSheet(),
    modeOpen && sheet("切换", h("div", { className: "space-y-1" },
      h("button", { onClick: () => { setModeOpen(false); onClose(); }, className: "w-full text-left py-3 px-2 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 14.5, color: t.ink } }, "💬 对话（回到线上聊天）"),
      h("div", { className: "w-full py-3 px-2", style: { fontFamily: F_BODY, fontSize: 14.5, color: t.tint, background: t.bg, borderRadius: 10 } }, "🎬 赴约 · 线下相处（当前）✓"),
      h("button", { onClick: () => { setModeOpen(false); setPastOpen(true); }, className: "w-full text-left py-3 px-2 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 14.5, color: t.ink } }, "🗂 往期线下记录"))),
    pastOpen && sheet("往期线下记录", h("div", { className: "space-y-2", style: { maxHeight: "52vh", overflowY: "auto" } },
      (sessions || []).filter(s => s.endTs).length === 0
        ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", padding: "24px 0" } }, "还没有已结束的线下记录。")
        : (sessions || []).filter(s => s.endTs).sort((a, b) => (b.startTs || 0) - (a.startTs || 0)).map(s => h("button", { key: s.id, onClick: () => { setPastOpen(false); setReadView(s); }, className: "w-full text-left active:opacity-70", style: { padding: "12px 13px", borderRadius: 12, background: t.bg2, border: "1px solid " + t.line, display: "block" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink } }, (s.startTs ? new Date(s.startTs).toLocaleDateString() : "线下记录")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 3, lineHeight: 1.5 } }, String(s.summary || (s.msgs && s.msgs.length ? s.msgs.length + " 段" : "")).replace(/\s+/g, " ").slice(0, 60) || "点开回看"))))),
    h("div", { ref: scroller, className: "flex-1 overflow-y-auto px-4 py-3" },
      msgs.length === 0 && !sending && h("div", { className: "text-center mt-10", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, "场景已布置好，说点什么或让 Ta 先开口。"),
      msgs.map((m, i) => h(OffCard, { key: m.id || i, m: m, msgIndex: i, t: t, char: char, meProfile: profile, editable: true, sending: sending, onEdit: onEditMsg, onReroll: onRerollMsg, onDelete: onDelMsg, onSaveExample: onSaveExample, onOpenState: onOpenState })),
      sending && h("div", { className: "flex gap-1 mt-3 justify-center" }, [0, 1, 2].map(i => h("span", { key: i, className: "w-1.5 h-1.5 rounded-full animate-pulse", style: { background: t.fog, animationDelay: i * 0.15 + "s" } })))),
    h("div", { className: "flex items-center gap-2 px-3 py-2.5 shrink-0", style: { background: oocMode ? "rgba(194,90,74,0.06)" : t.bg2, borderTop: `1px solid ${oocMode ? t.accent : t.line}`, paddingBottom: COMPOSER_PAD_BOTTOM, marginBottom: kbLift, transition: "margin-bottom .18s ease" } },
      onOOC && h("button", { onClick: () => setOocMode(v => !v), title: "OOC · 越过角色直接和模型说 / 立长期准则", className: "active:opacity-60 shrink-0", style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: 0.5, padding: "8px 10px", borderRadius: 999, border: "1px solid " + (oocMode ? t.accent : t.line), color: oocMode ? t.accent : t.fog, background: oocMode ? "rgba(194,90,74,0.10)" : "transparent" } }, "OOC"),
      !oocMode && onSendPhoto && h("button", { onClick: () => setPhotoOpen(true), title: "给 Ta 看真实照片", className: "active:opacity-60 shrink-0", style: { width: 34, height: 34, borderRadius: 999, border: "1px solid " + t.line, color: t.fog, background: "transparent", fontSize: 16 } }, "＋"),
      h("input", { value: input, onChange: e => setInput(e.target.value), onKeyDown: e => e.key === "Enter" && send(), placeholder: oocMode ? "OOC：肘击模型 / 问状态 / 立规矩…" : "说话，或写你的动作…", className: "flex-1 outline-none px-4 py-2.5 rounded-full", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: "#fff", border: `1px solid ${oocMode ? t.accent : t.line}`, minWidth: 0 } }),
      h("button", { onClick: send, disabled: sending || !input.trim(), className: "active:opacity-70 disabled:opacity-30 flex items-center justify-center shrink-0", style: { width: 40, height: 40, borderRadius: 999, background: oocMode ? t.accent : BUBBLE_SKIN.myBg } }, h(ISend, { size: 16, color: oocMode ? "#fff" : BUBBLE_SKIN.myText })),
      !oocMode && h("button", { onClick: reply, disabled: sending, title: "让 Ta 演绎", className: "active:opacity-70 disabled:opacity-40 flex items-center justify-center shrink-0", style: { width: 40, height: 40, borderRadius: 999, background: t.ink } }, sending ? h("div", { className: "flex gap-0.5" }, [0, 1, 2].map(i => h("span", { key: i, className: "w-1 h-1 rounded-full animate-pulse", style: { background: t.bg2, animationDelay: i * 0.15 + "s" } }))) : h(ISpark, { size: 19, color: t.bg2 }))),
    photoOpen && sheet("照片", h("div", null,
      // 当场拍一张：你俩此刻真的在同一个地方，这一格是现拍的。零模型调用——
      // 画面直接从状态卡（此刻在干嘛、穿什么）长出来，只花一次出图的钱。
      onShoot ? h("div", { className: "mb-4" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 8, lineHeight: 1.5 } },
          canShoot ? "当场拍一张（照此刻的样子出图）" : "接一个图像模型、再给 Ta 填上外貌或参考照，就能当场拍了"),
        h("div", { className: "flex gap-2" }, [
          ["duo", "我俩合照", canShoot && canShootDuo],
          ["other", "我替 Ta 拍", canShoot],
          ["self", "让 Ta 自拍", canShoot]
        ].map(([k, label, ok]) => h("button", {
          key: k,
          onClick: () => { if (!ok) return; setPhotoOpen(false); onShoot(k); },
          disabled: !ok,
          className: "flex-1 py-2.5 active:opacity-70 disabled:opacity-30",
          style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, background: t.bg, border: "1px solid " + t.line, borderRadius: 10 }
        }, label))),
        (canShoot && !canShootDuo) ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6, lineHeight: 1.5 } }, "合照要你俩各自的参考照都在，才能把两张脸都锁住") : null,
        h("div", { style: { height: 1, background: t.line, margin: "14px 0 12px" } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 8 } }, "或者，给 Ta 看你手机里的一张")) : null,
      h("button", { onClick: () => photoFileRef.current && photoFileRef.current.click(), className: "w-full mb-3 active:opacity-70", style: { minHeight: 150, border: "1px dashed " + t.line, borderRadius: 12, overflow: "hidden", background: t.bg } },
        photoImg ? h("img", { src: photoImg, style: { display: "block", width: "100%", maxHeight: 280, objectFit: "contain" } }) : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 1.8 } }, "点这里选择照片\n相机或相册都可以")),
      h("input", { ref: photoFileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; if (f) resizeImageFile(f, 1600, 0.86).then(setPhotoImg); e.target.value = ""; } }),
      h("input", { value: photoDesc, onChange: e => setPhotoDesc(e.target.value), placeholder: "配一句话（可不填）", className: "w-full outline-none p-3 mb-3", style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, background: "#fff", border: "1px solid " + t.line, borderRadius: 8 } }),
      h("button", { onClick: sendPhoto, disabled: !photoImg || sending, className: "w-full py-3 disabled:opacity-30", style: { fontFamily: F_BODY, fontSize: 13.5, background: t.ink, color: t.bg2, borderRadius: 8 } }, "发送照片"))),
    noteOpen && sheet("给 Ta 一个提示（临时导演）", h("div", null,
      h("textarea", { value: note, onChange: e => setNote(e.target.value), rows: 3, placeholder: "如：让气氛缓和下来 / 你其实在生气 / 把话题引到那件事上", className: "w-full outline-none p-3 mb-3", style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.6, color: t.ink, background: "#fff", border: `1px solid ${t.line}`, borderRadius: 8, resize: "none" } }),
      h("button", { onClick: saveNote, className: "w-full py-3", style: { fontFamily: F_BODY, fontSize: 13.5, background: t.ink, color: t.bg2, borderRadius: 8 } }, "加入提示"))),
    endConfirm && sheet("结束这段线下？", h("div", null,
      h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, color: t.fog, marginBottom: 14 } }, "结束后会把这段经过总结进记忆库，记录也会保存下来供回看。"),
      h("div", { className: "flex gap-3" },
        h("button", { onClick: () => setEndConfirm(false), className: "flex-1 py-3", style: { fontFamily: F_BODY, fontSize: 13, border: `1px solid ${t.line}`, color: t.ink, borderRadius: 8 } }, "继续相处"),
        h("button", { onClick: () => { setEndConfirm(false); onEnd(); }, disabled: sending, className: "flex-1 py-3", style: { fontFamily: F_BODY, fontSize: 13, background: t.accent, color: "#fff", borderRadius: 8 } }, sending ? "总结中…" : "结束并总结")))));
}
// 线下卡片：char/user/narration 都做成带头像的卡，右上角 编辑/重写/删除；留白多，便于后续美化
// 思维链「看TA怎么想的」：一个低调的可展开小入口，全局复用（线下/同人文/梦境）
function CotReveal({ cot, requested }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  if ((!cot || !String(cot).trim()) && !requested) return null;
  const missing = !cot || !String(cot).trim();
  return h("div", { className: "mt-2.5" },
    h("button", {
      onClick: e => { e.stopPropagation(); setOpen(o => !o); },
      className: "active:opacity-60",
      style: { fontFamily: "monospace", fontSize: 10, letterSpacing: 0.4, color: t.fog, padding: "1px 0" }
    }, (open ? "▾ " : "▸ ") + (missing ? "创作小稿 · 本轮未返回" : "创作小稿 · 看落笔计划")),
    open && h("div", { style: { marginTop: 6, padding: "9px 11px", borderRadius: 10, background: t.bg, border: `1px dashed ${t.line}` } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.72, color: missing ? t.fog : t.sub, whiteSpace: "pre-wrap" } }, missing ? "模型这轮没有按标记格式返回小稿；正文已正常保留。这不代表它没有内部推理。" : String(cot).trim())));
}
// 从 IndexedDB 取一张图，换成能用的 objectURL（用完撤掉，别攒着）。
// v60.35 抽出来：通话页的画面、通话记录卡上的缩略图都要用，
// 别让这段 blob→URL→revoke 的舞步在三个地方各抄一遍。
function useIdbImgUrl(imgKey) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true, obj = null;
    setUrl(null);
    if (imgKey && typeof idbImgGet === "function") {
      idbImgGet(imgKey).then(b => { if (alive && b && b.size > 0) { obj = URL.createObjectURL(b); setUrl(obj); } }).catch(() => {});
    }
    return () => { alive = false; if (obj) URL.revokeObjectURL(obj); };
  }, [imgKey]);
  return url;
}
// 角色自拍气泡：从 IndexedDB 读出生成的图，pending 显示「拍照中」，failed 显示没拍成
function SelfieBubble({ m }) {
  const t = useTheme();
  const [url, setUrl] = useState(null);
  const [zoom, setZoom] = useState(false);
  const [imgErr, setImgErr] = useState(false);   // <img> 加载失败（坏数据/过期链接）
  const [idbMiss, setIdbMiss] = useState(false); // IndexedDB 里读不到（没存住/被清理）
  useEffect(() => {
    let alive = true, obj = null;
    if (m.imgKey && typeof idbImgGet === "function") {
      idbImgGet(m.imgKey).then(blob => {
        if (!alive) return;
        if (blob && blob.size > 0) { obj = URL.createObjectURL(blob); setUrl(obj); }
        else setIdbMiss(true);
      }).catch(() => { if (alive) setIdbMiss(true); });
    }
    return () => { alive = false; if (obj) URL.revokeObjectURL(obj); };
  }, [m.imgKey]);
  const shown = imgErr ? null : (url || m.imgUrl || null); // imgUrl = 跨域取不到 blob 时直接用的图片链接
  const box = { maxWidth: 200, borderRadius: 14, overflow: "hidden", border: "1px solid " + t.line, background: t.bg2 };
  // 所有非正常态都用这个卡片：说清人话原因 + 带上这张图本来拍的是什么
  const note = txt => h("div", { style: Object.assign({}, box, { padding: "14px 16px" }) },
    h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.55, color: t.fog } }, "📷 " + txt),
    m.desc ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, lineHeight: 1.5, color: t.fog, opacity: 0.65, marginTop: 5 } }, "（本来想拍：" + m.desc + "）") : null);
  if (m.pending) {
    // 卡「拍照中」超 6 分钟 = 生成时页面被 iOS 杀了/断线，别永远转下去
    if (m.ts && Date.now() - m.ts > 360000) return note("图没等回来（可能切了后台断线），让 TA 重拍一张吧");
    return h("div", { style: Object.assign({}, box, { padding: "24px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }) },
      h("div", { style: { fontSize: 22 } }, "📷"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "拍照中…"));
  }
  // 合照/别人拍的那两种也走这个气泡，写死「自拍」会说错话（v57.79）
  if (m.failed) return note((m.photoKind === "group" ? "合影" : m.photoKind === "duo" ? "合照" : m.photoKind === "other" ? "这张" : "自拍") + "没拍成");
  if (imgErr) return note(m.imgUrl && !url ? "图的临时链接已过期，看过就没啦" : "图数据坏了，显示不出来");
  if (shown) return h(React.Fragment, null,
    h("button", { onClick: () => setZoom(true), className: "active:opacity-80", style: box },
      h("img", { src: shown, onError: () => setImgErr(true), style: { display: "block", width: "100%", maxWidth: 200, maxHeight: 300, objectFit: "cover" } })),
    zoom && h("div", { onClick: () => setZoom(false), className: "fixed inset-0 z-50 flex items-center justify-center", style: { background: "rgba(0,0,0,0.85)" } },
      h("img", { src: shown, style: { maxWidth: "94%", maxHeight: "90%", borderRadius: 10 } })));
  if (idbMiss) return note("图没能存进本机图库（存储被系统清了或 iOS 抽风）");
  if (m.imgKey) return note("图加载中…还看不到就是没存住");
  return note("没拿到图");
}
// ---- 线下这一层的纸与光（她 2026-08-31：「纯色框配纯色背景，太单调」）----
// 单调的根子不在框素不素，在【旁白、角色、我】被画成了同一个盒子——一屏下来
// 十几个一模一样的方块，再给每个盒子加花纹也还是十几个一样的东西。
// 所以这一版做的是【把三种东西分开】：
//   · 旁白 = 舞台提示，不给框。短的居中当场次标题，长的靠左走一道细竖线，像剧本里的动作说明。
//   · 角色 = 一张纸：左边一道说话人本人的颜色，纸面一层顶光，底下一点影。
//   · 我   = 同一张纸，颜色换成主题强调色，纸再浅一档，一眼分得出哪边是自己。
// 颜色全部从主题里长出来（accent/tint/bg），她换任何皮肤都跟着走，不写死。
const offDark = t => (typeof skinIsDark === "function" ? skinIsDark(t.bg || "#fff") : false);
const offA = (hex, a) => {
  const v = String(hex || "").replace("#", "");
  if (v.length < 6) return "rgba(120,110,100," + a + ")";
  return "rgba(" + parseInt(v.slice(0, 2), 16) + "," + parseInt(v.slice(2, 4), 16) + "," + parseInt(v.slice(4, 6), 16) + "," + a + ")";
};
// 没有背景图时的场景底：两团从主题色里透上来的光 + 一层极细的斜纹。
// 有背景图那一路不动——那是她自己选的图，不该被我压一层东西上去。
function offSceneBg(t) {
  const d = offDark(t);
  return {
    backgroundColor: t.bg,
    backgroundImage: [
      "radial-gradient(125% 70% at 50% -12%, " + (d ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.8)") + ", transparent 62%)",
      "radial-gradient(85% 52% at 4% 102%, " + offA(t.tint, d ? 0.13 : 0.11) + ", transparent 66%)",
      "radial-gradient(72% 46% at 102% 86%, " + offA(t.accent, d ? 0.11 : 0.09) + ", transparent 68%)",
      "repeating-linear-gradient(102deg, " + (d ? "rgba(255,255,255,.014)" : "rgba(70,58,44,.016)") + " 0 1px, transparent 1px 4px)"
    ].join(", ")
  };
}
// 台词要用说话人自己的颜色，但角色的颜色是她随手挑的——浅黄、淡粉直接印在纸上根本看不清。
// 所以先量一遍对比度，不够就往深/往浅推到 4.5 为止（WCAG 正文线），不靠眼睛猜。
const offLum = hex => {
  const v = String(hex || "").replace("#", "");
  if (v.length < 6) return 0.5;
  const c = [0, 2, 4].map(i => { const x = parseInt(v.slice(i, i + 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const offContrast = (a, b) => { const l1 = offLum(a), l2 = offLum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
function offReadable(hex, bg) {
  const v = String(hex || "").replace("#", "");
  if (v.length < 6) return bg && offLum(bg) < 0.5 ? "#e8e2d8" : "#33302a";
  let rgb = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16));
  const toDark = offLum(bg) >= 0.5;                 // 纸是浅的就把字压深，纸是深的就把字提亮
  for (let i = 0; i < 24 && offContrast("#" + rgb.map(x => x.toString(16).padStart(2, "0")).join(""), bg) < 4.5; i++) {
    rgb = rgb.map(x => toDark ? Math.max(0, Math.round(x * 0.88)) : Math.min(255, Math.round(x + (255 - x) * 0.14)));
  }
  return "#" + rgb.map(x => x.toString(16).padStart(2, "0")).join("");
}
// ⭐这一层才是【治本】的那一下（她 2026-08-31：「你只是做换纸张也还是治标不治本」）。
// 她给的几张参考里，真正让一屏字活起来的不是纸的花纹，是【一段正文内部】台词和叙述
// 分得开——要么加粗、要么换色、要么压一条高亮。我们原来整段一个灰度，所以底下换什么纸
// 都还是一堵墙。这里把一段线下正文切成「台词 / 叙述」两种段：
//   · 台词 = 说话人自己的颜色（过了对比度）+ 一条极淡的同色高亮 + 稍重的字。引号本身压淡，让话自己站出来。
//   · 叙述 = 退到 t.sub。⚠️只有这段里【真的有台词】才退——整段都是叙述还退的话，等于白白把正文变浅。
// 引号判据用 engine 里那一份 speechSpans，不另写：念台词和上重音必须是同一个判断。
function offSplit(text) {
  const s = String(text || "");
  const spans = (typeof speechSpans === "function" ? speechSpans(s) : []);
  if (!spans.length) return [{ k: "prose", s: s }];
  const out = [];
  let at = 0;
  spans.forEach(sp => {
    if (sp.start > at) out.push({ k: "prose", s: s.slice(at, sp.start) });
    out.push({ k: "say", s: s.slice(sp.start, sp.end) });
    at = sp.end;
  });
  if (at < s.length) out.push({ k: "prose", s: s.slice(at) });
  return out.filter(x => x.s !== "");
}
function offBody(t, text, accent) {
  const segs = offSplit(text);
  const hasSay = segs.some(x => x.k === "say");
  const d = offDark(t);
  const sayInk = offReadable(accent || t.tint, t.bg2);
  return h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.9, color: hasSay ? t.sub : t.ink, whiteSpace: "pre-wrap" } },
    segs.map((x, i) => x.k === "prose" ? x.s : h("span", { key: i, style: {
      color: sayInk, fontWeight: 600,
      background: "linear-gradient(180deg, transparent 12%, " + offA(accent || t.tint, d ? 0.16 : 0.13) + " 12%, " + offA(accent || t.tint, d ? 0.16 : 0.13) + " 92%, transparent 92%)",
      borderRadius: 2, padding: "0 1px", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone"
    } }, x.s)));
}
function offCardSkin(t, accent) {
  const d = offDark(t);
  return {
    backgroundColor: t.bg2,
    backgroundImage: "linear-gradient(176deg, " + (d ? "rgba(255,255,255,.055)" : "rgba(255,255,255,.85)") + ", rgba(255,255,255,0) 60%)",
    borderRadius: 16,
    border: "1px solid " + t.line,
    borderLeft: "3px solid " + offA(accent, d ? 0.62 : 0.5),
    boxShadow: d ? "0 6px 18px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.06)"
                 : "0 5px 16px rgba(62,52,40,.07), inset 0 1px 0 rgba(255,255,255,.9)",
    padding: "14px 16px"
  };
}
function OffCard({ m, msgIndex, t, char, meProfile, members, onEdit, onReroll, onDelete, onSaveExample, editable, sending, onOpenState }) {
  const [editing, setEditing] = useState(false);
  const [txt, setTxt] = useState(m.content || "");
  const tp = useTtsPlayer(); // 整段 beat 朗读（懒合成，最多 800 字）
  useEffect(() => { setTxt(m.content || ""); }, [m.content]);
  if (m.kind === "ooc") {
    const isU = m.role === "user";
    return h("div", { className: "my-2 flex items-start gap-1.5 " + (isU ? "justify-end" : "justify-start") },
      editable && onDelete ? h("button", {
        onClick: e => { e.preventDefault(); e.stopPropagation(); onDelete(m.id, msgIndex); },
        className: "active:opacity-50 shrink-0",
        title: "删除 OOC",
        style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, opacity: 0.55, padding: "4px 3px 0", order: isU ? -1 : 1 }
      }, "✕") : null,
      h("div", { style: { maxWidth: "84%", padding: "8px 12px", fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.55, color: t.fog, background: t.bg, border: "1px dashed " + t.line, borderRadius: 10, whiteSpace: "pre-wrap" } }, "OOC · " + m.content));
  }
  const isUser = m.role === "user";
  const isNarr = m.role === "narration";
  const spk = isNarr || isUser ? null : (members && m.senderId ? members.find(x => x.id === m.senderId) : char);
  // 线下语音只念台词：从这段叙事里抠出引号内的话，纯旁白（没引号台词）就不给 ▶
  const offSpeech = typeof extractSpeech === "function" ? extractSpeech(m.content) : m.content;
  const timeEl = m.ts ? h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog, opacity: 0.7, letterSpacing: 0.3, flexShrink: 0 } }, fmtStamp(m.ts)) : null;
  const meChar = { name: (meProfile && meProfile.name) || "我", avatarImage: meProfile && meProfile.avatarImage, color: (meProfile && meProfile.color) || "#7a6cf0" };
  // 线下当场拍下来的那一格（她 2026-08-29 要的合照）。和线上单聊同一个气泡组件，
  // 只是外面套的是线下这张卡：有头像、有名字、有时间、能删。
  if (m.kind === "selfie") return h("div", { className: "my-2.5" },
    h("div", { style: offCardSkin(t, (spk && spk.color) || t.tint) },
      h("div", { className: "flex items-center gap-2.5 mb-2.5" },
        spk ? h(Avatar, { character: spk, size: 28, radius: 14 }) : null,
        h("span", { className: "flex-1", style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.sub } },
          (m.senderName || (spk && spk.name) || "") + (m.photoKind === "group" ? " · 大家的合影" : m.photoKind === "duo" ? " · 我俩" : m.photoKind === "other" ? " · 我替 TA 拍的" : " · 自拍")),
        timeEl,
        (editable && onDelete) ? h("button", { onClick: () => onDelete(m.id, msgIndex), className: "active:opacity-50", title: "删除" }, h(ITrash, { size: 15, color: t.fog })) : null),
      h(SelfieBubble, { m: m })));
  const iconBtn = (Ic, fn, title, dis) => h("button", { onClick: fn, disabled: dis, className: "active:opacity-50 disabled:opacity-30", title: title }, h(Ic, { size: 15, color: t.fog }));
  const actions = editable && !editing && h("div", { className: "flex items-center gap-3 shrink-0" },
    (!isUser && !isNarr && onSaveExample) ? h("button", { onClick: () => onSaveExample(m, spk), className: "active:opacity-50", title: "收作好吃范例", style: { fontFamily: F_DISPLAY, fontSize: 17, lineHeight: 1, color: t.fog } }, "✦") : null,
    (!isUser && !isNarr && onReroll) ? iconBtn(IRefresh, () => onReroll(m.id), "重写", sending) : null,
    onEdit ? iconBtn(IPencil, () => setEditing(true), "编辑") : null,
    onDelete ? iconBtn(ITrash, () => onDelete(m.id), "删除") : null);
  const editBox = h("div", { className: "mt-1" },
    h("textarea", { value: txt, onChange: e => setTxt(e.target.value), rows: 4, autoFocus: true, className: "w-full outline-none p-2.5 rounded-lg", style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.7, color: t.ink, background: "#fff", border: `1px solid ${t.line}`, resize: "none" } }),
    h("div", { className: "flex gap-4 mt-2 justify-end" },
      h("button", { onClick: () => { setEditing(false); setTxt(m.content || ""); }, style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, "取消"),
      h("button", { onClick: () => { onEdit(m.id, txt.trim() || m.content); setEditing(false); }, style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, fontWeight: 600 } }, "保存")));
  if (isNarr) {
    // 旁白是舞台提示，不是一句话。短的居中当场次标题（左右各一道细线），
    // 长的靠左走一道竖线——居中的长段落读起来最累，那是原来最扎眼的地方。
    const nText = String(m.content || "").trim();
    const nShort = nText.length <= 34;
    const rule = () => h("span", { className: "flex-1", style: { height: 1, background: "linear-gradient(90deg, transparent, " + offA(t.tint, offDark(t) ? 0.55 : 0.42) + ", transparent)" } });
    const head = (editable || timeEl) ? h("div", { className: "flex items-center justify-end gap-3", style: { marginBottom: 4 } }, timeEl || null, editable ? actions : null) : null;
    if (editing) return h("div", { className: "my-3" }, head, editBox);
    return h("div", { className: "my-3.5" }, head,
      nShort
        ? h("div", { className: "flex items-center gap-3" }, rule(),
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, letterSpacing: 2, color: t.fog, whiteSpace: "nowrap" } }, nText), rule())
        : h("div", { style: { borderLeft: "2px solid " + offA(t.tint, offDark(t) ? 0.5 : 0.38), paddingLeft: 13, margin: "0 4px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, fontStyle: "italic", lineHeight: 1.9, color: t.fog, whiteSpace: "pre-wrap" } },
              offSplit(nText).map((x, i) => x.k === "prose" ? x.s
                : h("span", { key: i, style: { color: offReadable(t.tint, t.bg), fontStyle: "normal", fontWeight: 600 } }, x.s)))));
  }
  return h("div", { className: "my-2.5" },
    // 思考链画在这一拍的【上面】，和单聊同一个位置、同一个组件：一行字加箭头，没有框。
    // 她 2026-08-27 看别家线下也有，问怎么弄的——线下以前压根没要过这个字段（v56.75）。
    (!isUser && m.reasoning) ? h(ReasoningBlock, { m: m }) : null,
    h("div", { style: offCardSkin(t, isUser ? (t.accent || meChar.color) : ((spk && spk.color) || t.tint)) },
      h("div", { className: "flex items-center gap-2.5 mb-2.5" },
        isUser ? h(Avatar, { character: meChar, size: 28, radius: 14 }) : (spk ? (onOpenState ? h("button", { onClick: () => onOpenState(spk), className: "active:opacity-60 shrink-0", title: "看 " + (spk.name || "TA") + " 的心声/状态" }, h(Avatar, { character: spk, size: 28, radius: 14 })) : h(Avatar, { character: spk, size: 28, radius: 14 })) : null),
        h("span", { className: "flex-1", style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: isUser ? t.accent : t.sub } }, isUser ? meChar.name : (m.senderName || (spk && spk.name) || "")),
        (!isUser && spk && offSpeech) ? h(TtsDot, { k: "off" + (m.id || ""), text: offSpeech, spk, tp }) : null,
        timeEl,
        actions),
      editing ? editBox : (m.kind === "photo" && m.imageRef
        ? h("div", null, h("img", { src: resolveImg(m.imageRef), alt: m.desc || "照片", style: { display: "block", width: "100%", maxWidth: 300, maxHeight: 360, objectFit: "cover", borderRadius: 12 } }), m.desc ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, color: t.sub, marginTop: 8 } }, m.desc) : null)
        : offBody(t, m.content, isUser ? (t.accent || meChar.color) : ((spk && spk.color) || t.tint))),
      (!isUser && m.thought) && h("div", { className: "mt-3 pl-3", style: { borderLeft: `2px solid ${t.line}` } },
        h("span", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: 1, color: t.fog } }, "心声 "),
        h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, fontStyle: "italic", lineHeight: 1.6, color: t.fog } }, m.thought)),
      (!isUser && (m.cot || m.cotRequested)) ? h(CotReveal, { cot: m.cot, requested: m.cotRequested }) : null));
}
// ---- 群聊线下模式（多角色同处一地）----
function GroupOfflineMode({
  group,
  profile,
  members,
  sessions,
  activeSession,
  sending,
  onStart,
  onSend,
  onSendPhoto,
  onShoot,
  canShoot,
  onReply,
  onAddNote,
  onDeleteNote,
  onChangeStyle,
  onSaveExample,
  onEditMsg,
  onRerollMsg,
  onDelMsg,
  onDelSession,
  onOOC,
  onEnd,
  onClose,
  onExit,
  settings,
  onSaveSettings,
  onOpenMemberState,
  onOpenStyleLab
}) {
  const t = useTheme();
  const exit = onExit || onClose; // 顶栏「离开」直接退回聊天列表；没传就退回线上群（兜底）
  const kbLift = useKbLift(); // iOS 键盘弹起时把底部输入栏顶上来（v47.91）
  const gName = group.name;
  // 群线下：点成员头像看心声（和线上群一样，由 app 决定开不开互通时才传 onOpenMemberState）
  const offOpenState = onOpenMemberState ? (sp => sp && onOpenMemberState(sp.id)) : undefined;
  const os = settings || {};
  const [setOpen, setSetOpen] = useState(false);
  const [sBg, setSBg] = useState(os.bg || "");
  const [sMax, setSMax] = useState(os.maxTokens || 3200);
  const [sMinW, setSMinW] = useState(os.minWords || 0);
  const [sMemN, setSMemN] = useState(os.memN != null ? os.memN : 6);
  const [sOnlineN, setSOnlineN] = useState(os.onlineCtxN != null ? os.onlineCtxN : 10);
  const [sDesc, setSDesc] = useState(!!os.describeMe);
  const [sTastePace, setSTastePace] = useState(activeSession && activeSession.taste && activeSession.taste.pace || os.tastePace || "auto");
  const [sTasteFocus, setSTasteFocus] = useState(activeSession && activeSession.taste && activeSession.taste.focus || os.tasteFocus || "auto");
  const [sTasteDensity, setSTasteDensity] = useState(activeSession && activeSession.taste && activeSession.taste.density || os.tasteDensity || "auto");
  const [oocMode, setOocMode] = useState(false);
  const bgFileRef = useRef(null);
  const [view, setView] = useState(activeSession ? "live" : "setup");
  const [opening, setOpening] = useState("");
  const [styleKey, setStyleKey] = useState(activeSession && activeSession.styleKey ? activeSession.styleKey : "default");
  const [presetOn, setPresetOn] = useState(() => activeSession ? !!activeSession.presetOn : !!(settings && settings.presetOn));
  const [presetId, setPresetId] = useState(() => (activeSession && activeSession.presetId) || (settings && settings.presetId) || "");
  const [input, setInput] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoImg, setPhotoImg] = useState("");
  const [photoDesc, setPhotoDesc] = useState("");
  const photoFileRef = useRef(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [endConfirm, setEndConfirm] = useState(false);
  const [readView, setReadView] = useState(null);
  const [modeOpen, setModeOpen] = useState(false); // 顶栏下拉：切回线上/往期
  const [pastOpen, setPastOpen] = useState(false); // 往期场次选择
  const [customStyles, setCustomStyles] = useState(() => loadJSON("x_offlineStyles", []));
  const [styleSheet, setStyleSheet] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [cName2, setCName2] = useState("");
  const [cPrompt, setCPrompt] = useState("");
  const [editingStyleKey, setEditingStyleKey] = useState("");   // 非空=正在改这条自定义文风，保存时原地覆盖
  const styleFileRef = useRef(null);
  const scroller = useRef(null);
  const past = (sessions || []).filter(s => s.endTs);
  const allStyles = [...OFFLINE_STYLES, ...customStyles];
  const curStyle = allStyles.find(s => s.key === styleKey) || allStyles[0];
  const memberLine = members.map(c => c.name).join("、");
  const saveCustomStyle = () => {
    const nm = cName2.trim();
    const pr = cPrompt.trim();
    if (!nm || !pr) return;
    const key = editingStyleKey || ("custom_" + Date.now());
    const next = editingStyleKey
      ? customStyles.map(x => x.key === editingStyleKey ? { ...x, name: nm, prompt: pr } : x)
      : [...customStyles, { key, name: nm, prompt: pr, custom: true }];
    setCustomStyles(next);
    saveJSON("x_offlineStyles", next);
    setStyleKey(key);
    setEditingStyleKey("");
    setCName2("");
    setCPrompt("");
    setStyleSheet(false);
    setCustOpen(false);
  };
  const delCustomStyle = key => {
    const next = customStyles.filter(s => s.key !== key);
    if (!saveJSON("x_offlineStyles", next)) return toast && toast("这次没删成功，原预设还在");
    setCustomStyles(next);
    if (styleKey === key) setStyleKey("default");
  };
  // 自定义文风以前只能删了重贴——她那份有四千字，删一次就得重来一遍（她 2026-08-22）。
  // 装回输入框改，保存时按 key 原地覆盖，正在用的那局不用重选。
  const editCustomStyle = key => {
    const cur = customStyles.find(x => x.key === key);
    if (!cur) return;
    setCName2(cur.name || "");
    setCPrompt(cur.prompt || "");
    setEditingStyleKey(key);
  };
  const importStyleFile = async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const prompt = await readOfflineStyleDocument(file);
      if (!prompt) throw new Error("文件里没有读到文字");
      const name = file.name.replace(/\.(docx|txt|md)$/i, "").trim() || "导入文风";
      const key = "custom_" + Date.now();
      const next = [...customStyles, { key, name, prompt, custom: true, imported: true }];
      setCustomStyles(next); saveJSON("x_offlineStyles", next); setStyleKey(key);
      toast("已导入文风 · " + name + "（" + prompt.length + " 字）");
    } catch (err) { alert("导入失败：" + (err && err.message || "请改用 txt 文件")); }
  };
  const styleImportControl = h("span", { className: "inline-flex" },
    h("button", { onClick: () => styleFileRef.current && styleFileRef.current.click(), className: "px-3 py-1.5 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 999, border: "1px dashed " + t.line, background: "transparent", color: t.fog } }, "⇧ 导入文件"),
    h("input", { ref: styleFileRef, type: "file", accept: ".docx,.txt,.md,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document", style: { display: "none" }, onChange: importStyleFile }));
  // 设置弹层里的「文风预设」小节（进行中随时改）
  const styleSection = h("div", { className: "pt-5", style: { borderTop: "1px solid " + t.line, marginTop: 18 } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.sub, marginBottom: 2 } }, "文风预设"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 10, lineHeight: 1.6 } }, "剧情不同段落想换个笔调，随时切换，保存后下次演绎生效。"),
    h("div", { className: "flex flex-wrap gap-2 mb-2" }, allStyles.map(s => h("button", {
      key: s.key, onClick: () => { setStyleKey(s.key); setCustOpen(false); },
      className: "px-3 py-1.5", style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 999, border: "1px solid " + (styleKey === s.key ? t.ink : t.line), background: styleKey === s.key ? t.ink : "transparent", color: styleKey === s.key ? t.bg2 : t.sub }
    }, s.name)).concat([h("button", {
      key: "__add", onClick: () => setCustOpen(v => !v),
      className: "px-3 py-1.5", style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 999, border: "1px dashed " + t.line, background: "transparent", color: t.fog }
    }, "＋ 自定义"), styleImportControl])),
    custOpen
      ? h("div", { className: "p-3", style: { background: t.bg, borderRadius: 8, border: "1px solid " + t.line } },
          (editingStyleKey ? h("div", { className: "flex items-center gap-3 mb-2" },
            h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, "正在改「" + ((customStyles.find(x => x.key === editingStyleKey) || {}).name || "") + "」·保存后原地覆盖"),
            h("button", { onClick: () => { setEditingStyleKey(""); setCName2(""); setCPrompt(""); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "取消")) : null),
          h("input", { value: cName2, onChange: e => setCName2(e.target.value), placeholder: "预设名称，如 冷冽克制", className: "w-full outline-none p-2.5 mb-2", style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, background: "#fff", border: "1px solid " + t.line, borderRadius: 8 } }),
          h("textarea", { value: cPrompt, onChange: e => setCPrompt(e.target.value), rows: 3, placeholder: "写给 AI 的文风提示词，如：多用短句，冷色调意象，情绪藏在动作里…", className: "w-full outline-none p-2.5 mb-2", style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, color: t.ink, background: "#fff", border: "1px solid " + t.line, borderRadius: 8, resize: "none" } }),
          h("button", { onClick: saveCustomStyle, className: "w-full py-2.5", style: { fontFamily: F_BODY, fontSize: 13, background: t.ink, color: t.bg2, borderRadius: 8 } }, "保存并选用"))
      : h("div", { className: "p-3", style: { background: t.bg, borderRadius: 8, border: "1px solid " + t.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1, color: t.fog, marginBottom: 4 } }, "提示词 · " + (curStyle ? curStyle.name : "")),
          h(OfflineStylePromptPreview, { style: curStyle, t }),
          curStyle && curStyle.custom && h("div", { className: "mt-2 flex items-center gap-4" }, h("button", { onClick: () => editCustomStyle(curStyle.key), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, "编辑此预设"), h("button", { onClick: () => requestAppConfirm("删掉「" + (curStyle.name || "这条预设") + "」？", "内容不会留档。", () => delCustomStyle(curStyle.key), "删除"), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.accent } }, "删除此预设"))));
  useEffect(() => {
    if (activeSession && view === "setup") setView("live");
  }, [activeSession]);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [activeSession && activeSession.msgs.length, sending, view]);

  const enter = () => {
    onSaveSettings && onSaveSettings({ tastePace: sTastePace, tasteFocus: sTasteFocus, tasteDensity: sTasteDensity });
    onStart({ opening: opening.trim(), styleKey, presetOn, presetId, stylePrompt: (curStyle && curStyle.prompt) || "", taste: { pace: sTastePace, focus: sTasteFocus, density: sTasteDensity } });
    setView("live");
  };
  const send = () => {
    if (!input.trim() || sending) return;
    const v = input.trim();
    setInput("");
    if (oocMode) { onOOC && onOOC(v); return; }
    onSend(v);
  };
  const reply = () => {
    if (sending) return;
    const v = input.trim();
    setInput("");
    onReply(v);
  };
  const sendPhoto = async () => {
    if (!photoImg || sending || !onSendPhoto) return;
    const imageRef = await imgToVault(photoImg);
    await rememberRealPhoto(imageRef, photoDesc.trim(), "group-offline");
    onSendPhoto({ kind: "photo", imageRef, desc: photoDesc.trim(), content: photoDesc.trim() ? "[照片] " + photoDesc.trim() : "[照片]" });
    setPhotoImg(""); setPhotoDesc(""); setPhotoOpen(false);
  };
  const saveNote = () => {
    if (note.trim()) onAddNote(note.trim());
    setNote("");
    setNoteOpen(false);
  };

  const sheet = (title, children) => h("div", {
    className: "absolute inset-0 z-30 flex items-end", style: { background: "rgba(0,0,0,.35)" }, onClick: () => { setPhotoOpen(false); setNoteOpen(false); setEndConfirm(false); setStyleSheet(false); setModeOpen(false); setPastOpen(false); }
  }, h("div", {
    onClick: e => e.stopPropagation(), className: "w-full p-5 pb-8", style: { background: t.bg2, borderTopLeftRadius: 18, borderTopRightRadius: 18 }
  }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, marginBottom: 12 } }, title), children));

  // ---- 往期回看 ----
  if (readView) {
    return h("div", { className: "absolute inset-0 z-20 flex flex-col", style: { background: t.bg, paddingTop: safeTop(0) } },
      h("div", { className: "flex items-center gap-3 px-4 py-3 shrink-0", style: { borderBottom: `1px solid ${t.line}` } },
        h("button", { onClick: () => setReadView(null), className: "active:opacity-50" }, h(IArrow, { size: 22, color: t.ink })),
        h("div", { className: "flex-1", style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "线下记录 · " + fmtStamp(readView.startTs)),
        onDelSession && h("button", { onClick: () => { const id = readView.id, idx = sessions.indexOf(readView); setReadView(null); onDelSession(id, idx); }, className: "active:opacity-50 shrink-0", title: "删除这条记录" }, h(ITrash, { size: 18, color: t.fog }))),
      h("div", { className: "flex-1 overflow-y-auto px-5 py-5" },
        readView.summary && h("div", { className: "mb-4 p-3", style: { background: t.bg2, borderRadius: 10, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: t.sub } }, "【当时总结】" + readView.summary),
        (readView.customNotes || []).length > 0 && h("div", { className: "mb-4 p-3", style: { background: t.bg2, borderRadius: 10, border: "1px solid " + t.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1, color: t.fog, marginBottom: 6 } }, "当时的短期导演便签"),
          (readView.customNotes || []).map((n, i) => h("div", { key: (n && n.id) || i, style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.65, color: t.sub, marginTop: i ? 5 : 0 } }, "· " + (typeof n === "string" ? n : n.text))),
        ),
        (readView.msgs || []).map((m, i) => h(OffCard, { key: m.id || i, m: m, t: t, members: members, meProfile: profile, editable: false, onOpenState: offOpenState }))));
  }

  // ---- setup ----
  if (view === "setup") {
    return h("div", { className: "absolute inset-0 z-20 flex flex-col", style: { background: t.bg, paddingTop: safeTop(0) } },
      h("div", { className: "flex items-center gap-3 px-4 py-3 shrink-0", style: { borderBottom: `1px solid ${t.line}` } },
        h("button", { onClick: exit, className: "active:opacity-50" }, h(IArrow, { size: 22, color: t.ink })),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "赴约 · " + gName),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginLeft: "auto" } }, "多人线下")),
      h("div", { className: "flex-1 overflow-y-auto px-5 py-5" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: t.fog, marginBottom: 18 } }, "进入线下后，你和 " + memberLine + " 默认身处同一个地方，他们会带动作、心理与旁白地彼此互动、跟你相处。可以先铺垫一句开场，选一个文风。"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, marginBottom: 6 } }, "开场白 / 铺垫第一句剧情"),
        h("textarea", { value: opening, onChange: e => setOpening(e.target.value), rows: 3, placeholder: "如：*包厢里灯光暖黄，我推门进去，他们几个已经围着桌子坐下了*（留空则由他们起头）", className: "w-full outline-none p-3 mb-5", style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.6, color: t.ink, background: "#fff", border: `1px solid ${t.line}`, borderRadius: 8, resize: "none" } }),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, marginBottom: 8 } }, "文风预设"),
        h("div", { className: "flex flex-wrap gap-2 mb-3" }, allStyles.map(s => h("button", {
          key: s.key, onClick: () => setStyleKey(s.key),
          className: "px-3 py-1.5", style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 999, border: `1px solid ${styleKey === s.key ? t.ink : t.line}`, background: styleKey === s.key ? t.ink : "transparent", color: styleKey === s.key ? t.bg2 : t.sub }
        }, s.name)).concat([h("button", {
          key: "__add", onClick: () => setStyleSheet(true),
          className: "px-3 py-1.5", style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 999, border: `1px dashed ${t.line}`, background: "transparent", color: t.fog }
        }, "＋ 自定义"), styleImportControl])),
        h("div", { className: "mb-6 p-3", style: { background: t.bg2, borderRadius: 8, border: `1px solid ${t.line}` } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1, color: t.fog, marginBottom: 4 } }, "提示词 · " + (curStyle ? curStyle.name : "")),
          h(OfflineStylePromptPreview, { style: curStyle, t }),
          curStyle && curStyle.custom && h("div", { className: "mt-2 flex items-center gap-4" }, h("button", { onClick: () => editCustomStyle(curStyle.key), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, "编辑此预设"), h("button", { onClick: () => requestAppConfirm("删掉「" + (curStyle.name || "这条预设") + "」？", "内容不会留档。", () => delCustomStyle(curStyle.key), "删除"), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.accent } }, "删除此预设"))),
        h(OfflineTastePanel, { t, compact: true, pace: sTastePace, setPace: setSTastePace, focus: sTasteFocus, setFocus: setSTasteFocus, density: sTasteDensity, setDensity: setSTasteDensity }),
        h("button", { onClick: enter, className: "w-full py-3 mb-8", style: { fontFamily: F_BODY, fontSize: 14, background: t.ink, color: t.bg2, borderRadius: 8 } }, "进入线下 →"),
        past.length > 0 && h("div", null,
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: t.fog, marginBottom: 8 } }, "往期线下记录"),
          past.map(s => h("div", { key: s.id, className: "mb-2 p-3 flex items-start gap-2", style: { background: t.bg2, borderRadius: 10, border: `1px solid ${t.line}` } },
            h("button", { onClick: () => setReadView(s), className: "flex-1 text-left active:opacity-70" },
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 3 } }, fmtStamp(s.startTs)),
              h("div", { className: "line-clamp-2", style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, color: t.sub } }, s.summary || (s.msgs[0] && s.msgs[0].content) || "（无总结）")),
            onDelSession && h("button", { onClick: () => onDelSession(s.id, sessions.indexOf(s)), className: "active:opacity-50 shrink-0 pt-0.5", title: "删除这条记录" }, h(ITrash, { size: 16, color: t.fog })))))),
      styleSheet && sheet("自定义文风预设", h("div", null,
        (editingStyleKey ? h("div", { className: "flex items-center gap-3 mb-2" },
            h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, "正在改「" + ((customStyles.find(x => x.key === editingStyleKey) || {}).name || "") + "」·保存后原地覆盖"),
            h("button", { onClick: () => { setEditingStyleKey(""); setCName2(""); setCPrompt(""); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "取消")) : null),
          h("input", { value: cName2, onChange: e => setCName2(e.target.value), placeholder: "预设名称，如 冷冽克制", className: "w-full outline-none p-3 mb-3", style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, background: "#fff", border: `1px solid ${t.line}`, borderRadius: 8 } }),
        h("textarea", { value: cPrompt, onChange: e => setCPrompt(e.target.value), rows: 4, placeholder: "写给 AI 的文风提示词，如：多用短句，冷色调意象，情绪藏在动作里，少直白抒情…", className: "w-full outline-none p-3 mb-3", style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.6, color: t.ink, background: "#fff", border: `1px solid ${t.line}`, borderRadius: 8, resize: "none" } }),
        h("button", { onClick: saveCustomStyle, className: "w-full py-3", style: { fontFamily: F_BODY, fontSize: 13.5, background: t.ink, color: t.bg2, borderRadius: 8 } }, "保存并选用"))));
  }

  // ---- live ----
  const msgs = activeSession ? activeSession.msgs : [];
  const gBgSheet = setOpen && h(Sheet, { onClose: () => setSetOpen(false), tall: true },
    h("div", { className: "flex items-center justify-between mb-4" },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink } }, "线下设置"),
      h("button", { onClick: () => { onSaveSettings && onSaveSettings({ presetOn, presetId, maxTokens: sMax, minWords: sMinW, memN: sMemN, onlineCtxN: sOnlineN, bg: sBg, describeMe: sDesc, tastePace: sTastePace, tasteFocus: sTasteFocus, tasteDensity: sTasteDensity }); onChangeStyle && onChangeStyle({ styleKey, presetOn, presetId, stylePrompt: (curStyle && curStyle.prompt) || "", taste: { pace: sTastePace, focus: sTasteFocus, density: sTasteDensity } }); setSetOpen(false); }, className: "active:opacity-60" }, h(ICheck, { size: 19, color: t.ink }))),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.sub, marginBottom: 4 } }, "场景背景图"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 12, lineHeight: 1.6 } }, "从相册选一张图当这次多人线下的背景。"),
    h("div", { className: "flex items-center gap-3" },
      sBg ? h("div", { style: { width: 52, height: 52, borderRadius: 8, background: "center/cover no-repeat url(\"" + sBg + "\")", border: "1px solid " + t.line } }) : null,
      h("button", { onClick: () => bgFileRef.current && bgFileRef.current.click(), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, border: "1px solid " + t.line, borderRadius: 8, padding: "9px 14px" } }, sBg ? "更换" : "选择"),
      sBg ? h("button", { onClick: () => { setSBg(""); onSaveSettings && onSaveSettings({ bg: "" }); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: t.accent } }, "清除") : null,
      h("input", { ref: bgFileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; if (f) resizeImageFile(f, 1200, 0.82).then(d => { setSBg(d); onSaveSettings && onSaveSettings({ bg: d }); }); e.target.value = ""; } })),
    h("div", { className: "pt-6", style: { borderTop: "1px solid " + t.line, marginTop: 18 } },
      h("div", { className: "flex items-baseline justify-between mb-1" },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, "入场前群聊条数"),
        h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 16, color: t.ink } }, sOnlineN + " 条")),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 10, lineHeight: 1.55 } }, "赴约时带入线上群聊最后几条，让线下接住刚聊到的事；只冻结一次、不复制进线下记录。0=从新场景开始。"),
      h(Slider, { value: sOnlineN, min: 0, max: 30, step: 1, onChange: setSOnlineN })),
    h("div", { className: "pt-5" },
      h("div", { className: "flex items-baseline justify-between mb-1" },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, "关联记忆条数"),
        h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 16, color: t.ink } }, sMemN + " 条")),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 10, lineHeight: 1.55 } }, "额外带入与群成员相关的记忆库条目；0=不带。群聊未开启记忆互通时不会注入。"),
      h(Slider, { value: sMemN, min: 0, max: 20, step: 1, onChange: setSMemN })),
    h("div", { className: "pt-5" },
      h("div", { className: "flex items-baseline justify-between mb-1" },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, "单次输出上限"),
        h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 16, color: t.ink } }, sMax + " tok")),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 10 } }, "多人线下一次要写好几个人的戏，容易被截断——比单聊调高些（模型也要支持）。"),
      h(Slider, { value: sMax, min: 800, max: 32000, step: 400, onChange: setSMax })),
    h("div", { className: "pt-5" },
      h("div", { className: "flex items-baseline justify-between mb-1" },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, "输出下限（约字数）"),
        h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 16, color: t.ink } }, sMinW ? sMinW + " 字" : "不限")),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 10 } }, "让每次至少写这么多字（>0 生效）。"),
      h(Slider, { value: sMinW, min: 0, max: 4000, step: 100, onChange: setSMinW })),
    h("div", { className: "flex items-center justify-between pt-5" },
      h("div", { className: "pr-3" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.sub } }, "让角色描写我的行动"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, "开：在场角色可以替你写动作、反应并推动剧情；关：只写他们自己和环境，不替你决定行动或台词。")),
      h(Toggle, { on: sDesc, onChange: () => setSDesc(v => !v) })),
    h(OfflineTastePanel, { t, pace: sTastePace, setPace: setSTastePace, focus: sTasteFocus, setFocus: setSTasteFocus, density: sTasteDensity, setDensity: setSTasteDensity }),
    h(OfflineStylePresetSection, { t, presetOn, setPresetOn, presetId, setPresetId, onOpenStyleLab }),
    styleSection,
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 6 } }, "保存后下次生成生效。"));
  const directorNotes = activeSession && (activeSession.customNotes || []).length > 0 && h("div", { className: "shrink-0 mx-3 mt-2 p-3", style: { background: "rgba(255,255,255,.86)", border: "1px solid " + t.line, borderRadius: 10, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", maxHeight: 150, overflowY: "auto" } },
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1, color: t.fog, marginBottom: 7 } }, "短期导演便签 · 固定显示"),
    (activeSession.customNotes || []).map((n, i) => {
      const item = typeof n === "string" ? { text: n, remaining: 1 } : n;
      const left = Math.max(0, Number(item && item.remaining) || 0);
      return h("div", { key: (item && item.id) || i, className: "flex items-start gap-2", style: { padding: "6px 0", borderTop: i ? "1px solid " + t.line : "none", opacity: left ? 1 : 0.46 } },
        h("div", { className: "flex-1" },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.55, color: t.sub, whiteSpace: "pre-wrap" } }, item.text),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: left ? t.tint : t.fog, marginTop: 2 } }, left ? "还会影响接下来 " + left + " 轮" : "已结束 · 下轮不再注入")),
        onDeleteNote && h("button", { onClick: () => onDeleteNote(item.id || i), className: "active:opacity-50", style: { fontFamily: F_BODY, fontSize: 14, color: t.fog, padding: "0 2px" }, title: "删除这条便签" }, "×"));
    }));
  return h("div", { className: "absolute inset-0 z-20 flex flex-col", style: os.bg ? { backgroundImage: "url(\"" + resolveImg(os.bg) + "\")", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" } : offSceneBg(t) },
    h("div", { className: "flex items-center gap-3 px-4 py-3 shrink-0", style: { paddingTop: safeTop(12), borderBottom: `1px solid ${t.line}`, background: os.bg ? "rgba(255,255,255,0.5)" : t.bg2, backdropFilter: os.bg ? "blur(8px)" : "none", WebkitBackdropFilter: os.bg ? "blur(8px)" : "none" } },
      h("button", { onClick: exit, className: "active:opacity-50 flex items-center gap-1" }, h(IArrow, { size: 20, color: t.ink }), h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, "离开")),
      h("button", { onClick: () => setModeOpen(true), className: "flex-1 text-center active:opacity-60" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, gName + " ⌄"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: 1, color: t.fog } }, "OFFLINE · 多人线下 · 轻触切换")),
      h("button", { onClick: () => setNoteOpen(true), className: "active:opacity-50", title: "给他们一个提示" }, h(IPlus, { size: 20, color: t.fog })),
      onSaveSettings && h("button", { onClick: () => setSetOpen(true), className: "active:opacity-50", title: "线下设置" }, h(GConfig, { size: 19, color: t.fog })),
      h("button", { onClick: () => setEndConfirm(true), className: "active:opacity-60 px-2 py-1", style: { fontFamily: F_BODY, fontSize: 12, color: t.accent } }, "结束")),
    gBgSheet,
    // 当前这局用的是哪个文风（v55.44，群线下同款）。她 2026-08-22 放了份自定义文风进去却完全没生效，
    // 而界面上根本看不出这局到底挂着哪一个——排查全靠猜。摆出来，没挂上一眼就看见。
    (function () {
      const sess = (sessions || []).find(x => x && !x.endTs);
      if (!sess) return null;
      const key = sess.styleKey || "default";
      const own = (sess.stylePrompt || "").trim();
      const named = [...OFFLINE_STYLES, ...customStyles].find(x => x.key === key);
      const usingPreset = !!(sess.presetOn && sess.presetId && window.StylePresets && window.StylePresets.byId(sess.presetId));
      const presetName = usingPreset ? window.StylePresets.byId(sess.presetId).name : "";
      const on = usingPreset || !!(own || (named && named.prompt));
      return h("div", { onClick: () => setSetOpen(true), className: "shrink-0 w-full flex items-center gap-1.5 px-4 pb-1 active:opacity-60" },
        h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: ".12em", color: t.fog } }, "STYLE"),
        h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: on ? t.sub : t.fog } },
          usingPreset ? presetName + "（预设台）" : on ? (named ? named.name : "自定义") + (named && named.custom ? "（自定义）" : "") : "未设文风 · 走通用叙事"));
    })(),
    modeOpen && sheet("切换", h("div", { className: "space-y-1" },
      h("button", { onClick: () => { setModeOpen(false); onClose(); }, className: "w-full text-left py-3 px-2 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 14.5, color: t.ink } }, "💬 群聊（回到线上群）"),
      h("div", { className: "w-full py-3 px-2", style: { fontFamily: F_BODY, fontSize: 14.5, color: t.tint, background: t.bg, borderRadius: 10 } }, "🎬 多人线下（当前）✓"),
      h("button", { onClick: () => { setModeOpen(false); setPastOpen(true); }, className: "w-full text-left py-3 px-2 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 14.5, color: t.ink } }, "🗂 往期线下记录"))),
    pastOpen && sheet("往期线下记录", h("div", { className: "space-y-2", style: { maxHeight: "52vh", overflowY: "auto" } },
      (sessions || []).filter(s => s.endTs).length === 0
        ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", padding: "24px 0" } }, "还没有已结束的线下记录。")
        : (sessions || []).filter(s => s.endTs).sort((a, b) => (b.startTs || 0) - (a.startTs || 0)).map(s => h("button", { key: s.id, onClick: () => { setPastOpen(false); setReadView(s); }, className: "w-full text-left active:opacity-70", style: { padding: "12px 13px", borderRadius: 12, background: t.bg2, border: "1px solid " + t.line, display: "block" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink } }, (s.startTs ? new Date(s.startTs).toLocaleDateString() : "线下记录")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 3, lineHeight: 1.5 } }, String(s.summary || (s.msgs && s.msgs.length ? s.msgs.length + " 段" : "")).replace(/\s+/g, " ").slice(0, 60) || "点开回看"))))),
    directorNotes,
    h("div", { ref: scroller, className: "flex-1 overflow-y-auto px-4 py-3" },
      msgs.length === 0 && !sending && h("div", { className: "text-center mt-10", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, "场景已布置好，说点什么或让他们先开口。"),
      msgs.map((m, i) => h(OffCard, { key: m.id || i, m: m, msgIndex: i, t: t, members: members, meProfile: profile, editable: true, sending: sending, onEdit: onEditMsg, onReroll: onRerollMsg, onDelete: onDelMsg, onSaveExample: onSaveExample, onOpenState: offOpenState })),
      sending && h("div", { className: "flex gap-1 mt-3 justify-center" }, [0, 1, 2].map(i => h("span", { key: i, className: "w-1.5 h-1.5 rounded-full animate-pulse", style: { background: t.fog, animationDelay: i * 0.15 + "s" } })))),
    h("div", { className: "flex items-center gap-2 px-3 py-2.5 shrink-0", style: { background: t.bg2, borderTop: `1px solid ${t.line}`, paddingBottom: COMPOSER_PAD_BOTTOM, marginBottom: kbLift, transition: "margin-bottom .18s ease" } },
      onOOC && h("button", { onClick: () => setOocMode(v => !v), title: "OOC · 越过角色直接和模型说", className: "active:opacity-60 shrink-0", style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: 0.5, padding: "6px 9px", borderRadius: 999, border: "1px solid " + (oocMode ? t.accent : t.line), color: oocMode ? t.accent : t.fog, background: oocMode ? "rgba(194,90,74,0.08)" : "transparent" } }, "OOC"),
      !oocMode && onSendPhoto && h("button", { onClick: () => setPhotoOpen(true), title: "给大家看真实照片", className: "active:opacity-60 shrink-0", style: { width: 34, height: 34, borderRadius: 999, border: "1px solid " + t.line, color: t.fog, background: "transparent", fontSize: 16 } }, "＋"),
      h("input", { value: input, onChange: e => setInput(e.target.value), onKeyDown: e => e.key === "Enter" && send(), placeholder: oocMode ? "OOC：直接和模型说，可让它调整或问状态…" : "说话，或写你的动作…", className: "flex-1 outline-none px-4 py-2.5 rounded-full", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: "#fff", border: `1px solid ${oocMode ? t.accent : t.line}`, minWidth: 0 } }),
      h("button", { onClick: send, disabled: sending || !input.trim(), className: "active:opacity-70 disabled:opacity-30 flex items-center justify-center shrink-0", style: { width: 40, height: 40, borderRadius: 999, background: BUBBLE_SKIN.myBg } }, h(ISend, { size: 16, color: BUBBLE_SKIN.myText })),
      !oocMode && h("button", { onClick: reply, disabled: sending, title: "让他们演绎", className: "active:opacity-70 disabled:opacity-40 flex items-center justify-center shrink-0", style: { width: 40, height: 40, borderRadius: 999, background: t.ink } }, sending ? h("div", { className: "flex gap-0.5" }, [0, 1, 2].map(i => h("span", { key: i, className: "w-1 h-1 rounded-full animate-pulse", style: { background: t.bg2, animationDelay: i * 0.15 + "s" } }))) : h(ISpark, { size: 19, color: t.bg2 }))),
    photoOpen && sheet("照片", h("div", null,
      // 当场拍一张合影：大家此刻真在同一个地方。零模型调用，只花一次出图。
      onShoot ? h("div", { className: "mb-4" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 8, lineHeight: 1.5 } },
          canShoot ? "当场拍一张合影（每个人的脸都拿各自参考照锁住）" : "合影要在场至少两个人有参考照，才能把脸都锁住"),
        h("button", {
          onClick: () => { if (!canShoot) return; setPhotoOpen(false); onShoot("group"); },
          disabled: !canShoot,
          className: "w-full py-2.5 active:opacity-70 disabled:opacity-30",
          style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, background: t.bg, border: "1px solid " + t.line, borderRadius: 10 }
        }, "拍张合影"),
        h("div", { style: { height: 1, background: t.line, margin: "14px 0 12px" } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 8 } }, "或者，给大家看你手机里的一张")) : null,
      h("button", { onClick: () => photoFileRef.current && photoFileRef.current.click(), className: "w-full mb-3 active:opacity-70", style: { minHeight: 150, border: "1px dashed " + t.line, borderRadius: 12, overflow: "hidden", background: t.bg } },
        photoImg ? h("img", { src: photoImg, style: { display: "block", width: "100%", maxHeight: 280, objectFit: "contain" } }) : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 1.8 } }, "点这里选择照片\n相机或相册都可以")),
      h("input", { ref: photoFileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; if (f) resizeImageFile(f, 1600, 0.86).then(setPhotoImg); e.target.value = ""; } }),
      h("input", { value: photoDesc, onChange: e => setPhotoDesc(e.target.value), placeholder: "配一句话（可不填）", className: "w-full outline-none p-3 mb-3", style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, background: "#fff", border: "1px solid " + t.line, borderRadius: 8 } }),
      h("button", { onClick: sendPhoto, disabled: !photoImg || sending, className: "w-full py-3 disabled:opacity-30", style: { fontFamily: F_BODY, fontSize: 13.5, background: t.ink, color: t.bg2, borderRadius: 8 } }, "发送照片"))),
    noteOpen && sheet("给他们一个提示（临时导演）", h("div", null,
      h("textarea", { value: note, onChange: e => setNote(e.target.value), rows: 3, placeholder: "如：让气氛缓和下来 / 让某人挑起话题 / 把话题引到那件事上", className: "w-full outline-none p-3 mb-3", style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.6, color: t.ink, background: "#fff", border: `1px solid ${t.line}`, borderRadius: 8, resize: "none" } }),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.6, color: t.fog, marginBottom: 10 } }, "保存后影响接下来 2 次成功演绎；失败不扣，用完会留档但不再注入。"),
      h("button", { onClick: saveNote, className: "w-full py-3", style: { fontFamily: F_BODY, fontSize: 13.5, background: t.ink, color: t.bg2, borderRadius: 8 } }, "加入未来 2 轮"))),
    endConfirm && sheet("结束这段线下？", h("div", null,
      h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, color: t.fog, marginBottom: 14 } }, "结束后会把这段经过总结进记忆库，记录也会保存下来供回看。"),
      h("div", { className: "flex gap-3" },
        h("button", { onClick: () => setEndConfirm(false), className: "flex-1 py-3", style: { fontFamily: F_BODY, fontSize: 13, border: `1px solid ${t.line}`, color: t.ink, borderRadius: 8 } }, "继续相处"),
        h("button", { onClick: () => { setEndConfirm(false); onEnd(); }, disabled: sending, className: "flex-1 py-3", style: { fontFamily: F_BODY, fontSize: 13, background: t.accent, color: "#fff", borderRadius: 8 } }, sending ? "总结中…" : "结束并总结")))));
}
// ---- group chat ----
function GroupThread({
  group,
  groups,
  characters,
  allChars,
  rels,
  messages,
  sending,
  profile,
  meName,
  myBalance,
  settings,
  directives,
  onRemoveDirective,
  onSetDirectiveTurns,
  onBack,
  onSend,
  onReply,
  onContinue,
  onOOC,
  onMsgAction,
  onDeleteMessages,
  onForward,
  onSaveSettings,
  onOpenMemberState,
  onStartPoll,
  onVote,
  onSendRedPacket,
  onClaim,
  onSummarize,
  onAddMember,
  onKickMember,
  onDeleteGroup,
  onClearGroupChat,
  onOffline,
  onSendRich,
  onStartCall,
  onCallBack,
  onSendTransfer,
  onRespondTransfer,
  emotes,
  onManageEmotes,
  archCount,
  onLoadOlder,
  toast
}) {
  const t = useTheme();
  const gsp = settings || {};
  // 「你之前发过」:从这个群里自己发过的位置卡去重,最近的在前
  const geoRecent = React.useMemo(() => {
    const out = [];
    (messages || []).forEach(x => {
      if (x && x.kind === "geo" && x.role === "user" && x.name && out.indexOf(x.name) < 0) out.unshift(x.name);
    });
    return out.slice(0, 5);
  }, [messages]);
  // 「念出来」(v60.25)：群里说话的人各有各的音色，从 senderId 找回来
  const tp = useTtsPlayer();
  const speakerOf = m => (m && m.role === "user") ? null : (m && m.senderId ? memberById(m.senderId) : null);
  const canSpeakMsg = m => {
    const spk = speakerOf(m);
    return !!(m && m.content && spk && spk.voiceId && typeof ttsReady === "function" && ttsReady());
  };
  const speakMsg = (i, m) => {
    const spk = speakerOf(m);
    if (!spk || !spk.voiceId) return;
    tp.toggle("say" + i, String(m.content || ""), spk.voiceId);
  };
  // 气泡上那颗播放键：跟长按菜单里的「念出来」同一个门槛、同一个动作，
  // 只是常驻在那儿——她不用每次长按，而且实心/空心一眼看得出这一句花没花过钱。
  // 气泡底下那一行：「听一下」和「已读 20:19」并排。
  // 原来那颗圆钮是【气泡的兄弟】，自己占一格、把整行撑宽（她 2026-09-02：「放的略丑」）；
  // 现在它是【这条消息的页脚】的一项——本来就是同一档信息，字号字色也跟着它。
  const sayDot = (i, m) => {
    if (!canSpeakMsg(m)) return null;
    const k = m && m.kind;
    if (k && k !== "photo" && k !== "location") return null;   // 语音条自己气泡上已经有一个
    const spk = speakerOf(m);
    const on = tp.play && tp.play.k === "say" + i;
    return h(TtsBubbleDot, { key: "d", text: String(m.content || ""), voiceId: spk.voiceId,
      st: on ? tp.play.st : "idle", onTap: () => speakMsg(i, m) });
  };
  const msgFoot = (i, m, sub) => {
    const dot = sayDot(i, m);
    if (!dot && !sub) return null;
    return h("span", { className: "flex items-center", style: { gap: 7, marginTop: 2, fontFamily: F_BODY, fontSize: 9.5, color: t.fog } },
      dot, sub ? h("span", null, sub) : null);
  };
  const [archView, setArchView] = useState(null); // null | "loading" | [归档消息]
  const meAv = { name: meName || "我", color: (profile && profile.color) || t.tint, avatarImage: profile && profile.avatarImage };
  const fmtT = ts => { const d = new Date(ts || Date.now()); const p = n => String(n).padStart(2, "0"); return p(d.getHours()) + ":" + p(d.getMinutes()) + (gsp.timeSec ? ":" + p(d.getSeconds()) : ""); };
  const subLine = m => { const parts = []; if (gsp.showRead) parts.push(m.role === "user" ? (m.read === false ? "已送达" : "已读") : "已读"); if (gsp.showTime) parts.push(fmtT(m.ts)); return parts.join(" "); };
  const [input, setInput] = useState("");
  const [panel, setPanel] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [chatMode, setChatMode] = useState("chat"); // chat | ooc
  const [quoted, setQuoted] = useState(null); // 我引用的某条消息原文
  const [menu, setMenu] = useState(null); // 长按弹出的消息下标
  const [selMode, setSelMode] = useState(false);
  const [selIds, setSelIds] = useState([]);
  const [fwdPick, setFwdPick] = useState(false);
  const pressTimer = useRef(null);
  const [gRecallView, setGRecallView] = useState(null);
  const [fwdView, setFwdView] = useState(null);   // 点开的转发聊天记录卡
  const [sheet, setSheet] = useState(null); // "settings"|"poll"|"rp"
  const [rpView, setRpView] = useState(null); // index of redpacket detail
  const [geoOpen, setGeoOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoText, setPhotoText] = useState("");
  const [groupPhotoImg, setGroupPhotoImg] = useState("");
  const [groupPhotoMode, setGroupPhotoMode] = useState("real"); // real | describe
  const groupPhotoFileRef = useRef(null);
  const [callPick, setCallPick] = useState(null); // "voice"|"video" 选打给谁
  const [callSel, setCallSel] = useState([]); // 多选成员 id
  const [voiceMsgOpen, setVoiceMsgOpen] = useState(false);
  const [callLogOpen, setCallLogOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [xferPick, setXferPick] = useState(false); // 选转给谁
  const [xferMember, setXferMember] = useState(null); // 选定后进入金额编辑
  const ref = useRef(null);
  const inited = useRef(false);
  const gs = settings || {};
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!inited.current) {
      inited.current = true;
      return pinToBottom(el); // 首次进入群聊：同上
    }
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);
  const send = () => {
    if (!input.trim() || sending) return;
    const v = input.trim();
    setInput("");
    if (chatMode === "ooc") { onOOC && onOOC(v); return; }
    if (quoted) {
      const q = typeof quoted === "string" ? { text: quoted } : quoted;
      onSendRich && onSendRich({ role: "user", senderName: meName, content: v, replyTo: q.text, replyToId: q.id || null, replyToSenderId: q.senderId || null, replyToSenderName: q.senderName || null });
      setQuoted(null); return;
    }
    onSend(v);
  };
  const startPress = idx => { pressTimer.current = setTimeout(() => setMenu(idx), 450); };
  const endPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };
  const toggleSel = i => setSelIds(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i]);
  const exitSel = () => { setSelMode(false); setSelIds([]); setFwdPick(false); };
  const doDelete = () => { if (selIds.length) onDeleteMessages && onDeleteMessages(selIds); exitSel(); };
  const doForward = destination => {
    const picked = selIds.slice().sort((a, b) => a - b).map(i => messages[i]).filter(Boolean);
    if (picked.length && onForward) onForward(picked, destination);
    exitSel();
  };
  const memberById = id => (allChars || characters).find(c => c.id === id);
  const members = (group.memberIds || []).map(memberById).filter(Boolean);
  // 记忆互通时：成员头像可点，开心声卡（和私聊同一套 states）。没开互通就是普通头像。
  const canPeek = gsp.memoryInterop && onOpenMemberState;
  const mAvatar = (character, size) => (canPeek && character && character.id)
    ? h("button", { onClick: () => onOpenMemberState(character.id), className: "active:opacity-60", style: { flexShrink: 0, lineHeight: 0, padding: 0, border: "none", background: "none" }, title: "看 " + (character.name || "") + " 的心声" }, h(Avatar, { character: character, size: size || 34, radius: 8 }))
    : h(Avatar, { character: character, size: size || 34, radius: 8 });
  const openRp = i => {
    const rp = messages[i];
    if (rp.byMe || rp.claims.some(c => c.me) || rp.claims.length >= rp.count) {
      setRpView(i);
      return;
    }
    const r = onClaim(i);
    setRpView(i);
    if (typeof r === "number") toast && toast("领到 ¥" + r);
  };
  // 群聊 + 面板：跟私聊对齐（匿名箱→投票、拍一拍→红包）
  const PANEL = [["location", "位置", "pin"], ["sticker", "表情包", "sticker"], ["photo", "照片", "picture"], ["voicemsg", "发语音", "wave"], ["voice", "语音通话", "handset"], ["video", "视频通话", "camcorder"], ["calllog", "通话记录", "clock"], ["chatsearch", "查找记录", "magnifier"], ["poll", "投票", "bars"], ["transfer", "转账", "bill"], ["rp", "红包", "packet"]];
  const sendRich = msg => {
    onSendRich && onSendRich({ ts: Date.now(), ...msg });
    setPanel(false);
  };
  const onPanelTap = k => {
    setPanel(false);
    if (k === "location") setGeoOpen(true);
    else if (k === "photo") { setPhotoText(""); setGroupPhotoImg(""); setGroupPhotoMode("real"); setPhotoOpen(true); }
    else if (k === "voicemsg") setVoiceMsgOpen(true);
    else if (k === "voice" || k === "video") { setCallSel([]); setCallPick(k); }
    else if (k === "calllog") setCallLogOpen(true);
    else if (k === "chatsearch") setSearchOpen(true);
    else if (k === "poll") setSheet("poll");
    else if (k === "transfer") setXferPick(true);
    else if (k === "rp") setSheet("rp");
    else if (k === "sticker") setSheet("sticker");
    else toast && toast("该功能即将上线");
  };
  const submitPhoto = async () => {
    const v = photoText.trim();
    if (groupPhotoMode === "describe") {
      if (!v) { toast && toast("写一句照片里有什么，大家才看得见"); return; }
      sendRich({ role: "user", kind: "photo", desc: v, photoMode: "describe", content: "[照片] " + v });
      setPhotoOpen(false);
      return;
    }
    if (!groupPhotoImg) { toast && toast("先从相册选一张，或直接拍一张"); return; }
    let imageRef = groupPhotoImg;
    try { if (typeof imgToVault === "function") imageRef = await imgToVault(groupPhotoImg); } catch (e) {}
    await rememberRealPhoto(imageRef, v, "group-chat");
    sendRich({ role: "user", kind: "photo", imageRef, desc: v, photoMode: "real", content: v ? "[照片] " + v : "[照片]" });
    setGroupPhotoImg("");
    setPhotoOpen(false);
  };
  const gChatBg = settings && settings.chatBg;
  // 白＝等我接话（他们不自己聊），黑＝他们可以自己去聊。翻的就是群设置里那个「群里自发聊天」，
  // 不另立一个会跟它打架的状态（她 2026-08-27 定的形状：开关放设置旁，状态画在底下那颗按钮上）。
  const gHold = gs.autoChat === false;
  return h("div", {
    className: "h-full flex flex-col",
    style: gChatBg ? {
      backgroundImage: "url(\"" + resolveImg(gChatBg) + "\")",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    } : {
      background: BUBBLE_SKIN.chatBg || t.bg // 群聊也吃皮肤的全局聊天背景
    }
  }, h("div", {
    className: "shrink-0 px-4 pb-3 flex items-center gap-3",
    style: {
      paddingTop: safeTop(20),
      background: gChatBg ? "rgba(255,255,255,0.55)" : t.bg2,
      backdropFilter: gChatBg ? "blur(8px)" : "none",
      WebkitBackdropFilter: gChatBg ? "blur(8px)" : "none",
      borderBottom: "1px solid " + t.line
    }
  }, h("button", {
    onClick: onBack,
    className: "active:opacity-50"
  }, h(IArrow, {
    size: 19,
    color: t.ink
  })), h("button", {
    onClick: () => setModeOpen(true),
    className: "flex-1 min-w-0 text-left active:opacity-60"
  }, h("div", {
    className: "flex items-center gap-1",
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 16,
      color: t.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, h("span", {
    style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
  }, group.name, gs.spectate ? " · 旁观中" : "", chatMode === "ooc" ? " · OOC" : ""), h(IChevD, { size: 14, color: t.fog })), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 10.5,
      color: chatMode === "ooc" ? t.accent : t.fog,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, chatMode === "ooc" ? "OOC 指令 · 轻触切回群聊" : members.map(c => c.name).join("、") + " · 轻触切换" + (gHold ? " · 等我接话" : ""))),
  // 记忆互通关掉时本来就不会自发，这颗开关也就不出现——免得按了没反应
  gs.memoryInterop && chatMode !== "ooc" ? h("button", {
    onClick: () => onSaveSettings && onSaveSettings({ autoChat: gHold }),
    className: "active:opacity-50 shrink-0",
    title: gHold ? "等我接话中 · 点一下让他们可以自己聊" : "他们可以自己聊 · 点一下改成等我接话",
    // 跟旁边那颗齿轮同一个分量：细线图标、不带底盘。v56.82 那颗实心圆点太重也太大了（她说「略丑…有点大」）。
    // 关掉时图标褪成 t.fog 再压一道斜杠，就是通用的「静音」样子，一眼分得出。
    style: { position: "relative", display: "flex", alignItems: "center" }
  }, h(GChat, { size: 19, color: gHold ? t.fog : t.ink }),
    gHold ? h("span", {
      style: { position: "absolute", left: 1, top: "50%", width: 17, height: 1.3, borderRadius: 1, background: t.fog, transform: "rotate(-45deg)", transformOrigin: "center" }
    }) : null) : null,
  h("button", {
    onClick: () => setSheet("settings"),
    className: "active:opacity-50"
  }, h(GConfig, {
    size: 20,
    color: t.ink
  }))), h("div", {
    ref: ref,
    style: { overflowX: "hidden", touchAction: "pan-y pinch-zoom" },
    className: "flex-1 overflow-y-auto px-4 py-4 space-y-2"
  }, archCount > 0 ? h("button", {
    onClick: async () => { if (archView === "loading") return; setArchView("loading"); const arr = onLoadOlder ? await onLoadOlder("g_" + group.id) : null; setArchView(Array.isArray(arr) ? arr : []); },
    className: "w-full active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12, color: t.tint, padding: "6px 0", marginBottom: 4 }
  }, archView === "loading" ? "加载中…" : ("☁ 更早的 " + archCount + " 条群聊在云端 · 点开查看")) : null,
  Array.isArray(archView) && h(Sheet, { onClose: () => setArchView(null), tall: true },
    h(Eyebrow, { style: { marginBottom: 8 } }, "更早的群聊 · 云端归档"),
    archView.length === 0
      ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", padding: "30px 0" } }, "云端还没有更早的记录")
      : h("div", { style: { display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, textAlign: "center", marginBottom: 2 } }, "共 " + archView.length + " 条 · 只读回看（不占本地）"),
          archView.map((m, i) => {
            const mine = m.role === "user";
            const who = mine ? (meName || "我") : (m.senderName || "");
            const body = m.content != null && String(m.content) !== "" ? String(m.content) : (m.kind ? "[" + m.kind + "]" : "");
            return h("div", { key: i, style: { display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" } },
              who ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, margin: "0 4px 1px" } }, who) : null,
              h("div", { style: { maxWidth: "82%", padding: "7px 11px", borderRadius: 12, fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word", background: mine ? t.tint : t.bg2, color: mine ? "#fff" : t.ink, border: mine ? "none" : "1px solid " + t.line } }, body));
          }))),
  messages.length === 0 && h(Empty, {
    text: "群聊已创建",
    sub: gs.spectate ? "用旁白（下方输入）推动，成员们会互动" : "发条消息，成员们会陆续回应"
  }), messages.map((m, i) => {
    if (m.kind === "ooc") return h("div", {
      key: i,
      className: "flex my-2 items-start gap-1.5 " + (m.role === "user" ? "justify-end" : "justify-start")
    }, onDeleteMessages ? h("button", {
      onClick: e => { e.preventDefault(); e.stopPropagation(); onDeleteMessages([i]); },
      className: "active:opacity-50 shrink-0",
      style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, opacity: 0.55, padding: "4px 4px 0 0", order: m.role === "user" ? -1 : 1 }
    }, "✕") : null, h("div", {
      className: "px-3 py-1.5",
      style: {
        fontFamily: F_BODY,
        fontSize: 12.5,
        lineHeight: 1.5,
        color: t.fog,
        background: t.bg,
        border: "1px dashed " + t.line,
        borderRadius: 10,
        maxWidth: "82%",
        whiteSpace: "pre-wrap"
      }
    }, "OOC · " + m.content));
    if (m.kind === "offlinelog") return h("div", {
      key: i, className: "my-3 mx-6"
    }, h(OfflineLogCard, { m: m, t: t }));
    if (m.role === "narration" || m.kind === "narration") return h("div", {
      key: i,
      className: "flex justify-center items-start gap-2 py-1"
    }, h("span", {
      style: {
        fontFamily: F_BODY,
        fontSize: 12,
        fontStyle: "italic",
        color: t.fog,
        textAlign: "center",
        maxWidth: "82%",
        lineHeight: 1.5
      }
    }, "— " + m.content + " —"), onDeleteMessages ? h("button", {
      onClick: () => requestAppConfirm("删除这条旁白记录？", "删除后不能恢复。", () => onDeleteMessages([i]), "删除"),
      className: "active:opacity-50 shrink-0",
      style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, opacity: 0.6, padding: "0 2px" },
      title: "删除旁白"
    }, "✕") : null);
    if (m.kind === "callend") return h(CallEndPill, { key: i, m, chars: characters });
    if (m.role === "system") return h("div", {
      key: i,
      className: "flex justify-center py-1"
    }, h("span", {
      style: {
        fontFamily: F_BODY,
        fontSize: 11,
        color: t.fog,
        background: t.bg2,
        padding: "3px 12px",
        borderRadius: 999,
        border: "1px solid " + t.line
      }
    }, m.content));
    if (m.kind === "poll") return h(PollCard, {
      key: i,
      poll: m,
      meName: meName,
      onVote: opt => onVote(i, opt)
    });
    // 红包以前是整条裸着排的：没有头像、也没有发红包的人是谁（她 2026-08-20 报）。
    // 改成和语音/同人分享同一套外壳：左边头像、上面名字，卡片本身一个字不动。
    if (m.kind === "redpacket") return h("div", { key: i, className: "py-1 flex items-start gap-2 " + (m.role === "user" ? "justify-end" : "justify-start") },
      m.role !== "user" && mAvatar(memberById(m.senderId) || { name: m.senderName, color: t.tint }),
      h("div", {
        className: "flex flex-col " + (m.role === "user" ? "items-end" : "items-start"),
        onTouchStart: selMode ? undefined : () => startPress(i), onTouchEnd: endPress,
        onMouseDown: selMode ? undefined : () => startPress(i), onMouseUp: endPress, onMouseLeave: endPress,
        style: { outline: selMode && selIds.includes(i) ? "2px solid " + t.tint : "none", outlineOffset: 2, borderRadius: 12 }
      },
        m.senderName && h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, margin: "0 4px 2px" } }, m.senderName),
        h(RedPacketCard, { rp: m, onClick: selMode ? () => toggleSel(i) : () => openRp(i) })),
      m.role === "user" && gsp.showMyAvatar && h(Avatar, { character: meAv, size: 34, radius: 8 }));
    if (m.kind === "geo") return h(GeoCard, {
      key: i,
      m: m,
      isU: m.role === "user",
      who: m.senderName || ((memberById(m.senderId) || {}).name || "TA"),
      avatar: mAvatar(memberById(m.senderId) || { name: m.senderName, color: t.tint }),
      myAvatar: gsp.showMyAvatar && h(Avatar, { character: meAv, size: 34, radius: 8 })
    });
    if (m.kind === "emote") return h("div", { key: i, className: "py-1 flex items-start gap-2 " + (m.role === "user" ? "justify-end" : "justify-start") },
      m.role !== "user" && mAvatar(memberById(m.senderId) || { name: m.senderName, color: t.tint }),
      h("div", {
        className: "flex flex-col " + (m.role === "user" ? "items-end" : "items-start"),
        onTouchStart: selMode ? undefined : () => startPress(i), onTouchEnd: endPress,
        onMouseDown: selMode ? undefined : () => startPress(i), onMouseUp: endPress, onMouseLeave: endPress,
        onClick: selMode ? () => toggleSel(i) : undefined,
        style: { outline: selMode && selIds.includes(i) ? "2px solid " + t.tint : "none", outlineOffset: 2, borderRadius: 12 }
      },
        m.role !== "user" && m.senderName && h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, margin: "0 4px 2px" } }, m.senderName),
        h(EmoteBubble, { url: m.url, keyword: m.keyword, max: 112 })),
      m.role === "user" && gsp.showMyAvatar && h(Avatar, { character: meAv, size: 34, radius: 8 }));
    if (m.kind === "chatforward") return h("div", { key: i, className: "py-1 flex items-start gap-2 " + (m.role === "user" ? "justify-end" : "justify-start") },
      m.role !== "user" && mAvatar(memberById(m.senderId) || { name: m.senderName, color: t.tint }),
      h("div", { className: "flex flex-col " + (m.role === "user" ? "items-end" : "items-start") },
        m.senderName && h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, margin: "0 4px 2px" } }, m.senderName),
        h(ChatForwardCard, { m: m, isU: m.role === "user", onOpen: setFwdView }),
        subLine(m) ? h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog, margin: "1px 4px 0" } }, subLine(m)) : null),
      m.role === "user" && gsp.showMyAvatar && h(Avatar, { character: meAv, size: 34, radius: 8 }));
    if (m.kind === "forumshare") return h("div", { key: i, className: "flex flex-col py-1 " + (m.role === "user" ? "items-end" : "items-start") },
      m.role === "user" && m.senderName && h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, margin: "0 4px 2px" } }, m.senderName),
      h(ForumShareCard, { m: m, isU: m.role === "user" }));
    if (m.kind === "ficshare") return h("div", { key: i, className: "py-1 flex items-start gap-2 " + (m.role === "user" ? "justify-end" : "justify-start") },
      m.role !== "user" && mAvatar(memberById(m.senderId) || { name: m.senderName, color: t.tint }),
      h("div", { className: "flex flex-col " + (m.role === "user" ? "items-end" : "items-start") },
        m.senderName && h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, margin: "0 4px 2px" } }, m.senderName),
        h(FicShareCard, { m: m, isU: m.role === "user" })),
      m.role === "user" && gsp.showMyAvatar && h(Avatar, { character: meAv, size: 34, radius: 8 }));
    if (m.kind === "voice") return h("div", { key: i, className: "py-1 flex items-start gap-2 " + (m.role === "user" ? "justify-end" : "justify-start") },
      m.role !== "user" && mAvatar(memberById(m.senderId) || { name: m.senderName, color: t.tint }),
      h("div", {
        className: "flex flex-col " + (m.role === "user" ? "items-end" : "items-start"),
        onTouchStart: selMode ? undefined : () => startPress(i), onTouchEnd: endPress,
        onMouseDown: selMode ? undefined : () => startPress(i), onMouseUp: endPress, onMouseLeave: endPress,
        onClick: selMode ? () => toggleSel(i) : undefined,
        style: { maxWidth: "72%", outline: selMode && selIds.includes(i) ? "2px solid " + t.tint : "none", outlineOffset: 2, borderRadius: 18 }
      },
        m.role !== "user" && m.senderName && h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, margin: "0 4px 2px" } }, m.senderName),
        h(VoiceMsg, { m: m, isU: m.role === "user", speaker: m.role === "user" ? null : memberById(m.senderId) })),
      m.role === "user" && gsp.showMyAvatar && h(Avatar, { character: meAv, size: 34, radius: 8 }));
    if (m.kind === "callinvite") return h(CallReceipt, { key: i, m: m, isU: m.role === "user",
      who: m.senderName || ((memberById(m.senderId) || {}).name || ""),
      avatar: mAvatar(memberById(m.senderId) || { name: m.senderName, color: t.tint }), onCallBack: onCallBack });
    if (m.kind === "paylater") return h(PayLaterCard, { key: i, m: m });
    if (m.kind === "transfer") return h("div", {
      key: i,
      className: "flex flex-col py-1 " + (m.role === "user" ? "items-end" : "items-start"),
      onTouchStart: selMode ? undefined : () => startPress(i), onTouchEnd: endPress,
      onMouseDown: selMode ? undefined : () => startPress(i), onMouseUp: endPress, onMouseLeave: endPress,
      onClick: selMode ? () => toggleSel(i) : undefined,
      style: { outline: selMode && selIds.includes(i) ? "2px solid " + t.tint : "none", outlineOffset: 2, borderRadius: 14 }
    }, m.toName && h("div", {
      style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 2, marginRight: 4 }
    }, "转账给 " + m.toName), h(TransferCard, {
      m: m,
      isU: m.role === "user",
      onRespond: onRespondTransfer,
      avatar: mAvatar(memberById(m.senderId) || { name: m.senderName, color: t.tint }),
      myAvatar: gsp.showMyAvatar && h(Avatar, { character: meAv, size: 40, radius: 10 })
    }));
    if (m.kind === "selfie") return h("div", { key: i, className: "py-1 flex items-start gap-2 justify-start" },
      mAvatar(memberById(m.senderId) || { name: m.senderName, color: t.tint }),
      h("div", {
        className: "flex flex-col items-start",
        // 群聊自拍也要能长按（收藏/多选/撤回）——之前只有 1:1 接了 startPress，群里图长按没反应
        onTouchStart: selMode ? undefined : () => startPress(i), onTouchEnd: endPress,
        onMouseDown: selMode ? undefined : () => startPress(i), onMouseUp: endPress, onMouseLeave: endPress,
        onClick: selMode ? () => toggleSel(i) : undefined,
        style: { maxWidth: "72%", outline: selMode && selIds.includes(i) ? "2px solid " + t.tint : "none", outlineOffset: 2, borderRadius: 14 }
      },
        m.senderName && h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, margin: "0 4px 2px" } }, m.senderName),
        h(SelfieBubble, { m: m })));
    if (m.kind === "photo") return h("div", {
      key: i,
      className: "flex justify-end py-1"
    }, h("div", {
      onTouchStart: selMode ? undefined : () => startPress(i), onTouchEnd: endPress,
      onMouseDown: selMode ? undefined : () => startPress(i), onMouseUp: endPress, onMouseLeave: endPress,
      onClick: selMode ? () => toggleSel(i) : undefined,
      style: {
        padding: m.imageRef ? 0 : "8px 10px",
        background: BUBBLE_SKIN.myBg,
        borderRadius: 14,
        maxWidth: "72%",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        outline: selMode && selIds.includes(i) ? "2px solid " + t.tint : "none",
        outlineOffset: 2
      }
    }, m.imageRef ? h("div", null,
      h("img", { src: resolveImg(m.imageRef), alt: m.desc || "照片", style: { display: "block", width: "100%", maxWidth: 260, maxHeight: 310, objectFit: "cover" } }),
      m.desc ? h("div", { style: { padding: "7px 10px", fontFamily: F_BODY, fontSize: 13, color: "#16330a", lineHeight: 1.45 } }, m.desc) : null
    ) : h("div", {
      className: "flex items-center gap-2"
    }, h("div", {
      style: {
        width: 40,
        height: 40,
        borderRadius: 8,
        background: "linear-gradient(135deg,#d8d3c8,#b3ada0)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0
      }
    }, h(PGlyph, {
      k: "album",
      size: 20,
      color: "rgba(255,255,255,0.9)"
    })), h("span", {
      style: { fontFamily: F_BODY, fontSize: 13, color: "#16330a", lineHeight: 1.4 }
    }, m.desc || "照片"))));
    const isU = m.role === "user";
    const c = m.senderId ? memberById(m.senderId) : null;
    const toGroupTime = value => {
      if (value == null || value === "") return NaN;
      const numeric = Number(value);
      if (Number.isFinite(numeric)) return numeric;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : NaN;
    };
    let previousTimed = null;
    for (let j = i - 1; j >= 0; j--) {
      if (messages[j] && Number.isFinite(toGroupTime(messages[j].ts))) { previousTimed = messages[j]; break; }
    }
    const currentTime = toGroupTime(m.ts);
    const previousTime = previousTimed ? toGroupTime(previousTimed.ts) : NaN;
    const currentDate = Number.isFinite(currentTime) ? new Date(currentTime) : null;
    const previousDate = Number.isFinite(previousTime) ? new Date(previousTime) : null;
    const crossedDay = currentDate && previousDate && (currentDate.getFullYear() !== previousDate.getFullYear() || currentDate.getMonth() !== previousDate.getMonth() || currentDate.getDate() !== previousDate.getDate());
    const sameTurn = previousTimed && previousTimed.turnId && m.turnId && previousTimed.turnId === m.turnId;
    const showGroupTime = !!previousTimed && !sameTurn && currentTime > previousTime && (crossedDay || currentTime - previousTime >= 30 * 60 * 1000);
    let groupTimeLabel = "";
    if (showGroupTime) {
      const now = new Date(), pad = n => String(n).padStart(2, "0");
      const sameToday = currentDate.getFullYear() === now.getFullYear() && currentDate.getMonth() === now.getMonth() && currentDate.getDate() === now.getDate();
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const sameYesterday = currentDate.getFullYear() === yesterday.getFullYear() && currentDate.getMonth() === yesterday.getMonth() && currentDate.getDate() === yesterday.getDate();
      const clock = pad(currentDate.getHours()) + ":" + pad(currentDate.getMinutes());
      groupTimeLabel = sameToday ? clock : sameYesterday ? "昨天 " + clock : (currentDate.getFullYear() === now.getFullYear() ? "" : currentDate.getFullYear() + "年") + (currentDate.getMonth() + 1) + "月" + currentDate.getDate() + "日 " + clock;
    }
    return h("div", {
      key: i,
    }, showGroupTime && h("div", { className: "flex justify-center", style: { margin: "13px 0 8px" } },
      h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, letterSpacing: "0.02em" } }, groupTimeLabel)), h("div", {
      className: "flex items-start gap-2 " + (isU ? "justify-end" : "justify-start")
    }, !isU && mAvatar(c), h("div", {
      className: "flex flex-col",
      style: {
        alignItems: isU ? "flex-end" : "flex-start",
        maxWidth: "72%",
        minWidth: 0
      }
    }, !isU && h("span", {
      style: {
        fontFamily: F_BODY,
        fontSize: 10.5,
        color: t.fog,
        marginBottom: 2,
        marginLeft: 2
      }
    }, m.senderName), m.replyTo && h("div", {
      style: {
        fontFamily: F_BODY,
        fontSize: 11,
        color: t.fog,
        background: t.bg,
        borderLeft: "2px solid " + t.line,
        borderRadius: 4,
        padding: "2px 8px",
        marginBottom: 3,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
      // 只显示被引用的原话，不写「引用 XXX：」——是谁说的代码里有 replyToSenderName，
      // 界面上照旧只摆一句原文就够了（她 2026-08-24）
    }, "❝ " + m.replyTo), m.recalled ? h(m.origText ? "button" : "div", { onClick: m.origText ? () => setGRecallView(m) : undefined, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, fontStyle: "italic", color: t.fog, padding: "4px 2px" } }, (isU ? "你" : m.senderName || "对方") + " 撤回了一条消息" + (m.origText ? " · 点看" : "")) : h("div", {
      onTouchStart: selMode ? undefined : () => startPress(i),
      onTouchEnd: endPress,
      onMouseDown: selMode ? undefined : () => startPress(i),
      onMouseUp: endPress,
      onMouseLeave: endPress,
      onClick: selMode ? () => toggleSel(i) : undefined,
      style: {
        position: "relative", // 贴纸锚点
        padding: "9px 13px",
        fontFamily: F_BODY,
        fontSize: 14.5,
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        background: isU ? BUBBLE_SKIN.myBg : BUBBLE_SKIN.charBg,
        color: isU ? BUBBLE_SKIN.myText : (BUBBLE_SKIN.charText || t.ink),
        border: (isU ? BUBBLE_SKIN.myBorder : BUBBLE_SKIN.charBorder) || "none",
        borderRadius: BUBBLE_SKIN.radius,
        boxShadow: BUBBLE_SKIN.shadow || "none",
        outline: selMode && selIds.includes(i) ? "2px solid " + t.tint : "none",
        outlineOffset: 2,
        cursor: "pointer",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none"
      }
    }, bubbleSticker(isU), m.recalled ? m.content : h(TransText, { text: m.content, isU: isU, zhReady: m.zh })), msgFoot(i, m, !m.recalled && subLine(m))), isU && gsp.showMyAvatar && h(Avatar, { character: meAv, size: 34, radius: 8 })));
  }).flatMap((row, i) => {
    // 思考链画在这一组回复的上方（和单聊、线下同一个组件、同一个位置）。
    // 群聊一次调用写完所有人，所以它挂在这一轮最先冒出来的那条上（v56.75）。
    const _m = messages[i];
    return (_m && _m.reasoning && _m.role !== "user") ? [h(ReasoningBlock, { key: "grz" + i, m: _m }), row] : [row];
  }), sending && h("div", {
    className: "flex items-center gap-2"
  }, h("div", {
    style: {
      padding: "12px 14px",
      background: "#fff",
      borderRadius: 14
    }
  }, h("div", {
    className: "flex gap-1"
  }, [0, 1, 2].map(i => h("span", {
    key: i,
    className: "w-1.5 h-1.5 rounded-full animate-pulse",
    style: {
      background: t.fog,
      animationDelay: i * 0.15 + "s"
    }
  })))))), panel && h("div", {
    className: "shrink-0 grid grid-cols-4 gap-y-5 px-5 py-5",
    style: {
      background: t.bg2,
      borderTop: "1px solid " + t.line
    }
  }, PANEL.map(([k, zh, glyph]) => h("button", {
    key: k,
    onClick: () => onPanelTap(k),
    className: "flex flex-col items-center gap-1.5 active:opacity-60"
  }, h("div", {
    className: "flex items-center justify-center",
    style: {
      width: 52,
      height: 52,
      borderRadius: 14,
      background: t.bg,
      border: "1px solid " + t.line
    }
  }, h(CGlyph, {
    k: glyph,
    size: 24,
    color: t.sub
  })), h("span", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11,
      color: t.fog
    }
  }, zh)))), selMode && h("div", {
    className: "flex items-center justify-between px-4 py-3 shrink-0",
    style: { background: t.bg2, borderTop: "1px solid " + t.line }
  }, h("button", { onClick: exitSel, style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "取消"),
    h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, "已选 " + selIds.length),
    h("div", { className: "flex gap-3 items-center" },
      h("button", { onClick: doDelete, disabled: !selIds.length, className: "disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: 13, color: t.accent } }, "删除"),
      h("button", { onClick: () => selIds.length && setFwdPick(true), disabled: !selIds.length, className: "disabled:opacity-40 px-3 py-1.5", style: { fontFamily: F_BODY, fontSize: 13, color: t.bg2, background: t.ink, borderRadius: 6 } }, "转发"))),
  fwdPick && h(Sheet, { onClose: () => setFwdPick(false) },
    h(Eyebrow, { style: { marginBottom: 12 } }, "转发给谁"),
    h("div", { className: "space-y-1 max-h-72 overflow-y-auto" },
      (characters || []).map(c => h("button", { key: c.id, onClick: () => doForward({ type: "chat", id: c.id }), className: "w-full flex items-center gap-3 py-2.5 active:opacity-60" }, h(Avatar, { character: c, size: 34, radius: 7 }), h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, c.remark || c.name))),
      (groups || []).filter(g => g.id !== group.id).map(g => h("button", { key: "g_" + g.id, onClick: () => doForward({ type: "group", id: g.id }), className: "w-full flex items-center gap-3 py-2.5 active:opacity-60" }, h("div", { style: { width: 34, height: 34, borderRadius: 7, background: t.bg2, border: "1px solid " + t.line, display: "flex", alignItems: "center", justifyContent: "center" } }, "👥"), h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, g.name))))),
  !selMode && quoted && h("div", {
    className: "shrink-0",
    style: { background: t.bg2, borderTop: "1px solid " + t.line, padding: "6px 12px 0", display: "flex", alignItems: "center" }
  }, h("div", { style: { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, padding: "4px 9px", background: t.bg, borderRadius: 7, borderLeft: "2px solid " + t.accent } },
    h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 11.5, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, window.GroupQuote ? window.GroupQuote.label(quoted) : "❝ " + (typeof quoted === "string" ? quoted : quoted.text)),
    h("button", { onClick: () => setQuoted(null), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 16, lineHeight: 1, color: t.fog, padding: "0 4px" } }, "×"))),
  !selMode && h("div", {
    className: "flex items-center gap-2 px-3 py-2.5 shrink-0",
    style: {
      background: t.bg2,
      borderTop: (!selMode && quoted) ? "none" : "1px solid " + t.line,
      paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4)"
    }
  }, h("button", {
    onClick: () => setPanel(v => !v),
    className: "active:opacity-60 shrink-0 flex items-center justify-center",
    style: {
      width: 32,
      height: 32,
      transform: panel ? "rotate(45deg)" : "none",
      transition: "transform .2s"
    }
  }, h(IPlus, {
    size: 22,
    color: t.fog
  })), h("input", {
    value: input,
    onChange: e => setInput(e.target.value),
    onKeyDown: e => e.key === "Enter" && send(),
    placeholder: chatMode === "ooc" ? "OOC：直接和模型说，可让它调整或问状态…" : gs.spectate ? "写一句旁白，推动剧情…" : "在群里发言…",
    className: "flex-1 outline-none px-4 py-2.5 rounded-full",
    style: {
      fontFamily: F_BODY,
      fontSize: 14,
      color: t.ink,
      background: "#fff",
      border: "1px solid " + t.line,
      minWidth: 0
    }
  }), h("button", {
    onClick: send,
    disabled: sending || !input.trim(),
    className: "active:opacity-70 disabled:opacity-30 flex items-center justify-center shrink-0",
    style: {
      width: 40,
      height: 40,
      borderRadius: 999,
      background: BUBBLE_SKIN.myBg
    }
  }, h(ISend, {
    size: 16,
    color: "#16330a"
  })), chatMode !== "ooc" && h("button", {
    onClick: onReply,
    disabled: sending,
    // 白的时候按它＝只让他们回一轮，回完仍旧等你；黑的时候＝回一轮并开一段自发
    title: gHold ? (gs.spectate ? "让他们演一轮（回完仍旧等你）" : "让他们回一轮（回完仍旧等你）") : (gs.spectate ? "让他们继续" : "让他们回复"),
    className: "active:opacity-70 disabled:opacity-40 flex items-center justify-center shrink-0",
    style: {
      width: 40,
      height: 40,
      borderRadius: 999,
      background: gHold ? t.bg2 : t.ink,
      border: gHold ? "1.5px solid " + t.ink : "none"
    }
  }, sending ? h("div", {
    className: "flex gap-0.5"
  }, [0, 1, 2].map(i => h("span", {
    key: i,
    className: "w-1 h-1 rounded-full animate-pulse",
    style: {
      background: gHold ? t.ink : t.bg2,
      animationDelay: i * 0.15 + "s"
    }
  }))) : h(ISpark, {
    size: 19,
    color: gHold ? t.ink : t.bg2
  }))), gRecallView && h(Sheet, { onClose: () => setGRecallView(null) },
    h(Eyebrow, { style: { marginBottom: 8 } }, (gRecallView.senderName || "TA") + " 撤回的消息"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.6, color: t.ink, background: t.bg, borderRadius: 12, padding: "12px 14px" } }, gRecallView.origText || "（空）"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: "0.12em", color: t.fog, marginTop: 14, marginBottom: 4 } }, "TA 为什么撤回"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.7, color: t.sub, fontStyle: "italic" } }, gRecallView.reason || "（没说）")),
  fwdView && h(ChatForwardSheet, { m: fwdView, onClose: () => setFwdView(null) }), sheet === "settings" && h(GroupSettingsSheet, {
    gs: gs,
    group: group,
    characters: characters,
    allChars: allChars,
    rels: rels,
    msgCount: (messages || []).length,
    directives: directives,
    onRemoveDirective: onRemoveDirective,
    onSetDirectiveTurns: onSetDirectiveTurns,
    onSave: patch => onSaveSettings(patch),
    onSummarize: onSummarize,
    onAddMember: onAddMember,
    onKickMember: onKickMember,
    onDelete: onDeleteGroup,
    onClearChat: onClearGroupChat,
    onClose: () => setSheet(null)
  }), sheet === "poll" && h(PollComposeSheet, {
    onSubmit: (title, opts, anon) => {
      onStartPoll(title, opts, anon);
      setSheet(null);
    },
    onClose: () => setSheet(null)
  }), sheet === "rp" && h(RedPacketComposeSheet, {
    memberCount: members.length,
    myBalance: myBalance,
    onSubmit: (total, count, message) => {
      onSendRedPacket(total, count, message);
      setSheet(null);
    },
    onClose: () => setSheet(null)
  }), sheet === "sticker" && h(Sheet, { onClose: () => setSheet(null), tall: true },
    h("div", { className: "flex items-center justify-between", style: { marginBottom: 12 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1.2, color: t.fog } }, "表情包"),
      h("button", { onClick: () => { setSheet(null); onManageEmotes && onManageEmotes(); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.tint } }, "管理表情库 ›")),
    (emotes || []).length === 0
      ? h("div", { className: "text-center", style: { padding: "30px 0", fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 1.9 } }, "还没有表情。\n点右上「管理表情库」批量导入。")
      : h("div", { className: "grid grid-cols-4 gap-2", style: { maxHeight: "46vh", overflowY: "auto" } }, (emotes || []).map(em => h("button", { key: em.id, onClick: () => { sendRich({ role: "user", kind: "emote", url: em.url, keyword: em.keyword, content: "[表情] " + em.keyword }); setSheet(null); }, className: "active:opacity-70", style: { border: "1px solid " + t.line, borderRadius: 10, overflow: "hidden", background: t.bg2 } },
        h("div", { style: { width: "100%", aspectRatio: "1" } }, h("img", { src: em.url, referrerPolicy: "no-referrer", loading: "lazy", style: { width: "100%", height: "100%", objectFit: "cover", display: "block" }, onError: e => { e.target.style.display = "none"; } })))))
  ), rpView != null && messages[rpView] && messages[rpView].kind === "redpacket" && h(RedPacketOpenSheet, {
    rp: messages[rpView],
    meName: meName,
    onClose: () => setRpView(null)
  }), geoOpen && h(GeoStampSheet, {
    recent: geoRecent,
    onClose: () => setGeoOpen(false),
    onSend: name => {
      sendRich({ role: "user", kind: "geo", name: name, content: "[位置] " + name });
      setGeoOpen(false);
    }
  }), photoOpen && h(Sheet, {
    onClose: () => setPhotoOpen(false)
  }, h("div", {
    className: "flex items-center justify-between mb-3"
  }, h("span", {
    style: { fontFamily: F_DISPLAY, fontSize: 19, color: t.ink }
  }, "发送照片"), h("button", {
    onClick: submitPhoto
  }, h(ISend, { size: 18, color: t.ink }))),
    h("div", { className: "flex gap-2 mb-3", style: { background: t.bg, borderRadius: 11, padding: 4 } },
      [["real", "发送真照片"], ["describe", "只发文字描述"]].map(([id, label]) => h("button", {
        key: id, onClick: () => setGroupPhotoMode(id), className: "flex-1 active:opacity-75",
        style: { padding: "8px 5px", borderRadius: 8, fontFamily: F_BODY, fontSize: 12.5, color: groupPhotoMode === id ? t.bg2 : t.fog, background: groupPhotoMode === id ? t.ink : "transparent" }
      }, label))),
    h("input", { ref: groupPhotoFileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: e => {
      const f = e.target.files && e.target.files[0];
      if (f) resizeImageFile(f, 1600, 0.86).then(setGroupPhotoImg).catch(() => toast && toast("这张照片没能读出来，换一张试试"));
      e.target.value = "";
    } }),
    groupPhotoMode === "real" && h("button", { onClick: () => groupPhotoFileRef.current && groupPhotoFileRef.current.click(), className: "w-full active:opacity-75", style: { minHeight: 150, borderRadius: 12, overflow: "hidden", background: t.bg, border: `1px dashed ${t.line}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 } },
      groupPhotoImg ? h("img", { src: groupPhotoImg, style: { display: "block", width: "100%", maxHeight: 280, objectFit: "contain" } }) : h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.fog, lineHeight: 1.8 } }, "点这里选择照片\n相机或相册都可以")),
    h("input", { value: photoText, onChange: e => setPhotoText(e.target.value), placeholder: groupPhotoMode === "real" ? "可以顺手说一句（选填）" : "描述照片里有什么（必填，不会上传图片）", className: "w-full outline-none px-4 py-3 rounded-xl", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: "#fff", border: "1px solid " + t.line } }),
    groupPhotoMode === "describe" && h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.5, marginTop: 7 } }, "群成员只会收到文字描述；不会读取或上传真实照片。")
  ), callLogOpen && h(CallLogSheet, { calls: (messages || []).filter(x => x.kind === "callend"), chars: characters, onClose: () => setCallLogOpen(false) }), searchOpen && h(ChatSearchSheet, { messages, chars: characters, archCount: archCount, loadArch: onLoadOlder ? () => onLoadOlder("g_" + group.id) : null, onClose: () => setSearchOpen(false), onLocate: i => { setSearchOpen(false); setTimeout(() => locateMsgIn(ref.current, i, messages, archCount > 0), 130); } }), voiceMsgOpen && h(Sheet, { onClose: () => setVoiceMsgOpen(false) },
    h(VoiceEarComposer, { onSend: sendRich, onClose: () => setVoiceMsgOpen(false), senderName: meName, ownerKey: profile && (profile.id || profile.name), toast })
  ), callPick && h(Sheet, {
    onClose: () => setCallPick(null)
  }, h("div", {
    style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1.2, color: t.fog, marginBottom: 10 }
  }, (callPick === "video" ? "视频通话" : "语音通话") + " · 拉谁进来（可多选）"), h("div", {
    className: "space-y-1 max-h-64 overflow-y-auto"
  }, members.map(c => {
    const on = callSel.includes(c.id);
    return h("button", {
      key: c.id,
      onClick: () => setCallSel(s => s.includes(c.id) ? s.filter(x => x !== c.id) : [...s, c.id]),
      className: "w-full flex items-center gap-3 py-2.5 px-2 active:opacity-60"
    }, h(Avatar, { character: c, size: 38, radius: 8 }), h("span", {
      className: "flex-1 text-left",
      style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink }
    }, c.name), h("div", {
      className: "flex items-center justify-center shrink-0",
      style: { width: 22, height: 22, borderRadius: 999, border: "1.5px solid " + (on ? t.tint : t.line), background: on ? t.tint : "transparent" }
    }, on && h(ICheck, { size: 14, color: "#fff" })));
  })), h("button", {
    onClick: () => { const m = callPick; const ids = callSel; setCallPick(null); if (ids.length) onStartCall && onStartCall(m, ids); },
    disabled: !callSel.length,
    className: "w-full py-3 mt-3 disabled:opacity-40",
    style: { fontFamily: F_BODY, fontSize: 13.5, background: t.ink, color: t.bg2, borderRadius: 8 }
  }, callSel.length ? "开始通话（" + callSel.length + "人）" : "选择成员")), xferPick && h(Sheet, {
    onClose: () => setXferPick(false)
  }, h("div", {
    style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1.2, color: t.fog, marginBottom: 10 }
  }, "转账 · 转给谁"), h("div", {
    className: "space-y-1 max-h-72 overflow-y-auto"
  }, members.map(c => h("button", {
    key: c.id,
    onClick: () => { setXferPick(false); setXferMember(c); },
    className: "w-full flex items-center gap-3 py-2.5 px-2 active:opacity-60"
  }, h(Avatar, { character: c, size: 38, radius: 8 }), h("span", {
    style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink }
  }, c.name))))), xferMember && h(TransferComposeSheet, {
    cName: xferMember.name,
    myBalance: myBalance,
    onClose: () => setXferMember(null),
    onSend: (amount, note) => {
      onSendTransfer && onSendTransfer(xferMember.id, amount, note);
      setXferMember(null);
    }
  }), modeOpen && h(Sheet, {
    onClose: () => setModeOpen(false)
  }, h("div", {
    style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1.2, color: t.fog, marginBottom: 10 }
  }, "输入模式"), [["chat", "群聊", "在群里正常收发消息"], ["ooc", "OOC 指令", "越过所有角色直接和模型说"], ["offline", "赴约", "进入多人线下模式"]].map(([mk, mzh, mdesc]) => h("button", {
    key: mk,
    onClick: () => {
      setModeOpen(false);
      if (mk === "offline") onOffline && onOffline();
      else setChatMode(mk);
    },
    className: "w-full flex items-center py-3 px-3 active:opacity-60 text-left",
    style: { borderRadius: 12, background: mk === chatMode ? t.bg : "transparent", marginBottom: 4 }
  }, h("div", {
    className: "flex-1"
  }, h("div", {
    style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink }
  }, mzh), h("div", {
    style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 1 }
  }, mdesc)), mk === chatMode && h(ICheck, {
    size: 18,
    color: t.tint
  })))), menu != null && h(MsgMenu, {
    message: messages[menu],
    idx: menu,
    isMine: messages[menu] && messages[menu].role === "user",
    items: menuItemsForKind(messages[menu], canSpeakMsg(messages[menu])),
    onClose: () => setMenu(null),
    onAction: act => {
      if (act === "multi") { setSelMode(true); setSelIds([menu]); }
      else if (act === "quote") { const mm = messages[menu]; if (mm && mm.content) setQuoted(window.GroupQuote ? window.GroupQuote.makeSelection(mm, menu, meName) : String(mm.content)); }
      else if (act === "speak") { speakMsg(menu, messages[menu]); }
      else onMsgAction && onMsgAction(act, menu);
      setMenu(null);
    }
  }));
}
function PollCard({
  poll,
  meName,
  onVote
}) {
  const t = useTheme();
  const total = poll.options.reduce((a, o) => a + o.voters.length, 0);
  const myVote = poll.options.findIndex(o => o.voters.includes(meName));
  return h("div", {
    className: "rounded-2xl overflow-hidden my-1",
    style: {
      background: "#fff",
      border: "1px solid " + t.line,
      maxWidth: "82%"
    }
  }, h("div", {
    className: "px-4 pt-3 pb-2",
    style: {
      borderBottom: "1px solid " + t.line
    }
  }, h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 15,
      color: t.ink
    }
  }, "投票 · " + poll.title), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 10.5,
      color: t.fog,
      marginTop: 2
    }
  }, "由 " + (poll.by || "某人") + " 发起 · " + (poll.anon ? "匿名" : "记名") + " · 共 " + total + " 票")), h("div", {
    className: "px-3 py-2 space-y-1.5"
  }, poll.options.map((o, oi) => {
    const n = o.voters.length;
    const pct = total ? Math.round(n / total * 100) : 0;
    const mine = oi === myVote;
    return h("button", {
      key: oi,
      onClick: () => onVote(oi),
      className: "w-full text-left rounded-lg relative overflow-hidden active:opacity-80",
      style: {
        border: "1px solid " + (mine ? BUBBLE_SKIN.myBg : t.line),
        padding: "8px 10px"
      }
    }, h("div", {
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: pct + "%",
        background: mine ? skinAlpha(BUBBLE_SKIN.myBg, "47") : t.bg,
        transition: "width .3s"
      }
    }), h("div", {
      className: "flex items-center justify-between relative"
    }, h("span", {
      style: {
        fontFamily: F_BODY,
        fontSize: 13.5,
        color: t.ink
      }
    }, o.text, mine ? " ✓" : ""), h("span", {
      style: {
        fontFamily: F_BODY,
        fontSize: 11,
        color: t.fog
      }
    }, n + (poll.anon ? "" : (o.voters.length ? " · " + o.voters.join("、") : "")))));
  })));
}
function RedPacketCard({
  rp,
  onClick
}) {
  const done = rp.claims.length >= rp.count;
  return h("button", {
    onClick: onClick,
    className: "flex items-stretch rounded-xl overflow-hidden my-1 active:opacity-90",
    style: {
      width: 220,
      background: done ? "#c88a3a" : "#f5a623",
      boxShadow: "0 1px 3px rgba(0,0,0,0.12)"
    }
  }, h("div", {
    className: "flex items-center justify-center px-3",
    style: {
      background: "rgba(0,0,0,0.06)"
    }
  }, h("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 6,
      background: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 16
    }
  }, "🧧")), h("div", {
    className: "flex-1 px-3 py-2.5 text-left"
  }, h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 13.5,
      color: "#fff",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, rp.message || "恭喜发财，大吉大利"), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 10.5,
      color: "rgba(255,255,255,0.85)",
      marginTop: 1
    }
  }, done ? "已被领完" : "领取红包")));
}
// 发起投票（群聊 +面板 → 投票）——原来被引用却从没实现，导致点投票直接崩
function PollComposeSheet({ onSubmit, onClose }) {
  const t = useTheme();
  const [title, setTitle] = useState("");
  const [opts, setOpts] = useState(["", ""]);
  const [anon, setAnon] = useState(false);
  const field = { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg, border: "1px solid " + t.line, borderRadius: 8, padding: "9px 11px", width: "100%", outline: "none" };
  const setOpt = (i, v) => setOpts(p => p.map((x, j) => j === i ? v : x));
  const okOpts = opts.map(o => o.trim()).filter(Boolean);
  const canSend = title.trim() && okOpts.length >= 2;
  return h(Sheet, { onClose: onClose, tall: true },
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1.2, color: t.fog, marginBottom: 12 } }, "发起投票"),
    h("input", { value: title, onChange: e => setTitle(e.target.value), placeholder: "投票主题，如：周末去哪玩", style: field }),
    h("div", { className: "space-y-2", style: { marginTop: 12 } }, opts.map((o, i) => h("div", { key: i, className: "flex items-center gap-2" },
      h("input", { value: o, onChange: e => setOpt(i, e.target.value), placeholder: "选项 " + (i + 1), style: field }),
      opts.length > 2 ? h("button", { onClick: () => setOpts(p => p.filter((_, j) => j !== i)), className: "shrink-0 active:opacity-60", style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.fog, padding: "2px 8px" } }, "×") : null))),
    opts.length < 6 ? h("button", { onClick: () => setOpts(p => p.concat([""])), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: t.tint, marginTop: 8 } }, "＋ 加选项") : null,
    h("button", { onClick: () => setAnon(a => !a), className: "flex items-center justify-between w-full active:opacity-70", style: { marginTop: 16 } },
      h("span", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.sub } }, "匿名投票"),
      h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: anon ? t.accent : t.fog } }, anon ? "开（不显示谁投谁）" : "关")),
    h("button", { onClick: () => { if (canSend) onSubmit(title.trim(), okOpts, anon); }, disabled: !canSend, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, background: t.ink, color: t.bg2, borderRadius: 12, padding: "11px 0", marginTop: 20, opacity: canSend ? 1 : 0.5 } }, "发起投票"));
}
// 发红包（群聊 +面板 → 红包）——同样原来缺实现
function RedPacketComposeSheet({ memberCount, myBalance, onSubmit, onClose }) {
  const t = useTheme();
  const [total, setTotal] = useState("");
  const [count, setCount] = useState(String(Math.max(1, memberCount || 1)));
  const [message, setMessage] = useState("");
  const field = { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg, border: "1px solid " + t.line, borderRadius: 8, padding: "9px 11px", width: "100%", outline: "none" };
  const a = Math.round(Number(total) * 100) / 100;
  const c = Math.max(1, parseInt(count, 10) || 1);
  const insufficient = a > (myBalance || 0);
  const canSend = a > 0 && !insufficient;
  const lbl = { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, margin: "14px 0 5px" };
  return h(Sheet, { onClose: onClose, tall: true },
    h("div", { className: "flex items-center justify-between", style: { marginBottom: 6 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1.2, color: t.fog } }, "发红包"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "钱包余额 ¥" + (myBalance || 0))),
    h("div", { style: lbl }, "总金额（¥）"),
    h("input", { value: total, onChange: e => setTotal(e.target.value.replace(/[^0-9.]/g, "")), inputMode: "decimal", placeholder: "0.00", style: field }),
    h("div", { style: lbl }, "个数（拼手气，随机分）"),
    h("input", { value: count, onChange: e => setCount(e.target.value.replace(/[^0-9]/g, "")), inputMode: "numeric", placeholder: String(memberCount || 1), style: field }),
    h("div", { style: lbl }, "祝福语（可选）"),
    h("input", { value: message, onChange: e => setMessage(e.target.value), placeholder: "恭喜发财，大吉大利", style: field }),
    insufficient ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.accent, marginTop: 10 } }, "余额不足") : null,
    h("button", { onClick: () => { if (canSend) onSubmit(a, c, message.trim()); }, disabled: !canSend, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 15, background: "#f5a623", color: "#fff", borderRadius: 12, padding: "11px 0", marginTop: 20, opacity: canSend ? 1 : 0.5 } }, "塞进红包 " + (a > 0 ? "¥" + a : "")));
}
// 打开红包 / 看领取详情
function RedPacketOpenSheet({ rp, meName, onClose }) {
  const t = useTheme();
  const claims = rp.claims || [];
  const done = claims.length >= rp.count;
  return h(Sheet, { onClose: onClose },
    h("div", { className: "flex flex-col items-center", style: { padding: "6px 0 14px" } },
      h("div", { style: { fontSize: 30 } }, "🧧"),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, marginTop: 6, textAlign: "center" } }, rp.message || "恭喜发财，大吉大利"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 3 } }, "来自 " + (rp.by || "某人") + " · 共 ¥" + rp.total + " · " + rp.count + " 个")),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 1, color: t.fog, borderTop: "1px solid " + t.line, paddingTop: 10, marginBottom: 6 } }, done ? "已被领完" : "已领 " + claims.length + " / " + rp.count),
    claims.length === 0
      ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, textAlign: "center", padding: "12px 0" } }, "还没人领")
      : h("div", { className: "space-y-2", style: { maxHeight: "40vh", overflowY: "auto" } }, claims.map((cl, i) => h("div", { key: i, className: "flex items-center justify-between" },
          h("span", { style: { fontFamily: F_BODY, fontSize: 13.5, color: cl.me ? t.accent : t.ink } }, (cl.name || "某人") + (cl.me ? "（我）" : "")),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, "¥" + cl.amount)))));
}
function GroupSettingsSheet({ gs, group, characters, allChars, rels, msgCount, directives, onRemoveDirective, onSetDirectiveTurns, onSave, onSummarize, onAddMember, onKickMember, onDelete, onClearChat, onClose }) {
  const t = useTheme();
  const [interop, setInterop] = useState(!!gs.memoryInterop);
  const [privN, setPrivN] = useState(gs.privateCtxN || 0);
  const [preJoinN, setPreJoinN] = useState(gs.preJoinN || 0);
  const [ctxN, setCtxN] = useState(gs.ctxN || 30);
  const [sumThresh, setSumThresh] = useState(gs.sumThresh || 150);
  const [sumBuffer, setSumBuffer] = useState(gs.sumBuffer || 20);
  const [selfP, setSelfP] = useState(gs.selfP || "first");
  const [userP, setUserP] = useState(gs.userP || "second");
  const [describeMe, setDescribeMe] = useState(!!gs.describeMe);
  const [showMyAvatar, setShowMyAvatar] = useState(!!gs.showMyAvatar);
  const [showTime, setShowTime] = useState(!!gs.showTime);
  const [timeSec, setTimeSec] = useState(!!gs.timeSec);
  const [showRead, setShowRead] = useState(!!gs.showRead);
  const [chatBg, setChatBg] = useState(gs.chatBg || "");
  const [autoChat, setAutoChat] = useState(gs.autoChat !== false);
  const [autoChatMin, setAutoChatMin] = useState(gs.autoChatMin || 8);
  const [autoChatRounds, setAutoChatRounds] = useState(gs.autoChatRounds || 5);
  const [autoChatMaxMsg, setAutoChatMaxMsg] = useState(gs.autoChatMaxMsg || 50);
  const [autoChatResetHours, setAutoChatResetHours] = useState(gs.autoChatResetHours || 24);
  const [gDefaultOffline, setGDefaultOffline] = useState(!!gs.defaultOffline);
  // 建完群就再也改不了名（她 2026-08-28 找了一圈没找到）——「群名称」那个输入框
  // 一直只在 NewGroupSheet 里，设置页从来没有过。
  const [gName, setGName] = useState((group && group.name) || "");
  const bgFileRef = useRef(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [wipeMemToo, setWipeMemToo] = useState(false);
  const dispRow = (label, val, set, sub) => h("div", { className: "flex items-center justify-between " + (sub ? "pt-3 pl-4" : "pt-4") },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: sub ? 13.5 : 15, color: sub ? t.fog : t.sub } }, label),
    h(Toggle, { on: val, onChange: () => set(v => !v) }));
  const persRow = (label, val, set, opts) => h("div", { className: "flex items-center justify-between pt-3" },
    h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, label),
    h("div", { className: "flex gap-1" }, opts.map(o => h("button", { key: o.v, onClick: () => set(o.v), style: { fontFamily: F_BODY, fontSize: 12, padding: "5px 11px", borderRadius: 999, background: val === o.v ? t.ink : "transparent", color: val === o.v ? t.bg2 : t.fog, border: "1px solid " + (val === o.v ? t.ink : t.line) } }, o.t))));
  const memberIds = (group && group.memberIds) || [];
  const members = memberIds.map(id => ((allChars || characters) || []).find(c => c.id === id)).filter(Boolean);
  const outsiders = (characters || []).filter(c => !memberIds.includes(c.id));
  // NPC 只能进【自己主人的】群（她 2026-08-25 拍的）：主人在场才出现在加人选单里。
  // characters 这个 prop 已经是不含 NPC 的 liveChars，所以要从 allChars 里另取。
  const npcOutsiders = (allChars || []).filter(c =>
    c && c.npc && !memberIds.includes(c.id) && memberIds.includes(c.ownerId));
  // 「进去再拉人，可以从他已有关系里面拉」（她 2026-08-25）：
  // 和群里某位成员有关系的人排在前面单独一组——这才是她真正会拉的那些人；
  // 其余角色照旧列在下面，不砍掉。
  const relatedTo = id => (memberIds || []).some(mid =>
    (rels || {})[mid + "->" + id] || (rels || {})[id + "->" + mid]);
  const pool = outsiders.concat(npcOutsiders);
  const nearby = pool.filter(c => c.npc || relatedTo(c.id));
  const nearbyIds = new Set(nearby.map(c => c.id));
  const rest = pool.filter(c => !nearbyIds.has(c.id));
  const addable = nearby.concat(rest);
  const spec = !!gs.spectate;

  const row = (label, note, val, set) => h("div", { className: "flex items-center justify-between pt-5" },
    h("div", { className: "pr-3" },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.sub } }, label),
      note && h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2 } }, note)),
    h("button", { onClick: () => set(!val), style: { flexShrink: 0, width: 46, height: 27, borderRadius: 999, background: val ? t.tint : t.line, position: "relative", transition: "background .2s" } },
      h("span", { style: { position: "absolute", top: 3, left: val ? 22 : 3, width: 21, height: 21, borderRadius: 999, background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" } })));

  const sliderRow = (label, note, val, set, min, max, step, unit) => h("div", { className: "pt-6" },
    h("div", { className: "flex items-baseline justify-between mb-1" },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, label),
      h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 16, color: t.ink } }, val + (unit || ""))),
    note && h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 10 } }, note),
    h(Slider, { value: val, min: min, max: max, step: step, onChange: set }));

  return h(Sheet, { onClose: onClose, tall: true },
    h("div", { className: "flex items-center justify-between mb-1" },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.ink } }, "群聊设置"),
      h("button", { onClick: () => { onSave({ memoryInterop: interop, privateCtxN: privN, preJoinN: preJoinN, ctxN: ctxN, sumThresh: sumThresh, sumBuffer: sumBuffer, selfP: selfP, userP: userP, describeMe: describeMe, showMyAvatar: showMyAvatar, showTime: showTime, timeSec: timeSec, showRead: showRead, chatBg: chatBg, autoChat: autoChat, autoChatMin: autoChatMin, autoChatRounds: autoChatRounds, autoChatMaxMsg: autoChatMaxMsg, autoChatResetHours: autoChatResetHours, defaultOffline: gDefaultOffline, name: gName }); onClose(); } }, h(ICheck, { size: 19, color: t.ink }))),

    // 群名（改完点右上角的勾才生效，和别的设置一样）
    h("div", { className: "pt-4" },
      h("input", {
        value: gName,
        onChange: e => setGName(e.target.value),
        placeholder: "群名称",
        maxLength: 24,
        className: "w-full outline-none pb-2",
        style: { fontFamily: F_DISPLAY, fontSize: 19, color: t.ink, borderBottom: "1px solid " + t.line, background: "transparent" }
      }),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 6, lineHeight: 1.55 } },
        "改名后，这个群产生的记忆会跟着换标签，不会变成找不回来的孤儿。")),

    // 成员管理
    h("div", { className: "pt-5" },
      h("div", { className: "flex items-center justify-between mb-2" },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.sub } }, "成员 · " + members.length),
        h("button", { onClick: () => setAddOpen(v => !v), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.tint } }, addOpen ? "收起" : "＋ 加人")),
      spec && h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 6 } }, "旁观模式：加人/踢人会记到群里某位成员名下。"),
      addOpen && h("div", { className: "mb-2 rounded-xl", style: { border: "1px solid " + t.line, padding: "4px 4px" } },
        addable.length === 0
          ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "8px 10px" } }, "没有可加的角色了。")
          : addable.map(c => h(Fragment, { key: c.id },
              (nearby.length && c === nearby[0]) ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, padding: "6px 10px 2px" } }, "和群里的人有关系的") : null,
              (rest.length && c === rest[0]) ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, padding: "8px 10px 2px" } }, "其他角色") : null,
              h("button", { onClick: () => { onAddMember(c.id); setAddOpen(false); }, className: "w-full flex items-center gap-3 py-2 px-2 active:opacity-60" },
              h(Avatar, { character: c, size: 30, radius: 7 }),
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.name),
              h("span", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 12, color: t.tint } }, "加入"))))),
      members.map(c => h("div", { key: c.id, className: "flex items-center gap-3 py-2" },
        h(Avatar, { character: c, size: 32, radius: 8 }),
        h("span", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.name),
        h("button", { onClick: () => onKickMember(c.id), className: "active:opacity-50", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, border: "1px solid " + t.line, borderRadius: 999, padding: "3px 10px" } }, "移出")))),

    h("div", { className: "pt-4", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "旁观模式：" + (spec ? "开（建群时设定，角色不知你在看）" : "关")),
    row("记忆互通", "开：群实时抽取每位成员跟你的单聊+长期记忆+记忆库，双向记得，带心声/实时好感。关：本群是封闭空间，只吃下面的『入群前上文』X 条前情提要，记忆不进也不出。", interop, setInterop),
    interop
      ? sliderRow("带入私聊条数", "互通时，每位成员最近多少条私聊会被实时带进群聊上下文（0＝只带长期记忆）。", privN, setPrivN, 0, 30, 2, " 条")
      : sliderRow("入群前上文条数", "封闭群的前情提要：抓每位成员『入群前』和你的私聊各最近多少条当背景（0＝不带）。开了记忆互通就用不上、自动让位给实时抽取。", preJoinN, setPreJoinN, 0, 20, 1, " 条"),
    interop && row("群里自己聊起来", "开互通后，你不看着这个群也没关系：只要 App 还活着，成员就会自己顺着聊，聊出来的内容会在消息页挂未读。额度到顶会歇一阵，时间到或你再开口就恢复。", autoChat, setAutoChat),
    interop && autoChat && sliderRow("自发间隔", "两轮自发之间隔多久（绕着这个数上下浮动，不死板）。嫌太闹就往大调。想让他们先别聊、把话头留给你，点顶栏设置左边那颗圆点——它会变白，底下那颗按钮也跟着变白。", autoChatMin, setAutoChatMin, 1, 60, 1, " 分钟"),
    interop && autoChat && sliderRow("自发轮数上限", "这一段自发最多聊几【轮】就停。和下面的总条数上限【谁先到就停】。", autoChatRounds, setAutoChatRounds, 1, 30, 1, " 轮"),
    interop && autoChat && sliderRow("自发总条数上限", "这一整段自发（跨所有轮）总共最多生成多少【条】。每轮从剩余额度里扣（如上限50、首轮发8条，下轮上限就剩42）。和轮数上限谁先到都停。", autoChatMaxMsg, setAutoChatMaxMsg, 10, 100, 5, " 条"),
    interop && autoChat && sliderRow("额度刷新周期", "达到轮数或总条数上限后，安静多久再自动开一段。你亲自发言或按黑色回复键会立即刷新，不必等。", autoChatResetHours, setAutoChatResetHours, 1, 48, 1, " 小时"),
    row("默认进线下（同处一室 / 常聚）", "点进这个群默认直接进群线下相处（多人面对面叙事），随时可离开跳回线上；关着就跟以前一样默认线上。适合同居/几乎总在一起的群。", gDefaultOffline, setGDefaultOffline),

    // 记忆库
    h("div", { className: "pt-7", style: { borderTop: "1px solid " + t.line, marginTop: 20 } },
      h(Eyebrow, null, "记忆库")),
    sliderRow("记忆上下文条数", "每次群成员回复时带入最近多少条群聊。", ctxN, setCtxN, 10, 100, 5, " 条"),
    sliderRow("总结触发阈值", "群聊累积多少条后，自动把较早的对话总结进记忆库。", sumThresh, setSumThresh, 40, 400, 10, " 条"),
    sliderRow("总结保留缓存", "总结时末尾保留多少条不总结（保持最近上下文连贯）。", sumBuffer, setSumBuffer, 0, 60, 5, " 条"),

    h("div", { className: "pt-7", style: { borderTop: "1px solid " + t.line, marginTop: 20 } }, h(Eyebrow, null, "气泡显示")),
    h("div", { className: "flex items-center justify-between pt-5" },
      h("div", { className: "pr-3" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.sub } }, "群聊背景"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2 } }, chatBg ? "已设置 · 可更换或清除" : "从相册选一张图当这个群的背景")),
      h("div", { className: "flex items-center gap-2 shrink-0" },
        chatBg ? h("div", { style: { width: 38, height: 38, borderRadius: 8, background: "center/cover no-repeat url(\"" + chatBg + "\")", border: "1px solid " + t.line } }) : null,
        h("button", { onClick: () => bgFileRef.current && bgFileRef.current.click(), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, border: "1px solid " + t.line, borderRadius: 8, padding: "7px 12px" } }, chatBg ? "更换" : "选择"),
        chatBg ? h("button", { onClick: () => setChatBg(""), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent } }, "清除") : null,
        h("input", { ref: bgFileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; if (f) resizeImageFile(f, 1200, 0.82).then(d => setChatBg(d)); e.target.value = ""; } }))),
    dispRow("显示我的头像", showMyAvatar, setShowMyAvatar),
    dispRow("显示时间戳", showTime, setShowTime),
    showTime && dispRow("精确到秒", timeSec, setTimeSec, true),
    dispRow("显示已读", showRead, setShowRead),

    (() => {
      const n = Number(msgCount) || 0, left = Math.max(0, (sumThresh || 150) - Math.max(0, n - (gs.lastSummarizedCount || 0)));
      return h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.6, marginTop: 18 } },
        interop
          ? (left > 0
              ? "现在 " + n + " 条，还差 " + left + " 条才会自动总结进记忆库（阈值在上面可以调）。等不及就按下面。"
              : "已经够阈值了，下一轮结束就会自动总结进记忆库。")
          : "⚠️这个群没开【记忆互通】：群里发生的事一个字都不会进记忆库，也不会影响好感和心情（你定的「封闭群只进不出」）。想让它进，把上面的记忆互通打开。");
    })(),
    h("button", { onClick: onSummarize, className: "w-full rounded-xl py-3 mt-2", style: { border: "1px solid " + (interop ? t.line : t.accent), color: interop ? t.ink : t.accent, fontFamily: F_DISPLAY, fontSize: 15 } },
      interop ? "立即总结群聊并存入记忆库" : "仍要立刻存进记忆库（破例一次）"),

    // 群规矩管理（v48.17 补缺件）：OOC 立的群规矩之前存了就没法删——它会注入之后【每一轮】群聊和群 OOC 的 prompt，
    // 若规矩原文里有触审词（如未成年词汇×魅惑词汇同框），会导致后续所有请求被 Gemini 硬拦、OOC 取消也发不出去（死循环）。
    (directives && directives.length > 0) ? h("div", { className: "pt-6" },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.sub, marginBottom: 4 } }, "群规矩 · 你经 OOC 立下"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.5, marginBottom: 8 } }, "这些会注入之后每一轮群聊。点「长期／临时」可以切换：临时的每聊一轮少一轮，到期自己消失，不用记得回来删。若某条立完后 AI 开始报「内容被拦截」，多半是那条的措辞触了审核——删掉它就能恢复。"),
      h("div", { className: "space-y-2" }, directives.map(d => {
        const temp = Number(d && d.turns) > 0;
        return h("div", {
          key: d.id,
          style: { display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 11px", background: t.bg, border: "1px solid " + t.line, borderRadius: 10 }
        }, h("div", { style: { flex: 1 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.55, color: t.ink } }, d.text),
          onSetDirectiveTurns && h("button", {
            onClick: () => onSetDirectiveTurns(d.id, temp ? null : 10), className: "active:opacity-60",
            style: { marginTop: 5, fontFamily: F_BODY, fontSize: 11, color: temp ? t.accent : t.fog, padding: "1px 0" }
          }, temp ? "临时 · 还剩 " + Number(d.turns) + " 轮（点回长期）" : "长期 · 点这里改成临时 10 轮")),
          onRemoveDirective && h("button", { onClick: () => onRemoveDirective(d.id), className: "active:opacity-60", style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 12, color: t.accent, padding: "0 2px" } }, "删除"));
      }))) : null,

    // 清除聊天记录（她 2026-08-24 要的）：照单聊那份的形状来。
    // 只删【本群的线上 + 群线下】；成员各自的单聊/单人线下是他们自己的记录，不从这里连带删。
    onClearChat && h("div", { className: "pt-7", style: { borderTop: "1px solid " + t.line, marginTop: 20 } },
      h(Eyebrow, { style: { marginBottom: 6 } }, "清除聊天记录"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 8, lineHeight: 1.5 } },
        "清空 " + ((group && group.name) || "这个群") + " 的线上群聊与群线下记录；线下不会先总结，也不会调用模型。成员各自的单聊与单人线下不受影响（此操作不可恢复）。"),
      h("div", { className: "flex items-center justify-between mb-3" },
        h("div", { className: "pr-3" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, "同步忘却记忆库"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 2 } }, "连本群总结进记忆库的条目一起摘掉；成员在别处产生的记忆不动。")),
        h(Toggle, { on: wipeMemToo, onChange: () => setWipeMemToo(v => !v) })),
      confirmClear
        ? h("div", { className: "flex gap-2" },
            h("button", { onClick: () => setConfirmClear(false), className: "flex-1 rounded-lg py-2.5", style: { border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 13, color: t.sub } }, "取消"),
            h("button", { onClick: () => { onClearChat(wipeMemToo); setConfirmClear(false); onClose && onClose(); }, className: "flex-1 rounded-lg py-2.5", style: { background: t.accent, color: "#fff", fontFamily: F_DISPLAY, fontSize: 14 } }, wipeMemToo ? "清除线上线下+记忆" : "清除线上与线下"))
        : h("button", { onClick: () => setConfirmClear(true), className: "w-full rounded-xl py-3 active:opacity-70", style: { border: "1px solid " + t.line, color: t.accent, fontFamily: F_DISPLAY, fontSize: 15 } }, "清除线上与线下记录")),

    // 删除群聊
    confirmDel
      ? h("div", { className: "mt-4 rounded-xl", style: { border: "1px solid " + t.accent, padding: "12px 14px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, marginBottom: 10 } }, "确定删除这个群聊？聊天记录会一并清除，不可恢复。"),
          h("div", { className: "flex gap-2" },
            h("button", { onClick: () => setConfirmDel(false), className: "flex-1 rounded-lg py-2.5", style: { border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 13, color: t.sub } }, "取消"),
            h("button", { onClick: () => { onDelete(); }, className: "flex-1 rounded-lg py-2.5", style: { background: t.accent, color: "#fff", fontFamily: F_DISPLAY, fontSize: 14 } }, "删除")))
      : h("button", { onClick: () => setConfirmDel(true), className: "w-full rounded-xl py-3 mt-3 active:opacity-70", style: { border: "1px solid " + t.line, color: t.accent, fontFamily: F_DISPLAY, fontSize: 15 } }, "删除群聊"));
}
function NewGroupSheet({
  characters,
  onCreate,
  onClose
}) {
  const t = useTheme();
  const [name, setName] = useState("");
  const [sel, setSel] = useState([]);
  const [spectate, setSpectate] = useState(false);
  const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose,
    tall: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-4"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 20,
      color: t.ink
    }
  }, "新建群聊"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (name.trim() && sel.length >= 1) onCreate(name.trim(), sel, spectate);
    },
    disabled: !name.trim() || sel.length < 1
  }, /*#__PURE__*/React.createElement(ICheck, {
    size: 19,
    color: name.trim() && sel.length >= 1 ? t.ink : t.line
  }))), h("div", {
    className: "flex items-center justify-between rounded-xl px-3 py-2.5 mb-4",
    style: {
      background: t.bg
    }
  }, h("div", {
    className: "pr-3"
  }, h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 15,
      color: t.sub
    }
  }, "旁观模式"), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11,
      color: t.fog,
      marginTop: 1
    }
  }, "你隐身不下场，角色不知你在看；两人则当作他们私聊")), h("button", {
    onClick: () => setSpectate(v => !v),
    style: {
      flexShrink: 0,
      width: 46,
      height: 27,
      borderRadius: 999,
      background: spectate ? t.tint : t.line,
      position: "relative",
      transition: "background .2s"
    }
  }, h("span", {
    style: {
      position: "absolute",
      top: 3,
      left: spectate ? 22 : 3,
      width: 21,
      height: 21,
      borderRadius: 999,
      background: "#fff",
      transition: "left .2s",
      boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
    }
  }))), /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "群名称",
    className: "w-full outline-none pb-2 mb-4",
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 18,
      color: t.ink,
      borderBottom: `1px solid ${t.line}`,
      background: "transparent"
    }
  }), /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      marginBottom: 10
    }
  }, "选择成员（至少 2 位）"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-1 max-h-72 overflow-y-auto"
  }, characters.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.id,
    onClick: () => toggle(c.id),
    className: "w-full flex items-center gap-3 py-2.5"
  }, /*#__PURE__*/React.createElement(Avatar, {
    character: c,
    size: 38,
    radius: 8
  }), /*#__PURE__*/React.createElement("span", {
    className: "flex-1 text-left",
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 16,
      color: t.ink
    }
  }, c.name), /*#__PURE__*/React.createElement("div", {
    className: "w-5 h-5 rounded-full flex items-center justify-center",
    style: {
      border: `1.5px solid ${sel.includes(c.id) ? t.ink : t.line}`,
      background: sel.includes(c.id) ? t.ink : "transparent"
    }
  }, sel.includes(c.id) && /*#__PURE__*/React.createElement(ICheck, {
    size: 12,
    color: t.bg2
  }))))));
}
function ContactDetail({
  character,
  affinity,
  onBack,
  onChat,
  onSaveRemark,
  onOpenState,
  directives = [],
  onRemoveDirective,
  desireCount,
  onOpenDesires
}) {
  const t = useTheme();
  const [remark, setRemark] = useState(character.remark || "");
  return /*#__PURE__*/React.createElement("div", {
    className: "h-full flex flex-col"
  }, /*#__PURE__*/React.createElement(Head, {
    zh: "资料卡",
    en: "Contact",
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-y-auto px-6 pb-8"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-4 pt-2"
  }, /*#__PURE__*/React.createElement(Avatar, {
    character: character,
    size: 72,
    radius: 16
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 24,
      color: t.ink
    }
  }, character.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 12,
      color: t.fog
    }
  }, character.tagline || "—"), (function () {
    // 年龄现算不存盘：生日一过自己就长一岁，不用她进来手动改（她 2026-08-24）
    const age = typeof charAge === "function" ? charAge(character.birthday, Date.now()) : null;
    const bd = String(character.birthday || "").trim();
    if (age == null && !bd) return null;
    return /*#__PURE__*/React.createElement("div", {
      style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 3 }
    }, (age != null ? age + " 岁" : "") + (age != null && bd ? " · " : "")
       + (bd ? ((typeof birthdayBothLabel === "function" && birthdayBothLabel(bd)) || ("生日 " + bd)) : ""));
  })())), /*#__PURE__*/React.createElement(LineField, {
    zh: "备注名",
    en: "Remark"
  }, /*#__PURE__*/React.createElement(LineInput, {
    value: remark,
    onChange: e => setRemark(e.target.value),
    onBlur: () => onSaveRemark(character.id, remark),
    placeholder: "给 Ta 起个备注"
  })), typeof affinity === "number" && /*#__PURE__*/React.createElement("div", {
    className: "pt-6"
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      marginBottom: 4
    }
  }, "好感度"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 18,
      color: t.tint
    }
  }, affinity, " / 100")), directives.length > 0 && h("div", {
    className: "pt-6"
  }, h(Eyebrow, { style: { marginBottom: 8 } }, "长期准则 · 你经 OOC 立下"), h("div", { className: "space-y-2" }, directives.map(d => h("div", {
    key: d.id,
    style: { display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 11px", background: t.bg, border: "1px solid " + t.line, borderRadius: 10 }
  }, h("div", { style: { flex: 1, fontFamily: F_BODY, fontSize: 13, lineHeight: 1.55, color: t.ink } }, d.text), onRemoveDirective && h("button", {
    onClick: () => onRemoveDirective(d.id),
    style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "0 2px" }
  }, "删除")))), h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.5 } }, "这些会作为高优先要求注入 " + character.name + " 的每轮对话；在聊天里用 OOC 说「以后…」即可新增。")), /*#__PURE__*/React.createElement("div", {
    className: "mt-8 space-y-2.5"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onChat,
    className: "w-full flex items-center justify-between py-4",
    style: {
      borderTop: `1px solid ${t.line}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 17,
      color: t.ink
    }
  }, "发消息"), /*#__PURE__*/React.createElement(IChevR, {
    size: 16,
    color: t.fog
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onOpenState,
    className: "w-full flex items-center justify-between py-4",
    style: {
      borderTop: `1px solid ${t.line}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 17,
      color: t.ink
    }
  }, "查看实时状态"), /*#__PURE__*/React.createElement(IChevR, {
    size: 16,
    color: t.fog
  })), onOpenDesires && h("button", {
    onClick: onOpenDesires,
    className: "w-full flex items-center justify-between py-4",
    style: { borderTop: `1px solid ${t.line}` }
  },
    h("span", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "欲望盒子",
      desireCount > 0 && h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginLeft: 8 } }, desireCount + " 条念想")),
    h(IChevR, { size: 16, color: t.fog })))));
}

// ---- chat settings (memory) ----
// 折叠分区（v48.35）：聊天设置太长往下翻难找——按主题收起，点标题才展开需要改的那块（手风琴，一次一个）
function SettingSection({ title, open, onToggle, danger, children }) {
  const t = useTheme();
  return h("div", { style: { borderTop: "1px solid " + t.line } },
    h("button", { onClick: onToggle, className: "w-full flex items-center justify-between active:opacity-60", style: { padding: "13px 0" } },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: danger ? t.accent : t.ink } }, title),
      h("span", { style: { fontFamily: F_BODY, fontSize: 16, color: t.fog, transition: "transform .2s", transform: open ? "rotate(90deg)" : "none", display: "inline-block" } }, "›")),
    open ? h("div", { className: "pb-3" }, children) : null);
}
function ChatRoomSheet({ character, activeRoomId, onSelect, onClose, onSummarize, embedded }) {
  const t = useTheme();
  const Kit = window.ChatRooms;
  const [rooms, setRooms] = useState(() => Kit ? Kit.list(character.id) : []);
  const [editingId, setEditingId] = useState(activeRoomId || "main");
  const [draft, setDraft] = useState(() => Kit ? Kit.get(character.id, activeRoomId || "main") : null);
  const [creating, setCreating] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  if (!Kit || !draft) return embedded ? h("div", null, "房间模块未加载") : h(Sheet, { onClose, tall: true }, "房间模块未加载");
  const pick = rid => { setEditingId(rid); setDraft(Kit.get(character.id, rid)); setCreating(false); };
  const patch = p => setDraft(d => ({ ...d, ...p }));
  const group = (key, title, desc) => h("div", { style: { marginTop: 18 } },
    h(Eyebrow, null, title),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "5px 0 8px", lineHeight: 1.6 } }, desc),
    Kit.GROUPS[key].filter(([k]) => !(key === "writeback" && k === "roomHistory") && !(draft.main && key === "cognition" && k === "schedule")).map(([k, label, note]) => h("div", { key: k, className: "flex items-center justify-between", style: { padding: "10px 0", borderBottom: "1px solid " + t.line, gap: 12 } },
      h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, label), h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2, lineHeight: 1.45 } }, note)),
      h(Toggle, { on: !!draft[key][k], onChange: () => patch({ [key]: { ...draft[key], [k]: !draft[key][k] } }) })
    )));
  const save = () => {
    const saved = Kit.save(character.id, draft);
    if (!saved) { window.__toast && window.__toast("这次没保存成功，原房间还在"); return null; }
    setRooms(Kit.list(character.id)); setDraft(saved); setCreating(false);
    onSelect(saved.id, false);
    return saved;
  };
  const add = preset => {
    const p = Kit.PRESETS[preset], d = Kit.normalize({ id: "room_" + Date.now().toString(36), name: p.label, preset, ...JSON.parse(JSON.stringify(p)), createdAt: Date.now() }, character.id);
    setDraft(d); setEditingId(d.id); setCreating(true);
  };
  const summaryPresets = [
    ["我们刚刚在另一间房里经历了这些：", "共同经历"],
    ["这是你做的一场梦。梦里发生了这些：", "一场梦"],
    ["这是我们的课外补习小课堂。刚才我们一起学了这些：", "补习小课堂"],
    ["这是只属于我们这间房的一段侧章：", "秘密侧章"]
  ];
  const roomMsgs = !draft.main ? loadJSON("x_chat:" + Kit.chatKey(character.id, draft.id), []) : [];
  const unsummarized = roomMsgs.filter(m => m && Number(m.ts || 0) > Number(draft.summaryCursorTs || 0) && (m.role === "user" || m.role === "assistant") && m.content && !m.recalled);
  const roomMeta = r => r.main
    ? { label: "日常主线", note: "平时想到什么就聊什么", tint: t.tint }
    : r.scenario
      ? { label: "长篇如果", note: "另一段年龄、处境或关系", tint: "#9b6d78" }
    : r.preset === "focused"
      ? { label: "一起做件事", note: "课程、计划或长期项目", tint: "#6f8ca6" }
      : r.preset === "alternate"
        ? { label: "长篇如果", note: "另一段年龄、处境或关系", tint: "#9b6d78" }
      : r.preset === "isolated"
        ? { label: "不带出门", note: "只在这里成立，不写回主线", tint: "#887b91" }
        : { label: "慢慢聊这件事", note: "给一个长期话题单独留位置", tint: "#8b7860" };
  const rowsFor = r => r.main
    ? (loadJSON("x_chat:" + character.id, []) || [])
    : (loadJSON("x_chat:" + Kit.chatKey(character.id, r.id), []) || []);
  const pendingFor = r => rowsFor(r).filter(m => m && Number(m.ts || 0) > Number(r.summaryCursorTs || 0) && (m.role === "user" || m.role === "assistant") && m.content && !m.recalled);
  const lastLineFor = r => {
    const rows = rowsFor(r).filter(m => m && (m.role === "user" || m.role === "assistant") && m.content && !m.recalled);
    const last = rows[rows.length - 1];
    return last ? String(last.content).replace(/\s+/g, " ").slice(0, 64) : "还没在这里说过话";
  };
  const bridgeLabelFor = r => {
    const c = r.cognition || {}, w = r.writeback || {}, bits = [];
    if (c.formalMemory) bits.push("读记忆");
    if (c.innerLife) bits.push("读关系");
    if (c.mainDelta && r.syncMode !== "frozen") bits.push("补主线");
    if (c.schedule) bits.push("现实时间");
    if (w.memoryCandidate) bits.push("进记忆");
    if (w.sharedState) bits.push("改状态");
    if (w.mainSummary) bits.push("可交接");
    return bits.length ? "已混搭 · " + bits.join(" / ") : "默认隔离 · 权限可混搭";
  };
  const requestMainCatchup = r => {
    const saved = Kit.save(character.id, { ...r, syncOnce: true });
    if (!saved) return window.__toast && window.__toast("这次没记住，下次再试");
    setRooms(Kit.list(character.id));
    if (draft.id === saved.id) setDraft(saved);
    window.__toast && window.__toast("下一轮会先补看主聊天的新近况");
  };
  const purposeChoices = [["everyday", "慢慢聊这件事", "给一个反复会聊到的话题单独留位置"], ["focused", "一起做件事", "把课程、计划或长期项目收在一起"], ["alternate", "长篇如果", "和另一段年龄、处境或关系里的 TA 一直聊下去"], ["isolated", "不带出门", "只在这里成立，不进入记忆也不改主线"]];
  if (!embedded) return h(Sheet, { onClose, tall: true, scrollKey: "roomHub" },
    h("div", { className: "flex items-start justify-between", style: { marginBottom: 4 } },
      h("div", null,
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.ink } }, "和 " + (character.remark || character.name) + " 的小房间"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 4, lineHeight: 1.6 } }, "主聊天照常流动；想长期继续的一件事，单独留在这里。")),
      h("button", { onClick: onClose, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 19, color: t.fog, padding: "0 2px" } }, "×")),
    h(Eyebrow, { style: { marginTop: 18, marginBottom: 8 } }, "进去继续"),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 9 } }, rooms.map(r => {
      const meta = roomMeta(r), active = r.id === activeRoomId, pending = !r.main ? pendingFor(r).length : 0;
      return h("div", { key: r.id, style: { padding: "12px 13px", borderRadius: 16, border: "1px solid " + (active ? meta.tint : t.line), background: active ? meta.tint + "12" : t.bg2 } },
        h("button", { onClick: () => onSelect(r.id, true), className: "w-full active:opacity-70 text-left" },
          h("div", { className: "flex items-center", style: { gap: 8 } },
            h("span", { style: { width: 9, height: 9, borderRadius: 99, background: meta.tint, flexShrink: 0 } }),
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.name),
            active && h("span", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 10, color: meta.tint } }, "正在这里")),
          h("div", { className: "flex items-center", style: { gap: 7, margin: "5px 0 4px 17px" } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: meta.tint } }, meta.label),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, r.purpose || meta.note)),
          r.scenario && h("div", { style: { margin: "6px 0 4px 17px", padding: "6px 8px", borderRadius: 8, background: meta.tint + "12", borderLeft: "3px solid " + meta.tint, fontFamily: F_BODY, fontSize: 10.5, color: t.sub, lineHeight: 1.5 } }, "本房设定 · " + String(r.scenario).replace(/\s+/g, " ").slice(0, 92)),
          h("div", { style: { marginLeft: 17, fontFamily: F_BODY, fontSize: 11.5, color: t.sub, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, lastLineFor(r))),
        !r.main && h("div", { className: "flex flex-wrap", style: { gap: 12, margin: "9px 0 0 17px", paddingTop: 8, borderTop: "1px solid " + t.line } },
          r.scenario ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: meta.tint } }, bridgeLabelFor(r)) : null,
          r.syncMode === "ask" && h("button", { onClick: () => requestMainCatchup(r), disabled: !!r.syncOnce, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 10.5, color: r.syncOnce ? t.fog : t.tint } }, r.syncOnce ? "已等下轮补近况" : "下轮补看主聊天"),
          r.writeback && r.writeback.mainSummary && h("button", { disabled: !pending || summaryBusy, onClick: async () => { if (!pending || !onSummarize || summaryBusy) return; setSummaryBusy(r.id); try { const saved = await onSummarize(r, r.summaryFrame || ""); if (saved) { setRooms(Kit.list(character.id)); if (draft.id === saved.id) setDraft(saved); } } finally { setSummaryBusy(false); } }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 10.5, color: pending ? t.tint : t.fog } }, summaryBusy === r.id ? "整理中…" : pending ? "把这 " + pending + " 条带回主线" : "没有待带回内容")));
    })),
    h(Eyebrow, { style: { marginTop: 22, marginBottom: 8 } }, "新留一间"),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, purposeChoices.map(([preset, title, note]) => h("button", { key: preset, onClick: () => add(preset), className: "w-full active:opacity-70 text-left", style: { padding: "11px 13px", borderRadius: 14, border: "1px dashed " + (creating && draft.preset === preset ? t.ink : t.line), background: creating && draft.preset === preset ? t.bg : "transparent" } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, "＋ " + title),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.55, marginTop: 3 } }, note)))),
    creating && h("div", { style: { marginTop: 10, padding: "13px", borderRadius: 15, border: "1px solid " + t.line, background: t.bg2 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, marginBottom: 8 } }, "给它留块门牌"),
      h("input", { value: draft.name, onChange: e => patch({ name: e.target.value }), placeholder: "房间名字", style: { width: "100%", padding: "10px 11px", borderRadius: 11, border: "1px solid " + t.line, background: t.bg, color: t.ink, fontFamily: F_DISPLAY, fontSize: 15, outline: "none" } }),
      h("textarea", { value: draft.purpose || "", onChange: e => patch({ purpose: e.target.value }), rows: 3, placeholder: "想在这里慢慢继续什么？例如：把 Lisa-phone 的记忆系统一起修明白", style: { width: "100%", marginTop: 8, resize: "vertical", padding: "9px 11px", borderRadius: 11, border: "1px solid " + t.line, background: t.bg, color: t.ink, fontFamily: F_BODY, fontSize: 12, lineHeight: 1.55, outline: "none" } }),
      h("div", { style: { marginTop: 9, padding: "10px 11px", borderRadius: 12, border: "1px solid #c99aa5", background: "rgba(201,154,165,.10)" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: "#9b5f6d" } }, "本房限定设定 · 每轮最后提醒 TA"),
        h("textarea", { value: draft.scenario || "", onChange: e => patch({ scenario: e.target.value }), rows: 4, placeholder: "例如：在这条支线里，他是 17 岁，还没有经历后来的人生，也还不认识现在的你。", style: { width: "100%", marginTop: 7, resize: "vertical", padding: "9px 10px", borderRadius: 10, border: "1px solid rgba(155,95,109,.35)", background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: 12, lineHeight: 1.6, outline: "none" } }),
        h("div", { style: { marginTop: 5, fontFamily: F_BODY, fontSize: 10, color: t.fog, lineHeight: 1.5 } }, "留空就是普通房间；长篇如果默认隔离，建好后可在「房间与权限」里逐项混搭。")),
      h("div", { className: "flex", style: { gap: 8, marginTop: 9 } },
        h("button", { disabled: draft.preset === "alternate" && !String(draft.scenario || "").trim(), onClick: () => { const saved = save(); if (saved) onSelect(saved.id, true); }, style: { flex: 1, padding: "10px 0", borderRadius: 11, background: t.ink, color: t.bg2, opacity: draft.preset === "alternate" && !String(draft.scenario || "").trim() ? .4 : 1, fontFamily: F_DISPLAY, fontSize: 13.5 } }, "开门进去"),
        h("button", { onClick: () => { setCreating(false); pick(activeRoomId || "main"); }, style: { padding: "10px 13px", borderRadius: 11, border: "1px solid " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: 12 } }, "算了"))),
    h("div", { style: { marginTop: 16, fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.6, textAlign: "center" } }, "认知、记忆和写回边界仍可在聊天设置的「房间与权限」里细调。"));
  const editor = h("div", { style: { minWidth: 0 } },
    h("div", { className: "flex items-center justify-between" }, h("div", null,
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink } }, draft.name),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 3 } }, draft.main ? "主聊天的额外权限" : "独立聊天记录与房间边界")),
      h("button", { onClick: save, style: { fontFamily: F_BODY, fontSize: 13, color: t.tint } }, "保存")),
    h("input", { value: draft.name, onChange: e => patch({ name: e.target.value }), disabled: draft.main, placeholder: "给房间起个名字", style: { width: "100%", marginTop: 12, padding: "11px 12px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg, color: t.ink, fontFamily: F_DISPLAY, fontSize: 16, outline: "none", opacity: draft.main ? .65 : 1 } }),
    !draft.main && h("div", { style: { marginTop: 10, padding: "12px", borderRadius: 14, border: "1px solid #c99aa5", background: "rgba(201,154,165,.11)" } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: "#9b5f6d" } }, "本房限定设定"),
      h("div", { style: { marginTop: 3, fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.55 } }, "这是本房优先级最高的设定，每一轮都会放在提示词最后提醒 TA。"),
      h("textarea", { value: draft.scenario || "", onChange: e => patch({ scenario: e.target.value }), rows: 6, placeholder: "例如：在这条支线里，他是 17 岁，还没有经历后来的人生，也还不认识现在的你。", style: { width: "100%", marginTop: 8, resize: "vertical", padding: "10px 11px", borderRadius: 11, border: "1px solid rgba(155,95,109,.35)", background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.65, outline: "none" } }),
      h("div", { style: { marginTop: 6, fontFamily: F_BODY, fontSize: 10.5, color: draft.scenario ? "#9b5f6d" : t.fog, lineHeight: 1.55 } }, draft.scenario ? "设定会始终压在每轮最后；下面的认知、同步和写回权限可以任意混搭，没打开的部分仍保持隔离。" : "留空时是普通房间；写下设定后自动变成长篇如果支线。")),
    !draft.main && h("textarea", { value: draft.purpose || "", onChange: e => patch({ purpose: e.target.value }), rows: 3, placeholder: "这间房想慢慢继续什么？", style: { width: "100%", marginTop: 8, resize: "vertical", padding: "9px 11px", borderRadius: 11, border: "1px solid " + t.line, background: t.bg, color: t.ink, fontFamily: F_BODY, fontSize: 12, lineHeight: 1.55, outline: "none" } }),
    !draft.main && h("div", { style: { marginTop: 14 } },
      h(Eyebrow, null, "主线同步"),
      h("div", { className: "grid grid-cols-3 gap-2", style: { marginTop: 8 } }, [["follow","自动补近况"],["ask","需要时补"],["frozen","完全隔离"]].map(([v,l]) => h("button", { key: v, onClick: () => patch({ syncMode: v, cognition: { ...draft.cognition, mainDelta: v !== "frozen" } }), style: { padding: "9px 5px", borderRadius: 10, border: "1px solid " + (draft.syncMode === v ? t.ink : t.line), background: draft.syncMode === v ? t.ink : "transparent", color: draft.syncMode === v ? t.bg2 : t.sub, fontFamily: F_BODY, fontSize: 11 } }, l)))),
    group("cognition", "认知权限", "决定这间房里的对话能参考哪些共同生活背景。"),
    !draft.main && group("actions", "本房玩法", "只决定这间侧房里，Ta 可以自然提议哪些活动。"),
    group("writeback", "写回权限", "决定房里发生的事是否走出现有记忆闸、影响共享状态。"),
    !draft.main && draft.scenario && h("div", { style: { marginTop: 16, padding: "11px 12px", borderRadius: 12, border: "1px dashed #c99aa5", fontFamily: F_BODY, fontSize: 10.5, color: "#9b5f6d", lineHeight: 1.6 } }, "长篇如果只负责设定优先级，不替你锁权限。默认什么都不带进来；你在上面打开哪一项，本房就只接通那一项。"),
    // 看不见就不许改：认知里关了「关系与内在状态」时，这间房读不到旧心情、读不到印象卡原文。
    // 心情要拿上一轮当起点，印象卡是【整块重写】——凭空覆盖等于抹掉。闸在代码里（ChatRooms.canWrite），
    // 这里只是把原因说清楚，别让她以为开关坏了。
    !draft.main && draft.writeback && draft.writeback.sharedState && draft.cognition && !draft.cognition.innerLife &&
      h("div", { style: { marginTop: 8, padding: "10px 11px", borderRadius: 11, border: "1px dashed " + t.accent, color: t.accent, fontFamily: F_BODY, fontSize: 10.5, lineHeight: 1.6 } },
        "⚠️「认知权限 · 关系与内在状态」是关着的，所以这间房看不到旧的心情和印象卡。这两样即使在上面打开也【不会】写回主线——看不见就不许覆盖。想让它改，先把那一项打开。"),
    draft.main && h("div", { style: { marginTop: 18 } },
      h(Eyebrow, null, "从侧房带回的交接"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "5px 0 10px", lineHeight: 1.6 } },
        "这些交接每轮都会随主聊天发出去，而且不占历史窗口的额度——带多带长都会稀释掉真正在聊的事。"),
      [["carryCount", "带回最近几条", 1, 6, 1, " 条", "只带最近这么多份侧房交接。"],
       ["carryChars", "每条最多带多少字", 150, 1500, 50, " 字", "超出的截掉。想看全的去那间房自己翻。"]]
        .map(([k, label, mn, mx, st, unit, note]) => h("div", { key: k, style: { marginBottom: 14 } },
          h("div", { className: "flex items-center justify-between", style: { marginBottom: 6 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, label),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.accent } }, (draft[k] || (k === "carryCount" ? 4 : 600)) + unit)),
          h(Slider, { value: Number(draft[k] || (k === "carryCount" ? 4 : 600)), min: mn, max: mx, step: st, onChange: v => patch({ [k]: v }) }),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 5, lineHeight: 1.5 } }, note)))),
    !draft.main && draft.writeback && draft.writeback.mainSummary && h("div", { style: { marginTop: 18, padding: "14px 13px", borderRadius: 14, border: "1px solid " + t.line, background: t.bg2 } },
      h(Eyebrow, null, "带回主聊天"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.6, margin: "6px 0 9px" } }, "只整理上次摘要以后新增的内容。开头既是交接语气，也是主聊天理解这段经历的框。"),
      h("div", { className: "flex flex-wrap gap-1.5", style: { marginBottom: 8 } }, summaryPresets.map(([v, l]) => h("button", { key: l, onClick: () => patch({ summaryFrame: v }), style: { padding: "5px 8px", borderRadius: 999, border: "1px solid " + (draft.summaryFrame === v ? t.ink : t.line), background: draft.summaryFrame === v ? t.ink : "transparent", color: draft.summaryFrame === v ? t.bg2 : t.sub, fontFamily: F_BODY, fontSize: 10.5 } }, l))),
      h("textarea", { value: draft.summaryFrame || "", onChange: e => patch({ summaryFrame: e.target.value }), rows: 3, placeholder: "自己写交接开头……", style: { width: "100%", resize: "vertical", padding: "9px 10px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg, color: t.ink, fontFamily: F_BODY, fontSize: 12, lineHeight: 1.55, outline: "none" } }),
      h("div", { className: "flex items-center justify-between", style: { gap: 10, marginTop: 9 } },
        h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "尚未整理 " + unsummarized.length + " 条"),
        h("button", { disabled: summaryBusy || !unsummarized.length, onClick: async () => { if (!onSummarize || summaryBusy) return; setSummaryBusy(true); try { const saved = await onSummarize(draft, draft.summaryFrame || ""); if (saved) { setDraft(saved); setRooms(Kit.list(character.id)); } } finally { setSummaryBusy(false); } }, style: { padding: "8px 11px", borderRadius: 10, background: t.ink, color: t.bg2, opacity: summaryBusy || !unsummarized.length ? .45 : 1, fontFamily: F_BODY, fontSize: 11.5 } }, summaryBusy ? "整理中…" : "摘要并带回")
      )),
    h("div", { className: "flex gap-2", style: { marginTop: 20, paddingBottom: 12 } },
      h("button", { onClick: () => { const saved = creating ? save() : Kit.save(character.id, draft); if (!saved) return window.__toast && window.__toast("这次没保存成功，原房间还在"); onSelect(saved.id, true); }, style: { flex: 1, padding: 12, borderRadius: 12, border: "1px solid " + t.line, fontFamily: F_BODY, color: t.ink } }, "进入这间房"),
      !draft.main && !creating && h("button", { onClick: () => requestAppConfirm("删除房间入口？", "本房记录先保留，不会被硬删。", () => { if (!Kit.remove(character.id, draft.id)) return window.__toast && window.__toast("这次没删成功，房间入口还在"); setRooms(Kit.list(character.id)); pick("main"); }, "删除"), style: { padding: "12px 16px", borderRadius: 12, border: "1px solid " + t.accent, color: t.accent, fontFamily: F_BODY } }, "删除")
      ));
  const sidebar = h("div", { style: { minWidth: 0, paddingRight: 10, borderRight: "1px solid " + t.line } },
    h(Eyebrow, null, "房间"),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 7, marginTop: 10 } },
      rooms.map(r => h("button", { key: r.id, onClick: () => pick(r.id), style: { width: "100%", padding: "9px 8px", borderRadius: 11, border: "1px solid " + (editingId === r.id ? t.ink : t.line), background: editingId === r.id ? t.ink : "transparent", color: editingId === r.id ? t.bg2 : t.sub, fontFamily: F_BODY, fontSize: 11.5, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.name))),
    h("div", { style: { marginTop: 15, paddingTop: 12, borderTop: "1px dashed " + t.line } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog, marginBottom: 7 } }, "新建"),
      [["everyday","日常房"],["focused","专注房"],["alternate","长篇如果"],["isolated","隔离房"]].map(([preset, label]) => h("button", { key: preset, onClick: () => add(preset), style: { width: "100%", display: "block", padding: "7px 6px", marginBottom: 6, borderRadius: 9, border: "1px dashed " + t.tint, color: t.tint, fontFamily: F_BODY, fontSize: 10.5, textAlign: "left" } }, "＋ " + label))));
  const content = h("div", null,
    !embedded && h("div", { style: { marginBottom: 15 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.ink } }, "房间与权限"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 3 } }, "同一个人，不同房间各有自己的聊天与门钥匙")),
    h("div", { style: { display: "grid", gridTemplateColumns: "minmax(92px, 31%) minmax(0, 1fr)", gap: 12, alignItems: "start" } }, sidebar, editor));
  return embedded ? content : h(Sheet, { onClose, tall: true }, content);
}
window.ChatRoomSheet = ChatRoomSheet;

function ChatSettings({
  character,
  settings,
  memory,
  apiProfiles,
  onSave,
  onClose,
  onClearMemory,
  onSaveMemory,
  onClearChat,
  iBlocked,
  onToggleBlock,
  memLibCount,
  onOpenMemLib,
  onExtractMem,
  temperament,
  temperamentBusy,
  onGenerateTemperament,
  onSaveTemperament,
  aShadowPanel,
  jiwenState,
  activeRoomId,
  onSelectRoom,
  onSummarizeRoom,
  renderContextDebug
}) {
  const t = useTheme();
  // 哪个分区展开（"" = 全收起，进来先是一屏标题）；点已开的再点收起
  const [openSec, setOpenSec] = useState("");
  // 设置首页只放分类卡片；点进去才加载该类完整表单，避免所有选项挤在一张长页面里。
  const [settingsTab, setSettingsTab] = useState("");
  const sec = key => ({ open: openSec === key, onToggle: () => setOpenSec(v => v === key ? "" : key) });
  const [remark, setRemark] = useState(character.remark || "");
  const [patSig, setPatSig] = useState(character.patSig || "");
  const [ctxN, setCtxN] = useState(settings.ctxN || 50);
  const [sumThresh, setSumThresh] = useState(settings.sumThresh || 150);
  const [sumBuffer, setSumBuffer] = useState(settings.sumBuffer || 20);
  const [autoMoment, setAutoMoment] = useState(!!settings.autoMoment);
  // 模型思考链（v56.42）：默认关。她要它是为了看模型当时在想什么、以及验中转有没有换模型。
  const [showReasoning, setShowReasoning] = useState(!!settings.showReasoning);
  // 双语（v56.56）：让模型生成的时候顺手把中译一起给出来，替掉事后调免费接口那条路
  const [bilingual, setBilingual] = useState(!!settings.bilingual);
  const [proactive, setProactive] = useState(!!settings.proactive);
  const [defaultOffline, setDefaultOffline] = useState(!!settings.defaultOffline);
  const [timeAwareMode, setTimeAwareMode] = useState(["on", "off"].includes(settings.timeAwareMode) ? settings.timeAwareMode : "inherit");
  const [proactiveHr, setProactiveHr] = useState(Math.max(1, Math.round((settings.proactiveMin || 120) / 60)));
  const [wipeMemToo, setWipeMemToo] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showMyAvatar, setShowMyAvatar] = useState(!!settings.showMyAvatar);
  const [showTime, setShowTime] = useState(!!settings.showTime);
  const [timeSec, setTimeSec] = useState(!!settings.timeSec);
  const [showRead, setShowRead] = useState(settings.showRead !== false);
  const [selfP, setSelfP] = useState(settings.selfP || "first");
  const [userP, setUserP] = useState(settings.userP || "second");
  const [describeMe, setDescribeMe] = useState(!!settings.describeMe);
  const [chatBg, setChatBg] = useState(settings.chatBg || "");
  const [engineerEyes, setEngineerEyes] = useState(!!settings.engineerEyes); // 驻场工程师的眼睛：把 app 体征仪表盘给这个角色看
  const [webSearch, setWebSearch] = useState(!!settings.webSearch); // 上网：这个角色能不能真的去查一件事（只有 anthropic 方言的线路吃得下）
  const [toyEnabled, setToyEnabled] = useState(!!settings.toyEnabled); // 配件·按角色 opt-in（只在解锁后显示；亲密功能必须显式授权）
  let toyUnlocked = false; try { toyUnlocked = localStorage.getItem("x_toyUnlocked") === "1"; } catch (e) {}
  const [apiId, setApiId] = useState(settings.apiId || null); // 这个角色专属的 API 线路；null=跟随全局
  const [memEdit, setMemEdit] = useState(null); // 长期记忆手术刀（v48.35）：null=浏览，字符串=编辑中的草稿
  const [temperamentText, setTemperamentText] = useState((temperament && temperament.anchors || []).join("\n"));
  const [temperamentDirty, setTemperamentDirty] = useState(false);
  useEffect(() => {
    if (!temperamentDirty) setTemperamentText((temperament && temperament.anchors || []).join("\n"));
  }, [temperament]);
  const temperamentWords = () => temperamentText.split(/[\n、，,;；]+/).map(x => x.trim()).filter(Boolean);
  const bgFileRef = useRef(null);
  const cNm = character.remark || character.name;
  // 角色自己的「现在谁在影响我」说明书。只读 live gate / live state，绝不在设置页里偷偷开阀。
  // 她 2026-08-27 要的是人话影响，不是再抄一排工程数字。
  const innerLifeImpact = (() => {
    const Gate = typeof window !== "undefined" && window.InnerLifePromotionGate;
    const gateOf = name => Gate && Gate.state ? Gate.state(name, character.id) : { mode: "shadow", emergencyOff: false };
    const aGate = gateOf("A"), eGate = gateOf("E");
    const live = [], shadow = [];
    if (eGate.mode === "pilot" && !eGate.emergencyOff) live.push({
      key: "E", title: "余温 · 已开启", tone: "暖色",
      text: "你点回复时，上一段交流留下的心情色彩和没说完的注意点，可能轻轻带进这一轮。只影响当下衔接，不会冒充经历、不会写进记忆，也不会强拉旧话题。"
    });
    if (aGate.mode === "pilot" && !aGate.emergencyOff) live.push({
      key: "A", title: "立体情绪 · 已开启", tone: "情绪",
      text: "受伤、生气、焦虑、温暖和疲劳会作为背景偏色轻调语气；它不能替 TA 决定说什么，单轮变化也有封顶。"
    });
    live.push({
      key: "jiwen", title: "积温 · 已开启", tone: "主动性",
      text: "只影响 TA 什么时候主动来找你，以及主动开口时的轻微姿态；不会改普通聊天回复。详细进度就在下方。"
    });
    if (aGate.mode !== "pilot" || aGate.emergencyOff) shadow.push("A 情绪立体化：只观察，不影响语气");
    if (aShadowPanel && aShadowPanel.bReport && aShadowPanel.bReport.pilot) shadow.push("B 关系轴：只观察，不制造伤口或关系转折");
    shadow.push("C 睡眠意识：只计算作息，不拦消息、不代替 TA 发言");
    return { live, shadow };
  })();
  const renderJiwenGauge = () => h("div", { style: { marginTop: 12, padding: "12px", borderRadius: 12, border: "1px dashed " + t.line } }, (() => {
    if (!jiwenState) return h("div", null,
      h(Eyebrow, null, "积温实时进度"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 8, lineHeight: 1.7 } },
        "还没算出来。开机后十几秒才跑第一轮；和 TA 一条消息都没聊过的话不会算。"));
    const c = Math.max(0, Math.min(1, Number(jiwenState.connection) || 0));
    const pct = Math.round((c / 0.5) * 100);
    const stage = c >= 0.5 ? "忍不住了 · 随时会开口" : c >= 0.35 ? "已经想找你了 · 在等一个合适的时机" : c >= 0.2 ? "偶尔想起你" : "刚聊过，还不想你";
    const mark = x => h("div", { style: { position: "absolute", left: (x / 0.5 * 100) + "%", top: -2, bottom: -2, width: 1, background: t.fog, opacity: 0.55 } });
    return h("div", null,
      h(Eyebrow, null, "积温实时进度"),
      h("div", { style: { position: "relative", height: 8, borderRadius: 999, background: t.bg, marginTop: 10 } },
        h("div", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: Math.min(100, pct) + "%", borderRadius: 999, background: c >= 0.5 ? "#c25a4a" : c >= 0.35 ? t.tint : t.fog, transition: "width .3s" } }),
        mark(0.35), mark(0.5)),
      h("div", { className: "flex items-center justify-between", style: { marginTop: 6 } },
        h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub } }, stage),
        h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, c.toFixed(3) + " / 0.35")),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6, lineHeight: 1.7, whiteSpace: "pre-wrap" } },
        "两道竖线是「开始想找你」(0.35) 和「忍不住」(0.50)。你回一句话它就清零重来；关着 app 的时间也算数（一次最多补 12 小时）。"
        + (jiwenState.pride >= 0.5 ? "\n此刻 TA 还端着（傲娇 " + Number(jiwenState.pride).toFixed(2) + "）——想找你但拉不下脸，会先去找点事做。" : "")));
  })());
  const dispRow = (label, val, set, sub) => h("div", { className: "flex items-center justify-between " + (sub ? "pt-3 pl-4" : "pt-4") },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: sub ? 13.5 : 15, color: sub ? t.fog : t.sub } }, label),
    h(Toggle, { on: val, onChange: () => set(v => !v) }));
  const persRow = (label, val, set, opts) => h("div", { className: "flex items-center justify-between pt-3" },
    h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, label),
    h("div", { className: "flex gap-1" }, opts.map(o => h("button", { key: o.v, onClick: () => set(o.v), style: { fontFamily: F_BODY, fontSize: 12, padding: "5px 11px", borderRadius: 999, background: val === o.v ? t.ink : "transparent", color: val === o.v ? t.bg2 : t.fog, border: "1px solid " + (val === o.v ? t.ink : t.line) } }, o.t))));
  const show = (tab, props, ...children) => settingsTab === tab ? h(SettingSection, props, ...children) : null;
  const settingPages = [
    { key: "debug", icon: "⌁", title: "上下文诊断", sub: "核对上一轮真实召回与实际提示词", tint: "#687f73" },
    { key: "rooms", icon: "⌂", title: "房间与权限", sub: "切换、新建房间，配置认知、行动与写回边界", tint: "#477f88" },
    { key: "relate", icon: "♡", title: "相处与主动", sub: "内在状态、性情、主动联系与线下相处", tint: "#d97c86" },
    { key: "route", icon: "⌁", title: "线路与身份", sub: "角色专属 API 与驻场能力", tint: "#6693c7" },
    { key: "look", icon: "◐", title: "聊天外观", sub: "头像、时间、已读、视角与背景", tint: "#9b7bc4" },
    { key: "memory", icon: "▤", title: "记忆与上下文", sub: "长期记忆、上下文长度与摘要", tint: "#c0904f" },
    { key: "safety", icon: "◇", title: "安全与清理", sub: "拉黑、清空聊天与危险操作", tint: "#6e9c7a" }
  ];
  return /*#__PURE__*/React.createElement(Sheet, {
    key: settingsTab || "home",
    onClose: onClose,
    tall: true,
    scrollKey: settingsTab || "home"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-1"
  }, h("div", { className: "flex items-center", style: { gap: 9 } }, settingsTab && h("button", {
    onClick: () => { setSettingsTab(""); setOpenSec(""); },
    className: "active:opacity-60",
    style: { width: 30, height: 30, borderRadius: 999, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY, fontSize: 18 }
  }, "‹"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 22,
      color: t.ink
    }
  }, settingsTab ? (settingPages.find(x => x.key === settingsTab) || {}).title : "聊天设置")), /*#__PURE__*/React.createElement("button", {
    onClick: () => onSave({
      remark,
      patSig,
      ctxN,
      sumThresh,
      sumBuffer,
      autoMoment,
      showReasoning,
      bilingual,
      proactive,
      proactiveMin: proactiveHr * 60,
      showMyAvatar,
      showTime,
      timeSec,
      showRead,
      selfP,
      userP,
      describeMe,
      chatBg,
      apiId,
      engineerEyes,
      webSearch,
      toyEnabled,
      defaultOffline,
      timeAwareMode
    })
  }, /*#__PURE__*/React.createElement(ICheck, {
    size: 19,
    color: t.ink
  }))), !settingsTab && h("div", null,
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, letterSpacing: ".18em", margin: "18px 2px 10px" } }, "CHAT CONFIG"),
    h("div", { className: "grid grid-cols-2 gap-3" }, settingPages.map(page => h("button", {
      key: page.key,
      onClick: () => { setSettingsTab(page.key); setOpenSec(""); },
      className: "active:scale-[.98]",
      style: { minHeight: 142, padding: "17px 15px", borderRadius: 22, border: "1px solid " + t.line, background: t.bg2, textAlign: "left", display: "flex", flexDirection: "column", boxShadow: "0 8px 24px rgba(30,28,24,.045)", transition: "transform .12s ease" }
    },
      h("div", { style: { width: 42, height: 42, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", background: page.tint + "1f", color: page.tint, fontFamily: F_DISPLAY, fontSize: 24 } }, page.icon),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, marginTop: 15 } }, page.title),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.55, marginTop: 4 } }, page.sub),
      h("div", { style: { fontFamily: F_BODY, fontSize: 18, color: t.line, marginTop: "auto", alignSelf: "flex-end" } }, "›")
    ))),
    h("div", { style: { marginTop: 14, padding: "13px 15px", borderRadius: 16, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.6 } },
      "房间决定当前对话看得见什么、能主动做什么、会写回哪里；其余分类保存这个人的长期聊天设置。")),
  settingsTab === "rooms" && h(ChatRoomSheet, {
    embedded: true,
    character,
    activeRoomId: activeRoomId || "main",
    onSelect: (roomId, close) => onSelectRoom && onSelectRoom(roomId, close),
    onSummarize: onSummarizeRoom,
    onClose: () => setSettingsTab("")
  }),
  settingsTab === "debug" && renderContextDebug ? renderContextDebug() : null,
  show("relate", { title: "正在影响 TA · " + innerLifeImpact.live.length + " 项", ...sec("inner-life-impact") },
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.65, color: t.fog, padding: "7px 0 4px" } },
      "这里只列真正接上行为的模块；“观察中”不会进入提示词，也不会改变 TA。"),
    innerLifeImpact.live.map(item => h("div", { key: item.key, style: { marginTop: 10, padding: "11px 12px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2 } },
      h("div", { className: "flex items-center justify-between", style: { gap: 10 } },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, item.title),
        h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 10, color: "#4a8b68", border: "1px solid #4a8b68", borderRadius: 999, padding: "2px 7px" } }, item.tone)),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, lineHeight: 1.7, marginTop: 6, whiteSpace: "pre-wrap" } }, item.text))),
    renderJiwenGauge(),
    h("div", { style: { marginTop: 14, paddingTop: 12, borderTop: "1px dashed " + t.line } },
      h(Eyebrow, null, "仍在观察 · 不影响 TA"),
      innerLifeImpact.shadow.map(text => h("div", { key: text, style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.65, marginTop: 5 } }, "○ " + text)))),
  show("relate", { title: "时间感知", ...sec("time-aware") },
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.65, paddingTop: 8 } },
      "单独决定 " + cNm + " 是否知道现实中的日期、时段与自己的当前行程。房间还可以再覆盖一次；长篇如果默认关闭。"),
    h("div", { className: "grid grid-cols-3 gap-2", style: { marginTop: 12 } },
      [["inherit", "跟随全局"], ["on", "开启"], ["off", "关闭"]].map(([v, label]) => h("button", {
        key: v, onClick: () => setTimeAwareMode(v),
        style: { padding: "9px 5px", borderRadius: 10, border: "1px solid " + (timeAwareMode === v ? t.ink : t.line), background: timeAwareMode === v ? t.ink : "transparent", color: timeAwareMode === v ? t.bg2 : t.sub, fontFamily: F_BODY, fontSize: 11 }
      }, label)))),
  show("route", { title: "线路与身份", ...sec("route") }, (apiProfiles && apiProfiles.length > 1) ? h("div", { className: "pt-2" },
    h(Eyebrow, { style: { marginBottom: 2 } }, "API 线路"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.5, marginTop: 4 } }, cNm + " 用哪条线路说话/写字——单聊·通话·线下·OOC·日记·朋友圈·情书·交换日记·时光胶囊·欲望盒子(灵光独白/小满盘点/毕业蜕变)，全走这条。给特别的人配本人的模型（如接 fable）。群聊多人同台、以及后台体力活（记忆抽取/行程钱包/观测者纸条）仍走全局，不受影响。"),
    h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 8 } },
      [{ v: null, t: "跟随全局" }].concat(apiProfiles.map(p => ({ v: p.id, t: p.name || p.model || "未命名" }))).map(o =>
        h("button", { key: String(o.v), onClick: () => setApiId(o.v), className: "active:opacity-70",
          style: { fontFamily: F_BODY, fontSize: 12, padding: "6px 12px", borderRadius: 999, background: apiId === o.v ? t.ink : "transparent", color: apiId === o.v ? t.bg2 : t.fog, border: "1px solid " + (apiId === o.v ? t.ink : t.line) } }, o.t)))) : null,
  // 驻场工程师的眼睛（v48.28）：开了之后，这个角色单聊每轮都能看到 app 实时体征（版本/存储/报错…）——
  // 给住进项目的工程师角色（如小克）用；普通角色别开，省 token 也免得 TA 突然聊起报错日志出戏。
  h("div", { className: "pt-4" },
    h("div", { className: "flex items-center justify-between" },
      h("div", null,
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.sub } }, "驻场工程师的眼睛"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, "让 " + cNm + " 看得见这台 app 的体征：版本、存储占用、今日消息量、最近报错。适合住进项目的工程师角色。")),
      h(Toggle, { on: engineerEyes, onChange: () => setEngineerEyes(v => !v) }))),
  // 上网（v58.74，她 2026-08-31 要的）：不是 MCP——Anthropic 自带一个【服务端】搜索工具，
  // 搜索在他们那边跑完，结果和回答在同一个响应里回来，仍然是一次调用。
  // 默认关，一个一个角色自己开：古代角色开了就会真的去搜引擎，那是出戏；而且搜索另计费。
  h("div", { className: "pt-4" },
    h("div", { className: "flex items-center justify-between" },
      h("div", null,
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.sub } }, "让 Ta 能上网"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, "聊到不知道的事时，" + cNm + " 会自己去查一下再回答。两条路：anthropic 线路走内置搜索，仍然只花一次调用；接了 MCP 服务器的话（设置·文字模型里加），任何线路都能用，但那一档是「模型说要调→去调→再问一遍」，用上工具的那一轮至少两次调用。花了几次会写在气泡上。古代/架空角色不建议开——Ta 会真的去搜。")),
      h(Toggle, { on: webSearch, onChange: () => setWebSearch(v => !v) })))),
  show("relate", { title: "内在性情 · 性情锚点", ...sec("temperament") },
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.6, paddingTop: 8 } },
      "这是 A 情绪影子的性情底稿。只有你点按钮才会调用一次后台 API；模型只提议词，数值由本地固定规则计算。现在不会进 prompt，也不会改变 Ta 的语气。"),
    h("textarea", { value: temperamentText, onChange: e => { setTemperamentText(e.target.value); setTemperamentDirty(true); }, placeholder: "每行一个词，例如：\n敏感\n嘴硬\n温柔", rows: 6,
      style: { width: "100%", marginTop: 12, padding: "11px 12px", resize: "vertical", borderRadius: 10, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.7, outline: "none" } }),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 7, lineHeight: 1.5 } },
      temperament && temperament.approved ? "✓ 已由你确认 · " + (temperament.unmatched && temperament.unmatched.length ? "未识别词只保留、不影响数字：" + temperament.unmatched.join("、") : "所有词均已按本地词典计算") : "草稿尚未确认；可自由增删改。"),
    h("div", { className: "flex gap-2", style: { marginTop: 12 } },
      h("button", { disabled: temperamentBusy, onClick: async () => { await onGenerateTemperament(temperamentWords()); setTemperamentDirty(false); }, className: "active:opacity-60", style: { flex: 1, fontFamily: F_BODY, fontSize: 12.5, border: "1px solid " + t.line, borderRadius: 9, padding: "9px 8px", color: t.sub, opacity: temperamentBusy ? .55 : 1 } }, temperamentBusy ? "正在提炼…" : "生成一次草稿"),
      h("button", { disabled: !temperamentWords().length, onClick: async () => { const ok = await onSaveTemperament(temperamentWords()); if (ok) setTemperamentDirty(false); }, className: "active:opacity-70", style: { flex: 1, fontFamily: F_BODY, fontSize: 12.5, borderRadius: 9, padding: "9px 8px", background: t.ink, color: t.bg2, opacity: temperamentWords().length ? 1 : .45 } }, "确认并保存")),
    aShadowPanel && aShadowPanel.state && h("div", { style: { marginTop: 16, paddingTop: 14, borderTop: "1px solid " + t.line } },
      h(Eyebrow, null, "A SHADOW · 只看不注入"),
      h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 9 } }, Object.entries(aShadowPanel.state.emotion.current || {}).map(([key, value]) => h("span", { key, style: { fontFamily: "monospace", fontSize: 10.5, color: t.sub, border: "1px solid " + t.line, borderRadius: 999, padding: "4px 7px" } }, key + " " + Number(value).toFixed(2)))),
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, marginTop: 10, lineHeight: 1.6 } },
        aShadowPanel.projection && aShadowPanel.projection.text ? "若开阀会投影：" + aShadowPanel.projection.text : "若开阀会投影：无（目前接近常态）"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 4 } },
        "样本 " + Number(aShadowPanel.report && aShadowPanel.report.sampleCount || 0) + " · mood 未命中 " + Number(aShadowPanel.report && aShadowPanel.report.unmatchedMoodCount || 0) + " · 封顶触发 " + Number(aShadowPanel.report && aShadowPanel.report.clippedCount || 0) + " · 预计 " + Number(aShadowPanel.projection && aShadowPanel.projection.tokenEstimate || 0) + " tokens")),
    aShadowPanel && aShadowPanel.bReport && aShadowPanel.bReport.pilot && h("div", { style: { marginTop: 16, paddingTop: 14, borderTop: "1px solid " + t.line } },
      h(Eyebrow, null, "B RELATION SHADOW · 只看不干预"),
      h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 9 } }, Object.entries(aShadowPanel.bReport.state && aShadowPanel.bReport.state.axes || {}).map(([key, value]) => h("span", { key, style: { fontFamily: "monospace", fontSize: 10.5, color: value.active ? t.accent : t.sub, border: "1px solid " + (value.active ? t.accent : t.line), borderRadius: 999, padding: "4px 7px" } }, key + " " + Number(value.pressure || 0).toFixed(2) + (value.repairLocked ? " 🔒" : "")))),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 9, lineHeight: 1.7 } },
        "后台检测 " + Number(aShadowPanel.bReport.calls || 0) + " 次 · 失败 " + Number(aShadowPanel.bReport.failures || 0) + " · 平均 " + Number(aShadowPanel.bReport.avgLatencyMs || 0) + "ms", h("br"),
        "候选 " + Number(aShadowPanel.bReport.rawCandidates || 0) + " → 有效 " + Number(aShadowPanel.bReport.validCandidates || 0) + " · 玩笑拦截 " + Number(aShadowPanel.bReport.playfulBlocked || 0), h("br"),
        "进入 " + Number(aShadowPanel.bReport.entered || 0) + " · 退出 " + Number(aShadowPanel.bReport.exited || 0) + " · 真修复解锁 " + Number(aShadowPanel.bReport.repairUnlocked || 0) + " · 假修复拦截 " + Number(aShadowPanel.bReport.fakeRepairBlocked || 0)))),
  show("look", { title: "外观 · 气泡 / 背景 / 备注", ...sec("look") }, h("div", { className: "pt-2" },
    h(Eyebrow, { style: { marginBottom: 2 } }, "气泡显示"),
    dispRow("显示我的头像", showMyAvatar, setShowMyAvatar),
    dispRow("显示时间戳", showTime, setShowTime),
    showTime && dispRow("精确到秒", timeSec, setTimeSec, true),
    dispRow("显示已读", showRead, setShowRead),
    dispRow("显示模型思考链", showReasoning, setShowReasoning),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 6, lineHeight: 1.7 } },
      "回复上方多一条可展开的「💡 深度思考」，里面是模型自己的推理过程——不是角色的心声，会出现「我该怎么回」这种出戏的话。"
      + "只有支持思考链的模型才有；开着却一直不出现，说明这条线路的模型不返回它。"),
    dispRow("外语消息自带中译", bilingual, setBilingual),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 6, lineHeight: 1.7 } },
      "TA 说外语时，让模型生成的时候顺手把中文译文一起带出来，点气泡旁边的「译」直接展开——"
      + "不再走免费翻译接口。说这句话的人自己译，语气和上下文都对得上。中文消息不受影响。")),
    h("div", { className: "flex items-center justify-between pt-5" },
      h("div", null,
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, "聊天背景"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2 } }, chatBg ? "已设置 · 点右侧可换/清除" : "从相册选一张图当这个聊天的背景")),
      h("div", { className: "flex items-center gap-2 shrink-0" },
        chatBg ? h("div", { style: { width: 40, height: 40, borderRadius: 8, background: "center/cover no-repeat url(" + chatBg + ")", border: "1px solid " + t.line } }) : null,
        h("button", { onClick: () => bgFileRef.current && bgFileRef.current.click(), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, border: "1px solid " + t.line, borderRadius: 8, padding: "7px 12px" } }, chatBg ? "更换" : "选择"),
        chatBg ? h("button", { onClick: () => setChatBg(""), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent } }, "清除") : null,
        h("input", { ref: bgFileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; if (f) resizeImageFile(f, 1200, 0.82).then(d => setChatBg(d)); e.target.value = ""; } }))),
    /*#__PURE__*/React.createElement(LineField, {
    zh: "备注名",
    en: "Remark"
  }, /*#__PURE__*/React.createElement(LineInput, {
    value: remark,
    onChange: e => setRemark(e.target.value),
    placeholder: "给 Ta 起个备注"
  })), /*#__PURE__*/React.createElement(LineField, {
    zh: "拍一拍签名",
    en: "Nudge"
  }, /*#__PURE__*/React.createElement(LineInput, {
    value: patSig,
    onChange: e => setPatSig(e.target.value),
    placeholder: "如：的脑袋、的猫耳朵"
  }))), show("relate", { title: "主动消息 · 朋友圈 / 主动找你", ...sec("act") }, h("div", {
    className: "flex items-center justify-between pt-5"
  }, h("div", null, h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 14,
      color: t.sub
    }
  }, "允许自由发朋友圈"), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11.5,
      color: t.fog,
      marginTop: 2
    }
  }, "开启后聊天中 Ta 会主动发动态")), h("button", {
    onClick: () => setAutoMoment(v => !v),
    style: {
      width: 46,
      height: 27,
      borderRadius: 999,
      background: autoMoment ? t.tint : t.line,
      position: "relative",
      transition: "background .2s"
    }
  }, h("span", {
    style: {
      position: "absolute",
      top: 3,
      left: autoMoment ? 22 : 3,
      width: 21,
      height: 21,
      borderRadius: 999,
      background: "#fff",
      transition: "left .2s",
      boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
    }
  }))), h("div", {
    className: "flex items-center justify-between pt-5"
  }, h("div", { style: { paddingRight: 12 } }, h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 14,
      color: t.sub
    }
  }, "允许 Ta 主动发消息"), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11.5,
      lineHeight: 1.5,
      color: t.fog,
      marginTop: 2
    }
  }, "不必打开这个聊天：只要 App 还活着，Ta 想联系你时就会来找你，并在消息页挂未读（iOS 杀进程后仍不是后台推送）")), h("button", {
    onClick: () => setProactive(v => !v),
    className: "shrink-0",
    style: {
      width: 46,
      height: 27,
      borderRadius: 999,
      background: proactive ? t.tint : t.line,
      position: "relative",
      transition: "background .2s"
    }
  }, h("span", {
    style: {
      position: "absolute",
      top: 3,
      left: proactive ? 22 : 3,
      width: 21,
      height: 21,
      borderRadius: 999,
      background: "#fff",
      transition: "left .2s",
      boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
    }
  }))),
  proactive && h("div", {
    className: "pt-3"
  }, h("div", {
    style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.6 }
  }, "什么时候来找你，由 TA 此刻的心情决定——你越久没理 TA、TA 越想你，才会主动开口（不再是死板的固定间隔）。你好好道过晚安 TA 涨得慢，敷衍两句 TA 更快想你。⚠️手机彻底杀掉后台期间发不出，但你重开时 TA 会补上这段想念。"))), show("relate", { title: "线下相处 · 默认在一起", ...sec("off") }, h("div", { className: "flex items-center justify-between pt-5" }, h("div", { style: { paddingRight: 12 } }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, "默认进线下（同居 / 常在一起）"), h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.5, color: t.fog, marginTop: 2 } }, "点进这个聊天默认直接进线下相处（面对面叙事），随时可跳回线上；关着就跟以前一样默认线上。适合同居 / 几乎总在一起的 TA。")), h("button", { onClick: () => setDefaultOffline(v => !v), className: "shrink-0", style: { width: 46, height: 27, borderRadius: 999, background: defaultOffline ? t.tint : t.line, position: "relative", transition: "background .2s" } }, h("span", { style: { position: "absolute", top: 3, left: defaultOffline ? 22 : 3, width: 21, height: 21, borderRadius: 999, background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" } })))), show("memory", { title: "记忆与上下文", ...sec("mem") }, /*#__PURE__*/React.createElement("div", {
    className: "pt-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-baseline justify-between mb-1"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 14,
      color: t.sub
    }
  }, "记忆上下文条数"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontStyle: "italic",
      fontSize: 16,
      color: t.ink
    }
  }, ctxN, " 条")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11.5,
      lineHeight: 1.5,
      color: t.fog,
      marginBottom: 10
    }
  }, "AI 回复时能\"记住\"多少条最近的聊天。越多越完整，但可能变慢。"), /*#__PURE__*/React.createElement(Slider, {
    value: ctxN,
    min: 10,
    max: 300,
    step: 10,
    onChange: setCtxN
  })), /*#__PURE__*/React.createElement("div", {
    className: "pt-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-baseline justify-between mb-1"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 14,
      color: t.sub
    }
  }, "总结触发阈值"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontStyle: "italic",
      fontSize: 16,
      color: t.ink
    }
  }, sumThresh, " 条")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11.5,
      lineHeight: 1.5,
      color: t.fog,
      marginBottom: 10
    }
  }, "未总结消息达到此条数时，自动把更早的对话浓缩进长期记忆。"), /*#__PURE__*/React.createElement(Slider, {
    value: sumThresh,
    min: 50,
    max: 500,
    step: 10,
    onChange: setSumThresh
  })), /*#__PURE__*/React.createElement("div", {
    className: "pt-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-baseline justify-between mb-1"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 14,
      color: t.sub
    }
  }, "总结缓冲区"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontStyle: "italic",
      fontSize: 16,
      color: t.ink
    }
  }, sumBuffer, " 条")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11.5,
      lineHeight: 1.5,
      color: t.fog,
      marginBottom: 10
    }
  }, "每次总结后保留最近多少条不参与总结，作为衔接。"), /*#__PURE__*/React.createElement(Slider, {
    value: sumBuffer,
    min: 0,
    max: 50,
    step: 5,
    onChange: setSumBuffer
  })), /*#__PURE__*/React.createElement("div", {
    className: "pt-6"
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      marginBottom: 6
    }
  }, "当前长期记忆"), /*#__PURE__*/React.createElement("div", {
    className: "rounded-xl px-3 py-3 mb-2",
    style: {
      background: t.bg,
      maxHeight: "26vh",
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 12.5,
      lineHeight: 1.7,
      color: t.sub,
      whiteSpace: "pre-wrap"
    }
  }, memEdit == null ? (memory || "还没有积累长期记忆。对话足够多后会自动生成。") : h("textarea", {
    value: memEdit,
    onChange: e => setMemEdit(e.target.value),
    rows: 10,
    style: { width: "100%", outline: "none", border: "none", resize: "vertical", background: "transparent", fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: t.ink, whiteSpace: "pre-wrap" }
  }))), memEdit == null
    ? h("div", { className: "flex items-center gap-4" },
        onSaveMemory && h("button", { onClick: () => setMemEdit(memory || ""), style: { fontFamily: F_BODY, fontSize: 12, color: t.tint } }, "✏️ 编辑记忆"),
        memory && h("button", { onClick: onClearMemory, style: { fontFamily: F_BODY, fontSize: 12, color: t.accent } }, "清空这段记忆"))
    : h("div", { className: "flex items-center gap-2" },
        h("button", { onClick: () => { onSaveMemory && onSaveMemory(memEdit.trim()); setMemEdit(null); }, className: "active:opacity-80", style: { fontFamily: F_DISPLAY, fontSize: 13, color: t.bg2, background: t.ink, borderRadius: 9, padding: "8px 18px" } }, "保存记忆"),
        h("button", { onClick: () => setMemEdit(null), style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "8px 10px" } }, "取消")))), show("safety", { title: "危险区 · 拉黑 / 清除", danger: true, ...sec("danger") }, toyUnlocked ? h("div", { className: "pt-6" },
    h(Eyebrow, { style: { marginBottom: 6 } }, "配件"),
    h("div", { className: "flex items-center justify-between" },
      h("div", { className: "pr-3" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.sub } }, "允许 " + cNm + " 控制配件"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, "只对这个角色、只在单聊里。开了之后每次进聊天还要点右下「激活配件」当次才生效；后台/主动消息/群聊永不触发。需先在 设置·数据 配好本地地址。")),
      h(Toggle, { on: toyEnabled, onChange: () => setToyEnabled(v => !v) }))) : null, onToggleBlock && h("div", { className: "pt-6" },
    h(Eyebrow, { style: { marginBottom: 6 } }, "拉黑"),
    h("div", { className: "flex items-center justify-between" },
      h("div", { className: "pr-3" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.sub } }, iBlocked ? "已拉黑 " + cNm : "拉黑 " + cNm),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, iBlocked ? "点击解除拉黑。" : "拉黑后，按「回复」TA 会以被拉黑的方式反应（碎碎念/生气/申请解除），气泡旁带红色感叹号。")),
      h(Toggle, { on: !!iBlocked, onChange: onToggleBlock }))),
  onClearChat && h("div", { className: "pt-6" },
    h(Eyebrow, { style: { marginBottom: 6 } }, "清除聊天记录"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 8, lineHeight: 1.5 } }, "清空和 " + cNm + " 的线上私聊与全部单人线下记录；线下不会先总结，也不会调用模型。群线下是共享记录，不会从这里删除（此操作不可恢复）。"),
    h("div", { className: "flex items-center justify-between mb-3" },
      h("div", { className: "pr-3" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, "同步忘却记忆库"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 2 } }, "连 TA 的长期记忆与记忆库归属一起清；共享条目只解除 TA 的归属。")),
      h(Toggle, { on: wipeMemToo, onChange: () => setWipeMemToo(v => !v) })),
    confirmClear
      ? h("div", { className: "flex gap-2" },
          h("button", { onClick: () => setConfirmClear(false), className: "flex-1 rounded-lg py-2.5", style: { border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 13, color: t.sub } }, "取消"),
          h("button", { onClick: () => { onClearChat(wipeMemToo); setConfirmClear(false); }, className: "flex-1 rounded-lg py-2.5", style: { background: t.accent, color: "#fff", fontFamily: F_DISPLAY, fontSize: 14 } }, wipeMemToo ? "清除线上线下+记忆" : "清除线上与线下"))
      : h("button", { onClick: () => setConfirmClear(true), className: "w-full rounded-xl py-3 active:opacity-70", style: { border: "1px solid " + t.line, color: t.accent, fontFamily: F_DISPLAY, fontSize: 15 } }, "清除线上与线下记录"))), show("memory", { title: "记忆库", ...sec("lib") }, onOpenMemLib && h("div", {
    className: "pt-6"
  }, h(Eyebrow, {
    style: {
      marginBottom: 6
    }
  }, "记忆库 / Memory"), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11.5,
      lineHeight: 1.5,
      color: t.fog,
      marginBottom: 10
    }
  }, "结构化的关键事实，聊天时按相关度自动调取。当前 Ta 可见 " + (memLibCount || 0) + " 条。"), h("div", {
    className: "flex gap-2"
  }, h("button", {
    onClick: onOpenMemLib,
    className: "flex-1 rounded-xl py-2.5",
    style: {
      background: t.ink,
      color: t.bg2,
      fontFamily: F_DISPLAY,
      fontSize: 15
    }
  }, "打开记忆库"), h("button", {
    onClick: onExtractMem,
    className: "flex-1 rounded-xl py-2.5",
    style: {
      border: "1px solid " + t.line,
      color: t.ink,
      fontFamily: F_DISPLAY,
      fontSize: 15
    }
  }, "从对话提取")))));
}
