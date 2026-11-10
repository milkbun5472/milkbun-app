// 粉色日记聊天美化：生成 chat-look 包。用法：node themes/pink-diary/build.mjs
// 配色：雾粉纸 #f6ecec / 页边粉 #e9b8bf / 玫瑰棕（描边、字）#8a5a5f / 深字 #5e4245 / 薄荷点缀 #bcd9cc / 奶黄 #f6e6c0
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;utf8," + encodeURIComponent(s).replace(/'/g, "%27").replace(/"/g, "%22") + "\")";
const C = { paper: "#f6ecec", paper2: "#fbf5f4", line: "#ecd3d6", margin: "#e9b8bf", rose: "#8a5a5f", ink: "#5e4245", mint: "#bcd9cc", butter: "#f6e6c0", blush: "#f2c4c8" };
const X = s => s.replace(/<\/?svg[^>]*>/g, "");

// 小兔（正脸）：长耳朵、腮红、小 ω 嘴
const BUNNY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g stroke='${C.rose}' stroke-width='3' stroke-linejoin='round' fill='#fff'><path d='M32 48 C24 22 26 4 34 4 C42 4 44 24 42 46 Z'/><path d='M68 48 C76 22 74 4 66 4 C58 4 56 24 58 46 Z'/><ellipse cx='50' cy='66' rx='32' ry='26'/></g><path d='M34 42 C30 24 31 12 34 12 C37 12 38 26 38 40 Z M66 42 C70 24 69 12 66 12 C63 12 62 26 62 40 Z' fill='${C.blush}'/><circle cx='39' cy='64' r='3.6' fill='${C.ink}'/><circle cx='61' cy='64' r='3.6' fill='${C.ink}'/><ellipse cx='32' cy='73' rx='6' ry='3.5' fill='${C.blush}'/><ellipse cx='68' cy='73' rx='6' ry='3.5' fill='${C.blush}'/><path d='M46 72 q4 4 4 0 q0 4 4 0' fill='none' stroke='${C.ink}' stroke-width='2' stroke-linecap='round'/></svg>`;
const HEART = (f = C.margin) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 22'><path d='M12 20 C3 13 1 8 4 4.5 C7 1.5 11 3 12 6 C13 3 17 1.5 20 4.5 C23 8 21 13 12 20Z' fill='${f}' stroke='${C.rose}' stroke-width='1.6' stroke-linejoin='round'/></svg>`;
const STAR = (f = C.butter) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 2 L14.6 8.8 L22 9.3 L16.3 14 L18.2 21.2 L12 17.2 L5.8 21.2 L7.7 14 L2 9.3 L9.4 8.8Z' fill='${f}' stroke='${C.rose}' stroke-width='1.5' stroke-linejoin='round'/></svg>`;
const TAPE = (f = C.mint) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 20' preserveAspectRatio='none'><path d='M2 3 L4 1 L6 3 L8 1 L10 3 L52 3 L54 1 L56 3 L58 1 L58 19 L56 17 L54 19 L52 17 L8 17 L6 19 L4 17 L2 19Z' fill='${f}' opacity='.75'/><path d='M14 3 V17 M28 3 V17 M42 3 V17' stroke='#fff' stroke-width='3' opacity='.45'/></svg>`;
const CLIP = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 40'><path d='M5 36 V8 a4 4 0 0 1 8 0 V32 a6 6 0 0 1 -12 0 V12' fill='none' stroke='${C.rose}' stroke-width='2' stroke-linecap='round'/></svg>`;
// 横线本：每 28px 一道线，左边一道粉色页边线 + 一排活页孔
const PAGE = `<svg xmlns='http://www.w3.org/2000/svg' width='390' height='28' viewBox='0 0 390 28'><path d='M0 27.5 H390' stroke='${C.line}' stroke-width='1'/><path d='M30 0 V28' stroke='${C.margin}' stroke-width='1.2' opacity='.7'/><circle cx='12' cy='14' r='3.4' fill='#fff' stroke='${C.line}' stroke-width='1'/></svg>`;
// 按键
const I_PEN = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g stroke='${C.rose}' stroke-width='4' stroke-linejoin='round' stroke-linecap='round'><path d='M62 16 L84 38 L42 80 L20 86 L26 64 Z' fill='#fff'/><path d='M56 22 L78 44' fill='none'/><path d='M26 64 L42 80' fill='none'/></g><path d='M64 18 L82 36 L76 42 L58 24Z' fill='${C.margin}'/><circle cx='50' cy='50' r='0'/><path d='M44 50 h12 M50 44 v12' stroke='${C.rose}' stroke-width='0'/></svg>`;
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='34' fill='#fff' stroke='${C.rose}' stroke-width='4' stroke-dasharray='7 6'/><path d='M50 34 V66 M34 50 H66' stroke='${C.rose}' stroke-width='5' stroke-linecap='round'/><g transform='translate(70 16) scale(1.1)'>${X(HEART())}</g></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g stroke='${C.rose}' stroke-width='4' stroke-linejoin='round'><rect x='14' y='26' width='72' height='50' rx='6' fill='#fff'/><path d='M16 30 L50 56 L84 30' fill='none'/></g><circle cx='50' cy='58' r='11' fill='#d9707e' stroke='${C.rose}' stroke-width='2.5'/><path d='M50 64 C45 60 44 57 46 55 C48 53 50 55 50 56 C50 55 52 53 54 55 C56 57 55 60 50 64Z' fill='#fff'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g transform='translate(18 8) scale(.64)'>${X(BUNNY)}</g><path d='M58 52 h28 a8 8 0 0 1 8 8 v12 a8 8 0 0 1 -8 8 h-14 l-8 8 l1 -8 h-7 a8 8 0 0 1 -8 -8 v-12 a8 8 0 0 1 8 -8z' fill='#fff' stroke='${C.rose}' stroke-width='3'/><circle cx='66' cy='66' r='2.6' fill='${C.rose}'/><circle cx='74' cy='66' r='2.6' fill='${C.rose}'/><circle cx='82' cy='66' r='2.6' fill='${C.rose}'/></svg>`;
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g transform='translate(8 38) scale(1)'>${X(HEART())}</g><g transform='translate(38 38) scale(1)'>${X(HEART(C.butter))}</g><g transform='translate(68 38) scale(1)'>${X(HEART(C.mint))}</g></svg>`;
// 拍立得相框：头像嵌在白框里，顶上一对兔耳探出来，一截胶带
const FRAME = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 120'><g transform='translate(22 -2) scale(.56)'><g stroke='${C.rose}' stroke-width='5' stroke-linejoin='round' fill='#fff'><path d='M32 52 C24 22 26 4 34 4 C42 4 44 24 42 50 Z'/><path d='M68 52 C76 22 74 4 66 4 C58 4 56 24 58 50 Z'/></g><path d='M34 44 C30 24 31 12 34 12 C37 12 38 26 38 42 Z M66 44 C70 24 69 12 66 12 C63 12 62 26 62 42 Z' fill='${C.blush}'/></g><path fill-rule='evenodd' d='M6 22 H94 V116 H6Z M14 30 V96 H86 V30Z' fill='#fff' stroke='${C.rose}' stroke-width='2.5' stroke-linejoin='round'/><g transform='translate(68 100) scale(.8)'>${X(HEART())}</g><g transform='translate(14 14) rotate(-14) scale(.5)'>${X(TAPE())}</g></svg>`;

