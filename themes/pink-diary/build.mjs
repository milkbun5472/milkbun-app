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
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='34' fill='#fff' stroke='${C.rose}' stroke-width='4'/><path d='M50 34 V66 M34 50 H66' stroke='${C.rose}' stroke-width='5' stroke-linecap='round'/><g transform='translate(70 16) scale(1.1)'>${X(HEART())}</g></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g stroke='${C.rose}' stroke-width='4' stroke-linejoin='round'><rect x='14' y='26' width='72' height='50' rx='6' fill='#fff'/><path d='M16 30 L50 56 L84 30' fill='none'/></g><circle cx='50' cy='58' r='11' fill='#d9707e' stroke='${C.rose}' stroke-width='2.5'/><path d='M50 64 C45 60 44 57 46 55 C48 53 50 55 50 56 C50 55 52 53 54 55 C56 57 55 60 50 64Z' fill='#fff'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g transform='translate(18 8) scale(.64)'>${X(BUNNY)}</g><path d='M58 52 h28 a8 8 0 0 1 8 8 v12 a8 8 0 0 1 -8 8 h-14 l-8 8 l1 -8 h-7 a8 8 0 0 1 -8 -8 v-12 a8 8 0 0 1 8 -8z' fill='#fff' stroke='${C.rose}' stroke-width='3'/><circle cx='66' cy='66' r='2.6' fill='${C.rose}'/><circle cx='74' cy='66' r='2.6' fill='${C.rose}'/><circle cx='82' cy='66' r='2.6' fill='${C.rose}'/></svg>`;
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g transform='translate(8 38) scale(1)'>${X(HEART())}</g><g transform='translate(38 38) scale(1)'>${X(HEART(C.butter))}</g><g transform='translate(68 38) scale(1)'>${X(HEART(C.mint))}</g></svg>`;
// 拍立得相框：头像嵌在白框里，顶上一对兔耳探出来，一截胶带
const FRAME = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -10 100 130'><g transform='translate(14 -12) scale(.72)'><g stroke='${C.rose}' stroke-width='5' stroke-linejoin='round' fill='#fff'><path d='M32 52 C24 22 26 4 34 4 C42 4 44 24 42 50 Z'/><path d='M68 52 C76 22 74 4 66 4 C58 4 56 24 58 50 Z'/></g><path d='M34 44 C30 24 31 12 34 12 C37 12 38 26 38 42 Z M66 44 C70 24 69 12 66 12 C63 12 62 26 62 42 Z' fill='${C.blush}'/></g><path fill-rule='evenodd' d='M6 22 H94 V116 H6Z M14 30 V96 H86 V30Z' fill='#fff' stroke='${C.rose}' stroke-width='2.5' stroke-linejoin='round'/><g transform='translate(68 100) scale(.8)'>${X(HEART())}</g><g transform='translate(14 14) rotate(-14) scale(.5)'>${X(TAPE())}</g></svg>`;

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

[data-wk="composer"]{background:${C.paper2} !important;border-top:1.5px solid ${C.margin} !important}
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
/* 一串最后是表情包、卡片：已读写在它底下（v89.457 起的 cardmeta 挂点） */
[data-run][data-last="1"] + [data-wk="cardmeta"]{display:block !important;font-size:10.5px !important;color:${C.rose} !important;opacity:.65 !important;line-height:28px !important;padding:0 6px 0 60px !important}
[data-run][data-last="1"] + [data-wk="cardmeta"][data-me="1"]{text-align:right !important;padding:0 60px 0 6px !important}
[data-wk="cardmeta"]::before{content:"" !important;display:inline-block !important;width:9px !important;height:8px !important;margin-right:4px !important;background:${svg(HEART(C.mint))} center/contain no-repeat !important}
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

/* ───── 第二批：卡片都变成贴进本子里的东西 ───── */
/* 卡片行整体歪一点，像随手贴上去的 */
[data-wk="cardrow"][data-me="0"] > div:not([data-wk="avatar"]){transform:rotate(-1.2deg) !important}
[data-wk="cardrow"][data-me="1"] > div:not([data-wk="avatar"]){transform:rotate(1.2deg) !important}

