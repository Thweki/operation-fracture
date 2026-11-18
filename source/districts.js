import { geologyMap } from './rocks.js';

// The coastal conservatory, solar works and survey court are built in world
// coordinates so their scenery, collision surfaces and instruments agree.
const TURN=Math.PI*2;
function randomSeed(seed){return ()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);}
const lerp=(a,b,t)=>a+(b-a)*t;

function metalSkin(T,clock){
  const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:.69,metalness:.27,side:T.DoubleSide});
  const n=128,data=new Uint8Array(n*n*4),rand=randomSeed(4719);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const k=(y*n+x)*4,grit=rand();
    data[k]=Math.round(255*(.58+.38*grit));data[k+1]=Math.round(255*(.5+.45*rand()));
    data[k+2]=Math.round(255*rand());data[k+3]=255;
  }
  const tex=new T.DataTexture(data,n,n);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.magFilter=T.LinearFilter;
  tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.anisotropy=8;tex.needsUpdate=true;
  mat.onBeforeCompile=s=>{
    s.uniforms.metalGrain={value:tex};
    s.uniforms.districtTime=clock;
    s.vertexShader='uniform float districtTime;varying vec3 relicP;\n'+s.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nrelicP=(modelMatrix*vec4(transformed,1.)).xyz;').replace('#include <project_vertex>',`#include <project_vertex>
      vec3 airRay=relicP-cameraPosition;
      float lift=dot(vec2(163.,-19.)-cameraPosition.xz,airRay.xz)/max(.01,dot(airRay.xz,airRay.xz));
      if(lift>0.&&lift<1.){
        vec3 sampleAir=cameraPosition+airRay*lift;
        float furnaceAir=(1.-smoothstep(1.1,6.2,length(sampleAir.xz-vec2(163.,-19.))))*
          smoothstep(13.,18.,sampleAir.y)*(1.-smoothstep(24.,35.,sampleAir.y));
        gl_Position.xy+=gl_Position.w*furnaceAir*vec2(.00175*sin(sampleAir.y*1.6-districtTime*2.2),.00078*sin(sampleAir.y*2.+districtTime*1.25));
      }`);
    s.fragmentShader='uniform sampler2D metalGrain;uniform float districtTime;varying vec3 relicP;\n'+s.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec3 orientation=abs(normalize(cross(dFdx(relicP),dFdy(relicP))));
      vec2 surface=vec2(relicP.x*orientation.z+relicP.z*orientation.x+relicP.x*orientation.y,
        relicP.y*(orientation.x+orientation.z)+relicP.z*orientation.y);
      float fleck=texture2D(metalGrain,surface*.24).r;
      float stain=texture2D(metalGrain,surface*vec2(.012,.022)).b;
      float streak=texture2D(metalGrain,surface*vec2(.076,.007)).g;
      diffuseColor.rgb*=.63+.35*fleck+.20*streak;
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.65,.90,.78),.58*smoothstep(.46,.81,stain));
    `).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      vec3 localN=normalize(cross(dFdx(relicP),dFdy(relicP)));
      vec3 coldRay=vec3(-159.,10.,-78.)-relicP,hotRay=vec3(163.,21.6,-19.)-relicP;
      float coldRadius=length(coldRay),hotRadius=length(hotRay);
      float bounceCold=pow(max(0.,1.-coldRadius/23.),2.)*(.15+.85*max(dot(localN,coldRay/max(.01,coldRadius)),0.));
      float bounceHot=pow(max(0.,1.-hotRadius/22.),2.)*(.12+.88*max(dot(localN,hotRay/max(.01,hotRadius)),0.));
      totalEmissiveRadiance+=vec3(.047,.27,.26)*bounceCold*(.84+.16*sin(districtTime*.75-coldRadius*.24));
      totalEmissiveRadiance+=vec3(.53,.16,.035)*bounceHot*(.91+.09*sin(districtTime*1.87-hotRadius*.34));
    `);
  };
  return mat;
}
function geometryWriter(T,coated=false){
  const xyz=[],colors=[],normals=[],panel=[],p=new T.Vector3(),normal=new T.Vector3(),rgb=new T.Color(),normalMatrix=new T.Matrix3();
  function put(g,matrix,color){
    const a=g.attributes.position,n=g.attributes.normal,index=g.index, count=index?index.count:a.count;
    normalMatrix.getNormalMatrix(matrix);rgb.set(color);
    for(let j=0;j<count;j++){
      const k=index?index.getX(j):j;
      if(coated)panel.push(a.getX(k)+.5,a.getY(k)+.5,n.getZ(k)>.70?1:0);
      p.fromBufferAttribute(a,k).applyMatrix4(matrix);normal.fromBufferAttribute(n,k).applyMatrix3(normalMatrix).normalize();
      xyz.push(p.x,p.y,p.z);normals.push(normal.x,normal.y,normal.z);colors.push(rgb.r,rgb.g,rgb.b);
    }
  }
  function finish(){
    if(!xyz.length)return null;const geo=new T.BufferGeometry();
    for(const [key,array] of [['position',xyz],['normal',normals],['color',colors]])geo.setAttribute(key,new T.Float32BufferAttribute(array,3));
    if(coated)geo.setAttribute('panelUV',new T.Float32BufferAttribute(panel,3));
    geo.computeBoundingBox();geo.computeBoundingSphere();return geo;
  }
  return {put,finish};
}
function mirrorTile(T){
  const path=[[-.46,-.5],[.43,-.5],[.50,-.43],[.50,.46],[.46,.50],[-.42,.50],[-.50,.43],[-.50,-.46]];
  const p=[],idx=[];
  for(const [extent,z] of [[.97,-.50],[1,.21],[.967,.48]])for(const [x,y] of path)p.push(extent*x,extent*y,z);
  const base=p.length/3;p.push(0,0,.432,0,0,-.50);
  for(let i=0;i<8;i++){
    const j=(i+1)%8;idx.push(base,16+i,16+j,base+1,j,i);
    for(let k=0;k<2;k++){const a=k*8+i,b=k*8+j;idx.push(a,b,b+8,a,b+8,a+8);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);
  const flat=g.toNonIndexed();flat.computeVertexNormals();return flat;
}
function mirrorCoating(T){
  const atlas=geologyMap(T),mat=new T.MeshStandardMaterial({vertexColors:true,roughness:.32,metalness:.43});
  mat.onBeforeCompile=s=>{
    s.uniforms.coatGrain={value:atlas};
    s.vertexShader='attribute vec3 panelUV;varying vec3 panel;varying vec3 mirrorWorld;\n'+s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      mirrorWorld=(modelMatrix*vec4(transformed,1.)).xyz;panel=panelUV;`);
    s.fragmentShader='varying vec3 panel;varying vec3 mirrorWorld;uniform sampler2D coatGrain;\n'+s.fragmentShader
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec2 uv=panel.xy,edge=min(uv,1.-uv);
        float frame=(1.-smoothstep(.009,.027,min(edge.x,edge.y)))*panel.z;
        float closeMirror=1.-smoothstep(7.,27.,length(vViewPosition));
        vec2 noiseUV=vec2(mirrorWorld.x+mirrorWorld.z*.67,mirrorWorld.y-.22*mirrorWorld.z);
        vec4 coating=texture2D(coatGrain,noiseUV*.73);
        vec2 screwAt=edge-vec2(.064);float screwR=length(screwAt),screwAA=fwidth(screwR);
        float dots=1.-smoothstep(.025,.029+screwAA,screwR);
        float bevel=1.-smoothstep(.001,.004+screwAA,abs(screwR-.024));
        float screwSlot=(1.-smoothstep(.0016,.0037+screwAA,abs(screwAt.x+.37*screwAt.y)))*(1.-smoothstep(.010,.015,screwR));
        vec3 Np=normalize(cross(dFdx(mirrorWorld),dFdy(mirrorWorld)));
        vec3 reflected=reflect(normalize(mirrorWorld-cameraPosition),Np);
        float azimuth=atan(reflected.z,reflected.x);
        float ridge=.071+.032*sin(azimuth*13.)+.014*sin(azimuth*39.);
        float sky=smoothstep(ridge-.014,ridge+.032,reflected.y),solar=pow(max(dot(reflected,normalize(vec3(-.66,.2,-.73))),0.),134.);
        vec2 heavens=reflected.xz/max(.20,reflected.y+.27);
        float cloud=smoothstep(.38,.72,texture2D(coatGrain,heavens*.15).g+.11*texture2D(coatGrain,heavens*.84).b);
        vec3 air=mix(vec3(.81,.78,.60),vec3(.30,.55,.59),smoothstep(.08,.85,reflected.y));
        air=mix(air,vec3(.91,.83,.63),cloud*.48);
        vec3 projection=mix(vec3(.16,.18,.124)*(1.+.24*coating.r),air,sky)*vec3(1.,.89,.67);
        diffuseColor.rgb=mix(diffuseColor.rgb,projection,.48*panel.z);
        diffuseColor.rgb+=vec3(1.,.83,.46)*solar*.70*panel.z;
        float rim=abs(length((uv-.5)*vec2(1.,.96))-.34);
        float arc=smoothstep(-.1,.3,uv.x-uv.y);
        float mark=(1.-smoothstep(.001,.004+fwidth(rim),rim))*arc*closeMirror;
        float inset=1.-smoothstep(.0008,.003+fwidth(uv.x),abs(min(edge.x,edge.y)-.048));
        float scratch=texture2D(coatGrain,vec2(uv.x*1.7+uv.y*.13,uv.y*.045)).b;
        diffuseColor.rgb*=1.+closeMirror*(.14*(coating.r-.5)+.11*(scratch-.5))-.26*mark-.29*inset*closeMirror;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.20,.186,.132)+bevel*vec3(.21,.18,.12),max(frame*.75,dots*panel.z*.85));
        diffuseColor.rgb*=1.-screwSlot*.55;
      `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=mix(.74,.19+.15*coating.g+.21*frame,panel.z);`)
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        totalEmissiveRadiance+=projection*(.10+.19*sky)*panel.z*(1.-.87*frame)*(1.-.84*dots)*(1.-.39*mark-.36*inset);
        `);
  };return mat;
}
function profile(T,rings){
  const xy=[[-.72,-1],[.72,-1],[1,-.68],[1,.68],[.72,1],[-.72,1],[-1,.68],[-1,-.68]];
  const p=[],idx=[];
  for(const [x,y,z,w,d] of rings) for(const [a,b] of xy)p.push(x+a*w,y,z+b*d);
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++){
    const n=j*8+i,k=j*8+(i+1)%8;idx.push(k,n,n+8,k,n+8,k+8);
  }
  const end=(rings.length-1)*8;
  for(let i=1;i<7;i++)idx.push(0,i,i+1,end,end+i+1,end+i);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setIndex(idx);
  const flat=geo.toNonIndexed();flat.computeVertexNormals();return flat;
}
function builder(T,root,materials,solids,name){
  const groups={hard:geometryWriter(T),trim:geometryWriter(T),light:geometryWriter(T),mirror:geometryWriter(T,true)};
  const cache=new Map(),transform=new T.Object3D(),from=new T.Vector3(),to=new T.Vector3(),axis=new T.Vector3(0,1,0);
  const boxGeo=new T.BoxGeometry(1,1,1);
  function element(g,x,y,z,w,h,d,rx,ry,rz,color,layer='hard'){
    transform.position.set(x,y,z);transform.rotation.set(rx,ry,rz,'YXZ');transform.scale.set(w,h,d);transform.updateMatrix();
    groups[layer].put(g,transform.matrix,color);
  }
  const box=(x,y,z,w,h,d,color,ry=0,rx=0,rz=0,layer='hard')=>element(boxGeo,x,y,z,w,h,d,rx,ry,rz,color,layer);
  function drum(x,y,z,top,bottom,h,segments,color,layer='hard',az=0){
    const key=['d',top,bottom,h,segments].join('/');
    if(!cache.has(key))cache.set(key,new T.CylinderGeometry(top,bottom,h,segments));
    element(cache.get(key),x,y,z,1,1,1,0,az,0,color,layer);
  }
  function wire(x,y,z,r,tube,color,rx,ry,rz,arc=TURN,layer='trim',segments=64){
    const key=['w',r,tube,arc,segments].join('/');
    if(!cache.has(key))cache.set(key,new T.TorusGeometry(r,tube,5,segments,arc));
    element(cache.get(key),x,y,z,1,1,1,rx,ry,rz,color,layer);
  }
  function beam(a,b,width,depth,color,layer='trim'){
    from.set(...a);to.set(...b).sub(from);const len=to.length();
    transform.position.copy(from).addScaledVector(to,.5);transform.quaternion.setFromUnitVectors(axis,to.normalize());
    transform.scale.set(width,len,depth);transform.updateMatrix();groups[layer].put(boxGeo,transform.matrix,color);
  }
  function flush(){
    for(const [key,group] of Object.entries(groups)){
      const geo=group.finish();if(!geo)continue;
      const mesh=new T.Mesh(geo,key==='light'?materials.glow:key==='mirror'?materials.mirror:materials.metal);mesh.name=name+' '+key;
      mesh.receiveShadow=key!=='light';root.add(mesh);if(key==='hard'||key==='mirror')solids.push(mesh);
    }
  }
  return {element,box,drum,wire,beam,flush};
}
function crystalline(T,levels,n=8){
  const p=[],idx=[];
  for(const [h,r] of levels)for(let i=0;i<n;i++){const a=TURN*i/n;p.push(Math.sin(a)*r,h,Math.cos(a)*r);}
  for(let j=0;j<levels.length-1;j++)for(let i=0;i<n;i++){
    const a=j*n+i,b=j*n+(i+1)%n;idx.push(a,b,b+n,a,b+n,a+n);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);
  const flat=g.toNonIndexed();flat.computeVertexNormals();return flat;
}
function halo(T,color,scale){
  const size=96,bytes=new Uint8Array(size*size*4);
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const d=Math.hypot((i+.5)/size*2-1,(j+.5)/size*2-1),k=(j*size+i)*4;
    bytes[k]=bytes[k+1]=bytes[k+2]=255;bytes[k+3]=Math.round(255*Math.max(0,1-d)**2.75);
  }
  const tex=new T.DataTexture(bytes,size,size);tex.magFilter=tex.minFilter=T.LinearFilter;tex.needsUpdate=true;
  const obj=new T.Sprite(new T.SpriteMaterial({map:tex,color,transparent:true,opacity:.64,depthWrite:false,blending:T.AdditiveBlending}));
  obj.scale.setScalar(scale);return obj;
}
function water(T,root,x,z){
  const geo=new T.RingGeometry(.0001,1,88,11);geo.rotateX(-Math.PI/2);
  const mat=new T.ShaderMaterial({
    uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{clock:{value:0}}]),transparent:true,depthWrite:false,fog:true,
    vertexShader:`
      #include <fog_pars_vertex>
      varying vec3 wp;varying vec2 pond;uniform float clock;
      void main(){pond=position.xz;wp=(modelMatrix*vec4(position,1.)).xyz;
      float dist=length(wp.xz-vec2(-159.,-78.)),pulse=.5+.5*cos(dist*.41-clock*.87);
      wp.y+=(.057*sin(dist*1.08-clock*1.6)*(.40+.60*pulse)+.025*sin(wp.x*.66+wp.z*.31-clock*.83))*(1.-smoothstep(.85,1.,length(pond)));
      vec4 mvPosition=viewMatrix*vec4(wp,1.);gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader:`
      #include <fog_pars_fragment>
      varying vec3 wp;varying vec2 pond;uniform float clock;
      void main(){
      float radial=length(pond),r=length(wp.xz-vec2(-159.,-78.));
      float a=sin(wp.x*.84+wp.z*.39+clock*.92+sin(wp.z*.29)*2.);
      float b=sin(wp.z*1.53-wp.x*.42-clock*.73+.6*sin(wp.x*.68));
      float rings=sin(r*2.1-clock*1.28+.24*a);
      float swell=.5+.5*cos(r*.41-clock*.87);
      vec2 radialDir=(wp.xz-vec2(-159.,-78.))/max(.1,r);
      vec3 n=normalize(vec3(a*.105+radialDir.x*rings*(.04+.065*swell),1.,b*.102+radialDir.y*rings*.066));
      vec3 v=normalize(cameraPosition-wp);float fres=pow(1.-max(dot(v,n),0.),2.3);
      vec3 col=mix(vec3(.014,.126,.148),vec3(.097,.38,.36),radial*.63+.3*fres);
      col+=vec3(.085,.32,.31)*pow(max(0.,rings),16.)*(.12+.24*swell)*(.65+.35*radial);
      float glitter=pow(max(dot(reflect(-v,n),normalize(vec3(-.45,.37,-.44))),0.),81.);
      col+=vec3(.34,.37,.29)*glitter+.006*vec3(a+b);
      vec3 crystalRay=normalize(vec3(-159.,12.2+.3*sin(clock*.51),-78.)-wp);
      float glint=pow(max(dot(reflect(-v,n),crystalRay),0.),84.);
      float lace=sin(wp.x*4.9+wp.z*2.7+clock*2.12+a)*sin(wp.z*5.1-clock*1.72+b);
      col+=vec3(.12,.75,.67)*glint*(.38+.65*pow(max(lace,0.),3.));
      float pin=pow(max(0.,sin(wp.x*12.8+wp.z*3.4+a+clock*2.8)*sin(wp.z*9.1+b-clock*2.3)),16.);
      col+=vec3(.15,.52,.52)*pin*pow(max(0.,rings),7.)*(.15+.57*swell);
      float edge=1.-smoothstep(.92,1.,radial+.018*a);
      gl_FragColor=vec4(col,.9*edge);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      }`});
  const mesh=new T.Mesh(geo,mat);mesh.position.set(x,-.57,z);mesh.scale.set(31,1,20.8);mesh.name='Tidal mirror pool';mesh.renderOrder=3;root.add(mesh);
  return mat.uniforms.clock;
}

