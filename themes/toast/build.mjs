// 黄油吐司：奶油底撒面包屑；他的气泡是一片白吐司（上头宽出来一圈、焦黄面包边）；我的是烤好的金黄吐司、右边一块黄油；头像是一个荷包蛋——蛋黄一圈、蛋白软软地摊开。用法：node themes/toast/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const X = s => `<svg xmlns='http://www.w3.org/2000/svg' ${s}</svg>`;
const C = { bg: "#FBF6EC", crumb: "#FFF8EA", crust: "#B87A45", crust2: "#9A6236", gold: "#E9A95E", gold2: "#D98F45", butter: "#F7D35E", yolk: "#F5C142", ink: "#5A3E2B", fog: "#B5A28E", jam: "#D9575B", line: "#EBDCC6" };
const CRUMBS = X(`width='90' height='90' viewBox='0 0 90 90'><g fill='rgba(184,122,69,.16)'><circle cx='12' cy='16' r='1.6'/><circle cx='15' cy='19' r='1'/><circle cx='62' cy='12' r='1.3'/><circle cx='44' cy='52' r='1.8'/><circle cx='47' cy='55' r='.9'/><circle cx='80' cy='70' r='1.4'/><circle cx='22' cy='76' r='1.2'/></g><g fill='rgba(247,211,94,.35)'><rect x='70' y='34' width='5' height='4' rx='1.2'/><rect x='28' y='44' width='4' height='3' rx='1'/></g>`);
const BUTTER = X(`viewBox='0 0 24 20'><rect x='2' y='3' width='19' height='14' rx='4' fill='${C.butter}' stroke='#E3B83A' stroke-width='1.2' transform='rotate(-6 12 10)'/><rect x='5' y='5.5' width='8' height='3' rx='1.5' fill='rgba(255,255,255,.6)' transform='rotate(-6 9 7)'/>`);
const WHEAT = X(`viewBox='0 0 40 14' fill='none' stroke='${C.fog}' stroke-width='1.1' stroke-linecap='round'><path d='M2 7 H38'/><g fill='${C.fog}' stroke='none'><ellipse cx='30' cy='4.6' rx='2.6' ry='1.3' transform='rotate(-30 30 4.6)'/><ellipse cx='30' cy='9.4' rx='2.6' ry='1.3' transform='rotate(30 30 9.4)'/><ellipse cx='24' cy='4.6' rx='2.6' ry='1.3' transform='rotate(-30 24 4.6)'/><ellipse cx='24' cy='9.4' rx='2.6' ry='1.3' transform='rotate(30 24 9.4)'/><ellipse cx='36' cy='7' rx='2.4' ry='1.3'/></g>`);
// 按键
const I_WHEAT = X(`viewBox='0 0 30 30'><path d='M15 28 V8' stroke='${C.crust}' stroke-width='1.8' stroke-linecap='round'/><g fill='${C.gold}' stroke='${C.crust}' stroke-width='1'><ellipse cx='15' cy='5' rx='2.6' ry='4'/><ellipse cx='11.5' cy='10' rx='2.4' ry='3.6' transform='rotate(-35 11.5 10)'/><ellipse cx='18.5' cy='10' rx='2.4' ry='3.6' transform='rotate(35 18.5 10)'/><ellipse cx='11.5' cy='16' rx='2.4' ry='3.6' transform='rotate(-35 11.5 16)'/><ellipse cx='18.5' cy='16' rx='2.4' ry='3.6' transform='rotate(35 18.5 16)'/></g>`);
const I_KNIFE = X(`viewBox='0 0 40 36'><rect x='5' y='17' width='13' height='6' rx='3' fill='${C.crust}' transform='rotate(-30 11 20)'/><path d='M16 15 L34 4 Q38 3 36 7 L19 21Z' fill='#E8E4DE' stroke='#A9A39A' stroke-width='1'/><rect x='24' y='4' width='11' height='8' rx='2.6' fill='${C.butter}' stroke='#E3B83A' stroke-width='1' transform='rotate(-30 29 8)'/>`);
const I_SLICE = X(`viewBox='0 0 40 36'><path d='M9 12 C3 12 3 3 11 3 H29 C37 3 37 12 31 12 V31 Q31 33 29 33 H11 Q9 33 9 31Z' fill='#FFF3DC' stroke='${C.crust}' stroke-width='2.4'/><path d='M20 26 C14 22 13.5 19.5 13.5 18 C13.5 16 15 15 16.5 15 C18 15 19.3 16 20 17.2 C20.7 16 22 15 23.5 15 C25 15 26.5 16 26.5 18 C26.5 19.5 26 22 20 26Z' fill='${C.jam}'/>`);
const I_TOASTER = X(`viewBox='0 0 30 30'><path d='M9 9 C7 9 7 5 10 5 H13 C15 5 15 9 13 9Z M17 9 C15 9 15 5 18 5 H21 C23 5 23 9 21 9Z' fill='#FFF3DC' stroke='${C.crust}' stroke-width='1.3'/><rect x='4' y='9' width='22' height='16' rx='5' fill='#F1A8A0' stroke='${C.crust2}' stroke-width='1.5'/><rect x='8' y='13' width='14' height='2.4' rx='1.2' fill='${C.crust2}'/><circle cx='22.5' cy='20' r='1.6' fill='#fff'/>`);
const I_JAM = X(`viewBox='0 0 30 30'><rect x='7' y='4' width='16' height='5' rx='1.5' fill='#E8D2B0' stroke='${C.crust}' stroke-width='1.2'/><path d='M8 9 H22 V24 Q22 27 19 27 H11 Q8 27 8 24Z' fill='${C.jam}' stroke='${C.crust2}' stroke-width='1.3'/><rect x='10.5' y='14' width='9' height='7' rx='1.5' fill='#FFF3DC'/><circle cx='15' cy='17.5' r='1.8' fill='${C.jam}'/>`);
const bubble = { myBg: C.gold, myText: "#fff", myBorder: "none", charBg: C.crumb, charText: C.ink, charBorder: "none", radius: 12, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };
// 荷包蛋：蛋黄一圈，蛋白是几团错开的白，软软地摊成不规则一片
const EGG = `0 0 0 3px ${C.yolk},0 0 0 9px #fff,5px 3px 0 10px #fff,-6px 4px 0 9px #fff,3px -6px 0 9px #fff,-4px -4px 0 10px #fff,0 6px 14px 8px rgba(184,122,69,.18)`;
const HIDE = `font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;border-radius:0 !important`;
// 吐司形：上头宽出一圈（::before 一顶面包帽，比身子宽、在身子底下）
const TOP = (bg, bd) => `content:"" !important;position:absolute !important;left:-6px !important;right:-6px !important;top:-12px !important;height:22px !important;background:${bg} !important;border:3px solid ${bd} !important;border-radius:50% 50% 10px 10px / 70% 70% 10px 10px !important;z-index:-1 !important;pointer-events:none !important`;
const css = `
/* ───── 黄油吐司 · 第一批 ───── */
[data-wk="chat"]{background:${svg(CRUMBS)} 0 0/90px 90px,${C.bg} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：一整块烤得刚好的吐司色，底边一道焦黄面包边 */
[data-wk="chathead"]{background:linear-gradient(180deg,#F8E4BF,#F1D19C) !important;border-bottom:4px solid ${C.crust} !important;box-shadow:0 3px 0 ${C.crust2},0 6px 12px rgba(154,98,54,.15) !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important;font-weight:600 !important}
[data-wk="headdim"],[data-wk="headname"] > div:last-child{color:#9C7B5C !important}
[data-wk="chatback"] svg{stroke:${C.ink} !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:26px !important;min-width:26px !important;height:26px !important;flex-shrink:0 !important;${HIDE};background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_TOASTER)} center/contain no-repeat !important;margin-left:auto !important}
[data-wk="chatmore"]{background:${svg(I_JAM)} center/contain no-repeat !important;margin-left:4px !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chathead"] [data-wk="headme"]{display:inline-flex !important;position:relative !important;overflow:visible !important;margin-left:-6px !important;flex-shrink:0 !important}
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img,[data-wk="chathead"] [data-wk="avatar"]{width:30px !important;height:30px !important;min-width:30px !important;flex-shrink:0 !important;aspect-ratio:1 !important;border-radius:50% !important;box-shadow:0 0 0 2.5px ${C.yolk},0 0 0 6px #fff,3px 2px 0 6px #fff,-3px 3px 0 6px #fff !important}
[data-wk="chathead"] [data-wk="headme"]::before{content:"" !important;position:absolute !important;left:-12px !important;bottom:-4px !important;width:15px !important;height:12px !important;z-index:3 !important;background:${svg(BUTTER)} center/contain no-repeat !important}
[data-wk="offline"] [data-wk="chathead"] [data-wk="headme"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"]{flex:1 1 auto !important;min-width:84px !important;margin-left:6px !important}
[data-wk="chathead"] [data-wk="headname"] > div:last-child{white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important}

/* 头像：荷包蛋——头像是蛋黄，外面一圈蛋白软软地摊开 */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *,[data-wk="msg"] [data-wk="avatar"],[data-wk="cardrow"] [data-wk="avatar"],[data-wk="rpsingle"] [data-wk="avatar"]{border-radius:50% !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]),[data-wk="msg"] [data-wk="avatar"],[data-wk="cardrow"] [data-wk="avatar"],[data-wk="rpsingle"] > :first-child[data-wk="avatar"],[data-wk="rpsingle"] > [data-wk="rpcard"] + [data-wk="avatar"]{box-shadow:${EGG} !important}
[data-wk="msg"] [data-wk="avatar"],[data-wk="cardrow"] [data-wk="avatar"],[data-wk="rpsingle"] [data-wk="avatar"]{margin:6px 4px !important}

/* 气泡：一片吐司——上头宽出一圈面包帽、焦黄面包边；我的是烤成金黄的那片，右边一块黄油 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;isolation:isolate !important;line-height:1.6 !important;margin-top:12px !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.crumb} !important;color:${C.ink} !important;border:3px solid ${C.crust} !important;border-top:none !important;border-radius:0 0 12px 12px !important;padding:12px 16px 10px !important;box-shadow:0 4px 8px rgba(154,98,54,.12) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{${TOP(C.crumb, C.crust)}}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${svg(BUTTER)} right 9px center/24px 20px no-repeat,linear-gradient(180deg,${C.gold},${C.gold2}) !important;color:#fff !important;border:3px solid ${C.crust2} !important;border-top:none !important;border-radius:0 0 12px 12px !important;padding:12px 40px 10px 16px !important;box-shadow:0 4px 8px rgba(154,98,54,.2) !important;text-shadow:0 1px 0 rgba(154,98,54,.4) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{${TOP(C.gold, C.crust2)}}
[data-wk="bubble"][data-kind="text"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:5px !important;height:6px !important;z-index:-1 !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::after{background:${C.crumb} !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{background:${C.gold} !important}

/* 时间：两边一根麦穗 */
[data-wk="time"] > span{background:none !important;border:none !important;box-shadow:none !important;color:${C.fog} !important;font-size:11.5px !important;letter-spacing:.15em !important;display:inline-flex !important;align-items:center !important;gap:8px !important}
[data-wk="time"] > span::before,[data-wk="time"] > span::after{content:"" !important;width:34px !important;height:12px !important;background:${svg(WHEAT)} center/contain no-repeat !important}
[data-wk="time"] > span::before{transform:scaleX(-1) !important}
/* 已读：一小块黄油；没读：一粒面包屑 */
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important;letter-spacing:.1em !important;display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"]::before{content:"" !important;width:9px !important;height:7px !important;border-radius:2.5px !important;background:${C.butter} !important;box-shadow:0 0 0 1px #E3B83A !important}
[data-wk="meta"][data-read="0"]::before{width:6px !important;height:6px !important;border-radius:50% !important;background:transparent !important;box-shadow:0 0 0 1.2px ${C.fog} !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]{flex-direction:row-reverse !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-run][data-last="1"] + [data-wk="cardmeta"]{display:block !important;font-size:10.5px !important;color:${C.fog} !important;padding:2px 0 0 66px !important}
[data-run][data-last="1"] + [data-wk="cardmeta"][data-me="1"]{text-align:right !important;padding:2px 66px 0 0 !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.crumb} !important;border:3px solid ${C.crust} !important;border-radius:12px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.crust} !important}

/* 动描：一张油纸（不是吐司），前面一根麦穗；我写的动作是果酱粉，靠右 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"],[data-wk="myactink"]{display:inline-block !important;position:relative !important;background:#F3ECDD !important;border:none !important;border-radius:4px !important;box-shadow:0 1px 0 ${C.line} !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;color:#8F7660 !important;opacity:1 !important;font-style:italic !important;font-size:12.5px !important;line-height:1.75 !important;padding:5px 14px 5px 34px !important}
[data-wk="narrink"]::before,[data-wk="myactink"]::before{content:"" !important;position:absolute !important;left:8px !important;top:9px !important;width:22px !important;height:9px !important;background:${svg(WHEAT)} center/contain no-repeat !important}
[data-wk="myactink"]{background:#FBE3E1 !important;color:#B2595C !important;padding:5px 14px 5px 14px !important}
[data-wk="myactink"]::before{content:none !important}
/* 系统提示 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.08em !important}
[data-wk="sysnotetext"]::before{content:"∙ " !important;color:${C.crust} !important}
[data-wk="sysnotetext"]::after{content:" ∙" !important;color:${C.crust} !important}
[data-wk="narrbar"]{background:#FFF8EA !important;border-top:1px solid ${C.line} !important}
[data-wk="narrkind"]{border:1px solid ${C.line} !important;border-radius:999px !important;background:transparent !important;color:${C.fog} !important}
[data-wk="narrkind"][data-on="1"]{background:${C.crust} !important;border-color:${C.crust} !important;color:#fff !important}

/* 底栏：一块面包板，顶上一道面包边；左麦穗加号、白吐司色输入框、右黄油刀发送、果酱吐司回复 */
[data-wk="composer"]{background:#FFF8EA !important;border-top:4px solid ${C.crust} !important;box-shadow:0 -3px 0 #F1D19C !important;align-items:center !important;gap:8px !important}
[data-wk="chatinput"]{background:#fff !important;border:1.5px solid ${C.line} !important;border-radius:12px !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:#CDBBA6 !important}
[data-wk="chatplus"]{width:30px !important;min-width:30px !important;height:30px !important;${HIDE};background:${svg(I_WHEAT)} center/contain no-repeat !important}
[data-wk="chatplus"] svg{display:none !important}
[data-wk="send"]{width:40px !important;min-width:40px !important;height:36px !important;${HIDE};background:${svg(I_KNIFE)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:38px !important;min-width:38px !important;height:34px !important;${HIDE};background:${svg(I_SLICE)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.92) !important}

/* 打电话那一屏（语音）：烤面包的暖黄；按键是一片片吐司，挂断是一罐果酱红 */
[data-wk="call"][data-video="0"]{background:radial-gradient(ellipse at 50% 22%,rgba(255,248,234,.55),transparent 60%),linear-gradient(180deg,#F1C88A,${C.gold2} 70%,#B8743F) !important}
[data-wk="call"][data-video="0"] > button:first-child{background:rgba(255,255,255,.25) !important}
[data-wk="calltitle"]{color:#fff !important;font-weight:600 !important;text-shadow:0 1px 0 rgba(154,98,54,.4) !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:0 0 0 6px ${C.yolk},0 0 0 20px #fff,12px 8px 0 20px #fff,-14px 10px 0 18px #fff,8px -14px 0 18px #fff,0 18px 30px 16px rgba(154,98,54,.3) !important}
[data-wk="callbtns"] button > span:first-child{background:#FFF3DC !important;border-radius:45% 45% 14px 14px / 40% 40% 14px 14px !important;box-shadow:0 0 0 3px ${C.crust},0 5px 0 3px ${C.crust2},0 10px 18px rgba(0,0,0,.2) !important}
[data-wk="callbtns"] button > span:first-child svg{stroke:${C.crust2} !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child{background:${C.jam} !important;border-radius:50% !important;box-shadow:0 0 0 3px #fff,0 5px 0 3px #B23F44,0 10px 18px rgba(0,0,0,.2) !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child svg{stroke:#fff !important}
[data-wk="callbubble"]{background:${C.crumb} !important;color:${C.ink} !important;border:2px solid ${C.crust} !important;border-radius:12px !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:${C.gold} !important;color:#fff !important;border-color:${C.crust2} !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="note"][data-part="callsum"]{display:block !important;margin:6px auto 0 !important;background:${C.crumb} !important;border:2px solid ${C.crust} !important;border-radius:12px !important;padding:8px 14px !important;color:#8F7660 !important;font-size:12px !important;line-height:1.65 !important;text-align:left !important}
[data-wk="noteink"]{color:${C.fog} !important}
[data-wk="callact"]{color:${C.crust} !important}
`;
const pack = { kind: "chat-look", v: 1, name: "黄油吐司", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "黄油吐司-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
