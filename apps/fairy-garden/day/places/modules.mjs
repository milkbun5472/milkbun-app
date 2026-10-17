// The actual scene owners supply both generated map data and on-demand builders.
export const PLACE_MODULES={
 dayLaboratory:{url:'./laboratory.mjs?v=fg-2f4de0c05cc03cb1',map:'laboratoryMap',create:'createLaboratory'},
 dayLibrary:{url:'./library.mjs?v=fg-2f4de0c05cc03cb1',map:'libraryMap',create:'createLibrary'},
 dayClinic:{url:'./clinic.mjs?v=fg-2f4de0c05cc03cb1',map:'clinicMap',create:'createClinic'},
 dayStudio:{url:'./studio.mjs?v=fg-2f4de0c05cc03cb1',map:'studioMap',create:'createStudio'},
 dayRehearsal:{url:'./rehearsal.mjs?v=fg-2f4de0c05cc03cb1',map:'rehearsalMap',create:'createRehearsal'},
 dayStation:{url:'./station.mjs?v=fg-2f4de0c05cc03cb1',map:'stationMap',create:'createStation'},
 dayGym:{url:'./gym.mjs?v=fg-2f4de0c05cc03cb1',map:'gymMap',create:'createGym'},
 dayMarket:{url:'./market.mjs?v=fg-2f4de0c05cc03cb1',map:'marketMap',create:'createMarket'},
 dayOffice:{url:'./office.mjs?v=fg-2f4de0c05cc03cb1',map:'officeMap',create:'createOffice'},
 dayCampus:{url:'./campus.mjs?v=fg-2f4de0c05cc03cb1',map:'campusMap',create:'createCampus'},
 dayInvestigation:{url:'./investigation.mjs?v=fg-2f4de0c05cc03cb1',map:'investigationMap',create:'createInvestigation'},
 dayService:{url:'./service.mjs?v=fg-2f4de0c05cc03cb1',map:'serviceMap',create:'createService'},
 dayFilm:{url:'./film.mjs?v=fg-2f4de0c05cc03cb1',map:'filmMap',create:'createFilm'},
 dayBroadcast:{url:'./broadcast.mjs?v=fg-2f4de0c05cc03cb1',map:'broadcastMap',create:'createBroadcast'},
 dayLegal:{url:'./legal.mjs?v=fg-2f4de0c05cc03cb1',map:'legalMap',create:'createLegal'},
 dayTraining:{url:'./training.mjs?v=fg-2f4de0c05cc03cb1',map:'trainingMap',create:'createTraining'},
 dayWorkshop:{url:'./workshop.mjs?v=fg-2f4de0c05cc03cb1',map:'workshopMap',create:'createWorkshop'},
 dayFarm:{url:'./farm.mjs?v=fg-2f4de0c05cc03cb1',map:'farmMap',create:'createFarm'},
 dayFleaMarket:{url:'./flea-market.mjs?v=fg-2f4de0c05cc03cb1',map:'fleaMarketMap',create:'createFleaMarket'},
 dayStudy:{url:'./study.mjs?v=fg-2f4de0c05cc03cb1',map:'studyMap',create:'createStudy'}
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
