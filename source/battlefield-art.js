import {geologyMap,rockGeometry} from './rocks.js';
import {sectors} from './campaign.js';

const turn=Math.PI*2;
const finish={
  shale:[.02,.91,0],ceramic:[.10,.62,0],bronze:[.56,.47,0],
  patina:[.39,.73,0],glass:[.48,.22,.15],light:[.26,.25,1.9],plant:[.00,.83,0]
};

function weatheredMaterial(T,clock){
  const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:1,side:T.DoubleSide});
  const grain=geologyMap(T);
  mat.onBeforeCompile=p=>{
    p.uniforms.fieldStone={value:grain};p.uniforms.fieldTime=clock;
    p.vertexShader='attribute vec4 treatment;varying vec3 fieldP;varying vec3 coat;uniform float fieldTime;\n'+
      p.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        coat=treatment.xyz;fieldP=position;
        transformed.x+=treatment.w*(.045*sin(fieldTime*.71+position.x*.37+position.y*.68)+.016*sin(position.z*1.9+fieldTime));
        transformed.z+=treatment.w*.037*sin(fieldTime*.81+position.x*.45+position.y*.4);`);
    p.fragmentShader='uniform sampler2D fieldStone;varying vec3 fieldP;varying vec3 coat;\n'+p.fragmentShader
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec3 N=normalize(cross(dFdx(fieldP),dFdy(fieldP)));
        vec3 weights=pow(abs(N),vec3(4.));weights/=max(.0001,dot(weights,vec3(1.)));
        vec3 sampleP=fieldP*.39;
        vec4 fleck=weights.x*texture2D(fieldStone,sampleP.zy)+weights.y*texture2D(fieldStone,sampleP.xz)+weights.z*texture2D(fieldStone,sampleP.xy);
        float weather=texture2D(fieldStone,vec2((fieldP.x+.63*fieldP.z)*.065,fieldP.y*.13+fieldP.z*.031)).g;
        float lichen=smoothstep(.56,.75,weather*.64+fleck.g*.36)*max(.07,N.y);
        float tarnish=smoothstep(.43,.71,weather*.59+fleck.b*.41)*smoothstep(.22,.5,coat.x);
        diffuseColor.rgb*=.58+.85*fleck.r;
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.47,.80,.71)+vec3(.018,.05,.04),tarnish*.63);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.152,.198,.076)*(.65+fleck.r*.6),lichen*.69*coat.y);
      `)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=clamp(coat.y*(.70+.46*fleck.a)+tarnish*.12,.18,.98);`)
      .replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
        metalnessFactor=coat.x*(1.-tarnish*.47);`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition),rx=cross(sy,normal),ry=cross(normal,sx);
        float det=dot(sx,rx);
        normal=normalize(normal-sign(det)*(rx*dFdx(fleck.a)+ry*dFdy(fleck.a))*mix(.017,.0034,coat.x)/max(.000001,abs(det)));`)
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        totalEmissiveRadiance+=diffuseColor.rgb*(coat.z+.026+.028*coat.x);`);
  };
  return mat;
}

