import {forgeMachine} from './machine-forging.js';

// Shared blueprints keep each actor at three opaque submissions.
export function machineFactory(T) {
  const shellMat = new T.MeshStandardMaterial({vertexColors:true, roughness:.69, metalness:.35, side:T.DoubleSide});
  const surfaceSize=128,surfaceData=new Uint8Array(surfaceSize*surfaceSize*4);
  let seed=28879;
  const rnd=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
  const grain=[];
  for(let i=0;i<surfaceSize;i++)grain.push(rnd());
  for(let y=0;y<surfaceSize;y++)for(let x=0;x<surfaceSize;x++){
    const index=(y*surfaceSize+x)*4;
    const fleck=rnd(),stain=Math.sin(x*.09817+Math.cos(y*.14726))*.5+.5;
    surfaceData[index]=80+78*fleck+55*grain[y]+28*stain;
    surfaceData[index+1]=127+83*stain-51*fleck;surfaceData[index+2]=100+60*grain[y]+62*fleck;
    surfaceData[index+3]=255;
  }
  for(let i=0;i<190;i++){
    const x=Math.floor(rnd()*128),y=Math.floor(rnd()*128),n=2+Math.floor(rnd()*12);
    for(let j=0;j<n;j++)surfaceData[(y*128+(x+j)%128)*4]=i%3===0?48:238;
  }
  const surface=new T.DataTexture(surfaceData,surfaceSize,surfaceSize);
  surface.wrapS=surface.wrapT=T.RepeatWrapping;surface.magFilter=T.LinearFilter;
  surface.minFilter=T.LinearMipmapLinearFilter;surface.anisotropy=4;surface.generateMipmaps=true;surface.needsUpdate=true;
  shellMat.onBeforeCompile=shader=>{
    shader.uniforms.alloyGrain={value:surface};
    shader.vertexShader='varying vec3 alloyPoint;varying vec3 alloyNormal;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\nalloyPoint=position;alloyNormal=normal;');
    shader.fragmentShader='varying vec3 alloyPoint;varying vec3 alloyNormal;uniform sampler2D alloyGrain;\n'+
      shader.fragmentShader.replace('#include <color_fragment>',`
        #include <color_fragment>
        vec3 aw=pow(abs(normalize(alloyNormal)),vec3(4.));aw/=max(.001,dot(aw,vec3(1.)));
        vec3 grain=texture2D(alloyGrain,alloyPoint.zy*1.24).rgb*aw.x+
          texture2D(alloyGrain,alloyPoint.xz*1.24).rgb*aw.y+
          texture2D(alloyGrain,alloyPoint.xy*1.24).rgb*aw.z;
        diffuseColor.rgb*=.50+.73*grain.r;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.068,.089,.075),
          smoothstep(.56,.79,grain.g)*.34);
      `).replace('#include <normal_fragment_maps>',`
        #include <normal_fragment_maps>
        vec3 dpdx=dFdx(-vViewPosition),dpdy=dFdy(-vViewPosition);
        vec3 tangentX=cross(dpdy,normal),tangentY=cross(normal,dpdx);
        float handed=dot(dpdx,tangentX);
        vec3 relief=tangentX*dFdx(grain.r)+tangentY*dFdy(grain.r);
        normal=normalize(normal-.0022*sign(handed)*relief/max(abs(handed),.000001));
      `).replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor*=.65+.64*grain.b;');
  };
  const metal = ['#b49a69','#817a62','#d9c4a0','#514e43','#323c3c','#a9a992'];
  const axis = new T.Vector3(0,1,0);
  function assembly() {
    const position=[],normal=[],color=[],indices=[];
    function put(geo, p, scale, rot, hue) {
      const base=position.length/3;
      const q=rot?.isQuaternion?rot:new T.Quaternion().setFromEuler(new T.Euler(...(rot||[0,0,0])));
      geo.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...p),q,new T.Vector3(...scale)));
      const pos=geo.attributes.position,n=geo.attributes.normal,c=new T.Color(hue);
      for(let i=0;i<pos.count;i++){
        position.push(pos.getX(i),pos.getY(i),pos.getZ(i)); normal.push(n.getX(i),n.getY(i),n.getZ(i));
        color.push(c.r,c.g,c.b);
      }
      if(geo.index){for(const i of geo.index.array)indices.push(base+i);}
      else{for(let i=0;i<pos.count;i++)indices.push(base+i);}
      geo.dispose();
    }
    function wing(points, back, front, hue, az=0) {
      const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
      const g=new T.ExtrudeGeometry(shape,{depth:front-back,bevelEnabled:true,bevelSegments:1,bevelSize:.032,bevelThickness:.032,curveSegments:1});
      put(g,[0,0,back],[1,1,1],[0,0,az],hue);
    }
    function torus(r,t,z,hue,start=0,length=Math.PI*2) {
      put(new T.TorusGeometry(r,t,5,Math.max(4,Math.ceil(length*9)),length),[0,0,z],[1,1,1],[0,0,start],hue);
    }
    function rod(a,b,width,hue) {
      const v=new T.Vector3(...a),w=new T.Vector3(...b),d=w.clone().sub(v),c=v.lerp(w,.5);
      put(new T.CylinderGeometry(width,width*1.17,d.length(),5),c.toArray(),[1,1,1],new T.Quaternion().setFromUnitVectors(axis,d.normalize()),hue);
    }
    // The forged face blends between its center and edge normals. A narrow
    // bevel keeps a sharp change in finish on the flange and vertical cut.
    function carapace(points,ridge,depth,shades,mirror=1) {
      const p=points.map(([x,y,z])=>new T.Vector3(x*mirror,y,z));
      const c=new T.Vector3(ridge[0]*mirror,ridge[1],ridge[2]);
      const vA=new T.Vector3(),vB=new T.Vector3(),vN=new T.Vector3(),tint=new T.Color();
      function tri(a,b,c,hue,na,nb,nc) {
        if(mirror<0){[b,c]=[c,b];[nb,nc]=[nc,nb];}
        vN.crossVectors(vA.subVectors(b,a),vB.subVectors(c,a)).normalize();
        tint.set(hue);
        const normals=na?[na,nb,nc]:[vN,vN,vN];
        for(const [i,v] of [a,b,c].entries()){
          const n=normals[i];indices.push(position.length/3);position.push(v.x,v.y,v.z);
          normal.push(n.x,n.y,n.z);color.push(tint.r,tint.g,tint.b);
        }
      }
      const bevel=p.map(a=>{const v=a.clone().lerp(c,.066);v.z+=Math.min(.018,depth*.11);return v;});
      const facets=p.map((a,i)=>new T.Vector3().crossVectors(vA.subVectors(a,c),
        vB.subVectors(p[(i+1)%p.length],c)).normalize().multiplyScalar(mirror));
      const ridgeNormal=facets.reduce((n,f)=>n.add(f),new T.Vector3()).normalize();
      const edges=facets.map((f,i)=>f.clone().add(facets[(i+p.length-1)%p.length]).normalize());
      const base=new T.Color(0,0,0);for(const shade of shades)base.add(new T.Color(shade));base.multiplyScalar(1/shades.length);
      for(let i=0;i<p.length;i++){
        const j=(i+1)%p.length,b=p[i].clone(),d=p[j].clone();b.z-=depth;d.z-=depth;
        const face=base.clone().lerp(new T.Color(shades[i%shades.length]),.54),rim=face.clone().multiplyScalar(1.21);
        tri(c,bevel[i],bevel[j],face,ridgeNormal.clone().lerp(facets[i],.25).normalize(),edges[i],edges[j]);
        tri(bevel[i],p[i],p[j],rim);tri(bevel[i],p[j],bevel[j],rim);
        tri(p[i],b,d,'#404641');tri(p[i],d,p[j],'#484b43');
        if(i>0&&i<p.length-1)tri(p[0].clone().add(new T.Vector3(0,0,-depth)),d,b,'#5b5e54');
      }
    }
    function engine(x,y,z,size,hue) {
      put(new T.CylinderGeometry(.18,.245,.49,7),[x,y,z],[size,size,size],[.19,0,x>0?-.19:.19],'#373f3f');
      put(new T.CylinderGeometry(.236,.25,.084,9),[x,y-.16*size,z],[size,size,size],[.19,0,x>0?-.19:.19],hue);
      put(new T.CylinderGeometry(.145,.12,.10,8),[x,y-.23*size,z-.004],[size,size,size],[.19,0,x>0?-.19:.19],'#293331');
    }
    function finish() {
      const g=new T.BufferGeometry();
      for(const [name,array] of Object.entries({position,normal,color}))g.setAttribute(name,new T.Float32BufferAttribute(array,3));
      g.setIndex(indices);g.computeBoundingSphere();return g;
    }
    return {put,wing,torus,rod,carapace,engine,finish};
  }
  const data={};
  function blueprint(kind) {
    const hull=assembly(), dial=assembly(), lights=assembly(), pi=Math.PI;
    if(kind==='drone'||kind==='guard'){
      hull.put(new T.IcosahedronGeometry(1,0),[0,0,-.14],[.73,.68,.82],[.2,.23,.16],metal[3]);
      hull.torus(.38,.111,.51,metal[4]); hull.torus(.345,.041,.617,metal[2]);
      lights.put(new T.SphereGeometry(1,12,8),[0,0,.555],[.252,.252,.118],null,'#fffdf1');
      lights.torus(.305,.024,.622,'#ffce80');
      // An optical gimbal, dark aperture and small illuminated nucleus keep the
      // eye readable under the bright sky without flattening into a white coin.
      hull.put(new T.SphereGeometry(1,16,8),[0,0,.650],[.199,.199,.073],null,'#243432');
      lights.put(new T.SphereGeometry(1,12,8),[0,.015,.701],[.123,.114,.073],null,'#ffc875');
      for(let i=0;i<8;i++){
        const a=i*pi/4+.14;
        hull.put(new T.CylinderGeometry(.036,.047,.035,5),[.385*Math.cos(a),.385*Math.sin(a),.61],
          [1,1,1],[pi/2,0,0],i%2?'#3b423a':'#a39d80');
      }
      if(kind==='drone') {
        for(const s of [-1,1]){
          const rise=s<0?.17:-.035;
          // A swept rear stabiliser protrudes above an open central hinge.
          hull.carapace([[.53,.13,-.51],[.84,.19,-.66],[1.25,.54+rise,-.89],[1.13,.66+rise,-.90],
            [.68,.47,-.62]],[.81,.35,-.49],.105,['#343e3d','#758078','#a49f82'],s);
          hull.rod([s*.34,.032,-.08],[s*.98,.16,-.62],.118,'#4b5552');
          hull.put(new T.CylinderGeometry(.24,.24,.32,9),[s*.63,.07,-.02],[1,1,1],[0,0,pi/2],'#636b62');
          hull.put(new T.CylinderGeometry(.162,.162,.10,9),[s*.63,.07,.12],[1,1,1],[pi/2,0,0],'#303837');
          hull.put(new T.CylinderGeometry(.087,.10,.132,6),[s*.63,.07,.18],[1,1,1],[pi/2,.28,0],'#b2a891');
          // Facets rake backwards in depth. A missing tip on the port armour
          // makes the three-quarter silhouette intentionally asymmetric.
          const length=s<0?1.29:1.47;
          hull.carapace([[.75,.10,.025],[.89,-.145,.065],[1.16,-.052,-.07],[length,.22+rise,-.34],
            [length-.09,.35+rise,-.47],[.92,.33+rise,-.13]],
            [1.01,.11+rise,.16],.135,['#535b55','#aaa88f','#878777','#b9ab88','#6c7568','#b7b6a0'],s);
          hull.carapace([[.27,.29,.46],[.37,.045,.49],[.53,-.11,.28],[.60,.21,.20],[.46,.48,.22]],
            [.43,.26,.53],.14,['#a4997e','#716d59','#525c58','#9b9984','#b9af93'],s);
          hull.carapace([[.34,-.23,.30],[.37,-.57,.18],[.58,-.78,-.21],[.70,-.50,-.35],
            [.62,-.21,-.15]],[.50,-.44,.21],.18,['#4b5350','#999477','#6b736a','#8c8364'],s);
          hull.engine(s*.68,-.38,-.42,1.08,'#9b9278');
          lights.put(new T.CylinderGeometry(.112,.069,.16,8),[s*.68,-.658,-.435],[1,1,1],[.19,0,0],'#6cfff1');
          lights.rod([s*.978,.192+rise,.057],[s*1.108,.232+rise,-.008],.018,s<0?'#69ffe3':'#ff7a45');
        }
        dial.torus(.57,.041,.38,metal[0],.22,2.04);dial.torus(.57,.041,.38,metal[0],3.36,2.04);
        hull.rod([.02,-.4,-.20],[.095,-.88,-.22],.133,'#343c3a');
        hull.carapace([[-.08,-.60,-.11],[-.03,-1.05,-.24],[.14,-1.20,-.31],
          [.22,-.87,-.18],[.18,-.61,-.09]],[.085,-.78,.045],.20,['#7b7c69','#a69a79','#434c49','#8f8b74']);
        hull.rod([-.31,.35,-.36],[-.42,.72,-.52],.038,'#3b4544');
        lights.put(new T.SphereGeometry(.044,8,5),[-.42,.72,-.52],[1,1,1],null,'#76ffe0');
      } else {
        for(const s of [-1,1]){
          hull.wing([[.28,.54],[.70,1.04],[1.22,.73],[1.35,-.23],[.84,-.87],[.53,-.48],
            [.67,.14]].map(([x,y])=>[s*x,y]),-.46,.31,metal[5]);
          hull.wing([[.69,.81],[1.02,.65],[1.18,.03],[.92,.21]].map(([x,y])=>[s*x,y]),.30,.364,metal[0]);
          lights.rod([s*.95,.61,.38],[s*1.12,.03,.38],.033,'#b6ffe6');
          hull.rod([s*.38,.10,-.1],[s*.98,.28,-.17],.14,metal[4]);
          hull.carapace([[.62,.39,.32],[.67,.04,.36],[.86,-.18,.51],[1.16,.10,.35],
            [1.11,.46,.31]],[.90,.26,.72],.15,['#b4b69e','#545e59','#898e7c','#a69471'],s);
          hull.carapace([[.51,-.18,.20],[.44,-.66,.06],[.68,-.99,-.31],[.76,-.62,-.39],
            [.70,-.21,-.22]],[.60,-.49,.28],.22,['#717b72','#3d4744','#8f907c'],s);
          hull.engine(s*.74,-.72,-.36,1.37,'#a89c81');
          lights.put(new T.CylinderGeometry(.135,.088,.17,8),[s*.74,-1.066,-.39],[1,1,1],[.15,0,0],'#80ffe8');
          for(let j=0;j<3;j++)hull.rod([s*.78,.01-j*.11,.33],[s*1.13,.19-j*.11,.35],.026,'#444f4a');
        }
        hull.wing([[-.24,-.36],[.28,-.35],[.35,-.79],[.04,-1.18],[-.31,-.80]],-.27,.23,metal[0]);
        for(let i=0;i<3;i++)dial.torus(.66,.062,.30,metal[2],i*pi*2/3+.13,1.56);
      }
      if(kind==='guard'){
        for(const side of [-1,1]){
          hull.rod([side*.83,.67,.29],[side*1.16,.47,.32],.037,'#dad3a8');
          for(let j=0;j<4;j++)lights.rod([side*(.64+j*.068),.75-j*.062,.384],
            [side*(.67+j*.068),.72-j*.062,.384],.013,'#94ffe4');
        }
      }
    }else{
      forgeMachine(T,kind,hull,dial,lights);
    }
    return data[kind]={hull:hull.finish(),dial:dial.finish(),lights:lights.finish()};
  }
  const guardShell=new T.SphereGeometry(1,20,12);
  const shields={
    guard:[1.51,1.34,.91,'#79e2c8'],weaver:[1.31,1.47,.97,'#8aeacc'],
    tideBoss:[1.90,2.00,1.08,'#72e3d7'],forgeBoss:[1.93,1.66,1.29,'#ec9c65'],
    warden:[1.88,2.05,1.15,'#e6c483']
  };
  const shieldVertex=`
    varying vec3 vN;varying vec3 vEye;varying vec3 localP;
    void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);
    vEye=-p.xyz;localP=position;gl_Position=projectionMatrix*p;}`;
  const shieldFragment=`
    uniform float time;uniform float hit;uniform vec3 tint;varying vec3 vN;varying vec3 vEye;varying vec3 localP;
    void main(){float edge=pow(1.-abs(dot(normalize(vN),normalize(vEye))),2.1);
    float cells=abs(fract(localP.y*6.0+sin(localP.x*5.)*.27-time*.19)-.5);
    float stripe=1.-smoothstep(.012,.037,cells);
    float a=(.009+edge*.38+stripe*.046)*(1.+hit*.85);
    gl_FragColor=vec4(mix(tint,vec3(1.35,.91,.62),hit),a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`;
  return function make(kind) {
    const g=data[kind]??blueprint(kind),group=new T.Group();
    const shell=new T.Mesh(g.hull,shellMat),dial=new T.Mesh(g.dial,shellMat);
    shell.castShadow=shell.receiveShadow=dial.castShadow=dial.receiveShadow=true;
    const lightMat=new T.MeshBasicMaterial({color:0xffffff,vertexColors:true});
    const circuitPower={value:1};
    lightMat.onBeforeCompile=shader=>{
      shader.uniforms.circuitPower=circuitPower;
      shader.fragmentShader='uniform float circuitPower;\n'+shader.fragmentShader.replace(
        '#include <opaque_fragment>','outgoingLight*=circuitPower;\n#include <opaque_fragment>');
    };
    const core=new T.Mesh(g.lights,lightMat);group.add(shell,dial,core);
    let shield;
    const field=shields[kind];
    if(field){
      const shieldMat=new T.ShaderMaterial({uniforms:{time:{value:0},hit:{value:0},tint:{value:new T.Color(field[3])}},vertexShader:shieldVertex,
        fragmentShader:shieldFragment,transparent:true,depthWrite:false,side:T.FrontSide});
      shield=new T.Mesh(guardShell,shieldMat);
      shield.scale.set(field[0],field[1],field[2]);
      group.add(shield);
    }
    function animate(dt,age,charge=0,phase=1,hit=0){
      const breath=Math.sin(age*1.7);
      if(kind==='forgeBoss'){
        dial.rotation.y=.25*Math.sin(age*.72);dial.position.y=.035*breath+.09*charge;
      }else if(kind==='tideBoss'||kind==='weaver'){
        const tidal=kind==='tideBoss';
        dial.rotation.y=Math.sin(age*(tidal?.83:1.55))*(.24+.10*charge);
        dial.rotation.z=Math.sin(age*1.20)*.052;dial.scale.y=1+.035*breath+.075*charge;
      }else if(kind==='lancer'||kind==='skirmisher'||kind==='mortar'){
        dial.position.z=-.18*hit-.075*charge;
        dial.rotation.x=kind==='mortar'?-.22*charge+.035*breath:.023*breath;
      }else{
        const rate=kind==='warden'?.48:kind==='guard'?-.41:1.11;
        dial.rotation.z+=dt*rate*(1+charge*.8+Math.max(0,phase-1)*.23);
        dial.rotation.y=.17*Math.sin(age*.86);
      }
      circuitPower.value=1.44+.07*breath+.65*charge+.31*hit;
    }
    return {group,core,dial,shield,lightMat,animate,dispose(){ lightMat.dispose();shield?.material.dispose(); }};
  };
}
