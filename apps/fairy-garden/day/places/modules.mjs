// The actual scene owners supply both generated map data and on-demand builders.
export const PLACE_MODULES={
 dayLaboratory:{url:'./laboratory.mjs?v=fg-dbb1a66fa5e524fe',map:'laboratoryMap',create:'createLaboratory'},
 dayLibrary:{url:'./library.mjs?v=fg-dbb1a66fa5e524fe',map:'libraryMap',create:'createLibrary'},
 dayClinic:{url:'./clinic.mjs?v=fg-dbb1a66fa5e524fe',map:'clinicMap',create:'createClinic'},
 dayStudio:{url:'./studio.mjs?v=fg-dbb1a66fa5e524fe',map:'studioMap',create:'createStudio'},
 dayRehearsal:{url:'./rehearsal.mjs?v=fg-dbb1a66fa5e524fe',map:'rehearsalMap',create:'createRehearsal'},
 dayStation:{url:'./station.mjs?v=fg-dbb1a66fa5e524fe',map:'stationMap',create:'createStation'},
 dayGym:{url:'./gym.mjs?v=fg-dbb1a66fa5e524fe',map:'gymMap',create:'createGym'},
 dayMarket:{url:'./market.mjs?v=fg-dbb1a66fa5e524fe',map:'marketMap',create:'createMarket'},
 dayOffice:{url:'./office.mjs?v=fg-dbb1a66fa5e524fe',map:'officeMap',create:'createOffice'},
 dayCampus:{url:'./campus.mjs?v=fg-dbb1a66fa5e524fe',map:'campusMap',create:'createCampus'},
 dayInvestigation:{url:'./investigation.mjs?v=fg-dbb1a66fa5e524fe',map:'investigationMap',create:'createInvestigation'},
 dayService:{url:'./service.mjs?v=fg-dbb1a66fa5e524fe',map:'serviceMap',create:'createService'},
 dayFilm:{url:'./film.mjs?v=fg-dbb1a66fa5e524fe',map:'filmMap',create:'createFilm'},
 dayBroadcast:{url:'./broadcast.mjs?v=fg-dbb1a66fa5e524fe',map:'broadcastMap',create:'createBroadcast'},
 dayLegal:{url:'./legal.mjs?v=fg-dbb1a66fa5e524fe',map:'legalMap',create:'createLegal'},
 dayTraining:{url:'./training.mjs?v=fg-dbb1a66fa5e524fe',map:'trainingMap',create:'createTraining'},
 dayWorkshop:{url:'./workshop.mjs?v=fg-dbb1a66fa5e524fe',map:'workshopMap',create:'createWorkshop'},
 dayFarm:{url:'./farm.mjs?v=fg-dbb1a66fa5e524fe',map:'farmMap',create:'createFarm'},
 dayFleaMarket:{url:'./flea-market.mjs?v=fg-dbb1a66fa5e524fe',map:'fleaMarketMap',create:'createFleaMarket'},
 dayStudy:{url:'./study.mjs?v=fg-dbb1a66fa5e524fe',map:'studyMap',create:'createStudy'}
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
