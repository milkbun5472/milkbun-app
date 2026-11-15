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
[data-wk="body"] button[data-wk="avatar"],[data-wk="body"] span[data-wk="avatar"]:not([data-halo]){position:relative !important;overflow:visible !important;box-shadow:0 0 0 5px #1A1A20,-4px 0 0 8px ${C.red},4px 0 0 8px ${C.cyan} !important;margin:8px 8px !important}
[data-wk="body"] button[data-wk="avatar"]::after,[data-wk="body"] span[data-wk="avatar"]:not([data-halo])::after{content:"" !important;position:absolute !important;inset:-8px -12px !important;background:${svg(RING)} center/100% 100% no-repeat !important;pointer-events:none !important;z-index:2 !important}

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
`;
const pack = { kind: "chat-look", v: 1, name: "信号故障", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "信号故障-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