const layout = { bubble: "bubble", avatar: "first", name: true, gap: "loose", time: "show" };
const bubble = {
  myBg: "rgba(255,255,255,0.55)", myText: C.ink, myBorder: "1.5px solid rgba(138,90,95,0.25)",
  charBg: "transparent", charText: C.ink, charBorder: "none",
  radius: 6, shadow: "none", myAlpha: 100, charAlpha: 100
};

const css = `
/* ───── 粉色日记 · 底：横线本、顶栏、底栏 ───── */
[data-wk="chat"]{background:${C.paper} ${svg(PAGE)} repeat !important;background-size:390px 28px !important}
[data-wk="body"]{background:transparent !important;padding-left:44px !important;padding-top:28px !important}
[data-wk="chathead"]{background:${C.paper2} !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;z-index:5 !important;overflow:visible !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:100% !important;height:16px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='20' height='16' viewBox='0 0 20 16'><path d='M0 0 H20 V4 A5 5 0 0 1 10 4 A5 5 0 0 1 0 4Z' fill='${C.paper2}'/><path d='M0 4 A5 5 0 0 0 10 4 A5 5 0 0 0 20 4' fill='none' stroke='${C.margin}' stroke-width='1.4'/><circle cx='5' cy='5' r='1.3' fill='${C.margin}'/><circle cx='15' cy='5' r='1.3' fill='${C.margin}'/></svg>`)} repeat-x left top/20px 16px !important;pointer-events:none !important}
[data-wk="headink"]{color:${C.ink} !important}
[data-wk="headdim"]{color:${C.rose} !important;opacity:.7 !important}
/* 顶栏收矮：小字那行藏掉，头像缩一号（上下留白不动，安全区照 app 的算） */
[data-wk="headname"] > div:nth-child(2){display:none !important}
[data-wk="chathead"] > button > [data-wk="avatar"],[data-wk="chathead"] [data-wk="avatar"]{width:30px !important;height:30px !important}
[data-wk="chatback"] svg{stroke:${C.rose} !important}
[data-wk="chatmore"],[data-wk="sameroom"]{background:${svg(I_MORE)} center/26px 26px no-repeat !important;border:none !important;box-shadow:none !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="sameroom"]{background-image:${svg(STAR())} !important;background-size:22px 22px !important}

