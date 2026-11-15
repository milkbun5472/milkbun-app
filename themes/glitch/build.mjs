// 信号故障：黑底扫描线；气泡是信号坏掉的屏幕——左边一道红、右边一道青、四角错位小方块，字带红青重影；头像是红青两层错开的圆环、中间被扯断几截。用法：node themes/glitch/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const X = s => `<svg xmlns='http://www.w3.org/2000/svg' ${s}</svg>`;
const C = { bg: "#0B0B0D", panel: "#17171B", red: "#FF2A55", cyan: "#19E6E6", ink: "#ECECEC", fog: "#7A7A82" };
const RGB = `-1.5px 0 0 ${C.red},1.5px 0 0 ${C.cyan}`;
const SCAN = `repeating-linear-gradient(180deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px)`;
// 屏幕上偶尔一条撕裂的横条
const TEAR = X(`width='390' height='420' viewBox='0 0 390 420'><rect x='0' y='120' width='390' height='3' fill='${C.cyan}' opacity='.5'/><rect x='60' y='124' width='300' height='1.5' fill='${C.red}' opacity='.6'/><rect x='140' y='310' width='250' height='2' fill='${C.red}' opacity='.4'/><rect x='0' y='313' width='180' height='1' fill='${C.cyan}' opacity='.4'/>`);
// 头像外圈：红青两层，各断几截
// 照参考：撕开的两条横带——带子里那截圆环被往左扯了一下，带子上下各一道细青线
const RING = X(`viewBox='0 0 100 100' preserveAspectRatio='none'><g><rect x='0' y='12' width='100' height='9' fill='#1A1A20'/><rect x='4' y='12' width='14' height='9' fill='${C.red}'/><rect x='70' y='12' width='14' height='9' fill='${C.cyan}'/><path d='M0 12 H100 M0 21 H100' stroke='${C.cyan}' stroke-width='.6' opacity='.5'/></g><g><rect x='0' y='80' width='100' height='8' fill='#1A1A20'/><rect x='2' y='80' width='12' height='8' fill='${C.red}'/><rect x='76' y='80' width='14' height='8' fill='${C.cyan}'/><path d='M0 80 H100 M0 88 H100' stroke='${C.cyan}' stroke-width='.6' opacity='.5'/></g>`);
// 气泡四角错位小方块
// 不画整圈框：只在左上一个红色折角、右下一个青色折角，像取景器
const BRACKETS = (a, b) => `linear-gradient(${a},${a}) left top/2px 12px no-repeat,linear-gradient(${a},${a}) left top/12px 2px no-repeat,linear-gradient(${b},${b}) right bottom/2px 12px no-repeat,linear-gradient(${b},${b}) right bottom/12px 2px no-repeat`;
const CORNERS = (a, b) => `linear-gradient(${a},${a}) left -3px top -3px/6px 6px no-repeat,linear-gradient(${b},${b}) right -3px bottom -3px/6px 6px no-repeat,linear-gradient(${a},${a}) left 4px bottom -3px/5px 4px no-repeat`;
// 按键
const I_PLUS = X(`viewBox='0 0 30 30'><path d='M13 5 H17 V13 H25 V17 H17 V25 H13 V17 H5 V13 H13Z' fill='${C.red}' transform='translate(-1.5 0)'/><path d='M13 5 H17 V13 H25 V17 H17 V25 H13 V17 H5 V13 H13Z' fill='${C.cyan}' transform='translate(1.5 0)' opacity='.85'/><path d='M13 5 H17 V13 H25 V17 H17 V25 H13 V17 H5 V13 H13Z' fill='#fff'/><rect x='3' y='14' width='24' height='2' fill='${C.bg}'/>`);
const I_SEND = X(`viewBox='0 0 36 36'><rect x='4' y='6' width='28' height='24' fill='#111' stroke='${C.red}' stroke-width='2' transform='translate(-1.5 0)'/><rect x='4' y='6' width='28' height='24' fill='none' stroke='${C.cyan}' stroke-width='2' transform='translate(1.5 0)'/><path d='M14 12 L24 18 L14 24Z' fill='#fff'/><rect x='8' y='17' width='20' height='1.6' fill='#111'/>`);
const I_REPLY = X(`viewBox='0 0 40 34'><rect x='3' y='5' width='34' height='20' fill='none' stroke='${C.red}' stroke-width='2' transform='translate(-1.5 0)'/><rect x='3' y='5' width='34' height='20' fill='none' stroke='${C.cyan}' stroke-width='2' transform='translate(1.5 0)'/><path d='M12 25 L9 31 L18 25' fill='${C.ink}'/><g fill='${C.ink}'><rect x='10' y='13' width='4' height='4'/><rect x='18' y='13' width='4' height='4'/><rect x='26' y='13' width='4' height='4'/></g>`);
const I_ANT = X(`viewBox='0 0 30 30'><rect x='4' y='11' width='22' height='15' fill='none' stroke='${C.ink}' stroke-width='1.6'/><path d='M10 4 L15 11 L20 4' stroke='${C.ink}' stroke-width='1.6' fill='none'/><g><rect x='7' y='14' width='16' height='2' fill='${C.red}'/><rect x='7' y='18' width='12' height='2' fill='${C.cyan}'/><rect x='9' y='22' width='14' height='1.6' fill='#fff' opacity='.6'/></g>`);
const I_BARS = X(`viewBox='0 0 30 30'><g fill='${C.ink}'><rect x='5' y='20' width='4' height='6'/><rect x='11' y='15' width='4' height='11'/></g><g fill='${C.fog}' opacity='.5'><rect x='17' y='10' width='4' height='16'/><rect x='23' y='5' width='4' height='21'/></g><path d='M17 6 L27 24 M27 6 L17 24' stroke='${C.red}' stroke-width='2'/>`);
// 好感：信号格——没信号（<20）→ 一格（20–49）→ 三格（50–79）→ 满格、外面一颗红青重影的心（80+）
const SIG = (n, heart) => X(`viewBox='0 0 92 84'><rect x='8' y='8' width='76' height='68' fill='#111' stroke='#333'/>${[0,1,2,3].map(i=>`<rect x='${20+i*14}' y='${58-i*12}' width='10' height='${12+i*12}' fill='${i<n?"#fff":"#2A2A30"}'/>`).join("")}${n?"":`<path d='M24 30 L68 66 M68 30 L24 66' stroke='${C.red}' stroke-width='3'/>`}${heart?`<g transform='translate(54 14)'><path d='M10 18 C2 12 1 9 1 7 C1 4 3 2 5.5 2 C7.5 2 9 3.2 10 4.6 C11 3.2 12.5 2 14.5 2 C17 2 19 4 19 7 C19 9 18 12 10 18Z' fill='${C.red}' transform='translate(-2 0)'/><path d='M10 18 C2 12 1 9 1 7 C1 4 3 2 5.5 2 C7.5 2 9 3.2 10 4.6 C11 3.2 12.5 2 14.5 2 C17 2 19 4 19 7 C19 9 18 12 10 18Z' fill='${C.cyan}' transform='translate(2 0)'/><path d='M10 18 C2 12 1 9 1 7 C1 4 3 2 5.5 2 C7.5 2 9 3.2 10 4.6 C11 3.2 12.5 2 14.5 2 C17 2 19 4 19 7 C19 9 18 12 10 18Z' fill='#fff'/></g>`:""}<rect x='8' y='40' width='76' height='3' fill='${C.bg}' opacity='.7'/>`);
const ST1 = SIG(0), ST2 = SIG(1), ST3 = SIG(3), ST4 = SIG(4, 1);
const TAG = (t, c) => `content:"${t}" !important;position:absolute !important;left:10px !important;top:6px !important;font:700 10px/1 ui-monospace,Menlo,monospace !important;letter-spacing:.15em !important;color:${c} !important;background:none !important;border:none !important;width:auto !important;height:auto !important;transform:none !important;z-index:3 !important`;
const CARD = `background:${"${BRACKETS(C.red, C.cyan)}"},${"${SCAN}"},rgba(30,30,36,.88) !important;border:none !important;border-radius:0 !important;box-shadow:none !important`;
const bubble = { myBg: "#F0F0F0", myText: "#111", myBorder: "none", charBg: C.panel, charText: C.ink, charBorder: "none", radius: 0, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };
const HIDE = `font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;border-radius:0 !important`;
const css = `
/* ───── 信号故障 · 第一批 ───── */
[data-wk="chat"]{background:${SCAN},${svg(TEAR)} 0 0/390px 420px,radial-gradient(ellipse at 50% 50%,#141418,${C.bg} 75%) !important}
[data-wk="body"]{background:transparent !important}
[data-wk="chat"] *{font-family:"PingFang SC","Microsoft YaHei",sans-serif}

/* 顶栏：一条黑色信号条，底边红青两道错开的线 */
[data-wk="chathead"]{background:${SCAN},#000 !important;border-bottom:none !important;box-shadow:0 1px 0 ${C.cyan},0 3px 0 ${C.red} !important}
[data-wk="headink"],[data-wk="headink"] *{color:#fff !important;text-shadow:${RGB} !important;letter-spacing:.1em !important;font-weight:700 !important}
[data-wk="headdim"],[data-wk="headname"] > div:last-child{color:${C.fog} !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="headname"] > div:last-child::before{content:"● REC  " !important;color:${C.red} !important}
[data-wk="chatback"] svg{stroke:#fff !important;filter:drop-shadow(-1.5px 0 0 ${C.red}) drop-shadow(1.5px 0 0 ${C.cyan}) !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:26px !important;min-width:26px !important;height:26px !important;flex-shrink:0 !important;${HIDE};background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_ANT)} center/contain no-repeat !important;margin-left:auto !important}
[data-wk="chatmore"]{background:${svg(I_BARS)} center/contain no-repeat !important;margin-left:4px !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chat"] [data-wk="chathead"] [data-wk="headme"]{display:inline-flex !important;margin-left:-6px !important}
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img,[data-wk="chathead"] [data-wk="avatar"]{width:32px !important;height:32px !important;min-width:32px !important;aspect-ratio:1 !important;border-radius:50% !important;box-shadow:-2px 0 0 1.5px ${C.red},2px 0 0 1.5px ${C.cyan} !important}
[data-wk="chathead"] [data-wk="headname"]{flex:1 1 auto !important;min-width:84px !important;margin-left:6px !important}

/* 头像：红青两层错开的圆环，各断几截 */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *,[data-wk="msg"] [data-wk="avatar"],[data-wk="cardrow"] [data-wk="avatar"],[data-wk="rpsingle"] [data-wk="avatar"]{border-radius:50% !important}
[data-wk="body"] button[data-wk="avatar"],[data-wk="body"] span[data-wk="avatar"]:not([data-halo]){position:relative !important;overflow:visible !important;box-shadow:-4px 0 0 3px ${C.red},4px 0 0 3px ${C.cyan} !important;margin:6px 8px !important}
[data-wk="body"] button[data-wk="avatar"]::after,[data-wk="body"] span[data-wk="avatar"]:not([data-halo])::after{content:"" !important;position:absolute !important;inset:-4px -9px !important;background:${svg(RING)} center/100% 100% no-repeat !important;pointer-events:none !important;z-index:2 !important}

/* 气泡：信号坏掉的屏幕——左红右青竖条、四角错位小方块、字带红青重影；我的是一块亮白屏 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:0 !important;line-height:1.6 !important;letter-spacing:.06em !important;font-weight:600 !important;padding:10px 18px !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${BRACKETS(C.red, C.cyan)},${SCAN},rgba(30,30,36,.85) !important;color:#fff !important;border:none !important;text-shadow:${RGB} !important;box-shadow:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${BRACKETS(C.red, C.cyan)},repeating-linear-gradient(180deg,rgba(0,0,0,.06) 0 1px,transparent 1px 3px),rgba(226,228,232,.92) !important;color:#111 !important;border:none !important;text-shadow:-1px 0 0 rgba(255,42,85,.6),1px 0 0 rgba(25,230,230,.6) !important;box-shadow:none !important}
/* 偶尔一抖：整块往旁边错一下 */
[data-wk="msg"]:nth-child(4n+2) [data-wk="bubble"][data-kind="text"]{animation:glJit 5s steps(1) infinite !important}
[data-wk="msg"]:nth-child(4n) [data-wk="bubble"][data-kind="text"]{animation:glJit 7s steps(1) infinite -3s !important}
@keyframes glJit{0%,92%{transform:none}93%{transform:translateX(3px)}95%{transform:translateX(-2px) skewX(-4deg)}97%,100%{transform:none}}
[data-wk="bubble"][data-kind="text"]::before,[data-wk="bubble"][data-kind="text"]::after{content:none !important}

/* 时间：一行等宽小字，前面一个红点 */
[data-wk="time"] > span{background:none !important;border:none !important;box-shadow:none !important;color:${C.fog} !important;font-family:ui-monospace,Menlo,monospace !important;font-size:11px !important;letter-spacing:.15em !important}
[data-wk="time"] > span::before{content:"▶ " !important;color:${C.red} !important}
/* 已读：一小格红青条；送达：一个空心圈 */
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important;letter-spacing:.1em !important;display:inline-flex !important;align-items:center !important;gap:6px !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="meta"]::before{content:"" !important;width:16px !important;height:6px !important;background:linear-gradient(90deg,${C.red} 0 50%,${C.cyan} 50%) !important}
[data-wk="meta"][data-read="0"]::before{width:7px !important;height:7px !important;border-radius:50% !important;background:transparent !important;box-shadow:0 0 0 1.2px ${C.fog} !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]{flex-direction:row-reverse !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-run][data-last="1"] + [data-wk="cardmeta"]{display:block !important;font-size:10.5px !important;color:${C.fog} !important;padding:2px 0 0 62px !important}
[data-run][data-last="1"] + [data-wk="cardmeta"][data-me="1"]{text-align:right !important;padding:2px 62px 0 0 !important}
[data-wk="bubble"][data-kind="typing"]{background:${BRACKETS(C.red, C.cyan)},rgba(30,30,36,.85) !important;border:none !important;border-radius:0 !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:#fff !important;border-radius:0 !important;box-shadow:-1px 0 0 ${C.red},1px 0 0 ${C.cyan} !important}

/* 动描：一段字幕——黑底半透明一条，等宽灰字，前后各一个方括号 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"],[data-wk="myactink"]{display:inline-block !important;background:rgba(0,0,0,.55) !important;border:none !important;border-radius:0 !important;box-shadow:none !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;color:#B9B9C0 !important;opacity:1 !important;font-style:normal !important;font-family:ui-monospace,Menlo,monospace !important;font-size:12px !important;line-height:1.75 !important;padding:4px 12px !important}
[data-wk="narrink"]::before,[data-wk="myactink"]::before{content:"[ " !important;color:${C.cyan} !important}
[data-wk="narrink"]::after,[data-wk="myactink"]::after{content:" ]" !important;color:${C.red} !important}
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-family:ui-monospace,Menlo,monospace !important;font-size:11px !important;font-style:normal !important}
[data-wk="sysnotetext"]::before{content:"ERR · " !important;color:${C.red} !important}
[data-wk="narrbar"]{background:#000 !important;border-top:1px solid #222 !important}
[data-wk="narrkind"]{border:1px solid #333 !important;border-radius:0 !important;background:transparent !important;color:${C.fog} !important}
[data-wk="narrkind"][data-on="1"]{border-color:${C.cyan} !important;color:#fff !important;box-shadow:-2px 0 0 ${C.red} !important}

/* 底栏：黑色信号条；左红青十字加号、黑框输入框、右红青重影的播放键发送、像素对话框回复 */
[data-wk="composer"]{background:${SCAN},#000 !important;border-top:none !important;box-shadow:0 -1px 0 ${C.red},0 -3px 0 ${C.cyan} !important;align-items:center !important;gap:8px !important}
[data-wk="chatinput"]{background:${BRACKETS(C.red, C.cyan)},#141418 !important;border:none !important;border-radius:0 !important;color:#fff !important}
[data-wk="chatinput"]::placeholder{color:#555 !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="chatplus"]{width:28px !important;min-width:28px !important;height:28px !important;${HIDE};background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="chatplus"] svg{display:none !important}
[data-wk="send"]{width:36px !important;min-width:36px !important;height:36px !important;${HIDE};background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:40px !important;min-width:40px !important;height:34px !important;${HIDE};background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}

/* 打电话那一屏：黑底扫描线；三个键是红青错开的方块 */
[data-wk="call"][data-video="0"]{background:${SCAN},${svg(TEAR)} 0 0/390px 420px,#000 !important}
[data-wk="calltitle"]{color:#fff !important;text-shadow:${RGB} !important;letter-spacing:.15em !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:-5px 0 0 3px ${C.red},5px 0 0 3px ${C.cyan},0 0 30px rgba(25,230,230,.3) !important}
[data-wk="callbtns"] button > span:first-child{background:#111 !important;border-radius:0 !important;box-shadow:-3px 0 0 ${C.red},3px 0 0 ${C.cyan} !important}
[data-wk="callbtns"] button > span:first-child svg{stroke:#fff !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child{background:${C.red} !important;box-shadow:3px 3px 0 ${C.cyan} !important}
[data-wk="call"][data-video="0"] [data-wk="callbtns"] button > span:last-child{color:${C.fog} !important}
[data-wk="callbubble"]{background:${BRACKETS(C.red, C.cyan)},rgba(30,30,36,.85) !important;color:#fff !important;border:none !important;border-radius:0 !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:${BRACKETS(C.red, C.cyan)},rgba(226,228,232,.92) !important;color:#111 !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="note"][data-part="callsum"]{display:block !important;margin:6px auto 0 !important;background:rgba(0,0,0,.55) !important;border:none !important;border-left:3px solid ${C.cyan} !important;border-radius:0 !important;padding:8px 14px !important;color:#B9B9C0 !important;font-family:ui-monospace,Menlo,monospace !important;font-size:11.5px !important;text-align:left !important}
[data-wk="noteink"]{color:${C.fog} !important}
[data-wk="callact"]{color:${C.cyan} !important}

/* ───── 信号故障 · 第二批：卡片（形状不动；每张都是一块取景器框住的暗屏，左上角写着它是什么） ───── */
[data-wk="transfercard"],[data-wk="photocard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"],[data-wk="wxcard"]{position:relative !important;overflow:visible !important;background:${BRACKETS(C.red, C.cyan)},${SCAN},rgba(30,30,36,.88) !important;border:none !important;border-radius:0 !important;box-shadow:none !important;color:#fff !important;padding-top:22px !important}
[data-wk="transfercard"] *,[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *,[data-wk="photocard"] *,[data-wk="wxcard"] *{color:#E6E6EA !important;border-color:#2C2C33 !important}
[data-wk="transfercard"]::before{${TAG("TRANSFER", C.cyan)}}
[data-wk="photocard"]::before{${TAG("IMG_0001", C.cyan)}}
[data-wk="wxcard"]::before{${TAG("WEATHER.LOG", C.cyan)}}
[data-wk="namecard"]::before{${TAG("CONTACT", C.cyan)}}
[data-part="offlog"]::before{${TAG("REPLAY", C.red)}}
[data-wk="transferamount"],[data-wk="transfercur"]{color:#fff !important;text-shadow:${RGB} !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="transferrule"]{border:none !important;height:1px !important;background:linear-gradient(90deg,${C.red},${C.cyan}) !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:transparent !important;border-top:1px solid #2C2C33 !important}
[data-wk="transferbtn"]{border-radius:0 !important;background:transparent !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="transferbtn"][data-part="take"]{border:1px solid ${C.cyan} !important;color:${C.cyan} !important;box-shadow:-2px 0 0 ${C.red} !important}
[data-wk="transferbtn"][data-part="back"]{border:1px solid #444 !important;color:${C.fog} !important}
[data-wk="transferseal"]{background:transparent !important;border:2px solid ${C.cyan} !important;border-radius:0 !important;color:${C.cyan} !important;box-shadow:-3px 0 0 ${C.red} !important;font-family:ui-monospace,Menlo,monospace !important;transform:rotate(-6deg) !important}
[data-wk="transferseal"] *{color:${C.cyan} !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.45 !important}
/* 红包：一块红色的报错屏，左边一个 ⚠；领完变灰 */
[data-wk="rpcard"]{position:relative !important;overflow:visible !important;background:${BRACKETS("#fff", C.cyan)},${SCAN},linear-gradient(90deg,#8E1430,${C.red}) !important;border:none !important;border-radius:0 !important;box-shadow:3px 3px 0 ${C.cyan} !important;padding-left:52px !important}
[data-wk="rpcard"]::before{content:"⚠" !important;position:absolute !important;left:16px !important;top:calc(50% - 14px) !important;font-size:24px !important;line-height:28px !important;color:#fff !important;text-shadow:${RGB} !important}
[data-wk="rpcard"] *{color:#fff !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"][data-status="done"]{filter:grayscale(1) !important;opacity:.6 !important}
[data-wk="rpenvelope"]{background:${SCAN},linear-gradient(180deg,#8E1430,#3A0614) !important;border:none !important;border-radius:0 !important;box-shadow:-6px 0 0 ${C.red},6px 0 0 ${C.cyan} !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:transparent !important;border:none !important}
[data-wk="rpenvelope"] *{color:#fff !important}
[data-wk="rpopenbtn"]{background:#000 !important;border:2px solid #fff !important;border-radius:0 !important;box-shadow:-4px 0 0 ${C.red},4px 0 0 ${C.cyan} !important}
[data-wk="rpopenbtn"] *{color:#fff !important}
[data-wk="rpamount"]{color:#fff !important;text-shadow:${RGB} !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="rpavatar"],[data-wk="rpavatar"] *{border-radius:50% !important}
[data-wk="rpavatar"]{box-shadow:0 0 0 4px #1A1A20,-4px 0 0 7px ${C.red},4px 0 0 7px ${C.cyan} !important}
/* 照片：一块雪花屏 */
[data-wk="photocard"]{padding:22px 8px 10px !important}
[data-wk="photoface"]{border-radius:0 !important;background:repeating-linear-gradient(180deg,rgba(255,255,255,.08) 0 1px,transparent 1px 2px),repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px),#222 !important;border:none !important;box-shadow:none !important}
[data-wk="photoface"] *,[data-wk="photohint"]{color:#C8C8D0 !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="photoface"] svg{stroke:${C.cyan} !important}
[data-wk="photocard"] > img{border-radius:0 !important;filter:contrast(1.1) saturate(.9) !important;box-shadow:-3px 0 0 ${C.red},3px 0 0 ${C.cyan} !important}
/* 语音：一条示波器 */
[data-wk="voice"][data-me]{background:${BRACKETS(C.red, C.cyan)},${SCAN},rgba(30,30,36,.88) !important;border:none !important;border-radius:0 !important;box-shadow:none !important}
[data-wk="voice"][data-me="1"]{background:${BRACKETS(C.red, C.cyan)},repeating-linear-gradient(180deg,rgba(0,0,0,.06) 0 1px,transparent 1px 3px),rgba(226,228,232,.92) !important;border:none !important;border-radius:0 !important;box-shadow:none !important}
[data-wk="voice"] > *{background:transparent !important;border:none !important;box-shadow:none !important;color:#E6E6EA !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="voice"][data-me="1"] > *{color:#111 !important}
[data-wk="voicewave"] span{background:${C.cyan} !important;border-radius:0 !important;box-shadow:-1px 0 0 ${C.red} !important}
[data-wk="voice"][data-me="1"] [data-wk="voicewave"] span{background:#111 !important}
/* 天气 */
[data-wk="wxcardsky"]{background:transparent !important}
[data-wk="wxcardsky"] > div:first-child{background:radial-gradient(circle,#fff 0 8px,transparent 9px) -2px 0/100% 100% no-repeat,radial-gradient(circle,${C.red} 0 8px,transparent 9px),radial-gradient(circle,${C.cyan} 0 8px,transparent 9px) 4px 0/100% 100% no-repeat !important}
[data-wk="wxcardsky"] svg{stroke:#fff !important;filter:drop-shadow(-1.5px 0 0 ${C.red}) drop-shadow(1.5px 0 0 ${C.cyan}) !important}
[data-wk="wxcardsky"] span[style*="999"],[data-wk="wxcardrain"]{background:#111 !important;border:1px solid #333 !important;border-radius:0 !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="wxcardtemp"]{text-shadow:${RGB} !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="wxcardsay"]{background:rgba(0,0,0,.5) !important;border-top:1px solid #2C2C33 !important}
[data-wk="geopin"]{background:${C.red} !important;box-shadow:3px 0 0 ${C.cyan} !important;border-radius:0 !important}
[data-wk="geopinstem"]{background:#fff !important}
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 3px #1A1A20,-3px 0 0 5px ${C.red},3px 0 0 5px ${C.cyan} !important}
[data-run][data-last="1"] + [data-wk="cardmeta"]::before{content:"" !important;display:inline-block !important;vertical-align:middle !important;width:16px !important;height:6px !important;margin:0 6px !important;background:linear-gradient(90deg,${C.red} 0 50%,${C.cyan} 50%) !important}
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;border:none !important;background:rgba(0,0,0,.55) !important;border-radius:0 !important;padding:2px 12px !important;color:#B9B9C0 !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="note"][data-part="call"] svg{stroke:#B9B9C0 !important}
[data-wk="offlogtitle"]{color:#fff !important;text-shadow:${RGB} !important;letter-spacing:.15em !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.cyan} !important}
[data-wk="offlogtranscript"]{border-top:1px solid #2C2C33 !important}
/* 加号面板：一格格暗屏，图标带红青重影 */
[data-wk="chatpanel"]{background:${SCAN},#000 !important;border-top:1px solid #222 !important}
[data-wk="chattoolicon"]{background:${BRACKETS(C.red, C.cyan)},${SCAN},rgba(30,30,36,.88) !important;border:none !important;border-radius:0 !important;box-shadow:none !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:#fff !important;color:#fff !important;filter:drop-shadow(-1.5px 0 0 ${C.red}) drop-shadow(1.5px 0 0 ${C.cyan}) !important}
[data-wk="chattoollabel"]{color:${C.fog} !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="quotedraft"]{background:#000 !important;border-top:1px solid #222 !important}
[data-wk="quote"]{background:#141418 !important;color:#B9B9C0 !important;border:none !important;border-left:2px solid ${C.red} !important;border-radius:0 !important;opacity:1 !important;box-shadow:inset 2px 0 0 ${C.cyan} !important}
[data-wk="quoteicon"],[data-wk="quoteclear"]{color:${C.cyan} !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid currentColor !important;padding-left:8px !important;opacity:.7 !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:26px !important;min-width:26px !important;height:26px !important;background:${svg(I_ANT)} center/contain no-repeat !important;${HIDE}}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:30px !important;min-width:30px !important;height:30px !important;${HIDE};background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}

/* ───── 信号故障 · 第三批：状态卡是一块监控屏——黑底扫描线、左上 REC；好感是信号格 ───── */
[data-wk="statecard"]{position:relative !important;background:${SCAN},#0B0B0D !important;border:none !important;border-radius:0 !important;box-shadow:-5px 0 0 ${C.red},5px 0 0 ${C.cyan},0 20px 40px rgba(0,0,0,.6) !important;color:#fff !important}
[data-wk="statehead"]{background:#000 !important;border-bottom:none !important;box-shadow:0 1px 0 ${C.cyan},0 3px 0 ${C.red} !important}
[data-wk="statehead"] *{color:#fff !important}
[data-wk="statehead"] [data-wk="avatar"]{border-radius:50% !important;box-shadow:0 0 0 4px #1A1A20,-4px 0 0 7px ${C.red},4px 0 0 7px ${C.cyan} !important}
[data-wk="statehead"] button{border:1px solid #444 !important;border-radius:0 !important;background:#111 !important}
[data-wk="statemood"]{display:inline-block !important;background:transparent !important;color:${C.red} !important;padding:0 8px !important;margin-right:4px !important;border:1px solid ${C.red} !important;border-radius:0 !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="statemood"]::before{content:"● " !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:#111 !important;border:1px solid #2C2C33 !important;border-radius:0 !important;padding:3px !important;margin:14px 16px !important}
[data-wk="statecard"] button[aria-pressed]{color:${C.fog} !important;border:none !important;border-radius:0 !important;background:transparent !important;font-family:ui-monospace,Menlo,monospace !important;letter-spacing:.15em !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:#fff !important;color:#000 !important;box-shadow:-3px 0 0 ${C.red},3px 0 0 ${C.cyan} !important}
[data-wk="stateseen"]{position:relative !important;background:${BRACKETS(C.red, C.cyan)},${SCAN},rgba(30,30,36,.88) !important;border:none !important;border-radius:0 !important;box-shadow:none !important;margin:14px 16px 12px !important}
[data-wk="statevoice"]{position:relative !important;background:${BRACKETS(C.red, C.cyan)},repeating-linear-gradient(180deg,rgba(0,0,0,.06) 0 1px,transparent 1px 3px),rgba(226,228,232,.92) !important;border:none !important;border-radius:0 !important;box-shadow:none !important;margin:14px 16px 12px !important}
[data-wk="stateseen"] *{color:#E6E6EA !important}
[data-wk="statevoice"] *{color:#111 !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:#000 !important;border:1px solid #2C2C33 !important;border-radius:0 !important}
[data-wk="statewear"] > span{background:transparent !important;border:none !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:${C.red} !important}
[data-wk="statevoice"] + div > button{background:#111 !important;color:#fff !important;border:1px solid #333 !important;border-radius:0 !important}
[data-wk="stateaff"]{background:#000 !important;border-top:1px solid #222 !important;position:relative !important;display:block !important;padding:16px 120px 18px 20px !important;min-height:112px !important}
[data-wk="stateaff"] *{color:#E6E6EA !important}
[data-wk="stateheart"]{position:absolute !important;right:18px !important;left:auto !important;top:50% !important;margin-top:-44px !important;width:92px !important;height:84px !important;--sc-heart-mask:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><rect width='10' height='10'/></svg>`)} !important}
[data-wk="stateheart"] > div,[data-wk="stateheartknob"]{inset:0 !important;-webkit-mask-size:100% 100% !important;mask-size:100% 100% !important;background-color:transparent !important;border:none !important}
[data-wk="stateheart"] > div:not([data-wk]){display:none !important}
[data-wk="stateheartfill"] > div{display:none !important}
[data-wk="stateheartline"]{background:${svg(ST1)} center/contain no-repeat !important;opacity:calc(1 - clamp(0,(var(--sc-heart-lvl) - 0.195)*1000,1)) !important}
[data-wk="stateheartbase"]{background:${svg(ST2)} center/contain no-repeat !important;opacity:calc(clamp(0,(var(--sc-heart-lvl) - 0.195)*1000,1) - clamp(0,(var(--sc-heart-lvl) - 0.495)*1000,1)) !important}
[data-wk="stateheartfill"]{background:${svg(ST3)} center/contain no-repeat !important;opacity:calc(clamp(0,(var(--sc-heart-lvl) - 0.495)*1000,1) - clamp(0,(var(--sc-heart-lvl) - 0.795)*1000,1)) !important}
[data-wk="stateheartknob"]{display:block !important;position:absolute !important;left:0 !important;bottom:0 !important;width:100% !important;height:100% !important;margin:0 !important;transform:none !important;background:${svg(ST4)} center/contain no-repeat !important;opacity:calc(clamp(0,(var(--sc-heart-lvl) - 0.795)*1000,1)) !important}
[data-wk="stateheartnum"]{position:absolute !important;inset:auto 0 -10px 0 !important;display:flex !important;justify-content:center !important;padding:0 !important;font:700 12px/1 ui-monospace,Menlo,monospace !important;color:#fff !important;-webkit-text-stroke:0 !important;text-shadow:${RGB} !important;z-index:3 !important}
[data-wk="stateaffval"]{display:none !important}
/* 翻旧的：一段段录像回放，左上「REC_001」 */
[data-wk="statehistbtn"]{background:#111 !important;color:#fff !important;border:1px solid #333 !important;border-radius:0 !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 14px !important}
[data-wk="statehisthead"] > :first-child{color:#E6E6EA !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="statehistlist"]{counter-reset:pg !important}
[data-wk="statehistitem"]{counter-increment:pg !important;position:relative !important;background:${BRACKETS(C.red, C.cyan)},${SCAN},rgba(30,30,36,.88) !important;border:none !important;border-radius:0 !important;box-shadow:none !important;padding:26px 16px 12px !important;margin:12px 0 !important}
[data-wk="statehistitem"] *{color:#E6E6EA !important}
[data-wk="statehistitem"]::before{content:"REC_00" counter(pg) !important;position:absolute !important;left:12px !important;top:7px !important;font:700 10px/1 ui-monospace,Menlo,monospace !important;letter-spacing:.15em !important;color:${C.red} !important}
[data-wk="statehistmood"]{background:transparent !important;border:1px solid ${C.cyan} !important;color:${C.cyan} !important;border-radius:0 !important;padding:0 6px !important}
[data-wk="statehisttime"]{opacity:.6 !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="statehistmeta"]{background:rgba(255,255,255,.05) !important;border-radius:0 !important}
[data-wk="statehistend"]{color:${C.fog} !important;letter-spacing:.3em !important;font-family:ui-monospace,Menlo,monospace !important}
/* Ta 眼里：贴条换成一小截红青胶条 */
[data-wk="gazepage"]{background:${SCAN},#0B0B0D !important}
[data-wk="gazetitle"]{color:#fff !important;text-shadow:${RGB} !important}
[data-wk="gazetab"]{background:#111 !important;color:${C.fog} !important;border:1px solid #2C2C33 !important;border-radius:0 !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:#fff !important;color:#000 !important;box-shadow:-3px 0 0 ${C.red},3px 0 0 ${C.cyan} !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:${C.fog} !important}
[data-wk="gazecard"]{position:relative !important;overflow:visible !important;DARK}
[data-wk="gazetape"]{background:linear-gradient(90deg,${C.red} 0 50%,${C.cyan} 50%) !important;width:28px !important;height:8px !important;border-radius:0 !important;box-shadow:none !important;border:none !important}
[data-wk="gazecardname"]{color:#fff !important;text-shadow:${RGB} !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:#A0A0A8 !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{background:${BRACKETS(C.red, C.cyan)},${SCAN},rgba(30,30,36,.88) !important;border:none !important;border-radius:0 !important;box-shadow:none !important;color:#E6E6EA !important}
[data-wk="gazeletter"] *,[data-wk="gazehistory"] *{color:#E6E6EA !important}
[data-wk="gazeempty"]{background:#111 !important;color:#E6E6EA !important;border:1px solid #2C2C33 !important;border-radius:0 !important}
[data-wk="gazeempty"] *{color:#E6E6EA !important}
[data-wk="gazeempty"] button{background:#fff !important;color:#000 !important;border:none !important;border-radius:0 !important;box-shadow:-3px 0 0 ${C.red},3px 0 0 ${C.cyan} !important}

/* ───── 线下：同一块黑屏；他暗屏卡、我亮屏卡，都是取景器折角；说的话下面一道红青线，心里话灰色等宽 ───── */
[data-wk="offline"]:not([style*="url("]){background:${SCAN},${svg(TEAR)} 0 0/390px 420px,#0B0B0D !important;background-color:#0B0B0D !important}
[data-wk="offline"] [data-wk="offbody"]{background:transparent !important}
[data-wk="offline"] [data-wk="offtitle"],[data-wk="offline"] [data-wk="offtitle"] *{color:#fff !important}
[data-wk="offline"] [data-wk="chathead"] button:last-child:not([data-wk]){background:#000 !important;color:${C.red} !important;border:1px solid ${C.red} !important;border-radius:0 !important;font-size:12px !important;padding:3px 10px !important;flex-shrink:0 !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="offcomposer"]{background:${SCAN},#000 !important;border:none !important;box-shadow:0 -1px 0 ${C.red},0 -3px 0 ${C.cyan} !important}
[data-wk="offcomposer"] textarea{background:${BRACKETS(C.red, C.cyan)},#141418 !important;border:none !important;border-radius:0 !important;color:#fff !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]){width:36px !important;min-width:36px !important;height:36px !important;background:${svg(I_SEND)} center/contain no-repeat !important;${HIDE}}
[data-wk="offcomposer"] button:not([title]):not([data-wk]) *{opacity:0 !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]{width:38px !important;min-width:38px !important;height:32px !important;${HIDE};background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"] *{opacity:0 !important}
[data-wk="offcard"]{position:relative !important;overflow:visible !important;DARK}
[data-wk="offcard"][data-me="1"]{background:${BRACKETS(C.red, C.cyan)},repeating-linear-gradient(180deg,rgba(0,0,0,.06) 0 1px,transparent 1px 3px),rgba(226,228,232,.92) !important;border:none !important;border-radius:0 !important;box-shadow:none !important}
[data-wk="offhead"] img,[data-wk="offhead"] [data-wk="avatar"]{border-radius:50% !important;box-shadow:0 0 0 3px #1A1A20,-3px 0 0 5px ${C.red},3px 0 0 5px ${C.cyan} !important}
[data-wk="offname"]{color:#fff !important;text-shadow:${RGB} !important;font-weight:700 !important}
[data-wk="offcard"][data-me="1"] [data-wk="offname"]{color:#111 !important}
[data-wk="offtext"]{color:#D4D4DA !important}
[data-wk="offcard"][data-me="1"] [data-wk="offtext"]{color:#222 !important}
[data-wk="offsay"]{color:#fff !important;background:none !important;border:none !important;font-weight:700 !important;text-shadow:${RGB} !important}
[data-wk="offcard"][data-me="1"] [data-wk="offsay"]{color:#111 !important;text-shadow:-1px 0 0 rgba(255,42,85,.6),1px 0 0 rgba(25,230,230,.6) !important}
[data-wk="offthought"]{background:transparent !important;border:none !important;color:#8A8A92 !important;font-style:normal !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="offcard"][data-me="1"] [data-wk="offthought"]{color:#666 !important}
[data-wk="offcardacts"] svg{stroke:${C.fog} !important;color:${C.fog} !important}
[data-wk="offreplyopt"]{background:${BRACKETS(C.red, C.cyan)},${SCAN},rgba(30,30,36,.88) !important;border:none !important;border-radius:0 !important;box-shadow:none !important;color:#fff !important}

/* Ta 眼里那几张白卡：标题去掉重影（白底上太费眼），只在左边留一道红青短线 */
[data-wk="gazecard"]{background:#FBFBF8 !important;box-shadow:none !important}
[data-wk="gazecardname"]{color:#111 !important;text-shadow:none !important;font-weight:700 !important;border-left:3px solid ${C.red} !important;box-shadow:-6px 0 0 -3px ${C.cyan} !important;padding-left:8px !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:#555 !important}

/* 线下他那张卡：加一层选择器压过线下文风自带的白卡；正文字放清楚，重影只留一点点 */
[data-wk="offline"] [data-wk="offcard"][data-me="0"],[data-wk="offbody"] [data-wk="offcard"][data-me="0"]{background:${BRACKETS(C.red, C.cyan)},${SCAN},#1E1E24 !important;border:none !important;border-left:none !important;border-radius:0 !important;box-shadow:none !important}
[data-wk="offline"] [data-wk="offcard"][data-me="0"] [data-wk="offtext"],[data-wk="offline"] [data-wk="offcard"][data-me="0"] [data-wk="offtext"] *{color:#E4E4EA !important}
[data-wk="offline"] [data-wk="offcard"][data-me="0"] [data-wk="offname"]{color:#fff !important}
[data-wk="offline"] [data-wk="offsay"]{color:#fff !important;text-shadow:-1px 0 0 rgba(255,42,85,.55),1px 0 0 rgba(25,230,230,.55) !important;font-weight:600 !important}
[data-wk="offline"] [data-wk="offcard"][data-me="1"] [data-wk="offsay"]{color:#111 !important;text-shadow:none !important;border-bottom:2px solid ${C.red} !important}
[data-wk="offline"] [data-wk="offcard"][data-me="0"] [data-wk="offthought"]{color:#9A9AA2 !important}
[data-wk="offline"] [data-wk="offname"]{text-shadow:none !important}
`;
const pack = { kind: "chat-look", v: 1, name: "信号故障", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "信号故障-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
