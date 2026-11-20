// Synchronous geometry inspection for build tools and rig checks, after explicit loading.
import {PLACE_MODULES,placeModules} from './modules.mjs?v=fg-00aa3cc25a2329ce';
import {applyProfessionalView} from '../professional-view.mjs?v=fg-00aa3cc25a2329ce';
export const DAY_FACTORIES=Object.fromEntries(await Promise.all(Object.entries(PLACE_MODULES).map(async([id,p])=>{
 const mod=await placeModules.load(id);
 return [id,options=>applyProfessionalView(mod[p.create](options),id,options)];
})));
