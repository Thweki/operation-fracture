import {machineFactory} from './combat-models.js';
import {encounterEffects} from './combat-effects.js';
import {encounterCollision} from './combat-collision.js';
import {blueprints,sites,campaignWaves,tune,skillMax,attackFor} from './combat-rules.js';
import {WEAPONS} from './armory.js';
import {buildOrbitalDiscs} from './orbital-discs.js';
const pulseMax=skillMax.pulse,shieldMax=75;

export function createEncounter(T,scene,camera,{heightAt=()=>-100,solids=[],collision,onEvent=()=>{},getMuzzle,lightPool,
  reduceMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')}={}) {
  const group=new T.Group();group.name='Meridian defense encounter';group.visible=false;scene.add(group);
  let seed=5149;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const make=machineFactory(T), fx=encounterEffects(T,group,random,lightPool),walls=collision??encounterCollision(T,solids,heightAt);
  // Keep each wave's maximum simultaneous population resident. Their materials
  // can link while the garden opens and survive a defeat or a replay.
  const reserves={};
  function prepare(formation){
    for(const kind of new Set(formation.flat())){
      const pool=reserves[kind]??=[];
      const count=Math.max(...formation.map(entries=>entries.filter(entry=>entry===kind).length));
      while(pool.length<count){
        const model=make(kind);model.group.visible=false;pool.push(model);group.add(model.group);
      }
    }
  }
  prepare([...sites.garden.waves,...sites.north.waves]);
  const V=()=>new T.Vector3(),anchor=V(),forward=V(),right=V(),up=new T.Vector3(0,1,0),eye=V();
  const previousEye=V(),eyeVelocity=V(),measuredVelocity=V();
  const foothold=V();let heldPosition=0,fieldClock=0,fieldWarning=0;
  const enemies=[],bolts=[],pending=[],charges=[],strikes=[];
  const fireRay=new T.Ray(),hitPoint=V(),look=V(),tracking={enemy:null,distance:0},sphere=new T.Sphere(),color=new T.Color();
  let phase='idle',wave=0,kills=0,health=100,shield=shieldMax,elapsed=0,weaponHeat=0;
  let overheated=false,lastShot=-9,lastHurt=-9,nextWaveIn=0,checkVision=0,spawnRetry=0;
  let site='north',rank=0,waves=sites.north.waves,total=9,roster=blueprints,weaponId='carbine',wardTime=0;
  let veteran=false,staged=false,deployed=0,waveAge=0,sortieTime=0,reinforcementHint=0;
  const cooldowns={pulse:0,ward:0,arc:0};
  let target=null,nextId=1;
  const quiet=()=>typeof reduceMotion==='boolean'?reduceMotion:!!reduceMotion?.matches;
  const discs=buildOrbitalDiscs(T,group,walls,fx,hurtEnemy,event);
  function event(type,details={}){onEvent({type,...details});}
  function readEye(){camera.updateWorldMatrix(true,false);camera.getWorldPosition(eye);}
  function releaseEnemies(){
    for(const e of enemies)returnModel(e);
    enemies.length=bolts.length=pending.length=charges.length=strikes.length=0;discs.clear();target=null;
  }
  function returnModel(e){e.model.group.visible=false;reserves[e.kind].push(e.model);}
  function stop(){
    const wasActive=phase!=='idle';releaseEnemies();fx.clear();fx.restoreLights();phase='idle';group.visible=false;
    if(wasActive)event('stop');
  }
  function descriptor(e) {
    return {id:e.id,name:e.def.name,kind:e.kind,position:e.p,radius:e.radius,visible:e.visible,
      health:e.hp,maxHealth:e.def.hp,shield:e.shield,maxShield:e.def.shield,
      charging:e.wind>0?Math.min(1,e.wind/e.attack.wind):0,bossPhase:e.phase,attackName:e.wind>0?e.attack.name:'',
      vulnerable:e.open>0,supporting:e.wind>0&&e.attack.id==='mend',protectedBy:e.cover?.shield>0&&e.cover.hp>0?e.cover.id:null};
  }
  function getState(){
    const boss=enemies.find(e=>e.def.boss),threat=(boss?.wind>0?boss:null)??enemies.find(e=>e.wind>0&&e.visible);
    const hint=fieldWarning>0?'阵地锁定，移出脚边的光圈或立即开启护壁。':boss?.open>0?'核心暴露，集中射击。':threat?.attack.hint??(reinforcementHint>0?'侧翼出现增援，留意新的火力方向。':sites[site].hint);
    return {phase,site,rank,wave,waves:waves.length,waveName:sites[site].names[wave-1]??'',kills,total,remaining:enemies.length+pending.length,
      health,shield,shieldMax,weaponHeat,overheated,pulseCooldown:cooldowns.pulse,pulseMax,elapsed,nextWaveIn,
      weaponId,veteran,reinforcements:pending.length,skillCooldowns:{...cooldowns},skillMax,wardTime,bossPhase:boss?.phase??0,hint,attackName:fieldWarning>0?'阵地锁定':threat?.attack.name??'',
      target:target&&enemies.includes(target)?descriptor(target):null,enemies:enemies.map(descriptor)};
  }
  function choosePosition(def,lane,base=anchor) {
    const s=lane%2===1?-1:1,baseRange=(lane===0?14:lane===1?19:lane===2?22:staged?24+lane%3*2.3:17)+(def.boss?4:0);
    const radius=def.r*def.scale,p=V(), check=V();
    for(let i=0;i<52;i++){
      // The first enemy is placed at the sight line used to enter the arena.
      const spread=i===0?(lane===0?0:lane===1?-.39:lane===2?.44:s*(.64+.15*(lane%3))):
        i>=40?(i-40)*Math.PI/6:s*((i%2?1:-1)*(.23+((i*17)%39)/37)+(lane===0?0:s*.22));
      const distance=i===0?baseRange:Math.max(5.2,baseRange-(i%8)*1.34);
      p.copy(base).addScaledVector(forward,Math.cos(spread)*distance).addScaledVector(right,Math.sin(spread)*distance);
      const offset=lane===0&&i===0?0:.35+((lane*5+i*3)%8)*.42;
      p.y=Math.max(base.y+offset,heightAt(p.x,p.z)+radius+1.05);
      if(enemies.some(e=>e.p.distanceToSquared(p)<(e.radius+radius+1.0)**2))continue;
      if(!walls.clear(eye,p,.14))continue;
      let free=true;
      for(const direction of [right,forward,up]){
        check.copy(p).addScaledVector(direction,radius*.82);
        if(!walls.clear(p,check,.12)){free=false;break;}
        check.copy(p).addScaledVector(direction,-radius*.82);
        if(!walls.clear(p,check,.12)){free=false;break;}
      }
      if(free)return p.clone();
    }
    return null;
  }
  function spawn(entry){
    const {kind,lane}=entry,d=roster[kind];
    const p=choosePosition(d,lane)??(eye.distanceToSquared(anchor)>1?choosePosition(d,lane,eye):null);
    if(!p)return false;
    const model=reserves[kind].pop();
    model.group.visible=true;model.lightMat.color.setHex(0xffd8b0);
    if(model.shield){model.shield.visible=true;model.shield.material.uniforms.hit.value=0;}
    model.group.position.copy(p);
    if(staged&&lane>=2){
      const entryPoint=p.clone().addScaledVector(right,lane%2?-3.8:3.8).addScaledVector(up,.8);
      if(entryPoint.y>heightAt(entryPoint.x,entryPoint.z)+d.r*d.scale&&walls.clear(p,entryPoint,.35)&&walls.clear(eye,entryPoint))
        model.group.position.copy(entryPoint);
    }
    model.group.scale.setScalar(d.scale);model.group.lookAt(eye);
    model.group.rotateY(lane===1?-.28:.26);model.group.rotateX(-.10);
    model.group.name=d.name;
    const e={kind,lane,id:nextId++,def:d,model,p:model.group.position,home:p.clone(),radius:d.r*d.scale,
      hp:d.hp,shield:d.shield,visible:true,age:0,seed:random()*7,lastDamage:-10,
      wind:0,aim:eye.clone(),wait:staged?lane===0?.08:.74+(lane%3)*.48:(1.15+lane*1.02+(wave===1?.75:0))*(1-.07*rank),
      flash:0,kick:1,stunned:0,pathTime:0,cover:null,coverTime:0,
      charge:{p:V(),amount:0},cycles:0,phase:d.boss?1:0,open:0,interrupt:0,lineWait:0,marked:false,attack:null,zones:[]};
    enemies.push(e);fx.wave(p,e.radius*1.55,'#e7d192',.55,false);
    fx.burst(p,'#e1c88e',12,2.9);
    if(d.boss&&site==='north')fx.crown(p,forward,right,e.radius,quiet());
    return true;
  }
  function trySpawns(){
    const first=site==='garden'&&wave===1?1:2,was=deployed;
    let available=pending.length;
    // A scout crosses the route first. Its escorts arrive after the crossing,
    // so a single pulse at first contact cannot erase the entire intercept.
    if(site==='patrol'){
      if(deployed&&waveAge<1.6)return;
      if(!deployed)available=1;
    }
    if(staged){
      const boss=enemies.find(e=>e.def.boss);
      const total=waves[wave-1].length;
      // Reserve escorts for each core shift. If the core falls first, surviving
      // reinforcements arrive immediately and can still contest the sector.
      const budget=boss?.phase===1?Math.min(3,total):boss?.phase===2?Math.min(5,total):total;
      const casualty=enemies.length<first||enemies.some(e=>e.hp<e.def.hp*.68);
      if(!deployed)available=first;
      else if(enemies.length&&(waveAge<sortieTime&&!casualty||enemies.length>=(veteran||waveAge>=sortieTime?3:2)))return;
      else available=Math.max(0,Math.min(2,budget-deployed,(veteran?5:4)-enemies.length));
    }
    for(let i=0;i<pending.length&&available>0;){
      if(spawn(pending[i])){pending.splice(i,1);deployed++;available--;}else i++;
    }
    if(was&&deployed>was&&(staged||site==='patrol')){
      sortieTime=waveAge+4.7;reinforcementHint=2.15;
      event('reinforcement',{site,wave,veteran,count:deployed-was,reserve:pending.length});
    }
  }
  function beginWave(){
    phase='active';wave++;nextWaveIn=0;spawnRetry=0;
    waveAge=deployed=reinforcementHint=0;sortieTime=site==='garden'&&wave===1?3.0:4.7;
    foothold.copy(eye);heldPosition=0;fieldClock=rank>=3?1.75:2.8;fieldWarning=0;
    fx.relay('open',wave,wave===3?1.15:.83,quiet());
    waves[wave-1].forEach((kind,lane)=>pending.push({kind,lane}));
    trySpawns();event('wave',{site,rank,veteran,wave,name:sites[site].names[wave-1],count:waves[wave-1].length,boss:waves[wave-1].some(k=>blueprints[k].boss)});
  }
  function start(options={}){
    site=Object.hasOwn(sites,options.site)?options.site:'north';
    rank=T.MathUtils.clamp(Math.floor(Number(options.rank)||0),0,4);
    staged=site!=='north'&&site!=='patrol';veteran=staged&&options.veteran===true;
    waves=campaignWaves(site,rank,veteran);total=waves.reduce((n,w)=>n+w.length,0);
    roster=Object.fromEntries(Object.entries(blueprints).map(([k,d])=>[k,tune(d,rank)]));
    releaseEnemies();prepare(waves);fx.borrowLights();fx.clear();seed=5149+rank*71;nextId=1;
    wave=T.MathUtils.clamp(Math.floor(Number(options.fromWave)||1),1,waves.length)-1;
    kills=waves.slice(0,wave).reduce((n,list)=>n+list.length,0);
    elapsed=weaponHeat=wardTime=cooldowns.pulse=cooldowns.arc=cooldowns.ward=0;
    overheated=false;health=100;shield=shieldMax;lastShot=lastHurt=-9;checkVision=0;nextWaveIn=0;
    readEye();anchor.copy(eye);previousEye.copy(eye);eyeVelocity.set(0,0,0);camera.getWorldDirection(forward);forward.y=0;
    if(forward.lengthSq()<.0001)forward.set(0,0,-1);forward.normalize();right.crossVectors(forward,up).normalize();
    fx.placeCourt(anchor.clone().addScaledVector(forward,16),heightAt);
    if(!collision)walls.rebuild(anchor);
    group.visible=true;event('start',{site,rank,veteran,fromWave:wave+1});beginWave();refreshTarget();return getState();
  }
  function travel(){
    releaseEnemies();fx.borrowLights();fx.clear();group.visible=true;phase='travel';wave=kills=total=0;veteran=false;
    nextWaveIn=fieldWarning=0;if(health<=0){health=100;shield=shieldMax;}
    readEye();previousEye.copy(eye);eyeVelocity.set(0,0,0);if(!collision)walls.rebuild(eye);return getState();
  }
  function equip(id){
    if(!Object.hasOwn(WEAPONS,id))return false;
    if(weaponId!==id){weaponId=id;event('equip',{weaponId:id});}
    return true;
  }
  function aimAt(origin,dir,max,exact,result={},exclude=null){
    fireRay.set(origin,dir);let best=max,selected=null;
    for(const e of enemies){
      if(e===exclude||!exact&&!e.visible)continue;
      // Shield volumes are larger. After a break the visible machine core is
      // still a generous target, particularly when it's strafing across the eye.
      sphere.center.copy(e.p);sphere.radius=e.radius*(e.shield>0?.99:e.def.boss?.74:.84);
      if(!fireRay.intersectSphere(sphere,hitPoint))continue;
      const t=origin.distanceTo(hitPoint);if(t<best){best=t;selected=e;}
    }
    result.enemy=selected;result.distance=best;return result;
  }
  function refreshTarget(){camera.getWorldDirection(look);target=aimAt(eye,look,85,false,tracking).enemy;}
  function completeWave(){
    if(phase!=='active'||enemies.length||pending.length)return;
    bolts.length=strikes.length=0;target=null;fieldWarning=0;
    if(wave===waves.length){phase='won';fx.relay('release',wave,1.36,quiet());event('win',{site,rank,veteran,wave,kills,elapsed});}
    else {phase='intermission';nextWaveIn=2.15;fx.relay('gather',wave+1,nextWaveIn,quiet());
      event('intermission',{wave,nextWave:wave+1,duration:nextWaveIn});}
  }
  function interrupt(e,reason){
    if(e.wind<=0)return false;
    e.wind=0;e.stunned=Math.max(e.stunned,e.def.boss?1.38:.96);e.open=Math.max(e.open,e.def.boss?1.85:1.12);
    e.wait=Math.max(e.wait,.7);e.interrupt=0;
    cancelMarks(e);
    fx.wave(e.p,e.radius*1.33,'#9fe9e4',.36,false);
    event('interrupt',{...descriptor(e),reason,position:e.p.clone()});return true;
  }
  function hurtEnemy(e,amount,source,impact=e.p){
    if(!enemies.includes(e))return;
    if(staged&&e.def.boss&&e.open<=0){
      // The faceplate can always be chipped. A shot passing through the optic
      // reaches the core even during its armoured portions of the cycle.
      const precise=source!=='pulse'&&source!=='arc'&&
        fireRay.set(eye,look.subVectors(impact,eye).normalize()).distanceSqToPoint(e.p)<(e.radius*.26)**2;
      amount*=precise?.88:.53;
    }
    const protector=e.cover;
    if(protector&&protector.shield>0&&enemies.includes(protector)&&source!=='arc'&&source!=='pulse'){
      const shared=Math.min(protector.shield,Math.round(amount*.42));
      protector.shield-=shared;protector.lastDamage=elapsed;protector.flash=.6;amount-=shared;
      fx.beam(protector.p,e.p,'#8edbd1',.043,.24);
      if(protector.shield===0){
        protector.open=1.24;protector.stunned=.58;
        fx.wave(protector.p,protector.radius*1.45,'#aff6ea',.4,false);
        event('shieldBreak',{side:'enemy',...descriptor(protector)});
      }
    }
    amount=Math.round(amount*(e.open>0?1.55:1));
    if(source==='lance'&&e.shield>0)amount+=Math.min(22,e.shield);
    if(source==='arc'&&e.shield>0)amount+=Math.min(17,e.shield);
    const shielded=e.shield>0,absorbed=Math.min(e.shield,amount);
    e.shield-=absorbed;e.hp=Math.max(0,e.hp-(amount-absorbed));e.flash=1;e.lastDamage=elapsed;
    const side=(impact.x-e.p.x)*right.x+(impact.z-e.p.z)*right.z;
    e.kick=Math.abs(side)>.045?Math.sign(side):-e.kick;
    const hue=shielded?'#8beddf':'#ffc681';
    fx.burst(impact,hue,source==='pulse'?12:9,3.3,shielded?0:2);
    event('hit',{...descriptor(e),position:impact.clone(),source,damage:amount,shielded});
    if(e.wind>0){
      e.interrupt+=amount;
      if(source==='arc'||source==='pulse'&&(site==='north'||e.p.distanceToSquared(eye)<18**2)||
        (e.attack.id==='mend'||e.attack.id==='clamp'||e.attack.id==='lance'||e.attack.id==='split')&&e.interrupt>=(e.def.boss?68:40))
        interrupt(e,source);
    }
    if(shielded&&e.shield===0){
      fx.wave(e.p,e.radius*1.65,'#b2f8eb',.43,false);fx.burst(e.p,'#b5fff0',25,6.7);
      e.wind=0;cancelMarks(e);e.stunned=Math.max(e.stunned,.78);event('shieldBreak',{side:'enemy',...descriptor(e)});
    }
    if(e.hp>0){
      if(e.def.boss){
        const phaseAfter=e.hp/e.def.hp<=.33?3:e.hp/e.def.hp<=.69?2:1;
        if(phaseAfter>e.phase){
          cancelMarks(e);
          e.phase=phaseAfter;e.cycles=0;e.wind=0;e.wait=.16;e.marked=false;e.stunned=Math.min(e.stunned,.15);
          if(staged){reposition(e);sortieTime=waveAge;spawnRetry=0;}
          if(site==='north')fx.crown(e.p,forward,right,e.radius,quiet());
          event('bossPhase',{...descriptor(e),position:e.p.clone()});
        }
      }
      return;
    }
    const i=enemies.indexOf(e);enemies.splice(i,1);if(target===e)target=null;
    cancelMarks(e);
    returnModel(e);kills++;
    fx.burst(e.p,'#ffd196',e.def.boss?92:42,e.def.boss?13:8,e.def.boss?34:15);
    fx.wave(e.p,e.radius*(e.def.boss?3.6:2.3),'#f3b66d',.57,false);
    event('kill',{...descriptor(e),kills,total,source,position:e.p.clone()});completeWave();
  }
  function fire(direction,muzzleWorldPosition){
    const weapon=WEAPONS[weaponId];
    if(phase!=='active'&&phase!=='travel'||overheated||elapsed-lastShot+1e-7<weapon.interval)return false;
    readEye();const dir=(direction?.isVector3?direction.clone():camera.getWorldDirection(V()));
    if(dir.lengthSq()<.001)return false;dir.normalize();lastShot=elapsed;
    weaponHeat=Math.min(100,weaponHeat+weapon.heat);
    camera.getWorldDirection(look);sideDir.crossVectors(look,up).normalize();
    const muzzle=(muzzleWorldPosition??getMuzzle?.())?.clone?.()??
      eye.clone().addScaledVector(dir,.65).addScaledVector(sideDir,.27).addScaledVector(up,-.22);
    if(weaponId==='orbit'){
      discs.launch(muzzle,eye,dir);
      fx.flash(muzzle,weapon.color,11,.14);fx.particle(muzzle,V(),weapon.color,.55,.13);
      event('fire',{weaponId,position:muzzle,direction:dir,hit:false});
      if(weaponHeat>=100){overheated=true;event('overheat')}
      return true;
    }
    const struck=new Map(),side=V().crossVectors(dir,up);
    if(side.lengthSq()<1e-6)side.set(1,0,0);else side.normalize();
    const rise=V().crossVectors(side,dir).normalize(),rayDir=V(),end=V(),muzzleDir=V();
    let firstEnd=null;
    function register(pick,amount){
      if(!pick.enemy)return;
      const previous=struck.get(pick.enemy);
      if(previous)previous.amount+=amount;
      else struck.set(pick.enemy,{amount,point:eye.clone().addScaledVector(rayDir,pick.distance)});
    }
    for(let pellet=0;pellet<weapon.pellets;pellet++){
      rayDir.copy(dir);
      if(pellet){
        const angle=pellet*2.39996+elapsed*1.14,spread=.078*Math.sqrt(pellet/(weapon.pellets-1));
        rayDir.addScaledVector(side,spread*Math.cos(angle)).addScaledVector(rise,spread*Math.sin(angle)).normalize();
      }
      const range=walls.hit(eye,rayDir,weapon.range),first=aimAt(eye,rayDir,range,true);
      const second=weapon.pierce>1&&first.enemy?aimAt(eye,rayDir,range,true,{},first.enemy):null;
      const distance=second?.enemy?second.distance:first.distance;
      end.copy(eye).addScaledVector(rayDir,distance);
      const muzzleLength=muzzleDir.subVectors(end,muzzle).length();muzzleDir.normalize();
      const available=walls.hit(muzzle,muzzleDir,muzzleLength);
      if(available<muzzleLength-.12)end.copy(muzzle).addScaledVector(muzzleDir,available);
      const clearTo=d=>available>=muzzleLength-.12||d<eye.distanceTo(end)-.1;
      if(first.enemy&&clearTo(first.distance)){
        const falloff=weaponId==='scatter'?1-.62*T.MathUtils.smoothstep(first.distance,weapon.fullRange,27):1;
        register(first,weapon.damage*falloff);
      }
      if(second?.enemy&&clearTo(second.distance))register(second,weapon.damage*.81);
      if(pellet===0)firstEnd=end.clone();
      fx.beam(muzzle,end,weapon.color,weaponId==='scatter'?.016:weaponId==='lance'?.066:.035,weaponId==='lance'?.19:.119);
      if(weaponId!=='scatter')fx.beam(muzzle,muzzleDir.copy(muzzle).lerp(end,.74),'#fff8e5',weaponId==='lance'?.038:.021,.089);
      if(!first.enemy&&distance<weapon.range-.03&&pellet<2)fx.burst(end,weapon.color,4,1.85);
    }
    fx.flash(muzzle,weapon.color,weaponId==='lance'?18:8,.11);fx.particle(muzzle,V(),weapon.color,.68,.12);
    event('fire',{weaponId,position:muzzle,end:firstEnd,direction:dir,hit:struck.size>0});
    for(const [e,hit] of struck)hurtEnemy(e,hit.amount,weaponId,hit.point);
    if(weaponHeat>=100){overheated=true;event('overheat');}
    return true;
  }
  function pulseEffect(){
    const center=eye.clone().addScaledVector(up,-.88);
    fx.wave(center,27,'#a0f7eb',.82,true);fx.wave(center,23,'#f7e8b1',.66,true);
    for(let j=0;j<62;j++){
      const a=random()*Math.PI*2, r=9+random()*17;
      fx.particle(center,V().set(Math.cos(a)*r,(random()-.33)*5,Math.sin(a)*r),'#a1f6e4',.27,.46+random()*.37);
    }
    fx.flash(center,'#a0ffee',60,.25);event('pulse',{position:center.clone(),radius:27});
    for(let i=bolts.length-1;i>=0;i--)if(bolts[i].p.distanceTo(eye)<27&&walls.clear(eye,bolts[i].p))bolts.splice(i,1);
    for(const e of [...enemies]){
      const distance=e.p.distanceTo(eye);
      if(distance>27+e.radius||!walls.clear(eye,e.p))continue;
      const damage=site==='north'?Math.round(67-15*Math.min(1,distance/27)):Math.round(58-46*T.MathUtils.smoothstep(distance,5,24));
      hurtEnemy(e,damage,'pulse');
      if(site==='north'||distance<18){
        e.wind=0;e.wait=Math.max(e.wait,e.def.boss?.52:1.12);e.stunned=Math.max(e.stunned,e.def.boss?.38:1.35);
      }
    }
    return true;
  }
  function cast(id){
    if(!Object.hasOwn(skillMax,id)||phase!=='active'&&phase!=='travel'||cooldowns[id]>.0001)return false;
    readEye();cooldowns[id]=skillMax[id];event('skill',{skillId:id,position:eye.clone()});
    if(id==='pulse')return pulseEffect();
    if(id==='ward'){
      wardTime=3.0;shield=Math.min(shieldMax,shield+22);
      const base=eye.clone().addScaledVector(up,-1.25);
      fx.wave(base,3.9,'#a7e9f2',.54,true);fx.flash(base,'#8ddfea',12,.28);
      return true;
    }
    const used=new Set(),from=eye.clone(),end=V(),mid=V(),axis=V();
    const amounts=[64,46,33,24];
    camera.getWorldDirection(axis);
    for(let i=0;i<4;i++){
      let chosen=null,best=Infinity;
      for(const e of enemies){
        if(used.has(e))continue;
        const d=from.distanceTo(e.p);
        if(d>(i?14:36)||!walls.clear(from,e.p))continue;
        const score=d*(i?1:1-.69*end.subVectors(e.p,eye).normalize().dot(axis));
        if(score<best){best=score;chosen=e;}
      }
      if(!chosen&&i)break;
      if(chosen)end.copy(chosen.p);else{
        const d=walls.hit(eye,axis,12);end.copy(eye).addScaledVector(axis,d);
      }
      mid.copy(from).lerp(end,.52).addScaledVector(up,.2+.21*i);
      fx.beam(from,mid,'#b8a4ff',.052,.23);fx.beam(mid,end,'#a9edff',.045,.22);
      if(!chosen)break;
      used.add(chosen);from.copy(chosen.p);hurtEnemy(chosen,amounts[i],'arc');
    }
    return true;
  }
  const pulse=()=>cast('pulse');
  function hurtPlayer(amount,p,source){
    if(phase!=='active')return;
    if(wardTime>0)amount=Math.max(1,Math.round(amount*.18));
    const wasShielded=shield>0,absorbed=Math.min(amount,shield);
    shield-=absorbed;health=Math.max(0,health-(amount-absorbed));lastHurt=elapsed;
    event('hurt',{damage:amount,shielded:wasShielded,health,shield,position:p.clone(),source});
    if(wasShielded&&shield===0)event('shieldBreak',{side:'player',position:eye.clone()});
    if(health===0){phase='lost';bolts.length=0;event('lose',{site,rank,veteran,wave,kills,elapsed});}
  }
  const zoneAttack=id=>id==='mortar'||id==='forge'||id==='clamp'||id==='echo';
  function cancelMarks(e){for(const z of e.zones)z.cancel();e.zones.length=0;}
  function markZones(e){
    const id=e.attack.id,count=id==='forge'?e.phase:id==='clamp'?(veteran?3:2):id==='echo'?2:1;
    for(let i=0;i<count;i++){
      const offset=i===0?0:id==='echo'?(e.cycles%2===0?-4.6:4.6):i===1?-4.2:4.2;
      const mark=e.aim.clone().addScaledVector(right,offset).addScaledVector(forward,i?1.7:0);
      const ground=heightAt(mark.x,mark.z)+.25,r=id==='clamp'?4.4:id==='forge'?3.65:3.2;
      const plane=mark.clone();plane.y=ground;
      const cancel=fx.warning(plane,r,id==='clamp'?'#da9ef7':'#ff9656',Math.max(.18,e.attack.wind-e.wind)+.78+i*(id==='echo'?.50:.18));
      e.zones.push({mark,plane,r,cancel});
    }
  }
  function mendTarget(e){
    let chosen=null,need=0;
    for(const ally of enemies){
      if(ally===e&&!e.def.boss||e.p.distanceToSquared(ally.p)>19*19||!walls.clear(e.p,ally.p))continue;
      const deficit=ally.def.shield-ally.shield+ally.def.hp-ally.hp;
      if(deficit>need){need=deficit;chosen=ally;}
    }
    return chosen;
  }
  function launch(e) {
    const id=e.attack.id,dir=e.aim.clone().sub(e.p).normalize();
    if(id==='mend'){
      const ally=mendTarget(e);
      if(ally){
        const strength=e.def.boss?31:20,previous=ally.shield;
        ally.shield=Math.min(ally.def.shield,ally.shield+strength);
        ally.hp=Math.min(ally.def.hp,ally.hp+Math.max(0,strength-(ally.shield-previous)));
        fx.beam(e.p,ally.p,'#8cffe6',.062,.32);fx.wave(ally.p,ally.radius*1.24,'#84d9c4',.48,false);
        event('repair',{...descriptor(e),targetId:ally.id,position:ally.p.clone()});return;
      }
      return;
    }
    if(zoneAttack(id)){
      if(!e.zones?.length)markZones(e);
      for(let i=0;i<e.zones.length&&strikes.length<9;i++){
        const z=e.zones[i],origin=z.mark.clone().addScaledVector(up,6.8).addScaledVector(forward,2.6);
        strikes.push({...z,origin,p:origin.clone(),life:.76+i*(id==='echo'?.50:.18),hue:e.def.hue,damage:e.def.damage,id});
      }
      e.zones.length=0;
      if(id==='forge'||id==='echo'&&e.def.boss)e.open=1.25+.26*e.phase;
      event('enemyFire',{...descriptor(e),attackName:e.attack.name,position:e.p.clone(),direction:dir});return;
    }
    const count=id==='sweep'?5:id==='fan'?(e.phase===3?7:5):id==='bracket'?4:id==='dash'||id==='split'?2:1;
    for(let i=0;i<count;i++){
      if(bolts.length>=34)break;
      const aimed=dir.clone().applyAxisAngle(up,id==='dash'?i*.068:(i-(count-1)/2)*(id==='fan'?.115:.086));
      const p=e.p.clone().addScaledVector(aimed,e.radius*.53);
      if(id==='bracket'||id==='split'){
        const hand=i%2?1:-1;
        p.addScaledVector(right,hand*e.radius*.70);
        aimed.copy(e.aim).addScaledVector(right,hand*(id==='split'?-1.12:i<2?-2.75:3.25)).sub(p).normalize();
      }
      bolts.push({p,dir:aimed,hue:e.def.hue,speed:e.def.speed*(id==='lance'&&e.def.boss?1.8:1),
        damage:e.def.damage,width:e.def.boss?.18:.145,life:4.5});
    }
    if(staged&&e.def.boss)e.open=Math.max(e.open,e.kind==='warden'?1.28:1.02);
    if(staged&&(e.kind==='skirmisher'||e.kind==='lancer'||veteran&&e.kind==='guard'))reposition(e);
    fx.flash(e.p,e.def.hue,16,.16);event('enemyFire',{...descriptor(e),position:e.p.clone(),direction:dir});
  }
  const candidate=V(),sideDir=V(),front=V();
  function reposition(e){
    const lateral=(e.cycles+e.lane+e.phase)%2?1:-1;
    for(const sign of [lateral,-lateral]){
      candidate.copy(e.p).addScaledVector(right,(e.def.boss?5.2:4.25)*sign);
      candidate.y=Math.max(e.p.y,heightAt(candidate.x,candidate.z)+e.radius+.85);
      if(candidate.distanceToSquared(eye)>40**2||!walls.clear(e.p,candidate,.24)||!walls.clear(eye,candidate))continue;
      e.home.copy(candidate);event('flank',{site,wave,kind:e.kind,id:e.id,position:candidate.clone()});break;
    }
  }
  function updateCover(e,dt){
    if(!staged||e.kind==='guard')return;
    e.coverTime-=dt;if(e.coverTime>0)return;
    e.coverTime=.22;e.cover=null;
    for(const guard of enemies){
      if(guard.kind!=='guard'||guard.shield<1||guard.stunned>0||guard.p.distanceToSquared(e.p)>14**2||
        !walls.clear(guard.p,e.p))continue;
      e.cover=guard;
      fx.beam(guard.p,e.p,'#81b9aa',.012,.235);break;
    }
  }
  function updateMachine(e,dt,vision){
    e.age+=dt;e.flash=Math.max(0,e.flash-dt*3.8);e.stunned=Math.max(0,e.stunned-dt);e.pathTime-=dt;
    e.open=Math.max(0,e.open-dt);e.lineWait-=dt;
    const weight=e.def.weight;
    // Launch alignment holds briefly so the first shot can be taken immediately.
    const move=T.MathUtils.smoothstep(e.age,e.lane===0?1.25:.35,2.9)*(e.stunned>0?.14:1);
    candidate.copy(e.home).addScaledVector(right,Math.sin(e.age*.78+e.seed)*2.1*weight*move)
      .addScaledVector(forward,Math.sin(e.age*.46+e.seed)*1.18*weight*move);
    candidate.y+=Math.sin(e.age*1.1+e.seed)*.69*weight*move;
    if(e.kind==='skirmisher')candidate.addScaledVector(right,Math.tanh(Math.sin(e.age*1.38+e.seed)*4.0)*1.62*move);
    if(e.kind==='lancer')candidate.y+=1.45*move;
    candidate.y=Math.max(candidate.y,heightAt(candidate.x,candidate.z)+e.radius+.6);
    if(e.pathTime<=0&&(e.p.distanceTo(eye)>(staged?39:31)||!e.visible)){
      e.pathTime=1.1;
      const next=choosePosition(e.def,e.lane,eye);
      if(next&&walls.clear(e.p,next,.36))e.home.copy(next);
    }
    const step=candidate.lerp(e.p,Math.exp(-dt*(e.stunned>0?.68:1.75)));
    if(walls.clear(e.p,step,.2))e.p.copy(step);
    if(vision)e.visible=walls.clear(eye,e.p,.09);
    updateCover(e,dt);
    e.model.group.lookAt(eye);
    e.model.group.rotateY((e.lane===1?-1:1)*(.165+.125*Math.sin(e.age*.63+e.seed))*weight);
    e.model.group.rotateX(-.09+.06*Math.sin(e.age*.54+e.seed)-e.flash*.18);
    e.model.group.rotateZ(Math.sin(e.age*.78+e.seed)*weight*.145-e.kick*e.flash*.14);
    e.model.animate?.(dt,e.age,e.wind>0?e.wind/e.attack.wind:0,Math.max(1,e.phase),e.flash);
    if(e.def.shield&&elapsed-e.lastDamage>5.7)e.shield=Math.min(e.def.shield,e.shield+dt*6.5);
    if(e.model.shield){e.model.shield.visible=e.shield>.02;e.model.shield.material.uniforms.time.value=elapsed;
      e.model.shield.material.uniforms.hit.value=e.flash;}
    if(!e.visible||e.stunned>0){if(e.wind)cancelMarks(e);e.wind=0;e.wait=Math.max(e.wait,.42);}
    else if(e.wind>0){
      e.wind+=dt;
      const lock=e.attack.wind*(.44+.052*rank);
      if(e.wind<lock){
        e.aim.copy(eye);
        if((rank>1||veteran)&&(e.attack.id==='lance'||e.attack.id==='split'||zoneAttack(e.attack.id))){
          // An experienced sniper leads a straight strafe. Once the painted
          // line or ground mark locks, changing direction defeats the lead.
          const lead=Math.min(.68,e.p.distanceTo(eye)/e.def.speed*.58)*(rank*.25);
          e.aim.addScaledVector(eyeVelocity,lead);
        }
      }
      if(e.wind>=lock&&!e.marked){e.marked=true;if(zoneAttack(e.attack.id))markZones(e);}
      if(e.lineWait<=0){
        e.lineWait=.115;
        if(e.attack.id==='lance'||e.attack.id==='split')fx.beam(e.p,e.aim,'#bc80a6',e.marked?.019:.012,.125);
        if(e.attack.id==='mend'){
          const ally=mendTarget(e);
          if(ally&&ally!==e)fx.beam(e.p,ally.p,'#65bdab',.027,.13);
        }
      }
      front.subVectors(eye,e.p).normalize();
      e.charge.p.copy(e.p).addScaledVector(front,e.def.scale*.67);e.charge.amount=e.wind/e.attack.wind;
      e.charge.hue=e.attack.id==='mend'?'#80ffe1':e.def.hue;
      charges.push(e.charge);
      if(e.wind>=e.attack.wind){if(walls.clear(e.p,e.aim))launch(e);e.wind=0;
        e.wait=e.def.reload*(.86+random()*.23);}
    }else if((e.wait-=dt)<=0){
      e.attack=attackFor(e,e.kind==='weaver'||e.kind==='tideBoss'?!!mendTarget(e):true,veteran);
      e.cycles++;e.wind=.001;e.aim.copy(eye);e.marked=false;e.zones.length=0;e.interrupt=0;
      event('charge',{...descriptor(e),hint:e.attack.hint,position:e.p.clone(),duration:e.attack.wind});
    }
    e.model.lightMat.color.copy(color.set(e.flash>.48?'#ffffff':e.open>0?'#c5fff1':e.wind>0?e.charge.hue??e.def.hue:'#faf7ee'))
      .multiplyScalar(e.flash>.48?2.4:1.22+e.wind*1.7);
  }
  const boltEnd=V(),relative=V();
  function fieldDefense(dt){
    if(site!=='gate'&&site!=='ridge'&&!(site==='forge'&&rank>=2))return;
    if(foothold.distanceToSquared(eye)>1.15**2){foothold.copy(eye);heldPosition=0;}else heldPosition+=dt;
    fieldClock-=dt;fieldWarning=Math.max(0,fieldWarning-dt);
    if(fieldClock>0||rank<3&&heldPosition<2.15||strikes.length>6)return;
    // Late relays triangulate a stationary observer. A moving observer sees
    // the next interception point on the floor and can break their current line.
    fieldClock=rank===4?2.85:rank===3?3.45:3.85;
    fieldWarning=1.13;
    const mark=eye.clone().addScaledVector(eyeVelocity,rank===4?.48:.29);
    const plane=mark.clone(),r=rank===4?3.25:2.65;plane.y=heightAt(mark.x,mark.z)+.27;
    fx.warning(plane,r,'#ef9d69',1.13);
    if(mark.y-plane.y>2.6){const rim=mark.clone();rim.y-=1.48;fx.warning(rim,r,'#c9876f',1.13);}
    const origin=mark.clone().addScaledVector(up,9).addScaledVector(right,3.0);
    strikes.push({mark,plane,r,origin,p:origin.clone(),life:1.13,hue:'#f9a45f',damage:rank===4?38:31,id:'relay'});
    event('areaWarning',{position:plane.clone(),radius:r,duration:1.13,name:'阵地锁定'});
  }
  const descentEnd=V(),descentDirection=V();
  function advanceStrikes(dt){
    for(let i=strikes.length-1;i>=0;i--){
      const s=strikes[i];s.life-=dt;
      if(s.life>.76)continue;
      const t=T.MathUtils.clamp(1-s.life/.76,0,1);
      descentEnd.copy(s.origin).lerp(s.mark,t*t);
      const distance=descentDirection.subVectors(descentEnd,s.p).length();
      if(distance>.0001){
        descentDirection.multiplyScalar(1/distance);
        const allowed=walls.hit(s.p,descentDirection,distance);
        if(allowed<distance-.001){
          // Detonate on the exposed side of a roof or cliff. The blast still
          // requires a clear path to the player from this actual impact.
          s.mark.copy(s.p).addScaledVector(descentDirection,Math.max(0,allowed-.04));
          s.plane.copy(s.mark);descentEnd.copy(s.mark);s.life=0;
        }
      }
      s.p.copy(descentEnd);
      if(s.life>0)charges.push({p:s.p,hue:s.hue,amount:.69});
      if(s.life>0)continue;
      fx.wave(s.plane,s.r,s.hue,.47,true);fx.burst(s.mark,s.hue,17,4.2);
      const horizontal=Math.hypot(s.mark.x-eye.x,s.mark.z-eye.z);
      const impact=s.mark.clone();impact.y=Math.max(impact.y,heightAt(impact.x,impact.z)+.38);
      strikes.splice(i,1);
      if(horizontal<s.r&&Math.abs(s.mark.y-eye.y)<4.5&&walls.clear(impact,eye))hurtPlayer(s.damage,impact,s.id);
      if(phase==='lost')return;
    }
  }
  function advanceBolts(dt){
    for(let i=bolts.length-1;i>=0;i--){
      const b=bolts[i];b.life-=dt;
      if(b.life<=0){bolts.splice(i,1);continue;}
      const distance=b.speed*dt, clipped=walls.hit(b.p,b.dir,distance,.055);
      boltEnd.copy(b.p).addScaledVector(b.dir,clipped);
      const nearest=T.MathUtils.clamp(relative.subVectors(eye,b.p).dot(b.dir),0,clipped);
      const hit=sideDir.copy(b.p).addScaledVector(b.dir,nearest).distanceToSquared(eye)<(.61+b.width)**2;
      if(hit){const origin=b.p.clone();bolts.splice(i,1);hurtPlayer(b.damage,origin,'bolt');if(phase==='lost')return;}
      else if(clipped<distance-.003){fx.burst(boltEnd,b.hue,6,2.3);bolts.splice(i,1);}
      else b.p.copy(boltEnd);
    }
  }
  function step(dt){
    charges.length=0;
    if(phase==='active'||phase==='intermission'||phase==='travel'){
      elapsed+=dt;
      for(const id of ['pulse','ward','arc'])cooldowns[id]=Math.max(0,cooldowns[id]-dt);
      wardTime=Math.max(0,wardTime-dt);weaponHeat=Math.max(0,weaponHeat-dt*(overheated?38:20.5));
      if(overheated&&weaponHeat<=23){overheated=false;event('ready',{ability:'beam'});}
      if(elapsed-lastHurt>4.25)shield=Math.min(shieldMax,shield+dt*12.5);
    }
    if(phase==='intermission'){nextWaveIn=Math.max(0,nextWaveIn-dt);if(nextWaveIn===0)beginWave();}
    if(phase==='active'||phase==='travel'||phase==='intermission')discs.advance(dt,eye,enemies);
    else discs.clear();
    if(phase==='active'){
      waveAge+=dt;reinforcementHint=Math.max(0,reinforcementHint-dt);
      if(pending.length&&(spawnRetry-=dt)<=0){trySpawns();spawnRetry=.5;}
      checkVision-=dt;const vision=checkVision<=0;if(vision)checkVision=.18;
      for(const e of enemies)updateMachine(e,dt,vision);
      fieldDefense(dt);advanceBolts(dt);if(phase==='active')advanceStrikes(dt);refreshTarget();
    }
  }
  function update(dt){
    if(phase==='idle'||!Number.isFinite(dt)||dt<=0)return;
    readEye();const duration=Math.min(.3,dt);let remaining=duration;
    measuredVelocity.subVectors(eye,previousEye).multiplyScalar(1/duration).clampLength(0,13);
    eyeVelocity.lerp(measuredVelocity,1-Math.exp(-duration*9));previousEye.copy(eye);
    while(remaining>.00001){const t=Math.min(1/30,remaining);step(t);remaining-=t;}
    fx.tick(duration,bolts,charges,eye,quiet());
  }
  return {start,travel,stop,update,fire,equip,cast,pulse,getState};
}
