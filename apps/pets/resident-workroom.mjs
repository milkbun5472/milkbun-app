// One furniture definition drives the visible professional room and its floor collision.
export const WORKROOM_LAYOUT={camera:{position:[10,-13,11],target:[0,0,1],scale:10},zones:{desk:{title:'职业工作间',text:'TA的本职工作、项目与交接都在这里。',target:[0,0,1]}}};
export function workroomFurniture(form='office'){
 const common=[{id:'desk',kind:'table',x:-1.5,z:-1.4,w:2.2,d:.8,h:1.2,color:'#ad8f75'},{id:'shelf',kind:'shelf',x:2.5,z:-1.8,w:.7,d:.65,h:1.6,color:'#ac9179'}];
 if(form==='clinic')common.push({id:'exam',kind:'bed',x:1.65,z:.3,w:1.3,d:1.7,h:.85,color:'#d3dfd7'});
 if(form==='classroom')for(const x of[.6,1.8])common.push({id:'pupil-'+x,kind:'table',x,z:1,w:.8,d:.55,h:.82,color:'#c8aa83'});
 if(form==='studio')common.push({id:'easel',kind:'easel',x:1.55,z:-1.5,w:.95,d:.25,h:2.2,color:'#aa8c70'});
 return common;
}
