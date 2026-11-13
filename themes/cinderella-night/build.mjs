// 午夜舞会（灰姑娘·夜版）：紫色夜空、一道魔法光带横过顶部，光带中间一面发光的钟；
// 他的话＝珍珠白，我的话＝紫色薄玻璃描金；头像一圈珍珠光环；悬浮的金边胶囊顶栏底栏。用法：node themes/cinderella-night/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { v1: "#3E3C8E", v2: "#5A55B0", v3: "#8C7CC8", v4: "#B79AD6", gold: "#F2D9A0", goldD: "#D9B46A", pearl: "#FFFDF6", pearl2: "#FBF2DC", ink: "#3F3A6A", lilac: "#D8D2F2" };
const SERIF = `"Songti SC","Noto Serif SC","STSong",serif`;

const STAR = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-6 -8 12 16'><path d='M0 -7 Q.6 -.6 5 0 Q.6 .6 0 7 Q-.6 .6 -5 0 Q-.6 -.6 0 -7Z' fill='#FFF6DA'/></svg>`;
const SKY = `<svg xmlns='http://www.w3.org/2000/svg' width='390' height='520'>${[[60,90,1],[340,70,.9],[200,260,.8],[40,380,1],[300,440,.9],[150,480,.7],[360,300,.7]].map(([x,y,o])=>`<path transform='translate(${x} ${y})' d='M0 -7 Q.6 -.6 5 0 Q.6 .6 0 7 Q-.6 .6 -5 0 Q-.6 -.6 0 -7Z' fill='#FFF6DA' opacity='${o}'/>`).join('')}${[[110,40],[250,120],[90,200],[330,190],[180,340],[60,300],[270,380],[120,430],[350,500],[220,30]].map(([x,y])=>`<circle cx='${x}' cy='${y}' r='1.3' fill='#fff' opacity='.7'/>`).join('')}</svg>`;
// 顶上：一道魔法光带从左下扫到右上，中间一面发光的钟（指针停在快十二点）
const RIBBON = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 230'><defs><linearGradient id='r' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='0'/><stop offset='.25' stop-color='#E7E2FF' stop-opacity='.45'/><stop offset='.6' stop-color='#F4F0FF' stop-opacity='.55'/><stop offset='1' stop-color='#fff' stop-opacity='.1'/></linearGradient><radialGradient id='halo'><stop offset='0' stop-color='#FFF6DA' stop-opacity='.9'/><stop offset='.5' stop-color='#FFE9B0' stop-opacity='.35'/><stop offset='1' stop-color='#FFE9B0' stop-opacity='0'/></radialGradient><radialGradient id='face' cx='.4' cy='.35'><stop offset='0' stop-color='#fff'/><stop offset='1' stop-color='#F3ECFF'/></radialGradient></defs><g transform='translate(0 -32)'><path d='M-10 190 C80 150 140 160 200 130 C260 100 300 30 400 70 L400 110 C310 70 270 140 210 168 C150 196 80 188 -10 225Z' fill='url(#r)'/><path d='M-10 200 C80 160 140 170 200 140 C260 110 300 40 400 80' fill='none' stroke='#fff' stroke-width='1.6' opacity='.6'/></g><circle cx='195' cy='118' r='64' fill='url(#halo)'/><circle cx='195' cy='118' r='38' fill='url(#face)' stroke='${C.goldD}' stroke-width='3'/><circle cx='195' cy='118' r='34' fill='none' stroke='${C.gold}' stroke-width='1'/>${Array.from({length:12},(_,i)=>{if(!i)return '';const a=i*30*Math.PI/180,r1=i%3?27:25,r2=31;return `<path d='M${(195+r1*Math.sin(a)).toFixed(1)} ${(118-r1*Math.cos(a)).toFixed(1)} L${(195+r2*Math.sin(a)).toFixed(1)} ${(118-r2*Math.cos(a)).toFixed(1)}' stroke='${C.ink}' stroke-width='${i%3?1:1.8}'/>`}).join('')}<text x='195' y='95' text-anchor='middle' font-size='8.5' font-family='Georgia,serif' fill='${C.ink}'>XII</text><path d='M195 118 L194 103 L195 100 L196 103Z' fill='${C.ink}'/><path transform='rotate(-48 195 118)' d='M195 118 L194 101 L195 98 L196 101Z' fill='${C.ink}'/><circle cx='195' cy='118' r='2.4' fill='${C.goldD}'/></svg>`;
const CLK = fill => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><circle cx='10' cy='10' r='8' fill='${fill ? C.gold : "none"}' stroke='${fill ? C.gold : C.lilac}' stroke-width='1.5'/><path d='M10 5 V10.5' fill='none' stroke='${fill ? C.ink : C.lilac}' stroke-width='1.8' stroke-linecap='round'/></svg>`;
const CI = inner => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='17' fill='rgba(255,255,255,.08)' stroke='${C.lilac}' stroke-width='1.3'/>${inner}</svg>`;
// 按键：主页＝一座城堡；更多＝仙女的魔杖；加号＝四角带星的小十字；发送＝一颗往右飞的流星
const I_HOUSE = CI(`<g fill='none' stroke='#fff' stroke-width='1.3' stroke-linejoin='round'><path d='M12 28 V18 L14 15 L16 18 V28'/><path d='M24 28 V18 L26 15 L28 18 V28'/><path d='M16 28 V19 Q20 13 24 19 V28'/><path d='M11 28 H29'/></g><path d='M19 28 V24 Q20 22.5 21 24 V28' fill='#fff'/><path d='M20 15.5 V11 L23 12 L20 13' fill='${C.gold}' stroke='${C.gold}' stroke-width='.8' stroke-linejoin='round'/>`);
const I_MORE = CI(`<path d='M12 28 L24 16' stroke='#fff' stroke-width='1.7' stroke-linecap='round'/><path transform='translate(26.5 13.5)' d='M0 -6 Q.5 -.5 4.5 0 Q.5 .5 0 6 Q-.5 .5 -4.5 0 Q-.5 -.5 0 -6Z' fill='${C.gold}'/><circle cx='30' cy='21' r='1' fill='#fff'/><circle cx='19' cy='11' r='.9' fill='#fff'/>`);
const I_PLUS = CI(`<path d='M20 13 V27 M13 20 H27' stroke='#fff' stroke-width='1.6' stroke-linecap='round'/>${[[20,11],[29,20],[20,29],[11,20]].map(([x,y])=>`<path transform='translate(${x} ${y})' d='M0 -2.4 Q.2 -.2 1.7 0 Q.2 .2 0 2.4 Q-.2 .2 -1.7 0 Q-.2 -.2 0 -2.4Z' fill='${C.gold}'/>`).join('')}`);
const I_SEND = CI(`<path d='M10 25 Q16 23 22 21' stroke='#fff' stroke-width='1.2' stroke-linecap='round' opacity='.5'/><path d='M12 21 Q18 19.5 23 19' stroke='#fff' stroke-width='1.4' stroke-linecap='round' opacity='.75'/><path transform='translate(26 18.5)' d='M0 -6 Q.5 -.5 5 0 Q.5 .5 0 6 Q-.5 .5 -5 0 Q-.5 -.5 0 -6Z' fill='${C.gold}'/>`);
// 最右「让他回复」：一颗发光的珍珠钮，里面一个对话框
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'><defs><radialGradient id='p' cx='.38' cy='.32'><stop offset='0' stop-color='#fff'/><stop offset='.7' stop-color='${C.pearl2}'/><stop offset='1' stop-color='#EAD9B0'/></radialGradient></defs><circle cx='25' cy='25' r='21' fill='url(#p)' stroke='${C.goldD}' stroke-width='1.4'/><path d='M16 18 H34 Q36 18 36 20 V28 Q36 30 34 30 H24 L19 34 V30 H16 Q14 30 14 28 V20 Q14 18 16 18Z' fill='none' stroke='${C.ink}' stroke-width='1.6' stroke-linejoin='round'/><path transform='translate(35 16)' d='M0 -4.5 Q.4 -.4 3.2 0 Q.4 .4 0 4.5 Q-.4 .4 -3.2 0 Q-.4 -.4 0 -4.5Z' fill='${C.goldD}'/></svg>`;