[data-wk="composer"]{background:${C.paper2} !important;border-top:1.5px dashed ${C.margin} !important}
[data-wk="chatinput"]{background:#fff !important;border:1.5px solid ${C.line} !important;border-radius:6px !important;color:${C.ink} !important;background-image:linear-gradient(transparent 26px,${C.line} 26px,${C.line} 27px,transparent 27px) !important;background-size:100% 28px !important}
[data-wk="chatinput"]::placeholder{color:${C.rose} !important;opacity:.5 !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;transition:transform .12s !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{background:${svg(I_SEND)} center/contain no-repeat !important}
[data-wk="chatreply"]{background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.86) !important}

/* 头像：拍立得小相框，兔耳探出来 */
[data-wk="avatar"]{position:relative !important;overflow:visible !important;border-radius:2px !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;width:58px !important;height:70px !important;left:calc(50% - 29px) !important;top:calc(50% - 42px) !important;z-index:2 !important;background:${svg(FRAME)} center/contain no-repeat !important;pointer-events:none !important}
[data-wk="avatar"] *{border-radius:2px !important}

/* ───── 话：没有气泡，字落在横线上；你的竖线在右、他的在左；名字是荧光笔标签；已读跟在句尾 ───── */
[data-wk="row"] > div:has(> [data-wk="bubble"]){flex-direction:row !important;flex-wrap:wrap !important;align-items:baseline !important;column-gap:6px !important}
[data-wk="row"].justify-end > div:has(> [data-wk="bubble"]){justify-content:flex-end !important}
[data-wk="row"] > div > [data-wk="name"]{flex:0 0 100% !important;order:-2 !important}
[data-wk="row"].justify-end > div > [data-wk="name"]{text-align:right !important}
[data-wk="row"] > div > [data-wk="meta"]{flex:0 0 100% !important;order:1 !important;justify-content:flex-start !important}
[data-wk="row"].justify-end > div > [data-wk="meta"]{justify-content:flex-end !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="name"]{display:block !important;color:${C.rose} !important;font-style:italic !important;letter-spacing:.08em !important;line-height:28px !important;height:28px !important;margin:0 !important;padding:0 !important}
[data-wk="name"]::first-line{background:linear-gradient(transparent 22%,rgba(188,217,204,.8) 22%,rgba(188,217,204,.8) 85%,transparent 85%) !important}
[data-wk="row"].justify-end > div > [data-wk="name"]::first-line{background:linear-gradient(transparent 22%,rgba(233,184,191,.85) 22%,rgba(233,184,191,.85) 85%,transparent 85%) !important}
[data-wk="name"]::after{content:" 说：" !important}
[data-wk="bubble"][data-kind="text"]{background:transparent !important;box-shadow:none !important;border:none !important;border-radius:0 !important;transform:none !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;line-height:28px !important;padding:0 12px !important;margin:0 !important;color:${C.ink} !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{border-left:3px solid ${C.margin} !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{border-right:3px solid ${C.margin} !important}
[data-wk="bubble"][data-kind="text"]::before,[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="meta"]{color:${C.rose} !important;opacity:.65 !important;font-size:10.5px !important;line-height:28px !important;margin:0 !important}
[data-wk="meta"]::before{content:"" !important;display:inline-block !important;width:9px !important;height:8px !important;margin-right:4px !important;background:${svg(HEART(C.mint))} center/contain no-repeat !important}

/* 时间：写进左边页边那一栏，跟活页孔排在一起 */
[data-wk="msg"]{position:relative !important}
[data-wk="time"]{position:absolute !important;left:-40px !important;top:0 !important;width:30px !important;margin:0 !important;text-align:center !important;z-index:1 !important}
[data-wk="time"] > span{display:block !important;background:${C.butter} !important;color:${C.rose} !important;font-size:9px !important;line-height:12px !important;padding:3px 1px !important;border-radius:2px !important;transform:rotate(-4deg) !important;word-break:break-all !important;box-shadow:0 1px 0 rgba(138,90,95,.15) !important}
[data-wk="msg"]{padding:0 !important;margin:0 0 28px !important}
[data-wk="msg"] + [data-wk="msg"]{margin-top:0 !important}
[data-wk="body"] > *{margin-top:0 !important}

/* 正在输入：三颗小爱心 */
[data-wk="bubble"][data-kind="typing"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{width:14px !important;height:13px !important;border-radius:0 !important;background:${svg(HEART())} center/contain no-repeat !important}
`;

const pack = { kind: "chat-look", v: 1, name: "粉色日记", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "粉色日记-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
