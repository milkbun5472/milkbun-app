// 魔镜：整页是一面金框魔镜。外圈金框带一排铆钉，顶上镶一颗红宝石；镜面是夜里的蓝灰玻璃，斜着几道反光；
// 顶栏底栏是嵌在金框里的两块墨色面板。我的话＝红丝绒牌描金，他的话＝镜面里浮出来的玻璃字，角上闪一颗星。
// 用法：node themes/magic-mirror/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { gold: "#C9A04E", goldL: "#F6E3A6", goldD: "#8F6A26", rivet: "#5E4414", panel: "#17110F", mir: "#1F2832", mir1: "#3B4A5C", mir2: "#2D3948", red: "#A51A2B", redD: "#6B0E1A", ruby: "#C4182E", cream: "#F6EFE2", ice: "#DDEBFF", fog: "#AAB6C2" };
const SERIF = `"Songti SC","Noto Serif SC","STSong",serif`;
const GOLD = `linear-gradient(135deg,${C.goldL} 0%,${C.gold} 35%,${C.goldD} 60%,#D9B866 80%,#A67C30 100%)`;

const STAR = (o = 1) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-6 -9 12 18'><path d='M0 -7.5 Q0.6 -0.6 5 0 Q0.6 0.6 0 7.5 Q-0.6 0.6 -5 0 Q-0.6 -0.6 0 -7.5Z' fill='#fff' opacity='${o}'/></svg>`;
const STARS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path transform='translate(9 14)' d='M0 -7.5 Q0.6 -0.6 5 0 Q0.6 0.6 0 7.5 Q-0.6 0.6 -5 0 Q-0.6 -0.6 0 -7.5Z' fill='#fff' opacity='.95'/><path transform='translate(20 4)' d='M0 -3.6 Q0.3 -0.3 2.4 0 Q0.3 0.3 0 3.6 Q-0.3 0.3 -2.4 0 Q-0.3 -0.3 0 -3.6Z' fill='#fff' opacity='.8'/></svg>`;
const RING = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><circle cx='6' cy='6' r='3' fill='none' stroke='${C.fog}' stroke-width='1.2'/></svg>`;
const RUBY = (r = 13) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${C.goldL}'/><stop offset='.35' stop-color='${C.gold}'/><stop offset='.6' stop-color='${C.goldD}'/><stop offset='1' stop-color='#D9B866'/></linearGradient><radialGradient id='r' cx='.38' cy='.32' r='.8'><stop offset='0' stop-color='#FF6B7C'/><stop offset='.45' stop-color='${C.ruby}'/><stop offset='1' stop-color='#5E0A14'/></radialGradient></defs><circle cx='15' cy='15' r='14' fill='url(#g)' stroke='${C.rivet}' stroke-width='.8'/><circle cx='15' cy='15' r='9' fill='url(#r)' stroke='#5E0A14' stroke-width='.8'/><path d='M10.6 13 A5.6 5.6 0 0 1 14.6 9.6' fill='none' stroke='#fff' stroke-width='1.2' stroke-linecap='round' opacity='.75'/></svg>`;
// 镜面上斜着的几道反光
const GLARE = `<svg xmlns='http://www.w3.org/2000/svg' width='390' height='844' viewBox='0 0 390 844'><g fill='#fff' opacity='.06'><path d='M-40 460 L220 80 L280 80 L20 460Z'/><path d='M100 800 L400 340 L420 340 L420 380 L150 800Z'/><path d='M50 460 L310 80 L324 80 L64 460Z'/></g></svg>`;
const RIVETS = `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='22'><circle cx='6' cy='11' r='1.6' fill='${C.rivet}' opacity='.55'/></svg>`;
const CI = inner => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='17' fill='none' stroke='${C.gold}' stroke-width='1.3'/>${inner}</svg>`;
const I_PLUS = CI(`<path d='M13 20 H27 M20 13 V27' stroke='${C.cream}' stroke-width='1.6' stroke-linecap='round'/>`);
const I_HOUSE = CI(`<path d='M12.5 21 L20 14.5 L27.5 21 V27 H12.5Z' fill='none' stroke='${C.cream}' stroke-width='1.4' stroke-linejoin='round'/>`);
const I_MORE = CI(`<g fill='${C.cream}'><circle cx='13' cy='20' r='1.8'/><circle cx='20' cy='20' r='1.8'/><circle cx='27' cy='20' r='1.8'/></g>`);
const I_REPLY = CI(`<path d='M20 28 V12 M14 18 L20 12 L26 18' fill='none' stroke='${C.cream}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/>`);
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${C.goldL}'/><stop offset='.35' stop-color='${C.gold}'/><stop offset='.6' stop-color='${C.goldD}'/><stop offset='1' stop-color='#D9B866'/></linearGradient><radialGradient id='r' cx='.38' cy='.32' r='.8'><stop offset='0' stop-color='#FF6B7C'/><stop offset='.45' stop-color='${C.ruby}'/><stop offset='1' stop-color='#5E0A14'/></radialGradient></defs><circle cx='25' cy='25' r='24' fill='url(#g)'/><circle cx='25' cy='25' r='19' fill='url(#r)' stroke='#5E0A14' stroke-width='.8'/><path d='M14.5 20.3 A13.3 13.3 0 0 1 24 12.1' fill='none' stroke='#fff' stroke-width='1.7' stroke-linecap='round' opacity='.75'/><path d='M16 18 H34 Q36 18 36 20 V28 Q36 30 34 30 H24 L19 34 V30 H16 Q14 30 14 28 V20 Q14 18 16 18Z' fill='none' stroke='#fff' stroke-width='1.8' stroke-linejoin='round'/></svg>`;

