// 墨绿贝壳：法式复古。墨绿暗纹底、奶油顶栏底栏、橘红细边；所有框都顶一枚金扇贝、角上卷一道金涡卷。
// 我的话＝橘红圆角牌，他的话＝奶油圆角牌；头像＝金珠圈镜框，上贝壳下涡卷。用法：node themes/green-shell/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { green: "#1F4A40", green2: "#183C34", greenL: "#2E6355", cream: "#F4EAD2", cream2: "#EADBB8", orange: "#D5603A", orangeD: "#A8442A", gold: "#D8B26A", goldD: "#9C7A3C", ink: "#3B2E22", dim: "#C9BFA6" };
const SERIF = `"Songti SC","Noto Serif SC","STSong",serif`;

// 底纹：一排排叶形暗纹
const DAMASK = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='64'><g fill='none' stroke='#2C5C50' stroke-width='1.2' opacity='.9'><path d='M24 4 Q34 18 24 32 Q14 18 24 4Z'/><path d='M24 32 Q34 46 24 60 Q14 46 24 32Z'/><path d='M0 18 Q8 32 0 46 M48 18 Q40 32 48 46'/></g></svg>`;
// 扇贝
const SHELL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 24'><path d='M20 22 L4 12 Q6 3 20 2 Q34 3 36 12Z' fill='${C.gold}' stroke='${C.goldD}' stroke-width='1'/><path d='M20 22 L8 6 M20 22 L14 3 M20 22 V2 M20 22 L26 3 M20 22 L32 6' stroke='${C.cream}' stroke-width='1' opacity='.85'/><circle cx='20' cy='21' r='2.4' fill='${C.goldD}'/></svg>`;
// 涡卷（右上朝外卷）
const CURL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M2 20 Q10 20 14 14 Q18 8 14 5 Q10 3 9 7 Q9 10 12 10' fill='none' stroke='${C.gold}' stroke-width='1.6' stroke-linecap='round'/><path d='M18 3 L21 1' stroke='${C.gold}' stroke-width='1.6' stroke-linecap='round'/></svg>`;
const CURLB = CURL.replace("viewBox='0 0 24 24'>", "viewBox='0 0 24 24'><g transform='rotate(180 12 12)'>").replace("</svg>", "</g></svg>");
// 头像镜框：金珠圈＋顶贝壳＋底涡卷
const MIRROR = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 120'><circle cx='50' cy='60' r='40' fill='none' stroke='${C.gold}' stroke-width='5'/><circle cx='50' cy='60' r='40' fill='none' stroke='${C.cream}' stroke-width='2' stroke-dasharray='.1 6' stroke-linecap='round'/><circle cx='50' cy='60' r='35.5' fill='none' stroke='${C.goldD}' stroke-width='1'/><g transform='translate(30 2) scale(1)'><path d='M20 22 L4 12 Q6 3 20 2 Q34 3 36 12Z' fill='${C.gold}' stroke='${C.goldD}' stroke-width='1'/><path d='M20 22 L8 6 M20 22 L14 3 M20 22 V2 M20 22 L26 3 M20 22 L32 6' stroke='${C.cream}' stroke-width='1'/></g><path d='M38 104 Q36 112 42 114 Q46 115 46 110 M62 104 Q64 112 58 114 Q54 115 54 110' fill='none' stroke='${C.gold}' stroke-width='2.4' stroke-linecap='round'/><path d='M8 62 Q2 66 6 72 Q10 74 12 70 M92 62 Q98 66 94 72 Q90 74 88 70' fill='none' stroke='${C.gold}' stroke-width='2' stroke-linecap='round'/></svg>`;
// 涡卷花边带
const SCROLLBAND = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='20'><path d='M0 14 Q10 14 14 9 Q17 4 13 3 Q9 3 10 7 Q11 10 16 10 Q24 10 30 14 Q35 17 40 14' fill='none' stroke='${C.gold}' stroke-width='1.5' stroke-linecap='round'/></svg>`;
// 时间：椭圆徽框
const OVAL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 60' preserveAspectRatio='none'><ellipse cx='110' cy='34' rx='100' ry='20' fill='${C.cream}' stroke='${C.gold}' stroke-width='2.4' vector-effect='non-scaling-stroke'/><ellipse cx='110' cy='34' rx='94' ry='16' fill='none' stroke='${C.goldD}' stroke-width='1' vector-effect='non-scaling-stroke'/></svg>`;
const SPIRAL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><circle cx='10' cy='10' r='8.5' fill='none' stroke='${C.orange}' stroke-width='1.6'/><path d='M10 10 Q13 9 12 6.5 Q10 4.5 7.5 6.5 Q5.5 9.5 8 12.5 Q11.5 14.5 14 11.5' fill='none' stroke='${C.orange}' stroke-width='1.4' stroke-linecap='round'/></svg>`;
const DOT = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><circle cx='10' cy='10' r='8' fill='${C.orange}'/></svg>`;
const RB = (fill, inner) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='18' fill='${fill}' stroke='${C.ink}' stroke-width='1.6'/>${inner}</svg>`;
const I_PLUS = RB(C.greenL, `<path d='M20 12 V28 M12 20 H28' stroke='${C.cream}' stroke-width='2.2' stroke-linecap='round'/>`);
const I_HOUSE = RB(C.greenL, `<path d='M12 20 L20 13 L28 20 V27 H12Z' fill='${C.cream}' stroke='${C.ink}' stroke-width='1.6' stroke-linejoin='round'/>`);
const I_MORE = RB(C.orange, `<g fill='${C.cream}' stroke='${C.ink}' stroke-width='1'><circle cx='13' cy='20' r='2.6'/><circle cx='20' cy='20' r='2.6'/><circle cx='27' cy='20' r='2.6'/></g>`);
const I_REPLY = RB(C.greenL, `<path d='M11 14 H29 V24 H19 L14 28 V24 H11Z' fill='${C.cream}' stroke='${C.ink}' stroke-width='1.4' stroke-linejoin='round'/>`);
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 70 74'><circle cx='35' cy='40' r='27' fill='none' stroke='${C.gold}' stroke-width='5'/><circle cx='35' cy='40' r='27' fill='none' stroke='${C.cream}' stroke-width='2' stroke-dasharray='.1 5.5' stroke-linecap='round'/><circle cx='35' cy='40' r='22' fill='${C.orange}' stroke='${C.goldD}' stroke-width='1'/><path d='M35 52 V29 M26 37 L35 28 L44 37' fill='none' stroke='${C.cream}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/><g transform='translate(19 0) scale(.8)'><path d='M20 22 L4 12 Q6 3 20 2 Q34 3 36 12Z' fill='${C.gold}' stroke='${C.goldD}' stroke-width='1'/><path d='M20 22 L8 6 M20 22 L14 3 M20 22 V2 M20 22 L26 3 M20 22 L32 6' stroke='${C.cream}' stroke-width='1'/></g><path d='M6 50 Q0 56 5 62 Q9 64 10 60 M64 50 Q70 56 65 62 Q61 64 60 60' fill='none' stroke='${C.gold}' stroke-width='2' stroke-linecap='round'/></svg>`;