// 玻璃鞋：侧面的一只高跟鞋——尖头在左，低开口，鞋跟细高在右，玻璃里带几道高光
const SLIPPER = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 38'><defs><linearGradient id='gl' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff' stop-opacity='.9'/><stop offset='.55' stop-color='#D6E4FF' stop-opacity='.5'/><stop offset='1' stop-color='#F1E8FF' stop-opacity='.75'/></linearGradient></defs><path d='M4 29 Q4 24 12 22.5 Q17 21.5 20 21 Q30 19 40 13 Q45 10 49 10 L50.5 10.5 L50.5 18 L47.8 35 L45.2 35 L44.6 23.5 Q38 24.5 32 28 Q26 31.5 14 31.5 Q4 32 4 29Z' fill='url(#gl)' stroke='#fff' stroke-width='1.3' stroke-linejoin='round'/><path d='M20 21 Q28 23 36 18.5 Q43 14.5 49.5 11.5' fill='none' stroke='#B9C8EE' stroke-width='1.2'/><path d='M9 27 Q14 25.5 19 25.5' fill='none' stroke='#fff' stroke-width='1.6' stroke-linecap='round'/><path d='M47 14 V19' stroke='#fff' stroke-width='1.2' stroke-linecap='round' opacity='.8'/><path transform='translate(55 6)' d='M0 -4.5 Q.4 -.4 3.2 0 Q.4 .4 0 4.5 Q-.4 .4 -3.2 0 Q-.4 -.4 0 -4.5Z' fill='#FFF6DA'/></svg>`;
// 头像框＝南瓜马车的小窗：一颗珠光金南瓜（几道瓣棱），正中开一扇圆窗露出头像，顶上卷藤＋小皇冠，底下两只小轮子
const PUMPKIN = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 140'><defs><radialGradient id='pk' cx='.4' cy='.35' r='.75'><stop offset='0' stop-color='#FFF4DC'/><stop offset='.55' stop-color='#F6D69C'/><stop offset='1' stop-color='#D9A85A'/></radialGradient><mask id='win'><rect width='140' height='140' fill='#fff'/><circle cx='70' cy='74' r='36' fill='#000'/></mask></defs><g mask='url(#win)'><path d='M70 24 C40 22 16 38 14 70 C12 100 34 120 70 120 C106 120 128 100 126 70 C124 38 100 22 70 24Z' fill='url(#pk)' stroke='${C.goldD}' stroke-width='2'/><g fill='none' stroke='#D9A85A' stroke-width='1.6' opacity='.8'><path d='M44 30 C30 50 30 98 46 116'/><path d='M96 30 C110 50 110 98 94 116'/><path d='M26 46 C18 66 20 92 30 106'/><path d='M114 46 C122 66 120 92 110 106'/></g></g><circle cx='70' cy='74' r='36' fill='none' stroke='${C.goldD}' stroke-width='3'/><circle cx='70' cy='74' r='39.5' fill='none' stroke='#FFF6DA' stroke-width='1.6' stroke-dasharray='.1 5' stroke-linecap='round'/><path d='M70 24 Q68 14 74 9 Q80 6 82 12' fill='none' stroke='#8FB07A' stroke-width='3' stroke-linecap='round'/><path d='M74 12 Q86 6 92 14 Q84 18 76 15Z' fill='#A7C58E' stroke='#6F9060' stroke-width='1'/><path d='M56 22 L58 13 L63 18 L67 10 L71 18 L76 13 L78 22Z' fill='#F6E3A6' stroke='${C.goldD}' stroke-width='1.2' stroke-linejoin='round' transform='rotate(-12 67 17)'/><circle cx='66' cy='15' r='1.6' fill='#9FC4F0' transform='rotate(-12 67 17)'/><g fill='#fff' stroke='${C.goldD}' stroke-width='2'><circle cx='38' cy='124' r='9'/><circle cx='102' cy='124' r='9'/></g><g stroke='${C.goldD}' stroke-width='1.2'><path d='M38 115 V133 M29 124 H47 M102 115 V133 M93 124 H111'/></g><path d='M16 64 Q6 60 8 52 Q12 48 16 54 M124 64 Q134 60 132 52 Q128 48 124 54' fill='none' stroke='${C.goldD}' stroke-width='2' stroke-linecap='round'/></svg>`;

