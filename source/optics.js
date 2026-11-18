import {SUN_DIRECTION} from './sky.js';
import {cloudProjection} from './cloud-light.js';

const fullscreenVertex=`varying vec2 uvScreen;
  void main(){uvScreen=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}`;

const downsample=`
  varying vec2 uvScreen;
  uniform sampler2D source;
  uniform vec2 pixel;
  uniform float isolate;
  vec3 readLight(vec2 uv){
    vec3 light=texture2D(source,uv).rgb;
    float level=dot(light,vec3(.24,.58,.18))*.82+.18*max(max(light.r,light.g),light.b);
    float shoulder=clamp(level-.86,0.,.58);
    float excess=max(level-1.15,shoulder*shoulder/.99);
    return light*mix(1.,max(0.,excess)/max(level,.0001),isolate);
  }
  void main(){
    vec2 d=pixel*.86;
    vec3 c=readLight(uvScreen)*.20;
    c+=.20*(readLight(uvScreen+d)+readLight(uvScreen-d));
    c+=.20*(readLight(uvScreen+vec2(d.x,-d.y))+readLight(uvScreen+vec2(-d.x,d.y)));
    gl_FragColor=vec4(c,1.);
  }`;

const upsample=`
  varying vec2 uvScreen;
  uniform sampler2D localMip,broadMip;
  uniform vec2 pixel;
  void main(){
    vec2 d=pixel*1.24;
    vec3 blurred=.24*texture2D(broadMip,uvScreen).rgb;
    blurred+=.13*(texture2D(broadMip,uvScreen+vec2(d.x,0)).rgb+texture2D(broadMip,uvScreen-vec2(d.x,0)).rgb+
                 texture2D(broadMip,uvScreen+vec2(0,d.y)).rgb+texture2D(broadMip,uvScreen-vec2(0,d.y)).rgb);
    blurred+=.06*(texture2D(broadMip,uvScreen+d).rgb+texture2D(broadMip,uvScreen-d).rgb+
                 texture2D(broadMip,uvScreen+vec2(-d.x,d.y)).rgb+texture2D(broadMip,uvScreen+vec2(d.x,-d.y)).rgb);
    gl_FragColor=vec4(texture2D(localMip,uvScreen).rgb*.45+.77*blurred,1.);
  }`;

