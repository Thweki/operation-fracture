// Cleaved slabs of gneiss: an asymmetrical footprint is split by a fault,
// then each side weathers and settles independently along its bedding planes.
function seeded(seed) {
  let state = Math.imul(seed + 71, 72851) >>> 0;
  return () => ((state = (Math.imul(1664525,state) + 1013904223) >>> 0) / 4294967296);
}
function clip(polygon, nx, nz, offset, sign) {
  const result = [];
  for (let i=0; i<polygon.length; i++) {
    const a=polygon[i], b=polygon[(i+1)%polygon.length];
    const da=sign*(a[0]*nx+a[1]*nz-offset), db=sign*(b[0]*nx+b[1]*nz-offset);
    if (da>=0) result.push(a);
    if ((da<0)!==(db<0)) {
      const f=da/(da-db);
      result.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);
    }
  }
  return result;
}

export function rockGeometry(T,seed,detail=2){
  const random=seeded(seed),kind=((seed%3)+3)%3;
  const az=random()*Math.PI*2,cornerCount=[8,7,9][kind],outline=[];
  // Three lithologies tumble differently. The long shale slab splits into
  // plates, the quartzite core rounds at its shoulders, the jointed siltstone
  // retains a short asymmetric scarp.
  const elongation=[.84,.98,.78][kind],exponent=[.77,.90,.68][kind];
  for(let i=0;i<cornerCount;i++){
    const theta=az+Math.PI*2*(i+(random()-.5)*.51)/cornerCount;
    const c=Math.cos(theta),s=Math.sin(theta),r=.80+.20*random();
    outline.push([Math.sign(c)*Math.abs(c)**exponent*r,Math.sign(s)*Math.abs(s)**exponent*r*elongation]);
  }
  const strike=az+1.06+(random()-.5)*.83,nx=Math.cos(strike),nz=Math.sin(strike);
  const cut=[.26,.59,.38][kind]+(random()-.5)*.15;
  const beddingX=(random()-.5)*.17,beddingZ=(random()-.5)*.19;
  const mainHeight=[.89,1.02,.93][kind],sill=[.51,.67,.42][kind];
  const baseColors=['#858074','#88897c','#827e72'],stone=new T.Color(baseColors[kind]);
  const umber=new T.Color('#66665c'),topTint=new T.Color('#92947c');
  const positions=[],normals=[],colors=[];
  const a=new T.Vector3(),b=new T.Vector3(),faceNormal=new T.Vector3();
  // Normal smoothing stops at fracture edges. Two triangles across a broad
  // worn face share a normal even if the four corners are slightly warped.
  function surface(vertices,faces){
    const adjacent=vertices.map(()=>[]);
    for(const face of faces){
      const [i,j,k]=face.ids;
      a.subVectors(vertices[j].p,vertices[i].p);b.subVectors(vertices[k].p,vertices[i].p);
      const n=a.cross(b).clone();
      if(face.ids.length===4){
        a.subVectors(vertices[k].p,vertices[i].p);b.subVectors(vertices[face.ids[3]].p,vertices[i].p);n.add(a.cross(b));
      }
      n.normalize();face.n=n;
      for(const id of face.ids)adjacent[id].push(n);
    }
    for(const face of faces){
      for(const k of (face.ids.length===4?[0,1,2,0,2,3]:[0,1,2])){
        const id=face.ids[k],v=vertices[id];
        faceNormal.copy(face.n).multiplyScalar(1.45);
        for(const n of adjacent[id]){
          const alignment=n.dot(face.n);
          if(alignment>.47)faceNormal.addScaledVector(n,Math.min(1,(alignment-.47)*3.6));
        }
        faceNormal.normalize();
        positions.push(v.p.x,v.p.y,v.p.z);normals.push(faceNormal.x,faceNormal.y,faceNormal.z);
        colors.push(v.c.r*face.shade,v.c.g*face.shade,v.c.b*face.shade);
      }
    }
  }
  const islands=kind===1?[[-1,outline]]:[[-1,clip(outline,nx,nz,cut,-1)],[1,clip(outline,nx,nz,cut,1)]];
  for(const [sign,polygon] of islands){
    if(polygon.length<3)continue;
    const cx=polygon.reduce((n,v)=>n+v[0],0)/polygon.length,cz=polygon.reduce((n,v)=>n+v[1],0)/polygon.length;
    const h=mainHeight*(sign<0?1:sill),groove=.34+random()*.16;
    const fall=az+random()*2.47,fx=Math.cos(fall),fz=Math.sin(fall);
    const outlinePoints=[];
    for(let i=0;i<polygon.length;i++){
      const corner=polygon[i],prev=polygon[(i+polygon.length-1)%polygon.length],next=polygon[(i+1)%polygon.length];
      const a=.095+random()*.125,b=.084+random()*.121,chip=random();
      // Preserve large bevels in mid-distance silhouettes. Small nicks reduce
      // to one corner where the stone projects to only a few pixels.
      if(detail===2&&i%3!==2||detail===1&&i%4===1){
        outlinePoints.push([corner[0]+(prev[0]-corner[0])*a,corner[1]+(prev[1]-corner[1])*a,chip]);
        outlinePoints.push([corner[0]+(next[0]-corner[0])*b,corner[1]+(next[1]-corner[1])*b,chip*.78+.1]);
      }else outlinePoints.push([corner[0],corner[1],chip]);
    }
    const crown=[.72,.52,.66][kind],bevel=[.90,.76,.86][kind];
    const strata=[[-.78,.66],[.01,.95],[groove-.047,1.00],[groove+.015,.996],[groove+.075,1.002],[.70,.94],[.89,bevel],[1,crown]];
    const levels=detail===2?[0,1,2,3,4,5,6,7]:detail===1?[0,1,2,4,6,7]:[0,1,5,7];
    const v=[],faces=[],rows=[];
    for(const level of levels){
      const [y,r]=strata[level],ring=[];
      for(const [x,z,irregular] of outlinePoints){
        const dx=x-cx,dz=z-cz,along=dx*fx+dz*fz;
        const tilt=beddingX*x+beddingZ*z;
        const lip=Math.max(0,(y-.50)*2),fracture=Math.max(0,.22+.69*along+.19*irregular);
        const recess=level===3?.066*fracture:0;
        const rad=r-recess+.036*(irregular-.5)+lip*(irregular-.5)*.096;
        const shift=kind===1?0:sign*(.013+Math.max(0,y)*.033);
        const wx=cx+dx*rad+nx*shift-fx*lip*.085;
        const wz=cz+dz*rad+nz*shift-fz*lip*.085;
        // A worn nose loses height gradually. The cap stays a broad, tilted
        // plane; no apex rises above it into a triangular spike.
        const weathering=lip*(Math.max(0,along+.09)*[.22,.34,.27][kind]+.072*irregular);
        const dip=level>=2&&level<=4?.14*along+.065*(irregular-.5):0;
        const wy=h*(y+tilt-weathering+dip+(irregular-.50)*(level===5?.11:.046));
        const c=stone.clone().lerp(umber,level===3?.08+.37*fracture:level===0?.30:.06+.10*irregular);
        if(level>=6)c.lerp(topTint,level===7?.42:.19);
        ring.push(v.length);v.push({p:new T.Vector3(wx,wy,wz),c:c.multiplyScalar(.90+.12*irregular)});
      }
      if(rows.length){
        const lower=rows.at(-1);
        for(let i=0;i<ring.length;i++){
          const j=(i+1)%ring.length,p=outlinePoints[i],q=outlinePoints[j];
          const fault=kind!==1&&Math.abs((p[0]+q[0])*nx*.5+(p[1]+q[1])*nz*.5-cut)<.025;
          faces.push({ids:[lower[j],lower[i],ring[i],ring[j]],shade:fault?.86:1});
        }
      }
      rows.push(ring);
    }
    const rim=rows.at(-1),center=new T.Vector3(),color=topTint.clone();
    for(const id of rim)center.add(v[id].p);
    center.multiplyScalar(1/rim.length);center.y+=h*(kind===1?.041:.017);
    const middle=v.length;v.push({p:center,c:color.multiplyScalar(.99)});
    for(let i=0;i<rim.length;i++)faces.push({ids:[middle,rim[(i+1)%rim.length],rim[i]],shade:1});
    surface(v,faces);
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.computeBoundingSphere();return geo;
}

const mineralAtlases=new WeakMap();
const slopeAtlases=new WeakMap();
export function geologyMap(THREE) {
  if(mineralAtlases.has(THREE))return mineralAtlases.get(THREE);
  const random=seeded(1771),n=512,data=new Uint8Array(n*n*4);
  // Explicitly repeat the last lattice column and row. The inner loop can
  // interpolate four adjacent values without a hash lookup or modular wrap.
  function lattice(fx,fy) {
    const stride=fx+1,grid=new Float32Array(stride*(fy+1));
    for(let j=0;j<fy;j++){
      for(let i=0;i<fx;i++)grid[j*stride+i]=random();
      grid[j*stride+fx]=grid[j*stride];
    }
    grid.set(grid.subarray(0,stride),fy*stride);
    return (x,y)=>{
      const u=(x-Math.floor(x))*fx,v=(y-Math.floor(y))*fy,ix=Math.floor(u),iy=Math.floor(v);
      let a=u-ix,b=v-iy;a=a*a*(3-2*a);b=b*b*(3-2*b);
      const k=iy*stride+ix,lo=grid[k]+a*(grid[k+1]-grid[k]),hi=grid[k+stride]+a*(grid[k+stride+1]-grid[k+stride]);
      return lo+(hi-lo)*b;
    };
  }
  const large=lattice(4,4), flecks=lattice(46,41),undulate=lattice(5,8),lamina=lattice(17,74);
  const drainage=lattice(54,7),rain=lattice(18,4),lichenField=lattice(12,11),grains=lattice(123,109);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++) {
    const x=i/n,y=j/n,grain=random(),macro=large(x,y),fine=flecks(x,y);
    const warp=undulate(x,y);
    const schist=lamina(x+.025*macro,y+.024*warp);
    const band=(y*7+warp*.58+macro*.22+fine*.032)*Math.PI*2;
    const thread=Math.pow(Math.max(0,Math.cos(band)),19);
    const cleft=Math.pow(Math.max(0,Math.cos(band*2+.6)),13)*(.35+.65*fine);
    const channel=drainage(x+.04*warp,y)*.67+rain(x,y)*.33;
    const lichen=macro*.45+lichenField(x+.035*fine,y)*.34+fine*.21+(grain-.5)*.08;
    const grainscale=grains(x,y);
    const relief=.35*schist+.27*fine+.18*warp+.16*channel+grainscale*.12-cleft*.16;
    const albedo=.13+.34*macro+.14*schist+.21*fine+.13*grainscale+.07*grain+thread*.18-cleft*.24;
    const k=(j*n+i)*4;
    data[k]=255*Math.max(0,Math.min(1,albedo)); data[k+1]=255*lichen;
    data[k+2]=255*channel; data[k+3]=255*Math.max(0,Math.min(1,relief));
  }
  const tex=new THREE.DataTexture(data,n,n);
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps=true;tex.anisotropy=8;tex.needsUpdate=true;mineralAtlases.set(THREE,tex);
  return tex;
}

