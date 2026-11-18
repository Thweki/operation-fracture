import {WEAPONS} from './armory.js';
// Coordinates are shared by the terrain, the tactical chart and flight navigation.
export const sectors = [
  {id:'garden',name:'绯红前线',code:'BLOOM',terrain:'花园南缘',enemy:'守备机群',entry:[15,73,5.6],heading:[-.24,-.97],color:'#e3bd77',orders:'截断通往星门的巡弋机群，夺取前线中继。',intel:'巡弋机蓄能时核心会变亮。横移闪避，在敌方射击间隙反击。',requires:[],waves:2},
  {id:'tide',name:'潮汐圣所',code:'UNDERTOW',terrain:'西部潮池',enemy:'潮汐首领',entry:[-126,-39,7],heading:[-.645,-.765],color:'#79dacc',orders:'击破修复编队，夺取潮汐密钥。',intel:'追踪连接首领的修复链，优先压制织机。',requires:['garden'],waves:3},
  {id:'forge',name:'日冕熔炉',code:'SOLSTICE',terrain:'东部镜田',enemy:'熔炉首领',entry:[131,22,6.4],heading:[.59,-.807],color:'#eaa378',orders:'穿过定日镜阵，在熔炉泄压时击穿核心。',intel:'落点亮起时先离开地面警示，散热窗口适合精确射击。',requires:['garden'],waves:3},
  {id:'ridge',name:'回声封锁线',code:'ESCARPMENT',terrain:'西北断崖',enemy:'复合兵团',entry:[-68,-10,6.2],heading:[-.77,-.64],color:'#b0badf',orders:'打穿断崖上的混编防线，为北庭打开航路。',intel:'远程单位与侧翼截击机会同时压迫阵地。利用断壁切断其中一条火线。',requires:['tide','forge'],waves:3},
  {id:'gate',name:'天穹王座',code:'MERIDIAN',terrain:'北庭星门',enemy:'终端首领',entry:[6,-166,6],heading:[0,1],color:'#e2c97b',orders:'抵达星门背面，终止守门核心的过载序列。',intel:'观察锁线和扇形弹幕，留一次突进穿过封锁。',requires:['ridge'],waves:3},
];
export const byId=Object.fromEntries(sectors.map(site=>[site.id,site]));
export const patrol={id:'patrol',name:'边境截击',code:'INTERCEPT',terrain:'战区航线',enemy:'巡逻编队',intel:'消灭截击编队后继续前往目标。',waves:1};
const key='vesper-fracture-campaign-v1';
export function createCampaign(storage){
  let data={};
  try{data=JSON.parse(storage?.getItem(key)||'{}')||{}}catch{}
  const cleared=new Set(),best={},eliteBest={},checkpoint={},eliteCheckpoint={};
  for(const site of sectors){
    if(site.requires.every(id=>cleared.has(id))&&Array.isArray(data.cleared)&&data.cleared.includes(site.id))cleared.add(site.id);
    const t=data.best?.[site.id];if(cleared.has(site.id)&&Number.isFinite(t)&&t>0)best[site.id]=t;
    const et=data.eliteBest?.[site.id];if(cleared.has(site.id)&&Number.isFinite(et)&&et>0)eliteBest[site.id]=et;
    const w=data.checkpoint?.[site.id];if(Number.isInteger(w)&&w>1&&w<=site.waves&&site.requires.every(id=>cleared.has(id)))checkpoint[site.id]=w;
    const ew=data.eliteCheckpoint?.[site.id];if(Number.isInteger(ew)&&ew>1&&ew<=site.waves&&cleared.has(site.id))eliteCheckpoint[site.id]=ew;
  }
  const available=site=>site.requires.every(id=>cleared.has(id));
  const next=()=>sectors.find(s=>available(s)&&!cleared.has(s.id))||byId.gate;
  let tracked=Object.hasOwn(byId,data.tracked)&&available(byId[data.tracked])?byId[data.tracked]:next();
  let trackedElite=cleared.size===sectors.length&&data.trackedElite===true;
  let equipped=Object.hasOwn(WEAPONS,data.equipped)&&gear(data.equipped)?data.equipped:'carbine';
  function save(){try{storage?.setItem(key,JSON.stringify({cleared:[...cleared],best,eliteBest,checkpoint,eliteCheckpoint,tracked:tracked.id,trackedElite,equipped}))}catch{}}
  function equip(id){if(id!==equipped&&Object.hasOwn(WEAPONS,id)&&gear(id)){equipped=id;save()}}
  function track(site,elite=false){if(!available(site))return false;tracked=site;trackedElite=elite&&cleared.size===sectors.length;save();return true}
  function markWave(site,wave,elite=false){const records=elite?eliteCheckpoint:checkpoint;if(wave>1&&site.id!=='patrol'&&wave>(records[site.id]||1)){records[site.id]=wave;save()}}
  function clear(site,seconds,full,elite=false){
    const fresh=!cleared.has(site.id),records=elite?eliteBest:best,checkpoints=elite?eliteCheckpoint:checkpoint;cleared.add(site.id);delete checkpoints[site.id];
    if(full&&seconds>0)records[site.id]=Math.min(seconds,records[site.id]||Infinity);
    if(tracked===site){tracked=next();trackedElite=false}save();return fresh;
  }
  function gear(id){
    if(id==='orbit')return cleared.has('tide')&&cleared.has('forge');
    if(['lance','arc'].includes(id))return cleared.has('tide')||cleared.has('forge');
    if(['scatter','ward'].includes(id))return cleared.has('garden');
    return true;
  }
  return {cleared,best,eliteBest,checkpoint,eliteCheckpoint,available,next,track,markWave,clear,gear,equip,get equipped(){return equipped},get tracked(){return tracked},get trackedElite(){return trackedElite}};
}
export function missionClock(seconds){
  const tenths=Math.floor(Math.max(0,seconds)*10);
  return Math.floor(tenths/600)+':'+String(Math.floor(tenths/10)%60).padStart(2,'0')+'.'+tenths%10;
}
