// 蓝夜蝴蝶：深蓝的夜，底下一片细碎的星尘，四处停着发光的白蝴蝶。
// 他的话＝过曝的一团白光（白底蓝字、外面一圈光晕），我的话＝深蓝玻璃镶一圈白光；头像泡在白光里，停两只蝴蝶。
// 用法：node themes/blue-butterfly/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { n1: "#0B1450", n2: "#13208A", n3: "#1E2FB8", glass: "#1A2A9E", ink: "#2235A8", white: "#FFFFFF", fog: "#C9D2FF", glow: "rgba(200,215,255,.85)" };
const SERIF = `"Songti SC","Noto Serif SC","STSong",serif`;

// 一只白蝴蝶（四片翅、细身子），fill 半透明白
const BF = (o = 1) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 34'><defs><radialGradient id='w' cx='.5' cy='.9' r='1'><stop offset='0' stop-color='#fff'/><stop offset='.55' stop-color='#F2F5FF'/><stop offset='1' stop-color='#C9D4FF'/></radialGradient></defs><g opacity='${o}'><path d='M21 15 C17 6 10 1 5 2 C1 3 1 8 3 12 C5 16 12 17 21 16.5Z' fill='url(#w)' stroke='#fff' stroke-width='.8'/><path d='M23 15 C27 6 34 1 39 2 C43 3 43 8 41 12 C39 16 32 17 23 16.5Z' fill='url(#w)' stroke='#fff' stroke-width='.8'/><path d='M21 17.5 C15 18 10 21 10 26 C10 30 14 31 17 28.5 C19.5 26 20.6 21.5 21.3 18.5Z' fill='url(#w)' stroke='#fff' stroke-width='.8' opacity='.92'/><path d='M23 17.5 C29 18 34 21 34 26 C34 30 30 31 27 28.5 C24.5 26 23.4 21.5 22.7 18.5Z' fill='url(#w)' stroke='#fff' stroke-width='.8' opacity='.92'/><g fill='none' stroke='#AEBDFF' stroke-width='.7' opacity='.8'><path d='M20 15 C15 10 10 6 6 5'/><path d='M24 15 C29 10 34 6 38 5'/><path d='M20.5 18.5 C17 21 14 24 13 27'/><path d='M23.5 18.5 C27 21 30 24 31 27'/></g><g fill='#B9C6FF' opacity='.85'><circle cx='9' cy='8' r='1.6'/><circle cx='35' cy='8' r='1.6'/><circle cx='15' cy='25' r='1.2'/><circle cx='29' cy='25' r='1.2'/></g><ellipse cx='22' cy='18' rx='1.3' ry='7' fill='#fff'/><path d='M21.5 11.5 Q19 6 16 4.5 M22.5 11.5 Q25 6 28 4.5' fill='none' stroke='#fff' stroke-width='.8' stroke-linecap='round'/><circle cx='16' cy='4.5' r='.9' fill='#fff'/><circle cx='28' cy='4.5' r='.9' fill='#fff'/></g></svg>`;
// 底下的星尘
const DUST = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='160'>${Array.from({ length: 70 }, (_, i) => { const x = (i * 53 + (i % 5) * 17) % 200, y = (i * 37 + (i % 7) * 13) % 160, r = [0.6, 0.9, 1.2, 1.6][i % 4]; return `<circle cx='${x}' cy='${y}' r='${r}' fill='#fff' opacity='${(0.35 + (i % 6) * 0.1).toFixed(2)}'/>`; }).join("")}</svg>`;
const RING = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><circle cx='6' cy='6' r='3.4' fill='none' stroke='${C.fog}' stroke-width='1.2'/></svg>`;
const CI = inner => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='16' fill='rgba(255,255,255,.06)' stroke='#fff' stroke-width='1.5'/>${inner}</svg>`;
const I_HOUSE = CI(`<path d='M12.5 21 L20 14.5 L27.5 21 V27 H12.5Z' fill='none' stroke='#fff' stroke-width='1.5' stroke-linejoin='round'/>`);
const I_MORE = CI(`<g fill='#fff'><circle cx='13' cy='20' r='1.8'/><circle cx='20' cy='20' r='1.8'/><circle cx='27' cy='20' r='1.8'/></g>`);
// 加号＝一只小蝴蝶；发送＝一道往右飞的光
const I_PLUS = CI(`<g transform='translate(9 11) scale(.55)'>${BF().replace(/<svg[^>]*>|<\/svg>/g, "")}</g>`);
const I_SEND = CI(`<path d='M11 20 H26 M21 15 L27 20 L21 25' fill='none' stroke='#fff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/>`);
// 最右「让他回复」：一团白光，里面一个深蓝对话框
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 46 46'><circle cx='23' cy='23' r='20' fill='#fff'/><path d='M14 16 H32 Q34 16 34 18 V26 Q34 28 32 28 H22 L17 32 V28 H14 Q12 28 12 26 V18 Q12 16 14 16Z' fill='none' stroke='${C.ink}' stroke-width='2' stroke-linejoin='round'/></svg>`;

