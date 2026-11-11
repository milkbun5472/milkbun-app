// 骨头小狗聊天美化：生成「整套聊天美化」包（chat-look），导入到某个人的聊天设置里用。
// 用法：node themes/bone-puppy/build.mjs  → 写出 themes/bone-puppy/骨头小狗-美化.json
// 配色：奶油 #fffdf8 / 奶黄 #fbe9c4 / 焦糖 #c98f55 / 描边 #D9A86C / 可可 #6b5448 / 珊瑚（红包、心情）#e8907e
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));

import { I_PLUS, I_SEND, I_REPLY, I_HOME, I_MORE } from "./icons.mjs";
const C = { cream: "#fffdf8", blue: "#fbe9c4", pink: "#f6e2c8", cocoa: "#6b5448", blueDeep: "#c98f55", pinkDeep: "#dcb185" };
// 小图（SVG）→ data URI
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const PAW = (fill, o = 1) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><g fill='${fill}' opacity='${o}'><ellipse cx='20' cy='27' rx='9' ry='7.5'/><ellipse cx='9.5' cy='17' rx='3.6' ry='4.6'/><ellipse cx='16' cy='10.5' rx='3.6' ry='4.8'/><ellipse cx='24' cy='10.5' rx='3.6' ry='4.8'/><ellipse cx='30.5' cy='17' rx='3.6' ry='4.6'/></g></svg>`;
const BONE = (fill, o = 1) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 26'><g fill='${fill}' opacity='${o}'><rect x='12' y='8' width='36' height='10' rx='5'/><circle cx='10' cy='8' r='6.5'/><circle cx='10' cy='18' r='6.5'/><circle cx='50' cy='8' r='6.5'/><circle cx='50' cy='18' r='6.5'/></g></svg>`;
// 一只耷拉下来的耳朵（左耳；右耳用 scaleX(-1) 的那份）：圆圆的、往外往下垂
const EAR = (inner, flip) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 40'><g ${flip ? "transform='translate(30 0) scale(-1 1)'" : ""}><path d='M26 4 C16 1 6 4 3 14 C0 25 4 36 12 38 C18 39 21 33 22 26 C23 19 27 12 26 4Z' fill='#ffffff' stroke='${C.cocoa}' stroke-opacity='.5' stroke-width='1.8'/><path d='M22 9 C15 8 9 11 8 18 C7 26 9 32 13 33 C16 33 18 29 19 24 C20 19 23 14 22 9Z' fill='${inner}'/></g></svg>`;
const EARS = (inner) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 70 34'><g stroke='${C.cocoa}' stroke-width='2' stroke-opacity='.55'><path d='M6 22 C2 10 8 2 18 4 C26 6 26 18 22 28 C18 34 9 31 6 22Z' fill='#ffffff'/><path d='M64 22 C68 10 62 2 52 4 C44 6 44 18 48 28 C52 34 61 31 64 22Z' fill='#ffffff'/></g><path d='M11 20 C9 13 12 8 17 9 C21 10 21 17 19 24 C17 28 13 26 11 20Z' fill='${inner}'/><path d='M59 20 C61 13 58 8 53 9 C49 10 49 17 51 24 C53 28 57 26 59 20Z' fill='${inner}'/></svg>`;
// 小狗鼻头（发送键）
const NOSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 36'><path d='M22 33 C10 33 3 25 4 16 C5 7 13 4 22 4 C31 4 39 7 40 16 C41 25 34 33 22 33Z' fill='${C.cocoa}'/><ellipse cx='15' cy='12' rx='5' ry='3' fill='#ffffff' opacity='.55'/><ellipse cx='15' cy='19' rx='2.6' ry='3.4' fill='#3e2f28'/><ellipse cx='29' cy='19' rx='2.6' ry='3.4' fill='#3e2f28'/></svg>`;
// 聊天页底纹：一格里两颗淡爪印、一根淡骨头
const DOG = `<g stroke='#D9A86C' stroke-width='3.5' stroke-linejoin='round' stroke-linecap='round'><ellipse cx='141' cy='62' rx='20' ry='34' fill='#FFF8EC' transform='rotate(22 141 62)'/><ellipse cx='259' cy='62' rx='20' ry='34' fill='#FFF8EC' transform='rotate(-22 259 62)'/><ellipse cx='139' cy='68' rx='9' ry='20' fill='#F8DDB5' stroke='none' transform='rotate(22 139 68)'/><ellipse cx='261' cy='68' rx='9' ry='20' fill='#F8DDB5' stroke='none' transform='rotate(-22 261 68)'/><ellipse cx='200' cy='70' rx='60' ry='48' fill='#FFF8EC'/><ellipse cx='158' cy='114' rx='17' ry='12' fill='#FFF8EC'/><ellipse cx='242' cy='114' rx='17' ry='12' fill='#FFF8EC'/><path d='M152 112 v8 M158 111 v9 M164 112 v8 M236 112 v8 M242 111 v9 M248 112 v8' fill='none' stroke-width='2'/></g><ellipse cx='166' cy='84' rx='10' ry='6' fill='#F5B98A' opacity='0.8'/><ellipse cx='234' cy='84' rx='10' ry='6' fill='#F5B98A' opacity='0.8'/><circle cx='178' cy='68' r='6.5' fill='#6B4A2E'/><circle cx='222' cy='68' r='6.5' fill='#6B4A2E'/><circle cx='180' cy='66' r='2.2' fill='#FFFFFF'/><circle cx='224' cy='66' r='2.2' fill='#FFFFFF'/><ellipse cx='200' cy='80' rx='7' ry='5' fill='#6B4A2E'/><path d='M200 85 v4 M200 89 q-7 7 -13 1 M200 89 q7 7 13 1' fill='none' stroke='#6B4A2E' stroke-width='2.2' stroke-linecap='round'/><path d='M195 92 q5 10 10 0 z' fill='#F2937A'/>`;
const DOG_PEEK = DOG.replace(`<circle cx='178' cy='68' r='6.5' fill='#6B4A2E'/><circle cx='222' cy='68' r='6.5' fill='#6B4A2E'/><circle cx='180' cy='66' r='2.2' fill='#FFFFFF'/><circle cx='224' cy='66' r='2.2' fill='#FFFFFF'/>`, `<circle cx='181' cy='67' r='9' fill='#6B4A2E'/><circle cx='225' cy='67' r='9' fill='#6B4A2E'/><circle cx='185' cy='62.5' r='3.4' fill='#FFFFFF'/><circle cx='229' cy='62.5' r='3.4' fill='#FFFFFF'/><circle cx='178.5' cy='71' r='1.5' fill='#FFFFFF'/><circle cx='222.5' cy='71' r='1.5' fill='#FFFFFF'/>`);
const FRAME = (ang) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 420'><circle cx='200' cy='250' r='140' fill='none' stroke='#F8E0B0' stroke-width='18'/><circle cx='200' cy='250' r='149' fill='none' stroke='#D9A86C' stroke-width='2'/><circle cx='200' cy='250' r='131' fill='none' stroke='#D9A86C' stroke-width='2'/><circle cx='200' cy='250' r='140' fill='none' stroke='#FFF8EC' stroke-width='4' stroke-dasharray='2 14' stroke-linecap='round'/><g fill='#D9A86C'><animateTransform attributeName='transform' type='rotate' from='0 200 250' to='${ang < 0 ? -360 : 360} 200 250' dur='9s' repeatCount='indefinite'/><g transform='translate(62 250) rotate(${ang < 0 ? 180 : 0})'><ellipse cx='0' cy='3' rx='6' ry='5'/><circle cx='-7' cy='-4' r='2.6'/><circle cx='0' cy='-7' r='2.6'/><circle cx='7' cy='-4' r='2.6'/></g><g transform='translate(338 250) rotate(${ang < 0 ? 0 : 180})'><ellipse cx='0' cy='3' rx='6' ry='5'/><circle cx='-7' cy='-4' r='2.6'/><circle cx='0' cy='-7' r='2.6'/><circle cx='7' cy='-4' r='2.6'/></g></g><path d='M176 384 a8 8 0 1 1 8 -8 h32 a8 8 0 1 1 8 8 a8 8 0 1 1 -8 8 h-32 a8 8 0 1 1 -8 -8 z' fill='#FFF8EC' stroke='#D9A86C' stroke-width='3' stroke-linejoin='round'/><g transform='rotate(${ang} 200 250) translate(200 118) scale(0.98) translate(-200 -110)'>${DOG}</g></svg>`;
const BONE_S = (fill = "#FFF8EC") => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='164 364 72 40'><path d='M176 384 a8 8 0 1 1 8 -8 h32 a8 8 0 1 1 8 8 a8 8 0 1 1 -8 8 h-32 a8 8 0 1 1 -8 -8 z' fill='${fill}' stroke='#c98f55' stroke-width='3.5' stroke-linejoin='round'/></svg>`;
const TILE = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><g opacity='.07'><g transform='translate(18 18) rotate(-18 20 20)'>${PAW(C.blueDeep).replace(/<\/?svg[^>]*>/g, "")}</g><g transform='translate(100 92) rotate(16 20 20)'>${PAW(C.pinkDeep).replace(/<\/?svg[^>]*>/g, "")}</g><g transform='translate(82 22) rotate(25 30 13)'>${BONE(C.cocoa).replace(/<\/?svg[^>]*>/g, "")}</g></g></svg>`;

