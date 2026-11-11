// 雨天窗边：窗外是彩色光斑的雨夜，白窗框挂粉色花边帘。我的话＝一块起雾的玻璃（右上角挂两颗水珠），
// 他的话＝窗边一张白便条（左上一截窗框投下的影子），已读＝一颗小水滴。用法：node themes/rainy-window/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { bg: "#E9F1FF", bg2: "#C7DBFF", glass: "#BFDDFF", glass2: "#E3D4FF", glassD: "#7FA6E8", frame: "#FFFFFF", paper: "#FFFFFF", ink: "#3A4A6B", fog: "#8C9BC0", drop: "#5B8DEF", wood: "#F6B8D2", pink: "#FFC6DE", yel: "#FFE9A8" };

// 背景：斜斜的细雨丝（一张小瓷砖铺满）
const RAIN = `<svg xmlns='http://www.w3.org/2000/svg' width='90' height='120'><g stroke='#ffffff' stroke-linecap='round' opacity='.55'><path d='M12 6 l-4 16' stroke-width='1'/><path d='M58 30 l-3 12' stroke-width='.8'/><path d='M80 70 l-4 18' stroke-width='1'/><path d='M30 74 l-3 11' stroke-width='.8'/><path d='M46 100 l-2 9' stroke-width='.7'/></g><g fill='#ffffff' opacity='.5'><circle cx='70' cy='14' r='1.6'/><circle cx='20' cy='52' r='1.2'/><circle cx='62' cy='106' r='1.4'/></g></svg>`;
const BOKEH = `<svg xmlns='http://www.w3.org/2000/svg' width='390' height='420'><defs><radialGradient id='p'><stop offset='0' stop-color='#FFB3D4' stop-opacity='.85'/><stop offset='.55' stop-color='#FFB3D4' stop-opacity='.35'/><stop offset='1' stop-color='#FFB3D4' stop-opacity='0'/></radialGradient><radialGradient id='y'><stop offset='0' stop-color='#FFE38A' stop-opacity='.85'/><stop offset='.55' stop-color='#FFE38A' stop-opacity='.35'/><stop offset='1' stop-color='#FFE38A' stop-opacity='0'/></radialGradient><radialGradient id='v'><stop offset='0' stop-color='#C9B2FF' stop-opacity='.85'/><stop offset='.55' stop-color='#C9B2FF' stop-opacity='.35'/><stop offset='1' stop-color='#C9B2FF' stop-opacity='0'/></radialGradient><radialGradient id='b'><stop offset='0' stop-color='#9FD3FF' stop-opacity='.85'/><stop offset='.55' stop-color='#9FD3FF' stop-opacity='.35'/><stop offset='1' stop-color='#9FD3FF' stop-opacity='0'/></radialGradient></defs><circle cx='40' cy='60' r='42' fill='url(#p)'/><circle cx='330' cy='130' r='50' fill='url(#y)'/><circle cx='250' cy='310' r='38' fill='url(#v)'/><circle cx='80' cy='340' r='32' fill='url(#b)'/><circle cx='190' cy='40' r='22' fill='url(#v)'/><circle cx='360' cy='380' r='20' fill='url(#p)'/></svg>`;
const DROP = (f = C.drop) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 26'><path d='M10 1.5 C10 1.5 2.5 11 2.5 16.5 A7.5 7.5 0 0 0 17.5 16.5 C17.5 11 10 1.5 10 1.5Z' fill='${f}' stroke='${C.glassD}' stroke-width='1.1'/><path d='M6.5 16 A3.5 3.5 0 0 0 9 19.5' fill='none' stroke='#fff' stroke-width='1.4' stroke-linecap='round'/></svg>`;
const DROPS2 = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 22'><circle cx='9' cy='8' r='5' fill='rgba(255,255,255,.75)' stroke='${C.glassD}' stroke-width='1'/><circle cx='7.5' cy='6.5' r='1.4' fill='#fff'/><circle cx='22' cy='15' r='3.4' fill='rgba(255,255,255,.75)' stroke='${C.glassD}' stroke-width='1'/></svg>`;
const STAR = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 2 L14.6 9.4 L22 12 L14.6 14.6 L12 22 L9.4 14.6 L2 12 L9.4 9.4Z' fill='${C.yel}' stroke='#E9B949' stroke-width='1.2' stroke-linejoin='round'/></svg>`;
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='9' fill='none' stroke='${C.ink}' stroke-width='1.4'/><path d='M12 8 V16 M8 12 H16' stroke='${C.ink}' stroke-width='1.5' stroke-linecap='round'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 24'><path d='M4 12.5 L23 4.5 Q24.5 4 24 5.5 L18 20 Q17.4 21.3 16.6 20.2 L13 14.5Z' fill='${C.glass}' stroke='${C.ink}' stroke-width='1.4' stroke-linejoin='round'/><path d='M13 14.5 L23.5 5' stroke='${C.ink}' stroke-width='1.2'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M4 11 L12 4 L20 11 V20 H4Z' fill='none' stroke='${C.ink}' stroke-width='1.5' stroke-linejoin='round'/><path d='M12 20 V14' stroke='${C.ink}' stroke-width='1.3'/></svg>`;
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='5' cy='12' r='1.5' fill='${C.ink}'/><circle cx='12' cy='12' r='1.5' fill='${C.ink}'/><circle cx='19' cy='12' r='1.5' fill='${C.ink}'/></svg>`;
const UMB = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M3 12 A9 8 0 0 1 21 12 Q18 10 15 12 Q12 10 9 12 Q6 10 3 12Z' fill='#fff'/><path d='M12 12 V19 Q12 21 10 21' fill='none' stroke='#fff' stroke-width='1.6' stroke-linecap='round'/></svg>`;

