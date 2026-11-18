// Integrate velocity in metres per second. Two short swept contacts allow
// glancing motion along ruins and stop the observer at a concave corner.
export function createFlight(T,position,camera,{heightAt,bounds,collider}) {
  const velocity=new T.Vector3(),wish=new T.Vector3(),step=new T.Vector3();
  const forward=new T.Vector3(),side=new T.Vector3(),normal=new T.Vector3(),dir=new T.Vector3(),dashDir=new T.Vector3();
  let stickX=0,stickY=0,dashTime=0,dashCooldown=0,lean=0;
  function axes(keys){
    camera.getWorldDirection(forward);forward.y=0;forward.normalize();side.crossVectors(forward,camera.up).normalize();
    const x=stickX+Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
    const z=stickY+Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
    const vertical=Number(keys.has('KeyE'))-Number(keys.has('KeyQ'));
    wish.copy(forward).multiplyScalar(z).addScaledVector(side,x);wish.y=vertical;
    if(wish.lengthSq()>1)wish.normalize();return x;
  }
  function reset(){velocity.set(0,0,0);stickX=stickY=dashTime=dashCooldown=lean=0}
  function dash(keys){
    if(dashCooldown>0)return false;
    axes(keys);dashDir.copy(wish);dashDir.y=0;
    if(dashDir.lengthSq()<.04)dashDir.copy(forward);
    dashDir.normalize();dashTime=.18;dashCooldown=2.15;return true;
  }
  function sweep(displacement){
    for(let i=0;i<2;i++){
      const length=displacement.length();if(length<.00005)break;
      dir.copy(displacement).multiplyScalar(1/length);
      const clearance=.46,span=length+clearance,hit=collider.surface(position,dir,span,normal);
      if(hit>=span-1e-5){position.add(displacement);break}
      const travel=Math.min(length,Math.max(0,hit-clearance));
      position.addScaledVector(dir,travel);displacement.addScaledVector(dir,-travel);
      displacement.addScaledVector(normal,-Math.min(0,displacement.dot(normal)));
      velocity.addScaledVector(normal,-Math.min(0,velocity.dot(normal)));
    }
  }
  function update(dt,keys,inBattle,focused,travelling=false){
    dashCooldown=Math.max(0,dashCooldown-dt);
    const x=axes(keys),moving=wish.lengthSq()>.001;
    const speed=inBattle?(focused?6.7:travelling?21:12.6):keys.has('ShiftLeft')||keys.has('ShiftRight')?30:13;
    wish.multiplyScalar(speed);
    const blend=1-Math.exp(-dt*(moving?31:41));
    velocity.lerp(wish,blend);if(!moving&&velocity.lengthSq()<.001)velocity.set(0,0,0);
    lean=T.MathUtils.damp(lean,T.MathUtils.clamp(x,-1,1),12,dt);
    if(velocity.lengthSq()<.00001&&dashTime<=0)return false;
    step.copy(velocity).multiplyScalar(dt);
    if(dashTime>0){
      const remaining=Math.max(0,dashTime-dt);
      // Integral of a short decelerating impulse, independent of frame rate.
      step.addScaledVector(dashDir,47*(dashTime*dashTime-remaining*remaining)/(.36));dashTime=remaining;
    }
    sweep(step);
    position.x=T.MathUtils.clamp(position.x,bounds.minX,bounds.maxX);position.z=T.MathUtils.clamp(position.z,bounds.minZ,bounds.maxZ);
    const ground=heightAt(position.x,position.z);
    position.y=T.MathUtils.clamp(position.y,ground+1.8,inBattle?ground+(travelling?34:18):98);
    return true;
  }
  return {reset,update,dash,setStick(x,y){stickX=x;stickY=y},get cooldown(){return dashCooldown},get dashAmount(){return dashTime/.18},get lean(){return lean},get speed(){return velocity.length()}};
}
