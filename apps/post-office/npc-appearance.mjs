// Fixed public-customer costumes; these IDs never enter the character wardrobe.
export const NPC_COSTUMES={
 granny:{label:'寄信的老太太',hair:'bob',hairColor:'#b7b1a4',cloth:'#a77c91',bottom:'#776c79',trim:'#e5d2bb',detail:'floral',skirt:true,glasses:true},
 student:{label:'赶时间的学生',hair:'pixie',hairColor:'#574b3b',cloth:'#648398',bottom:'#5c687b',trim:'#e7d5af',detail:'satchel'},
 painter:{label:'沉默的画家',hair:'curtains',hairColor:'#564b41',cloth:'#d7c8aa',bottom:'#716d67',trim:'#9c785b',detail:'paint',beret:true},
 traveler:{label:'迷路的旅人',hair:'korean',hairColor:'#806349',cloth:'#aa8d5b',bottom:'#6e7b68',trim:'#debc86',detail:'map',hat:'sun'},
 florist:{label:'花店老板',hair:'bob',hairColor:'#725c43',cloth:'#c5caa4',bottom:'#726c53',trim:'#7e9a78',detail:'flowers'},
 child:{label:'邻居小孩',hair:'pixie',hairColor:'#635044',cloth:'#bd8065',bottom:'#6f8b89',trim:'#ead5a3',detail:'stripes'},
 postman:{label:'退休的邮差',hair:'bob',hairColor:'#a8a59a',cloth:'#698779',bottom:'#687563',trim:'#d6bb78',detail:'post',hat:'post',glasses:true},
 inspector:{label:'难缠的审查员',hair:'korean',hairColor:'#504c48',cloth:'#5b6d79',bottom:'#4b535e',trim:'#c9b789',detail:'inspect',hat:'inspect',coat:true},
 rival:{label:'来砸场子的对家',hair:'curtains',hairColor:'#594238',cloth:'#8a5961',bottom:'#5c5362',trim:'#cfab78',detail:'rival',coat:true},
 refund:{label:'吵着退款的客人',hair:'korean',hairColor:'#625044',cloth:'#aa775e',bottom:'#6c747c',trim:'#e1ccaf',detail:'check'},
 postcard:{label:'买明信片的客人',hair:'korean',hairColor:'#6d5d4a',cloth:'#80998b',bottom:'#777568',trim:'#ead8b8',detail:'letter'}
};
const extra={
 baker:['面包师','#b5966f','#776b60','#f2e3c5','pixie'],teacher:['小学老师','#9b7d8f','#6f6978','#eadcc3','bob'],tuner:['调音师','#6c7982','#5b6067','#d8c9aa','curtains'],nurse:['夜班护士','#a4c3bc','#769a97','#f5efe1','bob'],bookseller:['书店店员','#9c8066','#696255','#d6c2a0','curtains'],fisher:['渔夫','#bc9956','#687c70','#e0c68d','korean'],watchmaker:['修表匠','#8c7058','#5c6668','#d6b889','korean'],photographer:['摄影师','#697c77','#606774','#d7c5a6','pixie'],professor:['教授','#7f746b','#5f5a55','#dfd2b8','curtains'],courier:['快递员','#c58e51','#5d6973','#e4c58b','pixie'],chef:['厨子','#e3dccb','#6b747c','#fcf2df','korean'],neighbor:['邻居大叔','#7e947c','#6e705d','#e3d1b1','korean'],international:['留学生','#9c6f76','#5b697d','#ecd8ba','curtains'],newlywed:['新婚的姑娘','#d9adad','#a8899b','#f4dfc9','bob'],
 rare_ghost:['旧制服邮差','#74847b','#65706b','#b9b7a5','bob'],rare_rainman:['黑伞寄信人','#55595b','#515152','#8c8b84','korean'],rare_kid:['玻璃罐女孩','#c49aa6','#a97f95','#ecd6b7','bob'],rare_collector:['集邮家','#655e69','#514c5a','#c6b17c','curtains'],rare_snow:['雪中旅人','#82969d','#687a83','#d4d7cf','korean'],rare_cat:['三花猫','#e4d6bb','#815c48','#d8ae73','bob'],rare_author:['作家','#9a8877','#6f6771','#d9cbb1','curtains'],rare_bride:['婚纱新娘','#f0e6d8','#eadfce','#fff3e3','bob']
};
for(const [id,[label,cloth,bottom,trim,hair]]of Object.entries(extra))NPC_COSTUMES[id]={label,cloth,bottom,trim,hair,hairColor:['professor','rare_ghost'].includes(id)?'#b5afa0':'#5e4d40'};
NPC_COSTUMES.rare_kid.dims={height:.82,build:.88,head:1.04};Object.freeze(NPC_COSTUMES);
export function npcLook(c={},catalog=globalThis.StampDuel){
 const name=String(c.name||''),resolved=catalog?.shopAppearance?.(c);
 const legacy=Object.entries(NPC_COSTUMES).find(([,v])=>v.label===name)?.[0]||'postcard';
 const npcStyle=resolved?.style||legacy,x=NPC_COSTUMES[npcStyle]||NPC_COSTUMES.postcard;
 const look={npcStyle,npcFeature:resolved?.feature||null,npcRare:resolved?.rareId||null,npcSpecies:resolved?.species||'person',hair:x.hair,hairColor:x.hairColor,face:c.tough?'irritated':'default'};
 if(x.dims)look.dims={...x.dims};if(look.npcFeature==='sun')look.skin='#ad704d';return look;
}
