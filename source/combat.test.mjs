import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createEncounter} from './combat.js';
import {encounterCollision} from './combat-collision.js';
import {heightAt} from './terrain.js';
import {sectors,byId} from './campaign.js';
import {buildArchitecture} from './architecture.js';
import {buildDistricts} from './districts.js';
import {campaignWaves} from './combat-rules.js';
import {buildOrbitalDiscs} from './orbital-discs.js';

function fixture() {
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(58,1,.1,400), events=[];
  camera.position.set(6,6,-166);camera.lookAt(6,6,-139);
  const combat=createEncounter(THREE,scene,camera,{heightAt:()=>0,solids:[],onEvent:e=>events.push(e)});
  return {camera,events,combat};
}
const dt=1/30;
test('three waves, guard and warden, victory, and exact reset',()=>{
  const {combat,camera,events}=fixture();
  let s=combat.start();
  assert.equal(s.target.kind,'drone');
  assert.equal(combat.fire(),true);assert.equal(combat.fire(),false);
  assert.equal(combat.pulse(),true);assert.equal(combat.pulse(),false);
  for(let i=0;i<3600;i++){
    s=combat.getState();
    if(s.phase==='won'||s.phase==='lost')break;
    if(s.phase==='active'){
      const target=s.enemies.find(e=>e.visible);
      if(target)combat.fire(target.position.clone().sub(camera.position).normalize());
      if(s.pulseCooldown===0)combat.pulse();
    }
    combat.update(dt);
  }
  assert.equal(s.phase,'won');assert.equal(s.kills,9);
  assert.deepEqual(events.filter(e=>e.type==='wave').map(e=>e.wave),[1,2,3]);
  assert.equal(events.filter(e=>e.type==='win').length,1);
  assert.ok(events.some(e=>e.type==='shieldBreak'&&e.side==='enemy'));
  assert.equal(events.filter(e=>e.type==='kill'&&e.kind==='warden').length,1);
  s=combat.start();assert.equal(s.phase,'active');assert.equal(s.wave,1);assert.equal(s.kills,0);
  assert.equal(s.health,100);assert.equal(s.shield,75);assert.equal(s.weaponHeat,0);
  assert.equal(s.pulseCooldown,0);assert.equal(s.enemies.length,3);
  assert.equal(s.enemies[0].id,1);assert.equal(s.target.id,1);
  combat.stop();assert.equal(combat.getState().phase,'idle');
  assert.equal(combat.fire(),false);assert.equal(combat.pulse(),false);
});
test('stationary undefended observer loses, and can start a fresh session',()=>{
  const {combat,events}=fixture();combat.start();
  for(let i=0;i<3600&&combat.getState().phase==='active';i++)combat.update(dt);
  let s=combat.getState();assert.equal(s.phase,'lost');assert.equal(s.health,0);assert.equal(s.shield,0);
  assert.ok(events.some(e=>e.type==='hurt'&&e.shielded));
  assert.ok(events.some(e=>e.type==='shieldBreak'&&e.side==='player'));
  assert.equal(events.filter(e=>e.type==='lose').length,1);
  s=combat.start();assert.equal(s.phase,'active');assert.equal(s.health,100);assert.equal(s.shield,75);
});
test('thin opaque walls and terrain interrupt traces, enemy bolts can miss a sidestep',()=>{
  const wall=new THREE.Mesh(new THREE.BoxGeometry(6,9,.12),new THREE.MeshBasicMaterial());
  wall.position.set(6,4,-156);wall.updateMatrixWorld(true);
  const origin=new THREE.Vector3(6,6,-166),dir=new THREE.Vector3(0,0,1);
  const cover=encounterCollision(THREE,[wall],(x,z)=>z> -145?12:0);
  cover.rebuild(origin);
  assert.ok(Math.abs(cover.hit(origin,dir,28)-9.94)<.02);
  assert.ok(cover.hit(new THREE.Vector3(18,6,-166),dir,28)<21.1);
  assert.equal(cover.clear(origin,new THREE.Vector3(6,6,-150)),false);
  assert.equal(cover.clear(origin,new THREE.Vector3(16,6,-158)),true);
  const {combat,camera,events}=fixture();combat.start();
  while(!events.some(e=>e.type==='enemyFire'))combat.update(dt);
  camera.position.x+=5.0;
  for(let i=0;i<34;i++)combat.update(dt);
  assert.equal(combat.getState().shield,75);
});
test('the real northern shelf admits all targets, and heat and shields recover',()=>{
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),events=[];
  camera.position.set(6,heightAt(6,-166)+6,-166);camera.lookAt(6,camera.position.y,-139);
  const combat=createEncounter(THREE,scene,camera,{heightAt,onEvent:e=>events.push(e)});
  let s=combat.start();
  assert.equal(s.enemies.length,3);assert.equal(s.target.id,1);
  for(const e of s.enemies)assert.ok(e.position.y-heightAt(e.position.x,e.position.z)>e.radius);
  const zenith=new THREE.Vector3(0,1,0);
  for(let i=0;i<135&&!combat.getState().overheated;i++){combat.fire(zenith);combat.update(dt);}
  assert.ok(combat.getState().overheated);assert.equal(combat.fire(),false);
  for(let i=0;i<160&&!events.some(e=>e.type==='hurt');i++)combat.update(dt);
  assert.ok(combat.getState().shield<75);
  for(let i=0;i<245;i++){camera.position.x+=.31;combat.update(dt);}
  s=combat.getState();assert.equal(s.overheated,false);assert.equal(s.shield,75);
  assert.ok(events.some(e=>e.type==='ready'&&e.ability==='beam'));
});

