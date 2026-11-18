import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {WEAPONS} from './armory.js';

export function buildOrbitalDiscs(T,parent,walls,fx,hurt,event){
  const weapon=WEAPONS.orbit,capacity=4,parts=[];
  function band(radius,width,span,offset,rgb){
    const g=new T.TorusGeometry(radius,width,5,Math.ceil(span*8),span).toNonIndexed();
    g.rotateZ(offset);g.rotateX(-Math.PI/2);
    const colors=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3)colors.set(rgb,i);
    g.setAttribute('color',new T.BufferAttribute(colors,3));parts.push(g);
  }
  band(.32,.029,Math.PI*2,0,[.36,1.52,.67]);
  for(let i=0;i<3;i++){
    band(.52,.032,1.70,i*2.094,[.92,2.8,1.18]);
    band(.48,.015,.93,i*2.094+.57,[2.4,1.74,.59]);
    band(.42,.017,.72,i*2.094+.88,[.63,1.40,.76]);
  }
  const mesh=new T.InstancedMesh(mergeGeometries(parts),new T.MeshBasicMaterial({vertexColors:true}),capacity);
  parts.forEach(p=>p.dispose());mesh.name='Returning orbital wheels';mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.count=0;mesh.visible=false;parent.add(mesh);
  const slots=Array.from({length:capacity},()=>({active:false,p:new T.Vector3(),dir:new T.Vector3(),tail:new T.Vector3(),hit:new Set(),age:0,range:0,returning:false}));
  const direction=new T.Vector3(),offset=new T.Vector3(),destination=new T.Vector3(),end=new T.Vector3(),point=new T.Vector3();
  const pose=new T.Object3D();
  function launch(muzzle,eye,aim){
    const d=slots.find(s=>!s.active);if(!d)return false;
    destination.copy(eye).addScaledVector(aim,weapon.range);
    d.active=true;d.p.copy(muzzle);
    const reach=direction.subVectors(muzzle,eye).length();
    if(reach>.001){
      direction.multiplyScalar(1/reach);
      const open=walls.hit(eye,direction,reach,.06);
      if(open<reach-.004)d.p.copy(eye).addScaledVector(direction,Math.max(0,open-.06));
    }
    d.dir.subVectors(destination,d.p).normalize();d.range=d.p.distanceTo(destination);
    d.age=0;d.trail=0;d.tail.copy(d.p);d.returning=false;d.hit.clear();return true;
  }
  function advance(dt,eye,enemies){
    let count=0;
    for(const d of slots){
      if(!d.active)continue;
      d.age+=dt;
      let length;
      if(d.returning){
        length=direction.subVectors(eye,d.p).length();
        if(length<1.05||d.age>2.8){d.active=false;continue}
        direction.multiplyScalar(1/length);length=Math.min(length-.63,dt*74);
      }else{
        direction.copy(d.dir);length=Math.min(d.range,dt*63);
      }
      const clear=walls.hit(d.p,direction,length,.06);
      end.copy(d.p).addScaledVector(direction,clear);
      // Sweeping each segment keeps both thin targets and the turn-around
      // leg accurate at lower frame rates. A target can be hit once per leg.
      for(let i=enemies.length-1;i>=0;i--){
        const enemy=enemies[i];
        if(d.hit.has(enemy.id))continue;
        const along=offset.subVectors(enemy.p,d.p).dot(direction);
        const nearest=T.MathUtils.clamp(along,0,clear);
        point.copy(d.p).addScaledVector(direction,nearest);
        const radius=enemy.radius*(enemy.shield>0?.97:.79)+.41;
        if(point.distanceToSquared(enemy.p)>radius*radius||!walls.clear(point,enemy.p))continue;
        d.hit.add(enemy.id);
        hurt(enemy,d.returning?45:weapon.damage,'orbit',point);
      }
      d.trail-=dt;
      if(d.trail<=0){
        fx.beam(d.tail,end,d.returning?'#ffe9a5':weapon.color,.035,.095);d.tail.copy(end);
        fx.particle(end,offset.set(0,.36,0),weapon.color,.19,.18);d.trail=.032;
      }
      d.p.copy(end);
      if(!d.returning)d.range-=clear;
      const blocked=clear<length-.004;
      if(blocked&&d.returning){fx.burst(d.p,weapon.color,5,1.8);d.active=false;continue}
      if(!d.returning&&(d.range<=.002||blocked)){
        d.returning=true;d.hit.clear();
        fx.wave(d.p,.85,weapon.color,.25,true);event('orbitTurn',{position:d.p.clone()});
      }
      pose.position.copy(d.p);
      pose.rotation.set(.37+Math.sin(d.age*9)*.24,d.age*12,d.returning?-.43:.38);
      pose.updateMatrix();mesh.setMatrixAt(count++,pose.matrix);
    }
    mesh.count=count;mesh.visible=count>0;if(count)mesh.instanceMatrix.needsUpdate=true;
  }
  function clear(){for(const d of slots){d.active=false;d.hit.clear()}mesh.count=0;mesh.visible=false}
  return {launch,advance,clear};
}