// Integrate single scattering through low-lying vapor up to the first opaque
// surface. PCF visibility comes from the same directional-light shadow map as
// the masonry and the trees, so the illuminated air occupies world space.
const scatterFragment=`
  varying vec2 uvScreen;
  uniform sampler2D surfaceDepth;
  #ifdef COMPARE_SHADOW
    uniform sampler2DShadow sunDepth;
  #elif defined(READ_SHADOW)
    uniform sampler2D sunDepth;
  #endif
  uniform mat4 shadowView,inverseProjection,eyeWorld;
  uniform vec2 clipping,sunUV,sunRadius;
  uniform vec3 sunward,climate;
  uniform float seconds,sunInFrame;
  uniform int stepCount;
  float visibility(vec3 world){
    float openLight=1.;
    #if defined(COMPARE_SHADOW) || defined(READ_SHADOW)
      vec4 p=shadowView*vec4(world,1.);vec3 shadow=p.xyz/p.w;
      if(min(min(shadow.x,shadow.y),shadow.z)>0. && max(max(shadow.x,shadow.y),shadow.z)<1.){
        #ifdef COMPARE_SHADOW
          openLight=texture(sunDepth,vec3(shadow.xy,shadow.z-.00022));
        #else
          openLight=step(shadow.z-.00022,texture2D(sunDepth,shadow.xy).r);
        #endif
      }
    #endif
    return openLight;
  }
  float openSky(vec2 p){return step(.999999,texture2D(surfaceDepth,p).r);}
  void main(){
    float depth=texture2D(surfaceDepth,uvScreen).r;
    float linearDepth=clipping.x*clipping.y/(clipping.y-depth*(clipping.y-clipping.x));
    vec4 back=inverseProjection*vec4(uvScreen*2.-1.,1.,1.);
    vec3 cameraRay=normalize(back.xyz/back.w),ray=mat3(eyeWorld)*cameraRay;
    float distanceToSurface=linearDepth/max(.05,-cameraRay.z);
    float marchDistance=min(168.,distanceToSurface);
    float span=marchDistance/float(stepCount);
    vec3 origin=eyeWorld[3].xyz;
    float mu=dot(ray,sunward);
    float forwardLobe=.17+.20/pow(1.3025-1.10*mu,1.50);
    float jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
    float light=0.;float transmittance=1.;
    for(int i=0;i<16;i++){
      if(i>=stepCount)break;
      vec3 point=origin+ray*(float(i)+.20+.60*jitter)*span;
      float height=exp(-abs(point.y-3.)*.062);
      float gust=.70+.30*sin(point.x*.073+point.z*.043+seconds*.055)*sin(point.z*.075-point.y*.095);
      float basin=exp(-dot(point.xz*vec2(.025,.015),point.xz*vec2(.025,.015)));
      float optical=height*gust*(.00035+.00145*basin+.00024*pow(max(mu,0.),7.)+.00037*climate.x)*span;
      float extinction=exp(-optical);
      light+=transmittance*(1.-extinction)*visibility(point)*sunlightAt(point);
      transmittance*=extinction;
    }
    vec3 airColor=mix(vec3(1.72,1.04,.56),vec3(.86,1.40,1.44),climate.x*.73);
    vec3 inscattering=mix(airColor,vec3(1.95,.89,.37),climate.y*.8)*light*forwardLobe;
    // A finite solar disc gives a gradual penumbra when branches or a relic
    // cross the sun. Glare is generated only when the photosphere is visible.
    if(sunInFrame>0.){
      vec2 r=sunRadius*.64;
      float visible=.20*(openSky(sunUV)+openSky(sunUV+vec2(r.x,0.))+openSky(sunUV-vec2(r.x,0.))+
                            openSky(sunUV+vec2(0.,r.y))+openSky(sunUV-vec2(0.,r.y)));
      vec2 q=(uvScreen-sunUV)/max(sunRadius,vec2(.00001));
      float angle=atan(q.y,q.x), radius=length(q);
      float diffraction=pow(abs(cos(3.*angle+.25)),38.)*exp(-radius*.24)*smoothstep(.62,1.12,radius);
      float aureole=.13*exp(-radius*.26)+.16*diffraction;
      inscattering+=vec3(1.,.76,.42)*aureole*visible*sunInFrame;
    }
    gl_FragColor=vec4(inscattering,min(linearDepth/168.,1.));
  }`;

