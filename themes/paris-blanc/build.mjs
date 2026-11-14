// 巴黎留白：一张象牙白的信纸，墨黑细线，法语小字。他的话＝白卡描一根发丝线；我的话＝浅灰纸；
// 头像外两圈细线像一枚邮戳；时间两侧细线带菱形；已读写「lu」、已送达写「envoyé」；动描用 « » 括起来。
// 用法：node themes/paris-blanc/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { paper: "#FAF8F4", card: "#FFFFFF", grey: "#EFEDE9", line: "#D8D4CD", ink: "#1E1D1B", sub: "#8A857D", fog: "#B5B0A8" };
const SERIF = `"Didot","Bodoni 72","Playfair Display","Songti SC","Noto Serif SC",Georgia,serif`;
const IT = `italic 400 12px/1 Georgia,"Times New Roman",serif`;

const DIA = (f) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><path d='M5 .8 L9.2 5 L5 9.2 L.8 5Z' fill='${f}'/></svg>`;
const DOT = (fill) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><circle cx='5' cy='5' r='3.2' fill='${fill ? C.ink : "none"}' stroke='${C.ink}' stroke-width='1.1'/></svg>`;
const L = inner => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>${inner}</svg>`;
// 按键：主页＝一扇巴黎窗（拱顶、十字窗棂）；更多＝一支细羽毛；加号＝细十字；发送＝钢笔尖；最右「让他回复」＝黑圆里一个细线对话框
const I_HOUSE = L(`<path d='M13 30 V17 Q13 10 20 10 Q27 10 27 17 V30Z' fill='none' stroke='${C.ink}' stroke-width='1.3'/><path d='M20 10.5 V30 M13 21 H27' stroke='${C.ink}' stroke-width='1'/><path d='M11 30 H29' stroke='${C.ink}' stroke-width='1.3'/>`);
const I_MORE = L(`<path d='M27 9 Q16 13 13 30' fill='none' stroke='${C.ink}' stroke-width='1.2' stroke-linecap='round'/><path d='M27 9 Q30 18 22 24 Q17 27 14 28 Q17 20 20 16 Q23 11 27 9Z' fill='none' stroke='${C.ink}' stroke-width='1' stroke-linejoin='round'/>`);
const I_PLUS = L(`<path d='M20 12 V28 M12 20 H28' stroke='${C.ink}' stroke-width='1.2' stroke-linecap='round'/>`);
const I_SEND = L(`<path d='M20 8 L27 19 L23 30 H17 L13 19Z' fill='none' stroke='${C.ink}' stroke-width='1.2' stroke-linejoin='round'/><path d='M20 8 V21' stroke='${C.ink}' stroke-width='1'/><circle cx='20' cy='22' r='1.6' fill='none' stroke='${C.ink}' stroke-width='1'/><path d='M16 34 H24' stroke='${C.ink}' stroke-width='1.2' stroke-linecap='round'/>`);
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44'><circle cx='22' cy='22' r='20' fill='${C.ink}'/><path d='M13 16 H31 Q32.5 16 32.5 17.5 V25 Q32.5 26.5 31 26.5 H21 L16 30 V26.5 H13 Q11.5 26.5 11.5 25 V17.5 Q11.5 16 13 16Z' fill='none' stroke='#fff' stroke-width='1.3' stroke-linejoin='round'/></svg>`;