// Average derivatives in the mip pyramid before shading. Differentiating
// isolated screen samples of a narrow crack produces a checkerboard at dusk.
export function geologySlopes(T,texture){
  if(slopeAtlases.has(texture))return slopeAtlases.get(texture);
  const {width:n,data}=texture.image,bytes=new Uint8Array(n*n*2);
  const sample=(x,y)=>data[4*(n*((y+n)%n)+(x+n)%n)+3];
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=2*(y*n+x);
    bytes[i]=Math.max(0,Math.min(255,127.5+1.25*(sample(x+1,y)-sample(x-1,y))));
    bytes[i+1]=Math.max(0,Math.min(255,127.5+1.25*(sample(x,y+1)-sample(x,y-1))));
  }
  const slope=new T.DataTexture(bytes,n,n,T.RGFormat);
  slope.wrapS=slope.wrapT=T.RepeatWrapping;slope.minFilter=T.LinearMipmapLinearFilter;slope.magFilter=T.LinearFilter;
  slope.generateMipmaps=true;slope.anisotropy=4;slope.needsUpdate=true;slopeAtlases.set(texture,slope);return slope;
}
export const mineralNormals=`
  uniform sampler2D mineralSlopes;
  vec3 mineralGradient(vec3 weights,vec2 uvX,vec2 uvY,vec2 uvZ,vec3 rate,float taper){
    vec2 x=(texture2D(mineralSlopes,uvX).rg*2.-1.)*102.4;
    vec2 y=(texture2D(mineralSlopes,uvY).rg*2.-1.)*102.4;
    vec2 z=(texture2D(mineralSlopes,uvZ).rg*2.-1.)*102.4;
    return weights.x*vec3(0.,x.y*rate.z,x.x*rate.x+x.y*taper)
      +weights.y*vec3(y.x*rate.y,0.,y.y*rate.y)
      +weights.z*vec3(z.x*rate.x-z.y*taper,z.y*rate.z,0.);
  }`;

