// The initial battlefield uses instanced, per-beam colors and a terrain
// attribute that is populated only at deployment. Draw those exact variants
// once after landing so the first enemy salvo doesn't wait on the driver.
export async function warmEncounterEffects(T,renderer,scene){
  const encounter=scene.getObjectByName('Meridian defense encounter');
  if(!encounter)return;
  const pass=new T.Scene();
  pass.fog=scene.fog;
  pass.environment=scene.environment;
  const lens=new T.PerspectiveCamera(55,1,.1,12);
  lens.position.z=4;
  scene.traverseVisible(object=>{
    if(object.isLight)pass.add(object.clone(false));
  });

  let beam,conduitGeometry,wave;
  encounter.traverse(object=>{
    if(!beam&&object.isInstancedMesh&&object.material?.isMeshBasicMaterial){
      beam=new T.InstancedMesh(object.geometry,object.material,1);
      beam.setMatrixAt(0,new T.Matrix4());
      beam.setColorAt(0,new T.Color(1,1,1));
      beam.frustumCulled=false;
      pass.add(beam);
    }else if(object.name==='North court relay conduits'){
      conduitGeometry=new T.BufferGeometry();
      conduitGeometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,1,-1,0,0,1,0],3));
      conduitGeometry.setAttribute('conduit',new T.BufferAttribute(new Float32Array(12),4));
      pass.add(new T.Mesh(conduitGeometry,object.material));
    }else if(!wave&&object.geometry?.type==='TorusGeometry'&&object.material?.isMeshBasicMaterial){
      wave=new T.Mesh(object.geometry,object.material);
      pass.add(wave);
    }
  });

  const hdr=renderer.extensions.has('EXT_color_buffer_float');
  const target=hdr?new T.WebGLRenderTarget(16,16,{type:T.HalfFloatType,colorSpace:T.LinearSRGBColorSpace}):null;
  function withTarget(draw){
    const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
    renderer.setRenderTarget(target);
    try{return draw()}finally{renderer.setRenderTarget(previous,face,mip)}
  }
  try{
    await withTarget(()=>renderer.compileAsync(pass,lens));
    if(!target||renderer.getContext().isContextLost())return;
    const shadows=renderer.shadowMap,automatic=shadows.autoUpdate,dirty=shadows.needsUpdate;
    shadows.autoUpdate=shadows.needsUpdate=false;
    try{withTarget(()=>renderer.render(pass,lens))}finally{shadows.autoUpdate=automatic;shadows.needsUpdate=dirty;}
  }finally{
    target?.dispose();beam?.dispose();conduitGeometry?.dispose();
  }
}