const bubble = {
  myBg: "#fffaf0", myText: C.cocoa, myBorder: "1.5px solid rgba(201,143,85,0.7)",
  charBg: "#fae3b4", charText: C.cocoa, charBorder: "1.5px solid rgba(201,143,85,0.7)",
  radius: 22, shadow: "0 3px 0 rgba(107,84,72,0.12)", myAlpha: 100, charAlpha: 100
};

const css = `
/* ───── 骨头小狗 · 第一批：背景、顶栏、气泡、输入栏 ───── */
[data-wk="chat"]{background:${C.cream} ${svg(TILE)} repeat !important;background-size:120px 120px !important}
[data-wk="body"]{background:transparent !important;padding-top:40px !important}

/* 顶栏：奶白底，底边一排小爪印 */
[data-wk="chathead"]{background:#FFF8EC !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;z-index:5 !important;overflow:visible !important}
[data-wk="headink"]{color:${C.cocoa} !important;stroke:${C.cocoa} !important}
[data-wk="headdim"]{color:rgba(107,84,72,.6) !important}
[data-wk="chatback"] svg{stroke:${C.cocoa} !important}

/* 头像：一对垂耳，变成小狗头像框 */
[data-wk="avatar"]{position:relative !important;overflow:visible !important;border-radius:50% !important}
[data-wk="avatar"] *{border-radius:50% !important;overflow:hidden !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"]:not([data-halo]) > *,button[data-wk="avatar"] > span[data-halo] > img{width:44px !important;height:44px !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;width:70px !important;height:73.5px !important;left:calc(50% - 35px) !important;top:calc(50% - 43.75px) !important;z-index:2 !important;background:${svg(FRAME(-35))} center/contain no-repeat !important;pointer-events:none !important;animation:none !important}
span[data-wk="avatar"]:not([data-halo])::before{background:${svg(FRAME(35))} center/contain no-repeat !important}

/* 好日子那圈会转的星光：换成焦糖色暖光，框照常套（星光本身那层不画，免得框跟着转） */
[data-wk="avatar"][data-halo]::before{content:none !important;animation:none !important}
[data-wk="avatar"] [data-wk="avatar"]::before{content:none !important}
[data-wk="avatar"][data-halo]::after{inset:-14% !important;border-radius:999px !important;box-shadow:0 0 12px 3px rgba(242,180,110,.75) !important;animation:qqPuppyGlow 2.4s ease-in-out infinite !important}
@keyframes qqPuppyGlow{0%,100%{opacity:.55}50%{opacity:1}}

/* 顶栏头像：图片挂不了框，框挂在它外面那颗按钮上 */
[data-wk="chathead"] [data-wk="avatar"]{border-radius:50% !important;clip-path:circle(50%) !important}
[data-wk="chathead"] button:has(> [data-halo])::after{content:"" !important;position:absolute !important;width:44px !important;height:44px !important;left:24px !important;top:calc(50% - 22px) !important;border-radius:50% !important;box-shadow:0 0 12px 4px rgba(242,180,110,.8) !important;z-index:0 !important;pointer-events:none !important;animation:qqPuppyGlow 2.4s ease-in-out infinite !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"]){position:relative !important;overflow:visible !important;padding-left:28px !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"])::before{content:"" !important;position:absolute !important;width:57px !important;height:60px !important;left:17.6px !important;top:calc(50% - 35.5px) !important;z-index:2 !important;background:${svg(FRAME(-35))} center/contain no-repeat !important;pointer-events:none !important}
[data-wk="chathead"] button > span[data-wk="avatar"][data-halo]::before{content:none !important}

/* 文字气泡：都是淡蓝，我的更白；里面散几颗淡爪印，角上一根骨头，尾巴换成爪印 */
[data-wk="bubble"][data-kind="text"]{overflow:visible !important;background-image:${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='70' height='46' viewBox='0 0 70 46'><g opacity='.13' transform='translate(50 26) rotate(20) scale(.38)'>${PAW(C.blueDeep).replace(/<\/?svg[^>]*>/g, "")}</g><g opacity='.09' transform='translate(6 4) rotate(-15) scale(.26)'>${PAW(C.blueDeep).replace(/<\/?svg[^>]*>/g, "")}</g></svg>`)} !important;background-size:70px 46px !important;background-position:right bottom !important;background-repeat:no-repeat !important}
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;top:-7px !important;width:26px !important;height:13px !important;border:none !important;background:${svg(BONE_S())} center/contain no-repeat !important;filter:none !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{left:10px !important;right:auto !important;transform:rotate(-14deg) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{right:10px !important;left:auto !important;transform:rotate(14deg) !important}
[data-wk="bubble"][data-kind="text"]::after{content:"" !important;position:absolute !important;bottom:-9px !important;width:18px !important;height:18px !important;background:${svg(PAW(C.blueDeep, .9))} center/contain no-repeat !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{right:-7px !important;transform:rotate(20deg) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::after{left:-7px !important;transform:rotate(-20deg) !important}

/* 时间、已读：后面一根小骨头 */
[data-wk="meta"]{color:rgba(107,84,72,.55) !important}
[data-wk="meta"]::after{content:"" !important;display:inline-block !important;width:16px !important;height:8px !important;margin-left:4px !important;background:${svg(BONE(C.cocoa, .45))} center/contain no-repeat !important}

/* 输入栏：奶白底，上沿一排爪印；输入框是胶囊；发送键是小狗鼻头 */
[data-wk="composer"]{background:${C.cream} ${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='44' height='12' viewBox='0 0 44 12'><g opacity='.35' transform='translate(16 0) scale(.3)'>${PAW(C.blueDeep).replace(/<\/?svg[^>]*>/g, "")}</g></svg>`)} repeat-x top left !important;background-size:44px 12px !important;border-top:1.5px solid rgba(201,143,85,.4) !important}
[data-wk="chatinput"]{background:#ffffff !important;border:2px solid ${C.blue} !important;border-radius:999px !important;color:${C.cocoa} !important;box-shadow:inset 0 2px 0 rgba(251,233,196,.45) !important}
[data-wk="chatinput"]::placeholder{color:rgba(107,84,72,.4) !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;border-radius:0 !important;transition:transform .12s !important}
[data-wk="chatplus"] svg{opacity:0 !important}
[data-wk="chatplus"]:active{transform:scale(.86) !important}
[data-wk="send"]{background:${svg(I_SEND)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;border-radius:0 !important;transition:transform .12s !important}
[data-wk="send"] svg{opacity:0 !important}
[data-wk="send"]{transform:translateY(1px) !important}
[data-wk="send"]:active{transform:translateY(1px) scale(.86) !important}
[data-wk="chatreply"]{background:${svg(I_REPLY)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;border-radius:0 !important;transition:transform .12s !important}
[data-wk="chatreply"] svg{opacity:0 !important}
[data-wk="chatreply"]:active{transform:scale(.86) !important}
[data-wk="sameroom"]{background:${svg(I_HOME)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;border-radius:0 !important;transition:transform .12s !important;background-size:26px 26px !important}
[data-wk="sameroom"] svg{opacity:0 !important}
[data-wk="sameroom"]:active{transform:scale(.86) !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;border-radius:0 !important;transition:transform .12s !important;background-size:26px 26px !important}
[data-wk="chatmore"] svg{opacity:0 !important}
[data-wk="chatmore"]:active{transform:scale(.86) !important}

/* ───── 第二批：卡片 ───── */
/* 转账：奶白票据，「转账」前一根骨头，印是珊瑚色圆章带爪印，底条奶黄 */
[data-wk="transfercard"]{background:#FFF8EC !important;border:2px solid #D9A86C !important;border-radius:16px !important;box-shadow:0 3px 0 rgba(201,143,85,.22) !important;overflow:hidden !important}
[data-wk="transferlabel"]{color:#8B5E3C !important;display:inline-flex !important;align-items:center !important;gap:5px !important}
[data-wk="transferlabel"]::before{content:"" !important;width:22px !important;height:11px !important;background:${svg(BONE("#F8DDB5"))} center/contain no-repeat !important;filter:drop-shadow(0 0 .6px #c98f55) drop-shadow(0 0 .6px #c98f55) !important;transform:rotate(-14deg) !important}
[data-wk="transferamount"]{color:#6B4A2E !important}
[data-wk="transfercur"]{color:#8B5E3C !important}
[data-wk="transferrule"]{border:none !important;height:12px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='26' height='12' viewBox='0 0 26 12'><g transform='translate(7 1) rotate(90 5 5) scale(.26)'>${PAW("#e0b98a").replace(/<\/?svg[^>]*>/g,"")}</g></svg>`)} repeat-x left center/26px 12px !important}
[data-wk="transfernotch"]{border:none !important;background:${svg(PAW("#e0b98a"))} center/contain no-repeat !important;width:12px !important;height:12px !important}
[data-wk="transfernote"]{color:#6B4A2E !important}
[data-wk="transferfoot"]{background:#f8e3b4 !important;color:#8B5E3C !important;border-color:transparent !important;position:relative !important}
[data-wk="transferfoot"]::after{content:"" !important;position:absolute !important;right:12px !important;top:50% !important;width:14px !important;height:14px !important;margin-top:-7px !important;background:${svg(PAW("#d9a86c"))} center/contain no-repeat !important}
[data-wk="transferseal"]{border:2.5px solid #e8907e !important;box-shadow:0 0 0 2.5px #FFF8EC,0 0 0 4px #e8907e !important;color:#e8907e !important;border-radius:50% !important;background:#fff3ea ${svg(PAW("#e8907e"))} center 6px/12px 12px no-repeat !important;padding-top:10px !important}
[data-wk="transferbtn"]{border-radius:999px !important}
[data-wk="transferbtn"][data-part="take"]{background:#c98f55 !important;color:#fff !important;border-color:#c98f55 !important}
[data-wk="transferbtn"][data-part="back"]{background:#FFF8EC !important;color:#8B5E3C !important;border-color:#D9A86C !important}

/* 红包：还是红，调成暖珊瑚红；扣子是奶白圆片上一颗爪印，右边一根骨头水印 */
[data-wk="rpcard"]{background:linear-gradient(170deg,#e9a08c,#d8705e) !important;border:2px solid #c9604f !important;border-radius:18px !important;position:relative !important}
[data-wk="rpcard"][data-status="done"]{background:linear-gradient(170deg,#f3c4b6,#e8a493) !important;border-color:#e09a88 !important;filter:none !important}
[data-wk="rpflap"]{background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,0)) !important;border-bottom:none !important}
[data-wk="rpseal"]{border:none !important;width:32px !important;height:32px !important;top:50% !important;margin-top:-16px !important;left:8px !important;border-radius:50% !important;background:#FFF8EC ${svg(PAW("#e0705e"))} center/17px 17px no-repeat !important;box-shadow:0 0 0 2px rgba(255,248,236,.45) !important;z-index:2 !important}
[data-wk="rpseal"] *{display:none !important}
[data-wk="rpcard"]::after{content:"" !important;position:absolute !important;right:6px !important;bottom:2px !important;width:80px !important;height:36px !important;background:${svg(BONE("#ffffff", .22))} center/contain no-repeat !important;transform:rotate(-22deg) !important;pointer-events:none !important}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;right:10px !important;top:8px !important;width:14px !important;height:14px !important;background:${svg(PAW("#ffffff", .35))} center/contain no-repeat !important;pointer-events:none !important}

/* 红包点开：同一种珊瑚红，「開」换成奶白爪印扣 */
[data-wk="rpenvelope"][data-stage="closed"]{background:linear-gradient(175deg,#eaa592,#d8705e) !important;border:3px solid #FFF8EC !important;border-radius:22px !important}
[data-wk="rpenvelope"][data-stage="closed"]::after{content:"" !important;position:absolute !important;left:18px !important;top:18px !important;width:90px !important;height:40px !important;background:${svg(BONE("#ffffff", .2))} center/contain no-repeat !important;transform:rotate(-18deg) !important;pointer-events:none !important}
[data-wk="rparc"][data-part="bottom"]{background:#cf6553 !important}
[data-wk="rparc"][data-part="top"]{background:linear-gradient(175deg,#eaa592,#d8705e) !important}
[data-wk="rpopenbtn"]{background:#FFF8EC ${svg(PAW("#e0705e"))} center/44px 44px no-repeat !important;color:transparent !important;border:4px solid #f8dcc8 !important;box-shadow:0 4px 0 rgba(140,50,35,.3) !important}
[data-wk="rpopenbtn"] *{opacity:0 !important}
[data-wk="rpfrom"]{color:#fff1e2 !important}
[data-wk="rpenvelope"][data-stage="open"] [data-wk="rpfrom"]{color:#6B4A2E !important}
[data-wk="rpwish"]{color:#fff8ec !important}
[data-wk="rpenvelope"][data-stage="open"] [data-wk="rpwish"]{color:#a07a5a !important}
[data-wk="rpenvelope"][data-stage="open"]{background:#FFF8EC ${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><g opacity='.12'><g transform='translate(14 70) rotate(-18) scale(.45)'>${PAW("#e0705e").replace(/<\/?svg[^>]*>/g,"")}</g><g transform='translate(84 22) rotate(16) scale(.38)'>${PAW("#e0705e").replace(/<\/?svg[^>]*>/g,"")}</g></g></svg>`)} repeat !important;background-size:120px 120px !important;border:3px solid #f2b9aa !important;border-radius:24px !important;box-shadow:0 18px 40px rgba(120,50,35,.25) !important;position:relative !important}
[data-wk="rpamount"]{color:#d8705e !important;position:relative !important;padding-bottom:16px !important;background:${svg(BONE("#f2b9aa"))} center bottom/46px 18px no-repeat !important}
[data-wk="rpstatus"]{color:#c07a68 !important}
[data-wk="rparc"][data-part="top"]{position:relative !important}
[data-wk="rparc"][data-part="top"]::after{content:"" !important;position:absolute !important;left:16px !important;top:12px !important;width:60px !important;height:26px !important;background:${svg(BONE("#ffffff", .3))} center/contain no-repeat !important;transform:rotate(-16deg) !important}
[data-wk="rpavatar"]{box-shadow:0 0 0 3px #FFF8EC,0 0 0 5px #f2b9aa !important}
[data-wk="rpavatar"],[data-wk="rpavatar"] *{border-radius:50% !important;overflow:hidden !important}
[data-wk="rparc"][data-part="bottom"]::after{content:"" !important;position:absolute !important;left:50% !important;bottom:22px !important;width:120px !important;height:22px !important;margin-left:-60px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 22'><g opacity='.3'>${[10,40,70,100].map((x,i)=>`<g transform='translate(${x} ${i%2?2:8}) scale(.32)'>${PAW("#ffffff").replace(/<\/?svg[^>]*>/g,"")}</g>`).join("")}</g></svg>`)} center/contain no-repeat !important}
[data-wk="rpclose"]{border-color:#FFF8EC !important;background:#e9a08c !important}

/* 照片：拍立得，大骨头胶带；没图时那块是暖米色 */
[data-wk="photocard"]{background:#ffffff !important;padding:8px 8px 22px !important;border-radius:4px !important;box-shadow:0 4px 10px -4px rgba(107,74,46,.35) !important;position:relative !important;overflow:visible !important;transform:rotate(-1.5deg) !important}
[data-wk="photocard"]::before{content:"" !important;position:absolute !important;top:-16px !important;left:calc(50% - 40px) !important;width:80px !important;height:34px !important;background:${svg(BONE("#F2D49B"))} center/contain no-repeat !important;filter:drop-shadow(0 0 .8px #c98f55) !important;transform:rotate(-8deg) !important;z-index:2 !important;pointer-events:none !important}
[data-wk="photoface"]{background:linear-gradient(170deg,#efe3cc,#e3d2b2) !important;border:1.5px solid #d9c3a0 !important}
[data-wk="phototext"]{color:#6B4A2E !important}
[data-wk="photohint"]{color:#8B5E3C !important;display:inline-flex !important;align-items:center !important;gap:4px !important}
[data-wk="photohint"]::after{content:"" !important;width:14px !important;height:14px !important;background:${svg(PAW("#c98f55"))} center/contain no-repeat !important}
[data-wk="photocap"]{color:#8B5E3C !important}

/* 语音：气泡上叼一根骨头，尾巴一颗爪印 */
[data-wk="voice"]{position:relative !important;overflow:visible !important;border:2px solid #D9A86C !important}
[data-wk="voice"]::before{content:"" !important;position:absolute !important;top:-9px !important;right:-6px !important;width:30px !important;height:14px !important;background:${svg(BONE_S())} center/contain no-repeat !important;filter:none !important;transform:rotate(20deg) !important;pointer-events:none !important}
[data-wk="voice"]::after{content:"" !important;position:absolute !important;bottom:-8px !important;left:-8px !important;width:16px !important;height:16px !important;background:${svg(PAW("#6B4A2E", .75))} center/contain no-repeat !important;pointer-events:none !important}

/* 天气：奶油天空，字是可可色 */
[data-wk="wxcard"]{border:2px solid #D9A86C !important;border-radius:18px !important;position:relative !important;box-shadow:0 3px 0 rgba(201,143,85,.22) !important}
[data-wk="wxcardsky"]{background:radial-gradient(circle at 80% 30%,rgba(255,248,236,.7) 0 22%,transparent 23%),linear-gradient(170deg,#f8ecd4,#ecd9b6) !important;color:#6B4A2E !important}
[data-wk="wxcardsky"] *{color:#6B4A2E !important}
[data-wk="wxcardsky"] svg{stroke:#6B4A2E !important;color:#6B4A2E !important}
[data-wk="wxcardsky"] span[style*="radius"]{background:rgba(255,248,236,.85) !important;border:1.5px solid #D9A86C !important}
[data-wk="wxcardsay"]{background:#FFF8EC !important;color:#6B4A2E !important;border-top:1.5px solid rgba(201,143,85,.4) !important}
[data-wk="wxcard"]::after{content:"" !important;position:absolute !important;right:8px !important;bottom:8px !important;width:20px !important;height:20px !important;background:${svg(PAW("#6B4A2E", .85))} center/contain no-repeat !important;transform:rotate(-15deg) !important;pointer-events:none !important}

/* ───── 第三批：加号面板、引用、正在输入、系统纸条、时间 ───── */
[data-wk="chatpanel"]{background:#FFF8EC !important;border-top:1.5px solid rgba(201,143,85,.4) !important}
[data-wk="chattoolicon"]{background:#fae3b4 !important;border:2px solid #D9A86C !important;border-radius:50% !important;box-shadow:0 3px 0 rgba(201,143,85,.3) !important;position:relative !important;overflow:visible !important;transition:transform .12s !important}
[data-wk="chattoolicon"]::after{content:"" !important;position:absolute !important;right:-4px !important;bottom:-3px !important;width:13px !important;height:13px !important;background:${svg(PAW("#c98f55"))} center/contain no-repeat !important;pointer-events:none !important}
[data-wk="chattool"]:active [data-wk="chattoolicon"]{transform:scale(.86,.8) translateY(2px) !important;box-shadow:0 1px 0 rgba(201,143,85,.3) !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:#8B5E3C !important;color:#8B5E3C !important}
[data-wk="chattoollabel"]{color:#8B5E3C !important}
[data-wk="quotedraft"]{background:#FFF8EC !important;border-left:3px solid #D9A86C !important;border-top:1.5px solid rgba(201,143,85,.35) !important}
[data-wk="quoteicon"]{color:transparent !important;width:16px !important;height:16px !important;background:${svg(PAW("#c98f55"))} center/contain no-repeat !important;display:inline-block !important;overflow:hidden !important}
[data-wk="quotetext"]{color:#8B5E3C !important}
[data-wk="quoteclear"]{color:#c98f55 !important}
[data-wk="typingdot"]{width:20px !important;height:20px !important;margin:0 2px !important;border-radius:0 !important;background:${svg(PAW("#c98f55"))} center/contain no-repeat !important}
[data-wk="typingdot"][data-i="0"]{transform:rotate(-14deg) !important}
[data-wk="typingdot"][data-i="1"]{transform:translateY(-5px) rotate(6deg) !important}
[data-wk="typingdot"][data-i="2"]{transform:rotate(18deg) !important}
[data-wk="bubble"][data-kind="typing"]{background:transparent !important;border:none !important;box-shadow:none !important;background-image:none !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="sysnote"]{background:#FFF8EC !important;border:1.5px solid rgba(201,143,85,.55) !important;border-left:4px solid #D9A86C !important;border-radius:14px !important;box-shadow:0 2px 0 rgba(201,143,85,.18) !important}
[data-wk="sysnotelabel"]{color:#c98f55 !important;display:inline-flex !important;align-items:center !important;gap:4px !important}
[data-wk="sysnotelabel"]::before{content:"" !important;width:12px !important;height:12px !important;background:${svg(PAW("#c98f55"))} center/contain no-repeat !important}
[data-wk="sysnotetext"]{color:#6B4A2E !important}
[data-wk="sysnoteclose"]{color:#c98f55 !important}
[data-wk="note"]{color:#a07a5a !important}
[data-wk="noteink"]{color:#a07a5a !important}

/* 照片没图：中间一张淡淡的小狗脸 */
[data-wk="photoface"]{background-image:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 70'><g stroke='#c9a77c' stroke-width='3' fill='#FFF8EC' stroke-linejoin='round'><ellipse cx='22' cy='30' rx='11' ry='19' transform='rotate(22 22 30)'/><ellipse cx='78' cy='30' rx='11' ry='19' transform='rotate(-22 78 30)'/><ellipse cx='50' cy='36' rx='31' ry='25'/></g><circle cx='41' cy='33' r='3.2' fill='#a8865e'/><circle cx='59' cy='33' r='3.2' fill='#a8865e'/><ellipse cx='50' cy='41' rx='3.6' ry='2.6' fill='#a8865e'/><ellipse cx='33' cy='43' rx='5' ry='3' fill='#F5B98A' opacity='.6'/><ellipse cx='67' cy='43' rx='5' ry='3' fill='#F5B98A' opacity='.6'/></svg>`)},linear-gradient(170deg,#efe3cc,#e3d2b2) !important;background-size:64px 45px,100% 100% !important;background-position:center 30%,0 0 !important;background-repeat:no-repeat !important;padding-top:70px !important}
/* 中间的时间戳：奶黄小胶囊，两边各一颗爪印 */
[data-wk="time"] > span{background:#fae3b4 !important;color:#8B5E3C !important;border:1.5px solid #D9A86C !important;border-radius:999px !important;padding:3px 30px !important;background-image:${svg(PAW("#c98f55"))},${svg(PAW("#c98f55"))} !important;background-size:12px 12px,12px 12px !important;background-position:10px center,calc(100% - 10px) center !important;background-repeat:no-repeat !important;box-shadow:0 2px 0 rgba(201,143,85,.25) !important}

/* 动描 / 旁白那种框：不当气泡，像一张奶白小便签，左边一串小脚印走过去 */
[data-wk="bubble"][data-kind="narr"]{background:#FFF8EC ${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='14' height='40' viewBox='0 0 14 40'><g fill='#d9a86c' opacity='.75'><g transform='translate(1 2) scale(.3)'>${PAW("#d9a86c").replace(/<\/?svg[^>]*>/g,"")}</g><g transform='translate(3 22) scale(.3)'>${PAW("#d9a86c").replace(/<\/?svg[^>]*>/g,"")}</g></g></svg>`)} 8px center/14px 40px repeat-y !important;border:1.5px solid rgba(201,143,85,.45) !important;border-radius:14px !important;box-shadow:none !important;color:#8B5E3C !important;font-style:italic !important;padding-left:30px !important}
[data-wk="bubble"][data-kind="narr"]::before,[data-wk="bubble"][data-kind="narr"]::after{content:none !important}

/* 动描那一段：一张小狗日记纸。顶上趴着一只眯眼偷看的小狗，左上角一枚「汪·在干嘛」小标签，底下一串小脚印走出去 */
[data-wk="narr"]{margin-top:30px !important}
[data-wk="narrink"]{background:repeating-linear-gradient(180deg,transparent 0 29px,rgba(217,168,108,.22) 29px 30px),#FFF8EC !important;background-position:0 9px !important;border:2px solid #D9A86C !important;border-radius:18px !important;color:#7a5236 !important;padding:14px 18px 8px !important;position:relative !important;overflow:visible !important;line-height:30px !important;box-shadow:0 4px 0 #f1d6a8 !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important}
[data-wk="narrink"]::before{content:"" !important;position:absolute !important;top:-42px !important;right:22px !important;width:76px !important;height:47px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='110 18 180 110'>${DOG_PEEK}</svg>`)} center bottom/contain no-repeat !important;pointer-events:none !important}
[data-wk="narrink"]::after{content:"" !important;position:absolute !important;right:12px !important;bottom:-12px !important;width:80px !important;height:20px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 22'><g transform='translate(22 2) rotate(90) scale(.32)' opacity='0.35'>${PAW("#d9a86c").replace(/<\/?svg[^>]*>/g,"")}</g><g transform='translate(40 10) rotate(90) scale(.32)' opacity='0.5'>${PAW("#d9a86c").replace(/<\/?svg[^>]*>/g,"")}</g><g transform='translate(58 2) rotate(90) scale(.32)' opacity='0.7'>${PAW("#d9a86c").replace(/<\/?svg[^>]*>/g,"")}</g><g transform='translate(76 10) rotate(90) scale(.32)' opacity='0.9'>${PAW("#d9a86c").replace(/<\/?svg[^>]*>/g,"")}</g></svg>`)} center/contain no-repeat !important;pointer-events:none !important}
[data-wk="narr"]::before{content:"汪 · 在干嘛" !important;position:absolute !important;margin-top:-11px !important;margin-left:-124px !important;z-index:2 !important;width:82px !important;height:26px !important;line-height:26px !important;text-align:center !important;font-size:10px !important;font-style:normal !important;letter-spacing:.06em !important;color:#8B5E3C !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 40'><g fill='#F8E0B0' stroke='#D9A86C' stroke-width='2.5'><circle cx='14' cy='12' r='10'/><circle cx='14' cy='28' r='10'/><circle cx='106' cy='12' r='10'/><circle cx='106' cy='28' r='10'/><rect x='12' y='9' width='96' height='22' rx='4'/></g><g fill='#F8E0B0'><circle cx='14' cy='12' r='8.7'/><circle cx='14' cy='28' r='8.7'/><circle cx='106' cy='12' r='8.7'/><circle cx='106' cy='28' r='8.7'/><rect x='13' y='10.3' width='94' height='19.4' rx='3'/></g></svg>`)} center/contain no-repeat !important;transform:rotate(-5deg) !important}
[data-wk="narr"]{position:relative !important}

/* 底栏最下面再一排小爪印（压在按键和输入框下面） */
[data-wk="composer"] > *{position:relative !important;z-index:1 !important}
[data-wk="composer"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:2px !important;height:12px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='44' height='12' viewBox='0 0 44 12'><g opacity='.35' transform='translate(5 0) scale(.3)'>${PAW(C.blueDeep).replace(/<\/?svg[^>]*>/g, "")}</g></svg>`)} repeat-x left bottom !important;background-size:44px 12px !important;pointer-events:none !important;z-index:0 !important}

/* 顶栏：名字和小字拿掉，两颗头像并排，各套一个小狗框（你的狗往右，他的往左） */
[data-wk="chathead"] [data-wk="headname"]{display:none !important}
[data-wk="chathead"] [data-wk="headme"]{display:inline-flex !important;position:relative !important;overflow:visible !important;margin-left:14px !important}
[data-wk="chathead"] [data-wk="headme"]::after{content:"" !important;position:absolute !important;left:-17px !important;top:calc(50% - 6px) !important;width:12px !important;height:12px !important;background:${svg(PAW("#c98f55"))} center/contain no-repeat !important}
[data-wk="chathead"] [data-wk="headme"] > *{border-radius:50% !important;clip-path:circle(50%) !important}
[data-wk="chathead"] [data-wk="headme"]::before{content:"" !important;position:absolute !important;width:57px !important;height:60px !important;left:-10.4px !important;top:calc(50% - 35.5px) !important;z-index:2 !important;background:${svg(FRAME(35))} center/contain no-repeat !important;pointer-events:none !important}

/* 顶栏下沿：奶油花边 + 一串小三角旗（爪印旗、粉旗、挂骨头） */
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:100% !important;height:58px !important;margin-top:-16px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='24' height='14' viewBox='0 0 24 14'><path d='M0 0 H24 V4 A6 6 0 0 1 12 4 A6 6 0 0 1 0 4 Z' fill='#FFF8EC'/><path d='M0 4 A6 6 0 0 0 12 4 A6 6 0 0 0 24 4' fill='none' stroke='#e9c98f' stroke-width='3'/><path d='M0 4 A6 6 0 0 0 12 4 A6 6 0 0 0 24 4' fill='none' stroke='#d9a86c' stroke-width='1.2' transform='translate(0 2.4)'/></svg>`)} repeat-x left top/24px 14px,${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 64' width='480' height='64'><path d='M0 12 Q120 46 240 12 Q360 46 480 12' fill='none' stroke='#D9A86C' stroke-width='2'/><path d='M8 16.2 h24 l-12 27 z' fill='#F8E0B0' stroke='#D9A86C' stroke-width='2' stroke-linejoin='round'/><g transform='translate(20 25.2) scale(0.42)' fill='#D9A86C'><ellipse cx='0' cy='4' rx='7' ry='6'/><circle cx='-8' cy='-4' r='3'/><circle cx='0' cy='-8' r='3'/><circle cx='8' cy='-4' r='3'/></g><path d='M48 23.8 h24 l-12 27 z' fill='#F8C9B0' stroke='#D9A86C' stroke-width='2' stroke-linejoin='round'/><g transform='translate(60 32.8) scale(0.42)' fill='#D9A86C'><ellipse cx='0' cy='4' rx='7' ry='6'/><circle cx='-8' cy='-4' r='3'/><circle cx='0' cy='-8' r='3'/><circle cx='8' cy='-4' r='3'/></g><path d='M88 27.5 h24 l-12 27 z' fill='#FFF8EC' stroke='#D9A86C' stroke-width='2' stroke-linejoin='round'/><g transform='translate(100 36.5) scale(0.42)' fill='#D9A86C'><ellipse cx='0' cy='4' rx='7' ry='6'/><circle cx='-8' cy='-4' r='3'/><circle cx='0' cy='-8' r='3'/><circle cx='8' cy='-4' r='3'/></g><path d='M140 28.5 v8' stroke='#D9A86C' stroke-width='1.5'/><path d='M176 384 a8 8 0 1 1 8 -8 h32 a8 8 0 1 1 8 8 a8 8 0 1 1 -8 8 h-32 a8 8 0 1 1 -8 -8 z' fill='#FFF8EC' stroke='#D9A86C' stroke-width='4' stroke-linejoin='round' transform='translate(140 47.5) rotate(90) scale(0.42) translate(-200 -384)'/><path d='M168 23.8 h24 l-12 27 z' fill='#F8C9B0' stroke='#D9A86C' stroke-width='2' stroke-linejoin='round'/><g transform='translate(180 32.8) scale(0.42)' fill='#D9A86C'><ellipse cx='0' cy='4' rx='7' ry='6'/><circle cx='-8' cy='-4' r='3'/><circle cx='0' cy='-8' r='3'/><circle cx='8' cy='-4' r='3'/></g><path d='M208 16.2 h24 l-12 27 z' fill='#FFF8EC' stroke='#D9A86C' stroke-width='2' stroke-linejoin='round'/><g transform='translate(220 25.2) scale(0.42)' fill='#D9A86C'><ellipse cx='0' cy='4' rx='7' ry='6'/><circle cx='-8' cy='-4' r='3'/><circle cx='0' cy='-8' r='3'/><circle cx='8' cy='-4' r='3'/></g><path d='M248 16.2 h24 l-12 27 z' fill='#F8E0B0' stroke='#D9A86C' stroke-width='2' stroke-linejoin='round'/><g transform='translate(260 25.2) scale(0.42)' fill='#D9A86C'><ellipse cx='0' cy='4' rx='7' ry='6'/><circle cx='-8' cy='-4' r='3'/><circle cx='0' cy='-8' r='3'/><circle cx='8' cy='-4' r='3'/></g><path d='M300 24.8 v8' stroke='#D9A86C' stroke-width='1.5'/><path d='M176 384 a8 8 0 1 1 8 -8 h32 a8 8 0 1 1 8 8 a8 8 0 1 1 -8 8 h-32 a8 8 0 1 1 -8 -8 z' fill='#FFF8EC' stroke='#D9A86C' stroke-width='4' stroke-linejoin='round' transform='translate(300 43.8) rotate(90) scale(0.42) translate(-200 -384)'/><path d='M328 27.5 h24 l-12 27 z' fill='#FFF8EC' stroke='#D9A86C' stroke-width='2' stroke-linejoin='round'/><g transform='translate(340 36.5) scale(0.42)' fill='#D9A86C'><ellipse cx='0' cy='4' rx='7' ry='6'/><circle cx='-8' cy='-4' r='3'/><circle cx='0' cy='-8' r='3'/><circle cx='8' cy='-4' r='3'/></g><path d='M368 27.5 h24 l-12 27 z' fill='#F8C9B0' stroke='#D9A86C' stroke-width='2' stroke-linejoin='round'/><g transform='translate(380 36.5) scale(0.42)' fill='#D9A86C'><ellipse cx='0' cy='4' rx='7' ry='6'/><circle cx='-8' cy='-4' r='3'/><circle cx='0' cy='-8' r='3'/><circle cx='8' cy='-4' r='3'/></g><path d='M408 23.8 h24 l-12 27 z' fill='#F8E0B0' stroke='#D9A86C' stroke-width='2' stroke-linejoin='round'/><g transform='translate(420 32.8) scale(0.42)' fill='#D9A86C'><ellipse cx='0' cy='4' rx='7' ry='6'/><circle cx='-8' cy='-4' r='3'/><circle cx='0' cy='-8' r='3'/><circle cx='8' cy='-4' r='3'/></g><path d='M448 16.2 h24 l-12 27 z' fill='#FFF8EC' stroke='#D9A86C' stroke-width='2' stroke-linejoin='round'/><g transform='translate(460 25.2) scale(0.42)' fill='#D9A86C'><ellipse cx='0' cy='4' rx='7' ry='6'/><circle cx='-8' cy='-4' r='3'/><circle cx='0' cy='-8' r='3'/><circle cx='8' cy='-4' r='3'/></g></svg>`)} repeat-x left 4px/360px 48px !important;pointer-events:none !important}

/* ───── 状态卡（点他头像那张）：此刻 + Ta 眼里 + 历史 ───── */
[data-wk="statecard"]{background:#FFF8EC !important;border:3px solid #D9A86C !important;border-radius:30px !important;box-shadow:0 6px 0 #ecd0a0,0 18px 40px rgba(107,74,46,.25) !important;overflow:visible !important;position:relative !important;--sc-heart-ink:linear-gradient(to top,#f6c9a8,#e48f78) !important}
[data-wk="statecard"]::before{content:"" !important;position:absolute !important;top:-46px !important;right:30px !important;width:84px !important;height:52px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='110 18 180 110'>${DOG}</svg>`)} center bottom/contain no-repeat !important;pointer-events:none !important;z-index:3 !important}
[data-wk="statehead"]{background:transparent !important;border-bottom:none !important;color:#6B4A2E !important}
[data-wk="statehead"]{position:relative !important;overflow:visible !important}
[data-wk="statehead"] > [data-wk="avatar"]{border-radius:50% !important;clip-path:circle(50%) !important}
[data-wk="statehead"]::before{content:"" !important;position:absolute !important;left:4px !important;top:-5.4px !important;width:66px !important;height:69.3px !important;z-index:2 !important;background:${svg(FRAME(-35))} center/contain no-repeat !important;pointer-events:none !important}
[data-wk="statehead"] button{border:2px solid #8B5E3C !important;color:#8B5E3C !important;background:transparent !important}
/* 此刻 / Ta 眼里：一条奶黄滑轨，选中的是白胶囊 */
[data-wk="statecard"] div:has(> button[aria-pressed]){background:#f6e3bf !important;border:none !important;border-radius:999px !important;margin:2px 16px 8px !important;padding:4px !important}
[data-wk="statecard"] button[aria-pressed]{color:#a88563 !important;border:2px solid transparent !important;border-radius:999px !important;padding:7px 0 !important;letter-spacing:1px !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:#FFF8EC !important;color:#6B4A2E !important;border-color:#D9A86C !important;font-weight:700 !important}
[data-wk="statecard"] button[aria-pressed="true"]::before{content:"" !important;display:inline-block !important;width:14px !important;height:14px !important;margin-right:8px !important;vertical-align:-1px !important;background:${svg(PAW("#c98f55"))} center/contain no-repeat !important}
/* 看得见的：奶黄卡，左上一枚骨头标签 */
[data-wk="stateseen"]{background:#f6e0b3 !important;margin:24px 16px 12px !important;border-radius:22px !important;border:2.5px solid #D9A86C !important;color:#6B4A2E !important;padding-top:24px !important}
[data-wk="stateseen"] > span[aria-hidden]{display:none !important}
[data-wk="stateseen"] > div:first-of-type{position:absolute !important;top:-22px !important;left:10px !important;width:104px !important;height:34px !important;line-height:34px !important;text-align:center !important;color:#8B5E3C !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 40'><g fill='#FFF8EC' stroke='#D9A86C' stroke-width='2.5'><circle cx='14' cy='12' r='10'/><circle cx='14' cy='28' r='10'/><circle cx='106' cy='12' r='10'/><circle cx='106' cy='28' r='10'/><rect x='12' y='9' width='96' height='22' rx='4'/></g><g fill='#FFF8EC'><circle cx='14' cy='12' r='8.7'/><circle cx='14' cy='28' r='8.7'/><circle cx='106' cy='12' r='8.7'/><circle cx='106' cy='28' r='8.7'/><rect x='13' y='10.3' width='94' height='19.4' rx='3'/></g></svg>`)} center/contain no-repeat !important;transform:rotate(-5deg) !important;margin:0 !important}
[data-wk="stateseen"]::after{content:"" !important;position:absolute !important;right:14px !important;bottom:12px !important;width:26px !important;height:26px !important;background:${svg(PAW("#FFF8EC"))} center/contain no-repeat !important;pointer-events:none !important}
[data-wk="stateseen"] *{color:#6B4A2E !important}
[data-wk="statewear"]{background:#FFF8EC !important;border:2px solid #D9A86C !important;border-radius:999px !important;padding:6px 14px !important;color:#6B4A2E !important;display:flex !important;justify-content:space-between !important;align-items:center !important}
[data-wk="statewear"] > span{background:#f6e0b3 !important;border-radius:999px !important;padding:1px 9px !important;color:#8B5E3C !important}
/* 心里想的：白色思考气泡，骨头标签，底下一串小泡泡 */
[data-wk="statevoice"]{background:#ffffff !important;border:2.5px solid #D9A86C !important;border-radius:26px !important;position:relative !important;overflow:visible !important;color:#6B4A2E !important;margin:30px 16px 34px !important;padding-top:20px !important}
[data-wk="statevoice"] > span[aria-hidden]{color:#f2d49b !important;opacity:1 !important;bottom:6px !important;font-size:80px !important}
[data-wk="statevoice"] > div:first-of-type > :first-child{position:absolute !important;top:-38px !important;left:-6px !important;width:104px !important;height:34px !important;line-height:34px !important;text-align:center !important;color:#8B5E3C !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 40'><g fill='#FFF8EC' stroke='#D9A86C' stroke-width='2.5'><circle cx='14' cy='12' r='10'/><circle cx='14' cy='28' r='10'/><circle cx='106' cy='12' r='10'/><circle cx='106' cy='28' r='10'/><rect x='12' y='9' width='96' height='22' rx='4'/></g><g fill='#FFF8EC'><circle cx='14' cy='12' r='8.7'/><circle cx='14' cy='28' r='8.7'/><circle cx='106' cy='12' r='8.7'/><circle cx='106' cy='28' r='8.7'/><rect x='13' y='10.3' width='94' height='19.4' rx='3'/></g></svg>`)} center/contain no-repeat !important;transform:rotate(-5deg) !important}
[data-wk="statevoice"] > div:first-of-type{justify-content:flex-end !important}
[data-wk="statevoice"] *{color:#6B4A2E !important}
[data-wk="statevoice"]::after{content:"" !important;position:absolute !important;left:-2px !important;bottom:-36px !important;width:36px !important;height:36px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><g fill='#fff' stroke='#D9A86C' stroke-width='2'><circle cx='30' cy='8' r='7'/><circle cx='16' cy='22' r='5'/><circle cx='6' cy='33' r='3.5'/></g></svg>`)} center/contain no-repeat !important;pointer-events:none !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:#c98f55 !important}
[data-wk="statevoice"] + div > button{border:1.5px dashed #D9A86C !important;border-radius:999px !important;padding:6px 18px !important;color:#8B5E3C !important;background:#FFF8EC !important;margin:0 auto 6px !important}
/* 好感度：心换成一根横着的骨头进度条，桃色到珊瑚 */
[data-wk="stateaff"]{background:transparent !important;border-top:1.5px dashed rgba(201,143,85,.5) !important;position:relative !important;display:block !important;padding:16px 20px 74px !important}
[data-wk="stateaff"] *{color:#8B5E3C !important}
[data-wk="stateheart"]{position:absolute !important;width:40px !important;height:230px !important;left:calc(50% - 20px) !important;bottom:-76px !important;transform:rotate(90deg) !important;--sc-heart-mask:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 230' preserveAspectRatio='none'><g fill='#000'><circle cx='11' cy='13' r='11'/><circle cx='29' cy='13' r='11'/><circle cx='11' cy='217' r='11'/><circle cx='29' cy='217' r='11'/><rect x='6' y='12' width='28' height='206' rx='8'/></g></svg>`)} !important}
[data-wk="stateheart"] > div{-webkit-mask-size:100% 100% !important;mask-size:100% 100% !important}
[data-wk="stateheartline"]{background:#D9A86C !important;opacity:1 !important}
[data-wk="stateheart"] > div:not([data-wk="stateheartline"]){inset:3px !important}
[data-wk="stateheartbase"]{background:#fff6e6 !important;opacity:1 !important}
[data-wk="stateheartfill"] > div{opacity:1 !important;border-top:none !important}
[data-wk="stateheartnum"]{transform:rotate(-90deg) !important;color:#6B4A2E !important;-webkit-text-stroke:3px #fff6e6 !important;font-size:15px !important;padding-top:0 !important}

/* Ta 眼里那一页 */
[data-wk="gazepage"]{background:transparent !important}
[data-wk="gazetitle"]{display:none !important}
[data-wk="gazetab"]{background:#f6e3bf !important;color:#8B5E3C !important;border-radius:999px !important;border:none !important;clip-path:none !important;padding:8px 18px !important}
[data-wk="gazetab"][data-on="1"]{background:#d4a56c !important;color:#fff !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:#a07a5a !important}
[data-wk="gazecard"]{background:#ffffff !important;border:2.5px solid #D9A86C !important;border-radius:20px !important;box-shadow:0 4px 0 #ecd0a0 !important;position:relative !important;overflow:visible !important;margin-top:22px !important;transform:none !important}
[data-wk="gazecard"]::before{content:"" !important;position:absolute !important;top:-20px !important;left:calc(50% - 32px) !important;width:64px !important;height:28px !important;background:${svg(BONE("#F2D49B"))} center/contain no-repeat !important;filter:drop-shadow(0 0 .9px #c98f55) drop-shadow(0 0 .5px #c98f55) !important;transform:rotate(-6deg) !important;z-index:2 !important}
[data-wk="gazecard"]::after{content:"" !important;position:absolute !important;right:14px !important;bottom:14px !important;width:18px !important;height:18px !important;background:${svg(PAW("#c98f55"))} center/contain no-repeat !important}
[data-wk="gazecardname"]{color:#6B4A2E !important;font-weight:700 !important}
[data-wk="gazecardtext"]{color:#c9a07a !important}
[data-wk="gazecardtime"]{color:#c98f55 !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{background:#FFF8EC !important;border:2.5px solid #D9A86C !important;border-radius:24px !important}

/* 新挂点（v89.451 起）：心情小胶囊、好感数字挪到右上、进度条末端的爪印圆扣、空块里睡觉的小狗 */
[data-wk="statemood"]{display:inline-block !important;border:1.5px solid #e8907e !important;background:#fde8e1 !important;color:#d9705e !important;border-radius:999px !important;padding:0 10px !important;margin-right:4px !important;line-height:1.7 !important}
[data-wk="stateaffval"]{display:block !important;position:absolute !important;right:22px !important;top:12px !important;font-size:26px !important;font-weight:700 !important;color:#6B4A2E !important}
[data-wk="stateheartnum"]{display:none !important}
[data-wk="stateheartknob"]{display:block !important;width:30px !important;height:30px !important;margin:0 0 -15px -15px !important;border-radius:50% !important;background:#FFF8EC ${svg(PAW("#e48f78"))} center/16px 16px no-repeat !important;border:2.5px solid #D9A86C !important;transform:rotate(-90deg) !important;z-index:2 !important}
[data-wk="gazeempty"]{border:2px dashed #D9A86C !important;border-radius:22px !important;margin:6px 4px 10px !important;padding:96px 12px 22px !important;background:#FFF8EC !important}
[data-wk="gazeempty"]::before{content:"" !important;position:absolute !important;top:18px !important;left:calc(50% - 44px) !important;width:88px !important;height:66px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='100 0 210 130'><g stroke='#D9A86C' stroke-width='3.5' stroke-linejoin='round' stroke-linecap='round'><ellipse cx='141' cy='62' rx='20' ry='34' fill='#FFF8EC' transform='rotate(22 141 62)'/><ellipse cx='259' cy='62' rx='20' ry='34' fill='#FFF8EC' transform='rotate(-22 259 62)'/><ellipse cx='139' cy='68' rx='9' ry='20' fill='#F8DDB5' stroke='none' transform='rotate(22 139 68)'/><ellipse cx='261' cy='68' rx='9' ry='20' fill='#F8DDB5' stroke='none' transform='rotate(-22 261 68)'/><ellipse cx='200' cy='70' rx='60' ry='48' fill='#FFF8EC'/></g><ellipse cx='166' cy='84' rx='10' ry='6' fill='#F5B98A' opacity='0.8'/><ellipse cx='234' cy='84' rx='10' ry='6' fill='#F5B98A' opacity='0.8'/><path d='M168 68 q10 8 20 0 M212 68 q10 8 20 0' fill='none' stroke='#6B4A2E' stroke-width='4' stroke-linecap='round'/><ellipse cx='200' cy='80' rx='7' ry='5' fill='#6B4A2E'/><path d='M200 85 v4 M200 89 q-7 7 -13 1 M200 89 q7 7 13 1' fill='none' stroke='#6B4A2E' stroke-width='2.5' stroke-linecap='round'/><text x='268' y='30' font-size='20' fill='#c98f55' font-family='sans-serif'>z</text><text x='284' y='14' font-size='14' fill='#c98f55' font-family='sans-serif'>z</text></svg>`)} center/contain no-repeat !important}
[data-wk="gazeempty"] > div:first-child{color:#6B4A2E !important}
[data-wk="gazeempty"] button{background:#d4a56c !important;color:#fff !important;border-radius:999px !important;box-shadow:0 3px 0 #b88a55 !important}

/* ───── 线下那一页（只在 [data-wk="offline"] 里面生效，线上不受影响） ───── */
[data-wk="offline"] [data-wk="chathead"] [data-wk="headname"]{display:block !important}
[data-wk="offline"] [data-wk="offtitle"]{color:#6B4A2E !important}
[data-wk="offline"] [data-wk="chathead"]{border-bottom:none !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:28px !important;height:28px !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] svg{opacity:0 !important}
[data-wk="offline"] [data-wk="chatmore"]{font-size:0 !important;color:transparent !important;width:30px !important;height:30px !important;background:${svg(I_MORE)} center/contain no-repeat !important}
[data-wk="offline"] [data-wk="chathead"] button:last-child:not([data-wk]){background:#fde8e1 !important;border:1.5px solid #e8907e !important;color:#d9705e !important;border-radius:999px !important;padding:3px 12px !important}
[data-wk="offcomposer"]{background:#FFF8EC ${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='44' height='12' viewBox='0 0 44 12'><g opacity='.35' transform='translate(16 0) scale(.3)'>${PAW(C.blueDeep).replace(/<\/?svg[^>]*>/g, "")}</g></svg>`)} repeat-x top left !important;background-size:44px 12px !important;border-top:1.5px solid rgba(201,143,85,.4) !important;position:relative !important}
[data-wk="offcomposer"] > *{position:relative !important;z-index:1 !important}
[data-wk="offcomposer"] textarea{background:#ffffff !important;border:2px solid #fbe9c4 !important;border-radius:22px !important;color:#6B4A2E !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:36px !important;height:36px !important;border:none !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{font-size:0 !important;color:transparent !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]){background:${svg(I_SEND)} center/contain no-repeat !important;border:none !important;box-shadow:none !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]) svg{opacity:0 !important}
[data-wk="offcomposer"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:2px !important;height:12px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='44' height='12' viewBox='0 0 44 12'><g opacity='.35' transform='translate(5 0) scale(.3)'>${PAW(C.blueDeep).replace(/<\/?svg[^>]*>/g, "")}</g></svg>`)} repeat-x left bottom !important;background-size:44px 12px !important;pointer-events:none !important}

/* 翻旧心声那一页（v89.452 起的挂点） */
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;min-height:36px !important;line-height:20px !important;position:relative !important;z-index:2 !important;background:#f6e3bf !important;border:none !important;border-radius:999px !important;padding:8px 22px !important;margin:0 0 18px !important;color:#6B4A2E !important;font-weight:700 !important}
[data-wk="statehistbtn"][data-part="more"]{border:1.5px dashed #D9A86C !important;border-radius:999px !important;padding:6px 18px !important;color:#8B5E3C !important;background:#FFF8EC !important;margin:0 auto 6px !important}
[data-wk="statehisthead"] > :first-child{padding:6px 22px 8px !important;color:#8B5E3C !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 40' preserveAspectRatio='none'><g fill='#FFF8EC' stroke='#D9A86C' stroke-width='2.5'><circle cx='14' cy='12' r='10'/><circle cx='14' cy='28' r='10'/><circle cx='186' cy='12' r='10'/><circle cx='186' cy='28' r='10'/><rect x='12' y='9' width='176' height='22' rx='4'/></g><g fill='#FFF8EC'><circle cx='14' cy='12' r='8.7'/><circle cx='14' cy='28' r='8.7'/><circle cx='186' cy='12' r='8.7'/><circle cx='186' cy='28' r='8.7'/><rect x='13' y='10.3' width='174' height='19.4' rx='3'/></g></svg>`)} center/100% 100% no-repeat !important;transform:rotate(-3deg) !important;letter-spacing:1px !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{border:1.5px solid #e8907e !important;border-radius:999px !important;color:#d9705e !important;padding:3px 14px !important;background:#FFF8EC !important}
[data-wk="statehistlist"]{position:relative !important;padding-left:40px !important;margin-top:18px !important}
[data-wk="statehistlist"]::before{content:"" !important;position:absolute !important;left:17px !important;top:20px !important;bottom:40px !important;border-left:2px dotted #D9A86C !important}
[data-wk="statehistitem"]{position:relative !important;background:#ffffff !important;border:2.5px solid #D9A86C !important;border-radius:22px !important;padding:14px 16px 14px !important;margin-bottom:18px !important;box-shadow:0 4px 0 #ecd0a0 !important}
[data-wk="statehistitem"]::before{content:"" !important;position:absolute !important;left:-41px !important;top:10px !important;width:28px !important;height:28px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='17' fill='#FFF8EC' stroke='#D9A86C' stroke-width='2.5'/><g transform='translate(20 21) scale(.42)' fill='#c98f55'><ellipse cx='0' cy='4' rx='7' ry='6'/><circle cx='-8' cy='-4' r='3'/><circle cx='0' cy='-8' r='3'/><circle cx='8' cy='-4' r='3'/></g></svg>`)} center/contain no-repeat !important}
[data-wk="statehistmood"]{border:1.5px solid #e8907e !important;background:#fde8e1 !important;color:#d9705e !important;border-radius:999px !important;padding:1px 10px !important}
[data-wk="statehisttime"]{color:#c9a07a !important}
[data-wk="statehisttext"]{color:#6B4A2E !important;margin:6px 0 10px !important}
[data-wk="statehistmeta"]{background:#faefd9 !important;border-radius:16px !important;padding:8px 12px !important}
[data-wk="statehistmeta"] > :first-child{display:none !important}
[data-wk="statehistact"],[data-wk="statehistwear"]{display:flex !important;align-items:flex-start !important;gap:8px !important;color:#8B5E3C !important;font-size:12px !important;line-height:1.7 !important;white-space:normal !important;overflow:visible !important;word-break:break-word !important;padding:2px 0 !important}
[data-wk="statehistact"]::before,[data-wk="statehistwear"]::before{margin-top:3px !important}
[data-wk="statehistact"]::before,[data-wk="statehistwear"]::before{content:"" !important;flex:0 0 auto !important;width:15px !important;height:15px !important}
[data-wk="statehistact"]::before{background:${svg(PAW("#c98f55"))} center/contain no-repeat !important}
[data-wk="statehistwear"]::before{width:20px !important;background:${svg(BONE("#FFF8EC"))} center/contain no-repeat !important;filter:drop-shadow(0 0 .6px #c98f55) drop-shadow(0 0 .6px #c98f55) !important}
[data-wk="statehistend"]{display:flex !important;justify-content:center !important;align-items:center !important;gap:14px !important;color:#c9a07a !important;font-size:12px !important;margin-top:6px !important}
[data-wk="statehistend"]::before,[data-wk="statehistend"]::after{content:"" !important;width:30px !important;height:14px !important;background:${svg(BONE("#F2D49B"))} center/contain no-repeat !important;filter:drop-shadow(0 0 .7px #c98f55) !important}
[data-wk="statehistend"]::before{transform:rotate(-14deg) !important}
[data-wk="statehistend"]::after{transform:rotate(14deg) !important}

/* 线下的卡片：她的奶白、他的奶黄，焦糖边，角上小骨头和爪印 */
[data-wk="offcard"]{background:#FFF8EC !important;border:2.5px solid #D9A86C !important;border-left-width:2.5px !important;border-radius:24px !important;box-shadow:0 4px 0 #ecd0a0 !important;position:relative !important;overflow:visible !important}
[data-wk="offcard"][data-me="0"]{background:#fdf0d5 !important}
[data-wk="offcard"]::before{content:"" !important;position:absolute !important;top:-12px !important;right:26px !important;width:46px !important;height:20px !important;background:${svg(BONE_S())} center/contain no-repeat !important;filter:none !important;transform:rotate(10deg) !important;z-index:2 !important}
[data-wk="offcard"]::after{content:"" !important;position:absolute !important;left:14px !important;bottom:10px !important;width:18px !important;height:18px !important;background:${svg(PAW("#d9a86c", .8))} center/contain no-repeat !important}
[data-wk="offcard"][data-me="1"]::after{left:auto !important;right:14px !important}
[data-wk="offhead"] img,[data-wk="offhead"] [data-wk="avatar"]{border-radius:50% !important;box-shadow:0 0 0 2px #FFF8EC,0 0 0 3.5px #D9A86C !important}
[data-wk="offname"]{color:#8B5E3C !important;font-weight:700 !important}
[data-wk="offcard"][data-me="1"] [data-wk="offname"]{color:#d9705e !important}
[data-wk="offtext"]{color:#6B4A2E !important}
[data-wk="offsay"]{background:linear-gradient(transparent 55%,#f8dcae 55%) !important;color:#8B5E3C !important;font-weight:700 !important;box-decoration-break:clone !important;-webkit-box-decoration-break:clone !important}
[data-wk="offthought"]{background:#ffffff !important;border:none !important;border-left:none !important;border-radius:16px !important;padding:10px 14px 10px 34px !important;position:relative !important;color:#a07a5a !important}
[data-wk="offthought"]::before{content:"" !important;position:absolute !important;left:11px !important;top:12px !important;width:16px !important;height:16px !important;background:${svg(PAW("#e8907e"))} center/contain no-repeat !important}
[data-wk="offcardacts"] svg{stroke:#c98f55 !important;color:#c98f55 !important}
[data-wk="offreplyopt"]{background:#FFF8EC !important;border:1.5px solid #D9A86C !important;border-radius:999px !important;color:#8B5E3C !important}

/* 线下背景：跟线上同一张奶油底 + 爪印骨头花纹（自己设过场景图的照旧显示图） */
[data-wk="offline"]:not([style*="url("]){background:${C.cream} ${svg(TILE)} repeat !important;background-size:120px 120px !important}
[data-wk="offline"] [data-wk="offbody"]{background:transparent !important}

/* 位置卡（v89.453 起的挂点）：奶白圆角便签，图钉换成一颗焦糖爪印，地名下面一排小脚印 */
[data-wk="geocard"] > [data-wk="card"]{background:#FFF8EC !important;border:2.5px solid #D9A86C !important;border-radius:20px !important;box-shadow:0 4px 0 #ecd0a0 !important;padding-top:22px !important}
[data-wk="geocard"][data-me="0"] > [data-wk="card"]{background:#fdf0d5 !important}
[data-wk="geopin"]{width:30px !important;height:30px !important;top:-14px !important;left:14px !important;border-radius:50% !important;background:#FFF8EC ${svg(PAW("#c98f55"))} center/17px 17px no-repeat !important;border:2.5px solid #D9A86C !important;box-shadow:0 2px 0 #ecd0a0 !important}
[data-wk="geopinstem"]{display:none !important}
[data-wk="geoname"]{color:#6B4A2E !important;font-weight:700 !important}
[data-wk="georule"]{height:10px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='22' height='10' viewBox='0 0 22 10'><g transform='translate(6 0) rotate(90 5 5) scale(.24)'>${PAW("#e0b98a").replace(/<\/?svg[^>]*>/g,"")}</g></svg>`)} repeat-x left center/22px 10px !important}
[data-wk="geofoot"]{color:#a07a5a !important}
[data-wk="geocard"]::after{content:"" !important;position:absolute !important;right:-8px !important;bottom:-8px !important;width:36px !important;height:20px !important;background:${svg(BONE_S())} center/contain no-repeat !important;transform:rotate(-18deg) !important;z-index:2 !important}

/* 拍一拍：奶黄小胶囊，两边各一颗爪印 */
[data-wk="note"][data-part="pat"]{display:inline-block !important;background:#fae3b4 ${svg(PAW("#c98f55"))} 10px center/12px 12px no-repeat !important;border:1.5px solid #D9A86C !important;border-radius:999px !important;padding:3px 14px 3px 28px !important;color:#8B5E3C !important;box-shadow:0 2px 0 #ecd0a0 !important}
/* 个人名片：奶白卡，头像套圈，底下一条奶黄「个人名片」带爪印 */
[data-wk="namecard"]{background:#FFF8EC !important;border:2.5px solid #D9A86C !important;border-radius:20px !important;box-shadow:0 4px 0 #ecd0a0 !important;overflow:hidden !important;position:relative !important}
[data-wk="namecard"] img,[data-wk="namecard"] [data-wk="avatar"]{border-radius:50% !important;overflow:hidden !important;box-shadow:0 0 0 2.5px #FFF8EC,0 0 0 4.5px #D9A86C !important}
[data-wk="namecardname"]{color:#6B4A2E !important;font-weight:700 !important}
[data-wk="namecard"] > div:first-child div{color:#a07a5a !important}
[data-wk="namecard"] > div:first-child [data-wk="namecardname"]{color:#6B4A2E !important}
[data-wk="namecard"] > div:last-child{background:#fae3b4 !important;border-top:none !important;color:#8B5E3C !important;position:relative !important}
[data-wk="namecard"] > div:last-child::after{content:"" !important;position:absolute !important;right:12px !important;top:50% !important;width:14px !important;height:14px !important;margin-top:-7px !important;background:${svg(PAW("#c98f55"))} center/contain no-repeat !important}
[data-wk="namecard"]::after{content:"" !important;position:absolute !important;right:12px !important;top:10px !important;width:32px !important;height:18px !important;background:${svg(BONE_S())} center/contain no-repeat !important;transform:rotate(14deg) !important}

/* 通话里的气泡：跟聊天同一套，你的奶白、他的奶黄，焦糖边，尾巴一颗爪印 */
[data-wk="callbubble"]{background:#fae3b4 !important;color:#6B4A2E !important;border:2px solid #D9A86C !important;border-radius:22px !important;box-shadow:0 3px 0 rgba(107,74,46,.18) !important;position:relative !important;overflow:visible !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:#fffaf0 !important}
[data-wk="callbubble"]::after{content:"" !important;position:absolute !important;bottom:-8px !important;left:-6px !important;width:16px !important;height:16px !important;background:${svg(PAW("#D9A86C"))} center/contain no-repeat !important;transform:rotate(-20deg) !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]::after{left:auto !important;right:-6px !important;transform:rotate(20deg) !important}
[data-wk="callact"]{color:#f3e2c4 !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:0 0 0 5px #FFF8EC,0 0 0 8px #D9A86C !important}

/* 通话结束那颗胶囊 + 展开的通话记录 */
[data-wk="note"][data-part="call"]{background:#fae3b4 !important;border:1.5px solid #D9A86C !important;color:#8B5E3C !important;border-radius:999px !important;box-shadow:0 2px 0 #ecd0a0 !important}
[data-wk="note"][data-part="call"] svg{stroke:#8B5E3C !important;color:#8B5E3C !important}
[data-wk="note"][data-part="callsum"]{color:#a07a5a !important}
[data-wk="callpill"] > [data-wk="block"]{background:#FFF8EC !important;border:2.5px solid #D9A86C !important;border-radius:22px !important;box-shadow:0 4px 0 #ecd0a0 !important;color:#6B4A2E !important;position:relative !important}
[data-wk="callpill"] > [data-wk="block"] *{border-color:rgba(201,143,85,.35) !important}

/* 转账已收：印章换成一只大珊瑚爪印，「已收」白字写在掌心 */
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{width:72px !important;height:72px !important;flex-shrink:0 !important;border:none !important;box-shadow:none !important;border-radius:0 !important;opacity:1 !important;padding:26px 0 0 !important;white-space:nowrap !important;overflow:visible !important;color:#fff !important;font-weight:700 !important;background:${svg(PAW("#e8907e"))} center/contain no-repeat !important;transform:rotate(-12deg) !important;filter:drop-shadow(0 2px 0 rgba(201,96,79,.35)) !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] *{color:#fff !important;font-size:12px !important;letter-spacing:0 !important;white-space:nowrap !important}

/* 转账退回：灰褐色大爪印，「已退」写在掌心，原来那道划线藏掉 */
[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"]{width:72px !important;height:72px !important;flex-shrink:0 !important;border:none !important;box-shadow:none !important;border-radius:0 !important;opacity:1 !important;padding:26px 0 0 !important;white-space:nowrap !important;overflow:visible !important;color:#fff !important;font-weight:700 !important;background:${svg(PAW("#b9a593"))} center/contain no-repeat !important;transform:rotate(10deg) !important}
[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"] *{color:#fff !important;font-size:12px !important;letter-spacing:0 !important;white-space:nowrap !important}
[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"] > div:nth-child(2){display:none !important}

/* 线下小结：奶白卡，骨头标签写「线下经过」 */
[data-part="offlog"]{background:#FFF8EC !important;border:2.5px solid #D9A86C !important;border-radius:20px !important;box-shadow:0 4px 0 #ecd0a0 !important;position:relative !important;overflow:visible !important;padding-top:22px !important;color:#6B4A2E !important}
[data-part="offlog"]::after{content:"" !important;position:absolute !important;right:12px !important;bottom:10px !important;width:18px !important;height:18px !important;background:${svg(PAW("#c98f55"))} center/contain no-repeat !important}
[data-wk="offlogtitle"]{display:inline-block !important;margin-top:-34px !important;margin-bottom:8px !important;padding:4px 18px !important;color:#8B5E3C !important;letter-spacing:.1em !important;background:${svg(BONE_S("#F8E0B0"))} center/100% 100% no-repeat !important;transform:rotate(-4deg) !important}
[data-wk="offlogtext"]{color:#6B4A2E !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:#c98f55 !important}
[data-wk="offlogtranscript"]{border-top:1.5px dashed #D9A86C !important;color:#a07a5a !important}
`;

const look = { bubble, customCSS: css.trim() };
const pack = { kind: "chat-look", v: 1, name: "骨头小狗", look, assets: {} };
writeFileSync(join(here, "骨头小狗-美化.json"), JSON.stringify(pack));
writeFileSync(join(here, "骨头小狗.css"), css.trim() + "\n");
console.log("ok", css.length);
