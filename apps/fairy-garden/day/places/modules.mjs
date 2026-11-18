// The actual scene owners supply both generated map data and on-demand builders.
export const PLACE_MODULES={
 dayLaboratory:{url:'./laboratory.mjs?v=fg-cb06542ccebc5e4d',map:'laboratoryMap',create:'createLaboratory'},
 dayLibrary:{url:'./library.mjs?v=fg-cb06542ccebc5e4d',map:'libraryMap',create:'createLibrary'},
 dayClinic:{url:'./clinic.mjs?v=fg-cb06542ccebc5e4d',map:'clinicMap',create:'createClinic'},
 dayStudio:{url:'./studio.mjs?v=fg-cb06542ccebc5e4d',map:'studioMap',create:'createStudio'},
 dayRehearsal:{url:'./rehearsal.mjs?v=fg-cb06542ccebc5e4d',map:'rehearsalMap',create:'createRehearsal'},
 dayStation:{url:'./station.mjs?v=fg-cb06542ccebc5e4d',map:'stationMap',create:'createStation'},
 dayGym:{url:'./gym.mjs?v=fg-cb06542ccebc5e4d',map:'gymMap',create:'createGym'},
 dayMarket:{url:'./market.mjs?v=fg-cb06542ccebc5e4d',map:'marketMap',create:'createMarket'},
 dayOffice:{url:'./office.mjs?v=fg-cb06542ccebc5e4d',map:'officeMap',create:'createOffice'},
 dayCampus:{url:'./campus.mjs?v=fg-cb06542ccebc5e4d',map:'campusMap',create:'createCampus'},
 dayInvestigation:{url:'./investigation.mjs?v=fg-cb06542ccebc5e4d',map:'investigationMap',create:'createInvestigation'},
 dayService:{url:'./service.mjs?v=fg-cb06542ccebc5e4d',map:'serviceMap',create:'createService'},
 dayFilm:{url:'./film.mjs?v=fg-cb06542ccebc5e4d',map:'filmMap',create:'createFilm'},
 dayBroadcast:{url:'./broadcast.mjs?v=fg-cb06542ccebc5e4d',map:'broadcastMap',create:'createBroadcast'},
 dayLegal:{url:'./legal.mjs?v=fg-cb06542ccebc5e4d',map:'legalMap',create:'createLegal'},
 dayTraining:{url:'./training.mjs?v=fg-cb06542ccebc5e4d',map:'trainingMap',create:'createTraining'},
 dayWorkshop:{url:'./workshop.mjs?v=fg-cb06542ccebc5e4d',map:'workshopMap',create:'createWorkshop'},
 dayFarm:{url:'./farm.mjs?v=fg-cb06542ccebc5e4d',map:'farmMap',create:'createFarm'},
 dayFleaMarket:{url:'./flea-market.mjs?v=fg-cb06542ccebc5e4d',map:'fleaMarketMap',create:'createFleaMarket'},
 dayStudy:{url:'./study.mjs?v=fg-cb06542ccebc5e4d',map:'studyMap',create:'createStudy'}
};

export function createPlaceModules(importer=url=>import(url)){
 const pending=new Map();
 function load(id){
  if(!PLACE_MODULES[id])return Promise.reject(Error('未知的日程场景：'+id));
  if(!pending.has(id)){
   const promise=Promise.resolve().then(()=>importer(PLACE_MODULES[id].url));pending.set(id,promise);
   promise.catch(()=>{if(pending.get(id)===promise)pending.delete(id);});
  }
  return pending.get(id);
 }
 return {load};
}
export const placeModules=createPlaceModules();
