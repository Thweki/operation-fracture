import {flowerGeometry,grassCoordinates} from './flower-geometry.js';

// One mipmapped botanical map encodes petal ribs, finer tributaries,
// mottled pigment and the pinnate venation of a leaf. No external assets.
function tissueMap(T){
  const size=256,bytes=new Uint8Array(size*size*4);
  const line=(phase,width)=>{
    const d=Math.abs(phase-Math.round(phase))/width;return Math.exp(-d*d);
  };
  let seed=9017;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size*2-1,v=(y+.5)/size,n=(y*size+x)*4;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const grain=seed/4294967296-.5;
    const fold=u*(4.9+v*1.5)+.25*Math.sin(7*v+4*u)+.09*Math.sin(13*v-8*u);
    const vein=line(fold,.092+.035*(1-v));
    const twig=line(fold*2.83+Math.cos(4*u+v*6)*.28+v*1.8,.12);
    const mottling=.51+.12*Math.sin(39*u+5*v)*Math.sin(32*v-5*u)+.09*Math.cos(19*u-11*v)+.21*grain;
    bytes[n]=255*vein;bytes[n+1]=255*twig;bytes[n+2]=255*mottling;
    const mid=Math.exp(-Math.abs(u)*62),secondary=line(v*7.6-1.57*Math.abs(u)+.16*Math.sin(u*5),.09);
    bytes[n+3]=255*Math.max(mid,secondary*(1-.48*Math.abs(u)));
  }
  const t=new T.DataTexture(bytes,size,size);t.name='Petal cuticle and leaf veins';
  t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}

// Use the actual irradiance after cloud, spotlight and geometry shadows. A
// thin lamina transmits light into its reverse face while stalks stay opaque.
function transmit(T,shader,model,amount){
  const block='lights_'+model+'_pars_fragment',direct=model==='physical'?'Physical':'Lambert';
  const code=T.ShaderChunk[block],start=code.indexOf('void RE_Direct_'+direct+'(');
  const brace=code.indexOf('{',start)+1;
  const light=`
    float leafBack=max(0.,-.90*dot(geometryNormal,directLight.direction)+.10);
    reflectedLight.directDiffuse+=directLight.color*material.diffuseColor*RECIPROCAL_PI*leafBack*(${amount});
  `;
  shader.fragmentShader=shader.fragmentShader.replace('#include <'+block+'>',code.slice(0,brace)+light+code.slice(brace));
}

