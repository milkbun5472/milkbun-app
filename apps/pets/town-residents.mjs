// One roster for town neighbors and human work relationships.
export const TOWN_RESIDENTS=[
 {id:'baker',workTags:['tidy','attentive'],name:'阿棉',role:'面包师',shop:'bakery',spot:{x:-14,z:-.5},to:'florist',item:'给花店的面包袋',detail:'总惦记着街坊有没有好好吃饭。',look:{hair:'bob',hairColor:'#684b35',outfit:'cardigan',wardrobe:{cardigan:{cloth:'#c49667'}}}},
 {id:'florist',workTags:['gentle','patient'],name:'青禾',role:'花店主',shop:'florist',spot:{x:-14,z:-13},to:'regular',item:'给咖啡店的一小束花',detail:'说话慢慢的，喜欢记住小动物的习惯。',look:{hair:'longpart',hairColor:'#443d32',outfit:'jacket',wardrobe:{jacket:{cloth:'#7e9b80'}}}},
 {id:'regular',workTags:['social','explore'],name:'小榆',role:'咖啡店的常客',shop:'cafe',spot:{x:14,z:12},to:'baker',item:'给面包师的手写便条',detail:'爱散步，也爱张罗周末的小聚会。',look:{hair:'pixie',hairColor:'#9a7654',outfit:'suit',wardrobe:{suit:{cloth:'#a18599'}}}}
];
