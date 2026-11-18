import {createEncounter} from './combat.js';
import {buildResonator} from './resonator.js';
import {WEAPONS} from './armory.js';
import {sectors,patrol} from './campaign.js';
import {createOperations} from './operations.js';
import {createBossPresence} from './boss-presence.js';

const $=id=>document.getElementById(id),weaponIds=Object.keys(WEAPONS);
const skills=[['pulse','脉冲','F'],['ward','护壁','R'],['arc','电弧','C'],['dash','突进','⇧']];
const rankFor=(site,count)=>site.id==='garden'?0:site.id==='ridge'?3:site.id==='gate'?4:Math.max(1,Math.min(2,count));
const fraction=(a,b)=>Math.max(0,Math.min(1,a/b));
const number=n=>String(n).padStart(2,'0');
// Browsers only synthesize a click for the primary finger. A pilot must be
// able to hold the stick and fire while a third finger activates a skill.
function fieldButton(button,action){
  let touched=-Infinity;
  button.onpointerdown=e=>{
    if(e.pointerType!=='touch'||button.disabled)return;
    touched=performance.now();e.preventDefault();action();
  };
  button.onclick=e=>{
    if(e.detail>0&&e.pointerType!=='mouse'&&performance.now()-touched<650)return;
    action();
  };
}