// ── 第二批用的图 ──
const SEALCROWN = (c) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'><path d='M25 3 Q32 2 35 7 Q42 7 44 14 Q49 19 46 26 Q49 33 44 38 Q42 45 35 44 Q32 49 25 47 Q18 49 15 44 Q8 45 6 38 Q1 33 4 26 Q1 19 6 14 Q8 7 15 7 Q18 2 25 3Z' fill='${c}'/><path d='M15 31 L14 20 L19.5 24.5 L25 16 L30.5 24.5 L36 20 L35 31Z' fill='none' stroke='rgba(255,255,255,.75)' stroke-width='1.6' stroke-linejoin='round'/></svg>`;
const PUMP = (lit) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 70 64'><defs><radialGradient id='p' cx='.4' cy='.35' r='.75'><stop offset='0' stop-color='${lit ? "#FFF4DC" : "#F7B776"}'/><stop offset='.6' stop-color='${lit ? "#F6D69C" : "#E8823A"}'/><stop offset='1' stop-color='${lit ? "#D9A85A" : "#B5541C"}'/></radialGradient></defs><path d='M35 14 C18 12 4 22 4 38 C4 54 18 60 35 60 C52 60 66 54 66 38 C66 22 52 12 35 14Z' fill='url(#p)' stroke='${lit ? C.goldD : "#8E3E14"}' stroke-width='1.6'/><g fill='none' stroke='${lit ? "#D9A85A" : "#B5541C"}' stroke-width='1.4' opacity='.85'><path d='M22 17 C14 28 14 50 23 58'/><path d='M48 17 C56 28 56 50 47 58'/><path d='M35 14 V60'/></g><path d='M35 14 Q34 6 39 3' fill='none' stroke='#6F9060' stroke-width='2.6' stroke-linecap='round'/>${lit ? `<circle cx='35' cy='38' r='10' fill='#fff' stroke='${C.goldD}' stroke-width='2'/><circle cx='35' cy='38' r='10' fill='none' stroke='#FFF6DA' stroke-width='1' stroke-dasharray='.1 3' stroke-linecap='round'/><circle cx='21' cy='60' r='4' fill='#fff' stroke='${C.goldD}' stroke-width='1.4'/><circle cx='49' cy='60' r='4' fill='#fff' stroke='${C.goldD}' stroke-width='1.4'/>` : ``}</svg>`;
const OVALM = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 120' preserveAspectRatio='none'><ellipse cx='50' cy='60' rx='47' ry='57' fill='none' stroke='${C.goldD}' stroke-width='5' vector-effect='non-scaling-stroke'/><ellipse cx='50' cy='60' rx='47' ry='57' fill='none' stroke='#FFF6DA' stroke-width='2' stroke-dasharray='.1 6' stroke-linecap='round' vector-effect='non-scaling-stroke'/></svg>`;
const NOTE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 24'><path d='M7 18 V5 L17 2.5 V15' fill='none' stroke='${C.goldD}' stroke-width='1.8' stroke-linejoin='round'/><ellipse cx='5' cy='18.5' rx='3.4' ry='2.6' fill='${C.goldD}'/><ellipse cx='15' cy='15.5' rx='3.4' ry='2.6' fill='${C.goldD}'/></svg>`;
const CARD = `background:linear-gradient(135deg,#FFFFFF 0%,#FCEFF5 40%,#EEF1FF 75%,#FFF7E8 100%) !important;border:1.2px solid rgba(242,217,160,.85) !important;border-radius:14px !important;box-shadow:0 0 18px rgba(255,220,180,.4) !important;color:${C.ink} !important`;

// 照片＝南瓜马车的车窗：拱顶窗，两边系起来的纱帘，顶上一截南瓜藤
const CARWIN = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 240' preserveAspectRatio='none'><path d='M10 236 V80 Q10 10 100 10 Q190 10 190 80 V236' fill='none' stroke='${C.goldD}' stroke-width='6' vector-effect='non-scaling-stroke'/><path d='M18 236 V82 Q18 20 100 20 Q182 20 182 82 V236' fill='none' stroke='#FFF6DA' stroke-width='1.6' vector-effect='non-scaling-stroke'/><path d='M18 50 Q17 120 30 170 Q22 200 18 236 Z' fill='rgba(255,226,240,.85)' stroke='#F2C7D9' stroke-width='1'/><path d='M182 50 Q183 120 170 170 Q178 200 182 236 Z' fill='rgba(255,226,240,.85)' stroke='#F2C7D9' stroke-width='1'/><circle cx='29' cy='170' r='4' fill='${C.goldD}'/><circle cx='171' cy='170' r='4' fill='${C.goldD}'/></svg>`;
const VINE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 26'><path d='M4 20 Q20 6 40 14 Q58 22 76 8' fill='none' stroke='#8FB07A' stroke-width='2.4' stroke-linecap='round'/><path d='M22 12 Q28 2 36 8 Q30 14 22 12Z' fill='#A7C58E'/><path d='M52 18 Q60 8 68 14 Q60 22 52 18Z' fill='#A7C58E'/><path d='M74 8 Q80 4 78 0' fill='none' stroke='#8FB07A' stroke-width='1.6' stroke-linecap='round'/></svg>`;
// 好感：一面午夜钟，指针按好感转——满好感正好走到十二点（钟声敲响的那一刻）
const LOVECLOCK = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><radialGradient id='f' cx='.4' cy='.35'><stop offset='0' stop-color='#fff'/><stop offset='1' stop-color='#F3ECFF'/></radialGradient></defs><circle cx='50' cy='50' r='44' fill='url(#f)' stroke='${C.goldD}' stroke-width='4'/><circle cx='50' cy='50' r='39' fill='none' stroke='${C.gold}' stroke-width='1'/>${Array.from({length:12},(_,i)=>{const a=i*30*Math.PI/180,r1=i%3?32:29,r2=36;return `<path d='M${(50+r1*Math.sin(a)).toFixed(1)} ${(50-r1*Math.cos(a)).toFixed(1)} L${(50+r2*Math.sin(a)).toFixed(1)} ${(50-r2*Math.cos(a)).toFixed(1)}' stroke='${C.ink}' stroke-width='${i%3?1:2}'/>`}).join('')}<path transform='translate(50 21)' d='M0 -5 Q.4 -.4 3.5 0 Q.4 .4 0 5 Q-.4 .4 -3.5 0 Q-.4 -.4 0 -5Z' fill='${C.goldD}'/><circle cx='50' cy='50' r='3' fill='${C.goldD}'/></svg>`;
const HAND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 40'><path d='M5 2 L7.5 30 L5 38 L2.5 30Z' fill='${C.ink}'/><path transform='translate(5 8)' d='M0 -4 Q.3 -.3 2.6 0 Q.3 .3 0 4 Q-.3 .3 -2.6 0 Q-.3 -.3 0 -4Z' fill='${C.goldD}'/></svg>`;
const bubble = { myBg: C.v2, myText: "#fff", myBorder: "none", charBg: C.pearl, charText: C.ink, charBorder: "none", radius: 16, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };
const PANEL = `background:linear-gradient(180deg,rgba(120,110,200,.55),rgba(90,85,176,.45)) !important;backdrop-filter:blur(10px) !important;-webkit-backdrop-filter:blur(10px) !important;border-radius:20px !important;box-shadow:inset 0 0 0 1.4px rgba(242,217,160,.75),0 8px 20px rgba(40,30,100,.3) !important`;

const css = `
/* ───── 午夜舞会 · 第一批 ───── */
[data-wk="chat"]{background:${svg(SKY)} 0 0/390px 520px repeat,radial-gradient(ellipse at 20% 85%,rgba(200,150,220,.45),transparent 55%),radial-gradient(ellipse at 85% 60%,rgba(140,170,240,.35),transparent 50%),linear-gradient(180deg,${C.v1} 0%,${C.v2} 45%,${C.v3} 80%,${C.v4} 100%) !important}
[data-wk="chat"] *{font-family:${SERIF} !important}
/* 聊天顶上那道光带和发光的钟：跟着内容滚，只在最上面 */
[data-wk="body"]{background:${svg(RIBBON)} center top/100% auto no-repeat !important;background-attachment:local !important;padding-top:170px !important}

/* 顶栏底栏：悬浮的半透明紫胶囊，一圈淡金边 */
[data-wk="chathead"]{position:relative !important;overflow:visible !important;background:transparent !important;border-bottom:none !important;box-shadow:none !important;gap:6px !important;z-index:5 !important}
[data-wk="chathead"]::before{content:"" !important;position:absolute !important;left:12px !important;right:12px !important;top:calc(var(--app-safe-top, 0px) + 2px) !important;bottom:4px !important;${PANEL};z-index:-1 !important;pointer-events:none !important}
[data-wk="headink"],[data-wk="headink"] *{color:#fff !important}
[data-wk="headname"] > [data-wk="headink"]{font-weight:700 !important;letter-spacing:.12em !important}
[data-wk="headdim"]{color:${C.lilac} !important;white-space:nowrap !important}
[data-wk="chatback"],[data-wk="chatback"] *{color:#fff !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:#fff !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:34px !important;min-width:34px !important;height:34px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important;margin-right:8px !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chathead"] + *:not([data-wk="body"]),[data-wk="chathead"] + *:not([data-wk="body"]) *{color:#fff !important}

/* 头像：一圈珍珠光环，右上一颗小星 */
button[data-wk="avatar"],span[data-wk="avatar"]{position:relative !important;overflow:visible !important;border-radius:50% !important;box-shadow:0 0 0 3px ${C.pearl2},0 0 0 4px ${C.goldD},0 0 16px 4px rgba(255,240,200,.45) !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{border-radius:50% !important}
button[data-wk="avatar"]::after,span[data-wk="avatar"]:not([data-halo])::after{content:"" !important;position:absolute !important;right:-4px !important;top:-6px !important;width:10px !important;height:13px !important;background:${svg(STAR)} center/contain no-repeat !important;pointer-events:none !important}

/* 他的话：珍珠白，淡淡的光；你的话：紫色薄玻璃，描一圈淡金 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:16px !important;letter-spacing:.08em !important;padding:11px 20px !important}
[data-wk="bubble"][data-kind="text"]::before,[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:linear-gradient(120deg,#fff,${C.pearl} 50%,${C.pearl2}) !important;color:${C.ink} !important;border:1.2px solid rgba(242,217,160,.8) !important;box-shadow:0 0 14px rgba(255,245,220,.55) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,rgba(110,100,200,.75),rgba(80,72,170,.75)) !important;color:#fff !important;border:1.4px solid rgba(242,217,160,.85) !important;box-shadow:0 0 12px rgba(242,217,160,.25),inset 0 1px 0 rgba(255,255,255,.25) !important}

/* 时间：一行淡紫小字 */
[data-wk="time"] > span{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.lilac} !important;letter-spacing:.3em !important;font-size:11.5px !important}
/* 已读＝金色小钟；已送达＝淡紫空心小钟 */
[data-wk="meta"]{color:${C.lilac} !important;font-size:10.5px !important;letter-spacing:.12em !important;display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"]::after{content:"" !important;width:12px !important;height:12px !important;flex:none !important;background:${svg(CLK(false))} center/contain no-repeat !important}
[data-wk="meta"][data-read="1"]::after{background:${svg(CLK(true))} center/contain no-repeat !important;filter:drop-shadow(0 0 3px rgba(242,217,160,.8)) !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.pearl} !important;border:1.2px solid rgba(242,217,160,.8) !important;border-radius:16px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.goldD} !important}
[data-wk="name"]{color:${C.lilac} !important}

/* 动描：没有框，淡金斜体，上下各一颗小星 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{position:relative !important;display:block !important;background:transparent !important;border:none !important;border-radius:0 !important;box-shadow:none !important;color:#FFF0CC !important;font-style:italic !important;font-size:13px !important;line-height:1.9 !important;letter-spacing:.1em !important;text-align:center !important;text-shadow:0 0 8px rgba(255,230,170,.5) !important;padding:14px 26px !important}
[data-wk="narrink"]::before,[data-wk="narrink"]::after{content:"" !important;position:absolute !important;left:50% !important;width:8px !important;height:11px !important;margin-left:-4px !important;background:${svg(STAR)} center/contain no-repeat !important}
[data-wk="narrink"]::before{top:0 !important}
[data-wk="narrink"]::after{bottom:0 !important}
/* 系统提示 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{border:none !important;color:${C.lilac} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.1em !important;padding-left:16px !important;background:${svg(STAR)} left center/8px 11px no-repeat !important}
[data-wk="sysnoteclose"]{color:${C.lilac} !important}

/* 底栏：同一种悬浮胶囊；输入框淡紫玻璃；发送细线箭头；最右「让他回复」是发光珍珠钮 */
[data-wk="composer"]{position:relative !important;overflow:visible !important;background:transparent !important;border-top:none !important;box-shadow:none !important;align-items:center !important;gap:10px !important;padding-left:24px !important;padding-right:24px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:12px !important;right:12px !important;top:6px !important;bottom:6px !important;${PANEL};z-index:-1 !important;pointer-events:none !important}
[data-wk="chatinput"]{background:rgba(255,255,255,.12) !important;border:1px solid rgba(216,210,242,.55) !important;border-radius:14px !important;color:#fff !important;letter-spacing:.08em !important}
[data-wk="chatinput"]::placeholder{color:${C.lilac} !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{width:34px !important;min-width:34px !important;height:34px !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{width:34px !important;min-width:34px !important;height:34px !important;background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:48px !important;min-width:48px !important;height:48px !important;border-radius:50% !important;background:${svg(I_REPLY)} center/contain no-repeat !important;filter:drop-shadow(0 0 10px rgba(255,236,190,.8)) !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.9) !important}
[data-wk="chatpanel"]{background:rgba(70,64,150,.95) !important;border-top:1px solid rgba(242,217,160,.6) !important}
[data-wk="quotedraft"]{position:relative !important;z-index:3 !important}
/* ───── 王宫台阶：连发一级级错开（他往右、你往左），贴紧，每级底下一道淡金立面；最新那段最后一级落一只玻璃鞋 ───── */
[data-wk="msg"][data-first="0"]{margin-top:-6px !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{border-radius:6px !important;box-shadow:0 5px 0 rgba(217,180,106,.75),0 0 14px rgba(255,245,220,.5) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{border-radius:6px !important;box-shadow:0 5px 0 rgba(60,52,140,.85),inset 0 1px 0 rgba(255,255,255,.25),0 0 12px rgba(242,217,160,.2) !important}
[data-wk="msg"][data-me="0"][data-first="0"] [data-wk="bubble"],[data-wk="msg"][data-me="0"][data-first="0"] [data-wk="meta"]{margin-left:20px !important}
[data-wk="msg"][data-me="0"][data-first="0"] [data-wk="bubble"]{max-width:calc(100% - 20px) !important}
[data-wk="msg"][data-me="1"][data-first="0"] [data-wk="bubble"]{margin-right:20px !important;max-width:calc(100% - 20px) !important}
[data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] [data-wk="bubble"],[data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] [data-wk="meta"]{margin-left:40px !important}
[data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] [data-wk="bubble"]{max-width:calc(100% - 40px) !important}
[data-wk="msg"][data-me="1"][data-first="0"] + [data-wk="msg"][data-me="1"][data-first="0"] [data-wk="bubble"]{margin-right:40px !important;max-width:calc(100% - 40px) !important}
[data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] [data-wk="bubble"],[data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] [data-wk="meta"]{margin-left:60px !important}
[data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] [data-wk="bubble"]{max-width:calc(100% - 60px) !important}
[data-wk="msg"][data-me="1"][data-first="0"] + [data-wk="msg"][data-me="1"][data-first="0"] + [data-wk="msg"][data-me="1"][data-first="0"] [data-wk="bubble"]{margin-right:60px !important;max-width:calc(100% - 60px) !important}
[data-wk="meta"]{margin-top:9px !important}
[data-wk="msg"][data-me="0"][data-last="1"]:not(:has(~ [data-wk="msg"][data-me="0"])) [data-wk="bubble"][data-kind="text"]::after{content:"" !important;position:absolute !important;right:-52px !important;bottom:-6px !important;width:44px !important;height:28px !important;background:${svg(SLIPPER)} center/contain no-repeat !important;filter:drop-shadow(0 0 6px rgba(220,235,255,.9)) !important}
/* ───── 梦幻感放进气泡（她 2026-11-13 的五条） ───── */
/* 4. 星星：去掉满屏平铺的星和光点，只在两侧空白处留六颗；头像上的小星也拿掉 */
[data-wk="chat"]{background:${svg(STAR)} left 10px top 18%/10px 14px no-repeat,${svg(STAR)} right 12px top 34%/8px 11px no-repeat,${svg(STAR)} left 14px top 52%/8px 11px no-repeat,${svg(STAR)} right 10px top 66%/10px 14px no-repeat,${svg(STAR)} left 8px top 80%/7px 10px no-repeat,${svg(STAR)} right 16px top 88%/7px 10px no-repeat,radial-gradient(ellipse at 20% 85%,rgba(200,150,220,.45),transparent 55%),radial-gradient(ellipse at 85% 60%,rgba(140,170,240,.35),transparent 50%),linear-gradient(180deg,${C.v1} 0%,${C.v2} 45%,${C.v3} 80%,${C.v4} 100%) !important}
button[data-wk="avatar"]::after,span[data-wk="avatar"]:not([data-halo])::after{content:none !important}
/* 1. 他的台阶：顶面是很淡的珠光渐变（白里带一点粉和蓝），底下垫一圈暖光 */
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:linear-gradient(135deg,#FFFFFF 0%,#FCEFF5 35%,#EEF1FF 70%,#FFF7E8 100%) !important;box-shadow:inset 0 1px 0 #fff,0 5px 0 rgba(217,180,106,.8),0 6px 22px rgba(255,210,160,.5) !important}
/* 2. 我的台阶：半透明亮一档的紫，磨砂，顶边一道细金线 */
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,rgba(170,160,240,.55),rgba(135,125,225,.45)) !important;backdrop-filter:blur(6px) !important;-webkit-backdrop-filter:blur(6px) !important;border:1px solid rgba(242,217,160,.55) !important;box-shadow:inset 0 1.6px 0 rgba(255,236,190,.95),0 5px 0 rgba(70,60,160,.75),0 6px 18px rgba(200,190,255,.3) !important}
/* 3. 台阶贴紧：组内零间距，上一级的立面直接压着下一级 */
[data-wk="msg"][data-first="0"]{margin-top:-12px !important}
[data-wk="msg"][data-first="0"] [data-wk="row"]{padding-top:0 !important;margin-top:0 !important}
/* 5. 状态字：近白，大一号 */
[data-wk="meta"]{color:#E6E2FA !important;font-size:11.5px !important}
/* ───── 头像框：南瓜马车的小窗（头像从窗里探出来） ───── */
button[data-wk="avatar"],span[data-wk="avatar"]{box-shadow:none !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;left:-47% !important;right:-47% !important;top:-63% !important;bottom:-61% !important;background:${svg(PUMPKIN)} center/contain no-repeat !important;pointer-events:none !important;border:none !important;border-radius:0 !important;z-index:2 !important;filter:drop-shadow(0 0 8px rgba(255,230,180,.55)) !important}
[data-wk="chathead"] button[data-wk="avatar"]::before,[data-wk="chathead"] span[data-wk="avatar"]::before,[data-wk="statehead"] [data-wk="avatar"]::before{content:none !important}
[data-wk="chathead"] img[data-wk="avatar"],[data-wk="chathead"] [data-wk="avatar"]{box-shadow:0 0 0 2.5px ${C.pearl2},0 0 0 3.5px ${C.goldD} !important}
/* 头像框比头像大，给台阶让一点位置 */
[data-wk="msg"] [data-wk="row"]{gap:14px !important}
/* 顶栏不做框：底子透明，底下一条横贯全宽的细金线（两头淡出），正中一颗小星 */
[data-wk="chathead"]::before{content:none !important}
[data-wk="chathead"]{background:linear-gradient(180deg,rgba(62,60,142,.55),rgba(62,60,142,0)) !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:0 !important;height:12px !important;margin-bottom:-6px !important;background:${svg(STAR)} center/8px 11px no-repeat,linear-gradient(90deg,rgba(242,217,160,0),rgba(242,217,160,.85) 20%,rgba(242,217,160,.85) calc(50% - 10px),transparent calc(50% - 10px),transparent calc(50% + 10px),rgba(242,217,160,.85) calc(50% + 10px),rgba(242,217,160,.85) 80%,rgba(242,217,160,0)) center/100% 1px no-repeat !important;pointer-events:none !important}
[data-wk="chatmore"]{margin-right:0 !important}
/* 底栏也不做框：透明底往下晕一点深紫，上沿一条横贯的细金线、正中一颗星 */
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:-6px !important;bottom:auto !important;height:12px !important;border-radius:0 !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;box-shadow:none !important;background:${svg(STAR)} center/8px 11px no-repeat,linear-gradient(90deg,rgba(242,217,160,0),rgba(242,217,160,.85) 20%,rgba(242,217,160,.85) calc(50% - 10px),transparent calc(50% - 10px),transparent calc(50% + 10px),rgba(242,217,160,.85) calc(50% + 10px),rgba(242,217,160,.85) 80%,rgba(242,217,160,0)) center/100% 1px no-repeat !important;z-index:1 !important}
[data-wk="composer"]{background:linear-gradient(180deg,rgba(140,124,200,0),rgba(110,96,180,.45)) !important;padding-left:16px !important;padding-right:16px !important}
/* ───── 午夜舞会 · 第二批：卡片 ───── */
[data-wk="voice"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{${CARD}}
[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:${C.ink} !important;border-color:rgba(217,180,106,.4) !important}

/* 转账＝一封王宫的舞会请柬：珠光卡、金线框，右上「Invitation」；收下压一枚紫色皇冠火漆，退回压灰色的 */
[data-wk="transfercard"]{position:relative !important;overflow:visible !important;${CARD};box-shadow:inset 0 0 0 4px rgba(255,255,255,.6),inset 0 0 0 5px rgba(217,180,106,.6),0 0 18px rgba(255,220,180,.4) !important}
[data-wk="transfercard"]::after{content:"Invitation" !important;position:absolute !important;right:14px !important;top:10px !important;font:italic 11px/1 Georgia,serif !important;color:${C.goldD} !important;letter-spacing:.06em !important}
[data-wk="transfercard"] *{color:${C.ink} !important;border-color:rgba(217,180,106,.4) !important}
[data-wk="transferlabel"]{color:#8C84B8 !important;letter-spacing:.25em !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:#5A4FB0 !important;font-weight:700 !important}
[data-wk="transferrule"]{border:none !important;height:12px !important;background:${svg(STAR)} center/8px 11px no-repeat,linear-gradient(90deg,transparent,rgba(217,180,106,.7) 20%,rgba(217,180,106,.7) calc(50% - 9px),transparent calc(50% - 9px),transparent calc(50% + 9px),rgba(217,180,106,.7) calc(50% + 9px),rgba(217,180,106,.7) 80%,transparent) center/100% 1px no-repeat !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:rgba(140,124,200,.08) !important}
[data-wk="transferbtn"]{border-radius:999px !important}
[data-wk="transferbtn"][data-part="take"]{background:linear-gradient(180deg,#8C7CE0,#5A55B0) !important;color:#fff !important;border:1px solid ${C.gold} !important}
[data-wk="transferbtn"][data-part="back"]{background:transparent !important;color:${C.ink} !important;border:1px solid rgba(90,85,176,.4) !important}
[data-wk="transferseal"]{background:transparent !important;border:1px solid ${C.goldD} !important;color:${C.goldD} !important;border-radius:50% !important;box-shadow:none !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{width:48px !important;height:48px !important;flex-shrink:0 !important;border:none !important;background:${svg(SEALCROWN("#6A5AC8"))} center/contain no-repeat !important;transform:rotate(-10deg) !important;filter:drop-shadow(0 2px 3px rgba(40,30,100,.35)) !important}
[data-wk="transfercard"][data-status="returned"]{filter:grayscale(.7) !important;opacity:.8 !important}
[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"]{width:48px !important;height:48px !important;flex-shrink:0 !important;border:none !important;background:${svg(SEALCROWN("#9A96B0"))} center/contain no-repeat !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] *,[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"] *{display:none !important}

/* 红包＝一颗珠光南瓜马车；领完了过了午夜，变回一颗普通的橙南瓜 */
[data-wk="rpcard"]{position:relative !important;overflow:visible !important;width:220px !important;min-height:86px !important;padding:16px 16px 16px 88px !important;${CARD}}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:64px !important;height:58px !important;margin-top:-30px !important;background:${svg(PUMP(true))} center/contain no-repeat !important;filter:drop-shadow(0 0 8px rgba(255,230,180,.7)) !important}
[data-wk="rpcard"]::after{content:"午夜之前有效" !important;position:absolute !important;right:12px !important;bottom:6px !important;font-size:9.5px !important;letter-spacing:.2em !important;color:#8C84B8 !important}
[data-wk="rpcard"] *{color:${C.ink} !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"] > div:not([data-wk]){padding:0 !important;background:transparent !important}
[data-wk="rpmsg"]{-webkit-line-clamp:2 !important;color:#5A4FB0 !important}
[data-wk="rpcard"][data-status="done"]{opacity:.85 !important}
[data-wk="rpcard"][data-status="done"]::before{background:${svg(PUMP(false))} center/contain no-repeat !important;filter:none !important}
[data-wk="rpcard"][data-status="done"]::after{content:"钟响了，变回南瓜" !important}
[data-wk="rpenvelope"][data-stage="closed"],[data-wk="rpenvelope"][data-stage="open"]{background:${svg(STAR)} left 18px top 30px/9px 12px no-repeat,${svg(STAR)} right 22px top 70px/8px 11px no-repeat,linear-gradient(180deg,${C.v1},${C.v2} 50%,${C.v3}) !important;border:1.4px solid rgba(242,217,160,.8) !important;border-radius:24px !important;box-shadow:0 0 30px rgba(255,230,180,.35),0 20px 40px rgba(30,20,80,.5) !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:linear-gradient(135deg,#fff,#FCEFF5 50%,#EEF1FF) !important;border-color:${C.gold} !important;box-shadow:none !important}
[data-wk="rpenvelope"] [data-wk="rparc"]::after{content:none !important}
[data-wk="rpenvelope"] *{color:#fff !important}
[data-wk="rpenvelope"] [data-wk="rparc"] *{color:${C.ink} !important}
[data-wk="rpopenbtn"]{background:${svg(PUMP(true))} center/86% no-repeat !important;border:none !important;box-shadow:none !important;filter:drop-shadow(0 0 12px rgba(255,230,180,.85)) !important}
[data-wk="rpopenbtn"],[data-wk="rpopenbtn"] *{color:transparent !important;font-size:0 !important}
[data-wk="rpavatar"]{border-radius:50% !important;box-shadow:0 0 0 3px ${C.pearl2},0 0 0 4px ${C.goldD} !important}
[data-wk="rpamount"]{color:#FFF0CC !important;background:none !important;text-shadow:0 0 12px rgba(255,230,170,.6) !important}
[data-wk="rpclose"]{background:rgba(255,255,255,.12) !important;border:1px solid ${C.gold} !important;color:#fff !important}

/* 照片＝从南瓜马车的车窗里看出去：拱顶窗、两边系起来的粉纱帘、顶上一截南瓜藤 */
[data-wk="photocard"]{position:relative !important;overflow:visible !important;background:linear-gradient(135deg,#fff,#FCEFF5 50%,#EEF1FF) !important;border:none !important;border-radius:50% 50% 10px 10px / 34% 34% 10px 10px !important;padding:30px 30px 30px !important;box-shadow:0 0 18px rgba(255,220,180,.45) !important;margin-top:14px !important}
[data-wk="photocard"]::before{content:"" !important;position:absolute !important;inset:0 !important;background:${svg(CARWIN)} center/100% 100% no-repeat !important;pointer-events:none !important;z-index:2 !important}
[data-wk="photocard"]::after{content:"" !important;position:absolute !important;left:50% !important;top:-12px !important;width:80px !important;height:26px !important;margin-left:-40px !important;background:${svg(VINE)} center/contain no-repeat !important;z-index:3 !important}
[data-wk="photoface"]{background:linear-gradient(170deg,${C.v2},${C.v3}) !important;border:none !important;border-radius:50% 50% 4px 4px / 40% 40% 4px 4px !important}
[data-wk="photoface"] *,[data-wk="phototext"]{color:#fff !important}
[data-wk="photocap"],[data-wk="photohint"]{color:#8C84B8 !important;font-style:italic !important;position:relative !important;z-index:3 !important}

/* 语音：前面一颗金色音符（舞会的音乐） */
[data-wk="voice"] > *{background:transparent !important;box-shadow:none !important;border:none !important;color:${C.ink} !important}
[data-wk="voice"][data-me]{padding:0 14px 0 36px !important;position:relative !important;border-radius:999px !important}
[data-wk="voice"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:16px !important;height:19px !important;margin-top:-10px !important;background:${svg(NOTE)} center/contain no-repeat !important;z-index:2 !important}
[data-wk="voice"][data-me="1"]{background:linear-gradient(180deg,rgba(170,160,240,.7),rgba(135,125,225,.6)) !important}
[data-wk="voice"][data-me="1"] *{color:#fff !important}
[data-wk="voicewave"] span{background:${C.goldD} !important}

/* 天气：紫夜的天 */
[data-wk="wxcardsky"]{background:linear-gradient(170deg,${C.v1},${C.v2} 60%,${C.v3}) !important}
[data-wk="wxcardsky"] *{color:#fff !important}
[data-wk="wxcardsky"] svg{stroke:${C.gold} !important}
[data-wk="wxcardsay"]{background:transparent !important;color:${C.ink} !important;border-top:1px solid rgba(217,180,106,.5) !important}
/* 位置：一只玻璃鞋当图钉 */
[data-wk="geopin"]{background:${svg(SLIPPER)} center/contain no-repeat !important;box-shadow:none !important;border:none !important;width:40px !important;height:26px !important;border-radius:0 !important;filter:drop-shadow(0 0 4px rgba(150,170,230,.9)) !important}
[data-wk="geopin"] *{opacity:0 !important}
[data-wk="geopinstem"]{background:${C.goldD} !important}
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 3px ${C.pearl2},0 0 0 4px ${C.goldD} !important}

/* 拍一拍、通话结束：一行近白小字，两头各一颗星 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:${svg(STAR)} left center/8px 11px no-repeat,${svg(STAR)} right center/8px 11px no-repeat !important;border:none !important;border-radius:0 !important;padding:2px 18px !important;color:#E6E2FA !important;box-shadow:none !important;letter-spacing:.12em !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.gold} !important}
[data-wk="note"][data-part="callsum"]{color:#E6E2FA !important}

/* 线下小结：一张珠光请柬，标题是紫色缎带 */
[data-part="offlog"]{position:relative !important;overflow:visible !important;padding-top:30px !important}
[data-wk="offlogtitle"]{display:inline-block !important;margin:0 0 6px !important;padding:3px 16px !important;background:linear-gradient(180deg,#8C7CE0,#5A55B0) !important;color:#fff !important;border:1px solid ${C.gold} !important;border-radius:999px !important;letter-spacing:.15em !important}
[data-wk="offlogtitle"] *{color:#fff !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:#5A4FB0 !important}
[data-wk="offlogtranscript"]{border-top:1px solid rgba(217,180,106,.5) !important;color:#6A6290 !important}

/* 加号面板：珍珠圆钮 */
[data-wk="chatpanel"] *{color:#fff !important}
[data-wk="chattoolicon"]{background:radial-gradient(circle at 38% 32%,#fff,${C.pearl2} 70%,#EAD9B0) !important;border:1.2px solid ${C.goldD} !important;border-radius:50% !important;box-shadow:0 0 10px rgba(255,236,190,.45) !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.ink} !important;color:${C.ink} !important}
[data-wk="chattoollabel"]{color:${C.lilac} !important}

/* 引用三处 */
[data-wk="quotedraft"]{background:rgba(70,64,150,.9) !important;border:none !important;border-top:1px solid rgba(242,217,160,.6) !important}
[data-wk="quotedraft"] *{color:#E6E2FA !important;border-color:rgba(242,217,160,.6) !important}
[data-wk="quoteicon"]{display:none !important}
[data-wk="quoteclear"]{color:${C.gold} !important}
[data-wk="quote"]{background:rgba(255,255,255,.14) !important;color:#E6E2FA !important;border:1px solid rgba(242,217,160,.5) !important;border-radius:10px !important;padding:3px 10px !important;opacity:1 !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid currentColor !important;padding-left:8px !important;opacity:.75 !important}
/* ───── 午夜舞会 · 第三批：状态卡＝舞会大厅的一面拱窗，窗外紫夜；好感是一面午夜钟 ───── */
[data-wk="statecard"]{position:relative !important;overflow:visible !important;background:${svg(STAR)} left 22px top 60px/9px 12px no-repeat,${svg(STAR)} right 26px top 120px/8px 11px no-repeat,radial-gradient(ellipse at 80% 20%,rgba(140,170,240,.35),transparent 55%),linear-gradient(180deg,${C.v1},${C.v2} 55%,${C.v3}) !important;border:1.4px solid rgba(242,217,160,.85) !important;border-radius:120px 120px 22px 22px / 70px 70px 22px 22px !important;box-shadow:0 0 0 5px rgba(255,255,255,.08),0 0 30px rgba(255,230,180,.3),0 20px 40px rgba(30,20,80,.5) !important;padding-top:26px !important}
[data-wk="statecard"]::before{content:"" !important;position:absolute !important;left:50% !important;top:-6px !important;width:12px !important;height:16px !important;margin-left:-6px !important;background:${svg(STAR)} center/contain no-repeat !important}
[data-wk="statehead"]{background:transparent !important;border-bottom:1px solid rgba(242,217,160,.4) !important}
[data-wk="statehead"] *{color:#fff !important}
[data-wk="statehead"] [data-wk="avatar"]::before{content:none !important}
[data-wk="statehead"] [data-wk="avatar"],[data-wk="statehead"] img{box-shadow:0 0 0 3px ${C.pearl2},0 0 0 4px ${C.goldD} !important;border-radius:50% !important}
[data-wk="statehead"] button{border:1px solid rgba(242,217,160,.7) !important;background:rgba(255,255,255,.1) !important;border-radius:50% !important}
[data-wk="statemood"]{display:inline-block !important;background:linear-gradient(135deg,#fff,#FCEFF5) !important;color:${C.ink} !important;border:1px solid ${C.gold} !important;border-radius:999px !important;padding:0 10px !important;margin-right:4px !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:rgba(255,255,255,.1) !important;border:1px solid rgba(242,217,160,.6) !important;border-radius:999px !important;padding:3px !important;margin:10px 16px !important}
[data-wk="statecard"] button[aria-pressed]{color:${C.lilac} !important;border:none !important;border-radius:999px !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:linear-gradient(135deg,#fff,#FCEFF5 50%,#EEF1FF) !important;color:${C.ink} !important}
[data-wk="stateseen"]{${CARD};margin:12px 16px !important}
[data-wk="stateseen"] *{color:${C.ink} !important}
[data-wk="statevoice"]{background:transparent !important;border:none !important;border-top:1px solid rgba(242,217,160,.4) !important;border-bottom:1px solid rgba(242,217,160,.4) !important;border-radius:0 !important;margin:14px 16px !important;box-shadow:none !important;font-style:italic !important}
[data-wk="statevoice"] *{color:#FFF0CC !important;text-shadow:0 0 8px rgba(255,230,170,.45) !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:rgba(90,85,176,.08) !important;border:1px solid rgba(90,85,176,.25) !important;border-radius:999px !important}
[data-wk="statewear"] > span{background:transparent !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:${C.lilac} !important}
[data-wk="statevoice"] + div > button{background:rgba(255,255,255,.12) !important;color:#fff !important;border:1px solid rgba(242,217,160,.7) !important;border-radius:999px !important}
/* 好感：一面午夜钟，左钟右字；指针按好感转，满分正好敲十二点 */
[data-wk="stateaff"]{background:transparent !important;border-top:1px solid rgba(242,217,160,.4) !important;display:flex !important;align-items:center !important;gap:16px !important;padding:14px 20px 16px !important}
[data-wk="stateaff"] *{color:#fff !important}
[data-wk="stateheart"]{position:relative !important;width:72px !important;height:72px !important;flex:none !important;background:${svg(LOVECLOCK)} center/contain no-repeat !important;filter:drop-shadow(0 0 10px rgba(255,230,180,.55)) !important}
[data-wk="stateheart"] > div{display:none !important}
[data-wk="stateheartknob"]{display:block !important;position:absolute !important;left:50% !important;bottom:50% !important;top:auto !important;width:7px !important;height:28px !important;margin-left:-3.5px !important;background:${svg(HAND)} center/contain no-repeat !important;transform-origin:50% 100% !important;transform:rotate(calc(var(--sc-heart-lvl) * 360deg)) !important}
[data-wk="stateheartnum"]{display:none !important}
[data-wk="stateaffval"]{display:inline-block !important;margin:0 0 6px !important;padding:2px 12px !important;background:linear-gradient(135deg,#fff,#FCEFF5) !important;border:1px solid ${C.gold} !important;border-radius:999px !important;color:${C.ink} !important;font:italic 700 14px/1.3 Georgia,serif !important}
/* 翻旧的：一张张珠光请柬 */
[data-wk="statehistbtn"]{background:rgba(255,255,255,.12) !important;color:#fff !important;border:1px solid rgba(242,217,160,.7) !important;border-radius:999px !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 16px !important}
[data-wk="statehisthead"] > :first-child{color:${C.lilac} !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{border:1px solid rgba(242,217,160,.7) !important;border-radius:999px !important;color:#fff !important;background:transparent !important}
[data-wk="statehistitem"]{position:relative !important;${CARD};padding:16px 18px 14px !important;margin:0 0 14px !important}
[data-wk="statehistitem"]::before{content:"" !important;position:absolute !important;right:12px !important;top:10px !important;width:9px !important;height:12px !important;background:${svg(STAR)} center/contain no-repeat !important;filter:drop-shadow(0 0 1px ${C.goldD}) !important}
[data-wk="statehistitem"] *{color:${C.ink} !important}
[data-wk="statehistmood"]{background:linear-gradient(180deg,#8C7CE0,#5A55B0) !important;border:none !important;color:#fff !important;border-radius:999px !important}
[data-wk="statehisttime"]{color:#8C84B8 !important;font-style:italic !important}
[data-wk="statehistmeta"]{background:rgba(90,85,176,.07) !important;border-radius:8px !important}
[data-wk="statehistend"]{color:${C.lilac} !important}
/* Ta 眼里 */
[data-wk="gazepage"]{background:radial-gradient(ellipse at 80% 20%,rgba(140,170,240,.35),transparent 55%),linear-gradient(180deg,${C.v1},${C.v2} 55%,${C.v3}) !important}
[data-wk="gazetitle"]{color:#fff !important;letter-spacing:.2em !important}
[data-wk="gazetab"]{background:rgba(255,255,255,.1) !important;color:${C.lilac} !important;border:1px solid rgba(242,217,160,.6) !important;border-radius:999px !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:linear-gradient(135deg,#fff,#FCEFF5 50%,#EEF1FF) !important;color:${C.ink} !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:${C.lilac} !important}
[data-wk="gazecard"]{${CARD}}
[data-wk="gazetape"]{background:${svg(SLIPPER)} center/26px 17px no-repeat !important;box-shadow:none !important;border:none !important;transform:none !important;width:30px !important;height:20px !important}
[data-wk="gazecardname"]{color:${C.ink} !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:#6A6290 !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{${CARD}}
[data-wk="gazeletter"] *,[data-wk="gazehistory"] *{color:${C.ink} !important}
[data-wk="gazeempty"]{background:rgba(255,255,255,.08) !important;border:1px dashed rgba(242,217,160,.6) !important;border-radius:16px !important;color:#fff !important}
[data-wk="gazeempty"] > div:first-child{color:#fff !important}
[data-wk="gazeempty"] button{background:linear-gradient(135deg,#fff,#FCEFF5) !important;color:${C.ink} !important;border:1px solid ${C.gold} !important;border-radius:999px !important}
`;

const pack = { kind: "chat-look", v: 1, name: "午夜舞会", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "午夜舞会-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