const bubble = { myBg: C.orange, myText: C.cream, myBorder: "none", charBg: C.cream, charText: C.ink, charBorder: "none", radius: 14, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 墨绿贝壳 · 第一批 ───── */
[data-wk="chat"]{background:${svg(DAMASK)} 0 0/48px 64px,radial-gradient(ellipse at 50% 30%,#245447,${C.green2} 80%) !important}
[data-wk="body"]{background:transparent !important}
[data-wk="chat"] *{font-family:${SERIF} !important}

/* 顶栏：奶油底，下沿一道橘红边，再垂一条金涡卷花边带、正中一枚扇贝 */
[data-wk="chathead"]{background:${C.cream} !important;border-bottom:none !important;box-shadow:0 5px 0 ${C.orange},0 7px 0 ${C.orangeD} !important;position:relative !important;overflow:visible !important;gap:6px !important;z-index:5 !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:calc(100% + 8px) !important;height:20px !important;background:${svg(SHELL)} center top/40px 24px no-repeat,${svg(SCROLLBAND)} 0 0/40px 20px repeat-x !important;pointer-events:none !important}
[data-wk="chathead"] + *:not([data-wk="body"]){margin-top:28px !important}
[data-wk="body"]{padding-top:14px !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important}
[data-wk="headname"] > [data-wk="headink"]{font-weight:700 !important;letter-spacing:.12em !important;white-space:nowrap !important}
[data-wk="headname"] > [data-wk="headink"] > span{flex:none !important}
[data-wk="headname"] > [data-wk="headink"]::after{content:"mon ange" !important;flex:0 1 auto !important;min-width:0 !important;overflow:hidden !important;margin-left:8px !important;font:italic 400 13px/1 Georgia,"Times New Roman",serif !important;letter-spacing:.02em !important;color:${C.orange} !important}
[data-wk="headdim"]{color:#8C7F66 !important;white-space:nowrap !important;letter-spacing:.12em !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:${C.ink} !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:34px !important;min-width:34px !important;height:34px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 头像：圆的，套一面金珠圈镜框，顶上扇贝、底下一对涡卷 */
button[data-wk="avatar"],span[data-wk="avatar"]{position:relative !important;overflow:visible !important;border-radius:50% !important;box-shadow:none !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{border-radius:50% !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;left:-25% !important;right:-25% !important;top:-38% !important;bottom:-38% !important;background:${svg(MIRROR)} center/contain no-repeat !important;pointer-events:none !important;border:none !important;border-radius:0 !important;z-index:2 !important}
[data-wk="chathead"] button:has(> img[data-wk="avatar"]){position:relative !important;overflow:visible !important}
[data-wk="chathead"] button:has(> img[data-wk="avatar"])::before{content:"" !important;position:absolute !important;left:-4px !important;top:50% !important;width:44px !important;height:44px !important;margin-top:-22px !important;border-radius:50% !important;box-shadow:0 0 0 3px ${C.gold},0 0 0 4.5px ${C.goldD} !important;background:radial-gradient(circle,transparent 60%,transparent 61%) !important;pointer-events:none !important;z-index:2 !important}
[data-wk="chathead"] img[data-wk="avatar"]{border-radius:50% !important}

/* 气泡：圆角牌，金细边；顶上正中一枚扇贝，右上、左下各卷一道金涡卷 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:14px !important;letter-spacing:.06em !important;padding:11px 18px !important}
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;left:50% !important;top:-12px !important;width:30px !important;height:18px !important;margin-left:-15px !important;background:${svg(SHELL)} center/contain no-repeat !important;pointer-events:none !important;border:none !important;transform:none !important;right:auto !important;bottom:auto !important}
[data-wk="bubble"][data-kind="text"]::after{content:"" !important;position:absolute !important;inset:-12px !important;background:${svg(CURL)} right top/18px 18px no-repeat,${svg(CURLB)} left bottom/18px 18px no-repeat !important;pointer-events:none !important;border:none !important;transform:none !important;width:auto !important;height:auto !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,#DC6A44,${C.orange}) !important;color:${C.cream} !important;border:none !important;box-shadow:0 0 0 2px ${C.gold},0 0 0 3px ${C.goldD},0 4px 0 3px rgba(0,0,0,.18) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.cream} !important;color:${C.ink} !important;border:none !important;box-shadow:0 0 0 2px ${C.gold},0 0 0 3px ${C.goldD},0 4px 0 3px rgba(0,0,0,.18) !important}
[data-first="0"] [data-wk="bubble"][data-kind="text"]::before{content:none !important}

/* 时间：一枚椭圆徽框，顶上扇贝、两侧涡卷 */
[data-wk="time"]{display:flex !important;justify-content:center !important;margin-top:10px !important}
[data-wk="time"] > span{position:relative !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;min-width:150px !important;height:34px !important;padding:6px 34px 0 !important;background:${svg(OVAL)} center/100% 100% no-repeat !important;border:none !important;box-shadow:none !important;color:${C.ink} !important;letter-spacing:.15em !important;font-size:12.5px !important}
[data-wk="time"] > span::before{content:"" !important;position:absolute !important;left:50% !important;top:-12px !important;width:28px !important;height:17px !important;margin-left:-14px !important;background:${svg(SHELL)} center/contain no-repeat !important}
[data-wk="time"] > span::after{content:"" !important;position:absolute !important;left:-14px !important;right:-14px !important;top:6px !important;height:26px !important;background:${svg(CURLB)} left center/20px 20px no-repeat,${svg(CURL)} right center/20px 20px no-repeat !important}
/* 已送达＝后面一颗橘红涡纹；已读＝前面一颗橘红圆点 */
[data-wk="meta"]{color:${C.dim} !important;font-size:10.5px !important;letter-spacing:.12em !important;display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"][data-read="0"]::after{content:"" !important;width:12px !important;height:12px !important;flex:none !important;background:${svg(SPIRAL)} center/contain no-repeat !important}
[data-wk="meta"][data-read="1"]::before{content:"" !important;width:11px !important;height:11px !important;flex:none !important;order:-1 !important;background:${svg(DOT)} center/contain no-repeat !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.cream} !important;border:none !important;box-shadow:0 0 0 2px ${C.gold} !important;border-radius:14px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.orange} !important}
[data-wk="name"]{color:${C.dim} !important}

/* 动描：一卷展开的羊皮纸条——两头卷起，中间淡奶油底、墨绿斜体字 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{position:relative !important;display:block !important;background:linear-gradient(90deg,${C.cream2},${C.cream} 12%,${C.cream} 88%,${C.cream2}) !important;border:none !important;border-top:1px solid ${C.gold} !important;border-bottom:1px solid ${C.gold} !important;border-radius:0 !important;box-shadow:0 4px 10px rgba(0,0,0,.25) !important;color:${C.green} !important;font-style:italic !important;font-size:13px !important;line-height:1.8 !important;letter-spacing:.06em !important;padding:12px 30px !important;margin:0 14px !important;overflow:visible !important}
[data-wk="narrink"]::before,[data-wk="narrink"]::after{content:"" !important;position:absolute !important;top:-4px !important;bottom:-4px !important;width:14px !important;background:linear-gradient(90deg,${C.goldD},${C.gold} 40%,${C.cream2} 60%,${C.goldD}) !important;border-radius:7px !important;box-shadow:0 2px 4px rgba(0,0,0,.3) !important}
[data-wk="narrink"]::before{left:-8px !important}
[data-wk="narrink"]::after{right:-8px !important}
/* 系统提示：一行奶油小字，两头各一道小涡卷 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.dim} !important;font-size:11.5px !important;font-style:normal !important;letter-spacing:.1em !important}
[data-wk="sysnotetext"]::before{content:"" !important;display:inline-block !important;width:13px !important;height:13px !important;margin-right:6px !important;vertical-align:-2px !important;background:${svg(CURLB)} center/contain no-repeat !important}
[data-wk="sysnoteclose"]{color:${C.dim} !important}

/* 底栏：奶油底，上沿一道墨绿边＋一条涡卷花边带；右边是一枚大的橘红发送章，戴金珠圈、顶扇贝 */
[data-wk="composer"]{background:${C.cream} !important;border-top:none !important;box-shadow:0 -4px 0 ${C.greenL} !important;position:relative !important;overflow:visible !important;align-items:center !important;gap:10px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:calc(100% + 4px) !important;height:20px !important;background:${svg(SCROLLBAND)} 0 0/40px 20px repeat-x !important;transform:scaleY(-1) !important;pointer-events:none !important}
[data-wk="chatinput"]{background:#FBF5E6 !important;border:1.6px solid ${C.gold} !important;border-radius:999px !important;color:${C.ink} !important;box-shadow:inset 0 0 0 3px #FBF5E6,inset 0 0 0 4px rgba(156,122,60,.4) !important}
[data-wk="chatinput"]::placeholder{color:#A89B80 !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{width:36px !important;min-width:36px !important;height:36px !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="chatreply"]{width:36px !important;min-width:36px !important;height:36px !important;background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="send"]{width:54px !important;min-width:54px !important;height:56px !important;background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important;margin-top:-10px !important;order:9 !important}
/* 参考图里回复在左、发送在最右，照图挪 */
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.9) !important}
[data-wk="chatpanel"]{background:${C.cream} !important;border-top:2px solid ${C.gold} !important}
`;

const pack = { kind: "chat-look", v: 1, name: "墨绿贝壳", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "墨绿贝壳-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
