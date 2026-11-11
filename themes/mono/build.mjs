// 黑白极简聊天美化：生成 chat-look 包。用法：node themes/mono/build.mjs
// 照参考图：浮起来的白胶囊顶栏、我的话是炭黑胶囊、他的话是白胶囊、时间灰胶囊、
//          已送达灰勾／已读红勾、底栏白胶囊＋外面一颗黑色圆形发送键。背景可以自己换。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { ink: "#1C1C1E", ink2: "#2C2C30", paper: "#FFFFFF", fog: "#8E8E93", line: "rgba(0,0,0,.08)", red: "#E5533D" };

const CHECK = (c) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 12'><path d='M1.5 6.5 L5 10 L12.5 2' fill='none' stroke='${c}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 5 V19 M5 12 H19' stroke='${C.ink}' stroke-width='1.8' stroke-linecap='round'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 24'><path d='M5 3 H23 Q26 3 26 6 V15 Q26 18 23 18 H12 L6 22 L7 18 H5 Q2 18 2 15 V6 Q2 3 5 3Z' fill='none' stroke='${C.ink}' stroke-width='1.7' stroke-linejoin='round'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><circle cx='24' cy='24' r='23' fill='${C.ink}'/><path d='M24 34 V14 M16 22 L24 14 L32 22' fill='none' stroke='#fff' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M4 11 L12 4 L20 11 V20 H4Z' fill='none' stroke='${C.ink}' stroke-width='1.7' stroke-linejoin='round'/></svg>`;
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='5' cy='12' r='1.7' fill='${C.ink}'/><circle cx='12' cy='12' r='1.7' fill='${C.ink}'/><circle cx='19' cy='12' r='1.7' fill='${C.ink}'/></svg>`;

const bubble = { myBg: C.ink2, myText: "#fff", myBorder: "none", charBg: C.paper, charText: C.ink, charBorder: "none", radius: 24, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };
const FLOAT = "0 8px 24px rgba(0,0,0,.12),0 1px 3px rgba(0,0,0,.06)";

const css = `
/* ───── 黑白 · 第一批 ───── */
[data-wk="chat"]{background:radial-gradient(ellipse at 85% 30%,rgba(240,205,180,.55),transparent 55%),radial-gradient(ellipse at 15% 80%,rgba(210,205,235,.45),transparent 55%),linear-gradient(180deg,#F2F1EE,#ECE9E6) !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：一条浮起来的白胶囊 */
[data-wk="chathead"]{background:transparent !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;z-index:5 !important;padding-left:24px !important;padding-right:24px !important}
[data-wk="chathead"]::before{content:"" !important;position:absolute !important;left:12px !important;right:12px !important;top:calc(var(--app-safe-top, 0px) + 4px) !important;bottom:4px !important;border-radius:999px !important;background:rgba(255,255,255,.92) !important;box-shadow:${FLOAT} !important;pointer-events:none !important;z-index:-1 !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important;font-weight:700 !important}
[data-wk="headdim"]{color:${C.fog} !important}
[data-wk="chatback"] svg{stroke:${C.ink} !important}
[data-wk="chathead"] [data-wk="avatar"]{border-radius:50% !important;position:relative !important;overflow:visible !important}
[data-wk="chathead"] [data-wk="avatar"] *{border-radius:50% !important}
[data-wk="chathead"] [data-wk="avatar"]::after{content:"" !important;position:absolute !important;right:-1px !important;bottom:-1px !important;width:10px !important;height:10px !important;border-radius:50% !important;background:${C.red} !important;box-shadow:0 0 0 2px #fff !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:32px !important;min-width:32px !important;height:32px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/22px no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/22px no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 头像：圆的，不加框 */
button[data-wk="avatar"],span[data-wk="avatar"]{border-radius:50% !important;box-shadow:none !important}
button[data-wk="avatar"] *,span[data-wk="avatar"] *,img[data-wk="avatar"]{border-radius:50% !important}

/* 气泡：胶囊，我的炭黑、他的纯白，都带一层柔和投影 */
[data-wk="bubble"][data-kind="text"]{border-radius:24px !important;padding:12px 18px !important;border:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${C.ink2} !important;color:#fff !important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),0 6px 16px rgba(0,0,0,.18) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.paper} !important;color:${C.ink} !important;box-shadow:0 6px 16px rgba(0,0,0,.08) !important}
[data-wk="bubble"][data-kind="text"]::before,[data-wk="bubble"][data-kind="text"]::after{content:none !important}

/* 时间：灰色小胶囊 */
[data-wk="time"] > span{display:inline-block !important;background:rgba(150,150,155,.35) !important;color:rgba(255,255,255,.95) !important;border-radius:999px !important;padding:3px 14px !important;border:none !important;font-size:11px !important}
/* 已读：白色小胶囊，已送达灰勾、已读红勾 */
[data-wk="meta"]{display:inline-flex !important;align-items:center !important;background:rgba(255,255,255,.85) !important;color:${C.fog} !important;border-radius:999px !important;padding:1px 9px 1px 6px !important;font-size:10.5px !important}
[data-wk="meta"]::before{content:"" !important;width:12px !important;height:10px !important;margin-right:4px !important;background:${svg(CHECK(C.fog))} center/contain no-repeat !important}
[data-wk="meta"][data-read="1"]::before{background:${svg(CHECK(C.red))} center/contain no-repeat !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.paper} !important;border:none !important;border-radius:24px !important;box-shadow:0 6px 16px rgba(0,0,0,.08) !important}
[data-wk="typingdot"]{background:${C.fog} !important}
[data-wk="narrink"]{background:rgba(255,255,255,.8) !important;border-radius:14px !important;color:${C.ink} !important;padding:3px 10px !important}
[data-wk="sysnotetext"]{color:${C.fog} !important}

/* 底栏：白胶囊包住加号、输入、回复；发送是外面单独一颗黑色圆键 */
[data-wk="composer"]{background:transparent !important;border-top:none !important;position:relative !important;z-index:2 !important;align-items:center !important;padding-left:24px !important;padding-right:14px !important;gap:6px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:10px !important;right:74px !important;top:4px !important;bottom:calc(env(safe-area-inset-bottom) * .4 + var(--composer-lift, 0px) - 6px) !important;border-radius:999px !important;background:rgba(255,255,255,.95) !important;box-shadow:${FLOAT} !important;pointer-events:none !important;z-index:-1 !important}
[data-wk="chatinput"]{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:#A1A1A6 !important}
[data-wk="chatplus"],[data-wk="chatreply"]{width:32px !important;min-width:32px !important;height:32px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important;align-self:center !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/22px no-repeat !important}
[data-wk="chatreply"]{background:${svg(I_REPLY)} center/26px no-repeat !important;margin-right:14px !important}
[data-wk="send"]{order:99 !important;width:52px !important;min-width:52px !important;height:52px !important;border:none !important;border-radius:50% !important;background:${svg(I_SEND)} center/contain no-repeat !important;box-shadow:0 8px 18px rgba(0,0,0,.25) !important;opacity:1 !important;align-self:center !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.9) !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="chathead"] img,[data-wk="chathead"] [data-wk="avatar"],[data-wk="chathead"] [data-wk="avatar"] > *{border-radius:50% !important;overflow:hidden !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"]){position:relative !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"])::after{content:"" !important;position:absolute !important;left:30px !important;top:calc(50% + 12px) !important;width:10px !important;height:10px !important;border-radius:50% !important;background:#E5533D !important;box-shadow:0 0 0 2px #fff !important;z-index:3 !important}

`;

const pack = { kind: "chat-look", v: 1, name: "黑白", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "黑白-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