const finishFragment=`
  varying vec2 uvScreen;
  uniform sampler2D hdrImage,halation,airlight,surfaceDepth;
  uniform vec2 imagePixel,airSize,clipping;
  uniform float bloomGain,edgeAA;
  uniform vec3 climate;
  #ifdef PRESSURE_FRONT
    uniform vec4 fronts[3]; // origin in UV, radius and strength in screen heights
    uniform vec3 medium[3]; // width, view depth, physical shock radius
    uniform float aspectRatio;
    void refraction(vec2 uv,float surfaceZ,out vec2 refractionUV,out vec2 dispersion){
      refractionUV=vec2(0.);dispersion=vec2(0.);
      for(int i=0;i<3;i++){
        vec4 front=fronts[i];if(front.w<=0.)continue;
        vec2 q=(uv-front.xy)*vec2(aspectRatio,1.);
        float r=length(q),s=(r-front.z)/medium[i].x;
        if(abs(s)>2.4 || r<.0001)continue;
        float nearSide=medium[i].y-medium[i].z;
        float visibility=smoothstep(nearSide-1.25,nearSide+.4,surfaceZ);
        float profile=exp(-1.65*s*s),shape=front.w*profile*visibility;
        vec2 normal=q/max(r,.0001)/vec2(aspectRatio,1.);
        // The gradient of the pressure ridge bends the leading and trailing
        // edges opposite ways. Dispersion vanishes with the same envelope.
        refractionUV+=normal*(-s)*shape;
        dispersion+=normal*shape*.087;
      }
    }
  #endif
  float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
  vec3 resolveEdge(vec3 center,vec2 uv){
    if(edgeAA<.5)return center;
    vec3 n=texture2D(hdrImage,uv+vec2(0.,imagePixel.y)).rgb,s=texture2D(hdrImage,uv-vec2(0.,imagePixel.y)).rgb;
    vec3 e=texture2D(hdrImage,uv+vec2(imagePixel.x,0.)).rgb,w=texture2D(hdrImage,uv-vec2(imagePixel.x,0.)).rgb;
    float vertical=abs(luma(n)-luma(s)),horizontal=abs(luma(e)-luma(w));
    float high=max(max(luma(n),luma(s)),max(luma(e),luma(w)));
    float low=min(min(luma(n),luma(s)),min(luma(e),luma(w)));
    float blend=smoothstep(.08,.34,(high-low)/max(.14,high))*.36;
    return mix(center,vertical>horizontal?(n+s)*.5:(e+w)*.5,blend);
  }
  void gatherAir(vec2 uv,float spatial,float depth,inout vec3 sum,inout float weights){
    vec4 s=texture2D(airlight,uv);
    float w=spatial/(.02+min(1.,86.*abs(s.a-depth)));
    sum+=s.rgb*w;weights+=w;
  }
  void main(){
    float z=texture2D(surfaceDepth,uvScreen).r;
    float surfaceZ=clipping.x*clipping.y/(clipping.y-z*(clipping.y-clipping.x));
    float d=min(1.,surfaceZ/168.);vec2 uv=uvScreen;
    #ifdef PRESSURE_FRONT
      vec2 shift,dispersion;refraction(uv,surfaceZ,shift,dispersion);
      uv=clamp(uv+shift,imagePixel*.5,1.-imagePixel*.5);
    #endif
    vec2 p=uv*airSize-.5,f=fract(p),a=(floor(p)+.5)/airSize;
    vec3 incoming=vec3(0.);float weight=0.;
    gatherAir(a,(1.-f.x)*(1.-f.y),d,incoming,weight);
    gatherAir(a+vec2(1.,0.)/airSize,f.x*(1.-f.y),d,incoming,weight);
    gatherAir(a+vec2(0.,1.)/airSize,(1.-f.x)*f.y,d,incoming,weight);
    gatherAir(a+1./airSize,f.x*f.y,d,incoming,weight);
    vec3 base=resolveEdge(texture2D(hdrImage,uv).rgb,uv);
    #ifdef PRESSURE_FRONT
      if(dot(dispersion,dispersion)>.0000000001){
        base.r=texture2D(hdrImage,uv+dispersion).r;base.b=texture2D(hdrImage,uv-dispersion).b;
      }
    #endif
    vec3 radiance=base+texture2D(halation,uv).rgb*bloomGain+incoming/max(.0001,weight);
    // Tone the linear scene first. The toe stays cool and open, while the
    // shoulder preserves the different colours of the sun and machined lights.
    float luminance=luma(radiance);
    float shadow=1.-smoothstep(.035,.45,luminance);
    vec3 shadowTint=mix(vec3(.89,.97,1.075),vec3(.78,1.02,1.12),climate.x);
    shadowTint=mix(shadowTint,vec3(.99,.89,1.025),climate.y*.68);
    radiance*=mix(vec3(1.),shadowTint,shadow);
    radiance=mix(vec3(luma(radiance)),radiance,1.065);
    gl_FragColor=vec4(max(radiance,vec3(0.)),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function buildOptics(T,renderer,scene,camera,clouds,climate=new T.Vector3()){
  if(!renderer.extensions.has('EXT_color_buffer_float')){
    // Preserve native canvas MSAA and direct ACES output on constrained GPUs.
    const size=new T.Vector2(),gl=renderer.getContext(),samples=gl.getParameter(gl.SAMPLES);
    return {render(){renderer.render(scene,camera)},prepare(){return renderer.compileAsync(scene,camera)},resize(){},shock(){return false},qualityInfo(){
      renderer.getDrawingBufferSize(size);
      return {tier:'native',width:size.x,height:size.y,samples,fpsEstimate:null,gpuMs:null};
    }};
  }
  const gl=renderer.getContext();
  const samples=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)||[]);
  const depthSamples=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,gl.SAMPLES)||[]);
  const supported=samples.filter(n=>n<=4&&depthSamples.includes(n));
  const maxMSAA=Math.max(0,...supported);
  function target(name,depth=false){
    const rt=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,colorSpace:T.LinearSRGBColorSpace,
      minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:depth,stencilBuffer:false,generateMipmaps:false});
    rt.texture.name=name;
    return rt;
  }
  const hdr=target('Linear scene radiance',true), haze=target('World-space solar scattering');
  hdr.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
  hdr.depthTexture.name='First visible surface';
  haze.texture.magFilter=haze.texture.minFilter=T.NearestFilter;
  const down=Array.from({length:5},(_,i)=>target('Bloom mip '+i));
  const up=Array.from({length:4},(_,i)=>target('Bloom reconstruction '+i));
  const quad=new T.BufferGeometry();
  quad.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  const screen=new T.Scene(), lens=new T.Camera();
  const passMesh=new T.Mesh(quad);passMesh.frustumCulled=false;screen.add(passMesh);
  function material(fragmentShader,values,output=false){
    const uniforms=Object.fromEntries(Object.entries(values).map(([name,value])=>[name,{value}]));
    return new T.ShaderMaterial({uniforms,vertexShader:fullscreenVertex,fragmentShader,
      depthWrite:false,depthTest:false,blending:T.NoBlending,toneMapped:output});
  }
  const sunward=new T.Vector3(...SUN_DIRECTION).normalize(), solarProjection=new T.Vector3(), eyeDirection=new T.Vector3();
  const reduce=material(downsample,{source:null,pixel:new T.Vector2(),isolate:0});
  const enlarge=material(upsample,{localMip:null,broadMip:null,pixel:new T.Vector2()});
  const scatter=material((clouds?cloudProjection:'float sunlightAt(vec3 p){return 1.;}')+'\n'+scatterFragment,{surfaceDepth:hdr.depthTexture,sunDepth:null,shadowView:new T.Matrix4(),climate,
    inverseProjection:camera.projectionMatrixInverse,eyeWorld:camera.matrixWorld,clipping:new T.Vector2(),sunward,
    sunUV:new T.Vector2(),sunRadius:new T.Vector2(),sunInFrame:0,seconds:0,stepCount:14});
  if(clouds)Object.assign(scatter.uniforms,clouds.uniforms);
  const finish=material(finishFragment,{hdrImage:hdr.texture,halation:up[0].texture,airlight:haze.texture,climate,
    surfaceDepth:hdr.depthTexture,imagePixel:new T.Vector2(),airSize:new T.Vector2(),clipping:new T.Vector2(),bloomGain:.66,edgeAA:0},true);
  const waves=[],fronts=Array.from({length:3},()=>new T.Vector4()),media=Array.from({length:3},()=>new T.Vector3());
  const displaced=new T.ShaderMaterial({vertexShader:fullscreenVertex,fragmentShader:finishFragment,
    defines:{PRESSURE_FRONT:1},depthTest:false,depthWrite:false,blending:T.NoBlending,toneMapped:true,
    uniforms:{...finish.uniforms,fronts:{value:fronts},medium:{value:media},aspectRatio:{value:1}}});
  passMesh.material=displaced;renderer.compile(screen,lens);passMesh.material=finish;
  const motionPreference=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const projected=new T.Vector3();let viewDepth=0,quiet=false;
  function projectOrigin(point){
    camera.updateWorldMatrix(true,false);
    projected.copy(point).applyMatrix4(camera.matrixWorldInverse);viewDepth=-projected.z;
    if(viewDepth<=camera.near||viewDepth>=camera.far)return false;
    projected.applyMatrix4(camera.projectionMatrix);
    return Math.abs(projected.x)<=1&&Math.abs(projected.y)<=1;
  }
  function shock(kind,point){
    if(quiet||motionPreference?.matches||(kind!=='pulse'&&kind!=='kill'))return false;
    if(kind==='kill'&&(!point||!Number.isFinite(point.x+point.y+point.z)||!projectOrigin(point)))return false;
    if(waves.length===3)waves.shift();
    waves.push({kind,origin:kind==='kill'?new T.Vector3().copy(point):null,start:performance.now()});return true;
  }
  function activeFronts(){
    if(!waves.length)return false;
    const now=performance.now(),aspect=camera.aspect;
    let count=0;
    for(let i=waves.length-1;i>=0;i--){
      const wave=waves[i],pulse=wave.kind==='pulse',age=(now-wave.start)/(pulse?565:470);
      if(age>=1||quiet){waves.splice(i,1);continue;}
      if(!pulse&&!projectOrigin(wave.origin))continue;
      const t=Math.max(0,age),eased=1-(1-t)**1.32;
      const amplitude=T.MathUtils.smoothstep(t,0,.065)*(1-T.MathUtils.smoothstep(t,.58,1));
      const meters=9.2*eased;
      const radius=pulse?.019+eased*Math.hypot(aspect*.5,.52):meters/(2*viewDepth*Math.tan(camera.fov*Math.PI/360));
      const x=pulse?.5:projected.x*.5+.5,y=pulse?.5:projected.y*.5+.5;
      const width=pulse?.016+.007*t:T.MathUtils.clamp(radius*.092,.0035,.020);
      fronts[count].set(x,y,radius,(pulse?.012:.017)*amplitude);
      media[count].set(width,pulse?0:viewDepth,pulse?2:meters);count++;
    }
    for(let i=count;i<3;i++)fronts[i].w=0;
    displaced.uniforms.aspectRatio.value=aspect;return count>0;
  }
  let sun=null;
  scene.traverse(object=>{if(!sun&&object.isDirectionalLight&&object.castShadow)sun=object});
  const modestDevice=(navigator.hardwareConcurrency>0&&navigator.hardwareConcurrency<=4)||navigator.deviceMemory<=4;
  let shadowMode='',quality=modestDevice?1:2,levels=5,width=1,height=1,last=0,average=0;
  let slowTime=0,fastTime=0,lastChange=0;
  // Results are polled several frames after submission. Never request a query
  // result until AVAILABLE is true, since that would serialize CPU and GPU.
  const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const queries=timer?Array.from({length:3},()=>({query:gl.createQuery(),pending:false})).filter(s=>s.query):[];
  let measured=null,frames=0,gpuAverage=0,lastGPU=0;
  function sampleGPU(now){
    if(!queries.length||++frames%7!==0)return;
    if(gl.getParameter(timer.GPU_DISJOINT_EXT)){
      for(const slot of queries)slot.pending=false;
      gpuAverage=0;lastGPU=0;return;
    }
    for(const slot of queries){
      if(!slot.pending||!gl.getQueryParameter(slot.query,gl.QUERY_RESULT_AVAILABLE))continue;
      const ms=gl.getQueryParameter(slot.query,gl.QUERY_RESULT)*.000001;
      slot.pending=false;
      if(ms>.001&&ms<2000){gpuAverage=gpuAverage?gpuAverage+.19*(ms-gpuAverage):ms;lastGPU=now;}
    }
    const available=queries.find(s=>!s.pending);
    if(available&&!gl.getQuery(timer.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)){
      gl.beginQuery(timer.TIME_ELAPSED_EXT,available.query);measured=available;
    }
  }
  const currentSize=renderer.getSize(new T.Vector2());

  function resize(w,h){
    width=Math.max(1,w);height=Math.max(1,h);
    const pixelRatio=renderer.getPixelRatio(), scale=[.76,.90,1][quality];
    const cap=Math.min(1,Math.sqrt(2800000/(width*height*pixelRatio*pixelRatio)));
    const x=Math.max(1,Math.round(width*pixelRatio*scale*cap)),y=Math.max(1,Math.round(height*pixelRatio*scale*cap));
    const msaa=quality===2?maxMSAA:quality===1?Math.max(0,...supported.filter(n=>n<=2)):0;
    if(hdr.samples!==msaa){hdr.dispose();hdr.samples=msaa;}
    hdr.setSize(x,y);levels=quality+3;
    let mx=Math.max(1,Math.ceil(x*(quality===0?.34:.5))),my=Math.max(1,Math.ceil(y*(quality===0?.34:.5)));
    for(let i=0;i<5;i++){
      down[i].setSize(i<levels?mx:1,i<levels?my:1);
      if(i<4)up[i].setSize(i<levels-1?mx:1,i<levels-1?my:1);
      mx=Math.max(1,Math.ceil(mx/2));my=Math.max(1,Math.ceil(my/2));
    }
    const ratio=[.18,.245,.32][quality];
    haze.setSize(Math.max(1,Math.round(x*ratio)),Math.max(1,Math.round(y*ratio)));
    scatter.uniforms.stepCount.value=[6,9,14][quality];
    finish.uniforms.airSize.value.set(haze.width,haze.height);
    finish.uniforms.imagePixel.value.set(1/x,1/y);
    finish.uniforms.edgeAA.value=msaa?0:1;
  }
  function draw(pass,to){passMesh.material=pass;renderer.setRenderTarget(to);renderer.render(screen,lens);}
  function monitor(){
    const now=performance.now(),dt=last?now-last:0;last=now;
    sampleGPU(now);
    if(dt<=0||dt>1800){slowTime=0;fastTime=0;return;}
    average=average?average+.065*(Math.min(180,dt)-average):dt;
    const hasGPU=lastGPU>0&&now-lastGPU<2500;
    const slow=hasGPU?gpuAverage>22:average>38;
    const headroom=hasGPU?gpuAverage<(quality===0?10.5:11.8)&&average<20:average<18.1;
    const elapsed=Math.min(90,dt);
    slowTime=slow?slowTime+elapsed:Math.max(0,slowTime-elapsed*2);
    fastTime=headroom?fastTime+elapsed:0;
    const lower=quality>0&&slowTime>1350&&now-lastChange>2200;
    const raise=quality<2&&fastTime>11000&&now-lastChange>14000;
    if(lower||raise){
      quality+=lower?-1:1;lastChange=now;slowTime=0;fastTime=0;
      gpuAverage=0;lastGPU=0;resize(width,height);
    }
  }
  function qualityInfo(){return {tier:['low','balanced','high'][quality],width:hdr.width,height:hdr.height,
    samples:hdr.samples,fpsEstimate:average?Math.round(1000/average):null,gpuMs:lastGPU?Math.round(gpuAverage*100)/100:null};}
  resize(currentSize.x,currentSize.y);
  function renderFrame(time,energy,reducedMotion){
    quiet=reducedMotion;
    renderer.setRenderTarget(hdr);renderer.render(scene,camera);
    const depth=sun?.shadow.map?.depthTexture;
    const next=depth?(depth.compareFunction!==null?'COMPARE_SHADOW':'READ_SHADOW'):'';
    if(next!==shadowMode){shadowMode=next;scatter.defines=next?{[next]:1}:{};scatter.needsUpdate=true;}
    if(depth){scatter.uniforms.sunDepth.value=depth;scatter.uniforms.shadowView.value.copy(sun.shadow.matrix);}
    camera.getWorldDirection(eyeDirection);
    solarProjection.copy(camera.position).addScaledVector(sunward,camera.far*.8).project(camera);
    const uv=scatter.uniforms.sunUV.value.set(.5+.5*solarProjection.x,.5+.5*solarProjection.y);
    const edge=Math.min(uv.x,uv.y,1-uv.x,1-uv.y);
    scatter.uniforms.sunInFrame.value=eyeDirection.dot(sunward)>.06?T.MathUtils.smoothstep(edge,-.012,.024):0;
    const screenRadius=.0065/Math.tan(T.MathUtils.degToRad(camera.fov*.5))/Math.max(.23,eyeDirection.dot(sunward));
    scatter.uniforms.sunRadius.value.set(screenRadius/camera.aspect,screenRadius);
    scatter.uniforms.clipping.value.set(camera.near,camera.far);finish.uniforms.clipping.value.set(camera.near,camera.far);
    scatter.uniforms.seconds.value=reducedMotion?0:time;
    draw(scatter,haze);
    let source=hdr;
    for(let i=0;i<levels;i++){
      reduce.uniforms.source.value=source.texture;reduce.uniforms.pixel.value.set(1/source.width,1/source.height);
      reduce.uniforms.isolate.value=i===0?1:0;draw(reduce,down[i]);source=down[i];
    }
    for(let i=levels-2;i>=0;i--){
      enlarge.uniforms.localMip.value=down[i].texture;enlarge.uniforms.broadMip.value=source.texture;
      enlarge.uniforms.pixel.value.set(1/source.width,1/source.height);draw(enlarge,up[i]);source=up[i];
    }
    finish.uniforms.bloomGain.value=.65+.10*T.MathUtils.clamp(energy,0,1);
    draw(activeFronts()?displaced:finish,null);
  }
  function prepare(){
    const previous=renderer.getRenderTarget();renderer.setRenderTarget(hdr);
    try{return renderer.compileAsync(scene,camera)}finally{renderer.setRenderTarget(previous)}
  }
  return {resize,shock,qualityInfo,prepare,render(time,energy=0,reducedMotion=false){
    monitor();
    try{renderFrame(time,energy,reducedMotion);}finally{
      if(measured){gl.endQuery(timer.TIME_ELAPSED_EXT);measured.pending=true;measured=null;}
    }
  }};
}
