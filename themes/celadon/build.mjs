// 青瓷×焦茶：照参考图第三个配色。点点米底、焦茶描边、我的青瓷气泡角上一颗星、他的米白气泡带「」角标和一只探头小猫。
// 用法：node themes/celadon/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { bg: "#F3EBDA", dot: "#D9CDB4", brown: "#4A3A30", cel: "#A9D3C3", celD: "#8FC0AE", cream: "#FBF6EA", fog: "#A79E92" };

const STAR = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 2.5 L14.6 8.6 L21.2 9.2 L16.2 13.6 L17.7 20.1 L12 16.7 L6.3 20.1 L7.8 13.6 L2.8 9.2 L9.4 8.6Z' fill='${C.cream}' stroke='${C.brown}' stroke-width='1.6' stroke-linejoin='round'/></svg>`;
const CAT = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 84 34'><path d='M4 34 C5 25 9 20 15 17 L17 6 Q18 4 20 5 L27 12 C33 10 41 10 47 12 L54 5 Q56 4 57 6 L59 17 C65 20 69 25 70 34' fill='${C.cream}' stroke='${C.brown}' stroke-width='1.8' stroke-linejoin='round' stroke-linecap='round'/><path d='M70 31 C76 31 80 27 79 22 C78 18 74 17 72 19' fill='none' stroke='${C.brown}' stroke-width='1.8' stroke-linecap='round'/><path d='M24 23 q3.5 2.5 7 0 M43 23 q3.5 2.5 7 0' fill='none' stroke='${C.brown}' stroke-width='1.6' stroke-linecap='round'/><path d='M33.5 27 q1.75 1.6 3.5 0 q1.75 1.6 3.5 0' fill='none' stroke='${C.brown}' stroke-width='1.4' stroke-linecap='round'/><ellipse cx='21' cy='28' rx='3.2' ry='1.8' fill='#F2B8B0'/><ellipse cx='53' cy='28' rx='3.2' ry='1.8' fill='#F2B8B0'/></svg>`;
const CORNER = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 40' preserveAspectRatio='none'><path d='M4 14 V5 H12' fill='none' stroke='${C.brown}' stroke-width='1.6' vector-effect='non-scaling-stroke'/><path d='M96 26 V35 H88' fill='none' stroke='${C.brown}' stroke-width='1.6' vector-effect='non-scaling-stroke'/></svg>`;
const CTL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path d='M1 11 V1 H11' fill='none' stroke='${C.brown}' stroke-width='1.6'/></svg>`;
const CBR = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path d='M11 1 V11 H1' fill='none' stroke='${C.brown}' stroke-width='1.6'/></svg>`;
const DOTS = `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22'><circle cx='3' cy='3' r='1.3' fill='${C.dot}'/><circle cx='14' cy='14' r='1.3' fill='${C.dot}'/></svg>`;
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' fill='${C.cream}' stroke='${C.brown}' stroke-width='1.6'/><path d='M12 7 V17 M7 12 H17' stroke='${C.brown}' stroke-width='1.6' stroke-linecap='round'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 24'><path d='M5 3 H23 Q26 3 26 6 V15 Q26 18 23 18 H12 L6 22 L7 18 H5 Q2 18 2 15 V6 Q2 3 5 3Z' fill='${C.cream}' stroke='${C.brown}' stroke-width='1.6' stroke-linejoin='round'/><circle cx='9' cy='10.5' r='1.3' fill='${C.brown}'/><circle cx='14' cy='10.5' r='1.3' fill='${C.brown}'/><circle cx='19' cy='10.5' r='1.3' fill='${C.brown}'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M4 11 L12 4 L20 11 V20 H4Z' fill='none' stroke='${C.brown}' stroke-width='1.6' stroke-linejoin='round'/></svg>`;
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='5' cy='12' r='1.6' fill='${C.brown}'/><circle cx='12' cy='12' r='1.6' fill='${C.brown}'/><circle cx='19' cy='12' r='1.6' fill='${C.brown}'/></svg>`;

const bubble = { myBg: C.cel, myText: C.brown, myBorder: "1.6px solid " + C.brown, charBg: C.cream, charText: C.brown, charBorder: "1.6px solid " + C.brown, radius: 12, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: true, gap: "normal", time: "show" };
const LINE = `1.6px solid ${C.brown}`;

const css = `
/* ───── 青瓷×焦茶 · 第一批 ───── */
[data-wk="chat"]{background:${svg(DOTS)} 0 0/22px 22px,${C.bg} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：米白底，下面一道焦茶线 */
[data-wk="chathead"]{background:${C.cream} !important;border-bottom:${LINE} !important;box-shadow:none !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.brown} !important}
[data-wk="headdim"]{color:${C.fog} !important}
[data-wk="chatback"] svg{stroke:${C.brown} !important}
[data-wk="chathead"] [data-wk="avatar"],[data-wk="chathead"] img{border-radius:10px !important;box-shadow:0 0 0 1.6px ${C.brown} !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:30px !important;min-width:30px !important;height:30px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/22px no-repeat !important;margin-left:auto !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/22px no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 头像：圆角方块，焦茶细边 */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *{border-radius:10px !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]){box-shadow:0 0 0 1.6px ${C.brown} !important}

