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
// 主页＝一朵蝴蝶会停的小花；更多＝三只萤火（带光晕的小点）；发送＝一只往右飞、拖着光尾的小蝴蝶
const I_HOUSE = CI(`<g fill='#fff'>${[0,72,144,216,288].map(a=>`<ellipse cx='20' cy='13.5' rx='3.4' ry='5.4' transform='rotate(${a} 20 20)' opacity='.95'/>`).join('')}</g><circle cx='20' cy='20' r='2.8' fill='#9FB2FF'/>`);
const I_MORE = CI(`${[13,20,27].map(x=>`<circle cx='${x}' cy='20' r='4' fill='#fff' opacity='.25'/><circle cx='${x}' cy='20' r='1.8' fill='#fff'/>`).join('')}`);
const I_SEND = CI(`<path d='M8 24 Q13 22 17 21' stroke='#fff' stroke-width='1.2' stroke-linecap='round' opacity='.45'/><path d='M9 20 Q14 19.5 18 20' stroke='#fff' stroke-width='1.4' stroke-linecap='round' opacity='.7'/><g transform='translate(17 11) scale(.42) rotate(20 22 17)'>${BF().replace(/<svg[^>]*>|<\/svg>/g, "")}</g>`);
// 加号＝一只小蝴蝶；发送＝一道往右飞的光
const I_PLUS = CI(`<g transform='translate(9 11) scale(.55)'>${BF().replace(/<svg[^>]*>|<\/svg>/g, "")}</g>`);
// 最右「让他回复」：一团白光，里面一个深蓝对话框
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 46 46'><circle cx='23' cy='23' r='20' fill='#fff'/><path d='M14 16 H32 Q34 16 34 18 V26 Q34 28 32 28 H22 L17 32 V28 H14 Q12 28 12 26 V18 Q12 16 14 16Z' fill='none' stroke='${C.ink}' stroke-width='2' stroke-linejoin='round'/></svg>`;

// ── 第二批用的图 ──
const BFIN = (o=1) => BF(o).replace(/<svg[^>]*>|<\/svg>/g, "");
// 标本盒：玻璃盒里钉着一只蝴蝶；open＝盖子掀开、蝴蝶飞出盒外；empty＝空盒
const BOX = st => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><rect x='6' y='14' width='48' height='40' rx='4' fill='rgba(255,255,255,.08)' stroke='#fff' stroke-width='1.6'/><rect x='10' y='18' width='40' height='32' rx='2' fill='none' stroke='rgba(255,255,255,.45)' stroke-width='1'/>${st === "open" ? `<path d='M6 14 L18 2 L60 2 L54 14' fill='rgba(255,255,255,.1)' stroke='#fff' stroke-width='1.4' stroke-linejoin='round'/><g transform='translate(30 -2) rotate(-18) scale(.6)'>${BFIN()}</g>` : st === "empty" ? `<path d='M30 26 V38' stroke='rgba(255,255,255,.5)' stroke-width='1'/><circle cx='30' cy='26' r='1.4' fill='rgba(255,255,255,.6)'/>` : `<g transform='translate(15 20) scale(.7)'>${BFIN()}</g><circle cx='30' cy='26' r='1.4' fill='#E8ECFF'/>`}</svg>`;
// 茧：一颗发光的茧；done＝茧裂开，蝴蝶飞出来
const COCOON = done => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 64'><path d='M30 2 V10' stroke='#fff' stroke-width='1.2'/><path d='M30 10 C18 12 16 30 20 44 C24 58 36 58 40 44 C44 30 42 12 30 10Z' fill='${done ? "rgba(255,255,255,.12)" : "#fff"}' stroke='#fff' stroke-width='1.6'/>${done ? `<path d='M22 26 L26 22 L30 27 L34 21 L38 26' fill='none' stroke='#fff' stroke-width='1.4' stroke-linejoin='round'/><g transform='translate(18 -4) scale(.75) rotate(-12)'>${BFIN()}</g>` : `<g fill='none' stroke='#C9D4FF' stroke-width='1'><path d='M22 22 Q30 26 38 22'/><path d='M20 32 Q30 36 40 32'/><path d='M22 42 Q30 46 38 42'/></g>`}</svg>`;
const CARD = `background:rgba(26,42,158,.55) !important;border:1.6px solid #fff !important;border-radius:14px !important;box-shadow:inset 0 0 12px rgba(200,215,255,.35),0 0 14px 2px rgba(200,215,255,.55) !important;color:#fff !important`;