// ── 第二批用的图 ──
const APPLE = bitten => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 64'><defs><radialGradient id='a' cx='.35' cy='.35' r='.75'><stop offset='0' stop-color='#FF6B7C'/><stop offset='.5' stop-color='${C.ruby}'/><stop offset='1' stop-color='#5E0A14'/></radialGradient></defs><path d='M30 16 Q18 8 9 18 Q1 30 9 46 Q16 60 26 58 Q30 56 34 58 Q44 60 51 46 Q59 30 51 18 Q42 8 30 16Z' fill='url(#a)' stroke='#5E0A14' stroke-width='1'/>${bitten ? `<path d='M51 22 Q44 24 46 30 Q42 34 47 38 Q45 44 52 44 Q60 33 51 22Z' fill='#F6EFE2' stroke='#5E0A14' stroke-width='.8'/><circle cx='49' cy='31' r='1' fill='#5E0A14'/><circle cx='50' cy='36' r='1' fill='#5E0A14'/>` : ``}<path d='M30 16 Q31 8 35 3' fill='none' stroke='#5E4414' stroke-width='2.4' stroke-linecap='round'/><path d='M33 9 Q42 2 48 8 Q40 14 33 9Z' fill='#4E8A55' stroke='#2E5A35' stroke-width='.8'/><path d='M14 26 Q16 20 22 19' fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round' opacity='.6'/></svg>`;
const HANDMIRROR = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 64'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${C.goldL}'/><stop offset='.4' stop-color='${C.gold}'/><stop offset='.7' stop-color='${C.goldD}'/><stop offset='1' stop-color='#D9B866'/></linearGradient></defs><rect x='17' y='38' width='6' height='22' rx='3' fill='url(#g)'/><ellipse cx='20' cy='22' rx='17' ry='20' fill='url(#g)'/><ellipse cx='20' cy='22' rx='13' ry='16' fill='${C.mir1}'/><path d='M12 16 Q14 10 20 8' fill='none' stroke='#fff' stroke-width='1.6' stroke-linecap='round' opacity='.6'/></svg>`;
const OVALFRAME = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 120' preserveAspectRatio='none'><ellipse cx='50' cy='60' rx='47' ry='57' fill='none' stroke='${C.gold}' stroke-width='6' vector-effect='non-scaling-stroke'/><ellipse cx='50' cy='60' rx='47' ry='57' fill='none' stroke='${C.rivet}' stroke-width='1' vector-effect='non-scaling-stroke'/></svg>`;

// ── 白雪公主：雪、三滴血、七只小杯、梳子 ──
const SNOW = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='260'>${[[20,30,2.2],[90,12,1.4],[150,60,2.6],[60,110,1.6],[180,150,2],[30,200,2.4],[120,230,1.3],[100,170,1.8],[170,240,1.5],[70,60,1.2]].map(([x,y,r])=>`<circle cx='${x}' cy='${y}' r='${r}' fill='#fff' opacity='.85'/>`).join('')}</svg>`;
const DROPS3 = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 12'>${[5,15,25].map((x,i)=>`<path d='M${x} ${1+i%2} C${x-4.5} 7 ${x-3} 10.5 ${x} 10.5 C${x+3} 10.5 ${x+4.5} 7 ${x} ${1+i%2}Z' fill='#C4182E' stroke='#fff' stroke-width='.6'/>`).join('')}</svg>`;
const CUPS7 = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 252'>${Array.from({length:7},(_,i)=>`<g transform='translate(0 ${i*36}) rotate(-90 18 18)'><path d='M7 7 H29 L26 22 Q25 25 22 25 H14 Q11 25 10 22Z'/><rect x='16' y='25' width='4' height='4'/><rect x='11' y='29' width='14' height='3' rx='1'/></g>`).join('')}</svg>`;
const COMB = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 14'><path d='M2 2 H22 Q22 6 18 6 H6 Q2 6 2 2Z' fill='${C.gold}' stroke='${C.goldD}' stroke-width='.8'/>${Array.from({length:8},(_,i)=>`<path d='M${4+i*2.3} 6 V13' stroke='${C.gold}' stroke-width='1.1' stroke-linecap='round'/>`).join('')}</svg>`;

