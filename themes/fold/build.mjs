// 折角便签：灰藤紫底、米白和浅藤紫的便签纸，每张折一个角；点缀用淡金，不用粉。用法：node themes/fold/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { bg: "#EEEAF5", dot: "#D3CCE2", paper: "#FFFFFF", lilac: "#D8CEF0", fold: "#FBFAFE", foldP: "#FBFAFE", ink: "#3F3A52", line: "#3F3A52", fog: "#9A93AE", gold: "#6B5BA8", deep: "#6A5AA8" };
const LINE = `1.4px solid ${C.line}`;
const SH = "3px 3px 0 rgba(63,58,82,.16)";
const F = 14; // 折角大小

// 折角：一个三角形——外侧是底色（剪掉角），内侧是折过来的深一档纸背，带一道斜线
const CORNER = (back) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M0 0 H20 V20Z' fill='${C.bg}'/><path d='M0 0 L20 20 H0Z' fill='${back}' stroke='${C.line}' stroke-width='1.4' stroke-linejoin='round'/></svg>`;
const DOTS = `<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 18 18'><circle cx='3' cy='3' r='1.1' fill='${C.dot}'/><circle cx='12' cy='12' r='1.1' fill='${C.dot}'/></svg>`;
const NOTE = (inner) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'><path d='M3 3 H19 L27 11 V27 H3Z' fill='${C.paper}' stroke='${C.line}' stroke-width='1.4' stroke-linejoin='round'/><path d='M19 3 V11 H27' fill='${C.lilac}' stroke='${C.line}' stroke-width='1.4' stroke-linejoin='round'/>${inner}</svg>`;
const I_PLUS = NOTE(`<path d='M15 12 V22 M10 17 H20' stroke='${C.ink}' stroke-width='1.8' stroke-linecap='round'/>`);
const I_HOUSE = NOTE(`<path d='M9 18 L15 13 L21 18 V23 H9Z' fill='none' stroke='${C.ink}' stroke-width='1.5' stroke-linejoin='round'/>`);
const I_MORE = NOTE(`<circle cx='10' cy='18' r='1.5' fill='${C.ink}'/><circle cx='15' cy='18' r='1.5' fill='${C.ink}'/><circle cx='20' cy='18' r='1.5' fill='${C.ink}'/>`);
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'><path d='M15 24 V8 M9 14 L15 8 L21 14' fill='none' stroke='${C.ink}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 52 34'><path d='M3 3 H41 L49 11 V31 H3Z' fill='${C.lilac}' stroke='${C.line}' stroke-width='1.4' stroke-linejoin='round'/><path d='M41 3 V11 H49' fill='${C.fold}' stroke='${C.line}' stroke-width='1.4' stroke-linejoin='round'/><path d='M13 12 H33 Q35 12 35 14 V21 Q35 23 33 23 H21 L16 27 L17 23 H13 Q11 23 11 21 V14 Q11 12 13 12Z' fill='${C.paper}' stroke='${C.ink}' stroke-width='1.4' stroke-linejoin='round'/><circle cx='17' cy='17.5' r='1.2' fill='${C.gold}'/><circle cx='23' cy='17.5' r='1.2' fill='${C.gold}'/><circle cx='29' cy='17.5' r='1.2' fill='${C.gold}'/></svg>`;
const CHECK = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 12'><path d='M1.5 6.5 L5 10 L12.5 2' fill='none' stroke='${C.gold}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>`;

const bubble = { myBg: C.lilac, myText: C.ink, myBorder: LINE, charBg: C.paper, charText: C.ink, charBorder: LINE, radius: 2, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 折角便签 · 第一批 ───── */
[data-wk="chat"]{background:${svg(DOTS)} 0 0/18px 18px,${C.bg} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：米白便签条，右下折一个角 */
[data-wk="chathead"]{background:${C.paper} !important;border-bottom:${LINE} !important;box-shadow:0 2px 0 rgba(74,68,88,.08) !important;position:relative !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;right:0 !important;bottom:-1.4px !important;width:16px !important;height:16px !important;background:${svg(CORNER(C.foldP))} center/contain no-repeat !important;transform:scaleY(-1) !important;pointer-events:none !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important}
[data-wk="headdim"]{color:${C.fog} !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chatback"] svg{stroke:${C.ink} !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:30px !important;min-width:30px !important;height:30px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important;margin-left:auto !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important;margin-left:4px !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 头像：方的，右上折一个小角 */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *,[data-wk="chathead"] img{border-radius:2px !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]),[data-wk="chathead"] [data-wk="avatar"]{box-shadow:0 0 0 1.4px ${C.line},${SH} !important;position:relative !important;overflow:visible !important}
button[data-wk="avatar"]::after,span[data-wk="avatar"]:not([data-halo])::after{content:"" !important;position:absolute !important;right:-1.4px !important;top:-1.4px !important;width:12px !important;height:12px !important;background:${svg(CORNER(C.foldP))} center/contain no-repeat !important;z-index:2 !important;pointer-events:none !important}

/* 便签气泡：方角、细线、右下一道淡影；每串第一条折右上角，后面几条折左上角，像一叠便签 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border:${LINE} !important;border-radius:2px !important;box-shadow:${SH} !important;color:${C.ink} !important;padding:11px 18px !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${C.lilac} !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.paper} !important}
[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;right:-1.4px !important;left:auto !important;top:-1.4px !important;bottom:auto !important;width:${F}px !important;height:${F}px !important;border:none !important;transform:none !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{background:${svg(CORNER(C.fold))} center/contain no-repeat !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{background:${svg(CORNER(C.foldP))} center/contain no-repeat !important}
[data-first="0"] [data-wk="bubble"][data-kind="text"]::before{right:auto !important;left:-1.4px !important;transform:scaleX(-1) !important}

/* 时间：一行等宽小字，两边【】 */
[data-wk="time"] > span{background:transparent !important;border:none !important;color:${C.ink} !important;font-family:ui-monospace,Menlo,monospace !important;letter-spacing:.15em !important;font-size:11px !important}
[data-wk="time"] > span::before{content:"【 " !important}
[data-wk="time"] > span::after{content:" 】" !important}
/* 已读：一行小字，已读后面一个淡金小勾 */
[data-wk="meta"]{color:${C.fog} !important;font-family:ui-monospace,Menlo,monospace !important;font-size:10.5px !important;letter-spacing:.08em !important}
[data-wk="meta"][data-read="1"]::after{content:"" !important;display:inline-block !important;width:11px !important;height:9px !important;margin-left:4px !important;background:${svg(CHECK)} center/contain no-repeat !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-run][data-last="1"] + [data-wk="cardmeta"]{display:block !important;font-size:10.5px !important;color:${C.fog} !important;font-family:ui-monospace,Menlo,monospace !important;padding:2px 0 0 62px !important}
[data-run][data-last="1"] + [data-wk="cardmeta"][data-me="1"]{text-align:right !important;padding:2px 62px 0 0 !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.paper} !important;border:${LINE} !important;border-radius:2px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.line} !important}
/* 动描：一行斜体，左边一道淡金竖线 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{background:transparent !important;border:none !important;border-left:2px solid ${C.gold} !important;border-radius:0 !important;box-shadow:none !important;color:${C.ink} !important;opacity:.8 !important;font-style:italic !important;font-size:13px !important;padding:2px 0 2px 12px !important}
/* 系统提示：不带框的一行小字 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11.5px !important;font-style:normal !important}

/* 底栏：米白便签条；左加号、发送，右边回复是一张折角小便签 */
[data-wk="composer"]{background:${C.paper} !important;border-top:${LINE} !important;align-items:center !important;gap:8px !important}
[data-wk="chatinput"]{background:#fff !important;border:${LINE} !important;border-radius:2px !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:${C.fog} !important}
[data-wk="chatplus"],[data-wk="send"]{width:32px !important;min-width:32px !important;height:32px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{background:${svg(I_SEND)} center/26px no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:52px !important;min-width:52px !important;height:34px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background:${svg(I_REPLY)} center/contain no-repeat !important;filter:drop-shadow(2px 3px 0 rgba(74,68,88,.14)) !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.92) !important}

/* 照参考图：折角只在每串第一条——我的折右上、他的折左上；后面几条不折。折过来那块是白的 */
[data-first="0"] [data-wk="bubble"][data-kind="text"]::before{content:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{right:auto !important;left:-1.4px !important;transform:scaleX(-1) !important}
[data-wk="msg"][data-me="0"] button[data-wk="avatar"]::after,[data-wk="cardrow"][data-me="0"] button[data-wk="avatar"]::after{right:auto !important;left:-1.4px !important;transform:scaleX(-1) !important}
[data-wk="msg"][data-me="0"] span[data-wk="avatar"]::after{right:auto !important;left:-1.4px !important;transform:scaleX(-1) !important}
/* 已读：紫色勾放在前面 */
[data-wk="meta"][data-read="1"]::after{content:none !important}
[data-wk="meta"]::before{content:"" !important;display:inline-block !important;width:12px !important;height:10px !important;margin-right:4px !important;vertical-align:-1px !important;background:${svg(CHECK)} center/contain no-repeat !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]::before{order:2 !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]{display:inline-flex !important;flex-direction:row-reverse !important;gap:4px !important}
/* 底栏：输入框淡紫，发送是深紫折角方块白箭头 */
[data-wk="chatinput"]{background:#F3EFFA !important}
[data-wk="send"]{order:99 !important;width:40px !important;min-width:40px !important;height:36px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 36'><path d='M2 2 H30 L38 10 V34 H2Z' fill='${C.deep}' stroke='${C.ink}' stroke-width='1.4' stroke-linejoin='round'/><path d='M30 2 V10 H38' fill='${C.fold}' stroke='${C.ink}' stroke-width='1.4' stroke-linejoin='round'/><path d='M20 28 V12 M14 18 L20 12 L26 18' fill='none' stroke='#fff' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/></svg>`)} center/contain no-repeat !important;filter:drop-shadow(3px 3px 0 rgba(63,58,82,.16)) !important}