const bubble = { myBg: C.glass, myText: "#fff", myBorder: "none", charBg: "#fff", charText: C.ink, charBorder: "none", radius: 10, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 蓝夜蝴蝶 · 第一批 ───── */
[data-wk="chat"]{background:${svg(BF(.75))} right 18px top 16%/26px 20px no-repeat,${svg(BF(.6))} left 14px top 46%/20px 15px no-repeat,${svg(BF(.5))} right 30px top 62%/16px 12px no-repeat,${svg(DUST)} left bottom/200px 160px repeat-x,linear-gradient(180deg,${C.n1} 0%,${C.n2} 40%,${C.n3} 100%) !important}
[data-wk="chat"] *{font-family:${SERIF} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：不做框，透明底往下淡出，底下一道发光的细白线 */
[data-wk="chathead"]{position:relative !important;overflow:visible !important;background:linear-gradient(180deg,rgba(11,20,80,.85),rgba(11,20,80,0)) !important;border-bottom:none !important;box-shadow:none !important;gap:6px !important;z-index:5 !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:8% !important;right:8% !important;bottom:0 !important;height:1px !important;background:linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent) !important;box-shadow:0 0 8px rgba(200,215,255,.9) !important;pointer-events:none !important}
[data-wk="headink"],[data-wk="headink"] *{color:#fff !important}
[data-wk="headname"] > [data-wk="headink"]{font-weight:700 !important;letter-spacing:.15em !important;text-shadow:0 0 8px rgba(200,215,255,.7) !important}
[data-wk="headdim"]{color:${C.fog} !important;white-space:nowrap !important}
[data-wk="chatback"],[data-wk="chatback"] *{color:#fff !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:#fff !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{flex:none !important;width:34px !important;min-width:34px !important;height:34px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important;filter:drop-shadow(0 0 5px rgba(200,215,255,.7)) !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chathead"] + *:not([data-wk="body"]),[data-wk="chathead"] + *:not([data-wk="body"]) *{color:#fff !important}

/* 头像：泡在一团白光里，一圈白边，左上右下各停一只小蝴蝶 */
button[data-wk="avatar"],span[data-wk="avatar"],[data-wk="rpsingle"] [data-wk="avatar"]{position:relative !important;overflow:visible !important;border-radius:50% !important;box-shadow:0 0 0 3px #fff,0 0 16px 5px rgba(200,215,255,.75) !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{border-radius:50% !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;left:-18% !important;top:-20% !important;width:52% !important;height:40% !important;background:${svg(BF())} center/contain no-repeat !important;transform:rotate(-14deg) !important;pointer-events:none !important;z-index:2 !important;filter:drop-shadow(0 0 4px rgba(200,215,255,.9)) !important;border:none !important;border-radius:0 !important}
button[data-wk="avatar"]::after,span[data-wk="avatar"]:not([data-halo])::after{content:"" !important;position:absolute !important;right:-14% !important;bottom:-10% !important;width:38% !important;height:29% !important;background:${svg(BF(.9))} center/contain no-repeat !important;transform:rotate(-14deg) !important;pointer-events:none !important;z-index:2 !important;filter:drop-shadow(0 0 4px rgba(200,215,255,.9)) !important}
[data-wk="chathead"] button[data-wk="avatar"]::before,[data-wk="chathead"] span[data-wk="avatar"]::before,[data-wk="chathead"] button[data-wk="avatar"]::after,[data-wk="chathead"] span[data-wk="avatar"]::after{content:none !important}
[data-wk="chathead"] img[data-wk="avatar"]{box-shadow:0 0 0 2.5px #fff,0 0 12px 3px rgba(200,215,255,.7) !important}

/* 他的话：过曝的一团白光——纯白底、深蓝字、外面一大圈光晕；一串第一条右上角停一只蝴蝶 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:10px !important;letter-spacing:.12em !important;padding:12px 22px !important}
[data-wk="bubble"][data-kind="text"]::before,[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:#fff !important;color:${C.ink} !important;border:none !important;box-shadow:0 0 0 3px rgba(255,255,255,.55),0 0 22px 6px rgba(200,215,255,.7),0 0 46px 10px rgba(140,165,255,.35) !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="0"]::after{content:"" !important;position:absolute !important;right:-16px !important;top:-14px !important;width:30px !important;height:23px !important;background:${svg(BF())} center/contain no-repeat !important;transform:rotate(14deg) !important;filter:drop-shadow(0 0 5px rgba(200,215,255,.95)) !important;animation:bbFlap 2.6s ease-in-out infinite !important}
@keyframes bbFlap{0%,100%{transform:rotate(14deg) scaleX(1)}50%{transform:rotate(14deg) scaleX(.72)}}
/* 我的话：深蓝玻璃，镶一圈白光，左上停一只蝴蝶 */
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,rgba(40,60,200,.9),rgba(26,42,158,.92)) !important;color:#fff !important;border:2px solid #fff !important;box-shadow:inset 0 0 12px rgba(200,215,255,.45),0 0 14px 2px rgba(200,215,255,.7) !important;text-shadow:0 0 6px rgba(200,215,255,.6) !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="1"]::before{content:"" !important;position:absolute !important;left:-14px !important;top:-14px !important;width:30px !important;height:23px !important;background:${svg(BF())} center/contain no-repeat !important;transform:rotate(-14deg) !important;filter:drop-shadow(0 0 5px rgba(200,215,255,.95)) !important;border:none !important}

/* 时间：一行带光的白字 */
[data-wk="time"] > span{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.fog} !important;letter-spacing:.3em !important;font-size:11.5px !important;text-shadow:0 0 6px rgba(200,215,255,.6) !important}
/* 已送达＝后面一个空心小圈；已读＝后面一只发光的小蝴蝶 */
[data-wk="meta"]{color:${C.fog} !important;font-size:11px !important;letter-spacing:.12em !important;display:inline-flex !important;align-items:center !important;gap:8px !important}
[data-wk="meta"]::after{content:"" !important;width:11px !important;height:11px !important;flex:none !important;background:${svg(RING)} center/contain no-repeat !important}
[data-wk="meta"][data-read="1"]::after{width:18px !important;height:14px !important;background:${svg(BF())} center/contain no-repeat !important;filter:drop-shadow(0 0 4px rgba(200,215,255,.95)) !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:#fff !important;border:none !important;border-radius:10px !important;box-shadow:0 0 20px 5px rgba(200,215,255,.6) !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.ink} !important}
[data-wk="name"]{color:${C.fog} !important}

/* 动描：没有框，淡蓝白斜体，带一点光，开头停一只小蝴蝶 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"],[data-wk="myactink"]{position:relative !important;display:block !important;background:transparent !important;border:none !important;border-radius:0 !important;box-shadow:none !important;color:${C.fog} !important;font-style:italic !important;font-size:13px !important;line-height:1.9 !important;letter-spacing:.1em !important;text-shadow:0 0 8px rgba(200,215,255,.55) !important;padding:2px 0 2px 26px !important}
[data-wk="narrink"]::before,[data-wk="myactink"]::before{content:"" !important;position:absolute !important;left:0 !important;top:5px !important;width:18px !important;height:14px !important;background:${svg(BF(.9))} center/contain no-repeat !important}
[data-wk="myactink"]{padding:2px 26px 2px 0 !important;text-align:right !important}
[data-wk="myactink"]::before{left:auto !important;right:0 !important}
[data-wk="narrbar"]{background:rgba(11,20,80,.92) !important;border-top:1px solid rgba(255,255,255,.4) !important}
[data-wk="narrkind"]{border:1px solid rgba(255,255,255,.5) !important;border-radius:999px !important;background:transparent !important;color:${C.fog} !important}
[data-wk="narrkind"][data-on="1"]{background:#fff !important;border-color:#fff !important;color:${C.ink} !important}
/* 系统提示 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.1em !important}
[data-wk="sysnoteclose"]{color:${C.fog} !important}

/* 底栏：不做框，透明底往上淡出，上沿一道发光细线；输入框是一块淡蓝玻璃；最右「让他回复」是一团白光 */
[data-wk="composer"]{position:relative !important;background:linear-gradient(180deg,rgba(30,47,184,0),rgba(19,32,138,.85)) !important;border-top:none !important;box-shadow:none !important;align-items:center !important;gap:10px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:8% !important;right:8% !important;top:0 !important;height:1px !important;background:linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent) !important;box-shadow:0 0 8px rgba(200,215,255,.9) !important;pointer-events:none !important}
[data-wk="chatinput"]{background:rgba(255,255,255,.1) !important;border:1px solid rgba(255,255,255,.55) !important;border-radius:12px !important;color:#fff !important;letter-spacing:.1em !important}
[data-wk="chatinput"]::placeholder{color:${C.fog} !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{width:34px !important;min-width:34px !important;height:34px !important;background:${svg(I_PLUS)} center/contain no-repeat !important;filter:drop-shadow(0 0 5px rgba(200,215,255,.7)) !important}
[data-wk="send"]{width:34px !important;min-width:34px !important;height:34px !important;background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important;filter:drop-shadow(0 0 5px rgba(200,215,255,.7)) !important}
[data-wk="chatreply"]{width:46px !important;min-width:46px !important;height:46px !important;border-radius:50% !important;background:${svg(I_REPLY)} center/contain no-repeat !important;filter:drop-shadow(0 0 12px rgba(200,215,255,.95)) !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.9) !important}
[data-wk="chatpanel"]{background:rgba(11,20,80,.95) !important;border-top:1px solid rgba(255,255,255,.4) !important}
[data-wk="quotedraft"]{position:relative !important;z-index:3 !important}
/* 头像上的蝴蝶：他那边往右歪，我这边往左歪 */
[data-wk="msg"][data-me="0"] button[data-wk="avatar"]::before,[data-wk="msg"][data-me="0"] button[data-wk="avatar"]::after,[data-wk="msg"][data-me="0"] span[data-wk="avatar"]::before,[data-wk="msg"][data-me="0"] span[data-wk="avatar"]::after,[data-wk="cardrow"]:not([data-me="1"]) [data-wk="avatar"]::before,[data-wk="cardrow"]:not([data-me="1"]) [data-wk="avatar"]::after{transform:rotate(14deg) !important}
[data-wk="msg"][data-me="1"] [data-wk="avatar"]::before,[data-wk="msg"][data-me="1"] [data-wk="avatar"]::after,[data-wk="cardrow"][data-me="1"] [data-wk="avatar"]::before,[data-wk="cardrow"][data-me="1"] [data-wk="avatar"]::after{transform:rotate(-14deg) !important}
`;

const pack = { kind: "chat-look", v: 1, name: "蓝夜蝴蝶", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "蓝夜蝴蝶-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
