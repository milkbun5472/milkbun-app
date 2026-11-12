// 港风旧梦：午夜录像带。墨黑底上糊着几团霓虹光斑＋颗粒；顶栏左上一颗红点 REC；所有框都只描两只角（取景框）。
// 我的话＝暗红块右边一道亮红条，他的话＝墨褐块左边一道金条；动描＝虚线框上贴「Voice-over」标签；
// 右下竖排红字「呢條街我話事 你個人我睇住」；底栏上面一条录像带进度。用法：node themes/hk-film/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { ink: "#14100D", ink2: "#1E1713", brown: "#2A1D17", red: "#7E1B1E", redL: "#E0353A", gold: "#C9A36A", goldD: "#8C7148", cream: "#EDE2CF", dim: "#9C8E78" };

// 取景框两只角：左上 ┌ 右下 ┘（c＝颜色，L＝角长）
const CORNERS = (c = C.gold, L = 9, w = 1.4) => `linear-gradient(${c},${c}) left top/${L}px ${w}px no-repeat,linear-gradient(${c},${c}) left top/${w}px ${L}px no-repeat,linear-gradient(${c},${c}) right bottom/${L}px ${w}px no-repeat,linear-gradient(${c},${c}) right bottom/${w}px ${L}px no-repeat`;
const g = (i, c) => `<radialGradient id='${i}'><stop offset='0' stop-color='${c}' stop-opacity='.55'/><stop offset='.5' stop-color='${c}' stop-opacity='.2'/><stop offset='1' stop-color='${c}' stop-opacity='0'/></radialGradient>`;
const GLOW = `<svg xmlns='http://www.w3.org/2000/svg' width='390' height='844' viewBox='0 0 390 844'><defs>${g("o", "#E08A3A")}${g("y", "#C9A36A")}${g("r", "#C8323A")}${g("t", "#2F7A78")}</defs><circle cx='60' cy='300' r='190' fill='url(#o)'/><circle cx='230' cy='130' r='120' fill='url(#y)'/><circle cx='380' cy='520' r='210' fill='url(#r)'/><circle cx='120' cy='700' r='170' fill='url(#t)'/><circle cx='330' cy='780' r='120' fill='url(#o)'/></svg>`;
// 颗粒
const GRAIN = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>${Array.from({ length: 140 }, (_, i) => { const x = (i * 53) % 120, y = (i * 37 + (i % 7) * 11) % 120; return `<rect x='${x}' y='${y}' width='1' height='1' fill='#fff' opacity='${(0.04 + (i % 5) * 0.025).toFixed(3)}'/>`; }).join("")}</svg>`;
// 竖排红字
const VERT = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 70 294'><g font-family='serif' font-weight='700' font-size='26' fill='#D2343A' text-anchor='middle'>${[..."呢條街我話事"].map((c, i) => `<text x='52' y='${30 + i * 32}'>${c}</text>`).join("")}${[..."你個人我睇住"].map((c, i) => `<text x='18' y='${62 + i * 32}'>${c}</text>`).join("")}</g><path d='M36 4 V290' stroke='#D2343A' stroke-width='1' opacity='.7'/></svg>`;
const I_CIRC = inner => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='17.5' fill='none' stroke='${C.cream}' stroke-width='1.4'/>${inner}</svg>`;
const I_PLUS = I_CIRC(`<path d='M20 12 V28 M12 20 H28' stroke='${C.cream}' stroke-width='1.4'/>`);
const I_HOUSE = I_CIRC(`<path d='M12 20 L20 13 L28 20 V27 H12Z' fill='none' stroke='${C.cream}' stroke-width='1.4' stroke-linejoin='round'/>`);
const I_MORE = I_CIRC(`<circle cx='13.5' cy='20' r='1.6' fill='${C.cream}'/><circle cx='20' cy='20' r='1.6' fill='${C.cream}'/><circle cx='26.5' cy='20' r='1.6' fill='${C.cream}'/>`);
const I_PLAY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><circle cx='24' cy='24' r='22.5' fill='none' stroke='${C.redL}' stroke-width='1.4'/><circle cx='24' cy='24' r='19' fill='#C62A30'/><path d='M19 15 L33 24 L19 33Z' fill='#fff'/></svg>`;
const TRACK = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 14' preserveAspectRatio='none'>${Array.from({ length: 48 }, (_, i) => `<circle cx='${3 + i * 5}' cy='7' r='1.2' fill='${i < 17 ? "#D2343A" : "#9C8E78"}'/>`).join("")}<circle cx='88' cy='7' r='5' fill='${C.ink}' stroke='${C.cream}' stroke-width='1.2'/></svg>`;

const bubble = { myBg: C.red, myText: C.cream, myBorder: "none", charBg: C.brown, charText: C.cream, charBorder: "none", radius: 0, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: true, gap: "normal", time: "show" };
const SERIF = `"Songti SC","Noto Serif SC","STSong",serif`;

