const unit=(name,hp,shield,scale,r,speed,damage,wind,reload,hue,weight=1)=>
  ({name,hp,shield,scale,r,speed,damage,wind,reload,hue,weight});

export const blueprints={
  drone:unit('浮游巡弋机',54,0,.96,1.02,13,12,.98,3.08,'#ffc07a',1),
  guard:unit('棱镜盾卫',87,43,1.14,1.53,12,16,1.28,3.55,'#ff985a',.52),
  skirmisher:unit('剪翼游骑',48,0,.88,1.10,14,9,.84,2.65,'#efae75',1.7),
  lancer:unit('长矛瞭机',78,0,1.04,1.20,29,24,1.58,3.55,'#d8a5fb',.60),
  weaver:unit('织流中继机',71,24,1.00,1.22,11,10,1.30,3.26,'#86dfc2',.85),
  mortar:unit('坠星投射机',98,0,1.12,1.30,11,24,1.45,3.72,'#ff985e',.37),
  tideBoss:{...unit('潮汐编织者',313,72,1.48,2.0,14,17,1.42,2.85,'#83dece',.56),boss:true},
  forgeBoss:{...unit('熔日铸主',343,46,1.56,2.0,14,19,1.48,3.04,'#ff9d54',.30),boss:true},
  warden:{...unit('轴心守门机',384,68,1.55,2.04,16,19,1.48,2.68,'#ffc275',.32),boss:true},
};
export const skillMax={pulse:8,ward:13,arc:10};
const site=(names,waves,hint)=>({names,waves,hint});
export const sites={
  garden:site(['失落巡线','花海伏击'],[['lancer','drone','guard','skirmisher','drone'],
    ['guard','mortar','skirmisher','guard','lancer','drone']],
    '紫色瞄准线定住后横移。盾卫将射向队友的火力引入自身护盾。'),
  tide:site(['潮线扰动','回声编队','潮汐编织者'],[['drone','weaver','skirmisher','guard','lancer'],
    ['guard','weaver','lancer','guard','skirmisher','weaver'],
    ['tideBoss','weaver','skirmisher','guard','lancer','weaver']],'优先击破修复队友的织流机。青色回潮充能时可以打断。'),
  forge:site(['镜田哨兵','坠星阵列','熔日铸主'],[['mortar','skirmisher','guard','lancer','mortar','drone'],
    ['mortar','guard','lancer','skirmisher','mortar','guard'],
    ['forgeBoss','mortar','guard','skirmisher','lancer','guard']],'落点变亮时离开圆环。熔芯排热时集中射击。'),
  ridge:site(['狭谷狙线','断崖游猎','交错火网'],[['lancer','guard','skirmisher','weaver','lancer','mortar'],
    ['weaver','mortar','skirmisher','guard','lancer','guard','lancer'],
    ['lancer','mortar','weaver','lancer','guard','mortar','skirmisher','guard']],'紫色锁线与落点会同时出现。改变横移方向，分开盾卫与狙击手。'),
  gate:site(['门前封锁','中继防线','轴心守门机'],[['guard','weaver','lancer','guard','mortar','lancer'],
    ['mortar','lancer','skirmisher','guard','weaver','mortar','guard'],
    ['warden','weaver','mortar','skirmisher','guard','lancer','weaver']],'打断过载充能，或突出锁域。轴心暴露时集火。'),
  north:site(['巡弋机群','重装护卫','终端守门机'],[['drone','drone','drone'],['guard','drone','guard'],['warden','guard','drone']],
    '侧移避开弹道，蓄能与排热时寻找破绽。'),
  patrol:site(['游荡巡逻队'],[['drone','skirmisher']],'击退巡逻队即可继续原航线。'),
};
export function patrolWave(rank){
  if(rank<1)return ['drone','skirmisher'];
  if(rank===1)return ['skirmisher','guard','drone'];
  return rank<4?['skirmisher','lancer','drone']:['lancer','weaver','skirmisher'];
}
const eliteReinforcements={
  garden:['weaver','mortar'],tide:['guard','mortar','lancer'],forge:['weaver','lancer','mortar'],
  ridge:['mortar','weaver','guard'],gate:['weaver','lancer','guard'],
};
export function campaignWaves(id,rank,veteran){
  if(id==='patrol')return [patrolWave(rank)];
  const base=sites[id].waves,extra=eliteReinforcements[id];
  return veteran&&extra?base.map((wave,i)=>[...wave,extra[i]]):base;
}
export function tune(def,rank){
  return {...def,hp:Math.round(def.hp*(1+.075*rank)),shield:Math.round(def.shield*(1+.055*rank)),
    speed:def.speed*(1+.045*rank),damage:Math.round(def.damage*(.86+.077*rank)),
    wind:def.wind*(1-.032*rank),reload:def.reload*(1-.045*rank)};
}
const attacks={
  bolt:['单发聚能','沿侧面避开光弹。'],dash:['掠翼双弹','游骑会横切并连射，跟随它的转向。'],
  lance:['棱线锁定','细线定住后横移或找掩体。'],mortar:['坠星标定','离开地面标记，投影会在原点坠落。'],
  mend:['回潮修复','电弧、脉冲或集中命中可中断青色修复链。'],
  fan:['潮汐折扇','弹群从两侧展开，穿过间隙。'],clamp:['过载锁域','打断核心，或从锁定圆圈中突进脱离。'],
  forge:['熔区连锁','离开标记区域，铸主在发射后会暴露熔芯。'],
  sweep:['交叉扫射','斜穿两束扫射的间隙。'],
  bracket:['交叉截击','两支弹流将从左右夹击，及时改变前进方向。'],
  echo:['回声落点','两枚落点依次标定前方和侧翼，观察第二处警示。'],
  split:['分叉锁线','双机炮向锁线两侧预射。锁线固定后再改变移动方向。'],
};
export function attackFor(e,repairPossible=true,veteran=false){
  const n=e.cycles,p=e.phase,k=e.kind;
  let id='bolt';
  if(k==='skirmisher')id='dash';
  else if(k==='lancer')id='lance';
  else if(k==='mortar')id='mortar';
  else if(k==='weaver')id=n%2===0?'mend':'bolt';
  else if(k==='tideBoss')id=p>1&&n%2===0?'mend':'fan';
  else if(k==='forgeBoss')id=n%3===2?'sweep':'forge';
  else if(k==='warden')id=p===1?'lance':p===2?(n%2?'sweep':'lance'):(n%2?'sweep':'clamp');
  if(id==='mend'&&!repairPossible)id=e.def.boss?'fan':'bolt';
  if(veteran){
    if((k==='guard'||k==='skirmisher')&&n%2===0||k==='warden'&&p===2&&n%2===1)id='bracket';
    if((k==='mortar'||k==='forgeBoss')&&n%2===0)id='echo';
    if((k==='lancer'||k==='warden'&&p===1)&&n%2===1)id='split';
    if(k==='tideBoss'&&n%3===1)id='bracket';
  }
  const [name,hint]=attacks[id];
  const wind=e.def.wind*(id==='mend'?1.32:id==='clamp'?1.42:id==='lance'||id==='split'?1.10:1);
  return {id,name,hint,wind};
}
