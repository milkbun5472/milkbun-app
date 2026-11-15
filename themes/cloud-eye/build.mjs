// 云眸入梦：黄昏转紫的夜空，底下一片粉色的云海。每条气泡是一朵云：他的是粉白的云，我的是一朵暗紫的雨云；
// 云里睁着一只发彩虹光的眼睛。头像＝一只石头眼皮的巨眼，照片就是瞳孔。已送达＝闭着的眼，已读＝睁开的眼。
// 用法：node themes/cloud-eye/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const CLOUD = (f, g) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 132 100"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f}"/><stop offset="1" stop-color="${g}"/></linearGradient></defs><path fill="url(#g)" d="M22 92C9 92 2 84 4 74C6 66 12 62 18 62C10 56 10 42 20 36C27 31 36 33 40 38C40 22 52 12 66 14C76 15 82 21 85 28C90 22 100 20 108 26C116 32 116 42 112 48C122 50 130 58 128 70C126 84 116 92 104 92Z"/></svg>`;
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { s1: "#2B1F55", s2: "#4A3285", s3: "#8A4FA8", pink: "#F6B9DC", cloud: "#FFE8F4", cloudD: "#F2C6E0", storm: "#4E4672", stormD: "#36305A", ink: "#5A3A70", fog: "#D8CCEC" };
const SERIF = `"Songti SC","Noto Serif SC","STSong",serif`;

const STARS = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='260'>${Array.from({ length: 36 }, (_, i) => `<circle cx='${(i * 61 + (i % 4) * 13) % 220}' cy='${(i * 43 + (i % 6) * 17) % 260}' r='${[0.6, 0.9, 1.2][i % 3]}' fill='#fff' opacity='${(0.3 + (i % 5) * 0.12).toFixed(2)}'/>`).join("")}</svg>`;
// 一只发彩虹光的眼睛：杏仁形眼白、彩虹虹膜、黑瞳孔、一点高光
const RAINBOW_IRIS = `<defs><linearGradient id='ir' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#FF8AD8'/><stop offset='.25' stop-color='#FFE36A'/><stop offset='.5' stop-color='#6AF0C0'/><stop offset='.75' stop-color='#6AB4FF'/><stop offset='1' stop-color='#C98AFF'/></linearGradient></defs>`;
const EYE = (dark = false) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 22'>${RAINBOW_IRIS}<path d='M2 11 Q20 -4 38 11 Q20 26 2 11Z' fill='#fff' stroke='${dark ? "#fff" : C.ink}' stroke-width='1.6'/><circle cx='20' cy='11' r='7' fill='url(#ir)'/><circle cx='20' cy='11' r='3.3' fill='#1E1430'/><circle cx='17.6' cy='8.6' r='1.6' fill='#fff'/></svg>`;
const SHUT = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 22'><path d='M3 8 Q20 20 37 8' fill='none' stroke='${C.fog}' stroke-width='1.8' stroke-linecap='round'/>${[8, 14, 20, 26, 32].map((x, i) => `<path d='M${x} ${11 + (i === 2 ? 2 : i % 4 ? 1 : 0)} L${x + (x - 20) * 0.15} ${17 + (i === 2 ? 2 : 0)}' stroke='${C.fog}' stroke-width='1.4' stroke-linecap='round'/>`).join("")}</svg>`;
// 头像框：一只石头眼皮的巨眼——灰紫杏仁形的厚眼皮，内圈一道彩虹光环当虹膜，照片是瞳孔
const BIGEYE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 100'>${RAINBOW_IRIS}<defs><linearGradient id='st' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#9C90C8'/><stop offset='1' stop-color='#5E5390'/></linearGradient><mask id='m'><rect width='140' height='100' fill='#fff'/><circle cx='70' cy='50' r='30' fill='#000'/></mask></defs><path d='M4 50 Q70 -16 136 50 Q70 116 4 50Z' fill='url(#st)' stroke='#3E3570' stroke-width='2' mask='url(#m)'/><path d='M20 50 Q70 4 120 50' fill='none' stroke='#C8BEEA' stroke-width='2' opacity='.7' stroke-linecap='round'/><circle cx='70' cy='50' r='33' fill='none' stroke='url(#ir)' stroke-width='5'/><circle cx='70' cy='50' r='30' fill='none' stroke='#fff' stroke-width='1.2' opacity='.8'/></svg>`;
// 云朵的鼓包边
const PUFF = (c) => `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='14'><circle cx='13' cy='14' r='12' fill='${c}'/></svg>`;
const CI = inner => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><path d='M8 28 a6 6 0 0 1 2-11 a9 9 0 0 1 17-3 a7 7 0 0 1 5 14Z' fill='rgba(255,255,255,.12)' stroke='#fff' stroke-width='1.4' stroke-linejoin='round'/>${inner}</svg>`;
const MINIEYE = `<g transform='translate(11 15) scale(.45)'>${EYE().replace(/<svg[^>]*>|<\/svg>/g, "")}</g>`;
// 按键：主页＝一朵小云里一只眼；更多＝三颗星；加号＝云里一个十字；发送＝一道往右飞的流星；最右「让他回复」＝一颗粉云里睁着的大眼
const I_HOUSE = CI(MINIEYE);
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>${[[11, 20], [20, 16], [29, 20]].map(([x, y]) => `<path transform='translate(${x} ${y})' d='M0 -5 Q.4 -.4 3.5 0 Q.4 .4 0 5 Q-.4 .4 -3.5 0 Q-.4 -.4 0 -5Z' fill='#fff'/>`).join("")}</svg>`;
const I_PLUS = CI(`<path d='M20 16 V26 M15 21 H25' stroke='#fff' stroke-width='1.6' stroke-linecap='round'/>`);
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><path d='M6 28 L26 16' stroke='#fff' stroke-width='1.2' stroke-linecap='round' opacity='.5'/><path d='M10 30 L28 19' stroke='#FFC8E6' stroke-width='1.6' stroke-linecap='round' opacity='.7'/><path transform='translate(29 15)' d='M0 -6 Q.5 -.5 4.5 0 Q.5 .5 0 6 Q-.5 .5 -4.5 0 Q-.5 -.5 0 -6Z' fill='#fff'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 52 44'>${RAINBOW_IRIS}<path d='M8 36 a8 8 0 0 1 2-15 a12 12 0 0 1 23-5 a10 10 0 0 1 9 20Z' fill='${C.cloud}' stroke='#fff' stroke-width='1.5' stroke-linejoin='round'/><path d='M14 26 Q26 15 38 26 Q26 37 14 26Z' fill='#fff' stroke='${C.ink}' stroke-width='1.3'/><circle cx='26' cy='26' r='5' fill='url(#ir)'/><circle cx='26' cy='26' r='2.3' fill='#1E1430'/><circle cx='24.5' cy='24.5' r='1' fill='#fff'/></svg>`;

