// The actual scene owners supply both generated map data and on-demand builders.
export const PLACE_MODULES={
 dayLaboratory:{url:'./laboratory.mjs?v=fg-3f575044413bc14d',map:'laboratoryMap',create:'createLaboratory'},
 dayLibrary:{url:'./library.mjs?v=fg-3f575044413bc14d',map:'libraryMap',create:'createLibrary'},
 dayClinic:{url:'./clinic.mjs?v=fg-3f575044413bc14d',map:'clinicMap',create:'createClinic'},
 dayStudio:{url:'./studio.mjs?v=fg-3f575044413bc14d',map:'studioMap',create:'createStudio'},
 dayRehearsal:{url:'./rehearsal.mjs?v=fg-3f575044413bc14d',map:'rehearsalMap',create:'createRehearsal'},
 dayStation:{url:'./station.mjs?v=fg-3f575044413bc14d',map:'stationMap',create:'createStation'},
 dayGym:{url:'./gym.mjs?v=fg-3f575044413bc14d',map:'gymMap',create:'createGym'},
 dayMarket:{url:'./market.mjs?v=fg-3f575044413bc14d',map:'marketMap',create:'createMarket'},
 dayOffice:{url:'./office.mjs?v=fg-3f575044413bc14d',map:'officeMap',create:'createOffice'},
 dayCampus:{url:'./campus.mjs?v=fg-3f575044413bc14d',map:'campusMap',create:'createCampus'},
 dayInvestigation:{url:'./investigation.mjs?v=fg-3f575044413bc14d',map:'investigationMap',create:'createInvestigation'},
 dayService:{url:'./service.mjs?v=fg-3f575044413bc14d',map:'serviceMap',create:'createService'},
 dayFilm:{url:'./film.mjs?v=fg-3f575044413bc14d',map:'filmMap',create:'createFilm'},
 dayBroadcast:{url:'./broadcast.mjs?v=fg-3f575044413bc14d',map:'broadcastMap',create:'createBroadcast'},
 dayLegal:{url:'./legal.mjs?v=fg-3f575044413bc14d',map:'legalMap',create:'createLegal'},
 dayTraining:{url:'./training.mjs?v=fg-3f575044413bc14d',map:'trainingMap',create:'createTraining'},
 dayWorkshop:{url:'./workshop.mjs?v=fg-3f575044413bc14d',map:'workshopMap',create:'createWorkshop'},
 dayFarm:{url:'./farm.mjs?v=fg-3f575044413bc14d',map:'farmMap',create:'createFarm'},
 dayFleaMarket:{url:'./flea-market.mjs?v=fg-3f575044413bc14d',map:'fleaMarketMap',create:'createFleaMarket'},
 dayStudy:{url:'./study.mjs?v=fg-3f575044413bc14d',map:'studyMap',create:'createStudy'}
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
