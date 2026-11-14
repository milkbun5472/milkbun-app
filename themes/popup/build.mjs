// 系统弹窗：老电脑的青绿桌面；每个气泡是一扇老系统的弹窗——灰色凸起的窗体、顶上一条标题栏（他深蓝「Ta.exe」、我紫红「Ni.txt」）、右上一个关闭键；头像嵌在凸起的灰按钮里；已读是进度条走满。用法：node themes/popup/build.mjs
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
const I_HELP = X(`viewBox='0 0 30 30'><rect x='4' y='3' width='20' height='24' fill='#1E5BD8' stroke='${C.black}' stroke-width='1.2'/><rect x='7' y='3' width='17' height='24' fill='#3D7BF0'/><path d='M7 27 V3' stroke='#0B2E8A' stroke-width='1.4'/><text x='16' y='20' text-anchor='middle' font-family='Tahoma,Verdana,sans-serif' font-size='14' font-weight='700' fill='#fff'>?</text>`);
const I_PIC = X(`viewBox='0 0 30 30'><rect x='3' y='5' width='24' height='20' fill='#fff' stroke='${C.black}' stroke-width='1.2'/><rect x='5' y='7' width='20' height='16' fill='#7EC8F0'/><circle cx='20' cy='11' r='2.4' fill='#F4D35E'/><path d='M5 23 L12 14 L17 19 L20 16 L25 23Z' fill='#3E8E3E'/>`);
const WIN = (title, c1, c2) => `content:"${title}" !important;position:absolute !important;left:3px !important;right:3px !important;top:3px !important;height:19px !important;background:linear-gradient(90deg,${c1},${c2}) !important;color:#fff !important;font:700 11.5px/19px Tahoma,Verdana,sans-serif !important;padding-left:6px !important;text-align:left !important;pointer-events:none !important;z-index:3 !important;border:none !important;border-radius:0 !important;transform:none !important;width:auto !important`;
// 好感：一扇小窗口里的东西慢慢变——沙漏在转（<20）→ 一个问号（20–49）→ 一张笑脸（50–79）→ 一颗粉心、标题栏变紫红（80+）
const MW = (bar, inner) => X(`viewBox='0 0 92 84'><rect x='6' y='8' width='80' height='68' fill='${C.grey}'/><path d='M6 76 V8 H86' stroke='#fff' stroke-width='2' fill='none'/><path d='M6 76 H86 V8' stroke='#000' stroke-width='2' fill='none'/><rect x='10' y='12' width='72' height='13' fill='${bar}'/><rect x='70' y='14' width='10' height='9' fill='${C.grey}'/><path d='M72.5 16 L77.5 21 M77.5 16 L72.5 21' stroke='#000' stroke-width='1.4'/><rect x='14' y='30' width='64' height='40' fill='#fff'/><path d='M14 70 V30 H78' stroke='${C.dark}' stroke-width='1.6' fill='none'/>${inner}`);
const ST1 = MW(C.dark, `<g transform='translate(38 34)'><path d='M1 1 H15 M1 31 H15' stroke='#000' stroke-width='2.4'/><path d='M3 2 H13 C13 9 9 12 8 16 C9 20 13 23 13 30 H3 C3 23 7 20 8 16 C7 12 3 9 3 2Z' fill='#fff' stroke='#000' stroke-width='1.4'/><path d='M5 28 H11 L8 22Z' fill='#C9A227'/></g>`);
const ST2 = MW(C.navy, `<circle cx='46' cy='50' r='13' fill='#1E5BD8'/><text x='46' y='56' text-anchor='middle' font-family='Tahoma,Verdana,sans-serif' font-size='17' font-weight='700' fill='#fff'>?</text>`);
const ST3 = MW(C.navy, `<circle cx='46' cy='50' r='13' fill='#F4D35E' stroke='#000' stroke-width='1.4'/><circle cx='41.5' cy='47' r='1.6' fill='#000'/><circle cx='50.5' cy='47' r='1.6' fill='#000'/><path d='M40 53 Q46 58 52 53' stroke='#000' stroke-width='1.6' fill='none'/>`);
const ST4 = MW(C.plum, `<path d='M46 63 C33 54 31 48 31 44 C31 39 35 36 39 36 C42 36 44.5 38 46 40.5 C47.5 38 50 36 53 36 C57 36 61 39 61 44 C61 48 59 54 46 63Z' fill='#FF6FAE' stroke='#000' stroke-width='1.4'/><rect x='38' y='40' width='4' height='4' fill='#fff' opacity='.8'/>`);
// 顶栏头像框：一整块方灰按钮（凸起边）中间压一个圆凹槽——用 border-image 画，border-image 不受圆角裁切，照片本身照样被裁成圆
const AVFRAME = X(`width='60' height='60' viewBox='0 0 60 60'><rect width='60' height='60' fill='${C.grey}'/><path d='M.5 59.5 V.5 H59.5' stroke='#fff' fill='none'/><path d='M.5 59.5 H59.5 V.5' stroke='#000' fill='none'/><path d='M1.5 58.5 H58.5 V1.5' stroke='${C.dark}' fill='none'/><circle cx='30' cy='30' r='22.6' fill='none' stroke='#fff' stroke-width='2.2'/><path d='M14 46 A22.6 22.6 0 0 1 46 14' fill='none' stroke='#404040' stroke-width='2.4'/>`);
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