export function buildFlowers(T,scene,heightAt){
  const time={value:0},map=tissueMap(T);
  const mat=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
  mat.name='Windflower silk and pollen';
  mat.customProgramCacheKey=()=>'windflower-tissue-3';
  mat.onBeforeCompile=shader=>{
    shader.uniforms.flowerTime=time;shader.uniforms.cuticle={value:map};
    shader.vertexShader='uniform float flowerTime;attribute vec3 floral;varying vec3 organUV;varying float flowerFocus;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      vec2 root=instanceMatrix[3].xz;
      organUV=floral;flowerFocus=1.-smoothstep(6.,26.,distance(cameraPosition,instanceMatrix[3].xyz));
      float habit=fract(sin(dot(root,vec2(13.51,23.94)))*743.9);
      transformed.xz*=.89+.23*habit;
      float wind=sin(dot(root,vec2(.47,.19))+flowerTime*1.08)+.4*sin(flowerTime*.73+root.x*.78);
      transformed.x+=(wind*.046+(habit-.5)*.16)*position.y*position.y;
      if(floral.z>.8)transformed.y+=(habit-.5)*.53*position.z+.009*floral.y*floral.y*sin(root.x+floral.x*8.+flowerTime);
    `);
    shader.fragmentShader='varying vec3 organUV;varying float flowerFocus;uniform sampler2D cuticle;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      if(flowerFocus>.002&&organUV.z>.25){
        vec4 tissue=texture2D(cuticle,organUV.xy);
        float tip=smoothstep(.7,1.,organUV.y),petal=step(.8,organUV.z);
        float pigment=(tissue.b-.5)*.44;
        diffuseColor.rgb*=1.+flowerFocus*mix(.23*tissue.a+pigment, pigment-.26*tissue.r+.065*tissue.g,petal);
        diffuseColor.rgb+=flowerFocus*petal*vec3(.105,.029,.018)*(tip*.48+tissue.g*.18);
      }
    `);
    transmit(T,shader,'lambert','mix(.17,.53,smoothstep(.3,.98,organUV.z))');
  };
  // The surrounding reed and grass beds use the terrain's existing batches.
  // Light can pass through their broad triangular blades as it can through
  // our flower leaves. Preserve the original wind and world-shadow programs.
  const greens=new Set(),grassNames=new Set(['Wind grass','Crimson reed beds','Copper poppies','Silver marsh sedges']);
  scene.traverse(m=>{
    if(!m.isInstancedMesh||!grassNames.has(m.name))return;
    greens.add(m.material);if(!m.geometry.attributes.bladeUV)grassCoordinates(T,m.geometry);
  });
  scene.traverse(m=>{
    if(!greens.has(m.material)||m.geometry.attributes.bladeUV)return;
    m.geometry.setAttribute('bladeUV',new T.BufferAttribute(new Float32Array(m.geometry.attributes.position.count*2),2));
  });
  for(const green of greens){
    const before=green.onBeforeCompile,key=green.customProgramCacheKey();
    green.customProgramCacheKey=()=>key+'-thin-grass';
    green.onBeforeCompile=function(shader,renderer){
      before.call(this,shader,renderer);transmit(T,shader,'physical','.37');
      shader.vertexShader='attribute vec2 bladeUV;varying vec3 leafCoords;\n'+shader.vertexShader.replace('#include <project_vertex>',`
        #include <project_vertex>
        leafCoords=vec3(bladeUV,1.-smoothstep(2.,15.,distance(cameraPosition,instanceMatrix[3].xyz)));
      `);
      shader.fragmentShader='varying vec3 leafCoords;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
        #include <color_fragment>
        if(leafCoords.z>.001&&leafCoords.y>.5){
          float u=leafCoords.x,t=leafCoords.y-1.,light=leafCoords.z;
          float contour=mix(1.01,.095+2.89*t*(1.-t),light);
          if(abs(u)>contour)discard;
          float aa=max(.014,fwidth(u));
          float rib=1.-smoothstep(.018,.094+aa,abs(u));
          float fine=cos(u*35.+.21*sin(t*8.))*(1.-smoothstep(.035,.19,aa));
          diffuseColor.rgb*=1.+light*(.28*rib+.057*fine-.042);
        }
      `);
    };
  }
  let seed=19183;
  function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  const patches=[[-4,45,10,7,79],[15,43,6,5,66],[24,51,9,6,117],[7,55,7,4,105],[2,62,10,5,68],[33,38,7,6,58],[-44,1,8,5,47],[19,-47,7,5,43],[-24,-28,6,4,35]];
  const stamp=new T.Object3D(),tint=new T.Color(),flowers=[];
  for(const [x,z,rx,rz,count] of patches){
    for(let k=0;k<count;k++){
      const a=rand()*Math.PI*2,r=Math.sqrt(rand()),px=x+rx*r*Math.cos(a),pz=z+rz*r*Math.sin(a);
      const y=heightAt(px,pz),path=9+(pz-47)*.37+Math.sin((pz-46)*.115)*2.1;
      if(y<1||pz>30&&Math.abs(px-path)<1.9||Math.abs(heightAt(px+.35,pz)-y)>.5)continue;
      const s=.46+rand()*.8,rotation=rand()*6.28;
      const patch=.48+.26*Math.sin(px*.63+pz*.16)+.20*Math.sin(pz*.83-px*.53);
      // Vary the height and colour of an entire colony. Disturbances along
      // its edge leave small gaps and shorter, younger plants in the grass.
      if(r>.79&&patch<.38&&k%3===0)continue;
      const size=s*(.82+.25*patch),variant=(k+Math.floor(patch*2))%3;
      stamp.position.set(px,y-.055,pz);stamp.scale.setScalar(size);
      stamp.rotation.set(.11*Math.sin(px*3.5),rotation,.10*Math.cos(pz*2.9),'YXZ');stamp.updateMatrix();
      const v=.92+.11*Math.sin(px+pz*1.15);
      tint.setRGB(v,v*(.78+.33*patch)*(variant===1?1.11:1),v*(.91+.19*(1-patch)));
      flowers.push({x:px,y,z:pz,variant,transform:Float32Array.from(stamp.matrix.elements),tint:Float32Array.from(tint.toArray()),
        bound:new T.Sphere(new T.Vector3(px,y+size*.61,pz),size*1.03)});
    }
  }
  const group=new T.LOD(),previous=new T.Matrix4(),clip=new T.Matrix4(),frustum=new T.Frustum();
  const levels=[[0,3],[1,3],[2,3],[0,2],[2,2],[0,1],[0,0]].map(([variant,lod])=>{
    const mesh=new T.InstancedMesh(flowerGeometry(T,variant,lod),mat,flowers.length);
    mesh.name='Scarlet windflowers';mesh.receiveShadow=true;mesh.frustumCulled=false;
    mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(flowers.length*3),3).setUsage(T.DynamicDrawUsage);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(mesh);return mesh;
  });
  group.update=cam=>{
    clip.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);if(previous.equals(clip))return;
    previous.copy(clip);frustum.setFromProjectionMatrix(clip,cam.coordinateSystem,cam.reversedDepth);
    const eye=cam.matrixWorld.elements,magnification=cam.zoom*cam.zoom;
    for(const mesh of levels)mesh.count=0;
    for(const plant of flowers){
      if(!frustum.intersectsSphere(plant.bound))continue;
      const d=((plant.x-eye[12])**2+(plant.y-eye[13])**2+(plant.z-eye[14])**2)/magnification;
      if(d>118**2)continue;
      const mesh=levels[d<5.1**2?plant.variant:d<17**2?3+(plant.variant===2?1:0):d<43**2?5:6];
      mesh.instanceMatrix.array.set(plant.transform,mesh.count*16);
      mesh.instanceColor.array.set(plant.tint,mesh.count*3);mesh.count++;
    }
    for(const mesh of levels){
      mesh.visible=mesh.count>0;if(!mesh.visible)continue;
      for(const [attr,stride] of [[mesh.instanceMatrix,16],[mesh.instanceColor,3]]){
        attr.clearUpdateRanges();attr.addUpdateRange(0,mesh.count*stride);attr.needsUpdate=true;
      }
    }
  };scene.add(group);
  return {update(t){time.value=t}};
}