/* 名字：只给我那边一个「Me」 */
[data-wk="name"][data-me="0"]{display:none !important}
[data-wk="name"][data-me="1"]{font-size:0 !important;margin:0 4px 6px !important}
[data-wk="name"][data-me="1"]::after{content:"Me" !important;font-size:12px !important;color:${C.brown} !important;letter-spacing:.06em !important}

/* 气泡：焦茶描边；我的青瓷、角上一颗星；他的米白、里面「」两个角标、顶上探出一只小猫 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border:${LINE} !important;border-radius:12px !important;color:${C.brown} !important;padding:11px 22px !important;box-shadow:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${C.cel} !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${svg(CTL)} 8px 7px/11px 11px no-repeat,${svg(CBR)} right 8px bottom 7px/11px 11px no-repeat,${C.cream} !important}
[data-wk="bubble"][data-kind="text"]::before,[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{content:"" !important;position:absolute !important;right:-10px !important;bottom:-10px !important;left:auto !important;top:auto !important;width:22px !important;height:22px !important;background:${svg(STAR)} center/contain no-repeat !important;border:none !important;transform:none !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="0"]{margin-top:22px !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="0"]::before{content:"" !important;position:absolute !important;right:14px !important;left:auto !important;top:-21.5px !important;width:58px !important;height:23.5px !important;background:${svg(CAT)} center bottom/contain no-repeat !important;border:none !important;transform:none !important}

/* 时间、已读：浅灰小字 */
[data-wk="time"] > span{background:${C.cream} !important;color:${C.brown} !important;border:${LINE} !important;border-radius:999px !important;padding:2px 12px !important;font-size:11px !important}
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.cream} !important;border:${LINE} !important;border-radius:12px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.brown} !important}
[data-wk="narrink"]{background:${C.cream} !important;border:${LINE} !important;border-radius:10px !important;color:${C.brown} !important;padding:3px 10px !important}
[data-wk="sysnotetext"]{color:${C.fog} !important}

/* 底栏：米白底一道焦茶线；输入框圆角描边；发送键是「发送」两个字的青瓷块，角上一颗星 */
[data-wk="composer"]{background:${C.cream} !important;border-top:${LINE} !important;align-items:center !important;gap:8px !important}
[data-wk="chatinput"]{background:#fff !important;border:${LINE} !important;border-radius:12px !important;color:${C.brown} !important}
[data-wk="chatinput"]::placeholder{color:${C.fog} !important}
[data-wk="chatplus"],[data-wk="chatreply"]{width:30px !important;min-width:30px !important;height:30px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/26px no-repeat !important}
[data-wk="chatreply"]{background:${svg(I_REPLY)} center/26px no-repeat !important}
[data-wk="send"]{order:99 !important;position:relative !important;overflow:visible !important;width:64px !important;min-width:64px !important;height:36px !important;border:${LINE} !important;border-radius:10px !important;background:${C.cel} !important;box-shadow:none !important;opacity:1 !important;margin-right:6px !important}
[data-wk="send"]::before{content:"发送" !important;position:absolute !important;inset:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;font-size:14px !important;letter-spacing:.2em !important;color:${C.brown} !important}
[data-wk="send"]::after{content:"" !important;position:absolute !important;right:-9px !important;bottom:-9px !important;width:18px !important;height:18px !important;background:${svg(STAR)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.92) !important}
[data-wk="msg"][data-me="0"] [data-wk="name"]{display:none !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]{margin-right:14px !important}

`;

const pack = { kind: "chat-look", v: 1, name: "青瓷焦茶", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "青瓷焦茶-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