// Everything in a precinct shares a single material submission. Locations
// below are measured cross-track and down-range from its actual flight entry.
function workshop(T,site,heightAt,solids,material,root){
  const [x,z]=site.entry,length=Math.hypot(...site.heading),dx=site.heading[0]/length,dz=site.heading[1]/length;
  const yaw=Math.atan2(-dx,-dz),qSite=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw);
  const pos=[],nrm=[],rgb=[],coat=[],indices=[],q=new T.Quaternion(),scale=new T.Vector3(),point=new T.Vector3(),normal=new T.Vector3();
  const matrix=new T.Matrix4(),normatrix=new T.Matrix3(),color=new T.Color(),axis=new T.Vector3(0,1,0);
  const corner=new T.Vector3(),sideA=new T.Vector3(),sideB=new T.Vector3();
  const proxy=new T.MeshBasicMaterial();const unit=new T.BoxGeometry(1,1,1);
  let seed=site.code.charCodeAt(0)*13573;
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  function world(u,v){return [x-dz*u+dx*v,z+dx*u+dz*v];}
  function ground(u,v){const p=world(u,v);return heightAt(...p);}
  function loc(u,v,y){const [a,b]=world(u,v);return new T.Vector3(a,y,b);}
  function write(g,m,tint,skin,flex=0){
    const p=g.attributes.position,n=g.attributes.normal,vc=g.attributes.color,start=pos.length/3;
    const elementColor=new T.Color(tint),attr=finish[skin];normatrix.getNormalMatrix(m);
    for(let i=0;i<p.count;i++){
      point.fromBufferAttribute(p,i).applyMatrix4(m);normal.fromBufferAttribute(n,i).applyMatrix3(normatrix).normalize();
      color.copy(elementColor);if(vc)color.multiply(new T.Color(vc.getX(i),vc.getY(i),vc.getZ(i)));
      pos.push(point.x,point.y,point.z);nrm.push(normal.x,normal.y,normal.z);rgb.push(color.r,color.g,color.b);
      coat.push(...attr,flex);
    }
    if(g.index){for(const i of g.index.array)indices.push(start+i);}else{for(let i=0;i<p.count;i++)indices.push(start+i);}
  }
  function object(u,v,y,angle=0,pitch=0,roll=0){
    const orientation=qSite.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(pitch,angle,roll,'YXZ')));
    return new T.Matrix4().compose(loc(u,v,y),orientation,new T.Vector3(1,1,1));
  }
  function part(origin,g,p,s,hue,skin,angles,flex=0){
    q.setFromEuler(new T.Euler(...(angles??[0,0,0])));
    matrix.compose(point.set(...p),q,scale.set(...s)).premultiply(origin);
    write(g,matrix,hue,skin,flex);
  }
  function box(origin,p,s,hue,skin='ceramic',angles){part(origin,unit,p,s,hue,skin,angles);}
  function hull(origin,p,s,rotation){
    q.setFromEuler(new T.Euler(...(rotation??[0,0,0])));
    const m=new T.Matrix4().compose(new T.Vector3(...p),q.clone(),new T.Vector3(...s)).premultiply(origin);
    const collider=new T.Mesh(unit,proxy);collider.matrixAutoUpdate=false;collider.matrix.copy(m);
    solids.push(collider);
  }
  function rod(origin,a,b,r0,r1,hue,skin='bronze',sides=9,flex=0){
    const start=new T.Vector3(...a),end=new T.Vector3(...b),dir=end.clone().sub(start),len=dir.length();
    if(len<.0001)return;
    const g=new T.CylinderGeometry(r1,r0,len,sides),rot=new T.Quaternion().setFromUnitVectors(axis,dir.multiplyScalar(1/len));
    matrix.compose(start.lerp(end,.5),rot,scale.set(1,1,1)).premultiply(origin);
    write(g,matrix,hue,skin,flex);g.dispose();
  }
  function skin(origin,vertices,faces,hue,finishName='ceramic',flex=0){
    // Most worn seams, paving ribbons and facets are single flat polygons.
    // Append these directly to the district buffers instead of allocating a
    // temporary geometry and normal buffer for every edge of a flange.
    if(vertices.length<=4){
      const base=pos.length/3,attr=finish[finishName];color.set(hue);
      corner.fromArray(vertices[faces[0]]);sideA.fromArray(vertices[faces[1]]).sub(corner);sideB.fromArray(vertices[faces[2]]).sub(corner);
      normal.crossVectors(sideA,sideB).applyMatrix3(normatrix.getNormalMatrix(origin)).normalize();
      for(const vertex of vertices){
        point.fromArray(vertex).applyMatrix4(origin);pos.push(point.x,point.y,point.z);nrm.push(normal.x,normal.y,normal.z);
        rgb.push(color.r,color.g,color.b);coat.push(...attr,flex);
      }
      for(const i of faces)indices.push(base+i);
      return;
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices.flat(),3));
    g.setIndex(faces);g.computeVertexNormals();write(g,origin,hue,finishName,flex);g.dispose();
  }
  function layered(origin,points,levels,hues,skinType='ceramic'){
    // Polygon sections held apart by sunk bronze seams and a broken top edge.
    const cx=points.reduce((v,p)=>v+p[0]/points.length,0),cz=points.reduce((v,p)=>v+p[1]/points.length,0);
    const ring=([y,s,tilt=0])=>points.map(([x,z])=>[cx+(x-cx)*s,y+(x-cx)*tilt,cz+(z-cz)*s]);
    let last=ring(levels[0]);
    for(let k=1;k<levels.length;k++){
      const next=ring(levels[k]);for(let i=0;i<points.length;i++){
        const j=(i+1)%points.length;skin(origin,[last[i],next[i],next[j],last[j]],[0,1,2,0,2,3],hues[(k-1)%hues.length],skinType);
      }last=next;
    }
    const center=last.reduce((p,v)=>p.map((x,i)=>x+v[i]/last.length),[0,0,0]);
    for(let i=0;i<last.length;i++)skin(origin,[center,last[(i+1)%last.length],last[i]],[0,1,2],hues.at(-1),skinType);
  }
  function plate(origin,outline,z,thick,hue,skinType='bronze',bevel=.035){
    const path=new T.Shape();outline.forEach(([x,y],i)=>i?path.lineTo(x,y):path.moveTo(x,y));path.closePath();
    const g=new T.ExtrudeGeometry(path,{depth:thick,bevelEnabled:bevel>0,bevelSegments:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:2});
    part(origin,g,[0,0,z],[1,1,1],hue,skinType);g.dispose();
  }
  function band(origin,c,r,thick,depth,a,b,hue,skinType='bronze',z=.0){
    const n=Math.max(3,Math.ceil(Math.abs(b-a)*12)),a0=[],a1=[],b0=[],b1=[];
    for(let j=0;j<=n;j++){const t=a+(b-a)*j/n,co=Math.cos(t),si=Math.sin(t);
      for(const [radius,height,ring] of [[r,-depth/2,a0],[r,depth/2,a1],[r-thick,-depth/2,b0],[r-thick,depth/2,b1]]){
        ring.push([c[0]+co*radius,c[1]+si*radius,c[2]+height+z]);}}
    for(let j=0;j<n;j++)for(const [aa,bb] of [[a0,a1],[a1,b1],[b1,b0],[b0,a0]]){
      skin(origin,[aa[j],bb[j],bb[j+1],aa[j+1]],[0,1,2,0,2,3],hue,skinType);}
    for(const j of [0,n])skin(origin,[a0[j],a1[j],b1[j],b0[j]],[0,1,2,0,2,3],hue,skinType);
  }
  function stone(origin,p,s,seed,angle=0){
    const g=rockGeometry(T,seed,1);part(origin,g,p,s,'#e3e0c8','shale',[0,angle,0]);g.dispose();
  }
  function leaf(origin,base,direction,width,hue,hang=.08){
    const a=new T.Vector3(...base),d=new T.Vector3(...direction),mid=a.clone().addScaledVector(d,.46);
    const tangent=new T.Vector3(d.z*.7+.09,-d.y*.035,-d.x).normalize().multiplyScalar(width);
    const tip=a.clone().add(d);tip.y-=hang;
    const fold=mid.clone();fold.y+=width*.40;
    const left=mid.clone().add(tangent),right=mid.clone().sub(tangent);
    skin(origin,[a.toArray(),left.toArray(),fold.toArray(),right.toArray(),tip.toArray()],
      [0,1,2,0,2,3,2,1,4,2,4,3],hue,'plant',.7);
  }
  function creeper(origin,start,length,phase,color){
    let p=start;
    for(let i=1;i<=13;i++){
      const t=i/13,next=[start[0]+(.16*Math.sin(phase+t*5)+.23*Math.sin(phase+t*2))*t,
        start[1]-length*t,start[2]+.11*Math.sin(t*7+phase)];
      rod(origin,p,next,.024*(1-t*.68),.021*(1-t*.68),color,'plant',5,.45);
      for(const side of [-1,1]){
        const fan=(.15+rand()*.21)*(1-t*.45);leaf(origin,next,[side*fan,.13+rand()*.11,.18+rand()*.14],
          .044+rand()*.041,rand()<.55?'#636f34':'#818347',.092);}
      p=next;
    }
  }
  function trace(path,width,hue,skinType='bronze',rise=.045){
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(d/.65));
      const du=(b[1]-a[1])*width/(2*d),dv=(a[0]-b[0])*width/(2*d);
      for(let j=0;j<n;j++){
        const verts=[[j/n,-1],[j/n,1],[(j+1)/n,1],[(j+1)/n,-1]].map(([t,s])=>{
          const u=a[0]+(b[0]-a[0])*t+du*s,v=a[1]+(b[1]-a[1])*t+dv*s;
          return loc(u,v,ground(u,v)+rise).toArray();});
        skin(identity,verts,[0,1,2,0,2,3],hue,skinType);
      }
    }
  }
  const identity=new T.Matrix4();
  function complete(){
    const geo=new T.BufferGeometry();
    for(const [name,data,n] of [['position',pos,3],['normal',nrm,3],['color',rgb,3],['treatment',coat,4]])
      geo.setAttribute(name,new T.Float32BufferAttribute(data,n));
    geo.setIndex(indices);geo.computeBoundingSphere();geo.computeBoundingBox();
    const mesh=new T.Mesh(geo,material);mesh.name=site.name+' · field antiquities';
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
    return {mesh,x,z};
  }
  return {world,ground,object,part,box,hull,rod,skin,layered,plate,band,stone,leaf,creeper,trace,rand,complete};
}

