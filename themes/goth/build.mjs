// 哥特蕾丝：深梅底、暗纹四叶花；顶栏下滴着酒红糖浆，头像是尖拱窗，气泡侧边一条束腰交叉系带（每串第一条打一个蝴蝶结）。用法：node themes/goth/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { bg: "#1D1219", bar: "#160D13", wine: "#8A2846", red: "#C8234D", pink: "#E68CA9", ink: "#F3E9EE", fog: "#9C8790", line: "#F3E9EE", dark: "#1A1016" };
const W = "1.6px solid " + C.line;

const QUAT = `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 44 44' fill='none' stroke='rgba(230,140,169,.07)' stroke-width='1.2'><path d='M22 14 C26 10 30 14 26 18 C30 22 26 26 22 22 C18 26 14 22 18 18 C14 14 18 10 22 14Z'/><path d='M0 36 C4 32 8 36 4 40 M44 36 C40 32 36 36 40 40'/></svg>`;
const LACE = `<svg xmlns='http://www.w3.org/2000/svg' width='18' height='12' viewBox='0 0 18 12'><path d='M4 3 L14 9 M14 3 L4 9' stroke='${C.pink}' stroke-width='1.3'/><circle cx='4' cy='3' r='1.8' fill='${C.dark}' stroke='${C.line}' stroke-width='1'/><circle cx='14' cy='3' r='1.8' fill='${C.dark}' stroke='${C.line}' stroke-width='1'/></svg>`;
const BOW = (c) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 20' fill='${c}' stroke='${C.line}' stroke-width='1.2' stroke-linejoin='round'><path d='M13 8 C8 2 2 3 3 8 C4 12 9 11 13 8Z'/><path d='M13 8 C18 2 24 3 23 8 C22 12 17 11 13 8Z'/><path d='M13 8 L9 18 M13 8 L17 18' fill='none'/><circle cx='13' cy='8' r='2.2'/></svg>`;
const DRIP = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='70' viewBox='0 0 240 70'><path d='M-2 13 H2 Q14 22 26 13 Q31 19 35 18.5 C35 26 33.5 26 33.5 31 A4.6 4.6 0 1 0 42.5 31 C42.5 26 41 26 41 18.5 Q45 19 50 13 Q62 22 74 13 Q79 19 83 18.5 C83 26 81.5 20 81.5 25 A4.6 4.6 0 1 0 90.5 25 C90.5 20 89 26 89 18.5 Q93 19 98 13 Q103 19 107 18.5 C107 26 105.5 38 105.5 43 A4.6 4.6 0 1 0 114.5 43 C114.5 38 113 26 113 18.5 Q117 19 122 13 Q134 22 146 13 Q151 19 155 18.5 C155 26 153.5 22 153.5 27 A4.6 4.6 0 1 0 162.5 27 C162.5 22 161 26 161 18.5 Q165 19 170 13 Q182 22 194 13 Q199 19 203 18.5 C203 26 201.5 32 201.5 37 A4.6 4.6 0 1 0 210.5 37 C210.5 32 209 26 209 18.5 Q213 19 218 13 Q230 22 242 13 H242 V-2 H-2Z' fill='${C.wine}' stroke='${C.line}' stroke-width='1.4' stroke-linejoin='round'/><path d='M8 7 H60 M92 7 H150 M178 7 H232' stroke='rgba(243,233,238,.3)' stroke-width='1.4' stroke-linecap='round'/><path d='M110 62 Q110 57 112.5 54 Q115 57 115 62 A2.5 2.5 0 0 1 110 62Z' fill='${C.red}' stroke='${C.line}' stroke-width='.8'/><circle cx='38' cy='44' r='1.8' fill='${C.red}'/></svg>`;
const SPIRE = `<svg xmlns='http://www.w3.org/2000/svg' width='46' height='54' viewBox='0 0 46 54' fill='none' stroke='${C.line}' stroke-width='1.3'><path d='M0 53 Q0 32 23 30 Q46 32 46 53'/><path d='M23 30 V12'/><circle cx='23' cy='10' r='2' fill='${C.line}'/><path d='M19 20 L23 16 L27 20'/><path d='M0 53.3 H46' stroke-width='1.6'/></svg>`;
const STAR = (c) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8Z' fill='${c}'/></svg>`;
const BATHEART = (fill, stroke) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 24' fill='none' stroke='${stroke}' stroke-width='1.3' stroke-linejoin='round'><path d='M20 8 C14 3 6 3 2 7 C6 8 7 10 6 13 C9 11 11 13 11 15 C13 13 16 14 18 15'/><path d='M36 8 C42 3 50 3 54 7 C50 8 49 10 50 13 C47 11 45 13 45 15 C43 13 40 14 38 15'/><path d='M28 22 C18 15 17 11 17 9 C17 6 19.5 4 22.5 4 C25 4 27 5.5 28 7.5 C29 5.5 31 4 33.5 4 C36.5 4 39 6 39 9 C39 11 38 15 28 22Z' fill='${fill}'/></svg>`;
const ARCH = (inner) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 40' fill='none' stroke='${C.line}' stroke-width='1.6' stroke-linejoin='round'><path d='M2 39 V16 Q2 2 18 1.5 Q34 2 34 16 V39Z' fill='${C.dark}'/>${inner}</svg>`;
const I_PLUS = ARCH(`<path d='M18 18 V32 M11 25 H25' stroke-linecap='round'/>`);
const I_REPLY = ARCH(`<path d='M9 19 H27 Q29 19 29 21 V27 Q29 29 27 29 H16 L12 32 V29 H9 Q7 29 7 27 V21 Q7 19 9 19Z'/>`);
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 34' fill='none' stroke='${C.line}' stroke-width='1.6' stroke-linejoin='round'><path d='M15 0 L16.2 4.8 L21 6 L16.2 7.2 L15 12 L13.8 7.2 L9 6 L13.8 4.8Z' fill='${C.pink}' stroke='none'/><path d='M4 22 L15 13 L26 22 V32 H4Z'/><path d='M12.5 32 V25 Q15 22.5 17.5 25 V32'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 50' stroke-linejoin='round'><path d='M26 18 C18 8 8 9 2 16 C8 16 10 20 8 25 C13 22 16 25 16 29 C19 26 23 27 26 30' fill='none' stroke='${C.line}' stroke-width='1.5'/><path d='M54 18 C62 8 72 9 78 16 C72 16 70 20 72 25 C67 22 64 25 64 29 C61 26 57 27 54 30' fill='none' stroke='${C.line}' stroke-width='1.5'/><path d='M40 48 C24 37 21 30 21 22 C21 14 27 9 33 9 C36.5 9 39 11 40 13.5 C41 11 43.5 9 47 9 C53 9 59 14 59 22 C59 30 56 37 40 48Z' fill='${C.red}' stroke='${C.line}' stroke-width='1.6'/><path d='M40 38 V20 M34 26 L40 20 L46 26' fill='none' stroke='${C.line}' stroke-width='2' stroke-linecap='round'/></svg>`;

const I_PIC = ARCH(`<rect x='9' y='19' width='18' height='13'/><circle cx='14' cy='23.5' r='1.6'/><path d='M9.5 31 L16 25.5 L20 29 L23 26.5 L26.5 30'/>`);
const SEAL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><path d='M20 2 C25 2 27 5 31 6 C35 8 36 12 37 16 C39 20 38 25 36 29 C34 34 29 36 25 38 C20 39 15 38 11 36 C6 33 3 29 2.5 24 C2 19 3 14 6 10 C9 5 14 2 20 2Z' fill='${C.red}'/><circle cx='20' cy='20' r='12' fill='none' stroke='rgba(255,255,255,.35)' stroke-width='1.2'/><path d='M20 27 C13 22 12.5 19.5 12.5 18 C12.5 15.5 14.5 14 16.5 14 C18 14 19.3 15 20 16.2 C20.7 15 22 14 23.5 14 C25.5 14 27.5 15.5 27.5 18 C27.5 19.5 27 22 20 27Z' fill='none' stroke='#fff' stroke-width='1.5'/></svg>`;
const bubble = { myBg: C.wine, myText: C.ink, myBorder: W, charBg: C.dark, charText: C.ink, charBorder: W, radius: 6, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 哥特蕾丝 · 第一批 ───── */
[data-wk="chat"]{background:${svg(QUAT)} 0 0/44px 44px,radial-gradient(circle at 50% 30%,#2A1822,${C.bg} 70%) !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：深色；底下挂一条酒红糖浆帘子往下滴 */
[data-wk="chathead"]{background:${C.bar} !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;overflow:visible !important;z-index:5 !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:100% !important;height:63px !important;background:${svg(DRIP)} 0 0/216px 63px repeat-x !important;pointer-events:none !important;z-index:5 !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important}
[data-wk="headname"] [data-wk="headink"]{font-family:Georgia,"Songti SC",serif !important;letter-spacing:.12em !important}
[data-wk="chat"] [data-wk="headname"] > div:last-child::before{content:"my dearest · " !important;font:italic 11px/1 Georgia,serif !important;color:${C.pink} !important;letter-spacing:.04em !important}
[data-wk="headdim"],[data-wk="headname"] > div:last-child{color:${C.fog} !important}
[data-wk="chatback"] svg{stroke:${C.ink} !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:30px !important;min-width:30px !important;height:30px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important;flex-shrink:0 !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important;margin-left:auto !important}
[data-wk="chatmore"]{width:46px !important;min-width:46px !important;background:${svg(BATHEART(C.red, C.line))} center/contain no-repeat !important;margin-left:6px !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 头像：尖拱窗——白线框，顶上一颗小星 */
button[data-wk="avatar"],span[data-wk="avatar"],[data-wk="chathead"] [data-wk="avatar"]{border-radius:50% 50% 3px 3px / 32% 32% 3px 3px !important;box-shadow:0 0 0 1.6px ${C.line},0 0 0 4px ${C.bg},0 0 0 5.4px rgba(243,233,238,.5) !important;position:relative !important;overflow:visible !important}
button[data-wk="avatar"] *,span[data-wk="avatar"] *,[data-wk="chathead"] [data-wk="avatar"] *{border-radius:50% 50% 3px 3px / 32% 32% 3px 3px !important}
[data-wk="msg"] [data-wk="avatar"]::before,[data-wk="cardrow"] [data-wk="avatar"]::before{content:"" !important;position:absolute !important;left:calc(50% - 6px) !important;top:-17px !important;width:12px !important;height:12px !important;background:${svg(STAR(C.line))} center/contain no-repeat !important;z-index:2 !important}
[data-first="0"] [data-wk="avatar"]::before{content:none !important}
[data-wk="chathead"] [data-wk="headme"] *,[data-wk="chathead"] [data-wk="avatar"] *,[data-wk="chathead"] img,[data-wk="chathead"] button > span:first-child,[data-wk="chathead"] button > span:first-child *{border-radius:50% 50% 3px 3px / 32% 32% 3px 3px !important;overflow:hidden !important}
/* 顶栏双头像：两扇拱窗并排，中间一颗蝙蝠翅膀小心 */
[data-wk="chathead"] [data-wk="headme"]{display:inline-flex !important;position:relative !important;overflow:visible !important;margin-left:-4px !important;flex-shrink:0 !important}
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img,[data-wk="chathead"] [data-wk="avatar"]{width:34px !important;height:38px !important;min-width:34px !important;flex-shrink:0 !important;overflow:hidden !important}
img[data-wk="avatar"]{overflow:hidden !important}
[data-wk="chathead"] [data-wk="headme"]::before{content:"" !important;position:absolute !important;left:-17px !important;bottom:-6px !important;width:30px !important;height:14px !important;z-index:3 !important;background:${svg(BATHEART(C.red, C.line))} center/contain no-repeat !important}
[data-wk="offline"] [data-wk="chathead"] [data-wk="headme"]{display:none !important}

/* 拱窗要瘦高，像参考里的鸟笼——宽 38 高 50，照片铺满 */
[data-wk="msg"] button[data-wk="avatar"],[data-wk="msg"] span[data-wk="avatar"],[data-wk="cardrow"] button[data-wk="avatar"],[data-wk="cardrow"] span[data-wk="avatar"]{width:38px !important;min-width:38px !important;height:50px !important}
[data-wk="msg"] [data-wk="avatar"] img,[data-wk="cardrow"] [data-wk="avatar"] img,[data-wk="msg"] img[data-wk="avatar"],[data-wk="cardrow"] img[data-wk="avatar"]{width:100% !important;height:100% !important;object-fit:cover !important}
[data-wk="msg"] img[data-wk="avatar"],[data-wk="cardrow"] img[data-wk="avatar"]{width:38px !important;height:50px !important}
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img,[data-wk="chathead"] [data-wk="avatar"]{width:30px !important;min-width:30px !important;height:40px !important;object-fit:cover !important}

/* 气泡：方角白线；靠头像那一侧一条束腰交叉系带，每串第一条在系带顶上打一个蝴蝶结 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border:${W} !important;border-radius:6px !important;box-shadow:3px 3px 0 rgba(0,0,0,.35) !important;color:${C.ink} !important;font-family:Georgia,"Songti SC",serif !important;letter-spacing:.06em !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${C.wine} !important;padding:10px 34px 10px 18px !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.dark} !important;padding:10px 18px 10px 34px !important}
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;top:4px !important;bottom:4px !important;width:18px !important;height:auto !important;background:${svg(LACE)} center top/18px 12px repeat-y !important;border:none !important;transform:none !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{right:6px !important;left:auto !important;border-left:1px solid rgba(243,233,238,.35) !important;padding-left:2px !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{left:6px !important;right:auto !important;border-right:1px solid rgba(243,233,238,.35) !important}
[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-first="1"] [data-wk="bubble"][data-kind="text"]::after,[data-wk="msg"]:not([data-first]) [data-wk="bubble"][data-kind="text"]::after{content:"" !important;position:absolute !important;top:-9px !important;width:24px !important;height:18px !important;border:none !important;transform:none !important;z-index:2 !important}
[data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="1"]::after,[data-wk="msg"]:not([data-first]) [data-wk="bubble"][data-kind="text"][data-me="1"]::after{right:3px !important;left:auto !important;background:${svg(BOW(C.dark))} center/contain no-repeat !important}
[data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="0"]::after,[data-wk="msg"]:not([data-first]) [data-wk="bubble"][data-kind="text"][data-me="0"]::after{left:3px !important;right:auto !important;background:${svg(BOW(C.wine))} center/contain no-repeat !important}

/* 时间：一块用两条链子吊着的小牌子，切角、里面一道虚线框（照参考），下面一颗粉星 */
[data-wk="time"]{position:relative !important;padding-top:44px !important;padding-bottom:18px !important}
[data-wk="time"] > span{position:relative !important;display:inline-block !important;background:${C.dark} !important;border:1.4px solid ${C.line} !important;border-radius:3px !important;color:${C.ink} !important;font-family:Georgia,serif !important;letter-spacing:.2em !important;font-size:12px !important;padding:7px 26px !important;outline:1px dashed rgba(243,233,238,.7) !important;outline-offset:-5px !important}
[data-wk="time"]::before{content:"" !important;position:absolute !important;left:calc(50% - 44px) !important;top:14px !important;width:88px !important;height:30px !important;border-left:2px dotted ${C.line} !important;border-right:2px dotted ${C.line} !important}
[data-wk="time"]::after{content:"" !important;position:absolute !important;left:calc(50% - 6px) !important;bottom:0 !important;width:12px !important;height:12px !important;background:${svg(STAR(C.pink))} center/contain no-repeat !important}

/* 已读：一行小字，旁边一颗蝙蝠翅膀小心——他的实心红、我的空心 */
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important;letter-spacing:.15em !important;display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"]::before{content:"" !important;width:28px !important;height:12px !important;background:${svg(BATHEART(C.red, C.line))} center/contain no-repeat !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]{flex-direction:row-reverse !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]::before{background:${svg(BATHEART("none", C.line))} center/contain no-repeat !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-run][data-last="1"] + [data-wk="cardmeta"]{display:block !important;font-size:10.5px !important;color:${C.fog} !important;padding:2px 0 0 62px !important}
[data-run][data-last="1"] + [data-wk="cardmeta"][data-me="1"]{text-align:right !important;padding:2px 62px 0 0 !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.dark} !important;border:${W} !important;border-radius:6px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.pink} !important}

/* 动描：不进气泡——一段烛光下的手写信：两头各一朵小十字花，深梅半透明底，粉灰斜体 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{display:block !important;background:rgba(138,40,70,.14) !important;border:none !important;border-top:1px solid rgba(230,140,169,.35) !important;border-bottom:1px solid rgba(230,140,169,.35) !important;border-radius:0 !important;box-shadow:none !important;color:#D9B8C6 !important;opacity:1 !important;font-family:Georgia,"Songti SC",serif !important;font-style:italic !important;font-size:13px !important;line-height:1.85 !important;padding:10px 20px !important;text-align:center !important}
[data-wk="narrink"]::before,[data-wk="narrink"]::after{content:"✠" !important;color:${C.pink} !important;font-style:normal !important;margin:0 8px !important;opacity:.8 !important}
/* 系统提示：不带框，等宽小字，前面一颗小星 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.1em !important}
[data-wk="sysnotetext"]::before{content:"✦ " !important;color:${C.pink} !important}

/* 底栏：顶上一排尖拱蕾丝花边；加号、回复是两扇小拱门，发送是一颗带蝙蝠翅膀的红心 */
[data-wk="composer"]{background:${C.bar} !important;border-top:1.6px solid ${C.line} !important;position:relative !important;overflow:visible !important;align-items:center !important;gap:8px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:100% !important;height:40px !important;background:${svg(SPIRE)} 0 100%/34px 40px repeat-x !important;pointer-events:none !important}
[data-wk="chatinput"]{background:${C.dark} !important;border:${W} !important;border-radius:6px !important;color:${C.ink} !important;padding-left:34px !important;background-image:${svg(LACE)} !important;background-repeat:repeat-y !important;background-size:18px 12px !important;background-position:8px 50% !important}
[data-wk="chatinput"]::placeholder{color:${C.fog} !important}
[data-wk="chatplus"]{width:34px !important;min-width:34px !important;height:38px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{width:62px !important;min-width:62px !important;height:40px !important;border:none !important;border-radius:0 !important;box-shadow:none !important;background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:34px !important;min-width:34px !important;height:38px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]{transform:none !important;rotate:none !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.92) !important}
/* ───── 哥特蕾丝 · 第二批：卡片（形状不动；深色底白线框，左边一条束腰系带，像一封封黑色请柬） ───── */
[data-wk="transfercard"],[data-wk="photocard"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"],[data-wk="rpcard"]{position:relative !important;overflow:visible !important;background:${C.dark} !important;border:${W} !important;border-radius:6px !important;box-shadow:3px 3px 0 rgba(0,0,0,.35),inset 0 0 0 4px ${C.dark},inset 0 0 0 5px rgba(243,233,238,.35) !important;color:${C.ink} !important}
[data-wk="transfercard"] *,[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *,[data-wk="photocard"] *,[data-wk="wxcard"] *{color:${C.ink} !important;border-color:rgba(243,233,238,.2) !important}
/* 转账：一张黑请柬——金额粉色衬线大字；收下在右上按一枚红色火漆印 */
[data-wk="transfercard"]{padding-top:22px !important}
[data-wk="transfercard"]::before{content:"✠  INVITATION  ✠" !important;position:absolute !important;left:0 !important;right:0 !important;top:9px !important;text-align:center !important;font:italic 10px/1 Georgia,serif !important;letter-spacing:.25em !important;color:${C.pink} !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:${C.pink} !important;font-family:Georgia,serif !important}
[data-wk="transferrule"]{border:none !important;height:1px !important;background:linear-gradient(90deg,transparent,${C.pink},transparent) !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:rgba(138,40,70,.25) !important;border-top:1px solid rgba(243,233,238,.25) !important}
[data-wk="transferbtn"]{border-radius:4px !important}
[data-wk="transferbtn"][data-part="take"]{background:${C.wine} !important;border:${W} !important}
[data-wk="transferbtn"][data-part="back"]{background:transparent !important;border:1px solid rgba(243,233,238,.4) !important}
[data-wk="transferseal"]{background:transparent !important;border:none !important;box-shadow:none !important;color:transparent !important;width:46px !important;height:46px !important;background:${svg(SEAL)} center/contain no-repeat !important;font-size:0 !important}
[data-wk="transferseal"] *{opacity:0 !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{transform:rotate(-12deg) !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.55 !important}
[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"]{filter:grayscale(1) !important}
/* 红包：不是信封——酒红小匣子，左边一颗大蝠翼红心，四角四颗小星；领完褪成暗红 */
[data-wk="rpcard"]{background:${C.wine} !important;padding-left:64px !important}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:6px !important;top:calc(50% - 18px) !important;width:56px !important;height:36px !important;background:${svg(I_SEND.replace("M40 38 V20 M34 26 L40 20 L46 26","M40 22 V22"))} center/contain no-repeat !important;z-index:2 !important}
[data-wk="rpcard"]::after{content:"" !important;position:absolute !important;right:8px !important;top:8px !important;width:10px !important;height:10px !important;background:${svg(STAR(C.line))} center/contain no-repeat !important}
[data-wk="rpcard"] *{color:${C.ink} !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"][data-status="done"]{background:#4A1E2D !important;opacity:.7 !important}
[data-wk="rpenvelope"]{background:${svg(QUAT)} 0 0/44px 44px,${C.wine} !important;border:${W} !important;border-radius:10px !important;box-shadow:inset 0 0 0 5px ${C.wine},inset 0 0 0 6px rgba(243,233,238,.5),0 10px 30px rgba(0,0,0,.5) !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:transparent !important;border:none !important}
[data-wk="rpenvelope"] *{color:${C.ink} !important}
[data-wk="rpenvelope"][data-stage="open"]{background:${svg(QUAT)} 0 0/44px 44px,${C.dark} !important}
[data-wk="rpopenbtn"]{background:${C.red} !important;border:${W} !important;box-shadow:0 0 0 4px ${C.wine},0 0 0 5.4px rgba(243,233,238,.5) !important}
[data-wk="rpopenbtn"] *{color:#fff !important}
[data-wk="rpamount"]{color:${C.pink} !important;font-family:Georgia,serif !important}
/* 照片：拱窗里一张画；语音：黑色小条，侧边一截系带 */
[data-wk="photocard"]{padding:10px 10px 12px !important}
[data-wk="photoface"]{border-radius:50% 50% 3px 3px / 26% 26% 3px 3px !important;background:#2A1822 !important;border:1.2px solid rgba(243,233,238,.5) !important}
[data-wk="photoface"] *,[data-wk="phototext"],[data-wk="photocap"],[data-wk="photohint"]{color:${C.ink} !important}
[data-wk="photoface"] svg{stroke:${C.pink} !important}
[data-wk="voice"][data-me]{position:relative !important;background:${C.dark} !important;border:${W} !important;border-radius:6px !important;padding-left:34px !important;overflow:visible !important}
[data-wk="voice"][data-me="1"]{background:${C.wine} !important}
[data-wk="voice"][data-me]::before{content:"" !important;position:absolute !important;left:6px !important;top:4px !important;bottom:4px !important;width:18px !important;background:${svg(LACE)} center top/18px 12px repeat-y !important}
[data-wk="voice"] > *{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.ink} !important}
[data-wk="voicewave"] span{background:${C.pink} !important}
/* 天气、位置、名片 */
[data-wk="wxcardsky"]{background:radial-gradient(circle at 80% 20%,rgba(200,35,77,.3),transparent 60%),transparent !important}
[data-wk="wxcardsky"] > div:first-child{background:radial-gradient(circle,rgba(230,140,169,.25),transparent 70%) !important}
[data-wk="wxcardsky"] svg{stroke:${C.pink} !important}
[data-wk="wxcardsky"] span[style*="999"],[data-wk="wxcardrain"]{background:transparent !important;border:1px solid rgba(243,233,238,.5) !important;border-radius:4px !important}
[data-wk="wxcardtemp"]{font-family:Georgia,serif !important}
[data-wk="wxcardsay"]{background:rgba(138,40,70,.2) !important;border-top:1px solid rgba(243,233,238,.25) !important}
[data-wk="geopin"]{background:${C.red} !important;border-radius:50% 50% 50% 0 !important;box-shadow:0 0 0 2px ${C.line} !important}
[data-wk="geopinstem"]{background:${C.line} !important}
[data-wk="namecard"] img{border-radius:50% 50% 3px 3px / 32% 32% 3px 3px !important;box-shadow:0 0 0 1.6px ${C.line} !important}
/* 拍一拍、通话结束：两颗小星夹着一行衬线小字 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:transparent !important;border:none !important;color:${C.ink} !important;font-family:Georgia,"Songti SC",serif !important;padding:2px 22px !important;font-size:12px !important;letter-spacing:.1em !important;background:${svg(STAR(C.pink))} left center/10px 10px no-repeat,${svg(STAR(C.pink))} right center/10px 10px no-repeat !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.pink} !important}
[data-wk="note"][data-part="callsum"]{color:${C.fog} !important}
/* 线下小结 */
[data-wk="offlogtitle"]{font-family:Georgia,serif !important;font-style:italic !important;letter-spacing:.2em !important;color:${C.pink} !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.pink} !important}
[data-wk="offlogtranscript"]{border-top:1px solid rgba(243,233,238,.25) !important}
/* 加号面板：一扇扇小拱门，黑和酒红交替 */
[data-wk="chatpanel"]{background:${C.bar} !important;border-top:1.6px solid ${C.line} !important}
[data-wk="chattoolicon"]{background:${C.dark} !important;border:${W} !important;border-radius:50% 50% 4px 4px / 36% 36% 4px 4px !important;box-shadow:none !important}
[data-wk="chattool"]:nth-child(odd) [data-wk="chattoolicon"]{background:${C.wine} !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.ink} !important;color:${C.ink} !important}
[data-wk="chattoollabel"]{color:${C.fog} !important}
/* 引用三处：左边一截系带 */
[data-wk="quotedraft"]{background:${C.bar} !important;border-top:none !important}
[data-wk="quote"]{position:relative !important;background:${C.dark} !important;color:${C.ink} !important;border:1px solid rgba(243,233,238,.4) !important;border-radius:4px !important;padding-left:30px !important;opacity:1 !important;background-image:${svg(LACE)} !important;background-repeat:repeat-y !important;background-size:18px 12px !important;background-position:6px 50% !important}
[data-wk="quote"][data-me="1"]{background-color:${C.wine} !important}
[data-wk="quoteicon"],[data-wk="quoteclear"]{color:${C.pink} !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:1.5px solid ${C.pink} !important;padding-left:8px !important;opacity:.75 !important}
/* 线下：提示键、照片键也是小拱门 */
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:28px !important;height:32px !important;background:${svg(I_PLUS)} center/contain no-repeat !important;border:none !important;box-shadow:none !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:30px !important;min-width:30px !important;height:34px !important;border:none !important;box-shadow:none !important;font-size:0 !important;background:${svg(I_PIC)} center/contain no-repeat !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}
/* ───── 哥特蕾丝 · 第三批：状态卡是一扇黑色哥特窗——顶上一截糖浆帘，里面一块块请柬卡，侧边系带 ───── */
[data-wk="statecard"]{position:relative !important;background:${svg(QUAT)} 0 0/44px 44px,${C.bg} !important;border:${W} !important;border-radius:8px !important;box-shadow:inset 0 0 0 5px ${C.bg},inset 0 0 0 6px rgba(243,233,238,.4),0 12px 30px rgba(0,0,0,.5) !important;--sc-heart-ink:${C.red} !important}
[data-wk="statehead"]{background:${C.bar} !important;border-bottom:${W} !important;position:relative !important}
[data-wk="statehead"] *{color:${C.ink} !important}
[data-wk="statehead"] [data-wk="avatar"],[data-wk="statehead"] [data-wk="avatar"] *{border-radius:50% 50% 3px 3px / 32% 32% 3px 3px !important;overflow:hidden !important}
[data-wk="statehead"] button{border:${W} !important;border-radius:50% 50% 3px 3px / 40% 40% 3px 3px !important;background:${C.dark} !important}
[data-wk="statemood"]{display:inline-block !important;background:${C.wine} !important;border:1.2px solid ${C.line} !important;color:${C.ink} !important;padding:1px 10px !important;margin-right:4px !important;border-radius:3px !important;font-family:Georgia,"Songti SC",serif !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:${C.dark} !important;border:${W} !important;border-radius:4px !important;padding:3px !important;margin:14px 16px !important}
[data-wk="statecard"] button[aria-pressed]{color:${C.fog} !important;border:none !important;border-radius:2px !important;background:transparent !important;font-family:Georgia,"Songti SC",serif !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:${C.wine} !important;color:${C.ink} !important}
[data-wk="stateseen"],[data-wk="statevoice"]{position:relative !important;overflow:visible !important;background:${C.dark} !important;border:${W} !important;border-radius:6px !important;margin:18px 16px 12px !important;padding-left:40px !important;color:${C.ink} !important;box-shadow:3px 3px 0 rgba(0,0,0,.35) !important}
[data-wk="statevoice"]{background:${C.wine} !important}
[data-wk="stateseen"]::before,[data-wk="statevoice"]::before{content:"" !important;position:absolute !important;left:8px !important;top:6px !important;bottom:6px !important;width:18px !important;background:${svg(LACE)} center top/18px 12px repeat-y !important;border-right:1px solid rgba(243,233,238,.35) !important;padding-right:4px !important}
[data-wk="stateseen"]::after,[data-wk="statevoice"]::after{content:"" !important;position:absolute !important;left:5px !important;top:-9px !important;width:24px !important;height:18px !important;background:${svg(BOW(C.wine))} center/contain no-repeat !important}
[data-wk="statevoice"]::after{background:${svg(BOW(C.dark))} center/contain no-repeat !important}
[data-wk="stateseen"] *,[data-wk="statevoice"] *{color:${C.ink} !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:rgba(138,40,70,.2) !important;border:1px solid rgba(243,233,238,.35) !important;border-radius:3px !important}
[data-wk="statewear"] > span{background:transparent !important;border:1px solid rgba(243,233,238,.35) !important;border-radius:2px !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:${C.pink} !important}
[data-wk="statevoice"] + div > button{background:${C.dark} !important;color:${C.ink} !important;border:${W} !important;border-radius:4px !important}
/* 好感：不做进度条——一颗带蝙蝠翅膀的心，心里从下往上灌红 */
[data-wk="stateaff"]{background:${C.bar} !important;border-top:${W} !important;position:relative !important;display:block !important;padding:16px 140px 18px 20px !important;min-height:110px !important;overflow:hidden !important}
[data-wk="stateaff"] *{color:${C.ink} !important}
[data-wk="stateaff"]::before{content:"" !important;position:absolute !important;right:12px !important;top:50% !important;margin-top:-30px !important;width:128px !important;height:56px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 56' fill='none' stroke='${C.line}' stroke-width='1.5' stroke-linejoin='round'><path d='M38 22 C26 8 10 9 2 20 C10 20 12 26 9 32 C16 28 21 32 21 38 C25 34 31 35 36 38'/><path d='M90 22 C102 8 118 9 126 20 C118 20 116 26 119 32 C112 28 107 32 107 38 C103 34 97 35 92 38'/></svg>`)} center/contain no-repeat !important}
[data-wk="stateheart"]{position:absolute !important;left:auto !important;right:50px !important;top:50% !important;bottom:auto !important;width:52px !important;height:48px !important;margin-top:-28px !important;transform:none !important;--sc-heart-mask:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 84 76'><path d='M42 74 C14 54 2 40 2 23 C2 10 12 2 24 2 C32 2 38 6 42 13 C46 6 52 2 60 2 C72 2 82 10 82 23 C82 40 70 54 42 74Z'/></svg>`)} !important;z-index:2 !important}
[data-wk="stateheart"] > div{-webkit-mask-size:100% 100% !important;mask-size:100% 100% !important}
[data-wk="stateheartline"]{background:${C.line} !important;opacity:1 !important}
[data-wk="stateheart"] > div:not([data-wk="stateheartline"]){inset:1.6px !important}
[data-wk="stateheartbase"]{background:${C.dark} !important;opacity:1 !important}
[data-wk="stateheartfill"] > div{background:${C.red} !important;opacity:1 !important}
[data-wk="stateheartknob"]{display:none !important}
[data-wk="stateheartnum"]{position:absolute !important;inset:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;padding:0 0 6px !important;z-index:3 !important;transform:none !important;font:600 15px/1 Georgia,serif !important;color:#fff !important;-webkit-text-stroke:0 !important;text-shadow:0 1px 2px rgba(0,0,0,.6) !important}
[data-wk="stateaffval"]{display:none !important}

/* 翻旧的：一张张旧请柬，左上一颗火漆印写着第几张 */
[data-wk="statehistbtn"]{background:${C.dark} !important;color:${C.ink} !important;border:${W} !important;border-radius:4px !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 16px !important}
[data-wk="statehisthead"] > :first-child{color:${C.ink} !important;font-family:Georgia,"Songti SC",serif !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{border:1px solid ${C.pink} !important;border-radius:3px !important;background:transparent !important}
[data-wk="statehistlist"]{counter-reset:pg !important}
[data-wk="statehistitem"]{counter-increment:pg !important;position:relative !important;background:${C.dark} !important;border:${W} !important;border-radius:6px !important;padding:26px 18px 14px !important;margin:20px 0 12px !important;box-shadow:inset 0 0 0 4px ${C.dark},inset 0 0 0 5px rgba(243,233,238,.3) !important}
[data-wk="statehistitem"]:nth-child(even){background:#2A1420 !important;box-shadow:inset 0 0 0 4px #2A1420,inset 0 0 0 5px rgba(243,233,238,.3) !important}
[data-wk="statehistitem"]::before{content:counter(pg) !important;position:absolute !important;left:12px !important;top:-14px !important;width:30px !important;height:30px !important;display:flex !important;align-items:center !important;justify-content:center !important;background:${svg(SEAL.replace(/<path d='M20 27[^>]*>/, ""))} center/contain no-repeat !important;color:#fff !important;font:700 12px/1 Georgia,serif !important}
[data-wk="statehistmood"]{background:${C.wine} !important;color:${C.ink} !important;border:1px solid ${C.line} !important;border-radius:3px !important;padding:0 6px !important}
[data-wk="statehisttime"]{color:${C.fog} !important}
[data-wk="statehisttext"],[data-wk="statehistact"],[data-wk="statehistwear"]{color:${C.ink} !important}
[data-wk="statehisttext"]{font-family:Georgia,"Songti SC",serif !important}
[data-wk="statehistmeta"]{background:rgba(138,40,70,.18) !important;border-radius:3px !important}
[data-wk="statehistend"]{color:${C.fog} !important;letter-spacing:.3em !important}
[data-wk="statehistend"]::before{content:"✠ " !important;color:${C.pink} !important}

/* Ta 眼里：贴条换成一只小蝴蝶结 */
[data-wk="gazepage"]{background:${svg(QUAT)} 0 0/44px 44px,${C.bg} !important}
[data-wk="gazetitle"]{color:${C.ink} !important;font-family:Georgia,"Songti SC",serif !important}
[data-wk="gazetab"]{background:${C.dark} !important;color:${C.fog} !important;border:1px solid rgba(243,233,238,.4) !important;border-radius:3px !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:${C.wine} !important;color:${C.ink} !important;border-color:${C.line} !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:${C.fog} !important}
[data-wk="gazecard"]{position:relative !important;overflow:visible !important;background:${C.dark} !important;border:${W} !important;border-radius:6px !important;box-shadow:3px 3px 0 rgba(0,0,0,.35) !important}
[data-wk="gazecard"]:nth-child(even){background:#2A1420 !important}
[data-wk="gazetape"]{background:${svg(BOW(C.wine))} center/contain no-repeat !important;width:28px !important;height:22px !important;box-shadow:none !important;border:none !important}
[data-wk="gazecardname"]{color:${C.ink} !important;font-family:Georgia,"Songti SC",serif !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:${C.fog} !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{background:${C.dark} !important;color:${C.ink} !important;border:${W} !important;border-radius:6px !important;box-shadow:inset 0 0 0 5px ${C.dark},inset 0 0 0 6px rgba(243,233,238,.35) !important}
[data-wk="gazeletter"] *,[data-wk="gazehistory"] *{color:${C.ink} !important}
[data-wk="gazeempty"]{background:${C.dark} !important;color:${C.ink} !important;border:${W} !important;border-radius:6px !important}
[data-wk="gazeempty"] *{color:${C.ink} !important}
[data-wk="gazeempty"] button{background:${C.wine} !important;border:${W} !important;border-radius:4px !important}

/* ───── 线下：一页页黑色信笺——他的黑、我的酒红，侧边系带；说的话是白衬线，心里话是粉灰斜体加一朵小十字花 ───── */
[data-wk="offline"]:not([style*="url("]){background:${svg(QUAT)} 0 0/44px 44px,radial-gradient(circle at 50% 30%,#2A1822,${C.bg} 70%) !important}
[data-wk="offline"] [data-wk="offbody"]{background:transparent !important;padding-top:30px !important}
[data-wk="offline"] [data-wk="chathead"] *{white-space:nowrap !important}
[data-wk="offline"] [data-wk="headname"] > div:last-child{white-space:normal !important;line-height:1.35 !important;color:${C.fog} !important}
[data-wk="offline"] [data-wk="offtitle"],[data-wk="offline"] [data-wk="offtitle"] *,[data-wk="offline"] [data-wk="chatback"] *{color:${C.ink} !important}
[data-wk="offline"] [data-wk="offtitle"]{font-family:Georgia,"Songti SC",serif !important;letter-spacing:.12em !important}
[data-wk="offline"] [data-wk="chatback"] svg{stroke:${C.ink} !important}
[data-wk="offline"] [data-wk="chathead"] button:last-child:not([data-wk]){background:${C.wine} !important;color:${C.ink} !important;border:${W} !important;border-radius:3px !important;font-size:12px !important;padding:3px 12px !important}
[data-wk="offline"] [data-wk="chatmore"]{width:40px !important;min-width:40px !important;height:26px !important;flex-shrink:0 !important}
[data-wk="offcomposer"]{background:${C.bar} !important;border-top:${W} !important;position:relative !important;overflow:visible !important}
[data-wk="offcomposer"]::before{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:100% !important;height:40px !important;background:${svg(SPIRE)} 0 100%/34px 40px repeat-x !important;pointer-events:none !important}
[data-wk="offcomposer"] textarea{background:${C.dark} !important;border:${W} !important;border-radius:6px !important;color:${C.ink} !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]){width:62px !important;min-width:62px !important;height:40px !important;background:${svg(I_SEND)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;border-radius:0 !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]) *{opacity:0 !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]{width:34px !important;min-width:34px !important;height:38px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background:${svg(I_REPLY)} center/contain no-repeat !important;font-size:0 !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"] *{opacity:0 !important}
[data-wk="offcard"]{position:relative !important;overflow:visible !important;background:${C.dark} !important;border:${W} !important;border-radius:6px !important;padding-left:40px !important;box-shadow:inset 0 0 0 4px ${C.dark},inset 0 0 0 5px rgba(243,233,238,.25),3px 3px 0 rgba(0,0,0,.35) !important}
[data-wk="offcard"][data-me="1"]{background:${C.wine} !important;box-shadow:inset 0 0 0 4px ${C.wine},inset 0 0 0 5px rgba(243,233,238,.3),3px 3px 0 rgba(0,0,0,.35) !important}
[data-wk="offcard"]::before{content:"" !important;position:absolute !important;left:9px !important;top:12px !important;bottom:12px !important;width:18px !important;background:${svg(LACE)} center top/18px 12px repeat-y !important}
[data-wk="offcard"]::after{content:"" !important;position:absolute !important;left:6px !important;top:-9px !important;width:24px !important;height:18px !important;background:${svg(BOW(C.wine))} center/contain no-repeat !important}
[data-wk="offcard"][data-me="1"]::after{background:${svg(BOW(C.dark))} center/contain no-repeat !important}
[data-wk="offhead"] img,[data-wk="offhead"] [data-wk="avatar"]{border-radius:50% 50% 3px 3px / 32% 32% 3px 3px !important;overflow:hidden !important;box-shadow:0 0 0 1.4px ${C.line} !important}
[data-wk="offname"]{color:${C.pink} !important;font-family:Georgia,"Songti SC",serif !important;font-style:italic !important;letter-spacing:.1em !important}
[data-wk="offtext"]{color:#E2D3DA !important;font-family:Georgia,"Songti SC",serif !important}
[data-wk="offsay"]{color:#fff !important;background:transparent !important;border:none !important;font-weight:600 !important}
[data-wk="offthought"]{background:transparent !important;border:none !important;border-radius:0 !important;color:#C9A5B5 !important;font-style:italic !important}
[data-wk="offthought"]::before{content:"✠ " !important;color:${C.pink} !important;font-style:normal !important}
[data-wk="offcardacts"] svg{stroke:${C.fog} !important;color:${C.fog} !important}
[data-wk="offreplyopt"]{background:${C.dark} !important;border:${W} !important;border-radius:4px !important;color:${C.ink} !important}

/* ───── 通话：气泡也是带系带的小卡；头像是一扇拱窗，外面一圈细框 ───── */
[data-wk="callbubble"]{position:relative !important;background:${C.dark} !important;color:${C.ink} !important;border:${W} !important;border-radius:6px !important;box-shadow:3px 3px 0 rgba(0,0,0,.35) !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:${C.wine} !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="callavatar"]{border-radius:50% 50% 4px 4px / 34% 34% 4px 4px !important;overflow:hidden !important;box-shadow:0 0 0 1.8px ${C.line},0 0 0 7px ${C.bg},0 0 0 8.4px rgba(243,233,238,.5) !important}
/* 名字别被挤成「测试…」：右边按键收小，名字那块至少留够四五个字 */
[data-wk="chathead"]{gap:8px !important}
[data-wk="chathead"] [data-wk="headname"]{flex:1 1 auto !important;min-width:84px !important}
[data-wk="chathead"] [data-wk="headname"] > div:last-child{white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important}
[data-wk="chathead"] [data-wk="sameroom"]{width:24px !important;min-width:24px !important;height:28px !important}
[data-wk="chathead"] [data-wk="chatmore"]{width:36px !important;min-width:36px !important;height:22px !important;margin-left:2px !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:22px !important;min-width:22px !important;height:26px !important;flex-shrink:0 !important}
[data-wk="offline"] [data-wk="chathead"] button:last-child:not([data-wk]){padding:3px 8px !important;flex-shrink:0 !important}
[data-wk="offline"] [data-wk="headname"] > div:last-child{white-space:normal !important;overflow:visible !important}
/* 名字要完整：两扇小窗再收小、叠一点；名字字距收紧；名字那块至少 120px */
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img,[data-wk="chathead"] [data-wk="avatar"]{width:26px !important;min-width:26px !important;height:34px !important}
[data-wk="chathead"] [data-wk="headme"]{margin-left:-10px !important}
[data-wk="chathead"] [data-wk="headname"]{min-width:120px !important}
[data-wk="chathead"] [data-wk="headname"] [data-wk="headink"]{letter-spacing:.02em !important}
[data-wk="chathead"] [data-wk="headink"] > span:first-child{overflow:visible !important;text-overflow:clip !important}

/* 打电话那一屏（语音）：整屏底色跟这套走；三个按键换成这套的扣子，中间挂断单独一色 */
[data-wk="call"][data-video="0"]{background:radial-gradient(ellipse at 50% 25%,rgba(138,40,70,.35),transparent 60%),#1D1219 !important}
[data-wk="call"][data-video="0"] [data-wk="calltitle"]{color:#fff !important}
[data-wk="call"][data-video="0"] [data-wk="callhead"] > div:not([data-wk]){color:rgba(255,255,255,.65) !important}
[data-wk="call"][data-video="0"] > button:first-child{background:rgba(255,255,255,.12) !important}
[data-wk="call"][data-video="0"] > button:first-child svg{stroke:#fff !important}
[data-wk="callbtns"] button > span:first-child{background:#160D13 !important;border-radius:50% 50% 6px 6px / 40% 40% 6px 6px !important;box-shadow:0 0 0 1.6px #F3E9EE,0 0 0 5px #1D1219,0 0 0 6px rgba(243,233,238,.5) !important}
[data-wk="callbtns"] button > span:first-child svg{stroke:#F3E9EE !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child{background:#8A2846 !important;box-shadow:0 0 0 1.6px #F3E9EE,0 0 14px rgba(200,35,77,.6) !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child svg{stroke:#fff !important}
[data-wk="call"][data-video="0"] [data-wk="callbtns"] button > span:last-child{color:rgba(255,255,255,.65) !important}
`;

const pack = { kind: "chat-look", v: 1, name: "哥特蕾丝", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "哥特蕾丝-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
