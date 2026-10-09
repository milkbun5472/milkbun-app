import {restorePetState,snapshotPetState} from './state.mjs?v=fg-d1e14d4d1c374656';

// Landing moves the user's view to the station; every resident keeps its real
// location, ongoing work, belongings and care history in the existing world.
export function arrivePetStation(raw,world,station){
 const state=restorePetState(raw,world),point={...station.target};
 state.observation={...(state.observation||{}),mode:'fixed',resume:'pet',petId:state.activePetId,place:'outside',street:{pan:point,zoom:.9,overview:false},rooms:state.observation?.rooms||{}};
 return snapshotPetState(state,{position:point,room:null,outdoor:null,evening:state.evening});
}