const dark='#414d47',lightStone='#a9a995',chalk='#d0c8a4',bronze='#a18a63',gilt='#c2ab73',oxide='#54756d';
const footprint=[[-1.7,-.75],[-.81,-1.08],[.97,-1.02],[1.62,-.51],[1.54,.51],[.66,.92],[-1.34,.86],[-1.82,.35]];
function ruinedFoot(b,m,scale=1){
  const p=footprint.map(([x,z])=>[x*scale,z*scale]);
  b.layered(m,p,[[-.49,1.01],[.27,1.08],[.36,1.01],[.44,.96],[.52,1.00],[.92,.96],[1.00,.88]],
    ['#747a69','#969981','#626f61','#8c907c','#a2a38c','#aaa994'],'shale');
}
function rangefinder(b){
  const u=-7.70,v=13.0,m=b.object(u,v,b.ground(u,v)-.08,-.17,0,-.045);
  m.scale({x:1.13,y:1.20,z:1.11});
  ruinedFoot(b,m,1.04);b.hull(m,[0,.51,0],[3.14,1.26,1.66]);
  // The sight is missing its forward quadrant. Two insulated needles still
  // converge upon the small quartz point that once registered the gate.
  b.plate(m,[[-1.06,.91],[-.77,2.11],[-.49,2.51],[-.21,2.48],[-.18,1.64],[.43,1.24],[.78,.94]],
    -.40,.54,'#858b77','ceramic',.075);
  const center=[.05,2.76,-.04];
  b.band(m,center,1.45,.32,.34,1.16,5.26,'#6b766a','ceramic');
  b.band(m,center,1.48,.084,.39,1.29,3.26,bronze);
  b.band(m,center,1.19,.055,.35,2.04,5.20,gilt);
  b.band(m,center,1.45,.12,.53,3.47,4.69,'#999d88','ceramic');
  b.band(m,center,1.38,.047,.052,1.29,2.96,'#b5aa7c','bronze',.202);
  b.band(m,center,1.33,.025,.051,3.52,4.26,'#8bb4a4','glass',.206);
  // Surviving pieces of the pale enamel facing catch the grazing light.
  for(const [a,c] of [[1.16,1.68],[1.76,2.10],[2.20,2.54],[2.62,2.87]]){
    b.band(m,center,1.46,.135,.043,a,c,'#b9bc9f','ceramic',.187);
  }
  for(let i=0;i<24;i++){
    const t=1.32+i*.157,r=i%4===0?1.30:1.36;
    b.rod(m,[.05+r*Math.cos(t),2.76+r*Math.sin(t),.17],[.05+1.43*Math.cos(t),2.76+1.43*Math.sin(t),.17],
      .014,.016,i%4===0?gilt:dark,'bronze',5);}
  b.rod(m,[-1.20,2.31,-.04],[.16,2.78,.06],.057,.020,bronze);
  b.rod(m,[-.54,1.61,.00],[.16,2.78,.06],.051,.024,gilt);
  b.rod(m,[.16,2.48,.07],[.16,2.77,.07],.015,.126,'#83cec1','glass',6);
  b.rod(m,[.16,2.77,.07],[.16,3.06,.07],.126,.006,'#c0edca','light',6);
  b.rod(m,[-.58,1.81,.27],[-.64,2.28,.37],.027,.018,bronze);
  b.rod(m,[-.64,2.28,.37],[.09,2.69,.16],.020,.014,bronze);
  b.hull(m,[-.94,2.05,-.03],[.65,2.08,.48],[0,0,-.18]);
  b.hull(m,[-.95,3.50,-.04],[.32,1.30,.37],[0,0,-.48]);
  for(let i=0;i<6;i++)b.creeper(m,[-1.13+i*.21,1.00,.67+Math.cos(i)*.12],.38+b.rand()*.77,i,'#596640');
  for(let i=0;i<3;i++)b.stone(m,[1.48+i*.46,-.09,.13+i*.23],[.82-i*.11,.53-i*.09,.70-i*.14],91+i);
  const other=b.object(8.55,17.3,b.ground(8.55,17.3),.34,0,.09);
  b.stone(other,[0,.15,0],[2.37,1.91,1.52],31,-.24);
  b.hull(other,[0,.59,0],[2.59,1.64,1.69],[0,-.18,.12]);
  b.plate(other,[[-.97,.32],[-.53,1.39],[.47,1.51],[.88,1.16],[.64,.63]],.91,.15,lightStone,'ceramic');
  for(let i=0;i<3;i++)b.box(other,[.04,.83+i*.15,1.107],[.71-i*.15,.033,.035],i===1?oxide:bronze);
  for(const [radius,a0,a1] of [[3.44,.29,1.31],[3.44,1.50,2.30],[3.80,.81,1.61]]){
    const p=[];for(let i=0;i<=16;i++){const a=a0+(a1-a0)*i/16;p.push([u+radius*Math.cos(a),v+radius*Math.sin(a)]);}
    b.trace(p,.14,'#a4a28b','ceramic',.12);
  }
}