/* 转账：一张票根，两头锯齿，顶上一截薄荷胶带 */
[data-wk="transfercard"]{background:#fff !important;border:1.5px solid ${C.margin} !important;border-radius:4px !important;box-shadow:2px 3px 0 rgba(138,90,95,.12) !important;position:relative !important;overflow:visible !important;transform:rotate(-1.5deg) !important}
[data-wk="transfercard"]::before{content:"" !important;position:absolute !important;top:-9px !important;left:calc(50% - 30px) !important;width:60px !important;height:18px !important;background:${svg(TAPE())} center/100% 100% no-repeat !important;transform:rotate(-4deg) !important;z-index:2 !important}
[data-wk="transferlabel"],[data-wk="transferfoot"],[data-wk="transfernote"]{color:${C.rose} !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:${C.ink} !important}
[data-wk="transferrule"]{border:none !important;height:2px !important;background:repeating-linear-gradient(90deg,${C.margin} 0 6px,transparent 6px 11px) !important}
[data-wk="transfernotch"]{background:${C.paper} !important;border-color:${C.margin} !important}
[data-wk="transferfoot"]{background:${C.paper2} !important;border-color:${C.line} !important}
[data-wk="transferseal"]{border:2px solid #d9707e !important;color:#d9707e !important;border-radius:50% !important;background:#fff ${svg(HEART("#f2c4c8"))} center 5px/12px 11px no-repeat !important;padding-top:10px !important;box-shadow:none !important}
[data-wk="transfercard"][data-status="pending"] [data-wk="transferseal"]{opacity:.7 !important}
[data-wk="transferbtn"]{border-radius:999px !important}
[data-wk="transferbtn"][data-part="take"]{background:${C.margin} !important;color:#fff !important;border-color:${C.margin} !important}
[data-wk="transferbtn"][data-part="back"]{background:#fff !important;color:${C.rose} !important;border-color:${C.line} !important}

/* 红包：留红，像一个夹在本子里的小红信封，火漆印是爱心 */
[data-wk="rpenvelope"][data-stage="open"]{background:#fff !important;border:1.5px solid ${C.margin} !important}
[data-wk="rpopenbtn"]{background:#f6e6c0 ${svg(HEART("#d9707e"))} center/40px 37px no-repeat !important;color:transparent !important}
[data-wk="rpopenbtn"] *{opacity:0 !important}

/* 照片：拍立得，两截胶带斜贴两角 */
[data-wk="photocard"]{background:#fff !important;padding:8px 8px 26px !important;border-radius:2px !important;box-shadow:2px 4px 0 rgba(138,90,95,.12) !important;position:relative !important;overflow:visible !important;transform:rotate(-2deg) !important}
[data-wk="photocard"]::before,[data-wk="photocard"]::after{content:"" !important;position:absolute !important;width:44px !important;height:15px !important;background:${svg(TAPE(C.margin))} center/100% 100% no-repeat !important;z-index:2 !important}
[data-wk="photocard"]::before{top:-6px !important;left:-12px !important;transform:rotate(-38deg) !important}
[data-wk="photocard"]::after{top:-6px !important;right:-12px !important;transform:rotate(38deg) !important}
[data-wk="phototext"],[data-wk="photocap"],[data-wk="photohint"]{color:${C.rose} !important;font-style:italic !important}

/* 语音：一张小便签，波形变粉 */

/* 天气：剪下来的一角天空，字是玫瑰棕 */

/* 位置：一枚回形针夹住的纸条 */
[data-wk="geocard"] > [data-wk="card"]{background:#fff !important;border:1.5px solid ${C.line} !important;border-radius:3px !important;box-shadow:2px 3px 0 rgba(138,90,95,.12) !important}
[data-wk="geopin"]{width:14px !important;height:34px !important;top:-14px !important;left:18px !important;border-radius:0 !important;box-shadow:none !important;background:${svg(CLIP)} center/contain no-repeat !important}
[data-wk="geopinstem"]{display:none !important}
[data-wk="geoname"]{color:${C.ink} !important}
[data-wk="georule"]{background:${C.line} !important}
[data-wk="geofoot"]{color:${C.rose} !important}

/* 名片：一张小卡片，回形针 */
[data-wk="namecard"]{background:#fff !important;border:1.5px solid ${C.line} !important;border-radius:4px !important;box-shadow:2px 3px 0 rgba(138,90,95,.12) !important;position:relative !important;overflow:visible !important}
[data-wk="namecard"]::before{content:"" !important;position:absolute !important;top:-14px !important;right:22px !important;width:14px !important;height:34px !important;background:${svg(CLIP)} center/contain no-repeat !important}
[data-wk="namecardname"]{color:${C.ink} !important}
[data-wk="namecard"] > div:last-child{background:${C.paper2} !important;color:${C.rose} !important}

/* 拍一拍、系统纸条、通话结束：页边的小批注 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:linear-gradient(transparent 30%,rgba(246,230,192,.9) 30%,rgba(246,230,192,.9) 88%,transparent 88%) !important;border:none !important;color:${C.rose} !important;font-style:italic !important;padding:0 8px !important;box-shadow:none !important}
[data-wk="sysnote"]{background:#fff !important;border:1.5px solid ${C.margin} !important;border-radius:3px !important;transform:rotate(-.6deg) !important}
[data-wk="sysnotelabel"]{color:${C.rose} !important}
[data-wk="sysnotetext"]{color:${C.ink} !important}
[data-wk="callpill"] > [data-wk="block"]{background:#fff !important;border:1.5px solid ${C.line} !important;border-radius:3px !important}

/* 动描：撕下来的一张便签，下沿锯齿 */
[data-wk="narrink"]{background:${C.butter} !important;border:none !important;border-radius:0 !important;color:${C.ink} !important;padding:12px 16px 18px !important;position:relative !important;transform:rotate(-.8deg) !important;box-shadow:2px 3px 0 rgba(138,90,95,.1) !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;-webkit-mask:linear-gradient(#000,#000) top/100% calc(100% - 6px) no-repeat,${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='12' height='6'><path d='M0 0 H12 L6 6Z'/></svg>`)} bottom/12px 6px repeat-x !important}

/* 头像相框：兔耳放大；顶栏那颗也套上 */
[data-wk="chathead"] [data-wk="avatar"]{border-radius:2px !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"]){position:relative !important;overflow:visible !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"])::before{content:"" !important;position:absolute !important;width:44px !important;height:53px !important;left:-7px !important;top:calc(50% - 31px) !important;z-index:2 !important;background:${svg(FRAME)} center/contain no-repeat !important;pointer-events:none !important}

/* 红包：粉色信封，封口一道虚线弧，扣子是奶黄爱心 */
[data-wk="rpcard"]{background:linear-gradient(175deg,#efb6c0,#d9808f) !important;border:1.5px solid #c96f7f !important;border-radius:8px !important;box-shadow:2px 3px 0 rgba(138,90,95,.15) !important;transform:rotate(1deg) !important;overflow:visible !important;position:relative !important}
[data-wk="rpcard"] *{color:#fff !important}
[data-wk="rpflap"]{background:linear-gradient(180deg,rgba(255,255,255,.25),rgba(255,255,255,0)) !important;border-bottom:none !important}
[data-wk="rpseal"]{border:none !important;width:34px !important;height:34px !important;border-radius:50% !important;top:50% !important;margin-top:-17px !important;background:#fbf0d6 ${svg(HEART("#d9707e"))} center/18px 17px no-repeat !important;box-shadow:0 0 0 3px rgba(255,255,255,.55) !important}
[data-wk="rpseal"] *{display:none !important}
[data-wk="rpcard"]::after{content:"" !important;position:absolute !important;top:-8px !important;left:18px !important;width:46px !important;height:15px !important;background:${svg(TAPE(C.butter))} center/100% 100% no-repeat !important;transform:rotate(-6deg) !important}
[data-wk="rpcard"][data-status="done"]{background:linear-gradient(175deg,#f5d3d9,#e9b3bc) !important;border-color:#dba0aa !important}
[data-wk="rpenvelope"][data-stage="closed"]{background:linear-gradient(175deg,#efb6c0,#d9808f) !important}
[data-wk="rparc"]{background:#d27886 !important}

/* 照片没图：还没贴上去的那一张——四角留着胶痕，中间手写「这里本来想贴」 */
[data-wk="photoface"]{background:transparent !important;border:1.5px solid ${C.margin} !important;border-radius:2px !important;position:relative !important;padding-top:26px !important;min-height:110px !important}
[data-wk="photoface"]::before{content:"" !important;position:absolute !important;inset:-6px !important;pointer-events:none !important;background:${svg(TAPE("#e9d6c8"))} left top/26px 9px no-repeat,${svg(TAPE("#e9d6c8"))} right top/26px 9px no-repeat,${svg(TAPE("#e9d6c8"))} left bottom/26px 9px no-repeat,${svg(TAPE("#e9d6c8"))} right bottom/26px 9px no-repeat !important;opacity:.8 !important}
[data-wk="phototext"]::before{content:"这里本来想贴：" !important;display:block !important;font-size:11px !important;color:${C.margin} !important;margin-bottom:4px !important;letter-spacing:.06em !important}
[data-wk="photoface"] svg{display:none !important}

/* 语音：一张小票，左边播放键，右边撕开的锯齿 */
[data-wk="voice"][data-me]{background:#fff ${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='11' fill='${C.margin}'/><path d='M9.5 7.5 L17 12 L9.5 16.5Z' fill='#fff'/></svg>`)} 10px center/24px 24px no-repeat !important;border:1.5px solid ${C.margin} !important;border-right:none !important;border-radius:4px 0 0 4px !important;color:${C.rose} !important;box-shadow:2px 2px 0 rgba(138,90,95,.1) !important;padding-left:44px !important;padding-right:20px !important;position:relative !important;overflow:visible !important;-webkit-mask:linear-gradient(#000,#000) left/calc(100% - 7px) 100% no-repeat,${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='8' height='10'><path d='M0 0 H1 L8 5 L1 10 H0Z'/></svg>`)} right/8px 10px repeat-y !important}
[data-wk="voice"][data-me]::before{content:"" !important;position:absolute !important;top:-7px !important;left:calc(50% - 18px) !important;width:36px !important;height:12px !important;background:${svg(TAPE(C.mint))} center/100% 100% no-repeat !important}
[data-wk="voice"][data-me]::after{content:none !important}
[data-wk="voice"][data-me] svg{display:none !important}
[data-wk="voice"][data-me] > *{background:transparent !important;box-shadow:none !important;border:none !important}
[data-wk="voicebar"]{background:${C.margin} !important;border-radius:2px !important}

/* 天气：方格纸卡片，兔耳朵小云，薄荷雨点 */
[data-wk="wxcard"]{background:#fff !important;border:1.5px solid ${C.margin} !important;border-radius:4px !important;box-shadow:2px 3px 0 rgba(138,90,95,.12) !important;transform:rotate(-1deg) !important;overflow:visible !important;position:relative !important}
[data-wk="wxcard"]::after{content:"" !important;position:absolute !important;top:-11px !important;right:24px !important;width:24px !important;height:24px !important;background:${svg(STAR())} center/contain no-repeat !important}
[data-wk="wxcardsky"]{background:linear-gradient(${C.line} 1px,transparent 1px) 0 0/14px 14px,linear-gradient(90deg,${C.line} 1px,transparent 1px) 0 0/14px 14px,#fff !important;color:${C.ink} !important}
[data-wk="wxcardsky"] *{color:${C.ink} !important}
[data-wk="wxcardsky"] > div > div:first-child{color:${C.rose} !important}
[data-wk="wxcardsky"] svg{width:84px !important;height:76px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 110'><g stroke='${C.rose}' stroke-width='3.5' stroke-linejoin='round' fill='#fff'><path d='M44 30 C40 12 44 4 48 4 C53 4 54 16 52 30Z'/><path d='M66 30 C70 12 66 4 62 4 C57 4 56 16 58 30Z'/><path d='M24 78 C10 78 6 60 20 56 C18 40 36 32 46 40 C52 24 78 24 82 42 C98 38 110 52 100 66 C108 74 100 82 92 78Z'/></g><path d='M46 28 C44 16 46 10 48 10 C50 10 50 20 50 28Z M64 28 C66 16 64 10 62 10 C60 10 60 20 60 28Z' fill='${C.blush}'/><circle cx='48' cy='60' r='3' fill='${C.ink}'/><circle cx='70' cy='60' r='3' fill='${C.ink}'/><ellipse cx='40' cy='68' rx='5' ry='3' fill='${C.blush}'/><ellipse cx='78' cy='68' rx='5' ry='3' fill='${C.blush}'/><path d='M55 66 q4 4 8 0' fill='none' stroke='${C.ink}' stroke-width='2.2' stroke-linecap='round'/><path d='M42 88 l-4 14 M60 88 l-4 14 M78 88 l-4 14' stroke='${C.mint}' stroke-width='5' stroke-linecap='round'/></svg>`)} center/contain no-repeat !important}
[data-wk="wxcardsky"] svg *{display:none !important}
[data-wk="wxcardrain"],[data-wk="wxcardsky"] span[style*="radius"]{background:#fff !important;border:1.5px solid ${C.margin} !important;color:${C.rose} !important}
[data-wk="wxcardsay"]{background:#fff !important;color:${C.ink} !important;border-top:1.5px solid ${C.margin} !important}
[data-wk="wxcardsay"] > div:first-child{font-style:italic !important;color:${C.rose} !important}
[data-wk="wxcardsay"] > div:first-child::after{content:"：" !important}

/* ───── 第三批：状态卡＝翻开他的一页日记 ───── */
[data-wk="statecard"]{background:${C.paper2} ${svg(PAGE)} repeat !important;background-size:390px 28px !important;border:none !important;border-radius:4px 14px 14px 4px !important;box-shadow:-6px 0 0 ${C.margin},0 14px 34px rgba(94,66,69,.28) !important;overflow:visible !important;position:relative !important;--sc-heart-ink:#d9707e !important;--sc-heart-mask:${svg(HEART("#000"))} !important}
[data-wk="statecard"]::before{content:"" !important;position:absolute !important;top:-30px !important;right:22px !important;width:56px !important;height:56px !important;background:${svg(BUNNY)} center/contain no-repeat !important;transform:rotate(8deg) !important;z-index:3 !important;pointer-events:none !important}
[data-wk="statecard"] *{border-color:${C.line} !important}
[data-wk="statehead"]{background:transparent !important;color:${C.ink} !important;border-bottom:1.5px solid ${C.margin} !important}
[data-wk="statehead"] > [data-wk="avatar"]{border-radius:2px !important;box-shadow:0 0 0 4px #fff,0 0 0 5.5px ${C.margin},2px 4px 0 5px rgba(138,90,95,.12) !important;transform:rotate(-4deg) !important}
[data-wk="statemood"]{display:inline-block !important;line-height:1.5 !important;background:linear-gradient(transparent 45%,rgba(242,196,200,.9) 45%,rgba(242,196,200,.9) 95%,transparent 95%) !important;color:${C.rose} !important;padding:0 6px !important;font-style:italic !important}
/* 此刻 / Ta 眼里：页边的两张索引标签 */
[data-wk="statecard"] > div:has(> button[aria-pressed]){background:transparent !important;border:none !important;gap:8px !important;padding:8px 14px 0 !important}
[data-wk="statecard"] > div > button[aria-pressed]{background:${C.line} !important;color:${C.rose} !important;border:none !important;border-radius:10px 10px 0 0 !important;padding:6px 0 !important;font-style:italic !important}
[data-wk="statecard"] > div > button[aria-pressed="true"]{background:#fff !important;color:${C.ink} !important;box-shadow:0 -2px 0 ${C.margin} inset !important}
/* 看得见的：一张拍立得贴在页上；心里想的：日记正文 */
[data-wk="stateseen"]{background:#fff !important;margin:16px 18px 18px !important;padding:16px 16px 14px !important;border:1px solid ${C.line} !important;box-shadow:2px 4px 0 rgba(138,90,95,.12) !important;transform:rotate(-1.5deg) !important;position:relative !important}
[data-wk="stateseen"] > span[aria-hidden]{display:none !important}
[data-wk="stateseen"]::before{content:"" !important;position:absolute !important;top:-8px !important;left:calc(50% - 30px) !important;width:60px !important;height:16px !important;background:${svg(TAPE())} center/100% 100% no-repeat !important}
[data-wk="stateseen"] *{color:${C.ink} !important}
[data-wk="statewear"]{background:${C.paper} !important;border:1px solid ${C.margin} !important;border-radius:3px !important;padding:4px 10px !important}
[data-wk="statevoice"]{background:transparent !important;border:none !important;border-left:3px solid ${C.margin} !important;border-radius:0 !important;margin:6px 18px 14px 22px !important;padding:2px 12px !important;line-height:28px !important}
[data-wk="statevoice"] *{color:${C.ink} !important;line-height:28px !important}
[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statevoice"] > div:first-of-type > :first-child{color:${C.rose} !important}
/* 好感：一排爱心印章，盖满几颗算几分 */
[data-wk="stateaff"]{background:transparent !important;border-top:1.5px solid ${C.margin} !important}
[data-wk="stateaff"] *{color:${C.rose} !important}
[data-wk="stateheartnum"]{color:#fff !important;-webkit-text-stroke:3px #d9707e !important}
[data-wk="stateheartbase"]{background:#fff !important;opacity:1 !important}
[data-wk="stateaffval"]{display:none !important}
/* 翻旧的：一篇篇往前翻的日记，每条前面一个日期章 */
[data-wk="statehist"]{padding-left:44px !important}
[data-wk="statehistbtn"]{color:${C.rose} !important;font-style:italic !important;border-color:${C.margin} !important}
[data-wk="statehisthead"] > :first-child{color:${C.rose} !important;font-style:italic !important}
[data-wk="statehistitem"]{border-bottom:1.5px solid ${C.margin} !important;padding-bottom:12px !important;position:relative !important}
[data-wk="statehisttime"]{background:${C.butter} !important;color:${C.rose} !important;padding:1px 8px !important;transform:rotate(-3deg) !important;display:inline-block !important}
[data-wk="statehistmood"]{color:${C.rose} !important;font-style:italic !important}
[data-wk="statehisttext"]{color:${C.ink} !important;line-height:28px !important}
[data-wk="statehistmeta"] *{color:${C.rose} !important}
[data-wk="statehistend"]{display:block !important;text-align:center !important;color:${C.margin} !important;font-style:italic !important;margin-top:8px !important}
/* Ta 眼里：贴在页上的几张便签 */
[data-wk="gazepage"]{background:transparent !important}
[data-wk="gazetitle"]{color:${C.rose} !important;text-shadow:none !important;font-style:italic !important}
[data-wk="gazetab"]{background:${C.line} !important;color:${C.rose} !important;border-radius:10px 10px 0 0 !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:#fff !important;color:${C.ink} !important}
[data-wk="gazecard"]{background:#fff !important;border:1px solid ${C.line} !important;border-radius:2px !important;box-shadow:2px 3px 0 rgba(138,90,95,.1) !important;position:relative !important;overflow:visible !important}
[data-wk="gazecard"]:nth-child(odd){transform:rotate(-1deg) !important}
[data-wk="gazecard"]:nth-child(even){transform:rotate(1deg) !important}
[data-wk="gazecard"]::before{content:"" !important;position:absolute !important;top:-7px !important;left:16px !important;width:44px !important;height:13px !important;background:${svg(TAPE(C.margin))} center/100% 100% no-repeat !important}
[data-wk="gazecardname"]{color:${C.ink} !important}
[data-wk="gazecardtext"]{color:${C.rose} !important}
[data-wk="gazeempty"]{border:1.5px solid ${C.margin} !important;border-radius:4px !important;padding-top:84px !important;position:relative !important}
[data-wk="gazeempty"] button{background:${C.margin} !important;color:#fff !important;border-radius:4px !important;box-shadow:2px 2px 0 rgba(138,90,95,.2) !important}
[data-wk="gazeempty"]::before{content:"" !important;position:absolute !important;top:16px !important;left:calc(50% - 30px) !important;width:60px !important;height:60px !important;background:${svg(BUNNY)} center/contain no-repeat !important;opacity:.7 !important;filter:grayscale(.3) !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{background:${C.paper2} ${svg(PAGE)} repeat !important;background-size:390px 28px !important;border-radius:4px !important}

/* ───── 线下：同一本日记，正文就是一页 ───── */
[data-wk="offline"]:not([style*="url("]){background:${C.paper} ${svg(PAGE)} repeat !important;background-size:390px 28px !important}
[data-wk="offline"] [data-wk="offbody"]{background:transparent !important}
[data-wk="offline"] [data-wk="chathead"] [data-wk="headname"] > div:nth-child(2){display:block !important}
[data-wk="offline"] [data-wk="chathead"] button:last-child:not([data-wk]){color:${C.rose} !important;font-style:italic !important;background:linear-gradient(transparent 30%,rgba(242,196,200,.9) 30%,rgba(242,196,200,.9) 88%,transparent 88%) !important}
[data-wk="offcard"]{background:transparent !important;border:none !important;box-shadow:none !important;border-radius:0 !important;padding-left:46px !important}
[data-wk="offcard"][data-me="1"]{background:rgba(255,255,255,.55) !important;border-radius:3px !important;transform:rotate(-.4deg) !important;box-shadow:1px 2px 0 rgba(138,90,95,.08) !important}
[data-wk="offhead"] [data-wk="avatar"],[data-wk="offhead"] img{border-radius:2px !important;box-shadow:0 0 0 3px #fff,0 0 0 4px ${C.margin} !important}
[data-wk="offname"]{color:${C.rose} !important;font-style:italic !important}
[data-wk="offtext"]{color:${C.ink} !important;line-height:28px !important}
[data-wk="offsay"]{background:linear-gradient(transparent 55%,rgba(242,196,200,.75) 55%) !important;color:${C.ink} !important;-webkit-box-decoration-break:clone !important;box-decoration-break:clone !important}
[data-wk="offthought"]{background:${C.butter} !important;border:none !important;border-radius:0 !important;color:${C.rose} !important;transform:rotate(-.8deg) !important;box-shadow:2px 3px 0 rgba(138,90,95,.1) !important}
[data-wk="offreplyopt"]{background:#fff !important;border:1px solid ${C.margin} !important;color:${C.rose} !important;border-radius:3px !important}
[data-wk="offcomposer"]{background:${C.paper2} !important;border-top:1.5px solid ${C.margin} !important}
[data-wk="offcomposer"] textarea{background:#fff !important;border:1.5px solid ${C.line} !important;border-radius:6px !important;color:${C.ink} !important}

/* ───── 通话：字幕像写在一张粉色便签上 ───── */
[data-wk="callbubble"]{background:rgba(255,255,255,.9) !important;color:${C.ink} !important;border-radius:3px !important;border:none !important;box-shadow:2px 3px 0 rgba(0,0,0,.12) !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:#f8dfe3 !important}
[data-wk="callmsg"][data-me="0"] [data-wk="callbubble"]{border-left:3px solid ${C.margin} !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{border-right:3px solid ${C.margin} !important}
[data-wk="callact"]{color:#f8dfe3 !important}
[data-wk="callavatar"]{border-radius:4px !important;box-shadow:0 0 0 8px #fff,0 0 0 10px ${C.margin} !important;transform:rotate(-3deg) !important}

[data-wk="offline"] [data-wk="chatmore"]{font-size:0 !important;color:transparent !important;width:30px !important;height:30px !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:26px !important;height:26px !important;background:${svg(I_PEN)} center/contain no-repeat !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}
[data-wk="offline"] [data-wk="chathead"] + *{margin-top:14px !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:36px !important;height:36px !important;border:none !important;font-size:0 !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]){background:${svg(I_SEND)} center/contain no-repeat !important;border:none !important;box-shadow:none !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]) *{opacity:0 !important}

/* ───── 状态卡改版：从左边翻出来的一整页日记 ───── */
@keyframes pdPageIn{from{transform:translateX(-102%) rotate(-2deg)}to{transform:none}}
[data-wk="statecard"]{position:absolute !important;left:0 !important;top:0 !important;bottom:0 !important;width:86% !important;max-width:none !important;max-height:none !important;border-radius:0 22px 22px 0 !important;border-top:none !important;animation:pdPageIn .32s cubic-bezier(.2,.8,.2,1) both !important;padding-top:var(--app-safe-top, 20px) !important;box-shadow:inset 18px 0 0 -12px ${C.margin},8px 0 30px rgba(94,66,69,.3) !important}
[data-wk="statecard"]::before{top:auto !important;bottom:14px !important;right:18px !important;transform:rotate(-6deg) !important;opacity:.9 !important}
/* 页头：名字写成日记标题，底下一道双线 */
[data-wk="statehead"]{padding:18px 64px 14px 40px !important;border-bottom:3px double ${C.margin} !important}
[data-wk="statehead"] > div{min-width:0 !important;flex:1 1 auto !important}
[data-wk="statehead"] > div > div{white-space:normal !important;overflow:visible !important;text-overflow:clip !important}
[data-wk="statehead"] > div > div:first-child{font-style:italic !important;font-size:22px !important;line-height:1.3 !important;color:${C.ink} !important}
[data-wk="statehead"] > div > div:first-child::after{content:" 的日记" !important;font-size:13px !important;color:${C.rose} !important}
[data-wk="statehead"] > button{position:absolute !important;top:calc(var(--app-safe-top, 20px) + 16px) !important;right:-46px !important;background:#fff !important;border:1.5px solid ${C.margin} !important;color:${C.rose} !important}
/* 此刻 / Ta 眼里：竖着贴在页面右边缘的两张索引标签 */
[data-wk="statecard"] > div:has(> button[aria-pressed]){position:absolute !important;right:-34px !important;top:calc(var(--app-safe-top, 20px) + 120px) !important;flex-direction:column !important;gap:6px !important;padding:0 !important;margin:0 !important;background:transparent !important;border:none !important;z-index:4 !important}
[data-wk="statecard"] > div > button[aria-pressed]{writing-mode:vertical-rl !important;text-orientation:upright !important;width:34px !important;flex:none !important;padding:14px 0 !important;border-radius:0 10px 10px 0 !important;background:${C.line} !important;color:${C.rose} !important;font-style:normal !important;letter-spacing:2px !important;box-shadow:2px 2px 0 rgba(138,90,95,.12) !important}
[data-wk="statecard"] > div > button[aria-pressed="true"]{background:#fff !important;color:${C.ink} !important;border:1.5px solid ${C.margin} !important;border-left:none !important}
[data-wk="statecard"] > div > button[aria-pressed]::before{content:none !important}
/* 好感：从页顶垂下来的一条书签丝带，爱心在丝带末端 */
[data-wk="stateaff"]{position:absolute !important;top:0 !important;right:22px !important;width:40px !important;height:calc(var(--app-safe-top, 20px) + 110px) !important;padding:0 !important;display:flex !important;flex-direction:column !important;justify-content:flex-end !important;align-items:center !important;background:linear-gradient(90deg,#d9808f,#efb6c0 50%,#d9808f) !important;border:none !important;clip-path:polygon(0 0,100% 0,100% 100%,50% calc(100% - 12px),0 100%) !important;z-index:3 !important}
[data-wk="stateaff"] > div:last-child{display:none !important}
[data-wk="stateheart"]{width:34px !important;height:34px !important;margin-bottom:16px !important}
[data-wk="stateheartnum"]{font-size:12px !important;padding-top:2px !important;-webkit-text-stroke:2px #d9707e !important}
[data-wk="stateheartline"]{background:#fff !important}

/* 线下小结：一页夹进来的「那天的经过」，折角＋胶带 */
[data-part="offlog"]{background:#fff !important;border:1.5px solid ${C.line} !important;border-radius:3px !important;box-shadow:2px 3px 0 rgba(138,90,95,.12) !important;position:relative !important;overflow:visible !important;transform:rotate(-.6deg) !important;padding-top:18px !important;background-image:linear-gradient(225deg,${C.paper} 14px,transparent 14px) !important}
[data-part="offlog"]::before{content:"" !important;position:absolute !important;top:-8px !important;left:calc(50% - 30px) !important;width:60px !important;height:16px !important;background:${svg(TAPE(C.margin))} center/100% 100% no-repeat !important}
[data-wk="offlogtitle"]{color:${C.rose} !important;font-style:italic !important;letter-spacing:.1em !important;font-family:inherit !important;font-size:12px !important}
[data-wk="offlogtitle"]::before{content:"" !important;display:inline-block !important;width:12px !important;height:12px !important;margin-right:5px !important;vertical-align:-1px !important;background:${svg(STAR())} center/contain no-repeat !important}
[data-wk="offlogtext"]{color:${C.ink} !important;line-height:28px !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.rose} !important;font-style:italic !important}
[data-wk="offlogtranscript"]{border-top:1.5px solid ${C.margin} !important;color:${C.rose} !important}

/* 顶栏三颗心：按钮放宽，不再被裁 */
[data-wk="chathead"] [data-wk="chatmore"]{width:44px !important;min-width:44px !important;height:30px !important;background-size:40px auto !important;overflow:visible !important}

/* 加号面板：摊开的一页贴纸本，每个功能是一张圆贴纸 */
[data-wk="chatpanel"]{background:${C.paper2} linear-gradient(${C.line} 1px,transparent 1px) 0 0/100% 28px !important;border-top:1.5px solid ${C.margin} !important}
[data-wk="chattoolicon"]{background:#fff !important;border:1.5px solid ${C.margin} !important;border-radius:50% !important;box-shadow:2px 2px 0 rgba(138,90,95,.12) !important;transition:transform .12s !important}
[data-wk="chattool"]:nth-child(3n+1) [data-wk="chattoolicon"]{transform:rotate(-6deg) !important}
[data-wk="chattool"]:nth-child(3n+2) [data-wk="chattoolicon"]{transform:rotate(4deg) !important;background:#fdf1f2 !important}
[data-wk="chattool"]:nth-child(3n) [data-wk="chattoolicon"]{transform:rotate(-2deg) !important;background:#f3faf6 !important}
[data-wk="chattool"]:active [data-wk="chattoolicon"]{transform:scale(.88) !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.rose} !important;color:${C.rose} !important}
[data-wk="chattoollabel"]{color:${C.rose} !important;font-style:italic !important}

/* 引用：一张夹在输入框上的小纸条，回形针别着 */
[data-wk="quotedraft"]{background:#fff !important;border:1.5px solid ${C.line} !important;border-left:3px solid ${C.margin} !important;border-radius:2px !important;position:relative !important;overflow:visible !important;transform:rotate(-.5deg) !important}
[data-wk="quotedraft"]::before{content:"" !important;position:absolute !important;top:-12px !important;left:14px !important;width:12px !important;height:30px !important;background:${svg(CLIP)} center/contain no-repeat !important}
[data-wk="quotedraft"] *{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="quotedraft"] > *{padding-left:20px !important}
[data-wk="quoteicon"]{color:${C.margin} !important}
[data-wk="quotetext"]{color:${C.rose} !important;font-style:italic !important}
[data-wk="quoteclear"]{color:${C.rose} !important}

/* 拆开红包那一页：一张粉色信纸 */
[data-wk="rpenvelope"][data-stage="open"]{background:${C.paper2} ${svg(PAGE)} repeat !important;background-size:390px 28px !important;border:1.5px solid ${C.margin} !important;border-radius:4px !important;box-shadow:0 14px 34px rgba(94,66,69,.25) !important}
[data-wk="rpenvelope"][data-stage="open"] [data-wk="rparc"]{background:linear-gradient(175deg,#efb6c0,#d9808f) !important}
[data-wk="rpenvelope"][data-stage="open"] [data-wk="rpfrom"]{color:${C.ink} !important;font-style:italic !important}
[data-wk="rpenvelope"][data-stage="open"] [data-wk="rpwish"]{color:${C.rose} !important}
[data-wk="rpavatar"]{border-radius:2px !important;box-shadow:0 0 0 4px #fff,0 0 0 5.5px ${C.margin} !important;transform:rotate(-3deg) !important}
[data-wk="rpavatar"] *{border-radius:2px !important}
[data-wk="rpamount"]{color:#d9707e !important;background:linear-gradient(transparent 60%,rgba(246,230,192,.9) 60%) !important;padding:0 6px !important}
[data-wk="rpstatus"]{color:${C.rose} !important;font-style:italic !important}
[data-wk="rpclose"]{background:#fff ${svg(HEART())} center/0 0 no-repeat !important;border:1.5px solid ${C.margin} !important;color:${C.rose} !important}
[data-wk="rpenvelope"][data-stage="closed"]{border-radius:6px !important;border:2px solid #fff !important}
[data-wk="rpenvelope"][data-stage="closed"] [data-wk="rpwish"],[data-wk="rpenvelope"][data-stage="closed"] [data-wk="rpfrom"]{color:#fff !important}

/* 状态卡页头：名字＋「的日记」一行写完 */
[data-wk="statehead"] > div > div:first-child{white-space:nowrap !important;font-size:19px !important;overflow:hidden !important;text-overflow:ellipsis !important}
[data-wk="statehead"]{padding-right:96px !important}

/* 顶栏＝日记本封面：粉色布面，中间缝一块白色布标签写名字 */
[data-wk="chathead"]{background:repeating-linear-gradient(45deg,rgba(255,255,255,.12) 0 2px,transparent 2px 5px),repeating-linear-gradient(-45deg,rgba(138,90,95,.07) 0 2px,transparent 2px 5px),#e9b8bf !important}
[data-wk="chathead"]::after{background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='20' height='16' viewBox='0 0 20 16'><path d='M0 0 H20 V4 A5 5 0 0 1 10 4 A5 5 0 0 1 0 4Z' fill='#e9b8bf'/><path d='M0 4 A5 5 0 0 0 10 4 A5 5 0 0 0 20 4' fill='none' stroke='#fff' stroke-width='1.4'/></svg>`)} repeat-x left top/20px 16px !important}
[data-wk="chathead"] [data-wk="headname"]{background:#fffaf7 !important;border:1.5px solid ${C.rose} !important;box-shadow:0 0 0 3px #fffaf7,0 0 0 4.5px ${C.margin},2px 3px 0 4px rgba(94,66,69,.18) !important;border-radius:3px !important;padding:2px 14px !important;transform:rotate(-1.5deg) !important;max-width:60% !important}
[data-wk="chathead"] [data-wk="headink"]{color:${C.ink} !important;font-style:italic !important}
[data-wk="chathead"] [data-wk="headink"] > span:first-child::after{content:" 的日记" !important;font-size:12px !important;color:${C.rose} !important}
[data-wk="chathead"] [data-wk="chatback"] svg{stroke:#fff !important}
[data-wk="chathead"] [data-wk="headdim"]{color:${C.rose} !important}
[data-wk="statehistbtn"]{border-style:solid !important}
`;

const pack = { kind: "chat-look", v: 1, name: "粉色日记", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "粉色日记-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
