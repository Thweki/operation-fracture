import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildEnergyArms} from './energy-arms.js';

// A floating survey instrument refitted with a phase emitter. The ceramic forks
// carry the signal around an exposed crystal, leaving its optical axis open.
export function buildResonator(T,camera) {
  const rig=new T.Group(),body=new T.Group(),carbine=new T.Group(),rotor=new T.Group(),spark=new T.Group();
  rig.name='Resonator';carbine.name='Prism carbine';rig.visible=false;
  camera.add(rig);rig.add(body);body.add(carbine,spark);carbine.add(rotor);
  const muzzle=new T.Object3D();body.add(muzzle);
  const muzzlePoint=new T.Vector3();
  const metal=(color,metalness,roughness)=>new T.MeshStandardMaterial({color,metalness,roughness});
  const gunmetal=metal(0x344445,.76,.38),ceramic=metal(0xc9c9af,.31,.39),brass=metal(0xb2a06e,.78,.32);
  const dark=metal(0x23332f,.54,.53),steel=metal(0x849994,.82,.23);
  const lume=new T.MeshBasicMaterial({color:new T.Color(.30,2.15,2.38)});
  const amber=new T.MeshBasicMaterial({color:new T.Color(2.1,1.17,.26)});
  const glass=new T.MeshPhysicalMaterial({color:0x649a90,emissive:0x349f94,emissiveIntensity:1.05,metalness:.54,roughness:.14,clearcoat:.8});
  let seed=91823;
  const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const patina=document.createElement('canvas');patina.width=patina.height=256;
  const paint=patina.getContext('2d'),pixels=paint.createImageData(256,256);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const v=200+Math.sin(y*.73)*10+Math.sin((x+y)*.043)*3+rnd()*27,i=(x+256*y)*4;
    pixels.data.set([v,v+1,v,255],i);
  }
  paint.putImageData(pixels,0,0);
  for(let i=0;i<560;i++){
    const x=rnd()*256,y=rnd()*256;paint.strokeStyle=rnd()<.6?'rgba(65,72,60,.23)':'rgba(255,255,235,.35)';
    paint.lineWidth=.25+rnd()*.7;paint.beginPath();paint.moveTo(x,y);paint.lineTo(x+1+rnd()*9,y+(rnd()-.5)*1.7);paint.stroke();
  }
  const surface=new T.CanvasTexture(patina);surface.colorSpace=T.SRGBColorSpace;surface.wrapS=surface.wrapT=T.RepeatWrapping;surface.repeat.set(1.5,1.5);
  for(const material of [gunmetal,brass,ceramic,dark,steel]){material.map=surface;material.bumpMap=surface;material.bumpScale=.004}
  const buckets=new Map();
  function piece(geometry,material,x=0,y=0,z=0,rx=0,ry=0,rz=0) {
    const transform=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(1,1,1));
    let g=geometry.index?geometry.toNonIndexed():geometry;g.applyMatrix4(transform);
    if(!buckets.has(material))buckets.set(material,[]);
    buckets.get(material).push(g);if(g!==geometry)geometry.dispose();
  }
  function housing(shape,depth,material,x,y,z,bevel=.06) {
    const silhouette=new T.Shape();
    shape.forEach(([u,v],i)=>i?silhouette.lineTo(u,v):silhouette.moveTo(u,v));silhouette.closePath();
    const geo=new T.ExtrudeGeometry(silhouette,{depth,bevelEnabled:true,bevelSegments:2,bevelSize:bevel,bevelThickness:bevel,steps:1});
    piece(geo,material,x,y,z);
  }
  function collar(r,t,z,material){
    piece(new T.TorusGeometry(r,t,6,36),material,0,.045,z);
  }
  const casing=[[-.41,-.26],[-.52,-.02],[-.43,.24],[-.23,.36],[.28,.33],[.45,.17],[.46,-.12],[.28,-.30]];
  housing(casing,.99,gunmetal,0,-.04,-.43);
  housing(casing.map(([x,y])=>[x*.90,y*.87]),.34,ceramic,0,-.04,.57,.045);
  housing([[-.32,-.12],[-.21,.16],[.08,.26],[.27,.14],[.32,-.12],[.10,-.23]],.66,dark,.02,-.25,-.10,.07);
  const fork=[[-.16,-.17],[-.17,.03],[-.09,.19],[.02,.22],[.14,.09],[.15,-.11],[.04,-.21]];
  for(const sign of [-1,1]) {
    housing(fork,.87,ceramic,sign*.35,-.01,-1.30,.035);
    housing(fork.map(([x,y])=>[x*.76,y*.74]),.42,brass,sign*.31,.01,-1.73,.024);
    housing(fork.map(([x,y])=>[x*.49,y*.51]),.16,steel,sign*.28,.035,-1.92,.02);
    piece(new T.BoxGeometry(.034,.045,.89),lume,sign*.337,.205,-.86);
    piece(new T.BoxGeometry(.049,.048,.38),lume,sign*.28,.14,-1.52);
    for(let k=0;k<7;k++){
      piece(new T.BoxGeometry(.024,.1,.037),dark,sign*.505,.015,-.36+k*.115,-.23);
      piece(new T.BoxGeometry(.053,.033,.035),brass,sign*.36,.229,-1.24+k*.107);
    }
    for(const z of [-1.05,-.55,.27,.55]){
      piece(new T.CylinderGeometry(.047,.047,.021,6),brass,sign*.454,.035,z,0,0,Math.PI/2);
    }
  }
  for(const z of [-.49,-.63,-1.25,-1.66])collar(z< -1.6?.235:.287,.032,z,brass);
  collar(.265,.017,-1.67,lume);
  for(let i=0;i<3;i++)collar(.20-i*.028,.021,-1.82-i*.09,i===1?lume:steel);
  piece(new T.BoxGeometry(.27,.032,.49),dark,0,.343,.12);
  for(let i=0;i<8;i++)piece(new T.BoxGeometry(.19*(1-i*.064),.016,.025),i<5?lume:amber,0,.367,-.07+i*.055);
  // The miniature sight folds over the rear of the coil.
  for(const side of [-1,1])piece(new T.BoxGeometry(.026,.16,.07),brass,side*.14,.39,-.23,0,0,-side*.28);
  piece(new T.BoxGeometry(.235,.019,.033),lume,0,.471,-.23);
  // Alternating ceramic armour and recessed cooling channels on the near casing.
  for(let i=0;i<4;i++){
    const z=-.33+i*.21;
    housing([[-.53,-.10],[-.54,.055],[-.42,.24],[-.31,.27],[-.29,.21],[-.43,.11],[-.45,-.12]],.151,i===2?brass:steel,0,0,z,.014);
    piece(new T.BoxGeometry(.028,.025,.13),i===3?amber:lume,-.491,.13,z+.075,0,0,.48);
  }
  for(const x of [-.31,.28])for(const z of [-.12,.19,.47,.77]) {
    piece(new T.CylinderGeometry(.036,.036,.028,8),dark,x,.297,z);
    piece(new T.BoxGeometry(.04,.007,.008),brass,x,.316,z,0,.55,0);
  }
  const backPlate=[[-.32,-.14],[-.37,.015],[-.28,.14],[.18,.15],[.31,.06],[.28,-.12],[.06,-.18]];
  housing(backPlate,.045,brass,0,.01,.929,.016);
  housing(backPlate.map(([x,y])=>[x*.90,y*.78]),.028,dark,0,.018,.979,.012);
  for(let j=0;j<5;j++)piece(new T.BoxGeometry(.032,.105-j*.011,.016),j===4?amber:lume,-.205+j*.077,.025,1.018,0,0,-.26);
  buckets.forEach((parts,material)=>{
    const geo=mergeGeometries(parts);const m=new T.Mesh(geo,material);
    m.frustumCulled=false;carbine.add(m);parts.forEach(g=>g.dispose());
  });
  const crystal=new T.Mesh(new T.OctahedronGeometry(.21),glass);crystal.scale.set(.68,.82,2.27);
  crystal.position.set(0,.05,-1.09);carbine.add(crystal);
  rotor.position.copy(crystal.position);
  for(let i=0;i<3;i++){
    const arc=new T.Mesh(new T.TorusGeometry(.246,.013,5,20,Math.PI*.42),lume);
    arc.rotation.z=i*Math.PI*2/3;arc.rotation.x=.37;rotor.add(arc);
  }
  const flare=new T.Mesh(new T.OctahedronGeometry(1),new T.MeshBasicMaterial({color:new T.Color(1.2,5,5.5),transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
  spark.add(flare);spark.position.copy(muzzle.position);spark.visible=false;
  const screen=document.createElement('canvas');screen.width=384;screen.height=160;
  const ctx=screen.getContext('2d');const screenMap=new T.CanvasTexture(screen);screenMap.colorSpace=T.SRGBColorSpace;
  const readout=new T.Mesh(new T.PlaneGeometry(.47,.196),new T.MeshBasicMaterial({map:screenMap,color:new T.Color(1.1,1.2,1.15),side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2}));
  readout.position.set(-.15,.374,.34);readout.rotation.x=-Math.PI/2+.10;carbine.add(readout);
  let readoutHeat=-1;
  function displayHeat(heat){
    const level=Math.round(heat/4)*4;if(level===readoutHeat)return;readoutHeat=level;
    ctx.fillStyle='#102826';ctx.fillRect(0,0,384,160);ctx.strokeStyle='#779f8d';ctx.lineWidth=5;ctx.strokeRect(4,4,376,152);
    ctx.fillStyle='#c4efe3';ctx.font='bold 28px monospace';ctx.fillText('PRISM  //  04',17,43);
    ctx.font='bold 53px monospace';ctx.fillText(String(level).padStart(2,'0'),16,106);ctx.font='22px monospace';ctx.fillText('THERMAL',102,100);
    for(let i=0;i<19;i++){ctx.fillStyle=i<level*.18?(level>76?'#ffb474':'#a1f4e0'):'#315952';ctx.fillRect(17+i*18,124,13,11)}
    screenMap.needsUpdate=true;
  }
  const instruments={
    carbine:{group:carbine,muzzle:[0,.05,-2.18],sight:[0,.416,-.23,.17],scale:1,kick:.19,recovery:14,tilt:.065,
      update(t,heat,k,glow,reduced){
        crystal.rotation.z=reduced?0:t*1.3;rotor.rotation.z=(reduced?0:t*1.7)+heat*.013;
        lume.color.setRGB(.20+heat*.016,1.9+glow*.8-heat*.008,2.2+glow*.65-heat*.013);
        displayHeat(heat);
      }},
    ...buildEnergyArms(T,body,{surface,dark,steel,brass,ceramic}),
  };
  const flareColors={carbine:[1.2,5,5.5],scatter:[5.4,2.3,.39],lance:[3.4,2.2,5.8],orbit:[2.2,4.5,2.15]};
  const flareShapes={carbine:[.17,.13,.38],scatter:[.39,.32,.35],lance:[.09,.10,.81],orbit:[.39,.069,.21]};
  let current='carbine',pending='carbine',switchTime=0;
  let kick=0,glow=0,pulseKick=0,active=false,swayX=0,swayY=0,focusBlend=0;
  function select(id){
    instruments[current].group.visible=false;current=id;instruments[id].group.visible=true;
    muzzle.position.fromArray(instruments[id].muzzle);spark.position.copy(muzzle.position);
    flare.material.color.setRGB(...flareColors[id]);spark.visible=false;kick=glow=0;
  }
  select(current);
  function equip(id){
    if(!Object.hasOwn(instruments,id))return false;
    if(id===pending)return true;
    pending=id;
    if(!active){select(id);switchTime=0}
    else switchTime=.17;
    return true;
  }
  function show(on){
    active=on;rig.visible=on;kick=glow=pulseKick=swayX=swayY=focusBlend=switchTime=0;
    select(pending);
  }
  function effect(type,details={}){
    if(type==='fire'){
      if(details.weaponId&&Object.hasOwn(instruments,details.weaponId))pending=details.weaponId;
      if(current!==pending){select(pending);switchTime=0}
      kick=1;glow=1;
    }
    if(type==='pulse'||type==='skill'){pulseKick=1;glow=1.15}
  }
  function update(dt,t,heat,moving,aimX=0,aimY=0,reduced=false,focused=false) {
    if(!active)return;
    switchTime=Math.max(0,switchTime-dt);
    if(current!==pending&&(switchTime<.10||reduced))select(pending);
    const selected=instruments[current],fold=reduced?0:Math.sin(Math.PI*switchTime/.17);
    const half=Math.tan(camera.fov*Math.PI/360)*.91;
    const scale=half*(camera.aspect<.9?.30:.405)*selected.scale;
    const damping=1-Math.exp(-dt*12);
    focusBlend+=((focused?1:0)-focusBlend)*damping;
    swayX+=(T.MathUtils.clamp(aimX,-1,1)-swayX)*damping;
    swayY+=(T.MathUtils.clamp(aimY,-1,1)-swayY)*damping;
    const hip=1-focusBlend,bob=reduced?0:Math.sin(t*(moving?8.8:1.8))*(moving?.024:.007)*hip;
    const [sightX,sightY,sightZ,sightPitch]=selected.sight;
    const eyeLine=(Math.cos(sightPitch)*sightY-Math.sin(sightPitch)*sightZ)*scale;
    rig.scale.setScalar(scale);
    rig.position.set(Math.min(half*camera.aspect*.50,half*.91)*hip-sightX*scale*focusBlend,
      half*(-.71*hip+bob-fold*.27)-eyeLine*focusBlend,-.96+focusBlend*.16);
    rig.rotation.set((.075+swayY*.11)*hip+sightPitch*focusBlend+(reduced?0:kick*selected.tilt)-fold*.075,
      (.33-swayX*.20)*hip,-.14*hip+bob*.5-fold*.32);
    body.position.z=reduced?0:kick*selected.kick+pulseKick*.13;
    selected.update(t,heat,kick,glow,reduced);
    const shape=flareShapes[current];
    spark.visible=glow>.07;spark.scale.set(shape[0]*glow,shape[1]*glow,shape[2]*glow);flare.material.opacity=Math.min(reduced?.48:.88,glow);
    kick*=Math.exp(-dt*selected.recovery);glow*=Math.exp(-dt*(current==='lance'?14:19));pulseKick*=Math.exp(-dt*5);
  }
  return {show,equip,effect,update,getMuzzle(){
    if(current!==pending){select(pending);switchTime=0}
    return muzzle.getWorldPosition(muzzlePoint);
  }};
}
