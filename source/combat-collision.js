// Only triangles near the active arena enter this broad phase. Bullet sweeps
// visit crossed cells, then test the exact faces, including thin bridge walls.
export function encounterCollision(T,solids,heightAt,{extent=82}={}) {
  const cells=[],direct=[],cellSize=8;
  const ray=new T.Ray(),point=new T.Vector3(),matrix=new T.Matrix4(),instance=new T.Matrix4();
  const savedPoint=new T.Vector3(),edge=new T.Vector3();
  let version=0,minX=0,maxX=0,minZ=0,maxZ=0,columns=0;
  function rebuild(anchor){
    cells.length=0;direct.length=0;
    minX=Math.floor((anchor.x-extent)/cellSize);maxX=Math.floor((anchor.x+extent)/cellSize);
    minZ=Math.floor((anchor.z-extent)/cellSize);maxZ=Math.floor((anchor.z+extent)/cellSize);
    columns=maxX-minX+1;
    const meshes=new Set();
    for(const solid of solids||[]){
      if(solid?.isBox3||solid?.isSphere){direct.push(solid);continue;}
      if(solid?.isMesh)meshes.add(solid);else solid?.traverse?.(m=>{if(m.isMesh)meshes.add(m);});
    }
    for(const mesh of meshes){
      const geo=mesh.geometry, pos=geo?.attributes?.position;
      if(!pos)continue;mesh.updateWorldMatrix(true,false);
      if(!geo.boundingBox)geo.computeBoundingBox();
      const n=mesh.isInstancedMesh?mesh.count:1, bounds=new T.Box3();
      for(let k=0;k<n;k++){
        matrix.copy(mesh.matrixWorld);
        if(mesh.isInstancedMesh){mesh.getMatrixAt(k,instance);matrix.multiply(instance);}
        bounds.copy(geo.boundingBox).applyMatrix4(matrix);
        if(bounds.max.x<anchor.x-extent||bounds.min.x>anchor.x+extent||
          bounds.max.z<anchor.z-extent||bounds.min.z>anchor.z+extent)continue;
        const idx=geo.index, count=idx?.count??pos.count;
        const verts=idx?new Array(pos.count):null;
        function read(i){
          if(!idx)return new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(matrix);
          const index=idx.getX(i);
          return verts[index]??(verts[index]=new T.Vector3().fromBufferAttribute(pos,index).applyMatrix4(matrix));
        }
        for(let i=0;i<count;i+=3){
          const a=read(i),b=read(i+1),c=read(i+2);
          const xmin=Math.max(anchor.x-extent,Math.min(a.x,b.x,c.x)),xmax=Math.min(anchor.x+extent,Math.max(a.x,b.x,c.x));
          const zmin=Math.max(anchor.z-extent,Math.min(a.z,b.z,c.z)),zmax=Math.min(anchor.z+extent,Math.max(a.z,b.z,c.z));
          if(xmin>xmax||zmin>zmax)continue;
          const face={a,b,c,seen:-1};
          for(let x=Math.floor(xmin/cellSize);x<=Math.floor(xmax/cellSize);x++)
            for(let z=Math.floor(zmin/cellSize);z<=Math.floor(zmax/cellSize);z++){
              const id=(z-minZ)*columns+x-minX;(cells[id]??=[]).push(face);
            }
        }
      }
    }
  }
  function surface(origin,dir,distance,outNormal){
    if(distance<.001)return distance;
    ray.set(origin,dir);let end=distance,closestFace=null,closestSolid=null;
    for(const s of direct){
      const p=s.isBox3?ray.intersectBox(s,point):ray.intersectSphere(s,point);
      if(!p)continue;
      const t=origin.distanceTo(p);
      if(t<=end){end=t;closestSolid=s;if(outNormal)savedPoint.copy(p);}
    }
    if(cells.length){
      version++;
      let x=Math.floor(origin.x/cellSize),z=Math.floor(origin.z/cellSize);
      const sx=Math.sign(dir.x),sz=Math.sign(dir.z);
      const dx=sx?cellSize/Math.abs(dir.x):Infinity,dz=sz?cellSize/Math.abs(dir.z):Infinity;
      let tx=sx?((x+(sx>0?1:0))*cellSize-origin.x)/dir.x:Infinity;
      let tz=sz?((z+(sz>0?1:0))*cellSize-origin.z)/dir.z:Infinity;
      for(let travelled=0;travelled<=end;){
        const bucket=x>=minX&&x<=maxX&&z>=minZ&&z<=maxZ&&cells[(z-minZ)*columns+x-minX];
        if(bucket)for(const face of bucket){
          if(face.seen===version)continue;face.seen=version;
          if(!ray.intersectTriangle(face.a,face.b,face.c,false,point))continue;
          const t=point.distanceTo(origin);
          if(t<=end){end=t;closestFace=face;}
        }
        if(tx<tz){travelled=tx;tx+=dx;x+=sx;}else{travelled=tz;tz+=dz;z+=sz;}
      }
    }
    if(outNormal&&(closestFace||closestSolid)){
      if(closestFace){
        outNormal.subVectors(closestFace.b,closestFace.a).cross(edge.subVectors(closestFace.c,closestFace.a)).normalize();
      }else if(closestSolid.isSphere)outNormal.subVectors(savedPoint,closestSolid.center).normalize();
      else{
        const lo=closestSolid.min,hi=closestSolid.max,p=savedPoint;
        const x=Math.min(Math.abs(p.x-lo.x),Math.abs(p.x-hi.x));
        const y=Math.min(Math.abs(p.y-lo.y),Math.abs(p.y-hi.y));
        const z=Math.min(Math.abs(p.z-lo.z),Math.abs(p.z-hi.z));
        if(x<=y&&x<=z)outNormal.set(1,0,0);else if(y<=z)outNormal.set(0,1,0);else outNormal.set(0,0,1);
      }
      if(outNormal.dot(dir)>0)outNormal.negate();
    }
    return end;
  }
  function hit(origin,dir,distance,groundClearance=.045){
    if(distance<.001)return distance;
    const end=surface(origin,dir,distance);
    const samples=Math.max(1,Math.ceil(end/.71));
    for(let i=1;i<=samples;i++){
      const t=end*i/samples,x=origin.x+dir.x*t,z=origin.z+dir.z*t;
      if(origin.y+dir.y*t>=heightAt(x,z)+groundClearance)continue;
      let low=end*(i-1)/samples,high=t;
      for(let j=0;j<5;j++){
        const m=(low+high)*.5;
        if(origin.y+dir.y*m<heightAt(origin.x+dir.x*m,origin.z+dir.z*m)+groundClearance)high=m;
        else low=m;
      }
      return high;
    }
    return end;
  }
  const direction=new T.Vector3();
  function clear(a,b,margin=.045) {
    const length=direction.subVectors(b,a).length();if(length<.006)return true;
    direction.multiplyScalar(1/length);return hit(a,direction,length,margin)>=length-.012;
  }
  return {rebuild,hit,clear,surface};
}