const bubble = { myBg: C.red, myText: C.cream, myBorder: "none", charBg: "transparent", charText: "#fff", charBorder: "none", radius: 10, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 魔镜 · 第一批 ───── */
/* 整页＝金框：底色是金，两边一排铆钉；镜面（body）缩进来，四角圆、内阴影 */
[data-wk="chat"]{background:${svg(RIVETS)} 2px 0/12px 22px repeat-y,${svg(RIVETS)} right 2px top 0/12px 22px repeat-y,${GOLD} !important}
[data-wk="chat"] *{font-family:${SERIF} !important}
[data-wk="body"]{position:relative !important;margin:0 12px !important;border-radius:14px !important;background:${svg(GLARE)} center top/100% auto no-repeat,radial-gradient(circle at 25% 28%,rgba(143,180,217,.28),transparent 45%),radial-gradient(circle at 85% 70%,rgba(110,143,181,.28),transparent 45%),linear-gradient(170deg,${C.mir1},${C.mir} 50%,${C.mir2}) !important;box-shadow:inset 0 0 0 1.2px ${C.rivet},inset 0 4px 14px rgba(0,0,0,.55) !important}

/* 顶栏：金框里嵌一块墨色面板，两道金细线；下面镜子顶上正中镶一颗红宝石 */
[data-wk="chathead"]{position:relative !important;overflow:visible !important;background:transparent !important;border-bottom:none !important;box-shadow:none !important;gap:6px !important;z-index:5 !important}
[data-wk="chathead"]::before{content:"" !important;position:absolute !important;left:10px !important;right:10px !important;top:calc(var(--app-safe-top, 0px) + 2px) !important;bottom:6px !important;border-radius:12px !important;background:${C.panel} !important;box-shadow:0 0 0 1.2px ${C.rivet},inset 0 0 0 3.5px ${C.panel},inset 0 0 0 4.1px rgba(201,160,78,.8) !important;z-index:-1 !important;pointer-events:none !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:50% !important;top:calc(100% - 4px) !important;width:28px !important;height:28px !important;margin-left:-14px !important;background:${svg(RUBY())} center/contain no-repeat !important;filter:drop-shadow(0 3px 3px rgba(0,0,0,.5)) !important;z-index:6 !important;pointer-events:none !important}
[data-wk="chathead"] + *:not([data-wk="body"]){margin:16px 12px 0 !important}
[data-wk="body"]{padding-top:26px !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.cream} !important}
[data-wk="headname"] > [data-wk="headink"]{font-weight:700 !important;letter-spacing:.08em !important;white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important}
[data-wk="headname"] > [data-wk="headink"] > span{flex:none !important}
[data-wk="headname"] > [data-wk="headdim"]{font-size:0 !important;letter-spacing:0 !important;white-space:nowrap !important;line-height:1 !important;margin-top:3px !important}
[data-wk="headname"] > [data-wk="headdim"]::before{content:"Mirror, mirror" !important;font:italic 400 12.5px/1.2 Didot,"Bodoni MT","Playfair Display",Georgia,serif !important;letter-spacing:.03em !important;color:${C.gold} !important}
[data-wk="headdim"]{color:#A79C8C !important;white-space:nowrap !important;letter-spacing:.12em !important}
[data-wk="chatback"],[data-wk="chatback"] *{color:${C.cream} !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:${C.cream} !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:32px !important;min-width:32px !important;height:32px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important;margin-right:6px !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 头像：一圈金边，左上一道高光 */
button[data-wk="avatar"],span[data-wk="avatar"]{position:relative !important;overflow:visible !important;border-radius:50% !important;box-shadow:0 0 0 4px #C9A04E,0 0 0 5px ${C.rivet},0 4px 8px 3px rgba(0,0,0,.45) !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{border-radius:50% !important}
button[data-wk="avatar"]::after,span[data-wk="avatar"]:not([data-halo])::after{content:"" !important;position:absolute !important;inset:12% !important;border-radius:50% !important;border:1.4px solid transparent !important;border-top-color:rgba(255,255,255,.5) !important;border-left-color:rgba(255,255,255,.35) !important;transform:rotate(-15deg) !important;pointer-events:none !important}
[data-wk="chathead"] img[data-wk="avatar"],[data-wk="chathead"] [data-wk="avatar"]{box-shadow:0 0 0 3px ${C.gold} !important}

/* 我的话：红丝绒牌，金边，里面再描一道细金线，底下压一层影 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:10px !important;letter-spacing:.06em !important;padding:11px 18px !important}
[data-wk="bubble"][data-kind="text"]::before,[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,${C.red},${C.redD}) !important;color:${C.cream} !important;border:1.1px solid ${C.gold} !important;box-shadow:inset 0 0 0 3px transparent,inset 0 0 0 3.5px rgba(201,160,78,.7),0 4px 0 rgba(0,0,0,.35),0 6px 10px rgba(0,0,0,.3) !important}
/* 他的话：镜面里浮出来的一块玻璃——半透明、亮白边、上沿一道高光、字带一点光晕；一串第一条右上角闪一大一小两颗星 */
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,.55)) 12px 4px/45% 1.4px no-repeat,linear-gradient(135deg,rgba(255,255,255,.30),rgba(191,216,240,.12) 50%,rgba(255,255,255,.22)) !important;color:#fff !important;border:1.2px solid rgba(255,255,255,.7) !important;box-shadow:0 0 16px rgba(207,230,255,.18) !important;text-shadow:0 0 6px rgba(221,235,255,.7) !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="0"]::after{content:"" !important;position:absolute !important;right:-14px !important;top:-12px !important;width:24px !important;height:24px !important;background:${svg(STARS)} center/contain no-repeat !important;border:none !important;transform:none !important;left:auto !important;bottom:auto !important;animation:mmTwinkle 2.8s ease-in-out infinite !important}
@keyframes mmTwinkle{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}

/* 时间：两道细白线中间夹时间，两边各一颗小星；底下一行「魔镜醒着」 */
[data-wk="time"]{display:flex !important;justify-content:center !important}
[data-wk="time"] > span{display:block !important;text-align:center !important;background:${svg(STAR(.9))} left 4px top 6px/7px 10px no-repeat,${svg(STAR(.9))} right 4px top 6px/7px 10px no-repeat !important;border:none !important;box-shadow:none !important;color:#EAF2FB !important;font-family:Didot,"Bodoni MT","Playfair Display",Georgia,serif !important;letter-spacing:.25em !important;font-size:11.5px !important;padding:2px 18px !important;position:relative !important}
[data-wk="time"] > span::before,[data-wk="time"] > span::after{content:"" !important;position:absolute !important;top:10px !important;width:56px !important;height:1px !important;background:rgba(255,255,255,.5) !important}
[data-wk="time"] > span::before{right:100% !important}
[data-wk="time"] > span::after{left:100% !important}
[data-wk="time"]::after{content:"魔镜醒着" !important;position:absolute !important;left:0 !important;right:0 !important;margin-top:24px !important;text-align:center !important;font-size:9.5px !important;letter-spacing:.4em !important;color:${C.fog} !important}
[data-wk="time"]{position:relative !important;padding-bottom:16px !important}

/* 已送达＝后面一个小空心圈；已读＝前面一颗星，字写「镜已阅」 */
[data-wk="meta"]{color:${C.fog} !important;font-size:10px !important;letter-spacing:.15em !important;display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"][data-read="0"]::after{content:"" !important;width:10px !important;height:10px !important;flex:none !important;background:${svg(RING)} center/contain no-repeat !important}
[data-wk="meta"][data-read="1"]{font-size:0 !important}
[data-wk="meta"][data-read="1"] *{display:none !important}
[data-wk="meta"][data-read="1"]::before{content:"镜已阅" !important;font-size:10px !important;letter-spacing:.15em !important;padding-left:14px !important;background:${svg(STAR(.95))} left center/7px 10px no-repeat !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:linear-gradient(135deg,rgba(255,255,255,.3),rgba(191,216,240,.12)) !important;border:1.2px solid rgba(255,255,255,.7) !important;border-radius:10px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:#fff !important;box-shadow:0 0 4px #fff !important}
[data-wk="name"]{color:${C.fog} !important}

/* 动描：镜面上一段像雾气写出来的字——没有框，白字带光晕，上下两颗小星 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{position:relative !important;display:block !important;background:radial-gradient(ellipse at 50% 50%,rgba(207,230,255,.10),transparent 70%) !important;border:none !important;border-radius:0 !important;box-shadow:none !important;color:${C.ice} !important;font-style:italic !important;font-size:13px !important;line-height:1.9 !important;letter-spacing:.12em !important;text-align:center !important;text-shadow:0 0 8px rgba(207,230,255,.6) !important;padding:16px 26px !important}
[data-wk="narrink"]::before,[data-wk="narrink"]::after{content:"" !important;position:absolute !important;left:50% !important;width:8px !important;height:12px !important;margin-left:-4px !important;background:${svg(STAR(.85))} center/contain no-repeat !important}
[data-wk="narrink"]::before{top:0 !important}
[data-wk="narrink"]::after{bottom:0 !important}
/* 系统提示：一行小灰字，前面一颗星 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.12em !important;padding-left:14px !important;background:${svg(STAR(.8))} left center/7px 10px no-repeat !important}
[data-wk="sysnoteclose"]{color:${C.fog} !important}
/* 深底上的灰字提亮：日程条、线下文风那行 */
[data-wk="chathead"] + *:not([data-wk="body"]),[data-wk="chathead"] + *:not([data-wk="body"]) *{color:${C.cream} !important}

/* 底栏：金框里嵌一块墨色面板；输入框是一块玻璃；加号、回复是金圈，最右是红宝石的「让他回复」，发送是左边的金圈 */
[data-wk="composer"]{position:relative !important;overflow:visible !important;background:transparent !important;border-top:none !important;box-shadow:none !important;align-items:center !important;gap:10px !important;padding-left:22px !important;padding-right:22px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:10px !important;right:10px !important;top:6px !important;bottom:6px !important;border-radius:12px !important;background:${C.panel} !important;box-shadow:0 0 0 1.2px ${C.rivet},inset 0 0 0 3.5px ${C.panel},inset 0 0 0 4.1px rgba(201,160,78,.8) !important;z-index:-1 !important;pointer-events:none !important}
[data-wk="chatinput"]{background:linear-gradient(135deg,rgba(255,255,255,.18),rgba(191,216,240,.08) 50%,rgba(255,255,255,.14)) !important;border:1px solid rgba(255,255,255,.6) !important;border-radius:10px !important;color:#fff !important;letter-spacing:.1em !important}
[data-wk="chatinput"]::placeholder{color:#C9D6E4 !important}
[data-wk="chatplus"],[data-wk="chatreply"],[data-wk="send"]{border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{width:34px !important;min-width:34px !important;height:34px !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{width:34px !important;min-width:34px !important;height:34px !important;background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatreply"]{width:46px !important;min-width:46px !important;height:46px !important;background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important;filter:drop-shadow(0 3px 4px rgba(0,0,0,.5)) !important}
[data-wk="chatplus"] *,[data-wk="chatreply"] *,[data-wk="send"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="chatreply"]:active,[data-wk="send"]:active{transform:scale(.9) !important}
[data-wk="chatpanel"]{background:${C.panel} !important;border-top:1px solid ${C.gold} !important}
/* ───── 魔镜 · 第二批：卡片 ───── */
/* 卡片统一：墨色嵌板＋金边＋一道细金线 */
[data-wk="voice"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{background:${C.panel} !important;border:1.2px solid ${C.gold} !important;border-radius:12px !important;box-shadow:inset 0 0 0 3px ${C.panel},inset 0 0 0 3.6px rgba(201,160,78,.6),0 6px 14px rgba(0,0,0,.45) !important;color:${C.cream} !important}
[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:${C.cream} !important;border-color:rgba(201,160,78,.35) !important}

/* 转账＝镜子递过来的一张红丝绒礼单，左边一面金柄小手镜；收下手镜亮起来，退回蒙一层灰 */
[data-wk="transfercard"]{position:relative !important;overflow:visible !important;background:linear-gradient(180deg,${C.red},${C.redD}) !important;border:1.2px solid ${C.gold} !important;border-radius:12px !important;box-shadow:inset 0 0 0 3.5px transparent,inset 0 0 0 4px rgba(201,160,78,.7),0 6px 14px rgba(0,0,0,.45) !important;padding-left:60px !important;color:${C.cream} !important}
[data-wk="transfercard"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:38px !important;height:60px !important;margin-top:-34px !important;background:${svg(HANDMIRROR)} center/contain no-repeat !important;transform:rotate(-12deg) !important;filter:drop-shadow(0 3px 3px rgba(0,0,0,.5)) !important}
[data-wk="transfercard"] *{color:${C.cream} !important;border-color:rgba(201,160,78,.4) !important}
[data-wk="transferlabel"]{color:${C.goldL} !important;letter-spacing:.25em !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:${C.goldL} !important;font-weight:700 !important}
[data-wk="transferrule"]{border:none !important;height:10px !important;background:${svg(STAR(.9))} center/7px 10px no-repeat,linear-gradient(90deg,transparent,rgba(246,227,166,.6) 20%,rgba(246,227,166,.6) calc(50% - 8px),transparent calc(50% - 8px),transparent calc(50% + 8px),rgba(246,227,166,.6) calc(50% + 8px),rgba(246,227,166,.6) 80%,transparent) center/100% 1px no-repeat !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:rgba(0,0,0,.2) !important}
[data-wk="transferbtn"]{border-radius:999px !important}
[data-wk="transferbtn"][data-part="take"]{background:${GOLD} !important;color:${C.panel} !important;border:none !important}
[data-wk="transferbtn"][data-part="back"]{background:transparent !important;color:${C.cream} !important;border:1px solid ${C.gold} !important}
[data-wk="transferseal"]{background:transparent !important;border:1px solid ${C.gold} !important;color:${C.goldL} !important;border-radius:50% !important;box-shadow:none !important}
[data-wk="transfercard"][data-status="accepted"]::before{filter:drop-shadow(0 0 8px rgba(246,227,166,.9)) !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{width:40px !important;height:40px !important;flex-shrink:0 !important;border:none !important;background:${svg(STARS)} center/contain no-repeat !important;filter:drop-shadow(0 0 6px #fff) !important}
[data-wk="transfercard"][data-status="returned"]{filter:grayscale(.75) brightness(.8) !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] *{display:none !important}

/* 红包＝一颗红苹果；领完了被咬了一口 */
[data-wk="rpcard"]{position:relative !important;overflow:visible !important;width:220px !important;min-height:86px !important;padding:16px 16px 16px 84px !important;background:${C.panel} !important;border:1.2px solid ${C.gold} !important;border-radius:12px !important;box-shadow:inset 0 0 0 3px ${C.panel},inset 0 0 0 3.6px rgba(201,160,78,.6),0 6px 14px rgba(0,0,0,.45) !important}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:58px !important;height:62px !important;margin-top:-32px !important;background:${svg(APPLE(false))} center/contain no-repeat !important;filter:drop-shadow(0 4px 5px rgba(0,0,0,.5)) !important}
[data-wk="rpcard"]::after{content:"一颗苹果" !important;position:absolute !important;right:12px !important;bottom:6px !important;font-size:10px !important;letter-spacing:.25em !important;color:${C.fog} !important}
[data-wk="rpcard"] *{color:${C.cream} !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"] > div:not([data-wk]){padding:0 !important;background:transparent !important}
[data-wk="rpmsg"]{-webkit-line-clamp:2 !important;color:${C.goldL} !important}
[data-wk="rpcard"][data-status="done"]{opacity:.85 !important}
[data-wk="rpcard"][data-status="done"]::before{background:${svg(APPLE(true))} center/contain no-repeat !important}
[data-wk="rpcard"][data-status="done"]::after{content:"咬了一口" !important}
[data-wk="rpenvelope"][data-stage="closed"],[data-wk="rpenvelope"][data-stage="open"]{background:${svg(GLARE)} center/cover no-repeat,linear-gradient(170deg,${C.mir1},${C.mir} 50%,${C.mir2}) !important;border:none !important;border-radius:26px !important;box-shadow:0 0 0 6px ${C.gold},0 0 0 7px ${C.rivet},0 20px 40px rgba(0,0,0,.6) !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:linear-gradient(180deg,${C.red},${C.redD}) !important;border-color:${C.gold} !important;box-shadow:none !important}
[data-wk="rpenvelope"] [data-wk="rparc"]::after{content:none !important}
[data-wk="rpenvelope"] *{color:${C.cream} !important}
[data-wk="rpopenbtn"]{background:${svg(APPLE(false))} center/80% no-repeat,radial-gradient(circle,${C.panel} 60%,${C.gold} 62%,${C.gold} 68%,transparent 70%) !important;border:none !important;box-shadow:none !important;filter:drop-shadow(0 4px 8px rgba(0,0,0,.5)) !important}
[data-wk="rpopenbtn"],[data-wk="rpopenbtn"] *{color:transparent !important;font-size:0 !important}
[data-wk="rpavatar"]{border-radius:50% !important;box-shadow:0 0 0 3px ${C.gold} !important}
[data-wk="rpamount"]{color:${C.goldL} !important;background:none !important;text-shadow:0 0 12px rgba(246,227,166,.5) !important}
[data-wk="rpclose"]{background:${C.panel} !important;border:1.2px solid ${C.gold} !important;color:${C.cream} !important}

/* 照片＝镜中浮现的画面：一面椭圆金框小镜，画面带一层镜面反光 */
[data-wk="photocard"]{position:relative !important;overflow:visible !important;background:${C.panel} !important;border:none !important;border-radius:50% / 46% !important;padding:22px 28px 34px !important;box-shadow:0 8px 18px rgba(0,0,0,.5) !important}
[data-wk="photocard"]::before{content:"" !important;position:absolute !important;inset:0 !important;background:${svg(OVALFRAME)} center/100% 100% no-repeat !important;pointer-events:none !important;z-index:2 !important}
[data-wk="photocard"]::after{content:"" !important;position:absolute !important;left:50% !important;top:-12px !important;width:24px !important;height:24px !important;margin-left:-12px !important;background:${svg(RUBY())} center/contain no-repeat !important;z-index:3 !important}
[data-wk="photoface"]{background:${svg(GLARE)} center/cover no-repeat,linear-gradient(170deg,${C.mir1},${C.mir}) !important;border:none !important;border-radius:50% / 46% !important}
[data-wk="photoface"] *,[data-wk="phototext"]{color:${C.ice} !important;text-shadow:0 0 6px rgba(207,230,255,.6) !important}
[data-wk="photocap"],[data-wk="photohint"]{color:${C.fog} !important}

/* 语音：前面一颗闪着的星 */
[data-wk="voice"] > *{background:transparent !important;box-shadow:none !important;border:none !important;color:${C.cream} !important}
[data-wk="voice"][data-me]{padding:0 14px 0 36px !important;position:relative !important;border-radius:999px !important}
[data-wk="voice"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:14px !important;height:20px !important;margin-top:-10px !important;background:${svg(STAR(1))} center/contain no-repeat !important;animation:mmTwinkle 1.8s ease-in-out infinite !important;z-index:2 !important}
[data-wk="voice"][data-me="1"]{background:linear-gradient(180deg,${C.red},${C.redD}) !important}
[data-wk="voicewave"] span{background:${C.goldL} !important}

/* 天气：镜面里的天 */
[data-wk="wxcardsky"]{background:${svg(GLARE)} center/cover no-repeat,linear-gradient(170deg,${C.mir1},${C.mir}) !important}
[data-wk="wxcardsky"] *{color:#fff !important;text-shadow:0 0 6px rgba(207,230,255,.5) !important}
[data-wk="wxcardsky"] svg{stroke:${C.goldL} !important}
[data-wk="wxcardsay"]{background:${C.panel} !important;color:${C.cream} !important;border-top:1px solid ${C.gold} !important}
/* 位置：一颗红宝石钉 */
[data-wk="geopin"]{background:${svg(RUBY())} center/contain no-repeat !important;box-shadow:none !important;border:none !important;width:24px !important;height:24px !important;border-radius:50% !important}
[data-wk="geopin"] *{opacity:0 !important}
[data-wk="geopinstem"]{background:${C.gold} !important}
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 3px ${C.gold} !important}

/* 拍一拍、通话结束：一行小灰字，两头各一颗星 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:${svg(STAR(.9))} left center/7px 10px no-repeat,${svg(STAR(.9))} right center/7px 10px no-repeat !important;border:none !important;border-radius:0 !important;padding:2px 18px !important;color:${C.fog} !important;box-shadow:none !important;letter-spacing:.12em !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.goldL} !important}
[data-wk="note"][data-part="callsum"]{color:${C.fog} !important}

/* 线下小结：墨色嵌板，标题是一条红丝绒签，右上角一颗红宝石 */
[data-part="offlog"]{position:relative !important;overflow:visible !important;padding-top:30px !important}
[data-part="offlog"]::before{content:"" !important;position:absolute !important;right:12px !important;top:10px !important;width:22px !important;height:22px !important;background:${svg(RUBY())} center/contain no-repeat !important}
[data-wk="offlogtitle"]{display:inline-block !important;margin:0 0 6px !important;padding:3px 16px !important;background:linear-gradient(180deg,${C.red},${C.redD}) !important;color:${C.cream} !important;border:1px solid ${C.gold} !important;border-radius:6px !important;letter-spacing:.2em !important}
[data-wk="offlogtitle"] *{color:${C.cream} !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.goldL} !important}
[data-wk="offlogtranscript"]{border-top:1px solid rgba(201,160,78,.5) !important;color:${C.fog} !important}

/* 加号面板：一颗颗金圈 */
[data-wk="chatpanel"] *{color:${C.cream} !important}
[data-wk="chattoolicon"]{background:${C.panel} !important;border:1.3px solid ${C.gold} !important;border-radius:50% !important;box-shadow:none !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.cream} !important;color:${C.cream} !important}
[data-wk="chattoollabel"]{color:${C.fog} !important}

/* 引用三处：玻璃条 */
[data-wk="quotedraft"]{background:${C.panel} !important;border:none !important;border-top:1px solid ${C.gold} !important;position:relative !important;z-index:3 !important}
[data-wk="quotedraft"] *{color:${C.ice} !important;border-color:rgba(255,255,255,.5) !important}
[data-wk="quoteicon"]{display:none !important}
[data-wk="quoteclear"]{color:${C.goldL} !important}
[data-wk="quote"]{background:linear-gradient(135deg,rgba(255,255,255,.18),rgba(191,216,240,.08)) !important;color:${C.ice} !important;border:1px solid rgba(255,255,255,.5) !important;border-radius:8px !important;padding:3px 10px !important;opacity:1 !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid currentColor !important;padding-left:8px !important;opacity:.75 !important}
/* ───── 白雪公主：雪、雪白的他、三滴血、七只小杯 ───── */
/* 整屏飘细雪（两层不同速度），盖在最上面但点不到 */
[data-wk="chat"]::after{content:"" !important;position:fixed !important;left:0 !important;top:-260px !important;width:100vw !important;height:calc(100vh + 260px) !important;background:${svg(SNOW)} 0 0/200px 260px repeat,${svg(SNOW)} 70px 40px/140px 180px repeat !important;opacity:.55 !important;pointer-events:none !important;z-index:50 !important;animation:mmSnow 14s linear infinite !important}
@keyframes mmSnow{0%{transform:translate(0,0)}100%{transform:translate(-40px,260px)}}
/* 他的话：雪白磨砂，像落了一层薄雪 */
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:linear-gradient(180deg,rgba(255,255,255,.9),rgba(236,242,250,.82)) !important;color:#26303C !important;text-shadow:none !important;border:1.2px solid #fff !important;box-shadow:0 0 14px rgba(255,255,255,.25),inset 0 -3px 6px rgba(170,190,215,.35) !important}
[data-wk="bubble"][data-kind="typing"]{background:rgba(255,255,255,.88) !important}
[data-wk="typingdot"]{background:#C4182E !important;box-shadow:none !important}
/* 已读：雪上三滴血 */
[data-wk="meta"][data-read="1"]::before{padding-left:30px !important;background:${svg(DROPS3)} left center/24px 10px no-repeat !important}
/* 时间底下那行 */
[data-wk="time"]::after{content:"魔镜，墙上的魔镜" !important;letter-spacing:.3em !important}
/* 拍一拍、通话结束：两头换成王后的金梳子 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{background:${svg(COMB)} left center/16px 10px no-repeat,${svg(COMB)} right center/16px 10px no-repeat !important;padding:2px 24px !important}
/* ───── 魔镜 · 第三批：状态卡＝一面挂墙的金框魔镜，顶镶红宝石，镜面落雪；好感是小屋里七只小杯，一只只斟满 ───── */
[data-wk="statecard"]{position:relative !important;overflow:visible !important;background:${svg(SNOW)} 0 0/200px 260px,${svg(GLARE)} center/cover no-repeat,linear-gradient(170deg,${C.mir1},${C.mir} 50%,${C.mir2}) !important;border:none !important;border-radius:24px !important;box-shadow:0 0 0 7px #C9A04E,0 0 0 8px ${C.rivet},0 0 0 10px ${C.goldL},0 20px 40px rgba(0,0,0,.6) !important;padding-top:20px !important;--sc-heart-ink:${C.ruby} !important}
[data-wk="statecard"]::before{content:"" !important;position:absolute !important;left:50% !important;top:-18px !important;width:30px !important;height:30px !important;margin-left:-15px !important;background:${svg(RUBY())} center/contain no-repeat !important;z-index:3 !important;filter:drop-shadow(0 3px 3px rgba(0,0,0,.5)) !important}
[data-wk="statehead"]{background:transparent !important;border-bottom:1px solid rgba(201,160,78,.5) !important}
[data-wk="statehead"] *{color:${C.cream} !important}
[data-wk="statehead"] [data-wk="avatar"],[data-wk="statehead"] img{border-radius:50% !important;box-shadow:0 0 0 3px ${C.gold} !important}
[data-wk="statehead"] [data-wk="avatar"]::after{content:none !important}
[data-wk="statehead"] button{border:1.2px solid ${C.gold} !important;background:${C.panel} !important;border-radius:50% !important}
[data-wk="statemood"]{display:inline-block !important;background:linear-gradient(180deg,${C.red},${C.redD}) !important;color:${C.cream} !important;border:1px solid ${C.gold} !important;border-radius:999px !important;padding:0 10px !important;margin-right:4px !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:${C.panel} !important;border:1px solid ${C.gold} !important;border-radius:999px !important;padding:3px !important;margin:10px 16px !important}
[data-wk="statecard"] button[aria-pressed]{color:${C.fog} !important;border:none !important;border-radius:999px !important;letter-spacing:.15em !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:linear-gradient(180deg,${C.red},${C.redD}) !important;color:${C.cream} !important}
/* 看得见的＝雪白磨砂（跟他的气泡一样）；心里想的＝镜面上雾气写的字 */
[data-wk="stateseen"]{background:linear-gradient(180deg,rgba(255,255,255,.9),rgba(236,242,250,.82)) !important;border:1.2px solid #fff !important;border-radius:12px !important;margin:12px 16px !important;box-shadow:inset 0 -3px 6px rgba(170,190,215,.35) !important}
[data-wk="stateseen"] *{color:#26303C !important}
[data-wk="statevoice"]{position:relative !important;background:radial-gradient(ellipse at 50% 50%,rgba(207,230,255,.12),transparent 70%) !important;border:none !important;border-top:1px solid rgba(255,255,255,.35) !important;border-bottom:1px solid rgba(255,255,255,.35) !important;border-radius:0 !important;margin:14px 16px !important;box-shadow:none !important;font-style:italic !important}
[data-wk="statevoice"] *{color:${C.ice} !important;text-shadow:0 0 8px rgba(207,230,255,.55) !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:rgba(38,48,60,.08) !important;border:1px solid rgba(38,48,60,.25) !important;border-radius:999px !important}
[data-wk="statewear"] > span{background:transparent !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:${C.fog} !important}
[data-wk="statevoice"] + div > button{background:${C.panel} !important;color:${C.cream} !important;border:1px solid ${C.gold} !important;border-radius:999px !important}
/* 好感：七只小杯一排，好感多少就斟满几只（红酒色），数字写在「好感度」旁 */
[data-wk="stateaff"]{display:block !important;position:relative !important;background:transparent !important;border-top:1px solid rgba(201,160,78,.5) !important;padding:14px 20px 16px !important;overflow:hidden !important}
[data-wk="stateaff"] *{color:${C.cream} !important}
[data-wk="stateheart"]{position:relative !important;left:auto !important;bottom:auto !important;width:34px !important;height:238px !important;margin:-96px auto -96px !important;transform:rotate(90deg) !important;--sc-heart-mask:${svg(CUPS7)} !important;filter:drop-shadow(1.2px 0 0 ${C.gold}) drop-shadow(-1.2px 0 0 ${C.gold}) drop-shadow(0 1.2px 0 ${C.gold}) drop-shadow(0 -1.2px 0 ${C.gold}) !important}
[data-wk="stateheart"] > div{-webkit-mask-size:100% 100% !important;mask-size:100% 100% !important}
[data-wk="stateheartline"]{background:transparent !important;opacity:0 !important}
[data-wk="stateheartbase"]{background:#3A4656 !important;opacity:1 !important}
[data-wk="stateheartfill"] > div{background:linear-gradient(90deg,#E0465A,${C.ruby} 50%,#7A0E1E) !important;opacity:1 !important;border-top:none !important}
[data-wk="stateheartnum"],[data-wk="stateheartknob"]{display:none !important}
[data-wk="stateaffval"]{display:block !important;position:absolute !important;right:20px !important;top:12px !important;font:italic 700 22px/1 Didot,"Bodoni MT",Georgia,serif !important;color:${C.goldL} !important}
/* 翻旧的：一张张雪白卡，左上压三滴血 */
[data-wk="statehistbtn"]{background:${C.panel} !important;color:${C.cream} !important;border:1px solid ${C.gold} !important;border-radius:999px !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 16px !important}
[data-wk="statehisthead"] > :first-child{color:${C.fog} !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{border:1px solid ${C.gold} !important;border-radius:999px !important;color:${C.goldL} !important;background:transparent !important}
[data-wk="statehistitem"]{position:relative !important;background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(236,242,250,.85)) !important;border:1.2px solid #fff !important;border-radius:12px !important;padding:18px 18px 14px !important;margin:0 0 14px !important;box-shadow:0 6px 14px rgba(0,0,0,.35) !important;overflow:visible !important}
[data-wk="statehistitem"]::before{content:"" !important;position:absolute !important;left:12px !important;top:6px !important;width:24px !important;height:10px !important;background:${svg(DROPS3)} center/contain no-repeat !important}
[data-wk="statehistitem"] *{color:#26303C !important}
[data-wk="statehistmood"]{background:linear-gradient(180deg,${C.red},${C.redD}) !important;border:none !important;color:${C.cream} !important;border-radius:999px !important}
[data-wk="statehisttime"]{color:#6B7889 !important;font-style:italic !important}
[data-wk="statehistmeta"]{background:rgba(38,48,60,.06) !important;border-radius:8px !important}
[data-wk="statehistend"]{color:${C.fog} !important}
/* Ta 眼里：镜面落雪底，卡片雪白 */
[data-wk="gazepage"]{background:${svg(SNOW)} 0 0/200px 260px,${svg(GLARE)} center/cover no-repeat,linear-gradient(170deg,${C.mir1},${C.mir} 50%,${C.mir2}) !important}
[data-wk="gazetitle"]{color:${C.cream} !important;letter-spacing:.2em !important}
[data-wk="gazetab"]{background:${C.panel} !important;color:${C.fog} !important;border:1px solid ${C.gold} !important;border-radius:999px !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:linear-gradient(180deg,${C.red},${C.redD}) !important;color:${C.cream} !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:${C.fog} !important}
[data-wk="gazecard"]{background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(236,242,250,.85)) !important;border:1.2px solid #fff !important;border-radius:14px !important;box-shadow:0 4px 10px rgba(0,0,0,.3) !important}
[data-wk="gazetape"]{background:${svg(DROPS3)} center/24px 10px no-repeat !important;box-shadow:none !important;border:none !important;transform:none !important}
[data-wk="gazecardname"]{color:#26303C !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:#6B7889 !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(236,242,250,.85)) !important;border:1.2px solid #fff !important;border-radius:16px !important}
[data-wk="gazeletter"] *,[data-wk="gazehistory"] *{color:#26303C !important}
[data-wk="gazeempty"]{background:rgba(255,255,255,.08) !important;border:1.2px dashed rgba(255,255,255,.5) !important;border-radius:16px !important;color:${C.cream} !important}
[data-wk="gazeempty"] > div:first-child{color:${C.cream} !important}
[data-wk="gazeempty"] button{background:linear-gradient(180deg,${C.red},${C.redD}) !important;color:${C.cream} !important;border:1px solid ${C.gold} !important;border-radius:999px !important}
`;

const pack = { kind: "chat-look", v: 1, name: "魔镜魔镜", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "魔镜魔镜-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
