import {OUTFITS} from './outfits.mjs?v=fg-b3e494053e96d28a';
export {OUTFITS};
export const DEFAULT_SKIN='#f2cbb4';
export const DEFAULT_LOOK={skin:DEFAULT_SKIN,hair:'korean',hairColor:'#6b4a33',cloth:'#d97a60'};
export const COMPANION_LOOK={skin:DEFAULT_SKIN,hair:'wavy',hairColor:'#5b4436',cloth:'#729786'};
// 按性别配一份默认样貌：【头发和身形一起给】。
// 她 2026-09-19：「为啥男的进去是默认女体我是男体」——原来身形（六根形体参数）
// 根本没跟性别挂过钩，谁进来都是中性那一身，于是全靠发型替身形说话；
// 而两边的发型又是写死的：她自己固定短发、同行者固定长卷发，正好反了。
// ⚠️只有这一处答案：同行者按角色卡上的性别、她自己按用户人设里的性别，两边都问它。
//   dims 的上下限照 doll.json（＝clay_doll.py 里的 LIMITS），1 是中性。
export const GENDER_LOOKS={
 '他':{hair:'korean',dims:{height:1.10,shoulder:1.14,waist:1.08,flare:.88,build:.94,head:.94}},
 '她':{hair:'wavy',  dims:{height:1.00,shoulder:.92,waist:.92,flare:1.12,build:1.06,head:1.03}},
 'TA':{hair:'hush',  dims:{height:1,shoulder:1,waist:1,flare:1,build:1,head:1}}
};
export const lookForTa=ta=>GENDER_LOOKS[ta]||GENDER_LOOKS['TA'];
const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export function restoreWardrobe(raw){const out={};for(const id of Object.keys(OUTFITS)){const row=raw?.[id];if(!row||typeof row!=='object')continue;const colors={};for(const key of Object.keys(OUTFITS[id].colors))if(color(row[key]))colors[key]=row[key];if(Object.keys(colors).length)out[id]=colors;}return out;}
export const outfitId=look=>Object.hasOwn(OUTFITS,look?.outfit)?look.outfit:'traveler';
export function outfitColors(look={}){const id=outfitId(look);return {...OUTFITS[id].colors,...(id==='traveler'&&color(look.cloth)?{cloth:look.cloth}:{}),...restoreWardrobe(look.wardrobe)[id]};}
// One patch writer for the live avatar, preview and all residents; each outfit remembers its colors.
export function mergeLook(old={},patch={}){const next={...old,...patch};delete next.outfitColors;if(patch.dims)next.dims={...old.dims,...patch.dims};
 if(patch.wardrobe||patch.outfitColors){next.wardrobe=restoreWardrobe({...old.wardrobe,...patch.wardrobe});if(patch.outfitColors){const id=outfitId(next);next.wardrobe=restoreWardrobe({...next.wardrobe,[id]:{...next.wardrobe[id],...patch.outfitColors}});}}
 return next;
}