export function createBattleMode(T,scene,camera,env){
  const {campaign,sound}=env,canvas=$('landscape'),hud=$('battle-hud'),aim=$('aim-reticle');
  const instrument=buildResonator(T,camera),ray=new T.Raycaster(),aimPoint=new T.Vector2();
  const presence=createBossPresence(T,scene);
  const relative=new T.Vector3(),dir=new T.Vector3(),projected=new T.Vector3(),viewRight=new T.Vector3();
  const encounter=createEncounter(T,scene,camera,{heightAt:env.heightAt,solids:env.solids,collision:env.collision,lightPool:env.lightPool,getMuzzle:instrument.getMuzzle,onEvent,reduceMotion:env.reduced});
  let mode='landing',site=campaign.tracked,paused=false,finished=false,weaponId=campaign.equipped,lastResult=null;
  let holding=false,centerFire=false,rotating=null,touchAim=null,focus=false,hadLock=false,mouseId=1;
  let gameTime=0,resultWait=0,hudTime=0,hitTime=0,hurtTime=0,announcement=0,entryWave=1;
  let veteran=false,rememberLock=false,pointerPreferred=true,tipTime=0,tipSeen=false;
  let routeStart=0,routeAmbushed=false,nextNumber=0,damageBatch=0,damageTime=0;
  const damagePoint=new T.Vector2(),origin=new T.Vector3(),markerNodes=new Map(),display=new WeakMap();
  const numPool=Array.from({length:12},()=>{const n=document.createElement('span');n.hidden=true;$('damage-text').append(n);return n});
  const skillNodes=new Map();
  for(const [id,name,key] of skills){
    const b=document.createElement('button');b.className='skill';b.title=name+' ('+key+')';b.setAttribute('aria-label',name);
    b.innerHTML='<kbd>'+key+'</kbd><svg><use href="#i-'+id+'"/></svg><span>'+name+'</span><small></small>';
    fieldButton(b,()=>cast(id));document.querySelector('.abilities').append(b);skillNodes.set(id,b);
  }
  const ops=createOperations(campaign,{
    mode:()=>mode,location:()=>mode==='landing'?null:{position:camera.position,bearing:bearing()},
    notice:env.notice,freeze,unfreeze,deploy,elite:s=>deploy(s,false,undefined,true),route:startRoute,retry,info:()=>lastResult&&mode==='result'?lastResult:{site,weapon:weaponId,veteran},
    equip,settings:env.settings,changeSetting:env.changeSetting,soundOn:()=>sound.enabled,audio:env.audio,fullscreen:env.fullscreen,
  });
  const coarse=matchMedia('(pointer:coarse)').matches;
  function updateLanding(){
    const selected=campaign.tracked,i=sectors.indexOf(selected);
    $('deploy-number').textContent=number(i+1);$('deploy-code').textContent=selected.code;$('deploy-name').textContent=selected.name;
    $('deploy-threat').textContent=selected.enemy;$('deploy-progress').textContent=campaign.cleared.size+' / 5 战区';
    $('campaign-track').innerHTML=sectors.map(s=>'<i class="'+(campaign.cleared.has(s.id)?'done':s===selected?'selected':'')+'"></i>').join('');
    $('battle-start').firstChild.textContent=campaign.trackedElite?'继续精英重演 ':campaign.cleared.size===sectors.length?'再战'+selected.name+' ':campaign.cleared.size||campaign.checkpoint.garden?'继续战役 ':'投入战斗 ';
  }
  function text(el,value){if(display.get(el)!==value){el.textContent=value;display.set(el,value)}}
  function bar(el,value){if(display.get(el)!==value){el.style.transform='scaleX('+value+')';display.set(el,value)}}
  function center(){aimPoint.set(0,0);aim.style.left='50%';aim.style.top='50%'}
  function pointAt(e){
    aimPoint.set(2*e.clientX/innerWidth-1,1-2*e.clientY/innerHeight);aim.style.left=(e.clientX/innerWidth*100)+'%';aim.style.top=(e.clientY/innerHeight*100)+'%';
  }
  function focusing(on){focus=on;env.focus(on);aim.classList.toggle('focused',on)}
  function clearInput(){holding=centerFire=false;rotating=touchAim=null;focusing(false);env.clearInput()}
  function releaseLock(){hadLock=false;if(document.pointerLockElement===canvas)document.exitPointerLock()}
  function lock(){if(pointerPreferred&&!coarse&&canvas.requestPointerLock&&document.pointerLockElement!==canvas){try{canvas.requestPointerLock()?.catch(()=>{})}catch{}}}
  function togglePointer(){pointerPreferred=document.pointerLockElement!==canvas;if(pointerPreferred)lock();else releaseLock()}
  function freeze(){rememberLock=document.pointerLockElement===canvas;paused=true;clearInput();releaseLock();$('atlas').classList.add('paused');hud.inert=true;sound.combat('pause')}
  function unfreeze(){
    paused=false;hud.inert=false;$('atlas').classList.remove('paused');
    sound.combat('resume');
    if(mode==='landing'){$('battle-start').focus();return}
    canvas.focus({preventScroll:true});if(rememberLock)lock();rememberLock=false;
  }
  function announce(kicker,name,seconds=1.5){$('wave-index').textContent=kicker;$('wave-name').textContent=name;announcement=seconds;$('wave-flash').classList.add('show')}
  function engageShell(){
    if(ops.open)ops.dismiss(false);
    paused=finished=false;lastResult=null;clearInput();presence.clear();center();hud.inert=false;hud.hidden=false;
    $('landing').hidden=true;$('atlas').classList.remove('paused');instrument.show(true);
    canvas.focus({preventScroll:true});$('boss-hud').hidden=true;$('route-tag').hidden=true;$('threat-cue').hidden=true;$('field-tip').hidden=true;tipTime=0;
    for(const item of markerNodes.values())item.el.remove();markerNodes.clear();
    for(const n of numPool)n.hidden=true;
    hurtTime=hitTime=damageBatch=damageTime=0;$('hit-direction').hidden=true;$('damage-edge').style.opacity='0';
    hudTime=0;env.activateAudio();
  }
  function labelMission(activeSite,travel=false){
    $('mission-code').textContent=(travel?'ROUTE':activeSite.code)+'　/　VESPER–04';$('mission-name').textContent=travel?'前往'+activeSite.name:activeSite.name;
    document.querySelector('.wave-track').innerHTML=travel?'':'<i></i>'.repeat(activeSite.waves);
  }
  function deploy(selected=campaign.tracked,inPlace=false,retryWave,elite=false){
    if(selected!==patrol&&!campaign.available(selected))return;
    if(mode!=='landing')encounter.stop();
    engageShell();site=selected;mode='combat';veteran=elite&&campaign.cleared.size===sectors.length;
    if(selected!==patrol&&(retryWave===undefined||campaign.tracked===selected))campaign.track(site,veteran);
    const fromWave=retryWave??((veteran?campaign.eliteCheckpoint:campaign.checkpoint)[site.id]||1);entryWave=fromWave;
    if(!inPlace)env.place(site);
    origin.copy(camera.position);labelMission(site);gameTime=0;
    const rank=site===patrol?campaign.cleared.size:rankFor(site,campaign.cleared.size);
    encounter.start({site:site.id,rank,fromWave,veteran});equip(weaponId);
    if(veteran)$('mission-code').textContent=site.code+'　/　精英重演';
    if(!tipSeen){tipSeen=true;tipTime=7;$('field-tip').hidden=false;$('field-tip').textContent=coarse?'摇杆移动　·　按住准星并拖动开火':'WASD 移动　·　左键开火　·　Shift 突进　·　F 脉冲'}
    lock();
  }
  function startRoute(target,elite=(mode==='travel'||site===patrol)&&target===campaign.tracked&&campaign.trackedElite){
    if(!campaign.track(target,elite))return;
    const afterPatrol=site===patrol;encounter.stop();engageShell();mode='travel';veteran=false;site=target;encounter.travel();equip(weaponId);
    labelMission(site,true);env.face(target);routeStart=distanceTo(target);routeAmbushed=afterPatrol;
    announce('SURFACE ROUTE','航标已锁定');$('battle-count').textContent='沿航标推进 · M 查看战区';
    lock();
  }
  function retry(){if(site===patrol){deploy(patrol,true,1);return}deploy(site,false,lastResult?.wave,veteran)}
  function distanceTo(target){return Math.hypot(camera.position.x-target.entry[0],camera.position.z-target.entry[1])}
  function bearing(){camera.getWorldDirection(dir);return (360+Math.round(Math.atan2(dir.x,-dir.z)*180/Math.PI))%360}
  function updateRoute(){
    const target=campaign.tracked,distance=distanceTo(target);
    if(distance<16){deploy(target,true,undefined,campaign.trackedElite);return}
    const other=sectors.find(s=>s!==target&&!campaign.cleared.has(s.id)&&campaign.available(s)&&distanceTo(s)<13);
    if(other){deploy(other,true);return}
    if(!routeAmbushed&&routeStart-distance>42&&distance>34){
      routeAmbushed=true;deploy(patrol,true);return;
    }
    const tag=$('route-tag');relative.set(target.entry[0],env.heightAt(target.entry[0],target.entry[1])+7,target.entry[1]);
    relative.project(camera);
    // A bearing at the edge remains steerable when the beacon is behind the pilot.
    const angle=Math.atan2(target.entry[0]-camera.position.x,-(target.entry[1]-camera.position.z))-bearing()*Math.PI/180;
    const x=relative.z>1?(Math.sin(angle)>=0?.91:.09):T.MathUtils.clamp(.5+.5*relative.x,.085,.915);
    const y=relative.z>1?.5:T.MathUtils.clamp(.5-.5*relative.y,.24,.72);
    tag.hidden=false;tag.style.left=(100*x)+'%';tag.style.top=(100*y)+'%';text(tag.children[1],target.name);text(tag.children[2],Math.round(distance)+' m');
  }
  function equip(id){
    if(!WEAPONS[id])return;
    if(!campaign.gear(id)){env.notice(id==='scatter'?'攻克绯红前线解锁散射器':id==='orbit'?'集齐潮汐与日冕双钥解锁星轮':'夺取第一枚密钥解锁光矛');return}
    weaponId=id;campaign.equip(id);encounter.equip(id);instrument.equip(id);
    $('weapon-name').textContent=WEAPONS[id].name;$('weapon-slot').textContent=number(weaponIds.indexOf(id)+1);
    $('weapon-class').textContent={carbine:'自动 · 能量卡宾',scatter:'近程 · 七束散射',lance:'精密 · 双核贯穿',orbit:'回旋 · 双程穿阵'}[id];
    hudTime=0;
  }
  function cycleWeapon(){const ids=weaponIds.filter(id=>campaign.gear(id));if(ids.length===1){env.notice('攻克绯红前线解锁下一件装备');return}equip(ids[(ids.indexOf(weaponId)+1)%ids.length])}
  function cast(id){
    if(paused||finished||!['combat','travel'].includes(mode))return;
    if(!campaign.gear(id)){env.notice(id==='ward'?'攻克绯红前线解锁护壁':'夺取第一枚密钥解锁电弧');return}
    if(id==='dash'){if(env.dash())sound.combat('dash');return}
    encounter.cast(id);
  }
  function fire(useCenter=false){
    if(paused||finished||!['combat','travel'].includes(mode))return;
    if(useCenter||document.pointerLockElement===canvas)center();camera.updateMatrixWorld();ray.setFromCamera(aimPoint,camera);
    if(useCenter&&coarse){
      let best=.9978,selected=null;
      for(const foe of encounter.getState().enemies){
        if(!foe.visible)continue;relative.copy(foe.position).sub(camera.position).normalize();
        const alignment=relative.dot(ray.ray.direction);if(alignment>best){best=alignment;selected=foe}
      }
      if(selected)ray.ray.direction.lerp(relative.copy(selected.position).sub(camera.position).normalize(),.69).normalize();
    }
    encounter.fire(ray.ray.direction);
  }
  function onEvent(e){
    if(e.type==='stop'){sound.combat('stop');return}
    if(mode==='landing')return;
    let pan=0,distance=0;
    if(e.position?.isVector3){relative.copy(e.position).sub(camera.position);distance=relative.length();viewRight.setFromMatrixColumn(camera.matrixWorld,0);pan=relative.normalize().dot(viewRight)}
    sound.combat(e.type,pan,{...e,distance,enemyType:e.kind});instrument.effect(e.type,e);env.effect(e);
    if(e.type==='fire'&&e.hit)hitTime=.15;
    if(e.type==='hit'){
      hitTime=.16;damageBatch+=Number(e.damage)||0;projected.copy(e.position).project(camera);damagePoint.set(projected.x,projected.y);
      damageTime=.035;aim.dataset.shield=String(!!e.shielded);
    }
    if(e.type==='hurt'){
      hurtTime=.48;const indicator=$('hit-direction');indicator.hidden=false;
      const local=camera.worldToLocal(projected.copy(e.position));indicator.style.transform='rotate('+Math.atan2(local.x,-local.z)+'rad)';
    }
    if(e.type==='wave'){
      if(site!==patrol)campaign.markWave(site,e.wave,veteran);announce(site.code+'　/　WAVE '+number(e.wave),e.name||site.name,1.45);
    }
    if(e.type==='bossPhase')announce('CORE SHIFT　/　0'+e.bossPhase,e.name+' · 相位切换',1.05);
    if(e.type==='win'||e.type==='lose'){
      const s=encounter.getState(),won=e.type==='win';let reward='',unlocked='';
      const fullAttempt=entryWave===1,previousBest=(veteran?campaign.eliteBest:campaign.best)[site.id];
      if(won&&site!==patrol){
        const before=campaign.cleared.size,fresh=campaign.clear(site,s.elapsed,fullAttempt,veteran);
        if(veteran)reward='精英编队已击破'+(fullAttempt?'　·　完整战绩已记录':'');
        if(fresh){if(site.id==='garden'){unlocked='scatter';reward='装备就绪　炽瓣散射器 · 相位护壁'}
          else if(before===1){unlocked='lance';reward='装备就绪　星弦光矛 · 连锁电弧'}
          else if(before===2){unlocked='orbit';reward='双钥已齐　回轨星轮就绪 · 回声封锁线开放'}else if(site.id==='ridge')reward='北庭航线已解封';}
      }
      finished=true;clearInput();lastResult={site,weapon:weaponId,won,veteran,time:s.elapsed,kills:s.kills,wave:s.wave,waves:s.waves,reward,unlocked,entryWave,previousBest};
      statusCounters(s);
      if(won){markers([]);$('boss-hud').hidden=true;$('threat-cue').hidden=true}
      resultWait=won?1.65:.8;announce(won?'SECTOR SECURE':'SIGNAL LOST',won?(site===patrol?'航线畅通':'战区已夺回'):'机体失去响应',resultWait);
    }
  }
  function flushDamage(){
    if(damageBatch<=0)return;
    if(!env.reduced.matches&&Math.abs(damagePoint.x)<1&&Math.abs(damagePoint.y)<1){
      const n=numPool[nextNumber++%numPool.length];n.hidden=false;n.classList.toggle('shield',aim.dataset.shield==='true');
      n.textContent=Math.round(damageBatch);n.style.left=(50+damagePoint.x*50+1.3)+'%';n.style.top=(50-damagePoint.y*50-2.2)+'%';
      n.getAnimations().forEach(a=>{a.cancel();a.play()});
    }damageBatch=0;
  }
  function markers(enemies){
    for(const marker of markerNodes.values())marker.seen=false;
    for(const e of enemies){
      if(!e.visible)continue;projected.copy(e.position);projected.y+=e.radius*1.12;projected.project(camera);
      if(projected.z<0||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>.97)continue;
      let m=markerNodes.get(e.id);
      if(!m){const el=document.createElement('div');el.className='enemy-mark';el.innerHTML='<span></span><small></small><i><em></em></i>';el.dataset.kind=e.kind;$('enemy-marks').append(el);m={el,seen:true};markerNodes.set(e.id,m)}
      m.seen=true;const x=Math.round((1+projected.x)*innerWidth/2),y=Math.round((1-projected.y)*innerHeight/2);
      m.el.style.transform='translate3d('+x+'px,'+y+'px,0) translate(-50%,-100%)';
      text(m.el.firstChild,e.name);text(m.el.children[1],e.attackName|| (e.vulnerable?'弱点':e.shield>0?'◆':''));
      m.el.classList.toggle('charging',e.charging>.02);m.el.classList.toggle('shielded',e.shield>0);
      bar(m.el.lastElementChild.firstChild,fraction(e.shield>0?e.shield:e.health,e.shield>0?e.maxShield:e.maxHealth));
    }
    for(const [id,m] of markerNodes)if(!m.seen){m.el.remove();markerNodes.delete(id)}
  }
  function statusCounters(s){
    bar($('shield-fill'),fraction(s.shield,s.shieldMax));bar($('health-fill'),fraction(s.health,100));
    text($('health-value'),Math.ceil(s.health));text($('shield-value'),Math.ceil(s.shield));
    if(mode==='combat')text($('battle-count'),'第 '+s.wave+' / '+s.waves+' 波　·　已清除 '+s.kills+' / '+s.total);
  }
  function update(dt,moving){
    if(mode==='landing'||paused||mode==='result')return;
    gameTime+=dt;if(holding)fire(centerFire);
    encounter.update(dt);const s=encounter.getState(),boss=s.enemies.find(f=>f.bossPhase>0);
    presence.update(dt,boss,camera,env.reduced.matches);
    instrument.update(dt,gameTime,s.weaponHeat,moving,aimPoint.x,aimPoint.y,env.reduced.matches,focus);
    announcement=Math.max(0,announcement-dt);hitTime=Math.max(0,hitTime-dt);hurtTime=Math.max(0,hurtTime-dt);
    if(tipTime>0&&(tipTime-=dt)<=0)$('field-tip').hidden=true;
    $('wave-flash').classList.toggle('show',announcement>0);aim.classList.toggle('hit',hitTime>0);
    if(hurtTime>0||!$('hit-direction').hidden){$('damage-edge').style.opacity=String(hurtTime*(env.reduced.matches?.55:1.5));$('hit-direction').hidden=hurtTime<=0}
    if(damageTime>0&&(damageTime-=dt)<=0)flushDamage();
    if(finished){if((resultWait-=dt)<=0){mode='result';ops.result()}return}
    if((hudTime-=dt)>0)return;hudTime=.045;
    if(mode==='travel'){updateRoute();if(mode!=='travel')return}
    if(mode==='combat'&&camera.position.distanceTo(origin)>87){startRoute(campaign.tracked,site===campaign.tracked?veteran:campaign.trackedElite);env.notice('已脱离交火区域 · 检查点保留');return}
    markers(s.enemies);
    const cue=$('threat-cue');cue.hidden=mode!=='combat'||!!boss||!s.attackName;
    if(!cue.hidden){text(cue.firstChild,s.attackName);text(cue.lastChild,s.hint)}
    $('boss-hud').hidden=!boss;
    if(boss){text($('boss-name'),boss.name);text($('boss-phase'),'相位 '+boss.bossPhase+' / 3');text($('boss-order'),s.hint||site.intel);bar(document.querySelector('.boss-meter i'),fraction(boss.health+boss.shield,boss.maxHealth+boss.maxShield))}
    text($('heading-value'),number(bearing())+'°');
    statusCounters(s);bar($('heat-fill'),fraction(s.weaponHeat,100));
    text($('weapon-state'),s.overheated?'过热 · 冷却中':s.weaponHeat>4?'热量 '+Math.round(s.weaponHeat)+'%':'冷却就绪');
    for(const [id,b] of skillNodes){
      const access=campaign.gear(id),cool=id==='dash'?env.dashCooldown():s.skillCooldowns[id]||0;b.disabled=!access||cool>.01;
      text(b.lastChild,!access?'未解锁':cool>.01?cool.toFixed(1):id==='ward'&&s.wardTime>0?'生效':'就绪');
    }
    if(mode==='combat'){
      document.querySelectorAll('.wave-track i').forEach((n,i)=>{n.classList.toggle('done',i+1<s.wave);n.classList.toggle('on',i+1===s.wave)});
    }
  }
  function canAct(){return !paused&&!finished&&(mode==='combat'||mode==='travel')}
  canvas.oncontextmenu=e=>e.preventDefault();
  canvas.onpointerdown=e=>{
    if(!canAct())return;canvas.focus({preventScroll:true});
    if(e.pointerType==='mouse'){mouseId=e.pointerId;if(document.pointerLockElement!==canvas)canvas.setPointerCapture(e.pointerId);return}
    canvas.setPointerCapture(e.pointerId);rotating={id:e.pointerId,x:e.clientX,y:e.clientY,motion:0,touch:true};
  };
  canvas.onmousedown=e=>{
    if(!canAct()||e.sourceCapabilities?.firesTouchEvents)return;
    if(e.button===2){focusing(true);centerFire=true;center();rotating={id:mouseId,x:e.clientX,y:e.clientY,touch:false,motion:0}}
    if(e.button===0){holding=true;centerFire=focus||document.pointerLockElement===canvas;if(!centerFire)pointAt(e);fire(centerFire)}
  };
  document.addEventListener('mouseup',e=>{if(e.button===0)holding=false;if(e.button===2){focusing(false);centerFire=document.pointerLockElement===canvas;if(!rotating?.touch)rotating=null}});
  canvas.onpointermove=e=>{
    if(!canAct())return;if(document.pointerLockElement===canvas){env.turn(e.movementX,e.movementY);center();return}
    if(rotating?.id===e.pointerId){const dx=e.clientX-rotating.x,dy=e.clientY-rotating.y;rotating.motion+=Math.hypot(dx,dy);rotating.x=e.clientX;rotating.y=e.clientY;env.turn(dx,dy);center()}
    else if(e.pointerType!=='touch')pointAt(e);
  };
  canvas.onpointerup=e=>{if(rotating?.touch&&rotating.id===e.pointerId){if(rotating.motion<8&&canAct()){pointAt(e);fire();center()}rotating=null}};
  canvas.onpointercancel=()=>clearInput();
  document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===canvas){hadLock=true;center()}else if(hadLock){hadLock=false;if(canAct())ops.pause()}});
  function keyDown(e){
    if(e.altKey||e.ctrlKey||e.metaKey)return false;
    if(ops.open){if(e.code==='KeyM'&&!e.repeat&&ops.page==='map'){e.preventDefault();ops.back()}return true}
    if(mode==='landing')return false;
    const callbacks={Escape:()=>ops.pause(),KeyP:()=>ops.pause(),KeyM:()=>ops.map('field'),KeyL:togglePointer,KeyF:()=>cast('pulse'),KeyR:()=>cast('ward'),KeyC:()=>cast('arc'),ShiftLeft:()=>cast('dash'),ShiftRight:()=>cast('dash'),Digit1:()=>equip('carbine'),Digit2:()=>equip('scatter'),Digit3:()=>equip('lance'),Digit4:()=>equip('orbit')};
    if(e.code==='Space'){e.preventDefault();if(!e.repeat&&canAct()){holding=centerFire=true;fire(true)}return true}
    const action=callbacks[e.code];if(action){e.preventDefault();if(!e.repeat&&canAct())action();return true}return false;
  }
  document.addEventListener('keyup',e=>{if(e.code==='Space'){holding=false;centerFire=false}});
  window.addEventListener('blur',()=>{if(canAct())ops.pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&canAct())ops.pause()});
  const touch=$('touch-fire');touch.onpointerdown=e=>{if(!canAct())return;touch.setPointerCapture(e.pointerId);touchAim={x:e.clientX,y:e.clientY};holding=centerFire=true;fire(true)};
  touch.onpointermove=e=>{if(touchAim&&holding){env.turn(e.clientX-touchAim.x,e.clientY-touchAim.y);touchAim={x:e.clientX,y:e.clientY}}};
  touch.onpointerup=touch.onlostpointercapture=touch.onpointercancel=()=>{touchAim=null;holding=centerFire=false};
  fieldButton($('battle-pause'),()=>{if(canAct())ops.pause()});fieldButton($('battle-map'),()=>{if(canAct())ops.map('field')});
  fieldButton($('cycle-weapon'),cycleWeapon);$('battle-start').onclick=()=>deploy(campaign.tracked,false,undefined,campaign.trackedElite);$('landing-map').onclick=()=>ops.map('landing');
  $('landing-settings').onclick=()=>ops.settings('landing');
  updateLanding();
  return {update,keyDown,get active(){return mode!=='landing'},get paused(){return paused||mode==='result'},get site(){return site.id},get travelling(){return mode==='travel'}};
}