test('travel allows all equipped emitters and skills without spawning an encounter',()=>{
  const {combat,events}=fixture();combat.travel();
  const direction=new THREE.Vector3(0,0,1);
  for(const id of ['carbine','scatter','lance']){
    assert.equal(combat.equip(id),true);assert.equal(combat.fire(direction),true);
    assert.equal(events.filter(e=>e.type==='fire').at(-1).weaponId,id);
    for(let i=0;i<22;i++)combat.update(dt);
  }
  for(const skill of ['ward','arc','pulse']){
    assert.equal(combat.cast(skill),true);assert.equal(combat.cast(skill),false);
    assert.ok(events.some(e=>e.type==='skill'&&e.skillId===skill));
  }
  assert.equal(combat.getState().wardTime,3);
  for(let i=0;i<405;i++)combat.update(dt);
  const s=combat.getState();assert.equal(s.phase,'travel');assert.equal(s.weaponId,'lance');
  assert.deepEqual(s.skillCooldowns,{pulse:0,ward:0,arc:0});assert.equal(s.enemies.length,0);
  assert.equal(combat.equip('unknown'),false);assert.equal(combat.cast('unknown'),false);
  combat.start({site:'garden',rank:0,fromWave:9});
  assert.equal(combat.getState().wave,2);assert.equal(combat.getState().kills,campaignWaves('garden',0,false)[0].length);
  combat.travel();assert.equal(combat.getState().remaining,0);
  const p=combat.start({site:'patrol',rank:4});assert.equal(p.waves,1);assert.equal(p.total,3);
  assert.equal(p.weaponId,'lance');
});

