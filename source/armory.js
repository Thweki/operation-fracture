// Distances use the same world units as flight and the encounter raycaster.
export const WEAPONS = {
  carbine: {
    id:'carbine', name:'棱镜卡宾', shortName:'棱镜', description:'双叉棱镜连续投射稳定的青色脉冲。',
    interval:.155, damage:27, pellets:1, heat:14, fullRange:82, range:82, pierce:1, color:'#73f2e8',
  },
  scatter: {
    id:'scatter', name:'炽瓣散射器', shortName:'炽瓣', description:'七枚琥珀辉瓣在近距离同时绽放。',
    interval:.54, damage:12, pellets:7, heat:29, fullRange:11, range:30, pierce:1, color:'#ffab53',
  },
  lance: {
    id:'lance', name:'星弦光矛', shortName:'星弦', description:'双轨聚束紫晶星弦，一发可穿过两枚核心。',
    interval:.58, damage:73, pellets:1, heat:28, fullRange:100, range:100, pierce:2, color:'#c5a8ff',
  },
  orbit: {
    id:'orbit', name:'回轨星轮', shortName:'星轮', description:'翡翠星轮穿过敌阵并折返。横移可改变回程，命中第二次。',
    interval:.72, damage:37, heat:27, range:30, color:'#a6f0a4',
  },
};