function tideNursery(b){
  const u=-9.35,v=15.8,m=b.object(u,v,b.ground(u,v)-.27,.19,-.05,-.10);
  // Cross-section of a tidal filtering shell. Its pipes have been colonised
  // by the same fluted aquatic leaves as the conservatory beyond it.
  b.stone(m,[0,.26,0],[2.75,1.35,1.53],45,.18);
  for(let i=0;i<5;i++){
    const x=(i-2)*.55,h=[1.88,3.01,3.48,2.63,1.75][i],phase=i*1.32;
    const profile=[[.02,.20],[.31,.13],[.63,.108],[.81,.17],[.93,.31],[1,.48],[.981,.426],[.93,.265],[.84,.12]];
    const pt=(t,r,a)=>{
      const fan=Math.pow(t,2.7),scallop=fan*(.065*Math.sin(3*a+phase)+.026*Math.sin(7*a));
      return [x*(.74+fan*.62)+.13*Math.sin(t*3.4+phase)+r*Math.cos(a),
        .47+h*t+scallop-r*.26*Math.sin(a),
        -.04-i*.064+.20*Math.sin(t*3.62+phase)+r*Math.sin(a)];
    };
    const hues=['#759286','#82a395','#729c92','#92b5a1','#bdd2b2','#c6d5b9','#689d90','#427b75'];
    for(let band=1;band<profile.length;band++){
      const verts=[],faces=[];for(let j=0;j<=20;j++){
        const a=j*turn/20;verts.push(pt(...profile[band-1],a),pt(...profile[band],a));
        if(j){const n=j*2;faces.push(n-2,n-1,n+1,n-2,n+1,n);}
      }b.skin(m,verts,faces,hues[band-1],band===5?'glass':'ceramic');
    }
    for(let j=0;j<5;j++){
      const a=j*turn/5+phase;
      b.rod(m,pt(.68,.119,a),pt(.86,.219,a),.012,.013,'#70b8ab','glass',5);
      b.rod(m,pt(.86,.219,a),pt(.975,.407,a),.013,.009,'#a0d6bf','glass',5);
    }
    const base=pt(.11,.12,0);
    for(const side of [-1,1])b.leaf(m,base,[side*(.43+b.rand()*.27),.94+b.rand()*.24,.22],.12,'#83a999',.16);
  }
  b.hull(m,[0,1.15,-.08],[2.21,2.90,.69],[.0,0,-.07]);
  b.hull(m,[.02,2.83,-.12],[.43,1.51,.36],[0,0,-.07]);
  for(let i=0;i<11;i++){
    const a=i*.61,r=.44+b.rand()*.81,x=Math.cos(a)*r,z=.46+Math.sin(a)*.48,h=.41+b.rand()*.9;
    for(let j=0;j<4;j++){const ang=a+j*1.37;
      b.leaf(m,[x,.49,z],[Math.cos(ang)*.45,h*(.61+b.rand()*.55),Math.sin(ang)*.45],.105,'#628779',.17);}
    b.rod(m,[x,.45,z],[x+.16,h+.62,z-.07],.027,.019,'#58867c','plant',6,.6);
    b.rod(m,[x+.16,h+.55,z-.07],[x+.18,h+.81,z-.09],.051,.012,'#9be9d2','glass',7,.6);
  }
  const o=b.object(8.9,21.8,b.ground(8.9,21.8)-.26,-.37,.13,.13);
  b.layered(o,footprint,[[-.45,1.12],[.37,1.13],[.46,.90],[.58,1.01],[1.01,.72],[1.13,.53]],
    ['#536c65','#98afa0','#547f77','#748c7e','#bac5ac'],'shale');
  b.hull(o,[0,.36,0],[2.83,1.32,1.46]);
  for(let i=0;i<6;i++)b.creeper(o,[-.97+i*.33,.92,.47],.37+b.rand()*.53,i+2,'#5f8270');
  for(let j=0;j<2;j++)b.trace([[-9.7+j*.44,17.8],[-8.2+j*.44,19],[-7.5+j*.44,20.6],[-7.8+j*.44,23],[-6.5+j*.44,25]],.11,
    j?'#9bb8a6':'#60847c','ceramic',.15);
}