const bubble = { myBg: C.glass, myText: C.ink, myBorder: "1.2px solid " + C.glassD, charBg: C.paper, charText: C.ink, charBorder: "1.2px solid " + C.glassD, radius: 14, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };
const LINE = `1.4px solid ${C.glassD}`;

const css = `
/* ───── 雨天窗边 · 第一批 ───── */
[data-wk="chat"]{background:${svg(RAIN)} 0 0/90px 120px repeat,${svg(BOKEH)} 0 0/390px 420px repeat,linear-gradient(180deg,${C.bg2},${C.bg} 45%,#FCEBFA) !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：一截白窗框，下沿一条木窗台 */
[data-wk="chathead"]{position:relative !important;overflow:visible !important;background:${C.frame} !important;border-bottom:none !important;box-shadow:0 3px 0 ${C.pink} !important;z-index:5 !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:-12px !important;height:10px !important;background:radial-gradient(circle at 10px 0,${C.pink} 9px,transparent 9.5px) 0 0/20px 10px repeat-x !important;pointer-events:none !important}
[data-wk="chathead"] + *:not([data-wk="body"]){margin-top:10px !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important}
[data-wk="headdim"]{color:${C.fog} !important;white-space:nowrap !important}
[data-wk="chatback"] svg{stroke:${C.ink} !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:28px !important;min-width:28px !important;height:28px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/21px no-repeat !important;margin-left:auto !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/21px no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 头像：圆，一圈白窗框 */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *{border-radius:50% !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]){box-shadow:0 0 0 2.5px ${C.frame},0 0 0 4px ${C.pink} !important}

/* 我的话：起雾的玻璃，右上挂两颗水珠 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;color:${C.ink} !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(160deg,rgba(255,255,255,.7),rgba(255,255,255,0) 40%),linear-gradient(135deg,${C.glass},${C.glass2}) !important;border:1.4px solid #fff !important;border-radius:18px 18px 4px 18px !important;box-shadow:0 0 0 1.2px ${C.glassD},0 4px 10px rgba(91,141,239,.22) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{content:"" !important;position:absolute !important;right:6px !important;top:-7px !important;left:auto !important;bottom:auto !important;width:24px !important;height:18px !important;background:${svg(DROPS2)} center/contain no-repeat !important;border:none !important;transform:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{content:none !important}
/* 他的话：窗边一张白便条，左上斜着一道窗框的影子 */
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:linear-gradient(125deg,rgba(199,219,255,.5) 0 14px,transparent 14px),${C.paper} !important;border:1.4px solid ${C.pink} !important;border-radius:18px 18px 18px 4px !important;box-shadow:0 4px 10px rgba(246,150,190,.18) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{content:"" !important;position:absolute !important;right:-6px !important;top:-8px !important;left:auto !important;bottom:auto !important;width:18px !important;height:18px !important;background:${svg(STAR)} center/contain no-repeat !important;border:none !important;transform:none !important}
[data-wk="msg"][data-first="0"] [data-wk="bubble"][data-kind="text"][data-me="0"]::before,[data-wk="bubble"][data-kind="text"][data-me="0"]::after{content:none !important}

/* 时间：雾里的一行小字，两边一短横 */
[data-wk="time"] > span{min-width:150px !important;background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11px !important;letter-spacing:.12em !important}
[data-wk="time"] > span::before{content:"— " !important}
[data-wk="time"] > span::after{content:" —" !important}
/* 已读：一颗小水滴；已送达一行小字 */
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important}
[data-wk="meta"][data-read="1"]{font-size:0 !important;width:11px !important;height:14px !important;background:${svg(DROP())} center/contain no-repeat !important}
[data-wk="meta"][data-read="1"] *{opacity:0 !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.paper} !important;border:${LINE} !important;border-radius:16px 16px 16px 4px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.drop} !important}

/* 动描：像写在起雾玻璃上的字——没有框，左边一道往下流的水痕 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.ink} !important;opacity:.72 !important;font-style:italic !important;font-size:13px !important;padding-left:14px !important;border-left:2px solid transparent !important;border-image:linear-gradient(180deg,${C.drop},rgba(111,147,176,0)) 1 !important;border-radius:0 !important}
/* 系统提示：不带框的一行小字，前面一把小伞 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.06em !important}
[data-wk="sysnotetext"]::before{content:"☂ " !important}

/* 底栏：白窗框＋上沿一条窗台，左发送右回复 */
[data-wk="composer"]{background:${C.frame} !important;border-top:none !important;box-shadow:0 -3px 0 ${C.pink} !important;align-items:center !important;gap:8px !important}
[data-wk="chatinput"]{background:#F2F7FF !important;border:${LINE} !important;border-radius:14px !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:${C.fog} !important}
[data-wk="chatplus"],[data-wk="send"]{width:30px !important;min-width:30px !important;height:30px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/23px no-repeat !important}
[data-wk="send"]{background:${svg(I_SEND)} center/26px no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{position:relative !important;width:64px !important;min-width:64px !important;height:34px !important;border:none !important;border-radius:17px !important;background:linear-gradient(135deg,#7FB0FF,#B79CFF) !important;box-shadow:0 3px 8px rgba(91,141,239,.3) !important}
[data-wk="chatreply"]::before{content:"回复" !important;position:absolute !important;inset:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;color:#fff !important;font-size:13px !important;letter-spacing:.15em !important;padding-left:14px !important}
[data-wk="chatreply"]::after{content:"" !important;position:absolute !important;left:9px !important;top:50% !important;width:14px !important;height:14px !important;margin-top:-7px !important;background:${svg(UMB)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.92) !important}
`;

const pack = { kind: "chat-look", v: 1, name: "雨天窗边", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "雨天窗边-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
