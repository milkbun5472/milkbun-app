// The actual scene owners supply both generated map data and on-demand builders.
export const PLACE_MODULES={
 dayLaboratory:{url:'./laboratory.mjs?v=fg-bcd60aa56897bb1f',map:'laboratoryMap',create:'createLaboratory'},
 dayLibrary:{url:'./library.mjs?v=fg-bcd60aa56897bb1f',map:'libraryMap',create:'createLibrary'},
 dayClinic:{url:'./clinic.mjs?v=fg-bcd60aa56897bb1f',map:'clinicMap',create:'createClinic'},
 dayStudio:{url:'./studio.mjs?v=fg-bcd60aa56897bb1f',map:'studioMap',create:'createStudio'},
 dayRehearsal:{url:'./rehearsal.mjs?v=fg-bcd60aa56897bb1f',map:'rehearsalMap',create:'createRehearsal'},
 dayStation:{url:'./station.mjs?v=fg-bcd60aa56897bb1f',map:'stationMap',create:'createStation'},
 dayGym:{url:'./gym.mjs?v=fg-bcd60aa56897bb1f',map:'gymMap',create:'createGym'},
 dayMarket:{url:'./market.mjs?v=fg-bcd60aa56897bb1f',map:'marketMap',create:'createMarket'},
 dayOffice:{url:'./office.mjs?v=fg-bcd60aa56897bb1f',map:'officeMap',create:'createOffice'},
 dayCampus:{url:'./campus.mjs?v=fg-bcd60aa56897bb1f',map:'campusMap',create:'createCampus'},
 dayInvestigation:{url:'./investigation.mjs?v=fg-bcd60aa56897bb1f',map:'investigationMap',create:'createInvestigation'},
 dayService:{url:'./service.mjs?v=fg-bcd60aa56897bb1f',map:'serviceMap',create:'createService'},
 dayFilm:{url:'./film.mjs?v=fg-bcd60aa56897bb1f',map:'filmMap',create:'createFilm'},
 dayBroadcast:{url:'./broadcast.mjs?v=fg-bcd60aa56897bb1f',map:'broadcastMap',create:'createBroadcast'},
 dayLegal:{url:'./legal.mjs?v=fg-bcd60aa56897bb1f',map:'legalMap',create:'createLegal'},
 dayTraining:{url:'./training.mjs?v=fg-bcd60aa56897bb1f',map:'trainingMap',create:'createTraining'},
 dayWorkshop:{url:'./workshop.mjs?v=fg-bcd60aa56897bb1f',map:'workshopMap',create:'createWorkshop'},
 dayFarm:{url:'./farm.mjs?v=fg-bcd60aa56897bb1f',map:'farmMap',create:'createFarm'},
 dayFleaMarket:{url:'./flea-market.mjs?v=fg-bcd60aa56897bb1f',map:'fleaMarketMap',create:'createFleaMarket'},
 dayStudy:{url:'./study.mjs?v=fg-bcd60aa56897bb1f',map:'studyMap',create:'createStudy'}
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
