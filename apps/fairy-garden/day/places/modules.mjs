// The actual scene owners supply both generated map data and on-demand builders.
export const PLACE_MODULES={
 dayLaboratory:{url:'./laboratory.mjs?v=fg-179ddfb1ab0a89bb',map:'laboratoryMap',create:'createLaboratory'},
 dayLibrary:{url:'./library.mjs?v=fg-179ddfb1ab0a89bb',map:'libraryMap',create:'createLibrary'},
 dayClinic:{url:'./clinic.mjs?v=fg-179ddfb1ab0a89bb',map:'clinicMap',create:'createClinic'},
 dayStudio:{url:'./studio.mjs?v=fg-179ddfb1ab0a89bb',map:'studioMap',create:'createStudio'},
 dayRehearsal:{url:'./rehearsal.mjs?v=fg-179ddfb1ab0a89bb',map:'rehearsalMap',create:'createRehearsal'},
 dayStation:{url:'./station.mjs?v=fg-179ddfb1ab0a89bb',map:'stationMap',create:'createStation'},
 dayGym:{url:'./gym.mjs?v=fg-179ddfb1ab0a89bb',map:'gymMap',create:'createGym'},
 dayMarket:{url:'./market.mjs?v=fg-179ddfb1ab0a89bb',map:'marketMap',create:'createMarket'},
 dayOffice:{url:'./office.mjs?v=fg-179ddfb1ab0a89bb',map:'officeMap',create:'createOffice'},
 dayCampus:{url:'./campus.mjs?v=fg-179ddfb1ab0a89bb',map:'campusMap',create:'createCampus'},
 dayInvestigation:{url:'./investigation.mjs?v=fg-179ddfb1ab0a89bb',map:'investigationMap',create:'createInvestigation'},
 dayService:{url:'./service.mjs?v=fg-179ddfb1ab0a89bb',map:'serviceMap',create:'createService'},
 dayFilm:{url:'./film.mjs?v=fg-179ddfb1ab0a89bb',map:'filmMap',create:'createFilm'},
 dayBroadcast:{url:'./broadcast.mjs?v=fg-179ddfb1ab0a89bb',map:'broadcastMap',create:'createBroadcast'},
 dayLegal:{url:'./legal.mjs?v=fg-179ddfb1ab0a89bb',map:'legalMap',create:'createLegal'},
 dayTraining:{url:'./training.mjs?v=fg-179ddfb1ab0a89bb',map:'trainingMap',create:'createTraining'},
 dayWorkshop:{url:'./workshop.mjs?v=fg-179ddfb1ab0a89bb',map:'workshopMap',create:'createWorkshop'},
 dayFarm:{url:'./farm.mjs?v=fg-179ddfb1ab0a89bb',map:'farmMap',create:'createFarm'},
 dayFleaMarket:{url:'./flea-market.mjs?v=fg-179ddfb1ab0a89bb',map:'fleaMarketMap',create:'createFleaMarket'},
 dayStudy:{url:'./study.mjs?v=fg-179ddfb1ab0a89bb',map:'studyMap',create:'createStudy'}
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