const bubble = { myBg: C.storm, myText: "#fff", myBorder: "none", charBg: C.cloud, charText: C.ink, charBorder: "none", radius: 26, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 云眸入梦 · 第一批 ───── */
[data-wk="chat"]{background:${svg(STARS)} 0 0/220px 260px,radial-gradient(ellipse at 50% 108%,#FFB8DE 0 18%,rgba(246,185,220,.55) 30%,transparent 55%),linear-gradient(180deg,${C.s1} 0%,${C.s2} 45%,${C.s3} 85%,#C46AB0 100%) !important}
[data-wk="chat"] *{font-family:${SERIF} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：不做框，往下淡出，底下一道淡粉细线 */
[data-wk="chathead"]{position:relative !important;overflow:visible !important;background:linear-gradient(180deg,rgba(43,31,85,.9),rgba(43,31,85,0)) !important;border-bottom:none !important;box-shadow:none !important;gap:6px !important;z-index:5 !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:10% !important;right:10% !important;bottom:0 !important;height:1px !important;background:linear-gradient(90deg,transparent,rgba(255,200,230,.8),transparent) !important;pointer-events:none !important}
[data-wk="headink"],[data-wk="headink"] *{color:#fff !important}
[data-wk="headname"] > [data-wk="headink"]{font-weight:700 !important;letter-spacing:.15em !important}
[data-wk="headdim"]{color:${C.fog} !important;white-space:nowrap !important}
[data-wk="chatback"],[data-wk="chatback"] *{color:#fff !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:#fff !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{flex:none !important;width:36px !important;min-width:36px !important;height:36px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chathead"] + *:not([data-wk="body"]),[data-wk="chathead"] + *:not([data-wk="body"]) *{color:#fff !important}

/* 头像：一只石头眼皮的巨眼，照片就是瞳孔，外圈一道彩虹光 */
button[data-wk="avatar"],span[data-wk="avatar"],[data-wk="rpsingle"] [data-wk="avatar"]{position:relative !important;overflow:visible !important;isolation:isolate !important;border-radius:50% !important;box-shadow:0 0 14px 3px rgba(255,200,240,.5) !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{position:relative !important;z-index:1 !important;border-radius:50% !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;left:-42% !important;right:-42% !important;top:-12% !important;bottom:-12% !important;background:${svg(BIGEYE)} center/contain no-repeat !important;z-index:2 !important;pointer-events:none !important;border:none !important;border-radius:0 !important;filter:drop-shadow(0 3px 5px rgba(20,10,50,.45)) !important}
[data-wk="chathead"] button[data-wk="avatar"]::before,[data-wk="chathead"] span[data-wk="avatar"]::before{content:none !important}
[data-wk="chathead"] img[data-wk="avatar"]{box-shadow:0 0 0 2.5px #fff,0 0 0 5px rgba(201,138,255,.6) !important}
[data-wk="msg"] [data-wk="row"]{gap:22px !important}
[data-wk="msg"][data-me="0"] [data-wk="row"]{padding-left:12px !important}
[data-wk="msg"][data-me="1"] [data-wk="row"]{padding-right:12px !important}

/* 气泡：一朵云——上下两排圆鼓鼓的边；他的粉白云，我的暗紫雨云。一串第一条里睁着一只彩虹眼 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;isolation:isolate !important;border:none !important;border-radius:14px !important;letter-spacing:.1em !important;padding:11px 20px !important;margin:16px 16px 12px !important}
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;left:-8px !important;right:-8px !important;top:-9px !important;bottom:-8px !important;z-index:-1 !important;border:none !important;transform:none !important;width:auto !important;height:auto !important;pointer-events:none !important;border-radius:24px !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:#FDEAF4 !important;color:${C.ink} !important;box-shadow:0 0 22px 6px rgba(255,190,225,.5) !important;filter:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{background:radial-gradient(circle,#FDEAF4 10.5px,transparent 13px) 4px 0/31px 26px repeat-x,radial-gradient(circle,#FDEAF4 7.5px,transparent 10px) 15px 5px/23px 20px repeat-x,radial-gradient(circle,#FDEAF4 11.5px,transparent 14px) 26px 1px/43px 28px repeat-x,radial-gradient(circle,#FDEAF4 8.5px,transparent 11px) 9px calc(100% - 2px)/27px 22px repeat-x,radial-gradient(circle,#FDEAF4 10.5px,transparent 13px) 0 100%/37px 26px repeat-x,radial-gradient(circle,#FDEAF4 6.5px,transparent 9px) 12px calc(100% - 5px)/19px 18px repeat-x,radial-gradient(circle,#FDEAF4 8.5px,transparent 11px) 0 3px/22px 21px repeat-y,radial-gradient(circle,#FDEAF4 6.5px,transparent 9px) 4px 12px/18px 17px repeat-y,radial-gradient(circle,#FDEAF4 8.5px,transparent 11px) 100% 6px/22px 23px repeat-y,radial-gradient(circle,#FDEAF4 6.5px,transparent 9px) calc(100% - 4px) 0/18px 15px repeat-y !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:#5A5288 !important;color:#fff !important;box-shadow:0 0 20px 5px rgba(150,130,220,.45) !important;filter:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{background:radial-gradient(circle,#5A5288 10.5px,transparent 13px) 4px 0/31px 26px repeat-x,radial-gradient(circle,#5A5288 7.5px,transparent 10px) 15px 5px/23px 20px repeat-x,radial-gradient(circle,#5A5288 11.5px,transparent 14px) 26px 1px/43px 28px repeat-x,radial-gradient(circle,#5A5288 8.5px,transparent 11px) 9px calc(100% - 2px)/27px 22px repeat-x,radial-gradient(circle,#5A5288 10.5px,transparent 13px) 0 100%/37px 26px repeat-x,radial-gradient(circle,#5A5288 6.5px,transparent 9px) 12px calc(100% - 5px)/19px 18px repeat-x,radial-gradient(circle,#5A5288 8.5px,transparent 11px) 0 3px/22px 21px repeat-y,radial-gradient(circle,#5A5288 6.5px,transparent 9px) 4px 12px/18px 17px repeat-y,radial-gradient(circle,#5A5288 8.5px,transparent 11px) 100% 6px/22px 23px repeat-y,radial-gradient(circle,#5A5288 6.5px,transparent 9px) calc(100% - 4px) 0/18px 15px repeat-y !important}
[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"]{padding-right:50px !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"]::after{content:"" !important;position:absolute !important;right:14px !important;top:50% !important;width:30px !important;height:17px !important;margin-top:-9px !important;background:${svg(EYE())} center/contain no-repeat !important;border:none !important;transform:none !important;left:auto !important;bottom:auto !important;animation:ceBlink 5s ease-in-out infinite !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="1"]{padding-right:20px !important;padding-left:50px !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="1"]::after{right:auto !important;left:14px !important;background:${svg(EYE(true))} center/contain no-repeat !important}
@keyframes ceBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}

/* 时间：一行淡紫小字 */
[data-wk="time"] > span{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.fog} !important;letter-spacing:.3em !important;font-size:11.5px !important}
/* 已送达＝闭着的眼；已读＝睁开的彩虹眼 */
[data-wk="meta"]{color:${C.fog} !important;font-size:11px !important;letter-spacing:.12em !important;display:inline-flex !important;align-items:center !important;gap:8px !important}
[data-wk="meta"]::after{content:"" !important;width:20px !important;height:11px !important;flex:none !important;background:${svg(SHUT)} center/contain no-repeat !important}
[data-wk="meta"][data-read="1"]::after{background:${svg(EYE(true))} center/contain no-repeat !important;filter:drop-shadow(0 0 4px rgba(255,200,240,.8)) !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.cloud} !important;border:none !important;border-radius:26px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.ink} !important}
[data-wk="name"]{color:${C.fog} !important}

/* 动描：一缕飘着的薄云，字是粉白斜体，左边一只半睁的眼 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"],[data-wk="myactink"]{position:relative !important;display:block !important;background:radial-gradient(ellipse at 50% 50%,rgba(255,220,240,.22),transparent 72%) !important;border:none !important;border-radius:40px !important;box-shadow:none !important;color:#FFE4F2 !important;font-style:italic !important;font-size:13px !important;line-height:1.9 !important;letter-spacing:.08em !important;text-shadow:0 0 8px rgba(255,190,225,.5) !important;padding:8px 18px 8px 44px !important}
[data-wk="narrink"]::before,[data-wk="myactink"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:24px !important;height:13px !important;margin-top:-7px !important;background:${svg(EYE(true))} center/contain no-repeat !important;opacity:.85 !important}
[data-wk="myactink"]{padding:8px 44px 8px 18px !important;text-align:right !important}
[data-wk="myactink"]::before{left:auto !important;right:12px !important}
[data-wk="narrbar"]{background:rgba(43,31,85,.95) !important;border-top:1px solid rgba(255,200,230,.4) !important}
[data-wk="narrkind"]{border:1px solid rgba(216,204,236,.5) !important;border-radius:999px !important;background:transparent !important;color:${C.fog} !important}
[data-wk="narrkind"][data-on="1"]{background:${C.cloud} !important;border-color:${C.cloud} !important;color:${C.ink} !important}
/* 系统提示：一行小字，两头各一颗星 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{display:inline-block !important;background:radial-gradient(circle,#fff 1.4px,transparent 2px) left center/8px 8px no-repeat,radial-gradient(circle,#fff 1.4px,transparent 2px) right center/8px 8px no-repeat !important;border:none !important;color:${C.fog} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.12em !important;padding:0 16px !important}
[data-wk="sysnoteclose"]{color:${C.fog} !important}

/* 底栏：不做框，往上透出底下那片粉云，上沿一道淡粉线；最右「让他回复」＝粉云里睁着的大眼 */
[data-wk="composer"]{position:relative !important;background:linear-gradient(180deg,rgba(196,106,176,0),rgba(150,80,160,.6)) !important;border-top:none !important;box-shadow:none !important;align-items:center !important;gap:10px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:10% !important;right:10% !important;top:0 !important;height:1px !important;background:linear-gradient(90deg,transparent,rgba(255,200,230,.8),transparent) !important;pointer-events:none !important}
[data-wk="chatinput"]{background:rgba(255,255,255,.14) !important;border:1px solid rgba(255,220,240,.6) !important;border-radius:999px !important;color:#fff !important}
[data-wk="chatinput"]::placeholder{color:#F4DDF0 !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{width:36px !important;min-width:36px !important;height:36px !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{width:36px !important;min-width:36px !important;height:36px !important;background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:52px !important;min-width:52px !important;height:44px !important;background:${svg(I_REPLY)} center/contain no-repeat !important;filter:drop-shadow(0 0 10px rgba(255,200,235,.8)) !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.9) !important}
[data-wk="chatpanel"]{background:rgba(43,31,85,.96) !important;border-top:1px solid rgba(255,200,230,.4) !important}
[data-wk="quotedraft"]{position:relative !important;z-index:3 !important}
`;

const pack = { kind: "chat-look", v: 1, name: "云眸入梦", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "云眸入梦-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