const css = `
/* ───── 港风旧梦 · 第一批 ───── */
[data-wk="chat"]{background:${svg(GRAIN)} 0 0/120px 120px,${svg(GLOW)} center top/cover no-repeat,${C.ink} !important}
[data-wk="body"]{background:transparent !important;position:relative !important;z-index:1 !important}
[data-wk="chat"] *{font-family:${SERIF} !important}
/* 右下竖排红字，贴着屏幕不跟着滚 */
[data-wk="body"]::after{content:"" !important;position:fixed !important;right:10px !important;bottom:calc(var(--app-safe-bottom, 0px) + 150px) !important;width:50px !important;height:210px !important;background:${svg(VERT)} center/contain no-repeat !important;pointer-events:none !important;z-index:-1 !important;opacity:.75 !important}

/* 顶栏：墨黑，左上一颗会闪的红点 REC，名字后面一行斜体 Midnight Romance；下沿一道金色点线 */
[data-wk="chathead"]{background:${C.ink} !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;overflow:visible !important;gap:6px !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:100% !important;height:2px !important;background:radial-gradient(circle,${C.goldD} .9px,transparent 1.2px) 0 0/5px 2px repeat-x !important;pointer-events:none !important}
[data-wk="chathead"]::before{content:"REC" !important;position:absolute !important;left:16px !important;top:calc(var(--app-safe-top, 0px) + 2px) !important;font:600 9px/1 ui-monospace,Menlo,monospace !important;letter-spacing:.18em !important;color:${C.cream} !important;padding-left:10px !important;background:radial-gradient(circle,#E0353A 3px,transparent 3.5px) left center/7px 7px no-repeat !important;animation:hkRec 1.6s steps(1) infinite !important;pointer-events:none !important}
@keyframes hkRec{0%{background-size:7px 7px}50%{background-size:0 0}}
[data-wk="headink"],[data-wk="headink"] *{color:${C.cream} !important;letter-spacing:.12em !important}
[data-wk="headname"] > [data-wk="headink"]{font-weight:700 !important;white-space:nowrap !important}
[data-wk="headname"] > [data-wk="headink"]::after{content:"Midnight Romance" !important;margin-left:10px !important;font:italic 400 12px/1 Georgia,"Times New Roman",serif !important;letter-spacing:.04em !important;color:${C.cream} !important;opacity:.85 !important}
[data-wk="headdim"]{color:${C.dim} !important;white-space:nowrap !important;letter-spacing:.2em !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:${C.cream} !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:32px !important;min-width:32px !important;height:32px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/30px no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/30px no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chathead"] + *:not([data-wk="body"]){margin-top:4px !important}

/* 头像：方的，外面两只取景框角 */
button[data-wk="avatar"],span[data-wk="avatar"]{position:relative !important;overflow:visible !important;border-radius:0 !important;box-shadow:none !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{border-radius:0 !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;inset:-6px !important;background:${CORNERS(C.cream, 8, 1.4)} !important;pointer-events:none !important;border:none !important;border-radius:0 !important;z-index:2 !important}
[data-wk="chathead"] button:has(> img[data-wk="avatar"]){position:relative !important;overflow:visible !important}
[data-wk="chathead"] button:has(> img[data-wk="avatar"])::before{content:"" !important;position:absolute !important;left:-5px !important;top:50% !important;width:46px !important;height:46px !important;margin-top:-23px !important;background:${CORNERS(C.cream, 8, 1.4)} !important;pointer-events:none !important;z-index:2 !important}

/* 气泡：直角块，外面两只取景框角。我的话＝暗红块右边一道亮红条；他的话＝墨褐块左边一道金条 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:0 !important;box-shadow:none !important;color:${C.cream} !important;letter-spacing:.08em !important;padding:11px 18px !important}
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;inset:-7px !important;background:${CORNERS(C.goldD, 9, 1.4)} !important;pointer-events:none !important;border:none !important;transform:none !important;width:auto !important;height:auto !important}
[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,#8A2024,${C.red}) !important;border:none !important;border-right:3px solid ${C.redL} !important;box-shadow:0 0 18px rgba(224,53,58,.25) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:linear-gradient(180deg,#2E2019,#22180F) !important;border:none !important;border-left:3px solid ${C.gold} !important;outline:1px solid rgba(201,163,106,.25) !important}

/* 时间：上一行斜体 Tonight，下一行日期；两边一段金色虚线 */
[data-wk="time"]{display:flex !important;justify-content:center !important;background:linear-gradient(90deg,transparent 8%,${C.goldD} 8%) left center/34% 1px no-repeat,linear-gradient(90deg,${C.goldD} 92%,transparent 92%) right center/34% 1px no-repeat !important;-webkit-mask:none !important}
[data-wk="time"]{background:repeating-linear-gradient(90deg,${C.goldD} 0 3px,transparent 3px 6px) left center/30% 1px no-repeat,repeating-linear-gradient(90deg,${C.goldD} 0 3px,transparent 3px 6px) right center/30% 1px no-repeat !important}
[data-wk="time"] > span{display:block !important;text-align:center !important;background:transparent !important;border:none !important;box-shadow:none !important;color:${C.dim} !important;letter-spacing:.2em !important;font-size:11.5px !important;padding:0 !important}
[data-wk="time"] > span::before{content:"Tonight" !important;display:block !important;font:italic 400 15px/1.4 Georgia,"Times New Roman",serif !important;letter-spacing:.06em !important;color:${C.cream} !important;margin-bottom:2px !important}

/* 已读／已送达：中英两行字，字距拉开 */
[data-wk="meta"]{color:${C.dim} !important;font-size:10px !important;letter-spacing:.2em !important}
[data-wk="meta"][data-read="0"]::before{content:"SENT" !important;font:500 9px/1 Georgia,serif !important;letter-spacing:.3em !important;margin-right:10px !important;color:${C.dim} !important}
[data-wk="meta"][data-read="1"]::after{content:"READ" !important;font:500 9px/1 Georgia,serif !important;letter-spacing:.3em !important;margin-left:10px !important;color:${C.dim} !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.brown} !important;border:none !important;border-left:3px solid ${C.gold} !important;border-radius:0 !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.redL} !important}
[data-wk="name"]{color:${C.dim} !important;letter-spacing:.25em !important;font-size:11px !important;margin-bottom:8px !important}
[data-wk="name"]::after{content:" ：" !important}
[data-wk="name"][data-me="1"],[data-wk="msg"][data-me="1"] [data-wk="name"]{display:none !important}

/* 动描：一块虚线框的字幕，左上贴一张「Voice-over」黑标签，字居中、字距松 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important;padding-top:12px !important}
[data-wk="narrink"]{position:relative !important;display:block !important;background:linear-gradient(90deg,rgba(20,16,13,.55),rgba(80,20,22,.35)) !important;border:1.2px dashed rgba(237,226,207,.55) !important;border-radius:0 !important;box-shadow:none !important;color:${C.cream} !important;font-style:normal !important;font-size:13px !important;line-height:1.85 !important;letter-spacing:.18em !important;padding:20px 22px 14px !important;text-align:center !important;overflow:visible !important}
[data-wk="narrink"]::before{content:"Voice-over" !important;position:absolute !important;left:22px !important;top:-11px !important;padding:3px 26px !important;background:${C.ink} !important;font:italic 400 12px/1.2 Georgia,serif !important;letter-spacing:.14em !important;color:${C.cream} !important}
/* 系统提示：一行小字，前面一道短红线 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.dim} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.18em !important}
[data-wk="sysnotetext"]::before{content:"" !important;display:inline-block !important;width:14px !important;height:1px !important;margin-right:8px !important;vertical-align:4px !important;background:${C.redL} !important}
[data-wk="sysnoteclose"]{color:${C.dim} !important}

/* 底栏：墨黑，上沿一道金线；上面一条录像带进度（红点走到三分之一）、右边 Track 01 舊夢 */
[data-wk="composer"]{background:${C.ink} !important;border-top:1px solid ${C.goldD} !important;position:relative !important;overflow:visible !important;align-items:center !important;gap:10px !important;padding-top:34px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:16px !important;top:10px !important;width:60% !important;height:12px !important;background:${svg(TRACK)} left center/100% 100% no-repeat !important;pointer-events:none !important}
[data-wk="composer"]::after{content:"/ Track 01  舊夢\\A Vintage Record" !important;white-space:pre !important;position:absolute !important;right:16px !important;top:7px !important;text-align:right !important;font:italic 400 10.5px/1.35 Georgia,serif !important;color:${C.cream} !important;pointer-events:none !important}
[data-wk="chatinput"]{background:${CORNERS(C.cream, 10, 1.4)},rgba(237,226,207,.04) !important;border:1px solid rgba(237,226,207,.28) !important;border-radius:0 !important;color:${C.cream} !important;letter-spacing:.12em !important;box-shadow:none !important}
[data-wk="chatinput"]::placeholder{color:${C.dim} !important}
[data-wk="chatplus"],[data-wk="send"]{border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{width:36px !important;min-width:36px !important;height:36px !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{width:46px !important;min-width:46px !important;height:46px !important;background:${svg(I_PLAY)} center/contain no-repeat !important;opacity:1 !important;filter:drop-shadow(0 0 8px rgba(224,53,58,.45)) !important}
[data-wk="chatreply"]{position:relative !important;width:64px !important;min-width:64px !important;height:36px !important;border:1px solid ${C.cream} !important;border-radius:0 !important;background:transparent !important;box-shadow:none !important}
[data-wk="chatreply"]::before{content:"回 覆" !important;position:absolute !important;inset:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;color:${C.cream} !important;font-size:13px !important;letter-spacing:.2em !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.92) !important}
[data-wk="chatpanel"]{background:${C.ink} !important;border-top:1px solid ${C.goldD} !important}
`;

const pack = { kind: "chat-look", v: 1, name: "港风旧梦", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "港风旧梦-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