function helioWreck(b){
  const u=8.50,v=15.15,m=b.object(u,v,b.ground(u,v)-.18,.49,-.29,-.29);
  b.stone(m,[0,.14,-.13],[2.44,1.15,1.77],56,.91);
  b.hull(m,[0,.43,0],[3.50,1.27,2.12]);
  // Half of a parabolic collector lies across its rack. Each narrow facet
  // shares a focal point, including the empty sockets left by stolen glass.
  const rim=2.02,cy=1.48;
  const dish=(r,a,z=0)=>[r*Math.cos(a),cy+r*Math.sin(a),.20*r*r+z];
  for(let j=0;j<13;j++){
    const a=-.49+j*.247,c=a+.228;
    for(let band=0;band<2;band++){
      if((j+2*band)%9===2)continue;
      const low=band?1.14:.45,high=band?rim:1.09;
      b.skin(m,[dish(low,a),dish(high,a),dish(high,c),dish(low,c)],[0,1,2,0,2,3],
        ['#b3a882','#9c946e','#bcc4a5','#889686'][(j+3*band)%4],'glass');}
    if(j===1||j===6||j===9){
      const p=dish(1.31,a+.025,.014),q=dish(1.53,a+.095,.014),n=dish(1.91,a+.061,.014);
      b.rod(m,p,q,.013,.009,'#e2c794','ceramic',5);b.rod(m,q,n,.010,.005,'#e1d3a0','ceramic',5);
    }
    b.rod(m,dish(.40,a,-.044),dish(rim+.035,a,-.044),.046,.036,bronze,'bronze',7);
    b.rod(m,dish(rim,a),dish(rim,c),.053,.045,chalk,'ceramic',8);
  }
  b.rod(m,[0,.69,-.34],[.03,cy,.13],.19,.24,dark,'patina',12);
  b.rod(m,[.01,cy,.11],[.04,cy+.095,1.34],.11,.075,bronze,'bronze',10);
  b.rod(m,[.04,cy+.095,1.32],[.04,cy+.11,1.44],.16,.12,'#ffd799','glass',10);
  for(const t of [.32,1.91,2.45])b.rod(m,dish(rim*.85,t),[.04,cy+.08,1.23],.025,.022,gilt,'bronze',6);
  b.hull(m,[.07,1.78,.43],[2.98,1.48,.32],[-.05,0,.19]);
  const o=b.object(-9.9,14.6,b.ground(-9.9,14.6)-.35,.30,0,-.05);
  b.layered(o,footprint.map(([x,z])=>[x*1.26,z]),[[-.37,1.02],[.42,1.03],[.58,.92],[.72,.97],[1.22,.92],[1.29,.83]],
    ['#595d53','#a39a7c','#5d6458','#8e7c60','#baa581'],'ceramic');
  b.hull(o,[0,.51,0],[3.62,1.61,1.52]);
  for(let j=0;j<5;j++){
    b.box(o,[-1.32+j*.57,1.29,.02],[.38,.063,.83],dark,'patina');
    b.box(o,[-1.32+j*.57,1.335,.05],[.24,.018,.60],j%2?'#af8249':'#bf965d','bronze');
  }
  b.trace([[-8.7,17.1],[-9.1,19.1],[-10.2,20.4],[-10.42,23.9]],.18,'#b29b77','ceramic',.14);
}

