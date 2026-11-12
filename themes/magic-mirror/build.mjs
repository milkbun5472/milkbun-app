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
`;

const pack = { kind: "chat-look", v: 1, name: "魔镜魔镜", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "魔镜魔镜-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