function localMotes(T,root,clock,heightAt,coast,x,y,z){
  const rand=randomSeed(coast?64206:50318),count=coast?167:58,positions=[],traits=[];
  const shoals=Array.from({length:9},(_,i)=>{const a=(i+rand()*.5)*TURN/9,r=coast?13+rand()*17:2;
    return [Math.cos(a)*r,Math.sin(a)*r*.77];});
  for(let i=0;i<count;i++){
    const a=rand()*TURN,r=Math.sqrt(rand());
    if(coast){
      const [sx,sz]=shoals[i%shoals.length],px=sx+Math.cos(a)*r*4.2,pz=sz+Math.sin(a)*r*3.5;
      positions.push(px,Math.max(-.36,heightAt(x+px,z+pz))+.31+rand()**1.5*3.4-y,pz);
    }else positions.push(Math.cos(a)*(1.9+2.6*r),0,Math.sin(a)*(1.9+2.6*r));
    traits.push(rand(),rand(),rand(),rand());
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('particle',new T.Float32BufferAttribute(traits,4));
  g.boundingSphere=coast?new T.Sphere(new T.Vector3(0,4,0),41):new T.Sphere(new T.Vector3(0,11,0),16);
  const mat=new T.ShaderMaterial({uniforms:{clock,pixels:{value:720}},defines:coast?{PLANKTON:1}:{},
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:`uniform float clock,pixels;attribute vec4 particle;
      varying float glow;varying float angle;varying vec3 tint;
      void main(){vec3 p=position;float d=particle.x*6.28318;angle=d;
      #ifdef PLANKTON
      float beat=cos(clock*.76-length(p.xz)*.28);
      p.x+=.66*sin(clock*.32+d)+.25*sin(clock*.91+particle.y*9.);
      p.y+=.35*sin(clock*.49+d)+.12*sin(clock*1.17+particle.z*5.);
      p.z+=.66*cos(clock*.29+d*.87);
      glow=.37+.50*smoothstep(-.5,.85,beat+.52*sin(d+clock*.61));
      float size=.065+.13*particle.w*particle.w;
      tint=mix(vec3(.29,1.15,.92),vec3(.51,1.14,1.57),particle.z);
      #else
      float age=fract(particle.y+clock*(.037+.064*particle.z));
      p.y+=age*(7.5+particle.w*11.);
      p.x+=age*1.8+.8*sin(clock*.63+age*5.+d);
      p.z+=.79*cos(clock*.57+age*5.6+d);
      glow=smoothstep(0.,.12,age)*(1.-smoothstep(.60,1.,age))*(.64+.30*sin(clock*3.2+d));
      float size=(.085+.16*particle.w)*(1.-age*.63);
      tint=mix(vec3(2.2,.42,.06),vec3(2.4,1.43,.47),1.-age);
      angle=.12+.31*sin(d+age*2.);
      #endif
      vec4 vp=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*vp;
      gl_PointSize=clamp(size*pixels*projectionMatrix[1][1]/max(1.,-vp.z),1.55,17.);
      }`,
    fragmentShader:`varying float glow;varying float angle;varying vec3 tint;
      void main(){vec2 q=gl_PointCoord-.5;
      q=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*q;
      #ifdef PLANKTON
      float core=exp(-dot(q*vec2(.93,1.38),q*vec2(.93,1.38))*59.);
      float wing=exp(-dot((abs(q)-vec2(.11,.026))*vec2(6.,14.),(abs(q)-vec2(.11,.026))*vec2(6.,14.)));
      float soft=.11*exp(-dot(q,q)*9.);
      float alpha=glow*(core+.27*wing+soft);
      #else
      float core=exp(-dot(q*vec2(1.9,.73),q*vec2(1.9,.73))*26.);
      float alpha=glow*(core+.11*exp(-dot(q,q)*11.));
      #endif
      if(alpha<.016)discard;
      gl_FragColor=vec4(tint,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  const points=new T.Points(g,mat),size=new T.Vector2();points.position.set(x,y,z);points.renderOrder=8;
  points.name=coast?'Resonant coastal plankton':'Drifting furnace embers';
  points.onBeforeRender=renderer=>{const rt=renderer.getRenderTarget();mat.uniforms.pixels.value=rt?rt.height:renderer.getDrawingBufferSize(size).y;};
  root.add(points);
}
function nearbyEffects(T,root,x,z){
  const region=new T.LOD();
  region.update=camera=>{
    const eye=camera.matrixWorld.elements,visible=Math.hypot(eye[12]-x,eye[14]-z)<138*camera.zoom;
    for(const effect of region.children)effect.visible=visible;
  };
  root.add(region);return region;
}

function shoreVapour(T,root,clock,heightAt,x,z){
  const rand=randomSeed(11046),count=9,origins=[],sizes=[],g=new T.InstancedBufferGeometry();
  const plane=new T.PlaneGeometry(1,1);
  for(const [key,attr] of Object.entries(plane.attributes))g.setAttribute(key,attr);g.setIndex(plane.index);
  for(let i=0;i<count;i++){
    const a=(i+.21)*TURN/count,r=15+rand()*11,px=Math.cos(a)*r,pz=Math.sin(a)*r*.72;
    origins.push(px,Math.max(-.48,heightAt(x+px,z+pz))+.68+rand()*.44,pz);
    sizes.push(11+rand()*8,1.7+rand()*1.8,rand()*TURN,rand());
  }
  g.setAttribute('bank',new T.InstancedBufferAttribute(new Float32Array(origins),3));
  g.setAttribute('bankShape',new T.InstancedBufferAttribute(new Float32Array(sizes),4));g.instanceCount=count;
  g.boundingSphere=new T.Sphere(new T.Vector3(0,2,0),42);
  const mat=new T.ShaderMaterial({uniforms:{clock,vapourMap:{value:geologyMap(T)}},transparent:true,depthWrite:false,
    vertexShader:`attribute vec3 bank;attribute vec4 bankShape;uniform float clock;varying vec2 vapourUV;varying float seed;varying float range;
      void main(){vapourUV=uv;seed=bankShape.z;vec3 p=bank;
      p.x+=.83*sin(clock*.11+seed);p.z+=.66*cos(clock*.083+seed);
      vec4 mv=modelViewMatrix*vec4(p,1.);range=smoothstep(2.2,9.,-mv.z);
      mv.xy+=position.xy*bankShape.xy;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float clock;uniform sampler2D vapourMap;varying vec2 vapourUV;varying float seed;varying float range;
      void main(){vec2 uv=vapourUV;
      float broad=texture2D(vapourMap,vec2(uv.x*.86+seed*.14+clock*.011,uv.y*.47+seed*.18)).g;
      float filament=texture2D(vapourMap,vec2(uv.x*1.65+broad*.15-clock*.009,uv.y*.74+seed*.13)).r;
      vec2 p=2.*uv-1.;p.y+=(broad-.48)*.69;
      float shape=pow(max(0.,1.-p.x*p.x),2.)*pow(max(0.,1.-p.y*p.y),2.);
      float alpha=.265*shape*range*smoothstep(.33,.71,broad*.72+filament*.28);
      if(alpha<.008)discard;
      gl_FragColor=vec4(mix(vec3(.22,.39,.39),vec3(.52,.77,.72),broad),alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  const mesh=new T.Mesh(g,mat);mesh.position.set(x,0,z);mesh.name='Low vapour along the tidal pools';mesh.renderOrder=6;root.add(mesh);
}

function thermalColumn(T,root,clock,x,y,z){
  const p=[],phase=[],ix=[],sides=54,rows=14;
  for(let layer=0;layer<3;layer++){
    const start=p.length/3;
    for(let j=0;j<=rows;j++)for(let i=0;i<=sides;i++){
      const a=TURN*i/sides,t=j/rows,r=(4.93-layer*.84)*(1.-.56*t)+.24*Math.sin(t*5.+layer);
      p.push(Math.cos(a)*r,t*(7.0+layer*.87),Math.sin(a)*r);phase.push(i/sides,t,layer);
      if(j<rows&&i<sides){const k=start+j*(sides+1)+i;ix.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('pilot',new T.Float32BufferAttribute(phase,3));g.setIndex(ix);g.computeBoundingSphere();
  const mat=new T.ShaderMaterial({uniforms:{clock,flowNoise:{value:geologyMap(T)}},side:T.DoubleSide,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:`attribute vec3 pilot;uniform float clock;varying vec3 flow;
      void main(){flow=pilot;vec3 p=position;float v=pilot.y,a=pilot.x*6.283;
      float up=.55+.32*sin(a*5.+clock*.65+pilot.z*1.6)+.13*cos(a*9.-clock*.46);
      p.y*=.76+.29*up;
      float twist=(.10+.62*v*v)*sin(v*4.7-clock*.50+pilot.z);
      p.xz=mat2(cos(twist),-sin(twist),sin(twist),cos(twist))*p.xz;
      p.xz+=v*v*vec2(.52*sin(a*3.+clock*1.33),.41*cos(a*2.-clock));
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`uniform sampler2D flowNoise;uniform float clock;varying vec3 flow;
      void main(){float u=flow.x,v=flow.y,k=flow.z;
      vec2 st=vec2(u*2.+k*.19,v*.74-clock*.086+k*.14);
      float a=texture2D(flowNoise,st).g;
      float b=texture2D(flowNoise,vec2(u*4.-v*.22+a*.11,v*.97-clock*.21+k*.28)).r;
      float swirl=sin(6.283*(u*5.+v*.91)+a*6.3-clock*.87+k*2.);
      float ribbons=pow(max(0.,swirl),2.7)*smoothstep(.33,.73,.58*a+.42*b);
      float height=.29+.59*a+.26*b;
      float fade=(1.-smoothstep(height-.28,height,v))*smoothstep(0.,.09,v);
      float alpha=(.027+.37*ribbons)*fade*(.60+.4*b);
      if(alpha<.009)discard;
      vec3 heat=mix(vec3(1.8,.29,.038),vec3(2.42,1.19,.28),clamp((1.-v)*.67+k*.11+.39*ribbons,0.,1.));
      gl_FragColor=vec4(heat,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  mat.forceSinglePass=true;
  const obj=new T.Mesh(g,mat);obj.position.set(x,y,z);obj.name='Layered furnace convection';obj.renderOrder=5;root.add(obj);
}

function conservatory(T,root,heightAt,materials,solids,animations){
  const x=-159,z=-78,angle=.687,c=Math.cos(angle),s=Math.sin(angle);
  const pt=(side,up,depth)=>[x+side*c+depth*s,up,z-side*s+depth*c];
  const k=builder(T,root,materials,solids,'Tidal conservatory');
  const blue='#4f9895',light='#a5ffff',limestone='#9aaf9b',bronze='#84775b',deep='#354f50';
  // A former water organ: twin oxidised blades hold the resonant crystal
  // above a stepped intake. Each blade has its own ribbing and collector.
  k.drum(x,-1.28,z,9.7,10.7,2.55,12,deep);
  k.drum(x,.02,z,8.8,9.6,.78,12,limestone);k.drum(x,.61,z,6.55,7.6,.86,12,bronze);
  k.drum(x,1.16,z,4.96,6.45,.55,12,deep);
  for(const r of [8.35,6.73,4.78])k.wire(x,.45+(8.35-r)*.22,z,r,.075,blue,Math.PI/2,0,0);
  for(let i=0;i<32;i++){
    const a=i*TURN/32,sz=i%4===0?1.4:.69;
    k.box(x+Math.sin(a)*7.56,.46,z+Math.cos(a)*7.56,.13,.075,sz,i%4?bronze:light,a,0,0,i%4?'trim':'light');
  }
  for(const dir of [-1,1]){
    const h=dir<0?25:22, rows=[[5.0,1.1,0,2.25,2.15],[7.6,4.0,-.3,1.75,1.87],[9.65,9.0,-.6,1.37,1.5],
      [9.35,14.4,-.38,1.21,1.08],[7.35,19.3,.37,.87,.78],[4.25,h,1.0,.18,.24]];
    const local=rows.map(([v,y,d,w,t])=>[dir*v,y,d,w,t]);
    k.element(profile(T,local),x,0,z,1,1,1,0,angle,0,limestone);
    k.element(profile(T,local.map(([v,y,d,w,t])=>[v-dir*w*.72,y+.12,d+t*.84,w*.21,t*.23])),x,0,z,1,1,1,0,angle,0,bronze,'trim');
    for(let j=1;j<local.length;j++){
      const [a,b,d,w,t]=local[j-1],[aa,bb,dd,ww,tt]=local[j];
      k.beam(pt(a-dir*w*.42,b+.06,d+t*.98),pt(aa-dir*ww*.42,bb+.06,dd+tt*.98),.115,.12,light,'light');
      k.beam(pt(a+dir*w*.62,b+.06,d+t*.98),pt(aa+dir*ww*.62,bb+.06,dd+tt*.98),.15,.15,deep);
      for(let l=1;l<5;l++){
        const f=l/5,cy=lerp(b,bb,f),v=lerp(a,aa,f),depth=lerp(d,dd,f),width=lerp(w,ww,f),thick=lerp(t,tt,f);
        k.box(...pt(v,cy,depth+thick*1.01),width*1.49,.07, .075,bronze,angle,0,0,'trim');
      }
    }
  }
  // Ranks of hollow bronze pipes rise and fall like the profile of a shell.
  for(let i=0;i<19;i++){
    const a=Math.PI*.1+i*Math.PI*.8/18, lateral=Math.cos(a)*10,depth=-5.6-Math.sin(a)*5;
    const [px,,pz]=pt(lateral,0,depth),h=1.9+Math.sin(a)**2*10.4;
    k.drum(px,h*.5-1,pz,.37,.44,h,9,bronze);
    k.drum(px,h-1.06,pz,.44,.44,.40,9,deep,'trim');
    k.drum(px,h-.85,pz,.31,.31,.045,9,blue,'light');
  }
  const core=new T.Group();core.position.set(x,12.2,z);
  const heart=new T.Mesh(crystalline(T,[[-4.4,.045],[-1.5,1.54],[.8,1.31],[3.82,.085]],8),
    new T.MeshStandardMaterial({color:'#67c9bd',metalness:.38,roughness:.2,emissive:'#327779',emissiveIntensity:.53,flatShading:true}));
  heart.material.onBeforeCompile=s=>{
    s.uniforms.districtTime=materials.clock;
    s.vertexShader='varying vec3 heartP;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nheartP=position;');
    s.fragmentShader='uniform float districtTime;varying vec3 heartP;\n'+s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      float refractBand=heartP.y*1.19+heartP.x*2.7+heartP.z*1.54+.33*sin(heartP.y*1.81+districtTime*.37);
      float flash=pow(max(0.,cos(refractBand*3.7-districtTime*.49)),14.);
      float beat=.63+.37*cos(districtTime*.76);
      diffuseColor.rgb*=.73+.24*cos(refractBand)+.14*beat;
      totalEmissiveRadiance+=vec3(.061,.69,.61)*flash*beat+vec3(.021,.11,.13)*beat;`);
  };
  core.add(heart);heart.name='Tidal crystal body';solids.push(heart);
  const coreRingMat=new T.MeshStandardMaterial({color:'#9a9272',metalness:.54,roughness:.39});
  for(let i=0;i<3;i++){
    const o=new T.Mesh(new T.TorusGeometry(2.6+i*.47,.09,6,64,TURN*(.65+i*.078)),coreRingMat);
    o.rotation.set(.35+i*.77,.47+i*.84,i*.45);core.add(o);
  }
  core.add(halo(T,'#73fff0',10));root.add(core);
  animations.push(time=>{core.rotation.y=time*.114;core.position.y=12.2+.30*Math.sin(time*.51);});
  const coastalAir=nearbyEffects(T,root,x,z),phase=water(T,coastalAir,x,z);animations.push(time=>{phase.value=time;});
  shoreVapour(T,coastalAir,materials.clock,heightAt,x,z);
  localMotes(T,coastalAir,materials.clock,heightAt,true,x,0,z);
  // Broad but broken causeway approaches the machine above the tidal flats.
  for(let i=0;i<21;i++){
    const d=10+i*1.29,v=1.5*Math.sin(i*.13);const [px,,pz]=pt(v,0,d);
    const level=Math.max(.70,Math.min(7.7,heightAt(px,pz)+.14));
    for(let side=0;side<2;side++){
      if(i===7&&side===0||i===12&&side===1)continue;
      k.box(...pt(v+(side-.5)*1.56,level,d),1.5,.37,1.21,side?limestone:'#909a8a',angle+.009*Math.sin(i));
    }
    if(i%3===0){
      k.box(...pt(v,level-1.3,d),2.37,2.49,.78,deep,angle);
      k.box(...pt(v+1.78,level+.45,d),.39,1.02,.42,bronze,angle);
      k.box(...pt(v+1.78,level+.91,d),.42,.10,.44,light,angle,0,0,'light');
    }
  }
  for(let i=0;i<8;i++){
    const depth=-12+i*5.7, v=-18.3-.8*Math.sin(i*.58), [px,,pz]=pt(v,0,depth);
    const base=heightAt(px,pz),h=[12,12,10,5,11,8,6,4][i];
    k.element(profile(T,[[0,0,0,1.3,1.2],[0,.8,0,.94,.98],[.15,h*.71,0,.62,.71],[.9,h,0,.54,.57]]),
      px,base-.5,pz,1,1,1,0,angle,.03*Math.sin(i),limestone);
    k.box(px,base+h-.30,pz,2.1,.58,1.8,bronze,angle);
    if(i<2)k.beam(pt(v,base+h-.08,depth),pt(v,base+h-.08,depth+5.85),.96,.97,limestone,'hard');
  }
  k.flush();
}

function heliostatField(T,root,heightAt,materials,solids,animations){
  const x=163,z=-19,base=heightAt(x,z)-.55;
  const k=builder(T,root,materials,solids,'Helioforge'),ash='#615c51',basalt='#4a4845',gold='#b39a63',copper='#a27952',light='#ffd580';
  k.drum(x,base+.32,z,12,13,.98,8,ash);
  k.drum(x,base+1.1,z,9.7,11.2,1.1,8,basalt);
  k.drum(x,base+1.88,z,8.9,9.8,.75,8,copper);
  k.drum(x,base+2.49,z,6.7,8.4,.54,8,ash);
  k.drum(x,base+3.07,z,4.7,6.3,.69,8,basalt);
  // This suspended crucible is a wide, flared heat exchanger with a visible
  // stack of ceramic jackets, copper radiators and glowing refractory slots.
  for(const [y,top,bottom,h,col] of [[4.0,4.0,5.25,1.45,ash],[5.26,4.45,3.46,1.4,basalt],
    [6.6,4.98,3.91,1.4,copper],[8.03,5.89,4.84,1.49,basalt],
    [9.47,6.62,5.37,1.46,copper],[10.62,6.93,6.31,.86,ash]]){
    k.drum(x,base+y,z,top,bottom,h,24,col);k.wire(x,base+y+h*.32,z,top*.99,.12,gold,Math.PI/2,0,0);
  }
  for(let i=0;i<40;i++){
    const a=TURN*i/40,sa=Math.sin(a),ca=Math.cos(a);
    k.beam([x+sa*4.04,base+4.25,z+ca*4.04],[x+sa*6.65,base+10.88,z+ca*6.65],i%4===0?.42:.22,.31,i%4?gold:ash,'trim');
    if(i%2===0)k.beam([x+sa*5.55,base+8.4,z+ca*5.55],[x+sa*6.35,base+10.28,z+ca*6.35],.14,.13,light,'light');
  }
  for(let i=0;i<48;i++){
    const a=i*TURN/48,r=8.1;
    k.box(x+Math.sin(a)*r,base+2.80,z+Math.cos(a)*r,i%4===0?.24:.096,.055,i%4===0?1.2:.49,i%4?gold:light,a,0,0,i%4?'trim':'light');
  }
  // Shorter heat stacks flank an asymmetrical spire in the rear. The open
  // top of the crucible is visible from the entry court.
  for(let q=0;q<3;q++){
    const a=[.22,2.83,1.60][q],c=Math.cos(a),s=Math.sin(a),ht=[11.5,13.5,22.3][q],offset=q===2?3.26:0;
    const p=(v,y,d)=>[x+c*v+s*d,base+y,z-s*v+c*d];
    const sections=[[8.94+offset,1.0,0,2.54,2.21],[9.10+offset,ht*.28,0,2.04,1.96],
      [10.91+offset,ht*.48,0,1.69,1.66],[11.50+offset,ht*.73,0,1.33,1.30],
      [11.57+offset,ht*.91,0,1.01,1.15],[11.62+offset,ht,0,.93,1.07]];
    k.element(profile(T,sections),x,base,z,1,1,1,0,a,0,copper);
    for(let i=1;i<sections.length;i++){
      const [r,y,,w,d]=sections[i-1],[rr,yy,,ww,dd]=sections[i];
      k.beam(p(r-w*.82,y,d*.42),p(rr-ww*.82,yy,dd*.42),.31,.26,light,'light');
      k.beam(p(r+w*.65,y,d*.85),p(rr+ww*.65,yy,dd*.85),.45,.47,gold,'trim');
      for(let m=1;m<=4;m++){
        const f=m/5,rad=lerp(r,rr,f),h=lerp(y,yy,f),w2=lerp(w,ww,f),d2=lerp(d,dd,f);
        k.box(...p(rad,h,d2+.025),w2*1.57,.22,.15,basalt,a,0,0,'trim');
      }
    }
    k.box(...p(11.62+offset,ht+.2,0),2.28,.56,2.49,basalt,a);
    for(let l=0;l<4;l++)k.box(...p(10.95+offset+l*.45,ht+.51,0),.16,.12,1.88,light,a,0,0,'light');
    const [px,,pz]=p(13,0,-1);
    k.drum(px,base+2.1,pz,1.18,1.45,4.2,8,ash);
    k.wire(px,base+3.66,pz,1.26,.14,gold,Math.PI/2,0,0);
  }
  const core=new T.Group();core.position.set(x,base+15.85,z);
  const heatClock={value:0},mantle=new T.MeshStandardMaterial({color:'#eaa24b',emissive:'#ffb55f',emissiveIntensity:1.1,roughness:.34,metalness:.22});
  mantle.onBeforeCompile=s=>{
    s.uniforms.heatClock=heatClock;s.vertexShader='varying vec3 orbP;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\norbP=position;');
    s.fragmentShader='varying vec3 orbP;uniform float heatClock;\n'+s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      vec3 molten=normalize(orbP);
      float curl=sin(molten.x*8.+sin(molten.y*4.+heatClock*.13)*2.7)+sin(molten.y*10.-molten.z*4.+heatClock*.18);
      float plates=.46*sin(molten.z*8.+curl*2.3)+.54*sin(molten.x*13.-molten.y*4.+curl);
      float veins=pow(1.-min(1.,abs(plates)*1.7),4.);
      diffuseColor.rgb=mix(vec3(.24,.053,.012),vec3(.85,.35,.067),smoothstep(-.86,.62,plates));
      totalEmissiveRadiance=mix(vec3(.33,.067,.011),vec3(2.75,1.55,.47),.18+.78*veins);
      `);
  };
  const ember=new T.Mesh(new T.IcosahedronGeometry(3.12,3),mantle);core.add(ember);
  const bandMat=new T.MeshStandardMaterial({color:gold,roughness:.41,metalness:.51});
  for(let i=0;i<2;i++){const band=new T.Mesh(new T.TorusGeometry(3.65+i*.67,.12,6,75,TURN*.84),bandMat);band.rotation.set(1.2+i*.62,.41,.27+i*.83);core.add(band);}
  core.add(halo(T,'#ffc175',17.2));root.add(core);
  animations.push(t=>{heatClock.value=t;core.rotation.y=t*.092;core.position.y=base+15.85+.17*Math.sin(t*.58);ember.rotation.z=.10*Math.sin(t*.18);});
  const hotAir=nearbyEffects(T,root,x,z);
  thermalColumn(T,hotAir,materials.clock,x,base+10.64,z);
  localMotes(T,hotAir,materials.clock,heightAt,false,x,base+10.88,z);
  // Individual facets, seams and edge rails remain readable at close range.
  const rand=randomSeed(981),tile=mirrorTile(T);
  for(let row=0;row<2;row++) for(let i=0;i<(row?9:7);i++){
    const a=-1.24+i*.33+row*.08,r=19+row*11.4+(i%2)*1.52,px=x+Math.sin(a)*r,pz=z-Math.cos(a)*r;
    const py=heightAt(px,pz),sz=.88+rand()*.43;
    k.drum(px,py+.34,pz,1.47*sz,1.92*sz,.64,8,ash);
    k.drum(px,py+2.63*sz,pz,.50*sz,.73*sz,5.22*sz,8,basalt);
    const hub=new T.Object3D();hub.position.set(px,py+5.5*sz,pz);
    hub.rotation.set(-.56+rand()*.13,-a*.65+.26,(rand()-.5)*.13,'YXZ');hub.updateMatrix();
    const m=new T.Object3D(),v=new T.Vector3(),quat=new T.Quaternion(),scale=new T.Vector3(),euler=new T.Euler(0,0,0,'YXZ');
    for(let r=-2;r<=2;r++)for(let c=-2;c<=2;c++){
      if(Math.abs(r)+Math.abs(c)>3)continue;
      m.position.set(c*1.22*sz,r*1.17*sz,-(r*r+c*c)*.041*sz);m.rotation.set(-r*.023,c*.026,0);m.scale.set(1.17*sz,1.12*sz,.18*sz);m.updateMatrix();
      m.matrix.premultiply(hub.matrix);m.matrix.decompose(v,quat,scale);euler.setFromQuaternion(quat,'YXZ');
      k.element(tile,v.x,v.y,v.z,scale.x,scale.y,scale.z,euler.x,euler.y,euler.z,['#c0a261','#d7b971','#b99862','#c6aa77'][(r+c+8+i)%4],'mirror');
    }
    k.beam([px,py+2.8*sz,pz],[px,py+5.6*sz,pz-1.45*sz],.35,.42,copper,'hard');
  }
  k.flush();
}

function botanicalShape(T,coast,seed,detail){
  const rand=randomSeed(seed),p=[],c=[],veins=[],ix=[],color=new T.Color();
  const vertex=(x,y,z,tone,light=1,u=.5,v=0,organ=0)=>{color.set(tone).multiplyScalar(light);p.push(x,y,z);c.push(color.r,color.g,color.b);veins.push(u,v,organ);return p.length/3-1;};
  const quad=(a,b,c,d)=>ix.push(a,b,d,b,c,d);
  const blades=[3,6,9][detail],leafRows=[2,3,6][detail];
  for(let i=0;i<blades;i++){
    const a=(i+rand()*.8)*TURN/blades,ca=Math.cos(a),sa=Math.sin(a),reach=.38+rand()*.54,h=.29+rand()*.61;
    const half=coast?.105+rand()*.06:.041+rand()*.037;
    const ring=[];
    for(let j=0;j<leafRows;j++){
      const t=j/(leafRows-1),dist=reach*t*t,up=h*(Math.sin(t*Math.PI*.79)+t*.21);
      const w=half*(detail===0?.5:Math.sin(t*Math.PI)**.7)+.002;
      const stage=Math.round(4*t),tone=coast?['#294d48','#468879','#5d9d86','#72a993','#9dc0a0'][stage]:['#6e5942','#978451','#b5a068','#c2a06c','#c3b580'][stage];
      const left=vertex(ca*dist+sa*w,up-.02*t,sa*dist-ca*w,tone,.93,0,t,.5),mid=vertex(ca*dist,up+.053*Math.sin(t*Math.PI),sa*dist,tone,1.15,.5,t,.5);
      const right=vertex(ca*dist-sa*w,up-.02*t,sa*dist+ca*w,tone,.75,1,t,.5);
      if(j){const [l,m,r]=ring[j-1];quad(l,m,mid,left);quad(m,r,right,mid);}
      ring.push([left,mid,right]);
    }
  }
  if(coast){
    const h=.91+rand()*.21,x=.05,z=.02;
    quad(vertex(0,0,-.017,'#345d4d'),vertex(-.017,0,.007,'#345d4d'),vertex(x-.006,h,z+.006,'#739b75'),vertex(x+.006,h,z-.006,'#739b75'));
    const petals=[5,6,7][detail],layers=detail===2?2:1;
    for(let layer=0;layer<layers;layer++)for(let i=0;i<petals;i++){
      const a=(i+layer*.47)*TURN/petals,ca=Math.cos(a),sa=Math.sin(a),w=layer?.07:.092;
      const q=(r,up,s,color,u,v)=>vertex(x+ca*r+sa*s,h+up,z+sa*r-ca*s,color,1,u,v,1);
      const root=q(0,0,0,'#406d76',.5,0),lo=q(.13,.035,-w,'#47a8ad',0,.42),hi=q(.13,.035,w,'#69b9b2',1,.42);
      const ridge=q(.20,.085,0,layer?'#a5e5d6':'#83c7ce',.5,.61),tip=q(layer?.24:.34,layer?.22:.15,0,'#b8ebe2',.5,1);
      ix.push(root,lo,ridge,root,ridge,hi);
      if(detail===2){
        const l=q(layer?.218:.267,layer?.153:.105,-w*.56,'#8dd4cf',.12,.77),r=q(layer?.218:.267,layer?.154:.108,w*.49,'#9edacf',.90,.77);
        ix.push(lo,l,ridge,l,tip,ridge,ridge,tip,r,ridge,r,hi);
      }else ix.push(lo,tip,ridge,ridge,tip,hi);
    }
    for(let k=0;k<(detail===2?7:0);k++){
      const a=TURN*k/7,sx=x+Math.cos(a)*.035,sz=z+Math.sin(a)*.035;
      ix.push(vertex(sx-.014,h+.064,sz,'#b1e5c5'),vertex(sx+.013,h+.074,sz,'#b1e5c5'),vertex(sx,h+.16,sz+.008,'#f1e7ad'));
    }
  }else{
    for(let stem=0;stem<[2,3,5][detail];stem++){
      const a=rand()*TURN,ca=Math.cos(a),sa=Math.sin(a),lean=.11+rand()*.27,h=.92+rand()*.65;
      const head=(t,side,stretch,up,tone)=>vertex(ca*(lean*t+stretch)+sa*side,h*t+up,sa*(lean*t+stretch)-ca*side,tone);
      quad(head(0,-.013,0,0,'#786943'),head(0,.012,0,0,'#786943'),head(1,.008,0,0,'#d3ae65'),head(1,-.007,0,0,'#dbaf65'));
      const awns=[2,4,8][detail];
      for(let q=0;q<awns;q++)for(const dir of [-1,1]){
        const t=.69+q*.31/awns,w=(1-q/(awns*1.42))*.088+.018,leaf=head(t,0,0,0,'#935c3c');
        const bulge=head(t,dir*w*.66,.005,.053,'#db9b4e'),tip=head(t,dir*w,.028,.16,'#ecd49a');
        ix.push(leaf,bulge,tip);
      }
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setAttribute('venation',new T.Float32BufferAttribute(veins,3));g.setIndex(ix);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
function sectorFlora(T,root,heightAt,coast,animations){
  const cx=coast?-159:163,cz=coast?-78:-19,rand=randomSeed(coast?4992:5134);
  const material=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.93,metalness:.03});
  const clock={value:0};material.onBeforeCompile=s=>{
    s.uniforms.fieldTime=clock;s.vertexShader='uniform float fieldTime;attribute vec3 venation;varying vec3 organ;varying float closeLeaf;varying float petalPulse;\n'+s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      organ=venation;
      #ifdef USE_INSTANCING
      vec2 cell=instanceMatrix[3].xz;closeLeaf=1.-smoothstep(5.,24.,distance(cameraPosition,instanceMatrix[3].xyz));
      petalPulse=.5+.5*cos(fieldTime*.76-distance(cell,vec2(-159.,-78.))*.28);
      transformed.x+=.055*position.y*position.y*sin(cell.x*.22+cell.y*.12+fieldTime);
      #endif`);
    s.fragmentShader='varying vec3 organ;varying float closeLeaf;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      if(closeLeaf>.002&&organ.z>.25){
        float t=organ.y,u=abs(organ.x-.5);
        float ribs=(t-.56*u)*16.+.4*sin(t*8.);
        float aa=fwidth(ribs);
        float vein=(1.-smoothstep(.03,.11+aa,abs(fract(ribs+.5)-.5)))*(1.-smoothstep(.15,.55,aa));
        float mid=1.-smoothstep(.018,.056+fwidth(u),u);
        diffuseColor.rgb*=1.+closeLeaf*(.12*vein+.13*mid-.060);
        diffuseColor.rgb+=closeLeaf*smoothstep(.66,1.,organ.z)*vec3(.014,.039,.039)*vein;
      }`);
    if(coast){
      s.fragmentShader='varying float petalPulse;\n'+s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        float lumLeaf=smoothstep(.75,1.,organ.z)*smoothstep(.32,.90,organ.y)*petalPulse*petalPulse;
        totalEmissiveRadiance+=vec3(.021,.27,.23)*lumLeaf;`);
    }
  };
  material.customProgramCacheKey=()=>coast?'tidal-rosettes-2':'solar-awn-2';
  animations.push(t=>{clock.value=t;});
  const stamp=new T.Object3D(),tint=new T.Color(),rows=[];
  for(let i=0;i<(coast?32:39);i++){
    const a=rand()*TURN,r=coast?1:17+rand()*23,ring=coast?.82+rand()*.52:1;
    const x=cx+Math.cos(a)*(coast?34*ring:r),z=cz+Math.sin(a)*(coast?26*ring:r);
    for(let j=0;j<29;j++){
      const d=Math.sqrt(rand()),az=rand()*TURN,px=x+Math.cos(az)*d*4.5,pz=z+Math.sin(az)*d*4.2,py=heightAt(px,pz);
      if(py<-.56||Math.abs(heightAt(px+.55,pz)-py)>.97||Math.abs(heightAt(px,pz+.55)-py)>.97)continue;
      if(coast){
        const rx=px-cx,rz=pz-cz,along=rx*.635+rz*.773,across=rx*.773-rz*.635;
        if(along>8&&along<37&&Math.abs(across-1.4*Math.sin((along-10)*.102))<2.1)continue;
      }
      rows.push([px,py,pz,rand()*TURN,.49+rand()**.8*1.07,.80+rand()*.28]);
    }
  }
  // Split flower stands into two small cells per quadrant. A visitor at the
  // opposite end of the world does not pay for close botanical geometry.
  const cells=new Map();
  for(const row of rows){const key=Math.floor(row[0]/22)+','+Math.floor(row[2]/22);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(row);}
  const specimens=Array.from({length:3},(_,v)=>[0,1,2].map(d=>botanicalShape(T,coast,(coast?179:183)+v*47,d)));
  let index=0;
  for(const entries of cells.values()){
    const geometry=specimens[index++%3],mesh=new T.InstancedMesh(geometry[2],material,entries.length);mesh.name=coast?'Blue tidal rosettes':'Sun-gold awns';
    entries.forEach(([x,y,z,a,sz,light],i)=>{stamp.position.set(x,y-.04,z);stamp.rotation.set(0,a,0);stamp.scale.set(sz,sz*(.85+.23*rand()),sz);stamp.updateMatrix();
      mesh.setMatrixAt(i,stamp.matrix);mesh.setColorAt(i,tint.setRGB(light,light,light*.985));});
    mesh.computeBoundingSphere();mesh.receiveShadow=true;
    const marker=mesh.boundingSphere.center.clone(),group=new T.LOD();
    group.update=cam=>{const e=cam.matrixWorld.elements,d=Math.hypot(marker.x-e[12],marker.y-e[13],marker.z-e[14])/cam.zoom;const f=Math.max(.0,Math.min(1,(143-d)/73));mesh.geometry=geometry[d<19?2:d<46?1:0];mesh.count=Math.ceil(entries.length*f);mesh.visible=mesh.count>0;};
    group.add(mesh);root.add(group);
  }
}
function courtPavement(T,root,heightAt){
  const rand=randomSeed(12005),p=[],colors=[],normal=[],color=new T.Color(),v1=new T.Vector3(),v2=new T.Vector3();
  const palette=['#8d907e','#93917d','#7c8578','#9b9882','#838976','#858977','#a09c83'];
  function face(a,b,c,tone,shade=1){
    const n=v1.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]).cross(v2.set(c[0]-a[0],c[1]-a[1],c[2]-a[2])).normalize();
    color.set(tone).multiplyScalar(shade);
    for(const v of [a,b,c]){p.push(...v);normal.push(n.x,n.y,n.z);colors.push(color.r,color.g,color.b);}
  }
  const surface=(x,z,lift)=>[x,heightAt(x,z)+lift,z];
  function tile(poly,tone,step){
    let cx=0,cz=0;for(const v of poly){cx+=v[0]/poly.length;cz+=v[1]/poly.length;}
    const inset=.953+.025*rand(),top=step+.075*rand();
    const rim=poly.map(([x,z])=>surface(x,z,step-.060)),cap=poly.map(([x,z])=>surface(lerp(cx,x,inset),lerp(cz,z,inset),top));
    const center=surface(cx,cz,top+.007);
    for(let j=0;j<poly.length;j++){
      const k=(j+1)%poly.length;
      face(center,cap[k],cap[j],tone,.97+rand()*.045);
      face(rim[j],cap[j],cap[k],tone,.69);face(rim[j],cap[k],rim[k],tone,.75);
      const b0=[rim[j][0],rim[j][1]-.23,rim[j][2]],b1=[rim[k][0],rim[k][1]-.23,rim[k][2]];
      face(b0,rim[j],rim[k],tone,.49);face(b0,rim[k],b1,tone,.51);
    }
  }
  const cx=6,cz=-150;
  const polar=(a,r)=>[cx+Math.cos(a)*r,cz+Math.sin(a)*r];
  // The radial slabs were cut for the survey mechanism. Slanted joints,
  // missing sections and occasional breaks expose its earlier foundations.
  const radii=[.70,3.58,6.25,9.15,12.10,15.95,19.25,22.35,25.80,29.12,32.1,34.6];
  for(let row=0;row<radii.length-1;row++){
    const inner=radii[row],outer=radii[row+1],count=row===0?8:Math.round((inner+outer)*Math.PI/(row<3?4:5.2));
    const phase=(row%2*.47+row*.08)*TURN/count, seam=.053+(row>6?.035:0);
    for(let j=0;j<count;j++){
      const start=phase+j*TURN/count+.009*rand(),end=phase+(j+1)*TURN/count-.006*rand();
      const mid=(start+end)*.5,swale=Math.sin(mid*3+.82)+.54*Math.sin(mid*7-row*.7);
      if(row>2 && (swale>1.24&&rand()<.58||row>6&&rand()<.065))continue;
      const a=start+seam/inner,b=end-seam/inner,tilt=(row%3-1)*.039,ri=inner+.075,ro=outer-.076;
      const chip=.065+rand()*.28,ba=a+tilt,bb=b+tilt;
      const shape=[polar(a+chip/ri,ri),polar(a,ri+chip),polar(ba,ro-chip),polar(ba+chip/ro,ro),
        polar((ba+bb)/2,ro),polar(bb-chip/ro,ro),polar(bb,ro-chip),polar(b,ri+chip),polar(b-chip/ri,ri),polar((a+b)/2,ri)];
      // The perimeter is stored counterclockwise in the horizontal x-z plane.
      const signed=shape.reduce((sum,v,k)=>{const next=shape[(k+1)%shape.length];return sum+v[0]*next[1]-next[0]*v[1];},0);
      if(signed<0)shape.reverse();
      const tone=palette[Math.floor(rand()*palette.length)];
      tile(shape,tone,row>8?.16:.115);
    }
  }
  const geo=new T.BufferGeometry();for(const [name,buf] of [['position',p],['normal',normal],['color',colors]])geo.setAttribute(name,new T.Float32BufferAttribute(buf,3));
  geo.computeBoundingSphere();const stone=new T.MeshStandardMaterial({vertexColors:true,roughness:.94,metalness:.065,side:T.DoubleSide});
  const atlas=geologyMap(T);
  stone.onBeforeCompile=s=>{
    s.uniforms.estateRock={value:atlas};
    s.vertexShader='varying vec3 courtP;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncourtP=position;');
    s.fragmentShader='varying vec3 courtP;uniform sampler2D estateRock;\n'+s.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 plane=courtP.xz;
      vec4 macro=texture2D(estateRock,plane*.047);
      vec4 weather=texture2D(estateRock,plane*.21+.021*macro.ba);
      vec4 grit=texture2D(estateRock,plane*.91+.055*weather.gb);
      float moss=smoothstep(.47,.67,macro.g*.61+weather.g*.33+grit.r*.06);
      float scratch=pow(max(0.,cos(plane.x*1.43+plane.y*.83+macro.a*4.9+weather.a*.52)),16.)*
        smoothstep(.41,.64,macro.a+.13*weather.b);
      float stoneLift=weather.a*.072+grit.a*.021-scratch*.055+moss*.025;
      diffuseColor.rgb*=.58+.52*weather.r+.24*grit.r;
      diffuseColor.rgb*=1.-.35*scratch;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.089,.13,.057)*(.66+.8*grit.r),moss*.78);
      `).replace('#include <normal_fragment_maps>',`
      #include <normal_fragment_maps>
      vec3 cx=dFdx(-vViewPosition),cy=dFdy(-vViewPosition),cr1=cross(cy,normal),cr2=cross(normal,cx);
      float detCourt=dot(cx,cr1);
      normal=normalize(max(.000001,abs(detCourt))*normal-sign(detCourt)*(cr1*dFdx(stoneLift)+cr2*dFdy(stoneLift)));
      `);
  };
  const paving=new T.Mesh(geo,stone);paving.name='Fractured radial court paving';paving.receiveShadow=true;root.add(paving);
}
function registrationCourt(T,root,heightAt,materials,solids){
  const cx=6,cz=-150,k=builder(T,root,materials,solids,'Northern registration court');
  const patina='#72867a',brass='#a49472',dark='#56635b',phosphor='#83d0c3';
  courtPavement(T,root,heightAt);
  const centerY=heightAt(cx,cz);
  k.drum(cx,centerY+.14,cz,.83,.89,.19,16,dark,'trim');
  k.wire(cx,centerY+.244,cz,.59,.054,brass,Math.PI/2,0,0,TURN,'trim',40);
  for(const angle of [-2.56,-.69,1.95]){
    const ca=Math.cos(angle),sa=Math.sin(angle);
    for(let i=0;i<11;i++){
      const r=4.2+i*2.58,length=i%4===0?1.36:2.24;
      for(const offset of [-.12,.12]){
        const ax=cx+ca*r-sa*offset,az=cz+sa*r+ca*offset,bx=ax+ca*length,bz=az+sa*length;
        const glow=i%4===0&&offset>0;
        k.beam([ax,heightAt(ax,az)+.202,az],[bx,heightAt(bx,bz)+.202,bz],glow?.088:.078,.052,glow?phosphor:brass,glow?'light':'trim');
      }
    }
  }
  // Survey ticks follow the ground contour. The entire center is clear above
  // ankle height for unrestricted travel through the chamber.
  for(const [radius,count] of [[9,40],[22,76],[30,96]]){
    for(let i=0;i<count;i++){
      if((i+1)%17===0 || i%23===7)continue;
      const a=i*TURN/count,b=(i+.92)*TURN/count,ax=cx+Math.cos(a)*radius,az=cz+Math.sin(a)*radius;
      const bx=cx+Math.cos(b)*radius,bz=cz+Math.sin(b)*radius;
      k.beam([ax,heightAt(ax,az)+.19,az],[bx,heightAt(bx,bz)+.19,bz],radius===22?.27:.16,.064,
        radius===9?brass:radius===30?patina:dark,'trim');
      if(i%(radius===30?6:8)===0){
        const len=radius===30?1.46:.80,px=cx+Math.cos(a)*(radius-len),pz=cz+Math.sin(a)*(radius-len);
        k.beam([ax,heightAt(ax,az)+.20,az],[px,heightAt(px,pz)+.20,pz],.12,.074,phosphor,'light');
      }
    }
  }
  for(const dir of [-1,1]){
    for(let i=0;i<12;i++){
      const a=(dir<0?Math.PI:0)+(i-5.5)*.071,rad=32.1;
      const px=cx+Math.cos(a)*rad,pz=cz+Math.sin(a)*rad,y=heightAt(px,pz);
      if(i===2||i===9)continue;
      for(let level=0;level<3;level++)k.box(px+Math.cos(a)*level*.83,y+.19+level*.33,pz+Math.sin(a)*level*.83,2.32,.40,1.63,
        level===2?brass:patina,-a-Math.PI/2,0,0,'hard');
    }
    for(let i=0;i<4;i++){
      const x=cx+dir*(34.8+.6*Math.sin(i)),z=cz-19+i*12.7,y=heightAt(x,z),h=[4.5,9.1,6.4,3.8][i];
      k.element(profile(T,[[0,0,0,1.94,1.30],[.12,1.16,0,1.33,1.1],[.40,h*.71,0,.85,.82],[.88,h,0,.64,.69]]),
        x,y-.4,z,1,1,1,0,dir*.68,dir*.046,i%2?dark:patina);
      k.box(x-.27*dir,y+h*.44,z+.8,.10,h*.60,.085,phosphor,dir*.68,0,0,'light');
      if(i<3)k.beam([x,y+.09,z],[x,heightAt(x,z+12.6)+.09,z+12.6],.20,.12,phosphor,'light');
    }
  }
  k.flush();
}
export function buildDistricts(THREE,scene,heightAt){
  const solids=[],clock={value:0},animations=[time=>{clock.value=time;}],root=new THREE.Group();root.name='Outer districts';scene.add(root);
  const materials={clock,metal:metalSkin(THREE,clock),mirror:mirrorCoating(THREE),glow:new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})};
  conservatory(THREE,root,heightAt,materials,solids,animations);
  heliostatField(THREE,root,heightAt,materials,solids,animations);
  registrationCourt(THREE,root,heightAt,materials,solids);
  sectorFlora(THREE,root,heightAt,true,animations);
  sectorFlora(THREE,root,heightAt,false,animations);
  return {solids,update(time){for(const animate of animations)animate(time);}};
}
