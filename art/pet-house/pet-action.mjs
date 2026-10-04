// One pose vocabulary for home care, street idling, friends and skin inspection.
// Root travel and completion stay with their existing gameplay controllers.
export const PET_ACTIONS=[
 ['stand','自然站立'],['walk','慢走'],['trot','小跑'],['turn','转身'],
 ['sleep','趴着睡'],['wake','醒来起身'],['eat','吃饭'],['drink','喝水'],
 ['treat','吃零食'],['pet','被摸摸'],['sniff','低头闻闻'],['look','四处看看'],
 ['sit','坐下等候'],['waitFood','等添粮'],['askSnack','讨零食'],['play','追玩具'],
 ['pickup','低头叼起'],['carry','叼着走'],['drop','放下玩具'],['inspectBag','看下班袋子']
].map(([id,label])=>({id,label}));
export function samplePetAction(kind,time=0,{species='cat',manner={},lookBowl=true}={}){
 const dog=species==='dog',s=Math.sin,tempo=manner.tempo||1;
 switch(kind){
 case 'sleep':return {lie:1,headPitch:dog?.28:.27,headYaw:dog?.035:-.07,headRoll:.035,tailCurl:1,earPitch:.12};
 case 'eat':return {crouch:.30,headPitch:.73+.025*s(time*5),headYaw:.035*s(time*1.4),chestPitch:.06,tailQuiet:.8};
 case 'drink':return {crouch:.25,headPitch:.76+.018*s(time*7),headYaw:.02*s(time),chestPitch:.05,tailQuiet:.8};
 case 'treat':return {sit:.6,headPitch:.12+.035*s(time*5),headYaw:.025*s(time*1.7),earPitch:-.045};
 case 'pet':case 'invitePet':{const rub=kind==='pet'||time<4,a=(manner.gentle?.045:.07)*s(time*2.2*tempo);return {sit:rub?.25:.6,roll:rub?a:.018,headRoll:rub?a*1.4:.07,headYaw:.08*s(time*1.3*tempo),headPitch:-.10,chestPitch:-.035,earPitch:rub?.10:.03};}
 case 'sniff':return {crouch:.30,headPitch:.68+.055*s(time*2.3),headYaw:.14*s(time*.9),chestPitch:.07,tailQuiet:.45};
 case 'look':return {headPitch:-.08,headYaw:.25*s(time*.65),headRoll:.025*s(time*.9),earPitch:-.055};
 case 'sit':return {sit:1,headPitch:-.06,headYaw:.045*s(time),earPitch:-.035};
 case 'waitFood':return {sit:.75,headPitch:lookBowl?.36:-.16,headYaw:.035*s(time),earPitch:-.05};
 case 'askSnack':return {sit:.85,headPitch:-.18,headRoll:.05*s(time*.9),headYaw:.09*s(time*.8),earPitch:-.07};
 case 'play':return {crouch:dog?.38:.48,chestPitch:.08,headPitch:.06,headYaw:.05*s(time*2),tailCurl:dog?0:.15};
 case 'pickup':case 'drop':return {crouch:.56,chestPitch:.10,headPitch:.96,tailQuiet:.65};
 case 'carry':return {headPitch:.04,earPitch:-.025,tailQuiet:.20};
 case 'inspectBag':return {crouch:.32,headPitch:.53+.045*s(time*2.5),headYaw:.13*s(time*1.1),headRoll:.04*s(time*.7),chestPitch:.06,tailQuiet:.4};
 default:return {};
 }
}
export function idlePetPose(kind,time,species){return samplePetAction(kind==='sniff'?'sniff':'look',time,{species});}
// Coordinates are authored rig units, before the saved size/fatness transform.
// Four paws fold toward the body while the belly lowers. No model tipping.
export function postureFrame(rig,action,time=0,amount=0){
 const quiet=Math.max(0,1-amount),lie=action.lie*quiet,sit=action.sit*quiet,crouch=action.crouch*quiet,dog=rig.species==='dog';
 const breathe=.0018*Math.sin(time*(lie> .1?1.7:2.1))*quiet;
 return {lie,sit,
  chestY:breathe-(dog?.109:.110)*lie-.044*crouch+.006*sit,
  pelvisY:breathe*.65-(dog?.120:.120)*lie-.024*crouch-(dog?.141:.126)*sit,
  chestScale:1-.32*lie,pelvisScale:1-.28*lie,
  chestPitch:.07*lie-.22*sit+action.chestPitch*quiet,
  pelvisPitch:.07*lie+.16*sit,
  paw(leg){const front=leg.name.startsWith('front'),sign=leg.name.endsWith('L')?-1:1;
   return {x:sign*((front?.018:.035)*lie+(front?0:.026)*sit),
    z:front?(dog?.065:.07)*lie+.025*crouch:.14*lie+.16*sit,
    yaw:front?0:sign*(-.24*lie-.30*sit)};
  }
 };
}
