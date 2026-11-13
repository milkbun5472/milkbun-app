// 梅子饭团：米白底撒芝麻；他的气泡是白米饭团、左边包一截海苔；我的是整张海苔、右边一颗梅子；头像是饭团形——上圆下宽、底下垫海苔、角上一片竹叶。用法：node themes/onigiri/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const X = s => `<svg xmlns='http://www.w3.org/2000/svg' ${s}</svg>`;
const C = { bg: "#F5F2EA", rice: "#FFFFFF", nori: "#2C3A33", nori2: "#3B4B42", ume: "#D9474A", leaf: "#6FB06A", ink: "#2E3530", fog: "#9A9D96", grain: "#E8E4DA" };
const SESAME = X(`width='90' height='90' viewBox='0 0 90 90'><g fill='rgba(44,58,51,.13)'><ellipse cx='12' cy='18' rx='1.6' ry='.9' transform='rotate(30 12 18)'/><ellipse cx='60' cy='9' rx='1.6' ry='.9' transform='rotate(-20 60 9)'/><ellipse cx='40' cy='52' rx='1.6' ry='.9' transform='rotate(60 40 52)'/><ellipse cx='80' cy='70' rx='1.6' ry='.9' transform='rotate(10 80 70)'/><ellipse cx='20' cy='78' rx='1.6' ry='.9' transform='rotate(-40 20 78)'/></g><g fill='rgba(255,255,255,.9)' stroke='rgba(44,58,51,.08)' stroke-width='.4'><ellipse cx='72' cy='34' rx='1.7' ry='1' transform='rotate(-30 72 34)'/><ellipse cx='30' cy='35' rx='1.7' ry='1' transform='rotate(20 30 35)'/></g>`);
const GRAINS = X(`width='40' height='30' viewBox='0 0 40 30'><g fill='none' stroke='#ECE8DE' stroke-width='1' stroke-linecap='round'><path d='M5 6 q2 -1 4 0'/><path d='M24 4 q2 1 4 0'/><path d='M14 16 q2 -1.5 4 0'/><path d='M31 18 q2 1 4 -.5'/><path d='M6 25 q2 1 4 0'/><path d='M22 27 q1.5 -1 3.5 0'/></g>`);
const LEAF = X(`viewBox='0 0 30 22'><path d='M2 20 C6 8 16 2 28 2 C25 12 16 19 2 20Z' fill='${C.leaf}'/><path d='M3 19 C10 13 17 8 26 3' stroke='#4E8C4A' stroke-width='1' fill='none'/>`);
const UME = X(`viewBox='0 0 20 20'><circle cx='10' cy='11' r='7.5' fill='${C.ume}' stroke='#fff' stroke-width='1.6'/><ellipse cx='7.5' cy='8.5' rx='2' ry='1.2' fill='rgba(255,255,255,.55)'/><path d='M10 4 q1 -2.5 3.5 -3' stroke='${C.leaf}' stroke-width='1.4' fill='none' stroke-linecap='round'/>`);
// 按键
const I_SEND = X(`viewBox='0 0 36 36'><circle cx='18' cy='20' r='14' fill='${C.ume}'/><ellipse cx='13' cy='15' rx='4' ry='2.4' fill='rgba(255,255,255,.5)'/><path d='M18 7 q2 -5 7 -5' stroke='#4E8C4A' stroke-width='2' fill='none' stroke-linecap='round'/><path d='M21 4 C24 0 30 1 31 3 C28 6 24 6 21 4Z' fill='${C.leaf}'/>`);
const I_REPLY = X(`viewBox='0 0 40 36'><path d='M20 3 C27 3 37 22 37 27 C37 32 33 34 20 34 C7 34 3 32 3 27 C3 22 13 3 20 3Z' fill='#fff' stroke='${C.nori}' stroke-width='1.8'/><path d='M9 23 H31 V34 H9Z' fill='${C.nori}'/><circle cx='15' cy='18' r='1.4' fill='${C.nori}'/><circle cx='25' cy='18' r='1.4' fill='${C.nori}'/><path d='M18 20.5 q2 1.6 4 0' stroke='${C.nori}' stroke-width='1.3' fill='none' stroke-linecap='round'/><ellipse cx='12' cy='21' rx='2' ry='1.1' fill='#F4A6A0'/><ellipse cx='28' cy='21' rx='2' ry='1.1' fill='#F4A6A0'/>`);
const I_PLUS = X(`viewBox='0 0 30 30'><path d='M4 26 C6 12 15 5 27 3 C26 15 18 24 4 26Z' fill='${C.leaf}'/><path d='M5 25 C11 18 18 11 25 5' stroke='#4E8C4A' stroke-width='1.2' fill='none'/><path d='M19 17 V27 M14 22 H24' stroke='#fff' stroke-width='2.4' stroke-linecap='round'/><path d='M19 17 V27 M14 22 H24' stroke='${C.nori}' stroke-width='1.3' stroke-linecap='round'/>`);
const I_BENTO = X(`viewBox='0 0 30 30'><rect x='3' y='7' width='24' height='18' rx='3' fill='#fff' stroke='${C.nori}' stroke-width='1.8'/><path d='M15 7 V25' stroke='${C.nori}' stroke-width='1.4'/><circle cx='9' cy='16' r='3' fill='${C.ume}'/><path d='M18 12 h6 M18 16 h6 M18 20 h6' stroke='#E9B949' stroke-width='2.2' stroke-linecap='round'/><path d='M3 7 Q15 1 27 7' fill='none' stroke='${C.nori}' stroke-width='1.6'/>`);
const I_CHOP = X(`viewBox='0 0 30 30' fill='none' stroke-linecap='round'><path d='M7 3 L13 27' stroke='#B8875A' stroke-width='2.6'/><path d='M20 3 L16 27' stroke='#B8875A' stroke-width='2.6'/><path d='M7 3 L8.3 8 M20 3 L19.1 8' stroke='${C.ume}' stroke-width='2.8'/>`);
const bubble = { myBg: C.nori, myText: "#fff", myBorder: "none", charBg: C.rice, charText: C.ink, charBorder: "none", radius: 14, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };
// 饭团形头像：上头圆、下头宽一点；外一圈白米、底下多垫一弯海苔
const ONI = "50% 50% 16% 16% / 66% 66% 34% 34%";
const RING_HIS = `0 0 0 4px #fff,0 0 0 5px ${C.grain},0 5px 0 4px ${C.nori},0 8px 10px rgba(44,58,51,.18)`;
const RING_ME = `0 0 0 4px #fff,0 0 0 5px ${C.grain},0 5px 0 4px ${C.ume},0 8px 10px rgba(44,58,51,.18)`;
const css = `
/* ───── 梅子饭团 · 第一批 ───── */
[data-wk="chat"]{background:${svg(SESAME)} 0 0/90px 90px,${C.bg} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：一整块白米，底边包一条海苔 */
[data-wk="chathead"]{background:${svg(GRAINS)} 0 0/40px 30px,#fff !important;border-bottom:6px solid ${C.nori} !important;box-shadow:0 3px 8px rgba(44,58,51,.12) !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important;font-weight:600 !important}
[data-wk="headdim"],[data-wk="headname"] > div:last-child{color:${C.fog} !important}
[data-wk="chatback"] svg{stroke:${C.nori} !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:26px !important;min-width:26px !important;height:26px !important;flex-shrink:0 !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_BENTO)} center/contain no-repeat !important;margin-left:auto !important}
[data-wk="chatmore"]{background:${svg(I_CHOP)} center/contain no-repeat !important;margin-left:4px !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chathead"] [data-wk="headme"]{display:inline-flex !important;position:relative !important;overflow:visible !important;margin-left:-10px !important;flex-shrink:0 !important}
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img,[data-wk="chathead"] [data-wk="avatar"]{width:32px !important;height:32px !important;min-width:32px !important;flex-shrink:0 !important;aspect-ratio:1 !important;border-radius:${ONI} !important}
[data-wk="chathead"] [data-wk="avatar"]{box-shadow:0 0 0 3px #fff,0 0 0 4px ${C.grain},0 4px 0 3px ${C.nori} !important}
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img{box-shadow:0 0 0 3px #fff,0 0 0 4px ${C.grain},0 4px 0 3px ${C.ume} !important}
[data-wk="chathead"] [data-wk="headme"]::before{content:"" !important;position:absolute !important;left:-8px !important;bottom:-5px !important;width:13px !important;height:13px !important;z-index:3 !important;background:${svg(UME)} center/contain no-repeat !important}
[data-wk="offline"] [data-wk="chathead"] [data-wk="headme"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"]{flex:1 1 auto !important;min-width:84px !important}
[data-wk="chathead"] [data-wk="headname"] > div:last-child{white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important}

/* 头像：饭团形——上圆下宽，一圈白米，底下垫一弯海苔（我的垫梅子红），角上一片竹叶（竹叶挂在消息行上，img 挂不住） */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *,[data-wk="msg"] [data-wk="avatar"],[data-wk="cardrow"] [data-wk="avatar"],[data-wk="rpsingle"] [data-wk="avatar"]{border-radius:${ONI} !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]),[data-wk="msg"] [data-wk="avatar"],[data-wk="cardrow"] [data-wk="avatar"],[data-wk="rpsingle"] > :first-child[data-wk="avatar"]{box-shadow:${RING_HIS} !important}
[data-wk="msg"][data-me="1"] [data-wk="avatar"],[data-wk="cardrow"][data-me="1"] [data-wk="avatar"],[data-wk="rpsingle"] > [data-wk="rpcard"] + [data-wk="avatar"]{box-shadow:${RING_ME} !important}
[data-wk="msg"]{position:relative !important}
[data-wk="msg"][data-first="1"][data-me="0"]::after,[data-wk="msg"][data-first="1"][data-me="1"]::after{content:"" !important;position:absolute !important;top:-4px !important;width:22px !important;height:16px !important;background:${svg(LEAF)} center/contain no-repeat !important;pointer-events:none !important;z-index:4 !important}
[data-wk="msg"][data-first="1"][data-me="0"]::after{left:6px !important;transform:scaleX(-1) rotate(10deg) !important}
[data-wk="msg"][data-first="1"][data-me="1"]::after{right:6px !important;transform:rotate(10deg) !important}

/* 气泡：他是白米饭团、左边包一截海苔；我是整张海苔、右边一颗梅子 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:14px !important;line-height:1.6 !important;letter-spacing:.03em !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:linear-gradient(90deg,${C.nori} 0 18px,transparent 18px),${svg(GRAINS)} 0 0/40px 30px,#fff !important;color:${C.ink} !important;padding:10px 16px 10px 30px !important;box-shadow:0 2px 0 ${C.grain},0 4px 10px rgba(44,58,51,.1) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{content:"" !important;position:absolute !important;left:6px !important;top:8px !important;width:6px !important;height:calc(100% - 16px) !important;background:linear-gradient(180deg,rgba(255,255,255,.12) 0 2px,transparent 2px 8px) 0 0/6px 8px !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(135deg,${C.nori2},${C.nori}) !important;color:#fff !important;padding:10px 38px 10px 16px !important;box-shadow:0 2px 0 #1E2823,0 4px 10px rgba(44,58,51,.18) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{content:"" !important;position:absolute !important;right:10px !important;top:calc(50% - 9px) !important;width:18px !important;height:18px !important;background:${svg(UME)} center/contain no-repeat !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::after,[data-wk="bubble"][data-kind="text"][data-me="1"]::before{content:none !important}

/* 时间：一行灰字，两边几粒米 */
[data-wk="time"] > span{background:none !important;border:none !important;box-shadow:none !important;color:${C.fog} !important;font-size:11.5px !important;letter-spacing:.15em !important}
[data-wk="time"] > span::before{content:"· · ·  " !important;color:${C.grain} !important}
[data-wk="time"] > span::after{content:"  · · ·" !important;color:${C.grain} !important}
/* 已读：一粒黑芝麻；没读是一粒白米 */
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important;letter-spacing:.1em !important;display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"]::before{content:"" !important;width:7px !important;height:4px !important;border-radius:50% !important;background:${C.nori} !important;transform:rotate(-25deg) !important}
[data-wk="meta"][data-read="0"]::before{background:#fff !important;box-shadow:0 0 0 1px ${C.grain} !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]{flex-direction:row-reverse !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-run][data-last="1"] + [data-wk="cardmeta"]{display:block !important;font-size:10.5px !important;color:${C.fog} !important;padding:2px 0 0 62px !important}
[data-run][data-last="1"] + [data-wk="cardmeta"][data-me="1"]{text-align:right !important;padding:2px 62px 0 0 !important}
[data-wk="bubble"][data-kind="typing"]{background:#fff !important;border:none !important;border-radius:14px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.nori} !important}

/* 动描：一张浅竹叶绿的小便笺，左边一片竹叶，不跟气泡一个样 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"],[data-wk="myactink"]{display:inline-block !important;position:relative !important;background:#EAF3E3 !important;border:none !important;border-radius:4px 12px 12px 4px !important;box-shadow:none !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;color:#5E7A58 !important;opacity:1 !important;font-style:italic !important;font-size:12.5px !important;line-height:1.75 !important;padding:5px 14px 5px 30px !important}
[data-wk="narrink"]::before,[data-wk="myactink"]::before{content:"" !important;position:absolute !important;left:8px !important;top:7px !important;width:16px !important;height:12px !important;background:${svg(LEAF)} center/contain no-repeat !important}
[data-wk="myactink"]{border-radius:12px 4px 4px 12px !important;padding:5px 30px 5px 14px !important;background:#FBE9E6 !important;color:#A0504C !important}
[data-wk="myactink"]::before{left:auto !important;right:8px !important;background:${svg(UME)} center/contain no-repeat !important;width:12px !important;height:12px !important}
/* 系统提示：一行小灰字，两头一粒芝麻 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.08em !important}
[data-wk="sysnotetext"]::before{content:"• " !important;color:${C.nori} !important}
[data-wk="sysnotetext"]::after{content:" •" !important;color:${C.nori} !important}
/* 旁白栏 */
[data-wk="narrbar"]{background:#fff !important;border-top:1px solid ${C.grain} !important}
[data-wk="narrkind"]{border:1px solid ${C.grain} !important;border-radius:999px !important;background:transparent !important;color:${C.fog} !important}
[data-wk="narrkind"][data-on="1"]{background:${C.nori} !important;border-color:${C.nori} !important;color:#fff !important}

/* 底栏：一块白米托盘；左竹叶加号、米色输入框、右边梅子发送、小饭团回复 */
[data-wk="composer"]{background:#fff !important;border-top:none !important;box-shadow:0 -3px 10px rgba(44,58,51,.08) !important;align-items:center !important;gap:8px !important;border-radius:18px 18px 0 0 !important}
[data-wk="chatinput"]{background:#F4F2EC !important;border:none !important;border-radius:14px !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:#B3B5AE !important}
[data-wk="chatplus"]{width:30px !important;min-width:30px !important;height:30px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{width:36px !important;min-width:36px !important;height:36px !important;border:none !important;border-radius:0 !important;background:${svg(I_SEND)} center/contain no-repeat !important;box-shadow:none !important;opacity:1 !important}
[data-wk="chatreply"]{width:38px !important;min-width:38px !important;height:34px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.92) !important}
`;
const pack = { kind: "chat-look", v: 1, name: "梅子饭团", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "梅子饭团-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