// 好感：一只大蝴蝶，身子不动，两边翅膀按好感张开（低＝合拢，高＝完全展开）
const WINGS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 34'><defs><radialGradient id='w' cx='.5' cy='.9' r='1'><stop offset='0' stop-color='#fff'/><stop offset='.55' stop-color='#F2F5FF'/><stop offset='1' stop-color='#C9D4FF'/></radialGradient></defs><path d='M21 15 C17 6 10 1 5 2 C1 3 1 8 3 12 C5 16 12 17 21 16.5Z' fill='url(#w)' stroke='#fff' stroke-width='.8'/><path d='M23 15 C27 6 34 1 39 2 C43 3 43 8 41 12 C39 16 32 17 23 16.5Z' fill='url(#w)' stroke='#fff' stroke-width='.8'/><path d='M21 17.5 C15 18 10 21 10 26 C10 30 14 31 17 28.5 C19.5 26 20.6 21.5 21.3 18.5Z' fill='url(#w)' stroke='#fff' stroke-width='.8' opacity='.92'/><path d='M23 17.5 C29 18 34 21 34 26 C34 30 30 31 27 28.5 C24.5 26 23.4 21.5 22.7 18.5Z' fill='url(#w)' stroke='#fff' stroke-width='.8' opacity='.92'/><g fill='#B9C6FF' opacity='.85'><circle cx='9' cy='8' r='1.6'/><circle cx='35' cy='8' r='1.6'/><circle cx='15' cy='25' r='1.2'/><circle cx='29' cy='25' r='1.2'/></g></svg>`;
const BODY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 34'><ellipse cx='22' cy='18' rx='1.5' ry='7.5' fill='#fff'/><path d='M21.5 11.5 Q19 6 16 4.5 M22.5 11.5 Q25 6 28 4.5' fill='none' stroke='#fff' stroke-width='.9' stroke-linecap='round'/><circle cx='16' cy='4.5' r='1' fill='#fff'/><circle cx='28' cy='4.5' r='1' fill='#fff'/></svg>`;
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
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="0"]::after{content:"" !important;position:absolute !important;right:-16px !important;top:-14px !important;width:30px !important;height:23px !important;background:${svg(BF())} center/contain no-repeat !important;transform:rotate(-14deg) !important;filter:drop-shadow(0 0 5px rgba(200,215,255,.95)) !important;animation:bbFlap 2.6s ease-in-out infinite !important}
@keyframes bbFlap{0%,100%{transform:rotate(-14deg) scaleX(1)}50%{transform:rotate(-14deg) scaleX(.72)}}
/* 我的话：深蓝玻璃，镶一圈白光，左上停一只蝴蝶 */
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,rgba(40,60,200,.9),rgba(26,42,158,.92)) !important;color:#fff !important;border:2px solid #fff !important;box-shadow:inset 0 0 12px rgba(200,215,255,.45),0 0 14px 2px rgba(200,215,255,.7) !important;text-shadow:0 0 6px rgba(200,215,255,.6) !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="1"]::before{content:"" !important;position:absolute !important;left:-14px !important;top:-14px !important;width:30px !important;height:23px !important;background:${svg(BF())} center/contain no-repeat !important;transform:rotate(14deg) !important;filter:drop-shadow(0 0 5px rgba(200,215,255,.95)) !important;border:none !important}

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
[data-wk="chatreply"]{position:relative !important;overflow:visible !important;width:46px !important;min-width:46px !important;height:46px !important;border-radius:50% !important;background:${svg(I_REPLY)} center/contain no-repeat !important;filter:drop-shadow(0 0 12px rgba(200,215,255,.95)) !important}
[data-wk="chatreply"]::after{content:"" !important;position:absolute !important;right:-8px !important;top:-8px !important;width:20px !important;height:15px !important;background:${svg(BF())} center/contain no-repeat !important;transform:rotate(14deg) !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.9) !important}
[data-wk="chatpanel"]{background:rgba(11,20,80,.95) !important;border-top:1px solid rgba(255,255,255,.4) !important}
[data-wk="quotedraft"]{position:relative !important;z-index:3 !important}
/* 头像上的蝴蝶（照参考）：他的停在头像右上和左下、往左歪；我的停在左上和右下、往右歪 */
[data-wk="msg"][data-me="0"] [data-wk="avatar"]::before,[data-wk="cardrow"]:not([data-me="1"]) [data-wk="avatar"]::before{left:auto !important;right:-18% !important;transform:rotate(-14deg) !important}
[data-wk="msg"][data-me="0"] [data-wk="avatar"]::after,[data-wk="cardrow"]:not([data-me="1"]) [data-wk="avatar"]::after{right:auto !important;left:-14% !important;transform:rotate(-14deg) !important}
[data-wk="msg"][data-me="1"] [data-wk="avatar"]::before,[data-wk="msg"][data-me="1"] [data-wk="avatar"]::after,[data-wk="cardrow"][data-me="1"] [data-wk="avatar"]::before,[data-wk="cardrow"][data-me="1"] [data-wk="avatar"]::after{transform:rotate(14deg) !important}

