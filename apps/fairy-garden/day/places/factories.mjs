// Synchronous geometry inspection for build tools and rig checks, after explicit loading.
import {PLACE_MODULES,placeModules} from './modules.mjs?v=fg-2f4de0c05cc03cb1';
import {applyProfessionalView} from '../professional-view.mjs?v=fg-2f4de0c05cc03cb1';
export const DAY_FACTORIES=Object.fromEntries(await Promise.all(Object.entries(PLACE_MODULES).map(async([id,p])=>{
 const mod=await placeModules.load(id);
 return [id,options=>applyProfessionalView(mod[p.create](options),id,options)];
})));
