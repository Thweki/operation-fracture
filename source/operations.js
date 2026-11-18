import {sectors,byId,missionClock} from './campaign.js';
import {buildChart} from './tactical-chart.js';
import {WEAPONS} from './armory.js';
import {skillMax} from './combat-rules.js';

const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const item=document.createElement(tag);if(cls)item.className=cls;if(text)item.textContent=text;return item};
function button(parent,text,fn,primary=false){const b=el('button',primary?'primary':'secondary',text);b.onclick=fn;parent.append(b);return b}
function label(parent,text){parent.append(el('div','menu-label',text))}
const loadouts=Object.keys(WEAPONS);
export function createOperations(campaign,actions){
  const dialog=$('operations'),body=$('ops-body'),title=$('ops-title');
  let page='',chosen=campaign.tracked,origin='';
  function mount(name,heading){
    page=name;title.textContent=heading;body.replaceChildren();$('close-ops').hidden=page==='result';
    if(!dialog.open){actions.freeze();dialog.showModal()}
  }
  function dismiss(restore=true){
    page='';dialog.close();if(restore)actions.unfreeze();
  }
  function back(){
    if(page==='result')return;
    if(page==='map'&&origin==='result'){result();return}
    if(page==='map'&&origin==='pause'){pause();return}
    if(page==='settings'&&origin==='pause'){pause();return}
    dismiss();
  }
  dialog.addEventListener('cancel',e=>{e.preventDefault();back()});
  $('close-ops').onclick=back;
  function map(from='landing'){
    origin=from;chosen=campaign.tracked;mount('map','战区地图');
    const layout=el('div','map-layout'),frame=el('div','chart-wrap'),list=el('div','sector-list');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-label','战区地形与中继路线');frame.append(svg);layout.append(frame,list);body.append(layout);
    const report=el('p','orders'),buttons=el('div','menu-actions');body.append(report,buttons);
    const rows=new Map(),chart=buildChart(svg,campaign,select);
    for(const [i,site] of sectors.entries()){
      const row=el('button','sector-row');
      row.append(el('b','',String(i+1).padStart(2,'0')),el('strong','',site.name),el('small','',campaign.cleared.has(site.id)?'已攻克':campaign.available(site)?'可出击':'未连通'));
      row.classList.toggle('locked',!campaign.available(site));row.onclick=()=>select(site);list.append(row);rows.set(site.id,row);
    }
    function select(site){
      chosen=site;for(const [id,row] of rows)row.classList.toggle('selected',id===site.id);
      const here=actions.location();chart.update(site,here?.position,here?.bearing);
      const open=campaign.available(site);report.replaceChildren(el('strong','',site.terrain+'　'),document.createTextNode(site.orders+' '+(open?site.intel:'先攻克'+site.requires.filter(id=>!campaign.cleared.has(id)).map(id=>byId[id].name).join('、')+'。')));
      buttons.replaceChildren();
      if(!open)return;
      const checkpoint=campaign.checkpoint[site.id]||1,phase=actions.mode();
      if(from==='landing'){
        button(buttons,checkpoint>1?'从第 '+checkpoint+' 波部署':'部署至此',()=>{dismiss(false);actions.deploy(site)},true);
      }else if(phase==='combat'){
        button(buttons,'标记为下一目标',()=>{const current=actions.info();campaign.track(site,site===current.site&&current.veteran);dismiss();actions.notice('已标记 · '+site.name)},true);
      }else{
        button(buttons,'沿地表前往',()=>{dismiss(false);actions.route(site)},true);
        button(buttons,checkpoint>1?'中继跃迁 · 第 '+checkpoint+' 波':'中继跃迁',()=>{dismiss(false);actions.deploy(site)});
      }
      if(campaign.best[site.id])buttons.append(el('small','control-copy','完整战绩 '+missionClock(campaign.best[site.id])));
      if(campaign.cleared.size===sectors.length&&phase!=='combat'){
        const eliteWave=campaign.eliteCheckpoint[site.id]||1;
        button(buttons,eliteWave>1?'精英重演 · 第 '+eliteWave+' 波':'精英重演',()=>{dismiss(false);actions.elite(site)});
        if(campaign.eliteBest[site.id])buttons.append(el('small','control-copy','精英战绩 '+missionClock(campaign.eliteBest[site.id])));
      }
    }
    select(chosen);
  }
  function pause(){
    mount('pause','战术暂停');
    const info=actions.info(),site=info.site;
    body.append(el('p','menu-prose',site.name+'　/　'+site.intel));
    label(body,'选择装备');const gear=el('div','equip-choices');body.append(gear);
    for(const id of loadouts){
      const ready=campaign.gear(id),b=button(gear,WEAPONS[id].name+(ready?'':' · 未解锁'),()=>{actions.equip(id);pause()});
      b.disabled=!ready;b.setAttribute('aria-pressed',String(id===info.weapon));
      b.title=WEAPONS[id].description;
    }
    body.append(el('p','menu-prose',WEAPONS[info.weapon].description));
    const skills=el('details','skill-reference');skills.append(el('summary','','技能与反制'));
    for(const [id,name,shortcut,seconds,copy] of [
      ['pulse','脉冲','F',skillMax.pulse,'清除周围 27 米内的来袭弹体，震慑近身机群。'],
      ['ward','相位护壁','R',skillMax.ward,'立即恢复 22 点护盾，随后 3 秒承受的伤害降低 82%。'],
      ['arc','连锁电弧','C',skillMax.arc,'在 36 米内锁定首个目标，最多连击四台敌机并打断蓄能。'],
      ['dash','矢量突进','Shift',2.15,'沿移动方向冲刺。没有移动输入时向前突进，可用于脱离落点或切换掩体。'],
    ]){
      const row=el('div');row.append(el('b','',name),el('small','',campaign.gear(id)?shortcut+' · '+seconds+' 秒':'待解锁'),el('p','',copy));skills.append(row);
    }
    body.append(skills);
    body.append(el('p','control-copy',matchMedia('(pointer:coarse)').matches?'左手摇杆移动，按住右侧准星并拖动瞄准。点击武器名轮换装备，技能可从下方直接释放。':'WASD 移动　Q / E 升降　左键开火　右键聚焦　1–4 换枪　F 脉冲　R 护壁　C 电弧　Shift 突进　L 锁定鼠标　M 地图'));
    const buttons=el('div','menu-actions');body.append(buttons);
    button(buttons,'继续作战',()=>dismiss(),true);button(buttons,'战区地图',()=>map('pause'));button(buttons,'操作与音频',()=>settings('pause'));
    const audio=button(buttons,actions.soundOn()?'静音':'开启声音',async()=>{audio.textContent=await actions.audio()?'静音':'开启声音'});
    button(buttons,'全屏',actions.fullscreen);
  }
  function settings(from){
    origin=from;mount('settings','操作与音频');
    const grid=el('div','settings-grid');body.append(grid);
    for(const [id,name,min,max,step,format] of [
      ['sensitivity','瞄准灵敏度',.45,1.9,.05,v=>v.toFixed(2)+' ×'],
      ['fov','垂直视野',55,85,1,v=>v+'°'],
      ['volume','总音量',0,1,.05,v=>Math.round(v*100)+'%'],
      ['music','配乐音量',0,1,.05,v=>Math.round(v*100)+'%'],
    ]){
      const row=el('div','setting-row'),title=el('label','',name),value=el('output'),input=el('input');
      input.id='setting-'+id;title.htmlFor=input.id;input.type='range';input.min=min;input.max=max;input.step=step;input.value=actions.settings[id];
      const show=()=>{const n=input.valueAsNumber;value.textContent=format(n);input.setAttribute('aria-valuetext',format(n));return n};
      show();input.oninput=()=>actions.changeSetting(id,show());row.append(title,value,input);grid.append(row);
    }
    const buttons=el('div','menu-actions');body.append(buttons);button(buttons,'完成',back,true);
  }
  function result(){
    const info=actions.info(),site=info.site,won=info.won,over=won&&site.id==='gate'&&campaign.cleared.size===5;
    mount('result',won?(info.veteran?site.name+' · 精英重演完成':over?'星门已解放':site.id==='patrol'?'航线已打通':site.name+'已攻克'):'机体信号中断');
    const stats=el('div','stats');
    for(const [k,v] of [['本次作战时间',missionClock(info.time)],[info.entryWave>1?'战区累计清敌':'清除敌机',String(info.kills)],['抵达波次',info.wave+' / '+info.waves]]){
      const cell=el('div');cell.append(el('small','',k),el('b','',v));stats.append(cell);
    }body.append(stats);
    if(info.reward)body.append(el('div','reward',info.reward));
    if(info.unlocked){
      const unlock=el('div','unlock-row'),gun=WEAPONS[info.unlocked];
      unlock.append(el('p','control-copy',gun.description));
      const b=button(unlock,'装备'+gun.shortName,()=>{actions.equip(gun.id);b.textContent='已装备';b.disabled=true});
      if(campaign.equipped===gun.id){b.textContent='已装备';b.disabled=true}body.append(unlock);
    }
    if(won&&site.id!=='patrol'&&info.entryWave>1)body.append(el('p','control-copy','本次从第 '+info.entryWave+' 波继续。完整战绩从第一波开始计时。'));
    else if(won&&info.previousBest&&info.time<info.previousBest)body.append(el('p','record-copy','个人最佳　比上次快 '+(info.previousBest-info.time).toFixed(1)+' 秒'));
    body.append(el('p','menu-prose',won?(info.veteran?'精英计时独立保存。从第一波连续攻克战区即可刷新个人最佳成绩。':over?'双钥已就位，星门恢复运转。五区精英重演已开放，增援与攻击组合会发生变化。':site.id==='patrol'?'巡逻编队已清除，继续前往追踪战区。':'战区进度已记录。可沿地表推进，或在地图选择中继跃迁。'):site.intel));
    const buttons=el('div','menu-actions');body.append(buttons);
    if(won){
      if(over||info.veteran)button(buttons,'选择再战区域',()=>map('result'),true);
      else button(buttons,'继续地表推进',()=>{dismiss(false);actions.route(campaign.tracked)},true);
      if(!over&&!info.veteran)button(buttons,'选择战区',()=>map('result'));
    }else{
      button(buttons,'从检查点重试',()=>{dismiss(false);actions.retry()},true);
      button(buttons,'查看战区',()=>map('result'));
    }
  }
  return {map,pause,settings,result,back,dismiss,get open(){return dialog.open},get page(){return page}};
}
