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
const DRIP = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='80' viewBox='0 0 240 80'><path d='M-2 -4 H242 V26 H240 Q228 36 216 28 Q208 34 204 30 V54 A5 5 0 0 1 194 54 V30 Q184 38 170 28 Q158 34 150 30 V40 A4 4 0 0 1 142 40 V30 Q128 38 112 28 Q104 32 100 30 V64 A6 6 0 0 1 88 64 V30 Q72 38 58 28 Q48 34 40 30 V48 A5 5 0 0 1 30 48 V30 Q16 36 0 26 H-2Z' fill='${C.wine}' stroke='${C.line}' stroke-width='1.2' stroke-linejoin='round'/><path d='M8 14 H70 M96 14 H170 M190 14 H234' stroke='rgba(243,233,238,.25)' stroke-width='1.6' stroke-linecap='round'/><path d='M94 74 Q94 70 96 68 Q98 70 98 74 A2 2 0 0 1 94 74Z' fill='${C.red}'/></svg>`;
const SPIRE = `<svg xmlns='http://www.w3.org/2000/svg' width='46' height='54' viewBox='0 0 46 54' fill='none' stroke='${C.line}' stroke-width='1.3'><path d='M0 53 Q0 32 23 30 Q46 32 46 53'/><path d='M23 30 V12'/><circle cx='23' cy='10' r='2' fill='${C.line}'/><path d='M19 20 L23 16 L27 20'/><path d='M0 53.3 H46' stroke-width='1.6'/></svg>`;
const STAR = (c) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8Z' fill='${c}'/></svg>`;
const BATHEART = (fill, stroke) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 24' fill='none' stroke='${stroke}' stroke-width='1.3' stroke-linejoin='round'><path d='M20 8 C14 3 6 3 2 7 C6 8 7 10 6 13 C9 11 11 13 11 15 C13 13 16 14 18 15'/><path d='M36 8 C42 3 50 3 54 7 C50 8 49 10 50 13 C47 11 45 13 45 15 C43 13 40 14 38 15'/><path d='M28 22 C18 15 17 11 17 9 C17 6 19.5 4 22.5 4 C25 4 27 5.5 28 7.5 C29 5.5 31 4 33.5 4 C36.5 4 39 6 39 9 C39 11 38 15 28 22Z' fill='${fill}'/></svg>`;
const ARCH = (inner) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 40' fill='none' stroke='${C.line}' stroke-width='1.6' stroke-linejoin='round'><path d='M2 39 V16 Q2 2 18 1.5 Q34 2 34 16 V39Z' fill='${C.dark}'/>${inner}</svg>`;
const I_PLUS = ARCH(`<path d='M18 18 V32 M11 25 H25' stroke-linecap='round'/>`);
const I_REPLY = ARCH(`<path d='M9 19 H27 Q29 19 29 21 V27 Q29 29 27 29 H16 L12 32 V29 H9 Q7 29 7 27 V21 Q7 19 9 19Z'/>`);
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 34' fill='none' stroke='${C.line}' stroke-width='1.6' stroke-linejoin='round'><path d='M15 0 L16.2 4.8 L21 6 L16.2 7.2 L15 12 L13.8 7.2 L9 6 L13.8 4.8Z' fill='${C.pink}' stroke='none'/><path d='M4 22 L15 13 L26 22 V32 H4Z'/><path d='M12.5 32 V25 Q15 22.5 17.5 25 V32'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 50' stroke-linejoin='round'><path d='M26 18 C18 8 8 9 2 16 C8 16 10 20 8 25 C13 22 16 25 16 29 C19 26 23 27 26 30' fill='none' stroke='${C.line}' stroke-width='1.5'/><path d='M54 18 C62 8 72 9 78 16 C72 16 70 20 72 25 C67 22 64 25 64 29 C61 26 57 27 54 30' fill='none' stroke='${C.line}' stroke-width='1.5'/><path d='M40 48 C24 37 21 30 21 22 C21 14 27 9 33 9 C36.5 9 39 11 40 13.5 C41 11 43.5 9 47 9 C53 9 59 14 59 22 C59 30 56 37 40 48Z' fill='${C.red}' stroke='${C.line}' stroke-width='1.6'/><path d='M40 38 V20 M34 26 L40 20 L46 26' fill='none' stroke='${C.line}' stroke-width='2' stroke-linecap='round'/></svg>`;

const bubble = { myBg: C.wine, myText: C.ink, myBorder: W, charBg: C.dark, charText: C.ink, charBorder: W, radius: 6, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 哥特蕾丝 · 第一批 ───── */
[data-wk="chat"]{background:${svg(QUAT)} 0 0/44px 44px,radial-gradient(circle at 50% 30%,#2A1822,${C.bg} 70%) !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：深色；底下挂一条酒红糖浆帘子往下滴 */
[data-wk="chathead"]{background:${C.bar} !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;overflow:visible !important;z-index:5 !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:100% !important;height:80px !important;background:${svg(DRIP)} 0 0/240px 80px repeat-x !important;pointer-events:none !important;z-index:5 !important}
[data-wk="offline"] [data-wk="chathead"]::after{height:34px !important;background-size:240px 80px !important;background-position:0 0 !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important}
[data-wk="headname"] [data-wk="headink"]{font-family:Georgia,"Songti SC",serif !important;letter-spacing:.12em !important}
[data-wk="chat"] [data-wk="headname"] [data-wk="headink"]::after{content:"my dearest" !important;font:italic 13px/1 Georgia,serif !important;color:${C.pink} !important;margin-left:10px !important;letter-spacing:.04em !important;white-space:nowrap !important}
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
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.92) !important}
`;

const pack = { kind: "chat-look", v: 1, name: "哥特蕾丝", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "哥特蕾丝-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
