// 霓虹夜：深夜底，左下洋红、右上青绿两团光；气泡是一根弯着的霓虹灯管——描边发光、左下多绕出一截灯管。用法：node themes/neon/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { bg: "#0E0B19", pink: "#FF5FAE", teal: "#43EEDD", gold: "#F6C764", ink: "#F4F0FF", fog: "#9C93B8", panel: "#17132A" };
const GP = `0 0 2px ${C.pink},0 0 8px ${C.pink},0 0 18px rgba(255,95,174,.55)`;
const GT = `0 0 2px ${C.teal},0 0 8px ${C.teal},0 0 18px rgba(67,238,221,.5)`;
const IG = (c) => `0 0 6px ${c},inset 0 0 6px ${c}`;
const T = (c, d, vb = '0 0 30 30') => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}' fill='none' stroke-linecap='round' stroke-linejoin='round'><g stroke='${c}' stroke-width='3.2' opacity='.45'>${d}</g><g stroke='${c}' stroke-width='1.8'>${d}</g><g stroke='#fff' stroke-width='.7' opacity='.8'>${d}</g></svg>`;
const I_PLUS = T(C.teal, `<path d='M15 3 L17.5 12.5 L27 15 L17.5 17.5 L15 27 L12.5 17.5 L3 15 L12.5 12.5Z'/>`);
const I_HOUSE = T(C.pink, `<path d='M8 27 V9 Q8 4 15 4 Q22 4 22 9 V27Z'/><path d='M17 11 A3.5 3.5 0 1 1 13.5 7.5 A2.6 2.6 0 0 0 17 11Z'/><circle cx='18.5' cy='18' r='.9'/><path d='M5 27 H25'/>`);
const I_MORE = T(C.teal, `<path d='M7 21 V13 M15 24 V6 M23 20 V10'/>`);
const I_SEND = T(C.pink, `<path d='M23 3 L9 19 H19 L15 33 L31 14 H21 Z'/>`, '0 0 40 36');
const I_REPLY = T(C.teal, `<path d='M6 5 H40 Q46 5 46 11 V21 Q46 27 40 27 H20 L12 32 L13.5 27 H12 Q6 27 6 21 V11 Q6 5 12 5Z'/><path d='M26 21.5 C20 17.5 19.5 15.5 19.5 14 C19.5 12 21 11 22.5 11 C24 11 25.3 12 26 13.2 C26.7 12 28 11 29.5 11 C31 11 32.5 12 32.5 14 C32.5 15.5 32 17.5 26 21.5Z'/>`, '0 0 52 36');

const I_CAM = T(C.pink, `<path d='M4 10 H9 L11 7 H19 L21 10 H26 V24 H4Z'/><circle cx='15' cy='16.5' r='4.5'/>`);
const I_BOW = T(C.gold, `<path d='M15 12 C10 4 3 6 5 11 C6 14 11 13 15 12Z'/><path d='M15 12 C20 4 27 6 25 11 C24 14 19 13 15 12Z'/><path d='M15 12 L11 22 M15 12 L19 22'/>`);
const BRICK = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='24' viewBox='0 0 48 24'><path d='M0 .5 H48 M0 12.5 H48 M24 0 V12 M.5 12 V24 M47.5 12 V24' stroke='rgba(255,255,255,.035)' stroke-width='1' fill='none'/></svg>`;
const bubble = { myBg: "transparent", myText: C.ink, myBorder: `2px solid ${C.pink}`, charBg: "transparent", charText: C.ink, charBorder: `2px solid ${C.teal}`, radius: 18, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 霓虹夜 · 第一批 ───── */
[data-wk="chat"]{background:radial-gradient(circle at 0% 100%,rgba(196,40,130,.45),transparent 55%),radial-gradient(circle at 100% 0%,rgba(30,150,150,.35),transparent 50%),radial-gradient(circle at 80% 55%,rgba(255,95,174,.18),transparent 45%),${svg(BRICK)} 0 0/48px 24px,${C.bg} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：半透明夜色，底边一根洋红灯管 */
[data-wk="chathead"]{background:rgba(14,11,25,.82) !important;border-bottom:1.5px solid ${C.pink} !important;box-shadow:0 1px 10px rgba(255,95,174,.5) !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important}
[data-wk="headname"] [data-wk="headink"]{text-shadow:0 0 6px rgba(255,255,255,.5) !important}
[data-wk="headdim"],[data-wk="headname"] > div:last-child{color:${C.fog} !important}
[data-wk="chatback"] svg{stroke:${C.ink} !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:30px !important;min-width:30px !important;height:30px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important;margin-left:auto !important;filter:drop-shadow(0 0 4px ${C.pink}) !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important;margin-left:6px !important;filter:drop-shadow(0 0 4px ${C.teal}) !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
/* 顶栏双头像：两个灯圈挨着，一青一粉，中间一颗小爱心灯 */
[data-wk="chathead"] [data-wk="headme"]{display:inline-flex !important;position:relative !important;overflow:visible !important;margin-left:-10px !important}
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img{border-radius:50% !important;box-shadow:0 0 0 2px ${C.pink},${GP} !important}
[data-wk="chathead"] [data-wk="headme"]::before{content:"" !important;position:absolute !important;left:-8px !important;bottom:-4px !important;width:14px !important;height:14px !important;z-index:3 !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M10 17 C3 12 2 9 2 7 C2 4 4 2.5 6.5 2.5 C8 2.5 9.3 3.4 10 4.6 C10.7 3.4 12 2.5 13.5 2.5 C16 2.5 18 4 18 7 C18 9 17 12 10 17Z' fill='${C.bg}' stroke='${C.gold}' stroke-width='2'/></svg>`)} center/contain no-repeat !important;filter:drop-shadow(0 0 3px ${C.gold}) !important}
[data-wk="offline"] [data-wk="chathead"] [data-wk="headme"]{display:none !important}

