// Silhouettes are in units of a boss's collision radius. The three assemblies
// share their small uniform block, and never borrow a light or a render target.
const stateGLSL=`
  uniform float age,still,arrival,shift,opening,exposed,charge,rank,visibility;
  float sat(float t){return clamp(t,0.,1.);}
`;
const toScreen=`
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;
function effectMaterial(T,uniforms,vertex,fragment,{opaque=false,add=false}={}){
  const mat=new T.ShaderMaterial({uniforms,
    vertexShader:stateGLSL+vertex,fragmentShader:stateGLSL+fragment,
    side:T.DoubleSide,transparent:!opaque,depthWrite:opaque,
    blending:add?T.AdditiveBlending:T.NormalBlending});
  mat.forceSinglePass=true;
  return mat;
}
function geometry(T,arrays,index){
  const geo=new T.BufferGeometry();
  for(const [name,values,size] of arrays)geo.setAttribute(name,new T.Float32BufferAttribute(values,size));
  geo.setIndex(index);
  // Authored coordinates expand in the shader, including ascent of the forge
  // sparks. This local sphere remains valid while the camera circles the boss.
  geo.boundingSphere=new T.Sphere(new T.Vector3(0,.35,0),3.9);
  return geo;
}
function veilGeometry(T){
  const position=[],params=[],index=[];
  for(const side of [-1,1]){
    for(let plume=0;plume<7;plume++){
      const rows=34,cols=plume<4?4:1,start=position.length/3;
      for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
        position.push(i/rows,j/cols*2-1,0);params.push(side,plume);
        if(i&&j){
          const a=start+(i-1)*(cols+1)+j-1,b=a+cols+1;
          index.push(a,b,a+1,a+1,b,b+1);
        }
      }
    }
  }
  return geometry(T,[['position',position,3],['plume',params,2]],index);
}
function tideWeave(T,uniforms){
  const material=effectMaterial(T,uniforms,`
    attribute vec2 plume;varying vec4 silk;varying float salt;
    void main(){
      float u=position.x,v=position.y,side=plume.x,j=mod(plume.y,4.),fine=step(3.5,plume.y);
      float ripple=age*(1.-still),pi=3.141593;
      float lag=side*.38+j*.64;
      float spread=.60+.16*arrival+.12*shift+.22*opening+.09*charge;
      float breathe=.06*(1.-still)*sin(ripple*1.49+lag+u*4.9);
      float arch=sin(pi*u);
      // Tangents first splay out from the shoulders, then curl down around
      // the fan. Free ends bend in depth, exposing the reverse of the silk.
      float x=.48+.066*j+u*(.56+.145*j)+.38*arch+spread*.36*arch;
      float y=.27+.09*j+.39*arch-.34*u+.64*sin(u*4.71+.25*j)*u+(.21-j*.08)*u*u;
      y+=breathe*u+(.17*shift+.10*arrival)*arch+.19*opening*u;
      float z=-.36+.09*j-.43*arch+.32*sin(u*5.+lag)*u;
      z+=.19*sin(ripple*.87+u*5.1+lag)*u*(1.-still);
      float envelope=sin(pi*clamp(.018+.97*u,0.,1.));
      float width=mix(.12+.023*j,.018,fine)*pow(max(.001,envelope),.61);
      float twist=.74*sin(6.4*u+lag)+.28*sin(ripple*.67-3.1*u+lag)*(1.-still);
      x+=v*width*(.22+twist*.35);y+=v*width*(.74+.23*cos(twist));
      z+=width*(v*sin(twist)+.43*(1.-v*v));
      if(fine>.5){y+=.13+.046*j;x+=.115*u;z+=.14;}
      vec3 p=vec3(side*x,y,z);
      silk=vec4(u,v,j,fine);salt=lag+twist;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
    }`,`
    varying vec4 silk;varying float salt;
    void main(){
      // On MSAA hardware a pixel touching a narrow, twisted edge can have
      // its interpolation sample outside the ribbon. Bound the satin term
      // before the sixth power so HDR bloom cannot amplify an extrapolation.
      float u=sat(silk.x),v=clamp(silk.y,-1.,1.),j=silk.z,fine=silk.w,time=age*(1.-still);
      float fringes=pow(abs(v),6.),spine=exp(-34.*abs(v-.35*sin(u*8.+salt)));
      float weave=.5+.5*sin(u*35.-v*7.+salt);
      float pulse=pow(.5+.5*cos(u*10.-time*2.05+j*.76),5.);
      float bars=pow(.5+.5*sin(u*94.+v*2.+salt),11.);
      vec3 body=mix(vec3(.012,.19,.224),vec3(.105,.62,.52),weave*.5+.28*fringes);
      vec3 pearl=vec3(.55,1.48,1.13)*(fringes*.68+spine*.52)+vec3(.57,.79,.57)*bars*.27;
      vec3 c=body+pearl*(.64+.49*pulse+.23*shift)+fine*vec3(.26,.65,.56);
      float end=smoothstep(.0,.075,u)*(1.-smoothstep(.91,1.,u));
      float a=(.33+.37*fringes+.23*spine+fine*.13)*end*visibility;
      gl_FragColor=vec4(min(c*(1.+.25*charge+.18*exposed),vec3(1.08,1.45,1.23)),clamp(a,0.,.86));
      ${toScreen}
    }`);
  const mesh=new T.Mesh(veilGeometry(T),material);mesh.name='Tide Weaver · refractive lamellae';mesh.renderOrder=6;return [mesh];
}

// The focus and rim of every louver are separate polygons on one mesh. Their
// hinges articulate in the vertex shader, including the recessed amber slots.
function shutterGeometry(T){
  const position=[],params=[],tint=[],index=[];
  function face(v,hue,s,j,emission){
    const start=position.length/3,c=new T.Color(hue);
    for(const p of v){position.push(...p);params.push(s,j,emission);tint.push(c.r,c.g,c.b);}
    for(let i=1;i<v.length-1;i++)index.push(start,start+i,start+i+1);
  }
  for(const s of [-1,1])for(let j=0;j<(s<0?6:5);j++){
    const outline=[[0,-.052],[.56,-.079],[.84,-.024],[.94,.036],[.89,.068],[.69,.078],[.53,.05],[.18,.074],[0,.046]];
    const center=outline.map(([x,y])=>[x*.982,y*.78,.041]);
    const back=outline.map(([x,y])=>[x,y,-.045]);
    const rim=outline.map(([x,y])=>[x,y,.019]);
    face(center,j%3===1?'#916e4e':'#7b6a55',s,j,0);
    face(back,'#434b46',s,j,0);
    for(let i=0;i<outline.length;i++){
      const k=(i+1)%outline.length;
      face([back[i],back[k],rim[k],rim[i]],i<3?'#4d5048':'#ac946b',s,j,0);
      face([rim[i],rim[k],center[k],center[i]],i<3?'#9a7b53':'#cfac76',s,j,0);
    }
    for(const [a,b] of [[.16,.32],[.36,.53],[.57,.73]]){
      face([[a,-.003,.045],[b-.03,-.012,.045],[b,.014,.045],[a+.015,.022,.045]],'#ffac5e',s,j,1);
    }
  }
  return geometry(T,[['position',position,3],['hinge',params,3],['tint',tint,3]],index);
}
function sparksGeometry(T){
  let seed=0x531a683;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const position=[],params=[],index=[];
  for(let i=0;i<46;i++){
    const s=i<30?-1:1,phase=rnd(),drift=rnd(),speed=rnd(),start=position.length/3;
    for(const [x,y] of [[-1,0],[1,0],[.32,1],[-.32,1]]){
      position.push(x,y,0);params.push(s,phase,drift,speed);}
    index.push(start,start+1,start+2,start,start+2,start+3);
  }
  return geometry(T,[['position',position,3],['ember',params,4]],index);
}
function forgeVents(T,uniforms){
  const metal=effectMaterial(T,uniforms,`
    attribute vec3 hinge,tint;varying vec3 metalTint;varying float hot;varying vec3 pointOnFin;
    void main(){
      float side=hinge.x,j=hinge.y,x=position.x,y=position.y;
      float gap=clamp(.18+.32*arrival+.50*shift+.73*opening+.24*charge+.035*rank,0.,1.);
      float hingeAngle=.38+gap*1.08+.075*sin(j*1.82+side);
      float len=(.73+.14*sin(j*1.15+side))*(side<0.?1.:.87);
      float l=x*len;
      float px=side*(.57+.043*abs(j-2.)+l*sin(hingeAngle));
      float py=-.38+j*.163+y+l*(.24+.07*j)*gap;
      float pz=.06-.075*j-l*cos(hingeAngle)+position.z;
      metalTint=tint;hot=hinge.z;pointOnFin=vec3(x,y,j);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(px,py,pz,1.);
    }`,`
    varying vec3 metalTint;varying float hot;varying vec3 pointOnFin;
    void main(){
      float burn=.43+.79*opening+.68*shift+.38*charge+.37*arrival;
      float scratch=.93+.07*sin(pointOnFin.x*103.+pointOnFin.z*3.+pointOnFin.y*13.);
      vec3 metal=metalTint*(.47+.34*smoothstep(.1,.80,pointOnFin.x))*scratch;
      vec3 c=mix(metal,metalTint*vec3(1.8,1.15,.52)*(burn+1.16),hot);
      gl_FragColor=vec4(c,visibility);
      ${toScreen}
    }`);
  const ember=effectMaterial(T,uniforms,`
    attribute vec4 ember;varying float alpha,heat;
    void main(){
      float side=ember.x,seed=ember.y,drift=ember.z,speed=ember.w;
      float t=fract(seed+age*(.49+.51*speed)*(1.-still));
      float burst=clamp(.19+.46*arrival+.91*shift+.72*opening+.25*charge,0.,1.);
      float path=t*(1.12+1.16*speed)*(.53+.53*burst);
      float px=side*(.68+.13*drift+.60*path*(.43+drift))+.14*sin(t*6.5+seed*12.)*path;
      float py=.05+.25*drift+1.44*path-.88*t*t+.22*sin(seed*6.);
      float pz=.02-.65*path+.35*sin(t*7.+speed*5.)*path;
      float width=(.007+.009*speed)*(1.-.45*t),tail=(.04+.12*speed)*(.55+.45*burst);
      px+=position.x*width+side*position.y*tail*(.18+drift*.46);py+=position.y*tail;
      alpha=smoothstep(.0,.15,t)*(1.-smoothstep(.48,1.,t))*burst*(1.-still)*visibility;
      heat=1.-t;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(px,py,pz,1.);
    }`,`
    varying float alpha,heat;
    void main(){
      gl_FragColor=vec4(mix(vec3(2.0,.28,.038),vec3(3.2,1.65,.52),heat),alpha);
      ${toScreen}
    }`,{add:true});
  const shutters=new T.Mesh(shutterGeometry(T),metal),sparks=new T.Mesh(sparksGeometry(T),ember);
  shutters.name='Helioforge · articulated radiator';sparks.name='Helioforge · ejected clinkers';
  shutters.renderOrder=5;sparks.renderOrder=7;return [shutters,sparks];
}

// Each folded leaf has an engraved rule on one edge and a smoked, bevel-cut
// face. The two smaller leaves slide in depth behind the bearing uprights.
function gateGeometry(T){
  const position=[],params=[],tint=[],index=[];
  function poly(points,side,level,hue,mode){
    const start=position.length/3,c=new T.Color(hue);
    for(const p of points){position.push(...p);params.push(side,level,mode);tint.push(c.r,c.g,c.b);}
    for(let i=1;i<points.length-1;i++)index.push(start,start+i,start+i+1);
  }
  function stroke(a,b,w,side,j,h,mode,z=0){
    const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy),x=-w*dy/d,y=w*dx/d;
    poly([[a[0]-x,a[1]-y,z],[b[0]-x,b[1]-y,z],[b[0]+x,b[1]+y,z],[a[0]+x,a[1]+y,z]],side,j,h,mode);
  }
  for(const side of [-1,1])for(let j=0;j<3;j++){
    const upper=[[.47,1.09],[.76,1.14],[1.03,.91],[1.06,.57],[1.19,.44]];
    const lower=[[1.14,.35],[1.14,-.36],[1.00,-.51],[1.00,-.75],[.78,-.98],[.56,-.97]];
    for(const route of [upper,lower])for(let k=1;k<route.length;k++){
      const a=route[k-1],b=route[k],gap=k%2?.03:.09;
      const head=[a[0]+gap*(b[0]-a[0]),a[1]+gap*(b[1]-a[1])];
      const tail=[b[0]-gap*(b[0]-a[0]),b[1]-gap*(b[1]-a[1])];
      stroke(head,tail,j===0?.018:.011,side,j,j===0?'#c8a466':'#6b9f9a',j===0?1:2);
    }
    if(j===0){
      poly([[.77,1.105,-.013],[1.038,.90,-.013],[1.046,.636,-.013],[.981,.718,-.013],[.958,.839,-.013]],
        side,j,'#638e8c',0);
      poly([[1.138,.286,-.013],[1.138,-.353,-.013],[1.013,-.484,-.013],[.985,-.364,-.013],[1.058,-.288,-.013]],
        side,j,'#68938c',0);
      poly([[.49,1.08,-.002],[.74,1.13,-.002],[.704,1.048,-.002],[.564,1.041,-.002]],
        side,j,'#8d7654',0);
      poly([[1.00,-.745,-.012],[.803,-.952,-.012],[.735,-.930,-.012],[.83,-.790,-.012]],
        side,j,'#987e51',0);
      for(let k=0;k<11;k++){
        const y=.29-k*.055,length=k%5===0?.123:k%2===0?.083:.046;
        stroke([1.105,y],[1.105+length,y],k%5===0?.012:.007,side,j,'#ebcc8e',1,.012);
      }
      for(let k=0;k<5;k++){
        const x=.62+k*.055;stroke([x,1.135],[x+.01,1.135+.042+(k%3===0?.036:0)],.008,side,j,'#e5cc8a',1);
      }
    }
  }
  return geometry(T,[['position',position,3],['leaf',params,3],['tint',tint,3]],index);
}
function gateFold(T,uniforms){
  const material=effectMaterial(T,uniforms,`
    attribute vec3 leaf,tint;varying vec3 hue;varying float cover;varying float rule;
    void main(){
      float s=leaf.x,j=leaf.y,mode=leaf.z,x=position.x,y=position.y;
      float drive=clamp(.22+.49*arrival+.79*shift+.52*opening+.23*charge,0.,1.);
      float depth=j*.37;
      float angle=.13+j*(.18+.30*drive)+.13*shift*s;
      float px=1.01+(x-1.01)*cos(angle)+.095*j+(.051+j*.069)*drive;
      float py=y*(.80+j*.071)+.071*j*s+.05*sin(age*.59+1.1*j)*(1.-still);
      // One leaf folds towards the viewer while its companion recedes. At
      // exposure their engraved scales align to the sides of the open core.
      float pz=-.17-depth+(x-1.01)*sin(angle)+s*j*.16*drive+position.z;
      px+=opening*.10*j;py+=s*.08*shift*(j-1.);
      hue=tint;rule=mode;
      cover=mode<.5?.32:mode<1.5?.84:.37/(1.+.23*j);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(px*s,py,pz,1.);
    }`,`
    varying vec3 hue;varying float cover,rule;
    void main(){
      float emphasis=.29*arrival+.67*shift+.27*opening+.17*charge;
      vec3 c=rule<.5?hue*.73:rule<1.5?hue*(1.14+emphasis):hue*(.69+.32*shift);
      gl_FragColor=vec4(c,cover*visibility);
      ${toScreen}
    }`);
  const mesh=new T.Mesh(gateGeometry(T),material);mesh.name='Gate Warden · folding gnomon';mesh.renderOrder=6;return [mesh];
}

export function createBossPresence(T,scene){
  const group=new T.Group();group.name='Boss field manifestations';group.visible=false;scene.add(group);
  const uniforms={};
  for(const key of ['age','still','arrival','shift','opening','exposed','charge','rank','visibility'])uniforms[key]={value:0};
  const designs={tideBoss:tideWeave,forgeBoss:forgeVents,warden:gateFold},cache=new Map();
  const eye=new T.Vector3(),smooth=T.MathUtils.smoothstep;
  let active=null,id=null,phase=0,age=0,changed=3,openTime=3,open=0,lastOpen=false;
  function clear(){
    if(active)active.visible=false;
    active=null;id=null;phase=0;group.visible=false;age=0;changed=openTime=3;open=0;lastOpen=false;
  }
  // A fast physical opening followed by a slow settlement makes the stage
  // transitions legible without a flash. Pulses never modulate the camera.
  function envelope(t,attack,hold,end){
    return smooth(t,0,attack)*(1-smooth(t,hold,end));
  }
  function update(dt,boss,camera,reduced=false){
    if(!boss||!designs[boss.kind]){if(active)clear();return;}
    if(!active||id!==boss.id||active.userData.kind!==boss.kind){
      clear();let effect=cache.get(boss.kind);
      if(!effect){
        effect=new T.Group();effect.userData.kind=boss.kind;
        effect.add(...designs[boss.kind](T,uniforms));group.add(effect);cache.set(boss.kind,effect);
      }
      active=effect;active.visible=true;id=boss.id;phase=boss.bossPhase||1;
    }
    const delta=Math.min(.12,Math.max(0,dt||0)),quiet=typeof reduced==='object'?!!reduced?.matches:!!reduced;
    if(boss.kind==='forgeBoss')active.children[1].visible=!quiet;
    if(boss.bossPhase>phase){changed=0;phase=boss.bossPhase;}
    if(boss.vulnerable&&!lastOpen)openTime=0;
    lastOpen=!!boss.vulnerable;age+=delta;changed+=delta;openTime+=delta;
    open=T.MathUtils.damp(open,lastOpen?1:0,quiet?3:6,delta);
    const radius=Math.max(.1,boss.radius);
    group.position.copy(boss.position);group.scale.setScalar(radius);
    camera.getWorldPosition(eye);group.lookAt(eye);
    const proximity=smooth(eye.distanceTo(group.position)/radius,1.05,2.25);
    group.visible=proximity>.008;
    uniforms.visibility.value=proximity*(.26+.74*smooth(age,0,.38));
    uniforms.age.value=age;uniforms.still.value=Number(quiet);
    uniforms.arrival.value=envelope(age,.35,.97,2.62)*(quiet?.24:1);
    uniforms.shift.value=envelope(changed,.24,.67,1.91)*(quiet?.24:1);
    uniforms.exposed.value=open;
    uniforms.opening.value=Math.max(open,envelope(openTime,.14,.46,1.17)*.80)*(quiet?.52:1);
    uniforms.charge.value=T.MathUtils.clamp(boss.charging||0,0,1)*(quiet?.43:1);
    uniforms.rank.value=Math.max(0,phase-1);
  }
  return {update,clear};
}
