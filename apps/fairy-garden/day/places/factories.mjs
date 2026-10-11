// Synchronous geometry inspection for build tools and rig checks, after explicit loading.
import {PLACE_MODULES,placeModules} from './modules.mjs?v=fg-d0b6ca37235d9a48';
import {applyProfessionalView} from '../professional-view.mjs?v=fg-d0b6ca37235d9a48';
export const DAY_FACTORIES=Object.fromEntries(await Promise.all(Object.entries(PLACE_MODULES).map(async([id,p])=>{
 const mod=await placeModules.load(id);
 return [id,options=>applyProfessionalView(mod[p.create](options),id,options)];
})));