// Run motion, formations, aim traces and attack patterns against the same
// solid meshes and world coordinates the browser uses. Only texture painting
// is stubbed; no enemy or collision code is replaced by this fixture.
let world;
function campaignWorld(){
  if(world)return world;
  const scene=new THREE.Scene(),previous=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>({
    createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},
    beginPath(){},moveTo(){},lineTo(){},stroke(){},
  })})};
  try{buildArchitecture(THREE,scene);}finally{
    if(previous===undefined)delete globalThis.document;else globalThis.document=previous;
  }
  const solids=[];
  scene.traverse(m=>{if(m.isMesh&&m.material.isMeshStandardMaterial)solids.push(m);});
  solids.push(...buildDistricts(THREE,scene,heightAt).solids);
  const collision=encounterCollision(THREE,solids,heightAt,{extent:260});
  collision.rebuild(new THREE.Vector3(0,0,0));world={solids,collision};return world;
}
function sortie(id,rank,profile='pilot',fromWave=1,veteran=false){
  const {entry,heading}=byId[id],scene=new THREE.Scene(),c=new THREE.PerspectiveCamera();
  const eye=c.position,[x,z,h]=entry,[dx,dz]=heading,side=new THREE.Vector3(-dz,0,dx).normalize();
  eye.set(x,heightAt(x,z)+h,z);c.lookAt(x+dx,eye.y,z+dz);
  const log=[],combat=createEncounter(THREE,scene,c,{heightAt,...campaignWorld(),onEvent:e=>log.push(e)});
  combat.equip(rank>1?'lance':'carbine');combat.start({site:id,rank,fromWave,veteran});
  const mobile=profile==='pilot'||profile==='wide';
  const ray=new THREE.Vector3();let nextShot=.4,shots=0,s=combat.getState();
  for(let i=0;i<4500;i++){
    const t=i*dt;s=combat.getState();if(s.phase==='won'||s.phase==='lost')break;
    if(mobile){
      const move=profile==='wide'?Math.sin(t*1.43)*6.7:Math.sin(t*1.56)*3.7;
      eye.set(x+side.x*move,0,z+side.z*move);eye.y=heightAt(eye.x,eye.z)+h;
    }
    if(profile!=='idle'&&s.phase==='active'){
      const sorted=s.enemies.filter(e=>e.visible).sort((a,b)=>
        (a.kind==='weaver'?-3:a.bossPhase?1:0)-(b.kind==='weaver'?-3:b.bossPhase?1:0));
      const e=sorted[0];
      if(e&&t>=nextShot){
        ray.subVectors(e.position,eye).normalize();
        if((shots+1)%(mobile?4:3)===0)ray.y+=.35;
        if(combat.fire(ray.normalize())){shots++;nextShot=t+(rank>1?.61:mobile?.28:.36);}
      }
      if(e&&mobile){
        if(s.skillCooldowns.pulse===0&&(rank>1||e.charging>.15))combat.cast('pulse');
        if(rank>1&&s.skillCooldowns.arc===0)combat.cast('arc');
        if(rank>0&&s.shield<42&&s.skillCooldowns.ward===0)combat.cast('ward');
      }
    }
    combat.update(dt);
  }
  combat.stop();return {s,log};
}
test('all five authored locations support full clears at their campaign ranks',()=>{
  for(const [rank,site] of sectors.entries()){
    const {s,log}=sortie(site.id,rank);
    assert.equal(s.phase,'won',site.id+' remaining '+s.remaining);
    assert.equal(s.kills,s.total);assert.equal(s.wave,site.waves);
    assert.ok(s.elapsed>=(site.id==='garden'?18:35),site.id+' completed too quickly');
    assert.ok(s.elapsed<70,site.id+' tempo stalled');
    assert.ok(log.some(e=>e.type==='reinforcement'&&e.count>=1));
    assert.ok(log.some(e=>e.type==='flank'));
    assert.ok(log.some(e=>e.type==='enemyFire'||e.type==='charge'),site.id);
    if(['forge','tide','gate'].includes(site.id))assert.deepEqual(log.filter(e=>e.type==='bossPhase').map(e=>e.bossPhase),[2,3]);
  }
  assert.equal(sortie('tide',2).s.phase,'won');
  assert.equal(sortie('forge',1).s.phase,'won');
});
test('rank increases pressure on a stationary pilot, while active counterplay clears later waves',()=>{
  const opening=sortie('garden',0,'idle').s,final=sortie('gate',4,'idle').s;
  assert.equal(opening.phase,'lost');assert.equal(final.phase,'lost');
  assert.ok(opening.elapsed>final.elapsed*1.5);
  assert.equal(sortie('garden',0,'stationary').s.phase,'won');
  for(const [site,rank] of [['forge',2],['ridge',3],['gate',4]]){
    const still=sortie(site,rank,'stationary');
    assert.equal(still.s.phase,'lost',site);
    assert.ok(still.s.kills>0&&still.s.kills<still.s.total);
    assert.ok(still.log.some(e=>e.type==='areaWarning'));
  }
  const check=sortie('gate',4,'pilot',3);
  assert.equal(check.s.phase,'won');assert.equal(check.s.kills,check.s.total);
});
test('broken boss channels expose their core; forge opens its vents after a marked barrage',()=>{
  const {combat,camera,events}=fixture();combat.equip('lance');
  combat.start({site:'gate',rank:4,fromWave:3});
  for(let i=0;i<120&&!combat.getState().enemies[0].charging;i++)combat.update(dt);
  const boss=combat.getState().enemies[0];assert.equal(boss.attackName,'棱线锁定');
  camera.lookAt(boss.position);assert.equal(combat.cast('arc'),true);
  assert.ok(events.some(e=>e.type==='interrupt'&&e.kind==='warden'));
  assert.equal(combat.getState().enemies[0].vulnerable,true);
  combat.start({site:'forge',rank:2,fromWave:3});
  for(let i=0;i<210&&!combat.getState().enemies[0]?.vulnerable;i++)combat.update(dt);
  assert.equal(combat.getState().enemies[0].vulnerable,true);
  assert.ok(events.some(e=>e.type==='enemyFire'&&e.attackName==='熔区连锁'));
});