function buriedSkiff(b){
  const u=5.97,v=19.1,m=b.object(u,v,b.ground(u,v)-.20,-.29,.085,.04);
  const stations=[[-4.10,.14,.43],[-2.86,.74,1.17],[-1.63,1.04,1.62],[-.15,1.17,1.88],[1.17,1.02,1.53],[2.55,.77,1.29],[3.39,.53,1.11]];
  const rib=(p,angle)=>[p[0],p[2]*(.55+.52*Math.sin(angle)),p[1]*Math.cos(angle)];
  for(let j=0;j<stations.length;j++){
    const p=stations[j];
    for(let k=0;k<8;k++){
      const a=-2.70+k*.54,c=a+.54,p0=rib(p,a),p1=rib(p,c);
      b.rod(m,p0,p1,.065,.055,j%2?bronze:'#81928a','bronze',7);
      if(j===stations.length-1||(j===4||j===5)&&k>3)continue;
      const q=stations[j+1];
      b.skin(m,[p0,rib(q,a),rib(q,c),p1],[0,1,2,0,2,3],['#727f77','#9d9e85','#689087','#9b9479'][(j+Math.floor(k/2))%4],'patina');
    }
  }
  b.plate(m,[[-3.28,.72],[-1.51,1.57],[.16,1.87],[1.33,1.67],[1.65,1.87],
    [.63,2.32],[-.36,2.21],[-1.86,1.80]],-.14,.20,'#b3aa85','ceramic',.025);
  b.plate(m,[[.19,1.76],[1.34,1.64],[2.35,2.44],[2.73,4.21],[2.13,3.82],[1.36,2.58]],
    -.29,.24,'#849085','patina',.059);
  b.plate(m,[[1.53,2.40],[2.23,3.66],[2.37,3.77],[2.21,2.92],[1.89,2.48]],-.035,.075,bronze,'bronze');
  b.rod(m,[-3.46,.67,.48],[-1.03,1.53,.80],.054,.046,'#bbc2ac','ceramic');
  b.rod(m,[-.13,1.60,.78],[1.29,1.26,.80],.061,.035,'#9da488','ceramic');
  b.plate(m,[[-4.42,.31],[-4.61,.47],[-4.27,.68],[-2.48,1.13],[-2.08,1.00],[-3.00,.65]],.10,.13,'#b6aa83','bronze');
  const canopy=[[-1.50,1.36,.57],[-.94,1.77,.51],[-.31,1.86,.39],[.17,1.76,.46],[.64,1.39,.68],[.23,1.30,.86],[-.80,1.30,.79]];
  b.skin(m,canopy,[0,1,6,1,2,6,2,3,5,2,5,6,3,4,5],'#608e87','glass');
  for(let j=0;j<6;j++)b.rod(m,canopy[j],canopy[(j+1)%7],.042,.035,'#bab596','ceramic',7);
  for(let j=0;j<4;j++)b.rod(m,[.61+j*.23,.70,.99-j*.035],[.73+j*.23,1.01,.97-j*.038],.025,.016,'#a7af94','ceramic',6);
  b.hull(m,[-.56,.57,0],[5.20,1.43,1.45],[0,0,.06]);
  b.hull(m,[1.94,2.54,-.14],[.47,2.02,.32],[0,0,-.42]);
  for(let j=0;j<7;j++)b.creeper(m,[-1.13+j*.47,1.24+.30*Math.sin(j*.68),.77],.48+b.rand()*.81,j*.78,'#637853');
  b.stone(m,[3.03,-.06,.14],[1.92,1.22,1.38],74,.73);
  const o=b.object(-11.4,20.7,b.ground(-11.4,20.7)-.17,.87,0,-.16);
  b.stone(o,[0,.23,0],[2.35,1.78,1.33],63,.34);b.hull(o,[0,.63,0],[2.95,1.65,1.59]);
  b.rod(o,[-1.87,.59,.08],[.58,1.84,-.18],.13,.065,'#7c8781','patina');
  for(let j=0;j<3;j++)b.box(o,[.66+j*.31,.58,-.04],[.072,.64,.68],bronze,'bronze',[.12,0,.42]);
}

