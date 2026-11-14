// 系统弹窗：老电脑的青绿桌面；每个气泡是一扇老系统的弹窗——灰色凸起的窗体、顶上一条标题栏（他深蓝「Ta.exe」、我紫红「ni.txt」）、右上一个关闭键；头像嵌在凸起的灰按钮里；已读是进度条走满。用法：node themes/popup/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const X = s => `<svg xmlns='http://www.w3.org/2000/svg' ${s}</svg>`;
const C = { desk: "#008080", grey: "#C0C0C0", dark: "#808080", black: "#0A0A0A", navy: "#000080", navy2: "#1084D0", plum: "#800080", plum2: "#D050C8", ink: "#111", tip: "#FFFFE1" };
// 凸起 / 凹下的老式立体边（全用 box-shadow 画）
const UP = `inset -1px -1px 0 ${C.black},inset 1px 1px 0 #fff,inset -2px -2px 0 ${C.dark},inset 2px 2px 0 #DFDFDF`;
const DOWN = `inset 1px 1px 0 ${C.dark},inset -1px -1px 0 #fff,inset 2px 2px 0 ${C.black},inset -2px -2px 0 #DFDFDF`;
const XBTN = X(`viewBox='0 0 16 14'><rect width='16' height='14' fill='${C.grey}'/><path d='M0 13.5 H15.5 V0' stroke='${C.black}' fill='none'/><path d='M0 13 V0.5 H15' stroke='#fff' fill='none'/><path d='M4.5 3.5 L11 10 M11 3.5 L4.5 10' stroke='${C.black}' stroke-width='1.8'/>`);
// 按键
const I_FLOPPY = X(`viewBox='0 0 30 30'><path d='M4 4 H23 L26 7 V26 H4Z' fill='#2B3A8C' stroke='${C.black}' stroke-width='1.2'/><rect x='8' y='4' width='13' height='8' fill='${C.grey}' stroke='${C.black}' stroke-width='1'/><rect x='17' y='5.5' width='2.6' height='5' fill='#2B3A8C'/><rect x='7' y='16' width='16' height='10' fill='#fff' stroke='${C.black}' stroke-width='1'/><path d='M9 19 H21 M9 22 H18' stroke='#888' stroke-width='1'/>`);
const I_OK = X(`viewBox='0 0 46 30'><rect x='1' y='1' width='44' height='28' fill='#000'/><rect x='2' y='2' width='42' height='26' fill='${C.grey}'/><path d='M2 27 V2 H43' stroke='#fff' stroke-width='2' fill='none'/><path d='M3 27 H43 V3' stroke='${C.dark}' stroke-width='1.5' fill='none'/><text x='23' y='20' text-anchor='middle' font-family='Tahoma,Verdana,sans-serif' font-size='12' font-weight='700' fill='#000'>OK</text>`);
const I_INFO = X(`viewBox='0 0 34 34'><path d='M17 3 C25 3 31 8.5 31 15.5 C31 22.5 25 28 17 28 C15.5 28 14 27.8 12.6 27.4 L6 31 L7.6 25 C4.8 22.6 3 19.3 3 15.5 C3 8.5 9 3 17 3Z' fill='#fff' stroke='${C.black}' stroke-width='1.4'/><circle cx='17' cy='15.5' r='9' fill='#1E5BD8'/><circle cx='17' cy='11' r='1.7' fill='#fff'/><rect x='15.6' y='14' width='2.8' height='7.5' fill='#fff'/>`);
const I_PC = X(`viewBox='0 0 30 30'><rect x='3' y='4' width='24' height='17' fill='${C.grey}' stroke='${C.black}' stroke-width='1.2'/><rect x='6' y='7' width='18' height='11' fill='${C.desk}'/><rect x='11' y='21' width='8' height='3' fill='${C.dark}'/><rect x='6' y='24' width='18' height='3' fill='${C.grey}' stroke='${C.black}' stroke-width='1'/>`);
const I_FOLDER = X(`viewBox='0 0 30 30'><path d='M3 8 H11 L13 10 H27 V25 H3Z' fill='#F4D35E' stroke='${C.black}' stroke-width='1.2'/><path d='M3 13 H27' stroke='#C9A227' stroke-width='1.2'/>`);
const HOURGLASS = X(`viewBox='0 0 12 16'><path d='M1 1 H11 M1 15 H11' stroke='#000' stroke-width='1.6'/><path d='M2.5 1.5 H9.5 C9.5 5 6.5 6.5 6 8 C6.5 9.5 9.5 11 9.5 14.5 H2.5 C2.5 11 5.5 9.5 6 8 C5.5 6.5 2.5 5 2.5 1.5Z' fill='#fff' stroke='#000' stroke-width='1'/><path d='M4 13.5 H8 L6 10.5Z' fill='#C9A227'/>`);
const bubble = { myBg: C.grey, myText: C.ink, myBorder: "none", charBg: C.grey, charText: C.ink, charBorder: "none", radius: 0, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };
const HIDE = `font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;border-radius:0 !important`;
// 头像：方的，嵌在一个凸起的灰按钮里
const AV = `0 0 0 2px ${C.dark},0 0 0 7px ${C.grey},-1px -1px 0 7px #fff,1px 1px 0 8px ${C.black},5px 5px 0 8px rgba(0,0,0,.25)`;
const css = `
/* ───── 系统弹窗 · 第一批 ───── */
[data-wk="chat"]{background:${C.desk} !important}
[data-wk="body"]{background:transparent !important}
[data-wk="chat"] *{font-family:Tahoma,"Microsoft YaHei","PingFang SC",sans-serif !important}

/* 顶栏：一条老窗口的标题栏——深蓝渐变、白字；右边两个键是「我的电脑」和文件夹 */
[data-wk="chathead"]{background:linear-gradient(90deg,${C.navy},${C.navy2}) !important;border-bottom:3px solid ${C.grey} !important;box-shadow:0 1px 0 #fff,0 4px 0 ${C.dark} !important}
[data-wk="headink"],[data-wk="headink"] *{color:#fff !important;font-weight:700 !important}
[data-wk="headdim"],[data-wk="headname"] > div:last-child{color:#BFD4FF !important}
[data-wk="chatback"]{background:${C.grey} !important;box-shadow:${UP} !important;border-radius:0 !important}
[data-wk="chatback"] svg{stroke:#000 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:30px !important;min-width:30px !important;height:28px !important;flex-shrink:0 !important;${HIDE}}
[data-wk="sameroom"]{background:${svg(I_PC)} center/22px no-repeat,${C.grey} !important;box-shadow:${UP} !important;margin-left:auto !important}
[data-wk="chatmore"]{background:${svg(I_FOLDER)} center/22px no-repeat,${C.grey} !important;box-shadow:${UP} !important;margin-left:4px !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chathead"] [data-wk="headme"]{display:inline-flex !important;position:relative !important;overflow:visible !important;margin-left:-4px !important;flex-shrink:0 !important}
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img,[data-wk="chathead"] [data-wk="avatar"]{width:30px !important;height:30px !important;min-width:30px !important;flex-shrink:0 !important;aspect-ratio:1 !important;border-radius:0 !important;box-shadow:0 0 0 1px ${C.dark},0 0 0 4px ${C.grey},-1px -1px 0 4px #fff,1px 1px 0 5px ${C.black} !important}
[data-wk="offline"] [data-wk="chathead"] [data-wk="headme"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"]{flex:1 1 auto !important;min-width:84px !important;margin-left:8px !important}
[data-wk="chathead"] [data-wk="headname"] > div:last-child{white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important}

/* 头像：方的，嵌在凸起的灰按钮里 */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *,[data-wk="msg"] [data-wk="avatar"],[data-wk="cardrow"] [data-wk="avatar"],[data-wk="rpsingle"] [data-wk="avatar"]{border-radius:0 !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]),[data-wk="msg"] [data-wk="avatar"],[data-wk="cardrow"] [data-wk="avatar"],[data-wk="rpsingle"] > :first-child[data-wk="avatar"],[data-wk="rpsingle"] > [data-wk="rpcard"] + [data-wk="avatar"]{box-shadow:${AV} !important}
[data-wk="msg"] [data-wk="avatar"],[data-wk="cardrow"] [data-wk="avatar"],[data-wk="rpsingle"] [data-wk="avatar"]{margin:4px 6px !important}

/* 气泡：一扇老系统的弹窗——灰窗体凸起、顶上标题栏（他深蓝 Ta.exe、我紫红 ni.txt）、右上关闭键 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;background:${C.grey} !important;color:${C.ink} !important;border:none !important;border-radius:0 !important;box-shadow:${UP},4px 4px 0 rgba(0,0,0,.3) !important;padding:30px 18px 11px !important;min-width:120px !important;line-height:1.55 !important}
[data-wk="bubble"][data-kind="text"]::before{content:"Ta.exe" !important;position:absolute !important;left:3px !important;right:3px !important;top:3px !important;height:19px !important;background:linear-gradient(90deg,${C.navy},${C.navy2}) !important;color:#fff !important;font:700 11.5px/19px Tahoma,Verdana,sans-serif !important;padding-left:6px !important;letter-spacing:.02em !important;text-align:left !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{content:"ni.txt" !important;background:linear-gradient(90deg,${C.plum},${C.plum2}) !important}
[data-wk="bubble"][data-kind="text"]::after{content:"" !important;position:absolute !important;right:6px !important;top:5.5px !important;width:16px !important;height:14px !important;background:${svg(XBTN)} center/100% 100% no-repeat !important;pointer-events:none !important}

/* 时间：一张黄色小提示条 */
[data-wk="time"] > span{background:${C.tip} !important;border:1px solid #000 !important;border-radius:0 !important;box-shadow:2px 2px 0 rgba(0,0,0,.3) !important;color:#000 !important;font-size:11px !important;padding:1px 8px !important;letter-spacing:.05em !important}
/* 已读：一条进度条——送达走两格，已读走满 */
[data-wk="meta"]{color:#E6FFFF !important;font-size:10.5px !important;letter-spacing:.05em !important;display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"]::before{content:"" !important;width:40px !important;height:9px !important;background:repeating-linear-gradient(90deg,${C.navy} 0 4px,transparent 4px 5.5px) 2px 2px/36px 5px no-repeat,#fff !important;box-shadow:${DOWN} !important}
[data-wk="meta"][data-read="0"]::before{background:repeating-linear-gradient(90deg,${C.navy} 0 4px,transparent 4px 5.5px) 2px 2px/11px 5px no-repeat,#fff !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]{flex-direction:row-reverse !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-run][data-last="1"] + [data-wk="cardmeta"]{display:block !important;font-size:10.5px !important;color:#E6FFFF !important;padding:2px 0 0 66px !important}
[data-run][data-last="1"] + [data-wk="cardmeta"][data-me="1"]{text-align:right !important;padding:2px 66px 0 0 !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.grey} !important;border:none !important;border-radius:0 !important;box-shadow:${UP} !important;padding-left:30px !important;position:relative !important}
[data-wk="bubble"][data-kind="typing"]::before{content:"" !important;position:absolute !important;left:9px !important;top:calc(50% - 8px) !important;width:12px !important;height:16px !important;background:${svg(HOURGLASS)} center/contain no-repeat !important}
[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:#000 !important;border-radius:0 !important}

/* 动描：一行凹下去的状态栏（不是弹窗），白底等宽字；我写的动作靠右 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"],[data-wk="myactink"]{display:inline-block !important;background:${C.grey} !important;border:none !important;border-radius:0 !important;box-shadow:${DOWN} !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;color:#202020 !important;opacity:1 !important;font-style:normal !important;font-size:12.5px !important;line-height:1.7 !important;padding:5px 12px !important}
[data-wk="narrink"]::before{content:"> " !important;color:${C.navy} !important;font-weight:700 !important}
[data-wk="myactink"]{background:#fff !important}
[data-wk="myactink"]::before{content:"* " !important;color:${C.plum} !important;font-weight:700 !important}
/* 系统提示：一行小白字，前面一个小警告 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:#E6FFFF !important;font-size:11px !important;font-style:normal !important}
[data-wk="sysnotetext"]::before{content:"⚠ " !important;color:#FFE65C !important}
[data-wk="narrbar"]{background:${C.grey} !important;border-top:none !important;box-shadow:inset 0 1px 0 #fff !important}
[data-wk="narrkind"]{border:none !important;border-radius:0 !important;background:${C.grey} !important;box-shadow:${UP} !important;color:#000 !important}
[data-wk="narrkind"][data-on="1"]{box-shadow:${DOWN} !important;background:#D8D8D8 !important}

/* 底栏：一条任务栏——灰底、顶上一道白高光；左软盘加号、白色凹下的输入框、右「OK」发送、信息图标回复 */
[data-wk="composer"]{background:${C.grey} !important;border-top:none !important;box-shadow:inset 0 1px 0 #DFDFDF,inset 0 2px 0 #fff !important;align-items:center !important;gap:8px !important}
[data-wk="chatinput"]{background:#fff !important;border:none !important;border-radius:0 !important;box-shadow:${DOWN} !important;color:#000 !important}
[data-wk="chatinput"]::placeholder{color:#808080 !important}
[data-wk="chatplus"]{width:30px !important;min-width:30px !important;height:30px !important;${HIDE};background:${svg(I_FLOPPY)} center/contain no-repeat !important}
[data-wk="chatplus"] svg{display:none !important}
[data-wk="send"]{width:46px !important;min-width:46px !important;height:30px !important;${HIDE};background:${svg(I_OK)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:34px !important;min-width:34px !important;height:34px !important;${HIDE};background:${svg(I_INFO)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:translate(1px,1px) !important}

/* 打电话那一屏（语音）：青绿桌面；三个键是凸起的灰方块，挂断是一个红底的方块 */
[data-wk="call"][data-video="0"]{background:${C.desk} !important}
[data-wk="call"][data-video="0"] > button:first-child{background:${C.grey} !important;border-radius:0 !important;box-shadow:${UP} !important}
[data-wk="call"][data-video="0"] > button:first-child svg{stroke:#000 !important}
[data-wk="calltitle"]{color:#fff !important;font-weight:700 !important}
[data-wk="callavatar"]{border-radius:0 !important;box-shadow:0 0 0 3px ${C.dark},0 0 0 12px ${C.grey},-2px -2px 0 12px #fff,2px 2px 0 13px ${C.black},10px 10px 0 13px rgba(0,0,0,.25) !important}
[data-wk="callbtns"] button > span:first-child{background:${C.grey} !important;border-radius:0 !important;box-shadow:${UP},4px 4px 0 rgba(0,0,0,.3) !important}
[data-wk="callbtns"] button > span:first-child svg{stroke:#000 !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child{background:#C42B1C !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child svg{stroke:#fff !important}
[data-wk="call"][data-video="0"] [data-wk="callbtns"] button > span:last-child{color:#fff !important}
[data-wk="callbubble"]{background:${C.grey} !important;color:#000 !important;border:none !important;border-radius:0 !important;box-shadow:${UP} !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:#fff !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="note"][data-part="callsum"]{display:block !important;margin:6px auto 0 !important;background:${C.grey} !important;border:none !important;border-radius:0 !important;box-shadow:${UP} !important;padding:8px 14px !important;color:#202020 !important;font-size:12px !important;line-height:1.65 !important;text-align:left !important}
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{background:${C.grey} !important;border-radius:0 !important;box-shadow:${UP} !important;color:#000 !important;padding:2px 12px !important}
[data-wk="noteink"]{color:#202020 !important}
[data-wk="callact"]{color:${C.navy} !important}

/* 头像照参考：外面是一块方的凸起灰按钮，里面的照片是圆的、嵌一圈凹下去的圆环（左上暗、右下亮） */
[data-wk="row"] > button[data-wk="avatar"],[data-wk="row"] > span[data-wk="avatar"],[data-wk="cardrow"] > button[data-wk="avatar"],[data-wk="cardrow"] > span[data-wk="avatar"],[data-wk="rpsingle"] > button[data-wk="avatar"],[data-wk="rpsingle"] > span[data-wk="avatar"]{display:inline-flex !important;padding:7px !important;background:${C.grey} !important;border-radius:0 !important;box-shadow:${UP},4px 4px 0 rgba(0,0,0,.3) !important;margin:0 4px !important}
[data-wk="row"] [data-wk="avatar"] > img[data-wk="avatar"],[data-wk="cardrow"] [data-wk="avatar"] > img[data-wk="avatar"],[data-wk="rpsingle"] [data-wk="avatar"] > img[data-wk="avatar"],[data-wk="msg"] [data-wk="avatar"] > img[data-wk="avatar"]{border-radius:50% !important;border:3px solid !important;border-color:#404040 #FFFFFF #FFFFFF #404040 !important;box-shadow:none !important;margin:0 !important;box-sizing:content-box !important}
`;
const pack = { kind: "chat-look", v: 1, name: "系统弹窗", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "系统弹窗-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