export function rockMaterial(THREE, texture=geologyMap(THREE)) {
  const material=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.96,metalness:.009,
  });
  // World-space mapping keeps crystals and lichen the same physical size on
  // pebbles and cliff faces. The map stores relief separately from pigmentation.
  material.onBeforeCompile=shader=>{
    shader.uniforms.rockGrain={value:texture};
    shader.uniforms.mineralSlopes={value:geologySlopes(THREE,texture)};
    shader.vertexShader='varying vec4 geologicalPoint;\n'+shader.vertexShader.replace(
      '#include <project_vertex>',`
        #include <project_vertex>
        vec4 localRock = vec4(transformed,1.);
        #ifdef USE_INSTANCING
          localRock=instanceMatrix*localRock;
        #endif
        geologicalPoint=vec4((modelMatrix*localRock).xyz,position.y);
      `);
    shader.fragmentShader=mineralNormals+'\nuniform sampler2D rockGrain;\nvarying vec4 geologicalPoint;\n'+
      shader.fragmentShader.replace('#include <color_fragment>',`
        #include <color_fragment>
        vec3 rp=geologicalPoint.xyz;
        vec3 Nrock=inverseTransformDirection(normalize(vNormal),viewMatrix);
        vec3 weights=pow(abs(Nrock),vec3(5.));
        weights/=max(.00001,dot(weights,vec3(1.)));
        vec2 uvX=vec2(rp.z*.22,rp.y*.32+rp.z*.048),uvY=rp.xz*.24,uvZ=vec2(rp.x*.22,rp.y*.32-rp.x*.048);
        vec4 detailX=texture2D(rockGrain,uvX);
        vec4 detailY=texture2D(rockGrain,uvY);
        vec4 detailZ=texture2D(rockGrain,uvZ);
        vec4 grain=detailX*weights.x+detailY*weights.y+detailZ*weights.z;
        vec4 deposit=texture2D(rockGrain,vec2((rp.x+.62*rp.z)*.066,rp.y*.088+rp.z*.019));
        float upright=clamp(Nrock.y,0.,1.);
        float rain=smoothstep(.26,.67,grain.b);
        float foot=1.-smoothstep(-.03,.51,geologicalPoint.w);
        float growth=grain.g*.56+deposit.g*.44+.15*(grain.r-.5)+.034*foot;
        float crust=smoothstep(.452,.601,growth)*
          smoothstep(.01,.79,upright+.27*deposit.r+.08*foot);
        float shear=smoothstep(.46,.59,deposit.b)*.38;
        float bedding=rp.y*.86+rp.x*.067-rp.z*.047+.34*deposit.a+shear+.048*grain.r;
        float band=fract(bedding);
        float resolved=1.-smoothstep(.10,.44,fwidth(bedding));
        float rawJoint=(1.-smoothstep(.014,.100,abs(band-.37)))*smoothstep(.24,.60,deposit.b)*(1.-.66*upright);
        float fissure=rawJoint*resolved;
        float strata=cos(bedding*11.7+deposit.r*3.7+grain.r*.93);
        float quartz=smoothstep(.86,1.,strata)*smoothstep(.32,.7,deposit.g)*
          (1.-.75*upright);
        diffuseColor.rgb*=(.56+.88*grain.r)*(.78+deposit.r*.43)*
          mix(.80+.32*rain,1.,upright)*(1.-.27*fissure-.10*foot);
        float rust=smoothstep(.49,.76,deposit.g+.11*grain.b)*(.60+.4*fissure)*(1.-upright*.53);
        diffuseColor.rgb*=mix(vec3(1.),vec3(1.13,.95,.79),rust*.69);
        diffuseColor.rgb+=quartz*vec3(.052,.049,.040)*resolved;
        vec3 moss=mix(vec3(.092,.116,.055),vec3(.18,.207,.089),clamp(.73*grain.g+.27*deposit.r,0.,1.));
        diffuseColor.rgb=mix(diffuseColor.rgb,moss*(.70+.55*grain.r),crust*.73);
        float lichen=(1.-smoothstep(.012,.045,abs(growth-.539)))*smoothstep(.37,.68,grain.b)*upright;
        diffuseColor.rgb+=lichen*vec3(.019,.015,.003);
        float contact=1.-smoothstep(5.,24.,length(vViewPosition));
        float pores=.5;
        if(contact>.002){
          vec2 microUV=vec2(rp.x*.81+rp.z*.57,rp.y+.35*rp.z-.28*rp.x)*2.18;
          vec4 cells=texture2D(rockGrain,microUV);
          pores=cells.r;
          float flecks=smoothstep(.67,.86,cells.r)*smoothstep(.49,.69,cells.a);
          diffuseColor.rgb*=1.+contact*(cells.r-.51)*.48;
          diffuseColor.rgb+=vec3(.040,.038,.027)*flecks*contact*(1.-crust);
        }
      `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=clamp(.86+.11*crust-.20*quartz+(pores-.5)*.15*contact,.58,1.);
      `).replace('#include <normal_fragment_maps>',`
        #include <normal_fragment_maps>
        if(contact>.002){
          vec3 slope=mineralGradient(weights,uvX,uvY,uvZ,vec3(.22,.24,.32),.048)*.032;
          slope-=Nrock*dot(Nrock,slope);
          normal=normalize(normal-mat3(viewMatrix)*slope*contact*inversesqrt(1.+dot(slope,slope)/.090));
        }
      `);
  };
  return material;
}
