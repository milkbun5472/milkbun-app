// 港风旧梦：午夜录像带。墨黑底上糊着几团霓虹光斑＋颗粒；顶栏左上一颗红点 REC；所有框都只描两只角（取景框）。
// 我的话＝暗红块右边一道亮红条，他的话＝墨褐块左边一道金条；动描＝虚线框上贴「Voice-over」标签；
// 右下竖排红字「維港夜色 一別經年」；底栏上面一条录像带进度。用法：node themes/hk-film/build.mjs
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
const GRAIN = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>${Array.from({ length: 70 }, (_, i) => { const x = (i * 53) % 120, y = (i * 37 + (i % 7) * 11) % 120; return `<rect x='${x}' y='${y}' width='1' height='1' fill='#fff' opacity='${(0.04 + (i % 5) * 0.025).toFixed(3)}'/>`; }).join("")}</svg>`;
// 竖排红字
const VERT = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 70 230'><g font-family='serif' font-weight='700' font-size='26' fill='#D2343A' text-anchor='middle'>${[..."維港夜色"].map((c, i) => `<text x='52' y='${30 + i * 32}'>${c}</text>`).join("")}${[..."一別經年"].map((c, i) => `<text x='18' y='${62 + i * 32}'>${c}</text>`).join("")}</g><path d='M36 4 V226' stroke='#D2343A' stroke-width='1' opacity='.7'/></svg>`;
const I_CIRC = inner => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='17.5' fill='none' stroke='${C.cream}' stroke-width='1.4'/>${inner}</svg>`;
const I_PLUS = I_CIRC(`<path d='M20 12 V28 M12 20 H28' stroke='${C.cream}' stroke-width='1.4'/>`);
const I_HOUSE = I_CIRC(`<path d='M12 20 L20 13 L28 20 V27 H12Z' fill='none' stroke='${C.cream}' stroke-width='1.4' stroke-linejoin='round'/>`);
const I_MORE = I_CIRC(`<circle cx='13.5' cy='20' r='1.6' fill='${C.cream}'/><circle cx='20' cy='20' r='1.6' fill='${C.cream}'/><circle cx='26.5' cy='20' r='1.6' fill='${C.cream}'/>`);
const I_PLAY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><circle cx='24' cy='24' r='22.5' fill='none' stroke='${C.redL}' stroke-width='1.4'/><circle cx='24' cy='24' r='19' fill='#C62A30'/><path d='M19 15 L33 24 L19 33Z' fill='#fff'/></svg>`;
const TRACK = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 14' preserveAspectRatio='none'>${Array.from({ length: 48 }, (_, i) => `<circle cx='${3 + i * 5}' cy='7' r='1.2' fill='${i < 17 ? "#D2343A" : "#9C8E78"}'/>`).join("")}<circle cx='88' cy='7' r='5' fill='${C.ink}' stroke='${C.cream}' stroke-width='1.2'/></svg>`;

