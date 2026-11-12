// 黑白极简聊天美化：生成 chat-look 包。用法：node themes/mono/build.mjs
// 照参考图：浮起来的白胶囊顶栏、我的话是炭黑胶囊、他的话是白胶囊、时间灰胶囊、
//          已送达灰勾／已读红勾、底栏白胶囊＋外面一颗黑色圆形发送键。背景可以自己换。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { ink: "#1C1C1E", ink2: "#2C2C30", paper: "#FFFFFF", fog: "#8E8E93", line: "rgba(0,0,0,.08)", red: "#E5533D" };

const CHECK = (c) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 12'><path d='M1.5 6.5 L5 10 L12.5 2' fill='none' stroke='${c}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 5 V19 M5 12 H19' stroke='${C.ink}' stroke-width='1.8' stroke-linecap='round'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 24'><path d='M5 3 H23 Q26 3 26 6 V15 Q26 18 23 18 H12 L6 22 L7 18 H5 Q2 18 2 15 V6 Q2 3 5 3Z' fill='none' stroke='${C.ink}' stroke-width='1.7' stroke-linejoin='round'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><circle cx='24' cy='24' r='23' fill='${C.ink}'/><path d='M24 34 V14 M16 22 L24 14 L32 22' fill='none' stroke='#fff' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M4 11 L12 4 L20 11 V20 H4Z' fill='none' stroke='${C.ink}' stroke-width='1.7' stroke-linejoin='round'/></svg>`;
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='5' cy='12' r='1.7' fill='${C.ink}'/><circle cx='12' cy='12' r='1.7' fill='${C.ink}'/><circle cx='19' cy='12' r='1.7' fill='${C.ink}'/></svg>`;

const I_PLAY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><circle cx='24' cy='24' r='23' fill='${C.ink}'/><path d='M20 16.5 L31.5 24 L20 31.5Z' fill='#fff' stroke='#fff' stroke-width='3' stroke-linejoin='round'/></svg>`;
const bubble = { myBg: C.ink2, myText: "#fff", myBorder: "none", charBg: C.paper, charText: C.ink, charBorder: "none", radius: 24, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };
const FLOAT = "0 8px 24px rgba(0,0,0,.12),0 1px 3px rgba(0,0,0,.06)";