test('seven scatter paths lose power with distance and a lance can pierce two machines only',()=>{
  const {combat,camera,events}=fixture(),ray=new THREE.Vector3(0,0,1);
  function stage(distances,weapon){
    const s=combat.start({site:'north',rank:4,fromWave:3});
    s.enemies.forEach((e,i)=>e.position.copy(camera.position).addScaledVector(ray,distances[i]??120));
    combat.equip(weapon);events.length=0;combat.fire(ray);
    return events.filter(e=>e.type==='hit').map(e=>e.damage);
  }
  const close=stage([9],'scatter')[0],distant=stage([28],'scatter')[0];
  assert.equal(close,84);assert.ok(distant>0&&distant<close*.55);
  const penetrated=stage([10,17,22],'lance');
  assert.equal(penetrated.length,2);assert.ok(penetrated[0]>penetrated[1]);
  assert.equal(stage([10,17,22],'carbine').length,1);
});

test('a starwheel sweeps each leg once, follows a sidestepping pilot and stops at masonry',()=>{
  const V=(x=0,y=2,z=0)=>new THREE.Vector3(x,y,z);
  function throwDisc(step,strafe,barrier,muzzleZ=0){
    const events=[],hits=[],eye=V(),foes=[{id:1,p:V(0,2,-14),radius:1,shield:0},{id:2,p:V(4.8,2,-14),radius:1,shield:0}];
    const walls=encounterCollision(THREE,barrier?[new THREE.Box3(V(-5,-4,-10.4),V(5,10,-10))]:[],()=>-4);
    walls.rebuild(eye);
    const parent=new THREE.Group(),noop=()=>{},fx={beam:noop,particle:noop,wave:noop,burst:noop};
    const d=buildOrbitalDiscs(THREE,parent,walls,fx,(enemy,damage)=>hits.push([enemy.id,damage]),type=>events.push(type));
    d.launch(V(0,2,muzzleZ),eye,V(0,0,-1));
    for(let i=0;i<2/step;i++){
      if(strafe&&events.includes('orbitTurn'))eye.x=9;
      d.advance(step,eye,foes);
    }
    assert.equal(parent.children[0].count,0);
    assert.equal(events.filter(e=>e==='orbitTurn').length,1);
    return hits;
  }
  assert.deepEqual(throwDisc(1/30,false,false),[[1,37],[1,45]]);
  assert.deepEqual(throwDisc(1/144,true,false),[[1,37],[2,45]]);
  assert.deepEqual(throwDisc(1/30,false,true),[]);
  assert.deepEqual(throwDisc(1/30,false,true,-11),[]);
});

test('an interception keeps escorts in reserve after the pilot shoots the route scout',()=>{
  const {combat,camera,events}=fixture();
  combat.equip('lance');const first=combat.start({site:'patrol',rank:1});
  assert.equal(first.total,3);assert.equal(first.enemies.length,1);
  const aim=first.enemies[0].position.clone().sub(camera.position).normalize();
  combat.fire(aim);
  for(let i=0;i<30;i++)combat.update(1/30);
  assert.equal(combat.getState().kills,1);
  assert.equal(combat.getState().phase,'active');assert.equal(combat.getState().reinforcements,2);
  for(let i=0;i<40;i++)combat.update(1/30);
  assert.equal(combat.getState().enemies.length,2);
  assert.ok(events.some(e=>e.type==='reinforcement'&&e.count===2));
});

