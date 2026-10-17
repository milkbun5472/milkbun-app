// The actual scene owners supply both generated map data and on-demand builders.
export const PLACE_MODULES={
 dayLaboratory:{url:'./laboratory.mjs?v=fg-3dabc3b4ab63b8df',map:'laboratoryMap',create:'createLaboratory'},
 dayLibrary:{url:'./library.mjs?v=fg-3dabc3b4ab63b8df',map:'libraryMap',create:'createLibrary'},
 dayClinic:{url:'./clinic.mjs?v=fg-3dabc3b4ab63b8df',map:'clinicMap',create:'createClinic'},
 dayStudio:{url:'./studio.mjs?v=fg-3dabc3b4ab63b8df',map:'studioMap',create:'createStudio'},
 dayRehearsal:{url:'./rehearsal.mjs?v=fg-3dabc3b4ab63b8df',map:'rehearsalMap',create:'createRehearsal'},
 dayStation:{url:'./station.mjs?v=fg-3dabc3b4ab63b8df',map:'stationMap',create:'createStation'},
 dayGym:{url:'./gym.mjs?v=fg-3dabc3b4ab63b8df',map:'gymMap',create:'createGym'},
 dayMarket:{url:'./market.mjs?v=fg-3dabc3b4ab63b8df',map:'marketMap',create:'createMarket'},
 dayOffice:{url:'./office.mjs?v=fg-3dabc3b4ab63b8df',map:'officeMap',create:'createOffice'},
 dayCampus:{url:'./campus.mjs?v=fg-3dabc3b4ab63b8df',map:'campusMap',create:'createCampus'},
 dayInvestigation:{url:'./investigation.mjs?v=fg-3dabc3b4ab63b8df',map:'investigationMap',create:'createInvestigation'},
 dayService:{url:'./service.mjs?v=fg-3dabc3b4ab63b8df',map:'serviceMap',create:'createService'},
 dayFilm:{url:'./film.mjs?v=fg-3dabc3b4ab63b8df',map:'filmMap',create:'createFilm'},
 dayBroadcast:{url:'./broadcast.mjs?v=fg-3dabc3b4ab63b8df',map:'broadcastMap',create:'createBroadcast'},
 dayLegal:{url:'./legal.mjs?v=fg-3dabc3b4ab63b8df',map:'legalMap',create:'createLegal'},
 dayTraining:{url:'./training.mjs?v=fg-3dabc3b4ab63b8df',map:'trainingMap',create:'createTraining'},
 dayWorkshop:{url:'./workshop.mjs?v=fg-3dabc3b4ab63b8df',map:'workshopMap',create:'createWorkshop'},
 dayFarm:{url:'./farm.mjs?v=fg-3dabc3b4ab63b8df',map:'farmMap',create:'createFarm'},
 dayFleaMarket:{url:'./flea-market.mjs?v=fg-3dabc3b4ab63b8df',map:'fleaMarketMap',create:'createFleaMarket'},
 dayStudy:{url:'./study.mjs?v=fg-3dabc3b4ab63b8df',map:'studyMap',create:'createStudy'}
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