/* 气泡：一扇老系统的弹窗——灰窗体凸起、顶上标题栏（他深蓝 Ta.exe、我紫红 Ni.txt）、右上关闭键 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;background:${C.grey} !important;color:${C.ink} !important;border:none !important;border-radius:0 !important;box-shadow:${UP},4px 4px 0 rgba(0,0,0,.3) !important;padding:30px 18px 11px !important;min-width:120px !important;line-height:1.55 !important}
[data-wk="bubble"][data-kind="text"]::before{content:"Ta.exe" !important;position:absolute !important;left:3px !important;right:3px !important;top:3px !important;height:19px !important;background:linear-gradient(90deg,${C.navy},${C.navy2}) !important;color:#fff !important;font:700 11.5px/19px Tahoma,Verdana,sans-serif !important;padding-left:6px !important;letter-spacing:.02em !important;text-align:left !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{content:"Ni.txt" !important;background:linear-gradient(90deg,${C.plum},${C.plum2}) !important}
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


/* 头像照参考：外面一块方的凸起灰按钮，里面的照片是圆的、嵌一圈凹下去的圆环（左上暗、右下亮）——聊天、卡片、红包那一行、顶栏都一样 */
[data-wk="body"] button[data-wk="avatar"],[data-wk="body"] span[data-wk="avatar"]:not([data-halo]){display:inline-flex !important;padding:6px !important;background:${C.grey} !important;border-radius:0 !important;box-shadow:${UP},3px 3px 0 rgba(0,0,0,.3) !important;flex-shrink:0 !important}
[data-wk="body"] [data-wk="avatar"] > img[data-wk="avatar"],[data-wk="chathead"] button > img[data-wk="avatar"],[data-wk="chathead"] [data-wk="headme"] > img{border-radius:50% !important;border:3px solid !important;border-color:#404040 #FFFFFF #FFFFFF #404040 !important;box-shadow:none !important;margin:0 !important;box-sizing:content-box !important;outline:none !important}
[data-wk="chathead"] [data-wk="headname"]{display:none !important}
[data-wk="chathead"] [data-wk="headme"]{display:inline-flex !important;margin-left:-10px !important}
[data-wk="chathead"] > button:has([data-wk="headname"]){justify-content:center !important}
[data-wk="chathead"] button > img[data-wk="avatar"],[data-wk="chathead"] [data-wk="headme"] > img{width:38px !important;height:38px !important;min-width:38px !important;box-sizing:content-box !important;border:7px solid transparent !important;border-image:${svg(AVFRAME)} 7 fill / 7px stretch !important;border-radius:50% !important;background:transparent !important;box-shadow:none !important;filter:drop-shadow(3px 3px 0 rgba(0,0,0,.3)) !important;outline:none !important}

/* ───── 系统弹窗 · 第二批：卡片（形状不动；每张都是一扇灰窗口，顶上一条标题栏写着它是什么） ───── */
[data-wk="transfercard"],[data-wk="photocard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"],[data-wk="wxcard"],[data-wk="rpcard"]{position:relative !important;overflow:visible !important;background:${C.grey} !important;border:none !important;border-radius:0 !important;box-shadow:${UP},4px 4px 0 rgba(0,0,0,.3) !important;padding-top:26px !important;color:#000 !important}
[data-wk="transfercard"] *,[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *,[data-wk="photocard"] *,[data-wk="wxcard"] *{color:#000 !important;border-color:${C.dark} !important}
[data-wk="transfercard"]::before{${WIN("转账.exe", C.navy, C.navy2)}}
[data-wk="photocard"]::before{${WIN("照片.bmp", C.navy, C.navy2)}}
[data-wk="wxcard"]::before{${WIN("天气.exe", C.navy, C.navy2)}}
[data-wk="namecard"]::before{${WIN("名片.vcf", C.navy, C.navy2)}}
[data-part="offlog"]::before{${WIN("线下记录.log", C.navy, C.navy2)}}
[data-wk="geocard"] > [data-wk="card"]::before{${WIN("位置.map", C.navy, C.navy2)}}
[data-wk="rpcard"]::before{${WIN("红包.exe", "#8A0000", "#E04A3A")}}
[data-wk="transfercard"]::after,[data-wk="photocard"]::after,[data-wk="wxcard"]::after,[data-wk="namecard"]::after,[data-wk="rpcard"]::after{content:"" !important;position:absolute !important;right:6px !important;top:5.5px !important;left:auto !important;bottom:auto !important;width:16px !important;height:14px !important;background:${svg(XBTN)} center/100% 100% no-repeat !important;border:none !important;box-shadow:none !important;pointer-events:none !important;z-index:4 !important}
/* 转账：金额是黑体大字，两个按键是凸起的灰按钮；收下以后盖一个「√ 已完成」的对话图标 */
[data-wk="transferamount"],[data-wk="transfercur"]{color:#000 !important;font-family:Tahoma,Verdana,sans-serif !important}
[data-wk="transferrule"]{border:none !important;height:2px !important;background:none !important;box-shadow:inset 0 1px 0 ${C.dark},inset 0 -1px 0 #fff !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:${C.grey} !important;border-top:none !important}
[data-wk="transferbtn"]{border-radius:0 !important;background:${C.grey} !important;border:none !important;box-shadow:${UP} !important;color:#000 !important}
[data-wk="transferbtn"][data-part="take"]{outline:1px solid #000 !important;outline-offset:0 !important}
[data-wk="transferseal"]{background:#fff !important;border:none !important;border-radius:0 !important;box-shadow:${DOWN} !important;color:#008000 !important;transform:none !important}
[data-wk="transferseal"] *{color:#008000 !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.6 !important;filter:grayscale(1) !important}
/* 红包：一扇红标题栏的窗口；领完标题栏变灰（像失去焦点的窗口） */
[data-wk="rpcard"] *{color:#000 !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"][data-status="done"]::before{background:linear-gradient(90deg,#808080,#B5B5B5) !important}
[data-wk="rpenvelope"]{background:${C.grey} !important;border:none !important;border-radius:0 !important;box-shadow:${UP},6px 6px 0 rgba(0,0,0,.35) !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:linear-gradient(90deg,#8A0000,#E04A3A) !important;border:none !important;border-radius:0 !important}
[data-wk="rpenvelope"] *{color:#000 !important}
[data-wk="rpenvelope"] [data-wk="rparc"] *{color:#fff !important}
[data-wk="rpopenbtn"]{background:${C.grey} !important;border:none !important;border-radius:0 !important;box-shadow:${UP},0 0 0 1px #000 !important}
[data-wk="rpopenbtn"] *{color:#000 !important}
[data-wk="rpamount"]{color:#000 !important;font-family:Tahoma,Verdana,sans-serif !important}
[data-wk="rpavatar"],[data-wk="rpavatar"] *{border-radius:50% !important}
[data-wk="rpavatar"]{box-shadow:0 0 0 3px ${C.grey},0 0 0 4px #000 !important}
/* 照片：凹下去的一块白屏；语音：一条媒体播放器 */
[data-wk="photocard"]{padding:28px 8px 10px !important}
[data-wk="photoface"]{border-radius:0 !important;background:#fff !important;border:none !important;box-shadow:${DOWN} !important}
[data-wk="photoface"] svg{stroke:${C.navy} !important}
[data-wk="voice"][data-me]{background:${C.grey} !important;border:none !important;border-radius:0 !important;box-shadow:${UP},3px 3px 0 rgba(0,0,0,.3) !important}
[data-wk="voice"] > *{background:transparent !important;border:none !important;box-shadow:none !important;color:#000 !important}
[data-wk="voicewave"]{background:#000 !important;box-shadow:${DOWN} !important;padding:2px 4px !important}
[data-wk="voicewave"] span{background:#00FF41 !important;border-radius:0 !important}
/* 天气：凹下去的白屏里写字，下面那句话是一行黄色提示条 */
[data-wk="wxcardsky"]{background:#fff !important;box-shadow:${DOWN} !important;margin:0 4px !important}
[data-wk="wxcardsky"] > div:first-child{background:radial-gradient(circle,#F4D35E 0 10px,transparent 11px) !important}
[data-wk="wxcardsky"] svg{stroke:${C.navy} !important}
[data-wk="wxcardsky"] span[style*="999"],[data-wk="wxcardrain"]{background:${C.grey} !important;border:none !important;border-radius:0 !important;box-shadow:${UP} !important}
[data-wk="wxcardtemp"]{font-family:Tahoma,Verdana,sans-serif !important}
[data-wk="wxcardsay"]{background:${C.tip} !important;border:1px solid #000 !important;border-radius:0 !important;margin:6px 4px 4px !important}
[data-wk="geopin"]{background:#C42B1C !important;box-shadow:0 0 0 2px #fff !important}
[data-wk="geopinstem"]{background:#000 !important}
[data-wk="namecard"] img{border-radius:50% !important;border:3px solid !important;border-color:#404040 #fff #fff #404040 !important;box-shadow:none !important}
/* 卡片下的已读：同一条进度条（分不出读没读，走满） */
[data-run][data-last="1"] + [data-wk="cardmeta"]::before{content:"" !important;display:inline-block !important;vertical-align:middle !important;width:40px !important;height:9px !important;margin:0 6px !important;background:repeating-linear-gradient(90deg,${C.navy} 0 4px,transparent 4px 5.5px) 2px 2px/36px 5px no-repeat,#fff !important;box-shadow:${DOWN} !important}
/* 线下小结 */
[data-wk="offlogtitle"]{color:#000 !important;font-weight:700 !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.navy} !important;text-decoration:underline !important}
[data-wk="offlogtranscript"]{border-top:none !important;box-shadow:inset 0 1px 0 ${C.dark},inset 0 2px 0 #fff !important}
/* 加号面板：一排排桌面图标——凸起的灰方块 */
[data-wk="chatpanel"]{background:${C.grey} !important;border-top:none !important;box-shadow:inset 0 1px 0 #fff !important}
[data-wk="chattoolicon"]{background:${C.grey} !important;border:none !important;border-radius:0 !important;box-shadow:${UP},3px 3px 0 rgba(0,0,0,.25) !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:#000 !important;color:#000 !important}
[data-wk="chattool"]:active [data-wk="chattoolicon"]{box-shadow:${DOWN} !important}
[data-wk="chattoollabel"]{color:#000 !important}
/* 引用：凹下去的白框 */
[data-wk="quotedraft"]{background:${C.grey} !important;border-top:none !important}
[data-wk="quote"]{background:#fff !important;color:#333 !important;border:none !important;border-radius:0 !important;box-shadow:${DOWN} !important;opacity:1 !important}
[data-wk="quoteicon"],[data-wk="quoteclear"]{color:#000 !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;background:#fff !important;box-shadow:${DOWN} !important;padding:2px 8px !important;margin-bottom:4px !important}
/* 线下：提示键是一本蓝色帮助手册，照片键是一张画图图片 */
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:28px !important;min-width:28px !important;height:28px !important;background:${svg(I_HELP)} center/22px no-repeat,${C.grey} !important;box-shadow:${UP} !important;border:none !important;border-radius:0 !important;font-size:0 !important;color:transparent !important;padding:0 !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:30px !important;min-width:30px !important;height:30px !important;${HIDE};background:${svg(I_PIC)} center/contain no-repeat !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}

/* ───── 系统弹窗 · 第三批：状态卡是一扇大窗口——标题栏「Ta 的状态」；看得见的是凹下的白框、心里想的是一扇 Ni 色小窗；好感是小窗里的东西慢慢变 ───── */
[data-wk="statecard"]{position:relative !important;background:${C.grey} !important;border:none !important;border-radius:0 !important;box-shadow:${UP},8px 8px 0 rgba(0,0,0,.35) !important;color:#000 !important;padding-top:24px !important}
[data-wk="statecard"]::before{${WIN("状态.exe", C.navy, C.navy2)}}
[data-wk="statecard"]::after{content:"" !important;position:absolute !important;right:6px !important;top:5.5px !important;width:16px !important;height:14px !important;background:${svg(XBTN)} center/100% 100% no-repeat !important;pointer-events:none !important;z-index:4 !important}
[data-wk="statecard"] *{font-family:Tahoma,"Microsoft YaHei","PingFang SC",sans-serif !important}
[data-wk="statehead"]{background:${C.grey} !important;border-bottom:none !important;box-shadow:inset 0 -1px 0 ${C.dark},inset 0 -2px 0 #fff !important}
[data-wk="statehead"] *{color:#000 !important}
[data-wk="statehead"] [data-wk="avatar"]{border-radius:50% !important;border:3px solid !important;border-color:#404040 #fff #fff #404040 !important;box-shadow:0 0 0 4px ${C.grey},0 0 0 5px #000 !important}
[data-wk="statehead"] button{border:none !important;border-radius:0 !important;background:${C.grey} !important;box-shadow:${UP} !important}
[data-wk="statemood"]{display:inline-block !important;background:${C.tip} !important;color:#000 !important;padding:0 8px !important;margin-right:4px !important;border:1px solid #000 !important;border-radius:0 !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:${C.grey} !important;border:none !important;border-radius:0 !important;padding:0 !important;margin:10px 14px !important;gap:2px !important}
[data-wk="statecard"] button[aria-pressed]{color:#000 !important;border:none !important;border-radius:0 !important;background:${C.grey} !important;box-shadow:${UP} !important}
[data-wk="statecard"] button[aria-pressed="true"]{box-shadow:${DOWN} !important;background:#D8D8D8 !important;font-weight:700 !important}
[data-wk="stateseen"]{position:relative !important;background:#fff !important;border:none !important;border-radius:0 !important;box-shadow:${DOWN} !important;margin:12px 14px 10px !important}
[data-wk="stateseen"] *{color:#000 !important}
[data-wk="statevoice"]{position:relative !important;overflow:visible !important;background:${C.grey} !important;border:none !important;border-radius:0 !important;box-shadow:${UP},4px 4px 0 rgba(0,0,0,.3) !important;margin:12px 14px 12px !important;padding-top:30px !important}
[data-wk="statevoice"]::before{${WIN("心里想的.txt", C.plum, C.plum2)}}
[data-wk="statevoice"] *{color:#000 !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:${C.grey} !important;border:none !important;border-radius:0 !important;box-shadow:${UP} !important}
[data-wk="statewear"] > span{background:transparent !important;border:none !important;border-radius:0 !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:${C.navy} !important;text-decoration:underline !important}
[data-wk="statevoice"] + div > button{background:${C.grey} !important;color:#000 !important;border:none !important;border-radius:0 !important;box-shadow:${UP} !important}
[data-wk="stateaff"]{background:${C.grey} !important;border-top:none !important;box-shadow:inset 0 1px 0 ${C.dark},inset 0 2px 0 #fff !important;position:relative !important;display:block !important;padding:16px 120px 18px 20px !important;min-height:112px !important}
[data-wk="stateaff"] *{color:#000 !important}
[data-wk="stateheart"]{position:absolute !important;right:18px !important;left:auto !important;top:50% !important;margin-top:-44px !important;width:92px !important;height:84px !important;--sc-heart-mask:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><rect width='10' height='10'/></svg>`)} !important}
[data-wk="stateheart"] > div,[data-wk="stateheartknob"]{inset:0 !important;-webkit-mask-size:100% 100% !important;mask-size:100% 100% !important;background-color:transparent !important;border:none !important}
[data-wk="stateheart"] > div:not([data-wk]){display:none !important}
[data-wk="stateheartfill"] > div{display:none !important}
[data-wk="stateheartline"]{background:${svg(ST1)} center/contain no-repeat !important;opacity:calc(1 - clamp(0,(var(--sc-heart-lvl) - 0.195)*1000,1)) !important}
[data-wk="stateheartbase"]{background:${svg(ST2)} center/contain no-repeat !important;opacity:calc(clamp(0,(var(--sc-heart-lvl) - 0.195)*1000,1) - clamp(0,(var(--sc-heart-lvl) - 0.495)*1000,1)) !important}
[data-wk="stateheartfill"]{background:${svg(ST3)} center/contain no-repeat !important;opacity:calc(clamp(0,(var(--sc-heart-lvl) - 0.495)*1000,1) - clamp(0,(var(--sc-heart-lvl) - 0.795)*1000,1)) !important}
[data-wk="stateheartknob"]{display:block !important;position:absolute !important;left:0 !important;bottom:0 !important;width:100% !important;height:100% !important;margin:0 !important;transform:none !important;background:${svg(ST4)} center/contain no-repeat !important;opacity:calc(clamp(0,(var(--sc-heart-lvl) - 0.795)*1000,1)) !important}
[data-wk="stateheartnum"]{position:absolute !important;inset:auto 0 -10px 0 !important;display:flex !important;justify-content:center !important;padding:0 !important;font:700 12px/1 Tahoma,Verdana,sans-serif !important;color:#000 !important;-webkit-text-stroke:0 !important;text-shadow:none !important;z-index:3 !important}
[data-wk="stateaffval"]{display:none !important}

/* 翻旧的：一扇扇叠起来的旧窗口，标题栏写「记录_N.txt」，焦点窗口深蓝、其余灰的 */
[data-wk="statehistbtn"]{background:${C.grey} !important;color:#000 !important;border:none !important;border-radius:0 !important;box-shadow:${UP} !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 16px !important}
[data-wk="statehisthead"] > :first-child{color:#000 !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{background:${C.grey} !important;border:none !important;border-radius:0 !important;box-shadow:${UP} !important;text-decoration:none !important;color:#000 !important}
[data-wk="statehistlist"]{counter-reset:pg !important}
[data-wk="statehistitem"]{counter-increment:pg !important;position:relative !important;background:${C.grey} !important;border:none !important;border-radius:0 !important;padding:32px 16px 12px !important;margin:12px 0 !important;box-shadow:${UP},4px 4px 0 rgba(0,0,0,.3) !important}
[data-wk="statehistitem"]::before{content:"记录_" counter(pg) ".txt" !important;position:absolute !important;left:3px !important;right:3px !important;top:3px !important;height:19px !important;background:linear-gradient(90deg,#808080,#B5B5B5) !important;color:#fff !important;font:700 11.5px/19px Tahoma,Verdana,sans-serif !important;padding-left:6px !important;text-align:left !important}
[data-wk="statehistitem"]:first-child::before{background:linear-gradient(90deg,${C.navy},${C.navy2}) !important}
[data-wk="statehistitem"] *{color:#000 !important}
[data-wk="statehistmood"]{background:${C.tip} !important;border:1px solid #000 !important;border-radius:0 !important;padding:0 6px !important}
[data-wk="statehisttime"]{opacity:.7 !important}
[data-wk="statehistmeta"]{background:#fff !important;box-shadow:${DOWN} !important;border-radius:0 !important}
[data-wk="statehistend"]{color:#000 !important;letter-spacing:.2em !important}

/* Ta 眼里：贴条换成一枚黄色便签贴，卡片是凹下的白框 */
[data-wk="gazepage"]{background:${C.grey} !important}
[data-wk="gazetitle"]{color:#000 !important}
[data-wk="gazetab"]{background:${C.grey} !important;color:#000 !important;border:none !important;border-radius:0 !important;box-shadow:${UP} !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{box-shadow:${DOWN} !important;background:#D8D8D8 !important;font-weight:700 !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:#333 !important}
[data-wk="gazecard"]{position:relative !important;overflow:visible !important;background:#fff !important;border:none !important;border-radius:0 !important;box-shadow:${DOWN} !important}
[data-wk="gazetape"]{background:${C.tip} !important;width:30px !important;height:12px !important;border:1px solid #000 !important;border-radius:0 !important;box-shadow:2px 2px 0 rgba(0,0,0,.25) !important}
[data-wk="gazecardname"]{color:${C.navy} !important;font-weight:700 !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:#333 !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{background:${C.grey} !important;color:#000 !important;border:none !important;border-radius:0 !important;box-shadow:${UP},6px 6px 0 rgba(0,0,0,.3) !important}
[data-wk="gazeletter"] *,[data-wk="gazehistory"] *{color:#000 !important}
[data-wk="gazeempty"]{background:#fff !important;color:#000 !important;border:none !important;border-radius:0 !important;box-shadow:${DOWN} !important}
[data-wk="gazeempty"] *{color:#000 !important}
[data-wk="gazeempty"] button{background:${C.grey} !important;color:#000 !important;border:none !important;border-radius:0 !important;box-shadow:${UP} !important}

/* ───── 线下：同一张青绿桌面；他一扇深蓝标题栏的窗（Ta.exe）、我一扇紫红的（Ni.txt）；说的话加粗下划线，心里话是灰色斜体 ───── */
[data-wk="offline"]:not([style*="url("]){background:${C.desk} !important;background-color:${C.desk} !important}
[data-wk="offline"] [data-wk="offbody"]{background:transparent !important}
[data-wk="offline"] [data-wk="chathead"] *{white-space:nowrap !important}
[data-wk="offline"] [data-wk="headname"] > div:last-child{white-space:normal !important;line-height:1.35 !important}
[data-wk="offline"] [data-wk="offtitle"],[data-wk="offline"] [data-wk="offtitle"] *,[data-wk="offline"] [data-wk="chatback"] *{color:#fff !important}
[data-wk="offline"] [data-wk="chathead"] button:last-child:not([data-wk]){background:${C.grey} !important;color:#000 !important;border:none !important;border-radius:0 !important;box-shadow:${UP} !important;font-size:12px !important;padding:3px 10px !important;flex-shrink:0 !important}
[data-wk="offline"] [data-wk="chatmore"]{width:28px !important;min-width:28px !important;height:28px !important}
[data-wk="offcomposer"]{background:${C.grey} !important;border:none !important;border-radius:0 !important;box-shadow:inset 0 1px 0 #DFDFDF,inset 0 2px 0 #fff !important}
[data-wk="offcomposer"] textarea{background:#fff !important;border:none !important;border-radius:0 !important;box-shadow:${DOWN} !important;color:#000 !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]){width:46px !important;min-width:46px !important;height:30px !important;background:${svg(I_OK)} center/contain no-repeat !important;${HIDE}}
[data-wk="offcomposer"] button:not([title]):not([data-wk]) *{opacity:0 !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]{width:34px !important;min-width:34px !important;height:34px !important;${HIDE};background:${svg(I_INFO)} center/contain no-repeat !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"] *{opacity:0 !important}
[data-wk="offcard"]{position:relative !important;overflow:visible !important;background:${C.grey} !important;border:none !important;border-radius:0 !important;box-shadow:${UP},5px 5px 0 rgba(0,0,0,.3) !important;padding-top:30px !important}
[data-wk="offcard"]::before{${WIN("Ta.exe", C.navy, C.navy2)}}
[data-wk="offcard"][data-me="1"]::before{content:"Ni.txt" !important;background:linear-gradient(90deg,${C.plum},${C.plum2}) !important}
[data-wk="offcard"]::after{content:"" !important;position:absolute !important;right:6px !important;top:5.5px !important;width:16px !important;height:14px !important;background:${svg(XBTN)} center/100% 100% no-repeat !important;pointer-events:none !important;z-index:4 !important}
[data-wk="offhead"] img,[data-wk="offhead"] [data-wk="avatar"]{border-radius:50% !important;border:2px solid !important;border-color:#404040 #fff #fff #404040 !important;box-shadow:0 0 0 3px ${C.grey},0 0 0 4px #000 !important}
[data-wk="offname"]{color:${C.navy} !important;font-weight:700 !important}
[data-wk="offcard"][data-me="1"] [data-wk="offname"]{color:${C.plum} !important}
[data-wk="offtext"]{color:#000 !important}
[data-wk="offsay"]{color:#000 !important;background:none !important;border:none !important;font-weight:700 !important;text-decoration:underline !important;text-decoration-color:${C.navy} !important;text-underline-offset:3px !important}
[data-wk="offcard"][data-me="1"] [data-wk="offsay"]{text-decoration-color:${C.plum} !important}
[data-wk="offthought"]{background:transparent !important;border:none !important;color:#555 !important;font-style:italic !important}
[data-wk="offcardacts"] svg{stroke:#000 !important;color:#000 !important}
[data-wk="offreplyopt"]{background:${C.grey} !important;border:none !important;border-radius:0 !important;box-shadow:${UP} !important;color:#000 !important}
`;
const pack = { kind: "chat-look", v: 1, name: "系统弹窗", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "系统弹窗-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
