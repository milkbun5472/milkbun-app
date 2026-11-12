// 灰与舞裙（灰姑娘）：很淡。他的话＝壁炉边的灰烬米色，我的话＝午夜前变出来的雾蓝舞裙；
// 连发一级级错开像王宫台阶；头像外一圈钟面刻度，指针停在快十二点；一点南瓜橘做点缀。用法：node themes/cinderella/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { bg: "#F4EFE8", line: "#E6DED3", ash: "#E7DFD4", ashD: "#CFC4B5", ashInk: "#5C5249", blue: "#8FA4C4", blueD: "#6E83A3", ink: "#4A4440", fog: "#A79E94", orange: "#E8813A" };
const SERIF = `"Songti SC","Noto Serif SC","STSong",serif`;

// 舞厅地板：极淡的斜格
const FLOOR = `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><path d='M0 22 L22 0 L44 22 L22 44Z' fill='none' stroke='#E9E2D8' stroke-width='1'/></svg>`;
// 钟面头像框：一圈短刻度，指针停在快十二点
const DIAL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>${Array.from({ length: 12 }, (_, i) => { const a = i * 30 * Math.PI / 180, r1 = i % 3 ? 44 : 41, r2 = 49; return `<path d='M${(50 + r1 * Math.sin(a)).toFixed(1)} ${(50 - r1 * Math.cos(a)).toFixed(1)} L${(50 + r2 * Math.sin(a)).toFixed(1)} ${(50 - r2 * Math.cos(a)).toFixed(1)}' stroke='${C.ink}' stroke-width='${i % 3 ? 1.6 : 2.6}' stroke-linecap='round' opacity='.75'/>`; }).join("")}</svg>`;
const SPARK = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-6 -8 12 16'><path d='M0 -7 Q.6 -.6 5 0 Q.6 .6 0 7 Q-.6 .6 -5 0 Q-.6 -.6 0 -7Z' fill='${C.orange}'/></svg>`;
const CLOCK = (fill) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><circle cx='10' cy='10' r='8' fill='${fill ? C.orange : "none"}' stroke='${fill ? C.orange : C.fog}' stroke-width='1.5'/><path d='M10 5 V10.5 L13 12' fill='none' stroke='${fill ? "#fff" : C.fog}' stroke-width='1.6' stroke-linecap='round'/></svg>`;
// 玻璃鞋（细线、带一点蓝光）
const SLIPPER = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 22'><path d='M3 17 Q4 10 12 10 Q18 10 24 6 Q28 4 32 7 Q36 10 37 16 L37 18 H30 L29 14 Q26 15 22 17 Q14 20 6 19 Q3 19 3 17Z' fill='rgba(180,205,235,.35)' stroke='${C.blueD}' stroke-width='1.2' stroke-linejoin='round'/><path d='M30 14 L31 21' stroke='${C.blueD}' stroke-width='1.6' stroke-linecap='round'/><path d='M10 13 Q14 12 17 12' fill='none' stroke='#fff' stroke-width='1.2' stroke-linecap='round'/></svg>`;
const L = (inner, c = C.ink) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>${inner.replace(/INK/g, c)}</svg>`;
// 主页＝南瓜马车；更多＝仙女教母的魔杖；加号；发送＝细箭头；回复＝雾蓝块里一个对话框
const I_HOUSE = L(`<path d='M10 25 Q8 16 15 13 Q20 11 25 13 Q32 16 30 25Z' fill='none' stroke='INK' stroke-width='1.5' stroke-linejoin='round'/><path d='M20 12 Q20 8 23 7' fill='none' stroke='INK' stroke-width='1.4' stroke-linecap='round'/><path d='M16 13 Q15 19 16 25 M24 13 Q25 19 24 25' fill='none' stroke='INK' stroke-width='1' opacity='.6'/><circle cx='12' cy='29' r='3' fill='none' stroke='INK' stroke-width='1.4'/><circle cx='28' cy='29' r='3' fill='none' stroke='INK' stroke-width='1.4'/>`);
const I_MORE = L(`<path d='M10 30 L24 16' stroke='INK' stroke-width='1.6' stroke-linecap='round'/><path transform='translate(27 13)' d='M0 -6 Q.5 -.5 4.5 0 Q.5 .5 0 6 Q-.5 .5 -4.5 0 Q-.5 -.5 0 -6Z' fill='${C.orange}'/><circle cx='31' cy='22' r='1' fill='${C.orange}'/><circle cx='19' cy='10' r='.9' fill='${C.orange}'/>`);
const I_PLUS = L(`<path d='M20 12 V28 M12 20 H28' stroke='INK' stroke-width='1.6' stroke-linecap='round'/>`);
const I_SEND = L(`<path d='M12 20 H28 M22 14 L28 20 L22 26' fill='none' stroke='INK' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/>`);
const I_REPLY = L(`<path d='M11 14 H29 Q31 14 31 16 V23 Q31 25 29 25 H19 L14 29 V25 H11 Q9 25 9 23 V16 Q9 14 11 14Z' fill='none' stroke='#fff' stroke-width='1.5' stroke-linejoin='round'/>`);

const bubble = { myBg: C.blue, myText: "#fff", myBorder: "none", charBg: C.ash, charText: C.ashInk, charBorder: "none", radius: 3, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 灰与舞裙 · 第一批 ───── */
[data-wk="chat"]{background:${svg(FLOOR)} 0 0/44px 44px,${C.bg} !important}
[data-wk="body"]{background:transparent !important}
[data-wk="chat"] *{font-family:${SERIF} !important}

/* 顶栏底栏：象牙白浮板，底下一道淡影 */
[data-wk="chathead"]{background:#FBF8F3 !important;border-bottom:none !important;box-shadow:0 5px 0 ${C.line},0 8px 14px rgba(120,100,80,.08) !important;gap:6px !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important}
[data-wk="headname"] > [data-wk="headink"]{font-weight:700 !important;letter-spacing:.12em !important}
[data-wk="headdim"]{color:${C.fog} !important;white-space:nowrap !important;letter-spacing:.1em !important}
[data-wk="chatback"],[data-wk="chatback"] *{color:${C.ink} !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:${C.ink} !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:34px !important;min-width:34px !important;height:34px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chathead"] + *:not([data-wk="body"]){margin-top:6px !important}

/* 头像：外面一圈钟面刻度 */
button[data-wk="avatar"],span[data-wk="avatar"]{position:relative !important;overflow:visible !important;border-radius:50% !important;box-shadow:0 0 0 2px #fff !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{border-radius:50% !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;inset:-26% !important;background:${svg(DIAL)} center/contain no-repeat !important;pointer-events:none !important;border:none !important;border-radius:0 !important}
[data-wk="chathead"] button[data-wk="avatar"]::before,[data-wk="chathead"] span[data-wk="avatar"]::before{inset:-18% !important}

/* 气泡：直角小卡，底下压一道厚边（像一级台阶的立面） */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:3px !important;letter-spacing:.08em !important;padding:11px 18px !important;border:none !important}
[data-wk="bubble"][data-kind="text"]::before,[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.ash} !important;color:${C.ashInk} !important;box-shadow:0 5px 0 ${C.ashD},0 9px 12px rgba(120,100,80,.10) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${C.blue} !important;color:#fff !important;box-shadow:0 5px 0 ${C.blueD},0 9px 12px rgba(80,100,140,.15) !important}
/* 连发一级级错开：他往右走、你往左走，像王宫的台阶（最多错三级） */
[data-wk="msg"][data-me="0"][data-first="0"] [data-wk="bubble"]{transform:translateX(34px) !important}
[data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] [data-wk="bubble"]{transform:translateX(68px) !important}
[data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] [data-wk="bubble"]{transform:translateX(102px) !important}
[data-wk="msg"][data-me="1"][data-first="0"] [data-wk="bubble"]{transform:translateX(-34px) !important}
[data-wk="msg"][data-me="1"][data-first="0"] + [data-wk="msg"][data-me="1"][data-first="0"] [data-wk="bubble"]{transform:translateX(-68px) !important}
[data-wk="msg"][data-me="0"][data-first="0"] [data-wk="meta"]{transform:translateX(34px) !important}
/* 一串最后一条旁边，魔杖点一颗橘星 */
[data-wk="msg"][data-last="1"] [data-wk="bubble"][data-kind="text"][data-me="0"]::after{content:"" !important;position:absolute !important;right:-22px !important;top:50% !important;width:12px !important;height:16px !important;margin-top:-8px !important;background:${svg(SPARK)} center/contain no-repeat !important}
[data-wk="msg"][data-last="1"][data-first="0"] [data-wk="bubble"][data-kind="text"][data-me="1"]::after{content:"" !important;position:absolute !important;left:-22px !important;top:50% !important;width:12px !important;height:16px !important;margin-top:-8px !important;background:${svg(SPARK)} center/contain no-repeat !important}

/* 时间：「今天 23:52」，旁边一只玻璃鞋，底下一行「在午夜之前」 */
[data-wk="time"]{display:flex !important;justify-content:center !important;position:relative !important;padding-bottom:14px !important}
[data-wk="time"] > span{display:inline-block !important;background:transparent !important;border:none !important;box-shadow:none !important;color:${C.ink} !important;letter-spacing:.15em !important;font-size:13px !important;padding:0 0 0 34px !important;background:${svg(SLIPPER)} left center/26px 14px no-repeat !important}
[data-wk="time"]::after{content:"在午夜之前" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:0 !important;text-align:center !important;font-size:9.5px !important;letter-spacing:.4em !important;color:${C.fog} !important}

/* 已读＝一颗橘色小钟；已送达＝灰色空心小钟 */
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important;letter-spacing:.1em !important;display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"]::after{content:"" !important;width:12px !important;height:12px !important;flex:none !important;background:${svg(CLOCK(false))} center/contain no-repeat !important}
[data-wk="meta"][data-read="1"]::after{background:${svg(CLOCK(true))} center/contain no-repeat !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.ash} !important;border:none !important;border-radius:3px !important;box-shadow:0 5px 0 ${C.ashD} !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.orange} !important}
[data-wk="name"]{color:${C.fog} !important}

/* 动描：没有框，灰烬色斜体，左边一道细细的竖线、线头点一颗橘星 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{position:relative !important;display:block !important;background:transparent !important;border:none !important;border-left:1px solid ${C.ashD} !important;border-radius:0 !important;box-shadow:none !important;color:#8A7F74 !important;font-style:italic !important;font-size:13px !important;line-height:1.85 !important;letter-spacing:.06em !important;padding:2px 0 2px 16px !important;margin-left:10px !important}
[data-wk="narrink"]::before{content:"" !important;position:absolute !important;left:-5px !important;top:-8px !important;width:9px !important;height:12px !important;background:${svg(SPARK)} center/contain no-repeat !important}
/* 系统提示：一行小字，前面一颗灰色空心小钟 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{border:none !important;color:${C.fog} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.1em !important;padding-left:16px !important;background:${svg(CLOCK(false))} left center/11px 11px no-repeat !important}
[data-wk="sysnoteclose"]{color:${C.fog} !important}

/* 底栏：象牙白浮板；输入框是一条灰烬色的槽；最右那块雾蓝的是「让他回复」，发送是它左边的细箭头 */
[data-wk="composer"]{background:#FBF8F3 !important;border-top:none !important;box-shadow:0 -1px 0 ${C.line},0 -6px 14px rgba(120,100,80,.06) !important;align-items:center !important;gap:10px !important}
[data-wk="chatinput"]{background:#EFE9E1 !important;border:none !important;border-radius:3px !important;color:${C.ink} !important;letter-spacing:.08em !important}
[data-wk="chatinput"]::placeholder{color:#B3A99E !important}
[data-wk="chatplus"],[data-wk="send"]{width:34px !important;min-width:34px !important;height:34px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:58px !important;min-width:58px !important;height:40px !important;border:none !important;border-radius:3px !important;background:${svg(I_REPLY)} center/30px no-repeat,${C.blue} !important;box-shadow:0 5px 0 ${C.blueD} !important;margin-bottom:5px !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active{transform:scale(.9) !important}
[data-wk="chatreply"]:active{transform:translateY(4px) !important;box-shadow:0 1px 0 ${C.blueD} !important}
[data-wk="chatpanel"]{background:#FBF8F3 !important;border-top:1px solid ${C.line} !important}
`;

const pack = { kind: "chat-look", v: 1, name: "灰与舞裙", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "灰与舞裙-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
