import {OUTFITS} from './outfits.mjs?v=fg-7b18afc24fec577f';
export {OUTFITS};
export const DEFAULT_SKIN='#f2cbb4';
export const DEFAULT_LOOK={skin:DEFAULT_SKIN,hair:'korean',hairColor:'#6b4a33',cloth:'#d97a60'};
export const COMPANION_LOOK={skin:DEFAULT_SKIN,hair:'airbang',hairColor:'#5b4436',cloth:'#729786'};
// v2 娃娃（她 2026-09-25 选的 B：直接替换）只有四款发型、一套衣服；ID 沿用旧存档里的名字。
// 旧存档里其余的发型／衣服 ID 在这【一处】换成最接近的新款——存档本身不改，以后补回同名款式就自动认回去。
export const HAIR_ALIAS={wolf:'korean',mullet:'curtains',comma:'curtains',hush:'bob',wavy:'airbang',bun:'bob',ponytail:'airbang'};
export const hairId=h=>HAIR_ALIAS[h]||h;
// 发色花样（她 2026-09-25 要的渐变和拼色）：solid 单色 / gradient 上下渐变（发根主色→发尾副色）/
// split 左右拼色 / streak 挑染（一缕缕副色）。副色没选过时和主色同色，于是任何模式都等于单色、不会突然变样。
export const HAIR_MODES=[['solid','单色'],['gradient','渐变'],['split','拼色'],['streak','挑染']];
const HAIR_MODE_IDS=HAIR_MODES.map(m=>m[0]);
export const hairModeOf=look=>HAIR_MODE_IDS.includes(look?.hairMode)?look.hairMode:'solid';
// 庭院和列车的 getDyes 都问这一处（以前两边各写一份，只有发色一个字段时还看不出来）。
export function dyesOf(look={},defaults={}){const hairColor=look.hairColor||defaults.hairColor;return {skin:look.skin||defaults.skin,hairColor,hairColor2:look.hairColor2||hairColor,hairMode:hairModeOf(look)};}
// 旧衣柜的六套 ID 和四个色槽：模型里暂时没有它们，但存档里的选择和配色【照留】，
// 不然读档体检一过就把她调过的色静默丢了（world.restoreLook 只认这里认得的 ID）。
const LEGACY_OUTFITS=['traveler','academy','garden','alchemist','ranger','cardigan'],LEGACY_SLOTS=['cloth','trim','bottom','boots'];
export const KNOWN_OUTFITS=[...new Set([...Object.keys(OUTFITS),...LEGACY_OUTFITS])];
const slotsOf=id=>[...new Set([...Object.keys(OUTFITS[id]?.colors||{}),...(LEGACY_OUTFITS.includes(id)?LEGACY_SLOTS:[])])];
// 按性别配一份默认样貌：【头发和身形一起给】。
// 她 2026-09-19：「为啥男的进去是默认女体我是男体」——原来身形（六根形体参数）
// 根本没跟性别挂过钩，谁进来都是中性那一身，于是全靠发型替身形说话；
// 而两边的发型又是写死的：她自己固定短发、同行者固定长卷发，正好反了。
// ⚠️只有这一处答案：同行者按角色卡上的性别、她自己按用户人设里的性别，两边都问它。
//   dims 的上下限照 doll.json（＝clay_doll.py 里的 LIMITS），1 是中性。
export const GENDER_LOOKS={
 '他':{hair:'korean',dims:{height:1.10,shoulder:1.14,waist:1.08,flare:.88,build:.94,head:.94}},
 '她':{hair:'airbang',  dims:{height:1.00,shoulder:.92,waist:.92,flare:1.12,build:1.06,head:1.03}},
 'TA':{hair:'bob',  dims:{height:1,shoulder:1,waist:1,flare:1,build:1,head:1}}
};
export const lookForTa=ta=>GENDER_LOOKS[ta]||GENDER_LOOKS['TA'];
const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export function restoreWardrobe(raw){const out={};for(const id of KNOWN_OUTFITS){const row=raw?.[id];if(!row||typeof row!=='object')continue;const colors={};for(const key of slotsOf(id))if(color(row[key]))colors[key]=row[key];if(Object.keys(colors).length)out[id]=colors;}return out;}
export const outfitId=look=>Object.hasOwn(OUTFITS,look?.outfit)?look.outfit:Object.keys(OUTFITS)[0];
export function outfitColors(look={}){const id=outfitId(look);return {...OUTFITS[id].colors,...(id==='traveler'&&color(look.cloth)?{cloth:look.cloth}:{}),...restoreWardrobe(look.wardrobe)[id]};}
// One patch writer for the live avatar, preview and all residents; each outfit remembers its colors.
export function mergeLook(old={},patch={}){const next={...old,...patch};delete next.outfitColors;if(patch.dims)next.dims={...old.dims,...patch.dims};
 if(patch.wardrobe||patch.outfitColors){next.wardrobe=restoreWardrobe({...old.wardrobe,...patch.wardrobe});if(patch.outfitColors){const id=outfitId(next);next.wardrobe=restoreWardrobe({...next.wardrobe,[id]:{...next.wardrobe[id],...patch.outfitColors}});}}
 return next;
}
