import {weatherLook} from '../fairy-garden/weather-look.mjs?v=fg-6a186babf51cdda8';
import {SEASONS,seasonOf} from '../fairy-garden/world.mjs?v=fg-6a186babf51cdda8';
const clamp=x=>Math.max(0,Math.min(1,x));
// The town alone supplies real calendar dates. Visual weather stays seeded by its archive.
export function townEnvironment(time,epoch){
 const minute=time.minute,season=SEASONS[time.season]||seasonOf(time.day),day=time.calendarDay||time.day,dusk=season.dusk;
 const light=Math.min(clamp((minute-330)/90),clamp((dusk+90-minute)/90));
 const sunset=clamp(1-Math.abs(minute-dusk)/70),dawn=clamp(1-Math.abs(minute-375)/60);
 const look=weatherLook({day,seasonIndex:time.season,minute:minute<420?1440:minute,epoch});
 return {...look,day,date:time.date,minute,epoch,seasonName:season.name,light,warmth:Math.max(sunset,dawn)*light,
  phase:minute<330||minute>=dusk+90?'夜晚':minute<420?'清晨':minute>=dusk-60?'傍晚':'白天',
  time:String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0')};
}
export function townSeasonRole(material){const name=material.name||'';return /叶片|嫩叶/.test(name)?'leaf':/街区柔绿|奶油石路|地台侧面/.test(name)?'ground':/屋顶/.test(name)?'roof':name==='水面'?'water':null;}
export function townRainSurface(world,s,x,z){return s.map==='outside'&&world.walkable(x,z)?{y:world.ground(x,z)+.015,water:false}:null;}