/* ───── 蓝夜蝴蝶 · 第二批：卡片 ───── */
[data-wk="voice"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{${CARD}}
[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:#fff !important;border-color:rgba(255,255,255,.35) !important}

/* 转账＝一只蝴蝶标本盒：玻璃盒里钉着一只蝴蝶；收下了盒盖掀开、蝴蝶飞出来，退回了盒子空了 */
[data-wk="transfercard"]{position:relative !important;overflow:visible !important;${CARD};padding-left:66px !important}
[data-wk="transfercard"]::before{content:"" !important;position:absolute !important;left:10px !important;top:50% !important;width:50px !important;height:50px !important;margin-top:-28px !important;background:${svg(BOX("full"))} center/contain no-repeat !important;filter:drop-shadow(0 0 6px rgba(200,215,255,.8)) !important}
[data-wk="transfercard"] *{color:#fff !important;border-color:rgba(255,255,255,.35) !important}
[data-wk="transferlabel"]{color:${C.fog} !important;letter-spacing:.2em !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:#fff !important;font-weight:700 !important;text-shadow:0 0 10px rgba(200,215,255,.9) !important}
[data-wk="transferrule"]{border:none !important;height:1px !important;background:linear-gradient(90deg,transparent,rgba(255,255,255,.8),transparent) !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:rgba(11,20,80,.4) !important}
[data-wk="transferbtn"]{border-radius:999px !important}
[data-wk="transferbtn"][data-part="take"]{background:#fff !important;color:${C.ink} !important;border:none !important;box-shadow:0 0 12px rgba(200,215,255,.8) !important}
[data-wk="transferbtn"][data-part="back"]{background:transparent !important;color:#fff !important;border:1px solid rgba(255,255,255,.7) !important}
[data-wk="transferseal"]{background:transparent !important;border:1px solid rgba(255,255,255,.7) !important;color:#fff !important;border-radius:50% !important;box-shadow:none !important}
[data-wk="transfercard"][data-status="accepted"]::before{background:${svg(BOX("open"))} center/contain no-repeat !important}
[data-wk="transfercard"][data-status="returned"]::before{background:${svg(BOX("empty"))} center/contain no-repeat !important;filter:none !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.7 !important}

/* 红包＝一颗发光的茧；领完了茧裂开，飞出一只蝴蝶 */
[data-wk="rpcard"]{position:relative !important;overflow:visible !important;width:220px !important;min-height:84px !important;padding:16px 16px 16px 80px !important;${CARD}}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:56px !important;height:60px !important;margin-top:-32px !important;background:${svg(COCOON(false))} center/contain no-repeat !important;filter:drop-shadow(0 0 10px rgba(200,215,255,.9)) !important}
[data-wk="rpcard"]::after{content:"一颗茧" !important;position:absolute !important;right:12px !important;bottom:6px !important;font-size:10px !important;letter-spacing:.25em !important;color:${C.fog} !important}
[data-wk="rpcard"] *{color:#fff !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"] > div:not([data-wk]){padding:0 !important;background:transparent !important}
[data-wk="rpmsg"]{-webkit-line-clamp:2 !important}
[data-wk="rpcard"][data-status="done"]::before{background:${svg(COCOON(true))} center/contain no-repeat !important}
[data-wk="rpcard"][data-status="done"]::after{content:"飞走啦" !important}
[data-wk="rpenvelope"][data-stage="closed"],[data-wk="rpenvelope"][data-stage="open"]{background:${svg(DUST)} left bottom/200px 160px repeat-x,linear-gradient(180deg,${C.n1},${C.n2} 50%,${C.n3}) !important;border:2px solid #fff !important;border-radius:24px !important;box-shadow:0 0 30px 6px rgba(200,215,255,.5) !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:#fff !important;border-color:#fff !important;box-shadow:0 0 20px rgba(200,215,255,.8) !important}
[data-wk="rpenvelope"] [data-wk="rparc"]::after{content:none !important}
[data-wk="rpenvelope"] *{color:#fff !important}
[data-wk="rpenvelope"] [data-wk="rparc"] *{color:${C.ink} !important}
[data-wk="rpopenbtn"]{background:${svg(COCOON(false))} center/70% no-repeat,radial-gradient(circle,rgba(26,42,158,.9) 55%,#fff 57%,#fff 62%,transparent 64%) !important;border:none !important;box-shadow:none !important;filter:drop-shadow(0 0 14px rgba(200,215,255,.95)) !important}
[data-wk="rpopenbtn"],[data-wk="rpopenbtn"] *{color:transparent !important;font-size:0 !important}
[data-wk="rpavatar"]{border-radius:50% !important;box-shadow:0 0 0 3px #fff,0 0 14px 4px rgba(200,215,255,.8) !important}
[data-wk="rpamount"]{color:#fff !important;background:none !important;text-shadow:0 0 12px rgba(200,215,255,.9) !important}
[data-wk="rpclose"]{background:transparent !important;border:1.5px solid #fff !important;color:#fff !important}

/* 照片：镶一圈白光，右上角停一只蝴蝶 */
[data-wk="photocard"]{position:relative !important;overflow:visible !important;background:#fff !important;border:none !important;border-radius:12px !important;padding:8px 8px 24px !important;box-shadow:0 0 22px 6px rgba(200,215,255,.6) !important}
[data-wk="photocard"]::after{content:"" !important;position:absolute !important;right:-14px !important;top:-14px !important;width:32px !important;height:24px !important;background:${svg(BF())} center/contain no-repeat !important;transform:rotate(-14deg) !important;filter:drop-shadow(0 0 5px rgba(200,215,255,.95)) !important}
[data-wk="photoface"]{background:linear-gradient(180deg,${C.n2},${C.n3}) !important;border:none !important;border-radius:8px !important}
[data-wk="photoface"] *,[data-wk="phototext"]{color:#fff !important}
[data-wk="photocap"],[data-wk="photohint"]{color:${C.ink} !important}

/* 语音：前面一只小蝴蝶 */
[data-wk="voice"] > *{background:transparent !important;box-shadow:none !important;border:none !important;color:#fff !important}
[data-wk="voice"][data-me]{padding:0 14px 0 40px !important;position:relative !important;border-radius:999px !important}
[data-wk="voice"]::before{content:"" !important;position:absolute !important;left:10px !important;top:50% !important;width:22px !important;height:17px !important;margin-top:-9px !important;background:${svg(BF())} center/contain no-repeat !important;z-index:2 !important;animation:bbFlap 2.6s ease-in-out infinite !important}
[data-wk="voice"][data-me="0"]{background:#fff !important;box-shadow:0 0 18px 4px rgba(200,215,255,.6) !important}
[data-wk="voice"][data-me="0"] *{color:${C.ink} !important}
[data-wk="voice"][data-me="0"]::before{filter:drop-shadow(0 0 1px ${C.ink}) drop-shadow(0 0 1px ${C.ink}) !important}
[data-wk="voicewave"] span{background:#fff !important}
[data-wk="voice"][data-me="0"] [data-wk="voicewave"] span{background:${C.ink} !important}

[data-wk="wxcardsky"]{background:${svg(DUST)} left bottom/200px 160px repeat-x,linear-gradient(170deg,${C.n1},${C.n3}) !important}
[data-wk="wxcardsky"] *{color:#fff !important}
[data-wk="wxcardsky"] svg{stroke:#fff !important}
[data-wk="wxcardsay"]{background:rgba(11,20,80,.5) !important;color:#fff !important;border-top:1px solid rgba(255,255,255,.4) !important}
/* 位置：一只蝴蝶停在那儿 */
[data-wk="geopin"]{background:${svg(BF())} center/contain no-repeat !important;box-shadow:none !important;border:none !important;width:34px !important;height:26px !important;border-radius:0 !important;filter:drop-shadow(0 0 6px rgba(200,215,255,.95)) !important}
[data-wk="geopin"] *{opacity:0 !important}
[data-wk="geopinstem"]{background:#fff !important}
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 2.5px #fff,0 0 12px 3px rgba(200,215,255,.7) !important}

/* 拍一拍、通话结束：一行带光的小字，两头各一点光 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:radial-gradient(circle,#fff 1.6px,transparent 2.2px) left center/8px 8px no-repeat,radial-gradient(circle,#fff 1.6px,transparent 2.2px) right center/8px 8px no-repeat !important;border:none !important;border-radius:0 !important;padding:2px 18px !important;color:${C.fog} !important;box-shadow:none !important;text-shadow:0 0 6px rgba(200,215,255,.6) !important}
[data-wk="note"][data-part="call"] svg{stroke:#fff !important}
[data-wk="note"][data-part="callsum"]{display:block !important;margin:6px auto 0 !important;max-width:86% !important;background:rgba(26,42,158,.5) !important;border:none !important;border-left:3px solid #fff !important;border-radius:4px 12px 12px 4px !important;padding:8px 14px !important;color:#fff !important;box-shadow:0 0 12px rgba(200,215,255,.4) !important}
[data-wk="noteink"]{color:${C.fog} !important}

/* 线下小结：一封发光的信，标题是白光小签 */
[data-part="offlog"]{position:relative !important;overflow:visible !important;padding-top:28px !important}
[data-part="offlog"]::after{content:"" !important;position:absolute !important;right:-12px !important;top:-12px !important;width:30px !important;height:23px !important;background:${svg(BF())} center/contain no-repeat !important;transform:rotate(-14deg) !important;filter:drop-shadow(0 0 5px rgba(200,215,255,.95)) !important}
[data-wk="offlogtitle"]{display:inline-block !important;margin:0 0 6px !important;padding:3px 14px !important;background:#fff !important;color:${C.ink} !important;border-radius:999px !important;box-shadow:0 0 12px rgba(200,215,255,.8) !important;letter-spacing:.15em !important}
[data-wk="offlogtitle"] *{color:${C.ink} !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.fog} !important}
[data-wk="offlogtranscript"]{border-top:1px solid rgba(255,255,255,.35) !important;color:${C.fog} !important}

/* 加号面板：一颗颗发光的白圈 */
[data-wk="chatpanel"] *{color:#fff !important}
[data-wk="chattoolicon"]{background:rgba(255,255,255,.08) !important;border:1.5px solid #fff !important;border-radius:50% !important;box-shadow:0 0 10px rgba(200,215,255,.6) !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:#fff !important;color:#fff !important}
[data-wk="chattoollabel"]{color:${C.fog} !important}

/* 引用三处 */
[data-wk="quotedraft"]{background:rgba(11,20,80,.92) !important;border:none !important;border-top:1px solid rgba(255,255,255,.4) !important}
[data-wk="quotedraft"] *{color:${C.fog} !important;border-color:#fff !important}
[data-wk="quoteicon"]{display:none !important}
[data-wk="quoteclear"]{color:#fff !important}
[data-wk="quote"]{background:rgba(255,255,255,.1) !important;color:${C.fog} !important;border:1px solid rgba(255,255,255,.4) !important;border-radius:10px !important;padding:3px 10px !important;opacity:1 !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid currentColor !important;padding-left:8px !important;opacity:.7 !important}

/* 打电话那一屏 */
[data-wk="call"][data-video="0"]{background:${svg(DUST)} left bottom/200px 160px repeat-x,radial-gradient(circle at 50% 24%,rgba(200,215,255,.35),transparent 50%),linear-gradient(180deg,${C.n1},${C.n2} 50%,${C.n3}) !important}
[data-wk="call"][data-video="0"] [data-wk="calltitle"]{color:#fff !important;text-shadow:0 0 10px rgba(200,215,255,.8) !important}
[data-wk="call"][data-video="0"] [data-wk="callhead"] > div:not([data-wk]){color:${C.fog} !important}
[data-wk="call"][data-video="0"] > button:first-child{background:transparent !important;box-shadow:0 0 0 1.5px #fff,0 0 10px rgba(200,215,255,.6) !important}
[data-wk="call"][data-video="0"] > button:first-child svg{stroke:#fff !important}
[data-wk="callbtns"] button > span:first-child{background:rgba(255,255,255,.08) !important;border-radius:50% !important;box-shadow:0 0 0 1.5px #fff,0 0 14px rgba(200,215,255,.7) !important}
[data-wk="callbtns"] button > span:first-child svg{stroke:#fff !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child{background:#fff !important;box-shadow:0 0 22px 6px rgba(200,215,255,.8) !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child svg{stroke:${C.ink} !important}
[data-wk="call"][data-video="0"] [data-wk="callbtns"] button > span:last-child{color:${C.fog} !important}
[data-wk="callbubble"]{background:#fff !important;color:${C.ink} !important;border:none !important;border-radius:10px !important;box-shadow:0 0 16px 4px rgba(200,215,255,.6) !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:rgba(26,42,158,.9) !important;color:#fff !important;border:1.5px solid #fff !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="callbubble"][data-kind="typing"] [data-wk="typingdot"]{background:${C.ink} !important}
[data-wk="callact"]{color:${C.fog} !important;font-style:italic !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:0 0 0 4px #fff,0 0 40px 12px rgba(200,215,255,.7) !important}
/* ───── 蓝夜蝴蝶 · 第三批：状态卡＝夜里一扇发光的窗，好感是一只按好感张开翅膀的蝴蝶 ───── */
[data-wk="statecard"]{position:relative !important;overflow:visible !important;background:${svg(DUST)} left bottom/200px 160px repeat-x,linear-gradient(180deg,${C.n1},${C.n2} 55%,${C.n3}) !important;border:2px solid #fff !important;border-radius:22px !important;box-shadow:0 0 30px 6px rgba(200,215,255,.45) !important}
[data-wk="statecard"]::before{content:"" !important;position:absolute !important;right:-16px !important;top:-16px !important;width:40px !important;height:31px !important;background:${svg(BF())} center/contain no-repeat !important;transform:rotate(-14deg) !important;filter:drop-shadow(0 0 6px rgba(200,215,255,.95)) !important;z-index:3 !important}
[data-wk="statehead"]{background:transparent !important;border-bottom:1px solid rgba(255,255,255,.35) !important}
[data-wk="statehead"] *{color:#fff !important}
[data-wk="statehead"] [data-wk="avatar"]::before,[data-wk="statehead"] [data-wk="avatar"]::after{content:none !important}
[data-wk="statehead"] button{border:1.5px solid #fff !important;background:transparent !important;border-radius:50% !important}
[data-wk="statemood"]{display:inline-block !important;background:#fff !important;color:${C.ink} !important;border:none !important;border-radius:999px !important;padding:0 10px !important;margin-right:4px !important;box-shadow:0 0 8px rgba(200,215,255,.7) !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:rgba(255,255,255,.08) !important;border:1px solid rgba(255,255,255,.5) !important;border-radius:999px !important;padding:3px !important;margin:10px 16px !important}
[data-wk="statecard"] button[aria-pressed]{color:${C.fog} !important;border:none !important;border-radius:999px !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:#fff !important;color:${C.ink} !important;box-shadow:0 0 10px rgba(200,215,255,.8) !important}
/* 看得见的＝一团白光；心里想的＝深蓝玻璃、带光的斜体字 */
[data-wk="stateseen"]{background:#fff !important;border:none !important;border-radius:14px !important;margin:12px 16px !important;color:${C.ink} !important;box-shadow:0 0 18px 4px rgba(200,215,255,.55) !important}
[data-wk="stateseen"] *{color:${C.ink} !important}
[data-wk="statevoice"]{background:rgba(26,42,158,.6) !important;border:1.5px solid #fff !important;border-radius:14px !important;margin:14px 16px !important;box-shadow:inset 0 0 12px rgba(200,215,255,.35) !important;font-style:italic !important}
[data-wk="statevoice"] *{color:#fff !important;text-shadow:0 0 6px rgba(200,215,255,.6) !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:rgba(34,53,168,.08) !important;border:1px solid rgba(34,53,168,.25) !important;border-radius:999px !important}
[data-wk="statewear"] > span{background:transparent !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:${C.fog} !important}
[data-wk="statevoice"] + div > button{background:transparent !important;color:#fff !important;border:1px solid #fff !important;border-radius:999px !important}
/* 好感：一只大蝴蝶，好感越高翅膀张得越开（低分几乎合拢成一条，满分完全展开） */
[data-wk="stateaff"]{background:transparent !important;border-top:1px solid rgba(255,255,255,.35) !important;display:flex !important;align-items:center !important;gap:16px !important;padding:14px 20px 18px !important}
[data-wk="stateaff"] *{color:#fff !important}
[data-wk="stateheart"]{position:relative !important;width:80px !important;height:62px !important;flex:none !important;background:${svg(BODY)} center/contain no-repeat !important;filter:drop-shadow(0 0 8px rgba(200,215,255,.9)) !important}
[data-wk="stateheart"] > div{display:none !important}
[data-wk="stateheartknob"]{display:block !important;position:absolute !important;inset:0 !important;left:0 !important;bottom:0 !important;width:auto !important;height:auto !important;margin:0 !important;background:${svg(WINGS)} center/contain no-repeat !important;transform-origin:50% 50% !important;transform:scaleX(calc(.12 + var(--sc-heart-lvl) * .88)) !important;opacity:calc(.55 + var(--sc-heart-lvl) * .45) !important;z-index:-1 !important}
[data-wk="stateheartnum"]{display:none !important}
[data-wk="stateaffval"]{display:inline-block !important;margin:0 0 6px !important;padding:1px 12px !important;background:#fff !important;border-radius:999px !important;color:${C.ink} !important;font-weight:700 !important;font-size:14px !important;box-shadow:0 0 10px rgba(200,215,255,.8) !important}
/* 翻旧的：一张张深蓝玻璃卡，角上停一只小蝴蝶 */
[data-wk="statehistbtn"]{background:transparent !important;color:#fff !important;border:1px solid #fff !important;border-radius:999px !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 16px !important}
[data-wk="statehisthead"] > :first-child{color:${C.fog} !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{border:1px solid #fff !important;border-radius:999px !important;color:#fff !important;background:transparent !important}
[data-wk="statehistitem"]{position:relative !important;background:rgba(26,42,158,.55) !important;border:1.5px solid rgba(255,255,255,.8) !important;border-radius:14px !important;padding:16px 18px 14px !important;margin:0 0 16px !important;box-shadow:0 0 12px rgba(200,215,255,.4) !important;overflow:visible !important}
[data-wk="statehistitem"]::before{content:"" !important;position:absolute !important;right:-10px !important;top:-10px !important;width:22px !important;height:17px !important;background:${svg(BF())} center/contain no-repeat !important;transform:rotate(-14deg) !important}
[data-wk="statehistitem"] *{color:#fff !important}
[data-wk="statehistmood"]{background:#fff !important;border:none !important;color:${C.ink} !important;border-radius:999px !important}
[data-wk="statehisttime"]{color:${C.fog} !important}
[data-wk="statehistmeta"]{background:rgba(255,255,255,.08) !important;border-radius:8px !important}
[data-wk="statehistend"]{color:${C.fog} !important}
/* Ta 眼里 */
[data-wk="gazepage"]{background:${svg(DUST)} left bottom/200px 160px repeat-x,linear-gradient(180deg,${C.n1},${C.n2} 55%,${C.n3}) !important}
[data-wk="gazetitle"]{color:#fff !important;text-shadow:0 0 10px rgba(200,215,255,.8) !important}
[data-wk="gazetab"]{background:rgba(255,255,255,.08) !important;color:${C.fog} !important;border:1px solid rgba(255,255,255,.5) !important;border-radius:999px !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:#fff !important;color:${C.ink} !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:${C.fog} !important}
[data-wk="gazecard"]{background:#fff !important;border:none !important;border-radius:14px !important;box-shadow:0 0 16px 4px rgba(200,215,255,.5) !important}
[data-wk="gazetape"]{background:${svg(BF())} center/22px 17px no-repeat !important;box-shadow:none !important;border:none !important;transform:none !important;width:26px !important;height:20px !important}
[data-wk="gazecardname"]{color:${C.ink} !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:#5A6BC8 !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{background:#fff !important;border:none !important;border-radius:16px !important;box-shadow:0 0 16px 4px rgba(200,215,255,.5) !important}
[data-wk="gazeletter"] *,[data-wk="gazehistory"] *{color:${C.ink} !important}
[data-wk="gazeempty"]{background:rgba(255,255,255,.06) !important;border:1px dashed rgba(255,255,255,.6) !important;border-radius:16px !important;color:#fff !important}
[data-wk="gazeempty"] > div:first-child{color:#fff !important}
[data-wk="gazeempty"] button{background:#fff !important;color:${C.ink} !important;border:none !important;border-radius:999px !important}
`;

const pack = { kind: "chat-look", v: 1, name: "蓝夜蝴蝶", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "蓝夜蝴蝶-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
