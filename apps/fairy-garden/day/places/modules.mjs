// The actual scene owners supply both generated map data and on-demand builders.
export const PLACE_MODULES={
 dayLaboratory:{url:'./laboratory.mjs?v=fg-eaf386cec406e2ee',map:'laboratoryMap',create:'createLaboratory'},
 dayLibrary:{url:'./library.mjs?v=fg-eaf386cec406e2ee',map:'libraryMap',create:'createLibrary'},
 dayClinic:{url:'./clinic.mjs?v=fg-eaf386cec406e2ee',map:'clinicMap',create:'createClinic'},
 dayStudio:{url:'./studio.mjs?v=fg-eaf386cec406e2ee',map:'studioMap',create:'createStudio'},
 dayRehearsal:{url:'./rehearsal.mjs?v=fg-eaf386cec406e2ee',map:'rehearsalMap',create:'createRehearsal'},
 dayStation:{url:'./station.mjs?v=fg-eaf386cec406e2ee',map:'stationMap',create:'createStation'},
 dayGym:{url:'./gym.mjs?v=fg-eaf386cec406e2ee',map:'gymMap',create:'createGym'},
 dayMarket:{url:'./market.mjs?v=fg-eaf386cec406e2ee',map:'marketMap',create:'createMarket'},
 dayOffice:{url:'./office.mjs?v=fg-eaf386cec406e2ee',map:'officeMap',create:'createOffice'},
 dayCampus:{url:'./campus.mjs?v=fg-eaf386cec406e2ee',map:'campusMap',create:'createCampus'},
 dayInvestigation:{url:'./investigation.mjs?v=fg-eaf386cec406e2ee',map:'investigationMap',create:'createInvestigation'},
 dayService:{url:'./service.mjs?v=fg-eaf386cec406e2ee',map:'serviceMap',create:'createService'},
 dayFilm:{url:'./film.mjs?v=fg-eaf386cec406e2ee',map:'filmMap',create:'createFilm'},
 dayBroadcast:{url:'./broadcast.mjs?v=fg-eaf386cec406e2ee',map:'broadcastMap',create:'createBroadcast'},
 dayLegal:{url:'./legal.mjs?v=fg-eaf386cec406e2ee',map:'legalMap',create:'createLegal'},
 dayTraining:{url:'./training.mjs?v=fg-eaf386cec406e2ee',map:'trainingMap',create:'createTraining'},
 dayWorkshop:{url:'./workshop.mjs?v=fg-eaf386cec406e2ee',map:'workshopMap',create:'createWorkshop'},
 dayFarm:{url:'./farm.mjs?v=fg-eaf386cec406e2ee',map:'farmMap',create:'createFarm'},
 dayFleaMarket:{url:'./flea-market.mjs?v=fg-eaf386cec406e2ee',map:'fleaMarketMap',create:'createFleaMarket'},
 dayStudy:{url:'./study.mjs?v=fg-eaf386cec406e2ee',map:'studyMap',create:'createStudy'}
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