// ── 第二批用的图 ──
const SPROCKET = `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='12'><rect x='3' y='3' width='8' height='6' rx='1.2' fill='${C.ink}'/></svg>`;
const CASSETTE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 24'><rect x='1' y='1' width='32' height='22' rx='2' fill='none' stroke='${C.cream}' stroke-width='1.3'/><rect x='6' y='5' width='22' height='9' rx='1' fill='none' stroke='${C.cream}' stroke-width='1'/><circle cx='11.5' cy='9.5' r='2.4' fill='none' stroke='${C.redL}' stroke-width='1.2'/><circle cx='22.5' cy='9.5' r='2.4' fill='none' stroke='${C.redL}' stroke-width='1.2'/><path d='M8 23 L10 17 H24 L26 23' fill='none' stroke='${C.cream}' stroke-width='1'/></svg>`;
const LAISEE = done => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 84'><rect x='2' y='2' width='56' height='80' rx='3' fill='${done ? "#5A2224" : "#C62A30"}' stroke='${C.gold}' stroke-width='1.6'/>${done ? `<path d='M2 2 L30 26 L58 2' fill='none' stroke='${C.gold}' stroke-width='1.4'/>` : `<path d='M2 2 L30 22 L58 2Z' fill='#A51E24' stroke='${C.gold}' stroke-width='1.4'/>`}<circle cx='30' cy='46' r='13' fill='none' stroke='${C.gold}' stroke-width='1.4'/><text x='30' y='51.5' text-anchor='middle' font-size='15' font-weight='700' fill='${C.gold}' font-family='serif'>${done ? "謝" : "利"}</text><path d='M14 72 H46' stroke='${C.gold}' stroke-width='1' opacity='.7'/></svg>`;
const NEONPIN = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'><circle cx='15' cy='15' r='12' fill='none' stroke='#FF4A55' stroke-width='2'/><circle cx='15' cy='15' r='4' fill='#FF4A55'/></svg>`;
const STAMP = (t, c) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><rect x='4' y='14' width='52' height='32' rx='2' fill='none' stroke='${c}' stroke-width='2'/><rect x='8' y='18' width='44' height='24' fill='none' stroke='${c}' stroke-width='.8'/><text x='30' y='36' text-anchor='middle' font-size='15' font-weight='700' fill='${c}' font-family='serif' letter-spacing='3'>${t}</text></svg>`;

// ── 第三批用的图 ──
const NEONHEART = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 66 60'><path d='M33 56 C14 42 4 32 4 19 C4 10 11 4 19 4 C25 4 30 7 33 12 C36 7 41 4 47 4 C55 4 62 10 62 19 C62 32 52 42 33 56Z'/></svg>`;
const FRAMEMASK = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 180'>${[0,1,2,3,4].map(i=>`<g transform='translate(0 ${i*36}) rotate(-90 18 18)'><path fill-rule='evenodd' d='M4 6 H32 V30 H4Z M7 8 h3 v2 h-3z M14.5 8 h3 v2 h-3z M22 8 h3 v2 h-3z M7 26 h3 v2 h-3z M14.5 26 h3 v2 h-3z M22 26 h3 v2 h-3z'/></g>`).join("")}</svg>`;

const bubble = { myBg: C.red, myText: C.cream, myBorder: "none", charBg: C.brown, charText: C.cream, charBorder: "none", radius: 0, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: true, gap: "normal", time: "show" };
const SERIF = `"Songti SC","Noto Serif SC","STSong",serif`;