test('a weaver repairs a wounded ally and a roof intercepts falling relay fire',()=>{
  const {combat,events}=fixture();
  combat.start({site:'tide',rank:1});
  combat.fire();
  for(let i=0;i<210&&!events.some(e=>e.type==='repair');i++)combat.update(dt);
  const repair=events.find(e=>e.type==='repair');
  assert.equal(repair?.kind,'weaver');
  assert.equal(repair.targetId,1);
  function underRoof(covered){
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),events=[];
    camera.position.set(6,6,-166);camera.lookAt(6,6,-140);
    const roof=new THREE.Box3(new THREE.Vector3(1,8.3,-172),new THREE.Vector3(11,8.5,-161));
    const c=createEncounter(THREE,scene,camera,{solids:covered?[roof]:[],heightAt:()=>0,onEvent:e=>events.push(e)});
    c.start({site:'gate',rank:4});
    for(let i=0;i<115;i++)c.update(dt);
    assert.ok(events.some(e=>e.type==='areaWarning'&&e.name==='阵地锁定'));
    return events.filter(e=>e.type==='hurt'&&e.source==='relay').length;
  }
  assert.equal(underRoof(false),1);assert.equal(underRoof(true),0);
});

test('the opening signal can be interrupted; reserves stay out of its radius and guards share fire',()=>{
  const {combat,camera,events}=fixture();
  let s=combat.start({site:'garden',rank:0});
  assert.equal(s.enemies.length,1);assert.equal(s.reinforcements,4);
  for(let i=0;i<7;i++)combat.update(dt);
  assert.equal(combat.getState().enemies[0].attackName,'棱线锁定');
  combat.pulse();
  assert.ok(events.some(e=>e.type==='interrupt'));assert.equal(combat.getState().kills,0);
  s=combat.start({site:'tide',rank:1});
  const ray=new THREE.Vector3(0,0,1);
  s.enemies[0].position.copy(camera.position).addScaledVector(ray,5);
  s.enemies[1].position.copy(camera.position).addScaledVector(ray,24);
  events.length=0;combat.pulse();
  const hits=events.filter(e=>e.type==='hit'&&e.source==='pulse');
  assert.equal(hits.length,2);assert.ok(hits[0].damage>hits[1].damage*4);
  combat.start({site:'gate',rank:4});combat.update(dt);
  s=combat.getState();const [guard,weaver]=s.enemies;
  assert.equal(weaver.protectedBy,guard.id);
  combat.fire(ray.subVectors(weaver.position,camera.position).normalize());
  const after=combat.getState().enemies;
  assert.equal(guard.shield-after[0].shield,11);
  assert.equal(weaver.shield-after[1].shield,16);
});

test('veteran formations and telegraphs change independently of health, rank and wave checkpoints',()=>{
  const {combat}=fixture(),normal=combat.start({site:'gate',rank:4,fromWave:3});
  const replay=combat.start({site:'gate',rank:4,fromWave:3,veteran:true});
  assert.equal(replay.veteran,true);assert.equal(replay.waves,normal.waves);
  assert.equal(replay.enemies[0].maxHealth,normal.enemies[0].maxHealth);
  assert.equal(replay.total-normal.total,3);assert.equal(replay.kills-normal.kills,2);
  assert.equal(combat.start({site:'gate',rank:4}).veteran,false);
  const patterns=new Set();
  for(const [rank,site] of sectors.entries()){
    const {s,log}=sortie(site.id,rank,'wide',1,true);
    assert.equal(s.phase,'won',site.id);
    assert.ok(log.some(e=>e.type==='reinforcement'&&e.veteran));
    for(const e of log)if(e.type==='charge')patterns.add(e.attackName);
  }
  assert.ok(patterns.has('交叉截击'));assert.ok(patterns.has('回声落点'));assert.ok(patterns.has('分叉锁线'));
  assert.equal(sortie('gate',4,'pilot',1,true).s.phase,'lost');
});
