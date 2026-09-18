import {OUTFITS} from './outfits.mjs?v=fg-c6478e32487f1624';
export {OUTFITS};
export const DEFAULT_SKIN='#f2cbb4';
export const DEFAULT_LOOK={skin:DEFAULT_SKIN,hair:'korean',hairColor:'#6b4a33',cloth:'#8d5f66'};
export const COMPANION_LOOK={skin:DEFAULT_SKIN,hair:'wavy',hairColor:'#5b4436',cloth:'#729786'};
const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export function restoreWardrobe(raw){const out={};for(const id of Object.keys(OUTFITS)){const row=raw?.[id];if(!row||typeof row!=='object')continue;const colors={};for(const key of Object.keys(OUTFITS[id].colors))if(color(row[key]))colors[key]=row[key];if(Object.keys(colors).length)out[id]=colors;}return out;}
export const outfitId=look=>Object.hasOwn(OUTFITS,look?.outfit)?look.outfit:'traveler';
export function outfitColors(look={}){const id=outfitId(look);return {...OUTFITS[id].colors,...(id==='traveler'&&color(look.cloth)?{cloth:look.cloth}:{}),...restoreWardrobe(look.wardrobe)[id]};}
// One patch writer for the live avatar, preview and all residents; each outfit remembers its colors.
export function mergeLook(old={},patch={}){const next={...old,...patch};delete next.outfitColors;if(patch.dims)next.dims={...old.dims,...patch.dims};
 if(patch.wardrobe||patch.outfitColors){next.wardrobe=restoreWardrobe({...old.wardrobe,...patch.wardrobe});if(patch.outfitColors){const id=outfitId(next);next.wardrobe=restoreWardrobe({...next.wardrobe,[id]:{...next.wardrobe[id],...patch.outfitColors}});}}
 return next;
}