const css = `
/* ───── 港风旧梦 · 第一批 ───── */
[data-wk="chat"]{background:${svg(GRAIN)} 0 0/120px 120px,${svg(GLOW)} center top/cover no-repeat,${C.ink} !important}
[data-wk="body"]{background:transparent !important;position:relative !important;z-index:1 !important}
[data-wk="chat"] *{font-family:${SERIF} !important}
/* 右下竖排红字，贴着屏幕不跟着滚 */
[data-wk="body"]::after{content:"" !important;position:fixed !important;right:10px !important;bottom:calc(var(--app-safe-bottom, 0px) + 150px) !important;width:50px !important;height:166px !important;background:${svg(VERT)} center/contain no-repeat !important;pointer-events:none !important;z-index:-1 !important;opacity:.75 !important}

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
/* ───── 港风旧梦 · 第二批：卡片 ───── */
/* 卡片统一：墨褐底、细金框、外面两只取景框角 */
[data-wk="voice"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{background:linear-gradient(180deg,#2A1E17,#1C1410) !important;border:1px solid rgba(201,163,106,.4) !important;border-radius:0 !important;box-shadow:0 8px 20px rgba(0,0,0,.45) !important;color:${C.cream} !important}
[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:${C.cream} !important;border-color:rgba(201,163,106,.3) !important}

/* 转账＝一张戏院戏票：米色票面、红色票头写 ADMIT ONE、右边一截虚线撕口的票根；收下盖红章「已收」、退回盖灰章「退票」 */
[data-wk="transfercard"]{position:relative !important;overflow:visible !important;background:linear-gradient(90deg,transparent calc(100% - 46px),rgba(20,16,13,.0) calc(100% - 46px)),linear-gradient(#EDE2CF,#E2D3B8) !important;border:none !important;border-radius:2px !important;box-shadow:0 8px 20px rgba(0,0,0,.5) !important;color:${C.ink} !important;padding-top:30px !important}
[data-wk="transfercard"]::before{content:"ADMIT ONE  ·  午夜場" !important;position:absolute !important;left:0 !important;right:0 !important;top:0 !important;height:22px !important;display:flex !important;align-items:center !important;padding-left:14px !important;background:#B8262C !important;color:#F3E6CF !important;font:600 10px/1 Georgia,serif !important;letter-spacing:.25em !important}
[data-wk="transfercard"]::after{content:"" !important;position:absolute !important;right:44px !important;top:26px !important;bottom:6px !important;width:0 !important;border-left:1.4px dashed rgba(20,16,13,.35) !important}
[data-wk="transfercard"] *{color:${C.ink} !important;border-color:rgba(20,16,13,.2) !important}
[data-wk="transferlabel"]{color:#7A5E3A !important;letter-spacing:.25em !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:#8E1D22 !important;font-weight:700 !important}
[data-wk="transferrule"]{border:none !important;height:1px !important;background:repeating-linear-gradient(90deg,rgba(20,16,13,.4) 0 3px,transparent 3px 6px) !important}
[data-wk="transfernotch"]{background:${C.ink} !important}
[data-wk="transferfoot"]{background:rgba(20,16,13,.06) !important}
[data-wk="transferbtn"]{border-radius:0 !important;letter-spacing:.2em !important}
[data-wk="transferbtn"][data-part="take"]{background:#B8262C !important;color:#F3E6CF !important;border:none !important}
[data-wk="transferbtn"][data-part="back"]{background:transparent !important;color:${C.ink} !important;border:1px solid rgba(20,16,13,.4) !important}
[data-wk="transferseal"]{background:transparent !important;border:1.4px solid #8E1D22 !important;color:#8E1D22 !important;border-radius:0 !important;box-shadow:none !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{width:62px !important;height:62px !important;flex-shrink:0 !important;border:none !important;background:${svg(STAMP("已收", "#B8262C"))} center/contain no-repeat !important;transform:rotate(-12deg) !important;opacity:.9 !important}
[data-wk="transfercard"][data-status="returned"]{filter:sepia(.5) grayscale(.6) !important;opacity:.8 !important}
[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"]{width:62px !important;height:62px !important;flex-shrink:0 !important;border:none !important;background:${svg(STAMP("退票", "#5A4A3A"))} center/contain no-repeat !important;transform:rotate(-12deg) !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] *,[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"] *{display:none !important}

/* 红包＝一封利是：红封金边，封口压下来，正中圆圈里一个「利」；领完了封口打开、变暗红、圈里换成「謝」 */
[data-wk="rpcard"]{position:relative !important;overflow:visible !important;width:220px !important;min-height:100px !important;padding:16px 16px 16px 82px !important;background:linear-gradient(180deg,#2A1E17,#1C1410) !important;border:1px solid rgba(201,163,106,.4) !important;border-radius:0 !important;box-shadow:0 8px 20px rgba(0,0,0,.45) !important}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:56px !important;height:78px !important;margin-top:-39px !important;background:${svg(LAISEE(false))} center/contain no-repeat !important;transform:rotate(-6deg) !important;filter:drop-shadow(0 4px 6px rgba(0,0,0,.5)) !important}
[data-wk="rpcard"]::after{content:"利是" !important;position:absolute !important;right:12px !important;bottom:6px !important;font:italic 10px/1 Georgia,serif !important;letter-spacing:.3em !important;color:${C.dim} !important}
[data-wk="rpcard"] *{color:${C.cream} !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"] > div:not([data-wk]){padding:0 !important;background:transparent !important}
[data-wk="rpmsg"]{-webkit-line-clamp:2 !important;letter-spacing:.1em !important}
[data-wk="rpcard"][data-status="done"]{opacity:.8 !important}
[data-wk="rpcard"][data-status="done"]::before{background:${svg(LAISEE(true))} center/contain no-repeat !important}
[data-wk="rpcard"][data-status="done"]::after{content:"多謝晒" !important}
[data-wk="rpenvelope"][data-stage="closed"],[data-wk="rpenvelope"][data-stage="open"]{background:${svg(GRAIN)} 0 0/120px 120px,linear-gradient(180deg,#B8262C,#7E1B1E) !important;border:1.4px solid ${C.gold} !important;border-radius:2px !important;box-shadow:0 20px 50px rgba(0,0,0,.6) !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:${C.ink} !important;border-color:${C.gold} !important;box-shadow:none !important}
[data-wk="rpenvelope"] [data-wk="rparc"]::after{content:none !important}
[data-wk="rpenvelope"] *{color:#F3E6CF !important}
[data-wk="rpopenbtn"]{background:${svg(I_PLAY)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;border-radius:50% !important}
[data-wk="rpopenbtn"],[data-wk="rpopenbtn"] *{color:transparent !important;font-size:0 !important}
[data-wk="rpavatar"]{border-radius:0 !important;box-shadow:0 0 0 2px ${C.gold} !important}
[data-wk="rpamount"]{color:${C.gold} !important;background:none !important}
[data-wk="rpclose"]{background:transparent !important;border:1px solid ${C.cream} !important;color:${C.cream} !important;border-radius:0 !important}

/* 照片＝一格菲林：上下两排齿孔 */
[data-wk="photocard"]{position:relative !important;overflow:visible !important;background:${svg(SPROCKET)} left top/14px 12px repeat-x,${svg(SPROCKET)} left bottom/14px 12px repeat-x,#2C2620 !important;border:none !important;border-radius:0 !important;padding:16px 8px 30px !important;box-shadow:0 8px 20px rgba(0,0,0,.5) !important}
[data-wk="photoface"]{background:${svg(GRAIN)} 0 0/120px 120px,linear-gradient(170deg,#4A2A22,#1A1410) !important;border:none !important;border-radius:0 !important;filter:sepia(.3) !important}
[data-wk="photoface"] *,[data-wk="phototext"]{color:${C.cream} !important;letter-spacing:.1em !important}
[data-wk="photocap"],[data-wk="photohint"]{color:${C.dim} !important;font-style:italic !important}

/* 语音：前面一盒卡式录音带 */
[data-wk="voice"] > *{background:transparent !important;box-shadow:none !important;border:none !important;color:${C.cream} !important}
[data-wk="voice"][data-me]{padding:0 12px 0 46px !important;position:relative !important}
[data-wk="voice"]::before{content:"" !important;position:absolute !important;left:9px !important;top:50% !important;width:28px !important;height:20px !important;margin-top:-10px !important;background:${svg(CASSETTE)} center/contain no-repeat !important;z-index:2 !important}
[data-wk="voice"][data-me="1"]{background:linear-gradient(180deg,#8A2024,${C.red}) !important;border:none !important;border-right:3px solid ${C.redL} !important}
[data-wk="voicewave"] span{background:${C.redL} !important}
[data-wk="voice"][data-me="1"] [data-wk="voicewave"] span{background:${C.cream} !important}

/* 天气：像一块霓虹招牌——深底、字带一圈霓虹光 */
[data-wk="wxcardsky"]{background:${svg(GRAIN)} 0 0/120px 120px,linear-gradient(170deg,#24171A,#120D0B) !important}
[data-wk="wxcardsky"] *{color:#FFD9D0 !important;text-shadow:0 0 6px rgba(255,74,85,.8),0 0 14px rgba(255,74,85,.4) !important}
[data-wk="wxcardsky"] svg{stroke:#FF6A73 !important;filter:drop-shadow(0 0 4px rgba(255,74,85,.8)) !important}
[data-wk="wxcardsay"]{background:${C.ink} !important;color:${C.cream} !important;border-top:1px dashed rgba(237,226,207,.35) !important;letter-spacing:.1em !important}
/* 位置：一颗红霓虹圈 */
[data-wk="geopin"]{background:${svg(NEONPIN)} center/contain no-repeat !important;box-shadow:none !important;border:none !important;width:24px !important;height:24px !important;border-radius:0 !important;filter:drop-shadow(0 0 6px rgba(255,74,85,.9)) !important}
[data-wk="geopin"] *{opacity:0 !important}
[data-wk="geopinstem"]{background:#FF4A55 !important}
/* 名片 */
[data-wk="namecard"] img{border-radius:0 !important;box-shadow:0 0 0 1.4px ${C.cream} !important}

/* 拍一拍、通话结束：一行字幕小字，前后各一道短红线 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:linear-gradient(${C.redL},${C.redL}) left center/12px 1px no-repeat,linear-gradient(${C.redL},${C.redL}) right center/12px 1px no-repeat !important;border:none !important;border-radius:0 !important;padding:2px 20px !important;color:${C.dim} !important;box-shadow:none !important;letter-spacing:.2em !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.redL} !important}
[data-wk="note"][data-part="callsum"]{color:${C.dim} !important}

/* 线下小结：一盒录像带的侧标——红色标头写 SIDE A，正文像片尾字幕 */
[data-part="offlog"]{position:relative !important;overflow:visible !important;padding-top:34px !important}
[data-wk="offlogtitle"]{display:block !important;position:absolute !important;top:0 !important;left:0 !important;right:0 !important;margin:0 !important;padding:5px 14px !important;background:#B8262C !important;color:#F3E6CF !important;border-radius:0 !important;letter-spacing:.3em !important}
[data-wk="offlogtitle"]::before{content:"SIDE A · " !important;font:italic 10px/1 Georgia,serif !important;letter-spacing:.2em !important}
[data-wk="offlogtitle"] *{color:#F3E6CF !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.gold} !important;letter-spacing:.1em !important}
[data-wk="offlogtranscript"]{border-top:1px dashed rgba(237,226,207,.3) !important;color:${C.dim} !important}

/* 加号面板：一格格方框，外面两只取景框角 */
[data-wk="chatpanel"] *{color:${C.cream} !important}
[data-wk="chattoolicon"]{background:${CORNERS(C.cream, 8, 1.4)},rgba(237,226,207,.04) !important;border:1px solid rgba(237,226,207,.2) !important;border-radius:0 !important;box-shadow:none !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.cream} !important;color:${C.cream} !important}
[data-wk="chattoollabel"]{color:${C.dim} !important;letter-spacing:.15em !important}

/* 引用三处：待发送那条＝一行字幕条；气泡上方＝一行小灰字左边一道红线；气泡里＝左边一道细线 */
[data-wk="quotedraft"]{background:rgba(237,226,207,.05) !important;border:none !important;border-left:2px solid ${C.redL} !important;border-radius:0 !important}
[data-wk="quotedraft"] *{background:transparent !important;color:${C.dim} !important;border:none !important}
[data-wk="quoteicon"]{display:none !important}
[data-wk="quoteclear"]{color:${C.cream} !important}
[data-wk="quote"]{background:transparent !important;color:${C.dim} !important;border:none !important;border-left:2px solid ${C.redL} !important;border-radius:0 !important;padding:2px 10px !important;opacity:1 !important;letter-spacing:.08em !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid currentColor !important;padding-left:8px !important;opacity:.7 !important}
/* ───── 港风旧梦 · 第三批：状态卡＝一盒录像带封套：红色片头横条写片名，取景框角，好感是一颗霓虹心招牌 ───── */
[data-wk="statecard"]{background:${svg(GRAIN)} 0 0/120px 120px,${svg(GLOW)} center/cover no-repeat,${C.ink} !important;border:1px solid rgba(201,163,106,.45) !important;border-radius:0 !important;box-shadow:0 20px 50px rgba(0,0,0,.6) !important;overflow:visible !important;position:relative !important;padding-top:30px !important;--sc-heart-ink:${C.redL} !important}
[data-wk="statecard"]::before{content:"● REC   Midnight Romance" !important;white-space:pre !important;position:absolute !important;left:0 !important;right:0 !important;top:0 !important;height:24px !important;display:flex !important;align-items:center !important;padding-left:16px !important;background:#B8262C !important;color:#F3E6CF !important;font:italic 11px/1 Georgia,serif !important;letter-spacing:.2em !important;z-index:3 !important}
[data-wk="statecard"]::after{content:"" !important;position:absolute !important;inset:-8px !important;background:${CORNERS(C.cream, 14, 1.6)} !important;pointer-events:none !important;z-index:3 !important}
[data-wk="statecard"] *{font-family:${SERIF} !important}
[data-wk="statehead"]{background:transparent !important;border-bottom:1px dashed rgba(237,226,207,.3) !important}
[data-wk="statehead"] *{color:${C.cream} !important;letter-spacing:.1em !important}
[data-wk="statehead"] [data-wk="avatar"],[data-wk="statehead"] img{border-radius:0 !important}
[data-wk="statehead"] button{border:1px solid ${C.cream} !important;background:transparent !important;border-radius:0 !important}
[data-wk="statemood"]{display:inline-block !important;background:#B8262C !important;color:#F3E6CF !important;border:none !important;border-radius:0 !important;padding:0 10px !important;margin-right:4px !important;letter-spacing:.2em !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:transparent !important;border:1px solid rgba(237,226,207,.3) !important;border-radius:0 !important;padding:3px !important;margin:10px 16px !important}
[data-wk="statecard"] button[aria-pressed]{color:${C.dim} !important;border:none !important;border-radius:0 !important;letter-spacing:.2em !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:${C.cream} !important;color:${C.ink} !important}
/* 看得见的＝字幕框（左边金条）；心里想的＝虚线框贴「Voice-over」标签，跟聊天里的动描一个样 */
[data-wk="stateseen"],[data-wk="statevoice"]{position:relative !important;background:rgba(20,16,13,.6) !important;border:none !important;border-left:3px solid ${C.gold} !important;border-radius:0 !important;margin:14px 16px !important;color:${C.cream} !important;box-shadow:none !important;overflow:visible !important}
[data-wk="statevoice"]{background:linear-gradient(90deg,rgba(20,16,13,.55),rgba(80,20,22,.35)) !important;border:1.2px dashed rgba(237,226,207,.5) !important;margin-top:24px !important}
[data-wk="statevoice"]::before{content:"Voice-over" !important;position:absolute !important;left:16px !important;top:-11px !important;padding:2px 18px !important;background:${C.ink} !important;font:italic 11px/1.3 Georgia,serif !important;letter-spacing:.14em !important;color:${C.cream} !important}
[data-wk="stateseen"] *,[data-wk="statevoice"] *{color:${C.cream} !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:transparent !important;border:1px solid rgba(237,226,207,.3) !important;border-radius:0 !important}
[data-wk="statewear"] > span{background:transparent !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:${C.dim} !important}
[data-wk="statevoice"] + div > button{background:transparent !important;color:${C.cream} !important;border:1px solid ${C.cream} !important;border-radius:0 !important;letter-spacing:.2em !important}
/* 好感：街角一块霓虹心招牌——一颗心按好感从下往上亮成红色，外面一圈霓虹光 */
[data-wk="stateaff"]{background:transparent !important;border-top:1px solid rgba(201,163,106,.4) !important;position:relative !important;display:block !important;padding:16px 22px 84px !important;overflow:hidden !important}
[data-wk="stateaff"] *{color:${C.cream} !important}
[data-wk="stateheart"]{position:absolute !important;width:66px !important;height:60px !important;left:calc(50% - 33px) !important;bottom:14px !important;transform:none !important;--sc-heart-mask:${svg(NEONHEART)} !important;filter:drop-shadow(0 0 1.5px #FF6A73) drop-shadow(0 0 1.5px #FF6A73) drop-shadow(0 0 10px rgba(255,74,85,.7)) drop-shadow(0 0 22px rgba(255,74,85,.35)) !important}
[data-wk="stateheart"] > div{-webkit-mask-size:100% 100% !important;mask-size:100% 100% !important}
[data-wk="stateheartline"]{background:transparent !important;opacity:0 !important}
[data-wk="stateheartbase"]{background:#3A1A1C !important;opacity:1 !important}
[data-wk="stateheartfill"] > div{background:linear-gradient(0deg,#B8262C,#FF5A62 70%,#FFC2C5) !important;opacity:1 !important;border-top:1.5px solid #FFD9DB !important}
[data-wk="stateheartnum"],[data-wk="stateheartknob"]{display:none !important}
[data-wk="stateaffval"]{display:block !important;position:absolute !important;right:22px !important;top:10px !important;font:italic 700 26px/1 Georgia,serif !important;color:${C.redL} !important}
/* 翻旧的：一张张旧戏票票根 */
[data-wk="statehistbtn"]{background:transparent !important;color:${C.cream} !important;border:1px solid ${C.cream} !important;border-radius:0 !important;letter-spacing:.2em !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 16px !important}
[data-wk="statehisthead"] > :first-child{color:${C.dim} !important;letter-spacing:.2em !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{border:1px solid rgba(237,226,207,.4) !important;border-radius:0 !important;color:${C.cream} !important;background:transparent !important}
[data-wk="statehistitem"]{position:relative !important;background:linear-gradient(90deg,transparent calc(100% - 30px),rgba(20,16,13,.08) calc(100% - 30px)),linear-gradient(#EDE2CF,#E2D3B8) !important;border:none !important;border-left:5px solid #B8262C !important;border-radius:0 !important;padding:16px 40px 14px 18px !important;margin:0 0 14px !important;box-shadow:0 6px 14px rgba(0,0,0,.5) !important}
[data-wk="statehistitem"]::after{content:"" !important;position:absolute !important;right:28px !important;top:6px !important;bottom:6px !important;border-left:1.4px dashed rgba(20,16,13,.3) !important}
[data-wk="statehistitem"] *{color:${C.ink} !important}
[data-wk="statehistmood"]{background:#B8262C !important;border:none !important;color:#F3E6CF !important;border-radius:0 !important}
[data-wk="statehisttime"]{color:#7A5E3A !important;font-style:italic !important}
[data-wk="statehistmeta"]{background:rgba(20,16,13,.07) !important;border-radius:0 !important}
[data-wk="statehistend"]{color:${C.dim} !important}
/* Ta 眼里：同一盒录像带的里页 */
[data-wk="gazepage"]{background:${svg(GRAIN)} 0 0/120px 120px,${svg(GLOW)} center/cover no-repeat,${C.ink} !important}
[data-wk="gazepage"] *{font-family:${SERIF} !important}
[data-wk="gazetitle"]{color:${C.cream} !important;letter-spacing:.25em !important}
[data-wk="gazetab"]{background:transparent !important;color:${C.dim} !important;border:1px solid rgba(237,226,207,.3) !important;border-radius:0 !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:${C.cream} !important;color:${C.ink} !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:${C.dim} !important}
[data-wk="gazecard"]{background:rgba(20,16,13,.65) !important;border:none !important;border-left:3px solid ${C.gold} !important;border-radius:0 !important;box-shadow:none !important}
[data-wk="gazetape"]{background:#B8262C !important;box-shadow:none !important;border:none !important;width:28px !important;height:8px !important;transform:none !important}
[data-wk="gazecardname"]{color:${C.cream} !important;letter-spacing:.12em !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:${C.dim} !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{background:rgba(20,16,13,.7) !important;border:1px solid rgba(201,163,106,.35) !important;border-radius:0 !important}
[data-wk="gazeletter"] *,[data-wk="gazehistory"] *{color:${C.cream} !important}
[data-wk="gazeempty"]{background:transparent !important;border:1.2px dashed rgba(237,226,207,.4) !important;border-radius:0 !important;color:${C.cream} !important}
[data-wk="gazeempty"] > div:first-child{color:${C.cream} !important}
[data-wk="gazeempty"] button{background:#B8262C !important;color:#F3E6CF !important;border:none !important;border-radius:0 !important;letter-spacing:.2em !important}
/* 好感数字放进图形正中 */
[data-wk="stateaffval"]{display:block !important;position:absolute !important;left:50% !important;right:auto !important;top:auto !important;bottom:36px !important;transform:translateX(-50%) !important;z-index:3 !important;font-size:18px !important;line-height:1 !important;font-weight:700 !important;color:#FFF1F1 !important;text-shadow:0 0 2px #3A0A0C,0 0 2px #3A0A0C,0 0 8px rgba(255,74,85,.8) !important;pointer-events:none !important}
`;

const pack = { kind: "chat-look", v: 1, name: "港风旧梦", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "港风旧梦-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
