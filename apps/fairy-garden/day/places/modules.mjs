// The actual scene owners supply both generated map data and on-demand builders.
export const PLACE_MODULES={
 dayLaboratory:{url:'./laboratory.mjs?v=fg-d339e63510e3c2ab',map:'laboratoryMap',create:'createLaboratory'},
 dayLibrary:{url:'./library.mjs?v=fg-d339e63510e3c2ab',map:'libraryMap',create:'createLibrary'},
 dayClinic:{url:'./clinic.mjs?v=fg-d339e63510e3c2ab',map:'clinicMap',create:'createClinic'},
 dayStudio:{url:'./studio.mjs?v=fg-d339e63510e3c2ab',map:'studioMap',create:'createStudio'},
 dayRehearsal:{url:'./rehearsal.mjs?v=fg-d339e63510e3c2ab',map:'rehearsalMap',create:'createRehearsal'},
 dayStation:{url:'./station.mjs?v=fg-d339e63510e3c2ab',map:'stationMap',create:'createStation'},
 dayGym:{url:'./gym.mjs?v=fg-d339e63510e3c2ab',map:'gymMap',create:'createGym'},
 dayMarket:{url:'./market.mjs?v=fg-d339e63510e3c2ab',map:'marketMap',create:'createMarket'},
 dayOffice:{url:'./office.mjs?v=fg-d339e63510e3c2ab',map:'officeMap',create:'createOffice'},
 dayCampus:{url:'./campus.mjs?v=fg-d339e63510e3c2ab',map:'campusMap',create:'createCampus'},
 dayInvestigation:{url:'./investigation.mjs?v=fg-d339e63510e3c2ab',map:'investigationMap',create:'createInvestigation'},
 dayService:{url:'./service.mjs?v=fg-d339e63510e3c2ab',map:'serviceMap',create:'createService'},
 dayFilm:{url:'./film.mjs?v=fg-d339e63510e3c2ab',map:'filmMap',create:'createFilm'},
 dayBroadcast:{url:'./broadcast.mjs?v=fg-d339e63510e3c2ab',map:'broadcastMap',create:'createBroadcast'},
 dayLegal:{url:'./legal.mjs?v=fg-d339e63510e3c2ab',map:'legalMap',create:'createLegal'},
 dayTraining:{url:'./training.mjs?v=fg-d339e63510e3c2ab',map:'trainingMap',create:'createTraining'},
 dayWorkshop:{url:'./workshop.mjs?v=fg-d339e63510e3c2ab',map:'workshopMap',create:'createWorkshop'},
 dayFarm:{url:'./farm.mjs?v=fg-d339e63510e3c2ab',map:'farmMap',create:'createFarm'},
 dayFleaMarket:{url:'./flea-market.mjs?v=fg-d339e63510e3c2ab',map:'fleaMarketMap',create:'createFleaMarket'},
 dayStudy:{url:'./study.mjs?v=fg-d339e63510e3c2ab',map:'studyMap',create:'createStudy'}
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