const css = `
/* ───── 黑白 · 第一批 ───── */
[data-wk="chat"]{background:radial-gradient(ellipse at 85% 30%,rgba(240,205,180,.55),transparent 55%),radial-gradient(ellipse at 15% 80%,rgba(210,205,235,.45),transparent 55%),linear-gradient(180deg,#F2F1EE,#ECE9E6) !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：一条浮起来的白胶囊 */
[data-wk="chathead"]{background:transparent !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;z-index:5 !important;padding-left:24px !important;padding-right:24px !important}
[data-wk="chathead"]::before{content:"" !important;position:absolute !important;left:12px !important;right:12px !important;top:calc(var(--app-safe-top, 0px) + 4px) !important;bottom:4px !important;border-radius:999px !important;background:rgba(255,255,255,.92) !important;box-shadow:${FLOAT} !important;pointer-events:none !important;z-index:-1 !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important;font-weight:700 !important}
[data-wk="headdim"]{color:${C.fog} !important}
[data-wk="chatback"] svg{stroke:${C.ink} !important}
[data-wk="chathead"] [data-wk="avatar"]{border-radius:50% !important;position:relative !important;overflow:visible !important}
[data-wk="chathead"] [data-wk="avatar"] *{border-radius:50% !important}
[data-wk="chathead"] [data-wk="avatar"]::after{content:"" !important;position:absolute !important;right:-1px !important;bottom:-1px !important;width:10px !important;height:10px !important;border-radius:50% !important;background:${C.red} !important;box-shadow:0 0 0 2px #fff !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:32px !important;min-width:32px !important;height:32px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/22px no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/22px no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 头像：圆的，不加框 */
button[data-wk="avatar"],span[data-wk="avatar"]{border-radius:50% !important;box-shadow:none !important}
button[data-wk="avatar"] *,span[data-wk="avatar"] *,img[data-wk="avatar"]{border-radius:50% !important}

/* 气泡：胶囊，我的炭黑、他的纯白，都带一层柔和投影 */
[data-wk="bubble"][data-kind="text"]{border-radius:24px !important;padding:12px 18px !important;border:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${C.ink2} !important;color:#fff !important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),0 6px 16px rgba(0,0,0,.18) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.paper} !important;color:${C.ink} !important;box-shadow:0 6px 16px rgba(0,0,0,.08) !important}
[data-wk="bubble"][data-kind="text"]::before,[data-wk="bubble"][data-kind="text"]::after{content:none !important}

/* 时间：灰色小胶囊 */
[data-wk="time"] > span{display:inline-block !important;background:rgba(150,150,155,.35) !important;color:rgba(255,255,255,.95) !important;border-radius:999px !important;padding:3px 14px !important;border:none !important;font-size:11px !important}
/* 已读：白色小胶囊，已送达灰勾、已读红勾 */
[data-wk="meta"]{display:inline-flex !important;align-items:center !important;background:rgba(255,255,255,.85) !important;color:${C.fog} !important;border-radius:999px !important;padding:1px 9px 1px 6px !important;font-size:10.5px !important}
[data-wk="meta"]::before{content:"" !important;width:12px !important;height:10px !important;margin-right:4px !important;background:${svg(CHECK(C.fog))} center/contain no-repeat !important}
[data-wk="meta"][data-read="1"]::before{background:${svg(CHECK(C.red))} center/contain no-repeat !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.paper} !important;border:none !important;border-radius:24px !important;box-shadow:0 6px 16px rgba(0,0,0,.08) !important}
[data-wk="typingdot"]{background:${C.fog} !important}
[data-wk="narrink"]{background:rgba(255,255,255,.8) !important;border-radius:14px !important;color:${C.ink} !important;padding:3px 10px !important}
[data-wk="sysnotetext"]{color:${C.fog} !important}

/* 底栏：白胶囊包住加号、输入、回复；发送是外面单独一颗黑色圆键 */
[data-wk="composer"]{background:transparent !important;border-top:none !important;position:relative !important;z-index:2 !important;align-items:center !important;padding-left:24px !important;padding-right:14px !important;gap:6px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:10px !important;right:74px !important;top:4px !important;bottom:calc(env(safe-area-inset-bottom) * .4 + var(--composer-lift, 0px) - 6px) !important;border-radius:999px !important;background:rgba(255,255,255,.95) !important;box-shadow:${FLOAT} !important;pointer-events:none !important;z-index:-1 !important}
[data-wk="chatinput"]{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:#A1A1A6 !important}
[data-wk="chatplus"],[data-wk="chatreply"]{width:32px !important;min-width:32px !important;height:32px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important;align-self:center !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/22px no-repeat !important}
[data-wk="chatreply"]{background:${svg(I_REPLY)} center/26px no-repeat !important;margin-right:14px !important}
[data-wk="send"]{order:99 !important;width:52px !important;min-width:52px !important;height:52px !important;border:none !important;border-radius:50% !important;background:${svg(I_SEND)} center/contain no-repeat !important;box-shadow:0 8px 18px rgba(0,0,0,.25) !important;opacity:1 !important;align-self:center !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.9) !important}
[data-wk="chathead"] img,[data-wk="chathead"] [data-wk="avatar"],[data-wk="chathead"] [data-wk="avatar"] > *{border-radius:50% !important;overflow:hidden !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"]){position:relative !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"])::after{content:"" !important;position:absolute !important;left:26px !important;top:calc(50% + 8px) !important;width:10px !important;height:10px !important;border-radius:50% !important;background:#E5533D !important;box-shadow:0 0 0 2px #fff !important;z-index:3 !important}


/* 底栏缩小：胶囊上下收窄、发送键 44px */
[data-wk="composer"]::before{top:10px !important;bottom:calc(env(safe-area-inset-bottom) * .4 + var(--composer-lift, 0px) + 2px) !important;right:66px !important}
[data-wk="send"]{width:44px !important;min-width:44px !important;height:44px !important}
[data-wk="chatplus"],[data-wk="chatreply"]{width:28px !important;min-width:28px !important;height:28px !important;background-size:20px !important}
[data-wk="chatreply"]{background-size:22px !important}
[data-wk="chatinput"]{font-size:14px !important}

/* ───── 黑白 · 第二批：卡片。形状不动，统一成白卡＋细黑线＋柔影；小巧思：卡片左上一行小小的等宽标签 ───── */
[data-wk="transfercard"],[data-wk="photocard"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{background:#fff !important;border:none !important;border-radius:20px !important;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06),0 6px 16px rgba(0,0,0,.08) !important;color:#1C1C1E !important;position:relative !important}
[data-wk="transfercard"] *,[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:#1C1C1E !important;border-color:rgba(0,0,0,.08) !important}
[data-wk="transfercard"],[data-wk="namecard"],[data-part="offlog"]{padding-top:26px !important}
[data-wk="transfercard"]::before,[data-wk="namecard"]::before,[data-part="offlog"]::before{position:absolute !important;left:16px !important;top:10px !important;font:600 9px/1 ui-monospace,Menlo,monospace !important;letter-spacing:.18em !important;color:#8E8E93 !important}
[data-wk="transfercard"]::before{content:"TRANSFER" !important}
[data-wk="namecard"]::before{content:"CONTACT" !important}
[data-part="offlog"]::before{content:"OFFLINE · LOG" !important}
/* 转账：金额黑色粗体，收下＝黑底白勾小圆章，退回＝灰 */
[data-wk="transferamount"],[data-wk="transfercur"]{color:#1C1C1E !important;font-weight:700 !important}
[data-wk="transferrule"]{border:none !important;height:1px !important;background:rgba(0,0,0,.1) !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:#F5F5F7 !important}
[data-wk="transferbtn"]{border-radius:999px !important}
[data-wk="transferbtn"][data-part="take"]{background:#1C1C1E !important;color:#fff !important;border:none !important}
[data-wk="transferbtn"][data-part="back"]{background:#fff !important;color:#1C1C1E !important;border:1px solid rgba(0,0,0,.15) !important}
[data-wk="transferseal"]{border:1px solid rgba(0,0,0,.2) !important;color:#1C1C1E !important;background:#fff !important;box-shadow:none !important;border-radius:50% !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{background:#1C1C1E ${svg(CHECK("#fff"))} center/45% no-repeat !important;border:none !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] *,[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"] *{opacity:0 !important}
[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"]{background:#E5E5EA !important;border:none !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.6 !important}
/* 红包：留原来的红色，只换成圆角＋柔影，跟别的卡一家 */
[data-wk="rpcard"]{border-radius:20px !important;box-shadow:0 6px 16px rgba(160,40,30,.25) !important}
[data-wk="rpenvelope"]{border-radius:28px !important}
/* 照片：白边，底下一行小号等宽「IMG_」 */
[data-wk="photocard"]{padding:8px 8px 10px !important}
[data-wk="photoface"]{border-radius:14px !important;background:#E5E5EA !important}
[data-wk="photoface"] *,[data-wk="phototext"],[data-wk="photocap"],[data-wk="photohint"]{color:#1C1C1E !important}
/* 语音：跟气泡一样的胶囊，我黑他白 */
[data-wk="voice"][data-me]{background:#fff !important;border:none !important;border-radius:999px !important;box-shadow:0 6px 16px rgba(0,0,0,.08) !important}
[data-wk="voice"][data-me="1"]{background:#2C2C30 !important}
[data-wk="voice"] > *{background:transparent !important;border:none !important;box-shadow:none !important;color:#1C1C1E !important}
[data-wk="voice"][data-me="1"] > *{color:#fff !important}
[data-wk="voicewave"] span{background:#1C1C1E !important}
[data-wk="voice"][data-me="1"] [data-wk="voicewave"] span{background:#fff !important}
/* 天气、位置、名片 */
[data-wk="wxcardsky"]{background:#F5F5F7 !important}
[data-wk="wxcardsky"] *{color:#1C1C1E !important}
[data-wk="wxcardsky"] svg{stroke:#1C1C1E !important}
[data-wk="wxcardsay"]{background:#fff !important;color:#1C1C1E !important;border-top:1px solid rgba(0,0,0,.08) !important}
[data-wk="geopin"]{background:#E5533D !important;box-shadow:0 0 0 3px #fff !important}
[data-wk="geopinstem"]{background:#1C1C1E !important}
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:none !important}
/* 拍一拍、通话结束、系统提示：灰色小胶囊，跟时间同一种 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:rgba(150,150,155,.35) !important;color:#fff !important;border:none !important;border-radius:999px !important;padding:3px 14px !important}
[data-wk="note"][data-part="call"] svg{stroke:#fff !important}
[data-wk="note"][data-part="callsum"]{color:#8E8E93 !important}
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{display:inline-block !important;background:rgba(150,150,155,.35) !important;color:#fff !important;border-radius:999px !important;padding:3px 14px !important}
/* 线下小结 */
[data-wk="offlogtitle"]{color:#1C1C1E !important;font-weight:700 !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:#8E8E93 !important}
[data-wk="offlogtranscript"]{border-top:1px solid rgba(0,0,0,.08) !important}
/* 加号面板：白底圆键，细线图标 */
[data-wk="chatpanel"]{background:rgba(255,255,255,.95) !important;border-top:none !important;box-shadow:0 -6px 20px rgba(0,0,0,.06) !important}
[data-wk="chattoolicon"]{background:#F5F5F7 !important;border:none !important;border-radius:50% !important;box-shadow:none !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:#1C1C1E !important;color:#1C1C1E !important}
[data-wk="chattoollabel"]{color:#1C1C1E !important}
/* 引用三处：一条细黑竖线 */
[data-wk="quotedraft"]{background:transparent !important;border-top:none !important}
[data-wk="quote"]{background:rgba(255,255,255,.85) !important;color:#3A3A3C !important;border:none !important;border-left:2px solid #1C1C1E !important;border-radius:4px 10px 10px 4px !important;opacity:1 !important}
[data-wk="quote"][data-draft="1"]{box-shadow:0 2px 8px rgba(0,0,0,.08) !important}
[data-wk="quoteicon"],[data-wk="quoteclear"]{color:#1C1C1E !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid currentColor !important;padding-left:8px !important;opacity:.6 !important}


/* ───── 黑白 · 第三批：状态卡（形状不动，黑白＋柔影；小巧思：等宽小标签、好感条是一根黑线进度） ───── */
[data-wk="statecard"]{background:rgba(255,255,255,.96) !important;border:none !important;border-radius:28px !important;box-shadow:0 20px 50px rgba(0,0,0,.18),inset 0 0 0 1px rgba(0,0,0,.05) !important;--sc-heart-ink:#1C1C1E !important}
[data-wk="statehead"]{background:transparent !important;border-bottom:1px solid rgba(0,0,0,.06) !important;color:#1C1C1E !important}
[data-wk="statehead"] *{color:#1C1C1E !important}
[data-wk="statehead"] button{border:1px solid rgba(0,0,0,.12) !important;color:#1C1C1E !important;background:#fff !important}
[data-wk="statehead"] [data-wk="avatar"]{border-radius:50% !important}
[data-wk="statemood"]{display:inline-block !important;background:#1C1C1E !important;color:#fff !important;border-radius:999px !important;padding:0 10px !important;margin-right:4px !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:#F2F2F4 !important;border:none !important;border-radius:999px !important;padding:3px !important;margin:10px 16px !important}
[data-wk="statecard"] button[aria-pressed]{color:#8E8E93 !important;border:none !important;border-radius:999px !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:#fff !important;color:#1C1C1E !important;font-weight:700 !important;box-shadow:0 2px 6px rgba(0,0,0,.1) !important}
[data-wk="stateseen"],[data-wk="statevoice"]{position:relative !important;background:#F7F7F8 !important;border:none !important;border-radius:20px !important;margin:10px 16px !important;padding-top:28px !important;color:#1C1C1E !important;box-shadow:none !important}
[data-wk="stateseen"]::before,[data-wk="statevoice"]::before{position:absolute !important;left:16px !important;top:11px !important;font:600 9px/1 ui-monospace,Menlo,monospace !important;letter-spacing:.18em !important;color:#8E8E93 !important}
[data-wk="stateseen"]::before{content:"NOW" !important}
[data-wk="statevoice"]::before{content:"INNER" !important}
[data-wk="statevoice"]{background:#1C1C1E !important}
[data-wk="statevoice"] *{color:#fff !important}
[data-wk="stateseen"] *{color:#1C1C1E !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:#fff !important;border:1px solid rgba(0,0,0,.08) !important;border-radius:999px !important}
[data-wk="statewear"] > span{background:#F2F2F4 !important;border-radius:999px !important;color:#1C1C1E !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:#E5533D !important}
[data-wk="statevoice"] + div > button{background:#fff !important;color:#1C1C1E !important;border:1px solid rgba(0,0,0,.12) !important;border-radius:999px !important}
/* 好感：一根细长的胶囊进度条，旋钮是一颗红点 */
[data-wk="stateaff"]{background:transparent !important;border-top:1px solid rgba(0,0,0,.06) !important;position:relative !important;display:block !important;padding:16px 20px 64px !important}
[data-wk="stateaff"] *{color:#1C1C1E !important}
[data-wk="stateheart"]{position:absolute !important;width:14px !important;height:calc(100% - 40px) !important;max-height:none !important;left:50% !important;bottom:-4px !important;height:240px !important;margin-left:-7px !important;transform:rotate(90deg) !important;transform-origin:50% 100% !important;--sc-heart-mask:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 240' preserveAspectRatio='none'><rect width='14' height='240' rx='7'/></svg>`)} !important}
[data-wk="stateheart"] > div{-webkit-mask-size:100% 100% !important;mask-size:100% 100% !important}
[data-wk="stateheartline"]{background:rgba(0,0,0,.12) !important;opacity:1 !important}
[data-wk="stateheart"] > div:not([data-wk="stateheartline"]){inset:2px !important}
[data-wk="stateheartbase"]{background:#F2F2F4 !important;opacity:1 !important}
[data-wk="stateheartfill"] > div{opacity:1 !important;border-top:none !important}
[data-wk="stateheartnum"]{display:none !important}
[data-wk="stateaffval"]{display:block !important;position:absolute !important;right:20px !important;top:12px !important;font-size:28px !important;font-weight:700 !important;color:#1C1C1E !important}
[data-wk="stateheartknob"]{display:block !important;width:16px !important;height:16px !important;margin:0 0 -8px -8px !important;border-radius:50% !important;background:#E5533D !important;box-shadow:0 0 0 3px #fff,0 2px 6px rgba(0,0,0,.25) !important;z-index:2 !important}

/* 翻旧的：一条细竖线串起来的时间线 */
[data-wk="statehistbtn"]{background:#fff !important;color:#1C1C1E !important;border:1px solid rgba(0,0,0,.12) !important;border-radius:999px !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 16px !important}
[data-wk="statehisthead"] > :first-child{color:#1C1C1E !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{border:1px solid rgba(229,83,61,.4) !important;border-radius:999px !important;color:#E5533D !important;background:#fff !important}
[data-wk="statehistlist"]{position:relative !important;padding-left:26px !important}
[data-wk="statehistlist"]::before{content:"" !important;position:absolute !important;left:9px !important;top:14px !important;bottom:14px !important;width:1px !important;background:rgba(0,0,0,.15) !important}
[data-wk="statehistitem"]{position:relative !important;background:#F7F7F8 !important;border:none !important;border-radius:18px !important;padding:14px 16px !important;margin-bottom:12px !important;box-shadow:none !important}
[data-wk="statehistitem"]::before{content:"" !important;position:absolute !important;left:-21px !important;top:18px !important;width:9px !important;height:9px !important;border-radius:50% !important;background:#1C1C1E !important;box-shadow:0 0 0 3px #fff !important}
[data-wk="statehistitem"]:first-child::before{background:#E5533D !important}
[data-wk="statehistmood"]{background:#1C1C1E !important;color:#fff !important;border:none !important;border-radius:999px !important}
[data-wk="statehisttime"]{color:#8E8E93 !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="statehisttext"]{color:#1C1C1E !important}
[data-wk="statehistmeta"]{background:#fff !important;border-radius:12px !important}
[data-wk="statehistact"],[data-wk="statehistwear"]{color:#6E6E73 !important}
[data-wk="statehistend"]{color:#8E8E93 !important}

/* Ta 眼里：贴条换成一小截黑胶带 */
[data-wk="gazepage"]{background:#FAFAFA !important}
[data-wk="gazetitle"]{color:#1C1C1E !important}
[data-wk="gazetab"]{background:#F2F2F4 !important;color:#8E8E93 !important;border-radius:999px !important;border:none !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:#1C1C1E !important;color:#fff !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:#8E8E93 !important}
[data-wk="gazecard"]{background:#fff !important;border:none !important;border-radius:18px !important;box-shadow:0 6px 16px rgba(0,0,0,.08) !important}
[data-wk="gazetape"]{background:rgba(28,28,30,.85) !important;box-shadow:none !important;border:none !important;height:10px !important;width:40px !important;margin-left:-20px !important;top:-5px !important}
[data-wk="gazecardname"]{color:#1C1C1E !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:#8E8E93 !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{background:#fff !important;border:none !important;border-radius:24px !important;box-shadow:0 20px 50px rgba(0,0,0,.2) !important}
[data-wk="gazeempty"]{background:#fff !important;border:1px dashed transparent !important;border-radius:18px !important;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08) !important}
[data-wk="gazeempty"] button{background:#1C1C1E !important;color:#fff !important;border-radius:999px !important;border:none !important}

/* ───── 线下 ───── */
[data-wk="offline"]:not([style*="url("]){background:radial-gradient(ellipse at 85% 30%,rgba(240,205,180,.45),transparent 55%),radial-gradient(ellipse at 15% 80%,rgba(210,205,235,.4),transparent 55%),linear-gradient(180deg,#F2F1EE,#ECE9E6) !important}
[data-wk="offline"] [data-wk="offbody"]{background:transparent !important}
[data-wk="offline"] [data-wk="chathead"] *{white-space:nowrap !important}
[data-wk="offline"] [data-wk="offtitle"],[data-wk="offline"] [data-wk="offtitle"] *{color:#1C1C1E !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:28px !important;height:28px !important;background:${svg(I_PLUS)} center/20px no-repeat !important;border:none !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}
[data-wk="offline"] [data-wk="chathead"] button:last-child:not([data-wk]){background:#1C1C1E !important;color:#fff !important;border:none !important;border-radius:999px !important;font-size:12px !important;padding:3px 12px !important}
[data-wk="offcomposer"]{background:rgba(255,255,255,.92) !important;border-top:none !important;box-shadow:0 -6px 20px rgba(0,0,0,.06) !important}
[data-wk="offcomposer"] textarea{background:#F2F2F4 !important;border:none !important;border-radius:20px !important;color:#1C1C1E !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:32px !important;height:32px !important;min-width:32px !important;border:none !important;box-shadow:none !important;font-size:0 !important;background:${svg(I_PLUS)} center/20px no-repeat !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]){background:${svg(I_SEND)} center/contain no-repeat !important;border:none !important;box-shadow:0 6px 14px rgba(0,0,0,.2) !important;border-radius:50% !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]) svg{opacity:0 !important}
[data-wk="offcard"]{background:#fff !important;border:none !important;border-left-width:0 !important;border-radius:22px !important;box-shadow:0 6px 16px rgba(0,0,0,.08) !important}
[data-wk="offcard"][data-me="1"]{background:#2C2C30 !important}
[data-wk="offcard"][data-me="1"] *{color:#fff !important}
[data-wk="offhead"] img,[data-wk="offhead"] [data-wk="avatar"]{border-radius:50% !important;box-shadow:none !important}
[data-wk="offname"]{color:#1C1C1E !important;font-weight:700 !important}
[data-wk="offtext"]{color:#1C1C1E !important}
[data-wk="offsay"]{background:none !important;color:#1C1C1E !important;font-weight:700 !important;border-bottom:1.5px solid #E5533D !important}
[data-wk="offcard"][data-me="1"] [data-wk="offsay"]{color:#fff !important}
[data-wk="offthought"]{background:#F7F7F8 !important;border:none !important;border-left:2px solid #1C1C1E !important;border-radius:4px 14px 14px 4px !important;color:#6E6E73 !important}
[data-wk="offcardacts"] svg{stroke:#8E8E93 !important;color:#8E8E93 !important}
[data-wk="offreplyopt"]{background:#fff !important;border:1px solid rgba(0,0,0,.12) !important;border-radius:999px !important;color:#1C1C1E !important}

/* ───── 通话 ───── */
[data-wk="callbubble"]{background:rgba(255,255,255,.95) !important;color:#1C1C1E !important;border:none !important;border-radius:22px !important;box-shadow:0 6px 16px rgba(0,0,0,.15) !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:#2C2C30 !important;color:#fff !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:0 0 0 6px rgba(255,255,255,.9),0 20px 40px rgba(0,0,0,.3) !important}

[data-wk="stateaff"]{overflow:hidden !important}
[data-wk="stateheart"]{left:calc(50% - 7px) !important;margin-left:0 !important;height:min(240px, 76vw) !important;bottom:calc(30px - min(240px, 76vw) / 2) !important;transform:rotate(90deg) !important;transform-origin:50% 50% !important}
[data-wk="stateknob"],[data-wk="stateheartknob"]{transform:none !important}

/* 名字露全：小房子贴着「···」往右挪，名字那块撑满 */
[data-wk="chathead"]{gap:6px !important;padding-right:16px !important}
[data-wk="chathead"] [data-wk="headname"]{flex:1 1 auto !important;min-width:0 !important}
[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"]{margin-left:auto !important;margin-right:-4px !important;width:28px !important;min-width:28px !important}
[data-wk="chatmore"]{width:28px !important;min-width:28px !important;margin-left:0 !important}

/* 线下底栏跟线上一样的排法：对话气泡在左、箭头发送挪到最右；箭头缩小 */
/* 位置和功能都不动：左边「发送」换成对话气泡图标，最右「让 Ta 演绎」换成黑色圆箭头（缩小） */
[data-wk="offcomposer"] button:not([title]):not([data-wk]){background:${svg(I_REPLY)} center/26px no-repeat !important;box-shadow:none !important;border-radius:0 !important;width:36px !important;min-width:36px !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]{width:38px !important;min-width:38px !important;height:38px !important;border:none !important;border-radius:50% !important;background:${svg(I_PLAY)} center/contain no-repeat !important;box-shadow:0 4px 10px rgba(0,0,0,.18) !important;font-size:0 !important;color:transparent !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"] *{opacity:0 !important}

/* 线上最右那颗也换成同一个圆角三角，线上线下一致 */
[data-wk="send"]{background:${svg(I_PLAY)} center/contain no-repeat !important}

`;

const pack = { kind: "chat-look", v: 1, name: "奶油留白", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "奶油留白-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
