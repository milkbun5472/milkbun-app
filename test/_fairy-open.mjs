import {freshState,OPENINGS} from '../apps/fairy-garden/world.mjs';
// 「会开的路」那三处封着的时候【本来就走不过去】——那是玩法，不是坏了。
// 于是「每一处地方都走得到」这类断言必须带一份【路已经开了】的存档，
// 否则它要么是红的，要么被改成绕开那几处（那就等于不再钉住它们）。
// ⚠️只此一份：companion / places / village / new-scenes 四处都来拿
//   （施工规则/one-public-mechanism.md）。
export const withOpenPaths=(s=freshState())=>({...s,
 casts:Object.keys(OPENINGS).map(place=>({place,spell:OPENINGS[place].spell,text:'留下的一句',day:1}))});
