// Fixed public-customer costumes; these IDs never enter the character wardrobe.
export const NPC_COSTUMES=Object.freeze({
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
});
export function npcLook(c={}){
 const name=String(c.name||'');const npcStyle=c.wantChar?'postcard':/老太/.test(name)?'granny':/学生/.test(name)?'student':/画家/.test(name)?'painter':/旅人/.test(name)?'traveler':/花店/.test(name)?'florist':/小孩/.test(name)?'child':/邮差/.test(name)?'postman':/审查/.test(name)?'inspector':/对家/.test(name)?'rival':/退款/.test(name)?'refund':'postcard';
 const x=NPC_COSTUMES[npcStyle];return {npcStyle,hair:x.hair,hairColor:x.hairColor,face:c.tough?'irritated':'default'};
}
