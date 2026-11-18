import * as THREE from 'three';
import {buildTerrain,heightAt,WORLD_BOUNDS} from './terrain.js';
import {buildArchitecture} from './architecture.js';
import {buildSky,SUN_DIRECTION} from './sky.js';
import {buildDistricts} from './districts.js';
import {buildOptics} from './optics.js';
import {createDaylight} from './daylight.js';
import {createCloudLight} from './cloud-light.js';
import {createBattleMode} from './battle-mode.js';
import {createFlight} from './flight.js';
import {encounterCollision} from './combat-collision.js';
import {buildFlowers} from './flowers.js';
import {buildMist} from './mist.js';
import {buildResonance} from './resonance.js';
import {createAmbience} from './ambient.js';
import {createCampaign} from './campaign.js';
import {machineFactory} from './combat-models.js';
import {buildBattlefieldArt} from './battlefield-art.js';
import {buildRelayLines} from './relay-lines.js';
import {warmEncounterEffects} from './combat-warmup.js';

const $=id=>document.getElementById(id),canvas=$('landscape'),stage=$('world');
const reduced=matchMedia('(prefers-reduced-motion:reduce)'),sound=createAmbience();
let storage;try{storage=window.localStorage}catch{}
const defaults={sensitivity:1,fov:63,volume:1,music:1};
const settings={...defaults};
try{
  const saved=JSON.parse(storage?.getItem('vesper-flight-settings')||'{}');
  for(const [id,min,max] of [['sensitivity',.45,1.9],['fov',55,85],['volume',0,1],['music',0,1]]){
    if(Number.isFinite(saved[id]))settings[id]=THREE.MathUtils.clamp(saved[id],min,max);
  }
}catch{}
function changeSetting(id,value){
  if(!(id in defaults))return;settings[id]=value;sound.setLevels(settings.volume,settings.music);
  try{storage?.setItem('vesper-flight-settings',JSON.stringify(settings))}catch{}
}
sound.setLevels(settings.volume,settings.music);
const campaign=createCampaign(storage),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(53,1,.09,1500);
const angles=new THREE.Euler(0,0,0,'YXZ'),pressed=new Set(),lookTarget=new THREE.Vector3();
let renderer,sky,terrain,architecture,districts,fieldArt,relayLines,resonance,flowers,mist,clouds,daylight,optics,flight,battle,formation;
let yaw=0,pitch=0,recoil=0,focused=false,stickId=null,timer=0,last=0,slot=0,first=true,time=0,energy=0,requestId=0;
let soundChosen=false,soundIntent=false,soundRevision=0,lastSize='';
try{soundChosen=storage?.getItem('vesper-silent')==='yes'}catch{}
function notice(message){
  const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>t.classList.remove('show'),2100);
}
async function audio(){
  soundChosen=true;soundIntent=!soundIntent;
  const revision=++soundRevision;
  function reflect(on){
    $('sound').setAttribute('aria-pressed',String(on));$('sound').setAttribute('aria-label',on?'静音':'开启声音');
    try{storage?.setItem('vesper-silent',on?'no':'yes')}catch{}
  }
  reflect(soundIntent);
  const on=await sound.setEnabled(soundIntent);
  if(revision===soundRevision&&on!==soundIntent){soundIntent=on;reflect(on)}
  return soundIntent;
}
function activateAudio(){if(!soundChosen&&!sound.enabled)void audio()}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('atlas').requestFullscreen()}catch{notice('当前窗口已使用最大可用视野')}}
$('sound').setAttribute('aria-pressed','false');$('sound').onclick=audio;$('fullscreen').onclick=fullscreen;
function syncAngles(){angles.setFromQuaternion(camera.quaternion,'YXZ');pitch=angles.x;yaw=angles.y}
function frameLanding(){
  const t=reduced.matches?0:time,slim=camera.aspect<.87;
  camera.position.set((slim?1:18.6)+Math.sin(t*.071)*.46,18.4+.25*Math.sin(t*.114),67.8+Math.cos(t*.084)*.35);
  camera.lookAt(lookTarget.set(slim?0:-3.3,16.6,-40));camera.fov=slim?63:53;camera.updateProjectionMatrix();
}
function place(site){
  const [x,z,h]=site.entry,[dx,dz]=site.heading,eyeY=heightAt(x,z)+h;
  camera.position.set(x,eyeY,z);camera.lookAt(x+dx*36,eyeY-.5,z+dz*36);
  camera.fov=settings.fov+(camera.aspect<1?5:0);camera.updateProjectionMatrix();camera.updateMatrixWorld();syncAngles();flight.reset();recoil=0;focused=false;
}
function face(site){
  const [x,z]=site.entry;
  if(Math.hypot(x-camera.position.x,z-camera.position.z)>1){camera.lookAt(x,camera.position.y-1.0,z);syncAngles()}
  flight.reset();recoil=0;focused=false;
}
function turn(dx,dy){
  const sensitivity=.0026*settings.sensitivity*Math.tan(camera.fov*Math.PI/360)/Math.tan(63*Math.PI/360);
  yaw-=dx*sensitivity;pitch=THREE.MathUtils.clamp(pitch-dy*sensitivity,-1.38,1.38);
  camera.rotation.set(pitch,yaw,0,'YXZ');
}
function resize(){
  if(!renderer)return;
  const w=stage.clientWidth||1,h=stage.clientHeight||1,key=w+'x'+h;
  if(key===lastSize)return;lastSize=key;camera.aspect=w/h;camera.updateProjectionMatrix();
  renderer.setSize(w,h,false);optics?.resize(w,h);
}
function resetStick(){stickId=null;flight?.setStick(0,0);$('flight-stick').firstElementChild.style.transform=''}
function inputs(){
  const stick=$('flight-stick');let stickX=0,stickY=0;
  function updateStick(e){if(e.pointerId!==stickId)return;const dx=e.clientX-stickX,dy=e.clientY-stickY,r=Math.hypot(dx,dy),m=Math.min(1,Math.max(0,(r-3)/30)),u=Math.max(1,r);
    flight?.setStick(dx/u*m,-dy/u*m);stick.firstElementChild.style.transform='translate('+dx/u*m*27+'px,'+dy/u*m*27+'px)'}
  stick.onpointerdown=e=>{if(stickId!==null)return;stickId=e.pointerId;stick.setPointerCapture(e.pointerId);const b=stick.getBoundingClientRect();stickX=b.left+b.width/2;stickY=b.top+b.height/2;updateStick(e)};
  stick.onpointermove=updateStick;stick.onpointercancel=stick.onpointerup=stick.onlostpointercapture=resetStick;
  document.querySelectorAll('[data-move]').forEach(b=>{b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);pressed.add(b.dataset.move)};b.onpointercancel=b.onpointerup=b.onlostpointercapture=()=>pressed.delete(b.dataset.move)});
  document.addEventListener('keydown',e=>{
    if(!battle||e.altKey||e.metaKey||e.ctrlKey||battle.keyDown(e)||!battle.active||battle.paused)return;
    if(['KeyW','KeyA','KeyS','KeyD','KeyE','KeyQ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();pressed.add(e.code)}
  });document.addEventListener('keyup',e=>pressed.delete(e.code));
}
function move(dt){
  if(!battle.active||battle.paused)return;
  const spin=Number(pressed.has('ArrowRight'))-Number(pressed.has('ArrowLeft')),tilt=Number(pressed.has('ArrowUp'))-Number(pressed.has('ArrowDown'));
  if(spin||tilt)turn(spin*dt*560,-tilt*dt*480);
  flight.update(dt,pressed,true,focused,battle.travelling);
  recoil*=Math.exp(-dt*17);
  camera.rotation.set(pitch+(reduced.matches?0:recoil),yaw,reduced.matches?0:-flight.lean*.009,'YXZ');
  const desired=settings.fov+(camera.aspect<1?5:0)-(focused?17:0)+(reduced.matches?0:flight.dashAmount*5);
  if(Math.abs(camera.fov-desired)>.01){camera.fov=THREE.MathUtils.damp(camera.fov,desired,14,dt);camera.updateProjectionMatrix()}
}
function buildFormation(){
  const root=new THREE.Group(),factory=machineFactory(THREE);root.name='Forward reconnaissance flight';scene.add(root);
  const actors=[['skirmisher',26,22.5,38,1.65],['skirmisher',25,25.7,14,1.05],['drone',36,23.9,5,.95]].map(([id,x,y,z,scale],index)=>{
    const model=factory(id);model.group.scale.setScalar(scale);root.add(model.group);
    return {model,x,y,z,index};
  });
  return {root,update(t){
    for(const {model,x,y,z,index:i} of actors){
      model.group.position.set(x+Math.sin(t*.12+i)*1.9,y+Math.sin(t*.37+i*1.5)*.48,z+Math.sin(t*.10+i)*1.2);
      model.group.rotation.set(-.18+.035*Math.sin(t*.28+i),-.76+.08*Math.cos(t*.16+i),-.21+.055*Math.sin(t*.29+i));
      model.animate?.(reduced.matches?0:.014,t+i,0,0,0);
    }
  }};
}
function render(now){
  requestId=requestAnimationFrame(tick);if(document.hidden)return;
  if(!battle.active||battle.paused){if(now<slot-1)return;slot=now-Math.max(0,now-slot)%(1000/60)+1000/60}else slot=now;
  const dt=Math.min((now-(last||now))/1000,.085);last=now;if(!reduced.matches)time+=dt;
  energy=Math.max(0,energy-dt*.13);formation.root.visible=!battle.active;
  const secured=campaign.cleared,steady=secured.has('gate')?.83:secured.has('tide')&&secured.has('forge')?.46:secured.has('tide')||secured.has('forge')?.17:0;
  const gatePower=Math.max(steady,Math.min(1,energy));relayLines.update(time,secured);
  if(battle.active)move(dt);else{frameLanding();formation.update(time)}
  camera.updateMatrixWorld();battle.update(dt,flight.speed>1.1);
  daylight.update(camera,dt,energy,battle.active&&!battle.paused);clouds.update(time);sound.setClimate(daylight.climate);
  sky.update(time,Math.min(1,energy));terrain.update(time);flowers.update(time);mist.update(time);districts.update(time);fieldArt.update(time,camera,battle.active?battle.site:null);
  architecture.update(time,gatePower);resonance.update(time,gatePower);optics.render(time,Math.min(1,energy),reduced.matches);
  if(first){
    first=false;performance.mark('atlas-first-frame');$('loading').classList.add('ready');
    setTimeout(async()=>{
      if(!soundChosen&&!document.hidden)sound.prepareDevice(true);
      const reveal=new Promise(resolve=>setTimeout(resolve,350));
      await Promise.allSettled([reveal,warmEncounterEffects(THREE,renderer,scene)]);
      if(renderer.getContext().isContextLost())return;
      $('loading').hidden=true;$('battle-start').disabled=false;$('landing-map').disabled=false;
    },0);
  }
}
function tick(now){try{render(now)}catch(e){cancelAnimationFrame(requestId);console.error(e);fail('图形链路中断，请重新连接战区。')}}
function initialize(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false,preserveDrawingBuffer:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.55,Math.sqrt(2700000/Math.max(1,innerWidth*innerHeight))));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  scene.background=new THREE.Color(0xabb6a1);scene.fog=new THREE.FogExp2(0xaab9a8,.0029);scene.add(camera);
  daylight=createDaylight(THREE,renderer,scene,SUN_DIRECTION);sky=buildSky(THREE,scene);terrain=buildTerrain(THREE,scene);
  const solids=[],before=scene.children.length;architecture=buildArchitecture(THREE,scene);
  scene.children.slice(before).forEach(part=>part.traverse(mesh=>{if(mesh.isMesh&&mesh.material.isMeshStandardMaterial){mesh.geometry.computeBoundingBox();solids.push(mesh)}}));
  districts=buildDistricts(THREE,scene,heightAt);solids.push(...districts.solids);
  fieldArt=buildBattlefieldArt(THREE,scene,heightAt);solids.push(...fieldArt.solids);
  resonance=buildResonance(THREE,scene);relayLines=buildRelayLines(THREE,scene,heightAt);flowers=buildFlowers(THREE,scene,heightAt);mist=buildMist(THREE,scene);
  scene.traverse(mesh=>{if(mesh.isMesh&&(mesh.name==='Vegetated rock shelf'||mesh.isInstancedMesh&&/pine|cypress|outcrops|causeway/i.test(mesh.name)))mesh.castShadow=true});
  const collision=encounterCollision(THREE,solids,heightAt,{extent:260});collision.rebuild(new THREE.Vector3());
  flight=createFlight(THREE,camera.position,camera,{heightAt,bounds:WORLD_BOUNDS,collider:collision});
  formation=buildFormation();
  battle=createBattleMode(THREE,scene,camera,{heightAt,solids,collision,lightPool:resonance.lights,campaign,sound,reduced,settings,changeSetting,notice,place,face,turn,audio,activateAudio,fullscreen,
    clearInput:()=>{pressed.clear();resetStick()},focus:on=>{focused=on},dash:()=>flight.dash(pressed),dashCooldown:()=>flight.cooldown,
    effect:e=>{if(e.type==='fire')recoil=Math.min(.012,recoil+({carbine:.0036,scatter:.010,lance:.0068}[e.weaponId]||.004));
      if(e.type==='kill'||e.type==='pulse')optics?.shock(e.type,e.position);if(e.type==='win')energy=2.8}});
  clouds=createCloudLight(THREE);clouds.apply(scene);optics=buildOptics(THREE,renderer,scene,camera,clouds,daylight.climate);
  resize();frameLanding();new ResizeObserver(resize).observe(stage);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(requestId);fail('图形连接中断，重新连接可从检查点继续。')});
  canvas.addEventListener('webglcontextrestored',()=>location.reload());
  document.addEventListener('visibilitychange',()=>{last=0;pressed.clear();resetStick()});
  camera.updateMatrixWorld();
  void optics.prepare().catch(e=>console.warn('场景预编译延后',e)).finally(()=>{
    if(!renderer.getContext().isContextLost())requestId=requestAnimationFrame(tick);
  });
}
function fail(msg){$('loading').hidden=true;$('failure').hidden=false;$('failure').innerHTML='<strong>'+msg+'</strong><button class="secondary">重新连接</button>';$('failure').querySelector('button').onclick=()=>location.reload()}
inputs();requestAnimationFrame(()=>{try{initialize()}catch(e){console.error(e);fail('战区需要 WebGL 2。请开启浏览器图形加速后重新连接。')}});