[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}


/* ───── 折角便签 · 第二批：卡片（形状不动；方角细线淡影，右上折一个白角；转账、红包像折起一角的信纸） ───── */
[data-wk="transfercard"],[data-wk="photocard"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"],[data-wk="rpcard"]{border:${LINE} !important;border-radius:2px !important;box-shadow:${SH} !important;color:${C.ink} !important;position:relative !important;overflow:visible !important}
[data-wk="transfercard"],[data-wk="photocard"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{background:${C.paper} !important}
[data-wk="transfercard"] *,[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:${C.ink} !important;border-color:rgba(63,58,82,.25) !important}
[data-wk="transfercard"]::after,[data-wk="photocard"]::after,[data-wk="namecard"]::after,[data-part="offlog"]::after,[data-wk="rpcard"]::after,[data-wk="voice"]::after{content:"" !important;position:absolute !important;right:-1.4px !important;top:-1.4px !important;left:auto !important;bottom:auto !important;width:18px !important;height:18px !important;background:${svg(CORNER(C.fold))} center/contain no-repeat !important;z-index:3 !important;pointer-events:none !important;border:none !important;transform:none !important}
/* 转账：一页信纸——淡横格，金额下一道紫线，收下盖紫色「√ 已收」小方章 */
[data-wk="transfercard"]{background:repeating-linear-gradient(180deg,transparent 0 23px,rgba(107,91,168,.12) 23px 24px),${C.paper} !important;padding-top:24px !important}
[data-wk="transfercard"]::before{content:"TRANSFER" !important;position:absolute !important;left:16px !important;top:8px !important;font:600 9px/1 ui-monospace,Menlo,monospace !important;letter-spacing:.25em !important;color:${C.fog} !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:${C.deep} !important;font-weight:700 !important}
[data-wk="transferrule"]{border:none !important;height:1.4px !important;background:${C.deep} !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:${C.lilac} !important;border-top:${LINE} !important}
[data-wk="transferbtn"]{border-radius:2px !important;border:${LINE} !important}
[data-wk="transferbtn"][data-part="take"]{background:${C.deep} !important;color:#fff !important}
[data-wk="transferbtn"][data-part="back"]{background:${C.paper} !important;color:${C.ink} !important}
[data-wk="transferseal"]{border:${LINE} !important;border-radius:2px !important;background:${C.paper} !important;color:${C.ink} !important;box-shadow:none !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{border:2px solid ${C.deep} !important;color:${C.deep} !important;transform:rotate(-8deg) !important;background:rgba(216,206,240,.5) !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] *{color:${C.deep} !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.6 !important}
/* 红包：一个藤紫信封——三角封口、封口上一颗深紫小圆封 */
[data-wk="rpcard"]{background:${C.lilac} !important;overflow:hidden !important}
[data-wk="rpcard"] *{color:${C.ink} !important}
[data-wk="rpflap"]{height:46px !important;bottom:auto !important;border:none !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 46' preserveAspectRatio='none'><path d='M0 0 L50 44 L100 0' fill='#C9BCE8' stroke='${C.line}' stroke-width='1.4' vector-effect='non-scaling-stroke' stroke-linejoin='round'/></svg>`)} center/100% 100% no-repeat !important}
[data-wk="rpseal"]{border:2px solid ${C.paper} !important;background:${C.deep} !important;width:20px !important;height:20px !important;left:50% !important;margin-left:-10px !important;top:30px !important;border-radius:50% !important}
[data-wk="rpseal"] *,[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"] > div:not([data-wk]){padding-top:56px !important;text-align:center !important;padding-left:14px !important}
[data-wk="rpcard"][data-status="done"]{opacity:.65 !important;filter:saturate(.6) !important}
[data-wk="rpenvelope"]{background:${C.lilac} !important;border:${LINE} !important;border-radius:4px !important;box-shadow:4px 4px 0 rgba(63,58,82,.2) !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:#C9BCE8 !important;border-color:${C.line} !important}
[data-wk="rpenvelope"] *{color:${C.ink} !important}
[data-wk="rpenvelope"][data-stage="open"]{background:${svg(DOTS)} 0 0/18px 18px,${C.paper} !important}
[data-wk="rpopenbtn"]{background:${C.deep} !important;border:2px solid ${C.paper} !important;box-shadow:0 0 0 1.4px ${C.line} !important}
[data-wk="rpopenbtn"] *{color:#fff !important}
[data-wk="rpamount"]{color:${C.deep} !important}
/* 照片、语音、天气、位置、名片 */
[data-wk="photocard"]{padding:8px 8px 10px !important}
[data-wk="photoface"]{border-radius:0 !important;background:${C.bg} !important;border:1px solid rgba(63,58,82,.2) !important}
[data-wk="photoface"] *,[data-wk="phototext"],[data-wk="photocap"],[data-wk="photohint"]{color:${C.ink} !important}
[data-wk="voice"][data-me]{background:${C.paper} !important;border:${LINE} !important;border-radius:2px !important;box-shadow:${SH} !important;position:relative !important;overflow:visible !important}
[data-wk="voice"][data-me="1"]{background:${C.lilac} !important}
[data-wk="voice"] > *{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.ink} !important}
[data-wk="voicewave"] span{background:${C.deep} !important}
[data-wk="wxcardsky"]{background:${C.bg} !important}
[data-wk="wxcardsky"] *{color:${C.ink} !important}
[data-wk="wxcardsky"] svg{stroke:${C.deep} !important}
[data-wk="wxcardsay"]{background:${C.paper} !important;color:${C.ink} !important;border-top:${LINE} !important}
[data-wk="geopin"]{background:${C.deep} !important;border-radius:2px !important;box-shadow:0 0 0 2px #fff !important}
[data-wk="geopinstem"]{background:${C.line} !important}
[data-wk="namecard"] img{border-radius:2px !important;box-shadow:0 0 0 1.4px ${C.line} !important}
/* 拍一拍、通话结束：小便签条 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:${C.lilac} !important;border:${LINE} !important;border-radius:2px !important;color:${C.ink} !important;padding:2px 14px !important;font-size:12px !important;box-shadow:2px 2px 0 rgba(63,58,82,.16) !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.ink} !important}
[data-wk="note"][data-part="callsum"]{color:${C.fog} !important}
/* 线下小结：一页便签，标题等宽 */
[data-wk="offlogtitle"]{font-family:ui-monospace,Menlo,monospace !important;letter-spacing:.2em !important;color:${C.deep} !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.deep} !important}
[data-wk="offlogtranscript"]{border-top:${LINE} !important}
/* 加号面板：一张张折角小便签，白和藤紫交替 */
[data-wk="chatpanel"]{background:${C.paper} !important;border-top:${LINE} !important}
[data-wk="chattoolicon"]{background:${C.paper} !important;border:${LINE} !important;border-radius:2px !important;box-shadow:2px 2px 0 rgba(63,58,82,.16) !important;position:relative !important}
[data-wk="chattool"]:nth-child(odd) [data-wk="chattoolicon"]{background:${C.lilac} !important}
[data-wk="chattoolicon"]::after{content:"" !important;position:absolute !important;right:-1.4px !important;top:-1.4px !important;width:12px !important;height:12px !important;background:${svg(CORNER(C.fold))} center/contain no-repeat !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.ink} !important;color:${C.ink} !important}
[data-wk="chattoollabel"]{color:${C.ink} !important}
/* 引用三处：一张小便签条，左边一道深紫线 */
[data-wk="quotedraft"]{background:${C.paper} !important;border-top:none !important}
[data-wk="quote"]{background:${C.paper} !important;color:${C.ink} !important;border:${LINE} !important;border-left:4px solid ${C.deep} !important;border-radius:2px !important;opacity:1 !important}
[data-wk="quote"][data-me="1"]{background:${C.lilac} !important}
[data-wk="quoteicon"],[data-wk="quoteclear"]{color:${C.deep} !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid ${C.deep} !important;padding-left:8px !important;opacity:.75 !important}
/* 线下：顶栏加号、底栏照片键也是折角便签 */
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:30px !important;height:30px !important;background:${svg(I_PLUS)} center/contain no-repeat !important;border:none !important;box-shadow:none !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:30px !important;min-width:30px !important;height:30px !important;border:none !important;box-shadow:none !important;font-size:0 !important;background:${svg(NOTE(`<rect x='9' y='13' width='12' height='9' fill='none' stroke='${C.ink}' stroke-width='1.4'/><path d='M9.5 21 L13.5 17.5 L16 19.5 L18 18 L20.5 20.5' fill='none' stroke='${C.ink}' stroke-width='1.2'/>`))} center/contain no-repeat !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}

`;

const pack = { kind: "chat-look", v: 1, name: "折角便签", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "折角便签-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
