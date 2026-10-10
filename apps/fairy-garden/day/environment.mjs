// Lighting follows the character's local clock. Weather must have an explicit source.
const smooth=n=>{const x=Math.max(0,Math.min(1,n));return x*x*(3-2*x);};
export function weatherKind(code){
 if(code==null||!Number.isFinite(Number(code)))return 'unknown';const n=Number(code);
 if([71,73,75,77,85,86].includes(n))return 'snow';
 if([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(n))return 'rain';
 if(n===45||n===48)return 'fog';if(n===3)return 'overcast';if(n===2)return 'cloud';return 'clear';
}
export function environmentAt(minute=720,weather=null){
 const m=((Number.isFinite(Number(minute))?Number(minute):720)%1440+1440)%1440;
 const dawn=smooth((m-300)/150),dusk=1-smooth((m-1050)/180),daylight=dawn*dusk;
 const morning=Math.max(0,1-Math.abs(m-390)/110),evening=Math.max(0,1-Math.abs(m-1090)/120),warmth=Math.max(morning,evening)*(1-daylight*.25);
 const known=weather&&['real','world','preview'].includes(weather.source)&&weather.code!=null&&Number.isFinite(Number(weather.code));
 const kind=known?weatherKind(weather.code):'unknown',wet=kind==='rain',cloud=wet?.48:kind==='overcast'?.35:kind==='cloud'?.17:kind==='fog'?.38:0;
 return {minute:m,daylight,warmth,kind,known:!!known,night:daylight<.15,hemi:1.12+daylight*(1.10-cloud),sun:.34+daylight*(2.7-cloud*2),fill:.38+daylight*.57,lamp:1-daylight,wet,phase:daylight<.15?'夜晚':morning>.2?'晨光':evening>.2?'夕阳':'白天'};
}