const bubble = { myBg: C.grey, myText: C.ink, myBorder: "none", charBg: C.card, charText: C.ink, charBorder: "none", radius: 4, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 巴黎留白 · 第一批 ───── */
[data-wk="chat"]{background:${C.paper} !important}
[data-wk="chat"] *{font-family:${SERIF} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：象牙白，名字是细衬线，底下一根发丝线 */
[data-wk="chathead"]{background:${C.paper} !important;border-bottom:none !important;box-shadow:0 1px 0 ${C.line} !important;gap:6px !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important}
[data-wk="headname"] > [data-wk="headink"]{font-weight:400 !important;letter-spacing:.2em !important}
[data-wk="headdim"]{color:${C.fog} !important;white-space:nowrap !important;letter-spacing:.15em !important}
[data-wk="chatback"],[data-wk="chatback"] *{color:${C.ink} !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:${C.ink} !important;stroke-width:1.2 !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{flex:none !important;width:32px !important;min-width:32px !important;height:32px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chathead"] + *:not([data-wk="body"]){margin-top:4px !important}

/* 头像：两圈细线，像信封上一枚圆邮戳 */
button[data-wk="avatar"],span[data-wk="avatar"],[data-wk="rpsingle"] [data-wk="avatar"]{border-radius:50% !important;box-shadow:0 0 0 3px ${C.paper},0 0 0 4px ${C.ink},0 0 0 7px ${C.paper},0 0 0 7.6px ${C.line} !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{border-radius:50% !important;filter:grayscale(.15) !important}
[data-wk="chathead"] img[data-wk="avatar"]{box-shadow:0 0 0 2px ${C.paper},0 0 0 3px ${C.ink} !important}

/* 气泡：他的白卡描发丝线；我的浅灰纸；都不带尾巴，左下（他）/右下（我）一个小直角 */
[data-wk="bubble"][data-kind="text"]{border:none !important;letter-spacing:.1em !important;padding:12px 20px !important;color:${C.ink} !important;font-size:14.5px !important;line-height:1.75 !important}
[data-wk="bubble"][data-kind="text"]::before,[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.card} !important;border-radius:6px 6px 6px 1px !important;box-shadow:0 0 0 .8px ${C.line},0 3px 10px rgba(30,29,27,.05) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${C.grey} !important;border-radius:6px 6px 1px 6px !important;box-shadow:none !important}

/* 时间：两侧一根细线，线头一颗菱形，中间斜体小字 */
[data-wk="time"]{display:flex !important;justify-content:center !important}
[data-wk="time"] > span{display:inline-flex !important;align-items:center !important;gap:10px !important;background:transparent !important;border:none !important;box-shadow:none !important;color:${C.sub} !important;font:${IT} !important;letter-spacing:.12em !important;padding:0 !important}
[data-wk="time"] > span::before,[data-wk="time"] > span::after{content:"" !important;width:74px !important;height:8px !important;background:${svg(DIA(C.ink))} right center/7px 7px no-repeat,linear-gradient(${C.ink},${C.ink}) left center/calc(100% - 9px) .8px no-repeat !important}
[data-wk="time"] > span::after{transform:scaleX(-1) !important}

/* 已读＝斜体「lu」配实心小点；已送达＝「envoyé」配空心小点 */
[data-wk="meta"]{display:inline-flex !important;align-items:center !important;gap:8px !important;font-size:0 !important;color:${C.sub} !important}
[data-wk="meta"] *{display:none !important}
[data-wk="meta"]::before{content:"envoyé" !important;font:${IT} !important;letter-spacing:.06em !important;color:${C.sub} !important}
[data-wk="meta"][data-read="1"]::before{content:"lu" !important}
[data-wk="meta"]::after{content:"" !important;width:8px !important;height:8px !important;flex:none !important;background:${svg(DOT(false))} center/contain no-repeat !important}
[data-wk="meta"][data-read="1"]::after{background:${svg(DOT(true))} center/contain no-repeat !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.card} !important;border:none !important;border-radius:6px 6px 6px 1px !important;box-shadow:0 0 0 .8px ${C.line} !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.ink} !important;width:4px !important;height:4px !important}
[data-wk="name"]{color:${C.sub} !important;font-style:italic !important}

/* 动描：用 « » 括起来的一句斜体，居中，不进框 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"],[data-wk="myactink"]{display:block !important;background:transparent !important;border:none !important;border-radius:0 !important;box-shadow:none !important;color:${C.sub} !important;font-style:italic !important;font-size:13px !important;line-height:1.9 !important;letter-spacing:.08em !important;text-align:center !important;padding:4px 18px !important}
[data-wk="narrink"]::before,[data-wk="myactink"]::before{content:"« " !important;color:${C.ink} !important;font-style:normal !important}
[data-wk="narrink"]::after,[data-wk="myactink"]::after{content:" »" !important;color:${C.ink} !important;font-style:normal !important}
[data-wk="myactink"]{text-align:right !important}
[data-wk="narrbar"]{background:${C.paper} !important;border-top:.8px solid ${C.line} !important}
[data-wk="narrkind"]{border:.8px solid ${C.line} !important;border-radius:2px !important;background:transparent !important;color:${C.sub} !important}
[data-wk="narrkind"][data-on="1"]{background:${C.ink} !important;border-color:${C.ink} !important;color:${C.paper} !important}
/* 系统提示：一行小号字，前后各一段细线 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{display:inline-block !important;background:linear-gradient(${C.line},${C.line}) left center/14px .8px no-repeat,linear-gradient(${C.line},${C.line}) right center/14px .8px no-repeat !important;border:none !important;color:${C.sub} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.14em !important;padding:0 22px !important}
[data-wk="sysnoteclose"]{color:${C.fog} !important}

/* 底栏：象牙白，上沿一根细线；输入框只是一道下划线；最右「让他回复」是黑色圆钮 */
[data-wk="composer"]{background:${C.paper} !important;border-top:none !important;box-shadow:0 -1px 0 ${C.line} !important;align-items:center !important;gap:10px !important}
[data-wk="chatinput"]{background:transparent !important;border:none !important;border-bottom:1px solid ${C.ink} !important;border-radius:0 !important;color:${C.ink} !important;letter-spacing:.08em !important;padding-left:2px !important;padding-right:2px !important}
[data-wk="chatinput"]::placeholder{color:${C.fog} !important;font-style:italic !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{width:30px !important;min-width:30px !important;height:30px !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{width:32px !important;min-width:32px !important;height:32px !important;background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:42px !important;min-width:42px !important;height:42px !important;border-radius:50% !important;background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.92) !important}
[data-wk="chatpanel"]{background:${C.paper} !important;border-top:.8px solid ${C.line} !important}
[data-wk="quotedraft"]{position:relative !important;z-index:3 !important}
`;

const pack = { kind: "chat-look", v: 1, name: "巴黎留白", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "巴黎留白-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
