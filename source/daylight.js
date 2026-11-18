// A linear HDR sky probe supplies the same daylight to the brass, enamel and
// crystal surfaces, including highlights on faces outside the direct sunlight.
export function createDaylight(T,renderer,scene,sunDirection){
  const direction=new T.Vector3(...sunDirection).normalize();
  const sun=new T.DirectionalLight(0xffc48e,4.35);
  const hemisphere=new T.HemisphereLight(0x9dbfd9,0x7e6d68,1.02);
  const fill=new T.DirectionalLight(0xb8d6ec,.51);fill.position.set(54,37,68);
  scene.add(sun,sun.target,hemisphere,fill);
  const coarse=matchMedia('(pointer:coarse)').matches;
  sun.castShadow=true;sun.shadow.mapSize.setScalar(coarse?1536:3072);
  Object.assign(sun.shadow.camera,{left:-99,right:99,top:99,bottom:-99,near:48,far:545});
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.00013;sun.shadow.normalBias=.09;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  if(renderer.extensions.has('EXT_color_buffer_float'))setSkyProbe(T,renderer,scene,direction);
  const gate=new T.PointLight(0xffdda0,25,39,2);gate.position.set(-3,9,-43);scene.add(gate);
  const center=new T.Vector3(1000,0,1000), focus=new T.Vector3(), facing=new T.Vector3();
  const climate=new T.Vector3(),lastClimate=new T.Vector3(-1,-1,-1);
  const colors=values=>values.map(hex=>new T.Color(hex));
  const sunColors=colors([0xffc48e,0xffd5ad,0xffb178,0xffc989]);
  const skyColors=colors([0x9dbfd9,0x88cfd9,0xa8aec8,0x97b6d9]);
  const groundColors=colors([0x7e6d68,0x4c797b,0x916444,0x686478]);
  const fogColors=colors([0x91a7ad,0x77abb8,0xb6a096,0x859cac]);
  function blend(color,palette){color.copy(palette[0]).lerp(palette[1],climate.x).lerp(palette[2],climate.y).lerp(palette[3],climate.z)}
  function localWeight(position,x,z,inner,outer){
    return 1-T.MathUtils.smoothstep(Math.hypot(position.x-x,position.z-z),inner,outer);
  }
  let refresh=0;
  function update(camera,dt,energy,inBattle){
    refresh+=dt;camera.getWorldDirection(facing);
    const p=camera.position;
    climate.set(localWeight(p,-159,-78,57,112),localWeight(p,163,-19,57,113),localWeight(p,6,-150,43,96));
    if(!climate.equals(lastClimate)){
      blend(sun.color,sunColors);blend(hemisphere.color,skyColors);blend(hemisphere.groundColor,groundColors);
      blend(scene.fog.color,fogColors);scene.fog.density=.00236+.00113*climate.x+.00074*climate.y+.00048*climate.z;
      lastClimate.copy(climate);
    }
    focus.set(camera.position.x+facing.x*45,7,camera.position.z+facing.z*45);
    const shift=center.distanceToSquared(focus)>18*18;
    if(shift||inBattle&&refresh>.12){
      if(shift){center.copy(focus);center.x=Math.round(center.x/4)*4;center.z=Math.round(center.z/4)*4}
      sun.target.position.copy(center);sun.position.copy(center).addScaledVector(direction,320);
      renderer.shadowMap.needsUpdate=true;refresh=0;
    }
    gate.intensity=22+Math.min(1,energy)*1050;
  }
  return {update,climate};
}

function setSkyProbe(T,renderer,scene,direction){
  const w=256,h=128,data=new Uint16Array(w*h*4),ray=new T.Vector3(),color=new T.Color();
  const coldHorizon=new T.Color(.57,.75,.91),sunlitHorizon=new T.Color(1.15,.78,.39);
  const zenith=new T.Color(.073,.21,.375),ground=new T.Color(.070,.063,.056);
  const horizon=new T.Color(),zenithDirection=new T.Vector3(0,1,0);
  const crosswind=new T.Vector3().crossVectors(direction,zenithDirection).normalize();
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const latitude=((y+.5)/h-.5)*Math.PI,longitude=((x+.5)/w-.5)*2*Math.PI;
    ray.set(Math.cos(latitude)*Math.cos(longitude),Math.sin(latitude),Math.cos(latitude)*Math.sin(longitude));
    const sunAngle=Math.max(0,ray.dot(direction)), high=Math.max(0,ray.y);
    const lateral=ray.dot(crosswind),front=Math.pow(sunAngle,3.7);
    horizon.copy(coldHorizon).lerp(sunlitHorizon,front);
    color.copy(horizon).lerp(zenith,Math.sqrt(high));
    if(ray.y<0)color.lerp(ground,Math.min(1,-ray.y*8+.32));
    const opening=Math.exp(-((ray.y-.078-.055*lateral)**2)/.0027);
    const belt=opening*(.21+.57*front),deck=.10*Math.max(0,Math.sin(longitude*4+latitude*9+.41));
    color.multiplyScalar(1-deck*Math.min(1,high*5));
    color.r+=belt*(.85+.57*front);color.g+=belt*.84;color.b+=belt*(1.16-.62*front);
    const glow=.64*Math.pow(sunAngle,22)+9.5*Math.pow(sunAngle,470)+30*Math.pow(sunAngle,5500);
    const i=(y*w+x)*4;
    data[i]=T.DataUtils.toHalfFloat(color.r+glow);data[i+1]=T.DataUtils.toHalfFloat(color.g+glow*.73);
    data[i+2]=T.DataUtils.toHalfFloat(color.b+glow*.47);data[i+3]=T.DataUtils.toHalfFloat(1);
  }
  const map=new T.DataTexture(data,w,h,T.RGBAFormat,T.HalfFloatType);
  map.mapping=T.EquirectangularReflectionMapping;map.minFilter=map.magFilter=T.LinearFilter;map.needsUpdate=true;
  const generator=new T.PMREMGenerator(renderer);
  const environment=generator.fromEquirectangular(map);
  scene.environment=environment.texture;scene.environmentIntensity=.46;map.dispose();generator.dispose();
}