function gateLock(b){
  const u=-11.8,v=19.8,m=b.object(u,v,b.ground(u,v),-.23);
  ruinedFoot(b,m,1.30);
  b.hull(m,[0,.49,0],[3.84,1.13,1.72]);
  b.plate(m,[[-1.19,.96],[-.90,2.00],[-.52,3.85],[.05,4.42],[.30,4.27],[.13,3.17],
    [.49,2.71],[.54,1.68],[.95,1.15],[.63,.94]],-.53,.81,'#a5a48d','ceramic',.09);
  b.plate(m,[[-.66,1.22],[-.49,2.23],[-.16,3.36],[.009,3.48],[-.16,2.60],[.18,2.17],[.13,1.24]],
    .32,.076,dark,'patina',.035);
  for(let j=0;j<7;j++){
    const y=1.35+j*.275,shift=-.29+(j-3)*.028;
    b.box(m,[shift,y,.425],[.37-j*.025,.085,.074],j===4?'#c4d8aa':gilt,j===4?'glass':'bronze',[0,0,.13]);
  }
  b.rod(m,[-.81,1.32,.25],[-.40,3.49,.18],.043,.036,bronze);
  b.plate(m,[[-1.36,1.09],[-1.47,1.56],[-1.15,2.18],[-1.03,2.74],[-.81,2.53],[-.87,1.74],[-.75,1.17]],
    -.19,.27,'#afb098','ceramic',.045);
  b.rod(m,[-1.09,2.48,.12],[-.65,3.04,.06],.034,.027,gilt);
  b.rod(m,[-.86,2.76,.09],[-.86,2.27,.09],.013,.014,bronze,'bronze',6);
  b.rod(m,[-.86,2.02,.09],[-.86,2.23,.09],.035,.083,gilt);
  b.rod(m,[-.86,2.23,.09],[-.86,2.32,.09],.083,.020,gilt);
  b.hull(m,[-.24,2.28,-.04],[1.08,2.87,.78],[0,0,-.13]);
  b.hull(m,[-.34,3.81,-.07],[.36,.85,.59],[0,0,-.21]);
  b.stone(m,[-1.74,.10,.14],[1.0,.78,.89],65,.93);
  const o=b.object(12,14.2,b.ground(12,14.2)-.12,.36,.09,.03);
  b.stone(o,[0,.18,0],[2.27,1.22,1.37],88,.25);
  b.plate(o,[[-1.38,.56],[-.75,1.15],[.87,1.26],[1.25,.91],[.71,.58]],.26,.41,'#9c9b82','ceramic');
  for(let j=0;j<4;j++)b.box(o,[-.65+j*.34,.91,.706],[.12,.23,.052],bronze,'bronze',[0,0,-.21]);
  b.hull(o,[0,.55,0],[3.12,1.39,1.56]);
  for(let j=0;j<3;j++)b.trace([[-11.2+j*.24,21.1],[-9.3+j*.24,22.7],[-8.7+j*.24,23.8],[-8.65+j*.24,26.0]],.072,
    j===1?'#a4c5ae':'#9f9373',j===1?'glass':'bronze',.17);
}

export function buildBattlefieldArt(T,scene,heightAt){
  const root=new T.Group();root.name='Campaign field antiquities';scene.add(root);
  const clock={value:0},material=weatheredMaterial(T,clock),solids=[],districts=[];
  const craft={garden:rangefinder,tide:tideNursery,forge:helioWreck,ridge:buriedSkiff,gate:gateLock};
  for(const sector of sectors){
    const shop=workshop(T,sector,heightAt,solids,material,root);
    craft[sector.id](shop);districts.push({...shop.complete(),id:sector.id});
  }
  return {root,solids,update(time,camera,sectorId){
    clock.value=time;if(!camera)return;
    for(const d of districts){
      const dx=camera.position.x-d.x,dz=camera.position.z-d.z;
      d.mesh.visible=sectorId===d.id||dx*dx+dz*dz<155*155;
    }
  }};
}