/* 头像：圆的灯圈——他的青、我的粉 */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *,[data-wk="chathead"] img{border-radius:50% !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]),[data-wk="chathead"] [data-wk="avatar"]{box-shadow:0 0 0 2px ${C.teal},${GT} !important}
[data-wk="msg"][data-me="1"] button[data-wk="avatar"],[data-wk="msg"][data-me="1"] span[data-wk="avatar"],[data-wk="cardrow"][data-me="1"] button[data-wk="avatar"]{box-shadow:0 0 0 2px ${C.pink},${GP} !important}

/* 气泡：一根霓虹灯管——圆角描边、里外都亮；左下多绕出一截灯管（我的左下拐一个弯，他的左边多一道竖管） */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;background:rgba(14,11,25,.55) !important;border-radius:18px !important;color:${C.ink} !important;padding:11px 20px !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{border:2px solid ${C.pink} !important;box-shadow:${IG(C.pink)},0 0 18px rgba(255,95,174,.45) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{border:2px solid ${C.teal} !important;box-shadow:${IG(C.teal)},0 0 18px rgba(67,238,221,.4) !important}
/* 照参考：灯管顶上正中一个小黑灯座卡扣；右下角灯管断开一小截，像真的弯管接头 */
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;left:calc(50% - 8px) !important;top:-4px !important;right:auto !important;bottom:auto !important;width:16px !important;height:6px !important;border-radius:2px !important;background:#1A1626 !important;border:1px solid #4A4560 !important;box-shadow:none !important;transform:none !important;pointer-events:none !important;z-index:2 !important}
[data-wk="bubble"][data-kind="text"]::after{content:"" !important;position:absolute !important;right:12px !important;bottom:-4px !important;left:auto !important;top:auto !important;width:12px !important;height:6px !important;border:none !important;border-radius:0 !important;background:#140E20 !important;box-shadow:0 0 4px #140E20 !important;transform:none !important;pointer-events:none !important;z-index:2 !important}

/* 时间：一行暖金灯字，不带底 */
[data-wk="time"] > span{background:rgba(14,11,25,.6) !important;border:2px solid ${C.gold} !important;border-radius:14px !important;padding:4px 22px !important;box-shadow:0 0 6px ${C.gold},inset 0 0 6px rgba(246,199,100,.6) !important;color:${C.gold} !important;font-family:ui-monospace,Menlo,monospace !important;letter-spacing:.18em !important;font-size:12px !important;text-shadow:0 0 6px rgba(246,199,100,.8) !important}
/* 已读：小字，前面（我的在后面）一颗亮点 */
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important;letter-spacing:.1em !important;display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"]::before{content:"" !important;width:6px !important;height:6px !important;border-radius:50% !important;background:${C.teal} !important;box-shadow:0 0 6px ${C.teal} !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]{flex-direction:row-reverse !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]::before{background:${C.pink} !important;box-shadow:0 0 6px ${C.pink} !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-run][data-last="1"] + [data-wk="cardmeta"]{display:block !important;font-size:10.5px !important;color:${C.fog} !important;padding:2px 0 0 62px !important}
[data-run][data-last="1"] + [data-wk="cardmeta"][data-me="1"]{text-align:right !important;padding:2px 62px 0 0 !important}
[data-wk="bubble"][data-kind="typing"]{background:rgba(14,11,25,.55) !important;border:2px solid ${C.teal} !important;border-radius:18px !important;box-shadow:${IG(C.teal)} !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.teal} !important;box-shadow:0 0 4px ${C.teal} !important}

/* 动描：不是灯管——像橱窗里一行暗下来的字幕：上下各一道渐隐的金线，淡紫斜体 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{display:block !important;background:linear-gradient(90deg,transparent,rgba(246,199,100,.7),transparent) top/100% 1px no-repeat,linear-gradient(90deg,transparent,rgba(246,199,100,.7),transparent) bottom/100% 1px no-repeat,rgba(246,199,100,.05) !important;border:none !important;border-radius:0 !important;box-shadow:none !important;color:#CFC3EE !important;opacity:1 !important;font-style:italic !important;font-size:13px !important;line-height:1.8 !important;padding:8px 18px !important;text-align:center !important}
/* 系统提示：一行等宽小字，两边一颗灭着的小灯 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-family:ui-monospace,Menlo,monospace !important;font-size:11px !important;font-style:normal !important;letter-spacing:.08em !important}
[data-wk="sysnotetext"]::before{content:"◦ " !important;color:${C.teal} !important}
[data-wk="sysnotetext"]::after{content:" ◦" !important;color:${C.teal} !important}

/* 底栏：夜色，顶边一根青色灯管；左加号、发送是一道洋红闪电，右回复是青色灯管对话框里一颗心；按键都不包框，换成配套灯管图案 */
[data-wk="composer"]{background:rgba(14,11,25,.88) !important;border-top:1.5px solid ${C.teal} !important;box-shadow:0 -1px 10px rgba(67,238,221,.35) !important;align-items:center !important;gap:8px !important}
[data-wk="chatinput"]{background:${C.panel} !important;border:1.5px solid rgba(244,240,255,.25) !important;border-radius:18px !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:${C.fog} !important}
[data-wk="chatplus"]{width:32px !important;min-width:32px !important;height:32px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background:${svg(I_PLUS)} center/contain no-repeat !important;filter:drop-shadow(0 0 4px ${C.teal}) !important}
[data-wk="send"]{width:40px !important;min-width:40px !important;height:36px !important;border:none !important;border-radius:0 !important;background:${svg(I_SEND)} center/contain no-repeat !important;box-shadow:none !important;opacity:1 !important;filter:drop-shadow(0 0 5px ${C.pink}) !important}
[data-wk="chatreply"]{width:48px !important;min-width:48px !important;height:34px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background:${svg(I_REPLY)} center/contain no-repeat !important;filter:drop-shadow(0 0 5px ${C.teal}) !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.92) !important}
/* ───── 霓虹夜 · 第二批：卡片（形状不动；每张是一块挂墙上的灯牌——深色底、灯管描边、顶上一个灯座卡扣） ───── */
[data-wk="transfercard"],[data-wk="photocard"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"],[data-wk="rpcard"]{position:relative !important;overflow:visible !important;background:rgba(14,11,25,.78) !important;border:2px solid ${C.teal} !important;border-radius:14px !important;box-shadow:${IG(C.teal)},0 0 16px rgba(67,238,221,.35) !important;color:${C.ink} !important}
[data-wk="transfercard"]::before,[data-wk="photocard"]::before,[data-wk="namecard"]::before,[data-part="offlog"]::before,[data-wk="wxcard"]::before{content:"" !important;position:absolute !important;left:calc(50% - 9px) !important;top:-5px !important;width:18px !important;height:7px !important;border-radius:2px !important;background:#1A1626 !important;border:1px solid #4A4560 !important;z-index:3 !important}
[data-wk="transfercard"] *,[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *,[data-wk="photocard"] *{color:${C.ink} !important;border-color:rgba(244,240,255,.15) !important}
/* 转账：金色灯管，金额是会亮的金字；收下以后右上亮一块青色「已收」小灯牌 */
[data-wk="transfercard"]{border-color:${C.gold} !important;box-shadow:${IG(C.gold)},0 0 16px rgba(246,199,100,.35) !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:${C.gold} !important;text-shadow:0 0 8px rgba(246,199,100,.8) !important}
[data-wk="transferrule"]{border:none !important;height:1.5px !important;background:${C.gold} !important;box-shadow:0 0 6px ${C.gold} !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:transparent !important;border-top:1px solid rgba(246,199,100,.3) !important}
[data-wk="transferbtn"]{border-radius:14px !important;background:transparent !important}
[data-wk="transferbtn"][data-part="take"]{border:2px solid ${C.gold} !important;color:${C.gold} !important;box-shadow:0 0 6px ${C.gold} !important}
[data-wk="transferbtn"][data-part="back"]{border:1.5px solid rgba(244,240,255,.3) !important;color:${C.fog} !important}
[data-wk="transferseal"]{background:transparent !important;border:2px solid ${C.teal} !important;border-radius:6px !important;color:${C.teal} !important;box-shadow:0 0 6px ${C.teal} !important;text-shadow:0 0 6px ${C.teal} !important}
[data-wk="transferseal"] *{color:${C.teal} !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{transform:rotate(-6deg) !important}
[data-wk="transfercard"][data-status="returned"]{border-color:rgba(244,240,255,.25) !important;box-shadow:none !important;opacity:.6 !important}
/* 红包：不是信封——一块洋红礼物灯牌，左上一只金色灯管蝴蝶结；领完灯灭（变暗不发光） */
[data-wk="rpcard"]{background:radial-gradient(circle at 20% 0%,rgba(255,95,174,.25),transparent 60%),rgba(14,11,25,.8) !important;border-color:${C.pink} !important;box-shadow:${IG(C.pink)},0 0 18px rgba(255,95,174,.45) !important;padding-left:46px !important}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:8px !important;top:-10px !important;width:34px !important;height:34px !important;background:${svg(I_BOW)} center/contain no-repeat !important;filter:drop-shadow(0 0 4px ${C.gold}) !important;z-index:3 !important}
[data-wk="rpcard"] *{color:${C.ink} !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"][data-status="done"]{border-color:rgba(255,95,174,.35) !important;box-shadow:none !important;opacity:.6 !important}
[data-wk="rpcard"][data-status="done"]::before{filter:none !important;opacity:.4 !important}
[data-wk="rpenvelope"]{background:radial-gradient(circle at 50% 0%,rgba(255,95,174,.3),transparent 60%),${C.bg} !important;border:2px solid ${C.pink} !important;border-radius:18px !important;box-shadow:${IG(C.pink)},0 0 30px rgba(255,95,174,.45) !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:transparent !important;border:none !important}
[data-wk="rpenvelope"] *{color:${C.ink} !important}
[data-wk="rpopenbtn"]{background:transparent !important;border:2px solid ${C.gold} !important;box-shadow:${IG(C.gold)},0 0 14px ${C.gold} !important}
[data-wk="rpopenbtn"] *{color:${C.gold} !important}
[data-wk="rpamount"]{color:${C.gold} !important;text-shadow:0 0 10px ${C.gold} !important}
/* 照片：青色灯框里一块暗屏；语音：小灯管条，波形是一根根亮柱 */
[data-wk="photocard"]{padding:8px 8px 10px !important}
[data-wk="photoface"]{border-radius:8px !important;background:#120F20 !important;border:1px solid rgba(67,238,221,.3) !important}
[data-wk="photoface"] *,[data-wk="phototext"],[data-wk="photocap"],[data-wk="photohint"]{color:${C.ink} !important}
[data-wk="photoface"] svg{stroke:${C.teal} !important}
[data-wk="voice"][data-me]{background:rgba(14,11,25,.6) !important;border:2px solid ${C.teal} !important;border-radius:18px !important;box-shadow:${IG(C.teal)} !important}
[data-wk="voice"][data-me="1"]{border-color:${C.pink} !important;box-shadow:${IG(C.pink)} !important}
[data-wk="voice"] > *{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.ink} !important}
[data-wk="voicewave"] span{background:${C.teal} !important;box-shadow:0 0 4px ${C.teal} !important}
[data-wk="voice"][data-me="1"] [data-wk="voicewave"] span{background:${C.pink} !important;box-shadow:0 0 4px ${C.pink} !important}
/* 天气、位置、名片 */
[data-wk="wxcardsky"]{background:radial-gradient(circle at 80% 30%,rgba(67,238,221,.18),transparent 60%),transparent !important}
[data-wk="wxcardsky"] *{color:${C.ink} !important}
[data-wk="wxcardsky"] svg{stroke:${C.teal} !important;filter:drop-shadow(0 0 4px ${C.teal}) !important}
[data-wk="wxcardsay"]{background:transparent !important;color:${C.ink} !important;border-top:1px solid rgba(67,238,221,.3) !important}
[data-wk="wxcardsay"] *{color:${C.ink} !important}
[data-wk="geopin"]{background:${C.pink} !important;box-shadow:0 0 10px ${C.pink} !important}
[data-wk="geopinstem"]{background:${C.pink} !important}
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 2px ${C.teal},${GT} !important}
/* 拍一拍、通话结束：一行小灯字，两边各一截短灯管 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:transparent !important;border:none !important;color:${C.ink} !important;padding:2px 26px !important;font-size:12px !important;text-shadow:0 0 6px ${C.pink} !important;background:linear-gradient(${C.pink},${C.pink}) left center/16px 2px no-repeat,linear-gradient(${C.pink},${C.pink}) right center/16px 2px no-repeat !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.pink} !important}
[data-wk="note"][data-part="callsum"]{color:${C.fog} !important}
/* 线下小结 */
[data-wk="offlogtitle"]{font-family:ui-monospace,Menlo,monospace !important;letter-spacing:.2em !important;color:${C.teal} !important;text-shadow:0 0 6px ${C.teal} !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.pink} !important}
[data-wk="offlogtranscript"]{border-top:1px solid rgba(67,238,221,.3) !important}
/* 加号面板：一格格小灯牌，粉青交替 */
[data-wk="chatpanel"]{background:rgba(14,11,25,.92) !important;border-top:1.5px solid ${C.teal} !important}
[data-wk="chattoolicon"]{background:transparent !important;border:2px solid ${C.teal} !important;border-radius:14px !important;box-shadow:${IG(C.teal)} !important}
[data-wk="chattool"]:nth-child(odd) [data-wk="chattoolicon"]{border-color:${C.pink} !important;box-shadow:${IG(C.pink)} !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.ink} !important;color:${C.ink} !important}
[data-wk="chattoollabel"]{color:${C.fog} !important}
/* 引用三处：左边一根青色短灯管 */
[data-wk="quotedraft"]{background:rgba(14,11,25,.9) !important;border-top:none !important}
[data-wk="quote"]{background:rgba(23,19,42,.85) !important;color:${C.ink} !important;border:none !important;border-left:3px solid ${C.teal} !important;border-radius:4px !important;box-shadow:-2px 0 6px -2px ${C.teal} !important;opacity:1 !important}
[data-wk="quote"][data-me="1"]{border-left-color:${C.pink} !important;box-shadow:-2px 0 6px -2px ${C.pink} !important}
[data-wk="quoteicon"],[data-wk="quoteclear"]{color:${C.teal} !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid currentColor !important;padding-left:8px !important;opacity:.7 !important}
/* 线下：提示键是同一颗四角星，照片键是一台粉色灯管相机 */
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:28px !important;height:28px !important;background:${svg(I_PLUS)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;filter:drop-shadow(0 0 4px ${C.teal}) !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:30px !important;min-width:30px !important;height:30px !important;border:none !important;box-shadow:none !important;font-size:0 !important;background:${svg(I_CAM)} center/contain no-repeat !important;filter:drop-shadow(0 0 4px ${C.pink}) !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}
`;

const pack = { kind: "chat-look", v: 1, name: "霓虹夜", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "霓虹夜-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
