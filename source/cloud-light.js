// Back-project visible surfaces along the solar direction onto one moving cloud
// layer. The same transmittance field lights stone, foliage, and airborne mist.
export const cloudProjection = `
  uniform sampler2D cloudTransmission;
  uniform vec2 cloudOffset;
  float sunlightAt(vec3 w){
    vec2 uv=(w.xz+w.y*vec2(3.385,3.744))*.0031+cloudOffset;
    return texture2D(cloudTransmission,uv).r;
  }`;

export function createCloudLight(T){
  const size=192,data=new Uint8Array(size*size);
  let seed=3987;
  const grids=[4,8,16,32].map(n=>{
    const values=Float32Array.from({length:n*n},()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296));
    return (x,z)=>{
      let u=x*n/size,v=z*n/size;
      const i=Math.floor(u),j=Math.floor(v),sample=(a,b)=>values[(a%n)+(b%n)*n];
      u-=i;v-=j;u=u*u*(3-2*u);v=v*v*(3-2*v);
      return (sample(i,j)*(1-u)+sample(i+1,j)*u)*(1-v)+(sample(i,j+1)*(1-u)+sample(i+1,j+1)*u)*v;
    };
  });
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const cloud=grids[0](i,j)*.54+grids[1](i,j)*.29+grids[2](i,j)*.12+grids[3](i,j)*.05;
    const open=T.MathUtils.smoothstep(cloud,.32,.63);
    data[j*size+i]=Math.round(255*(.19+.81*open));
  }
  const map=new T.DataTexture(data,size,size,T.RedFormat);
  map.wrapS=map.wrapT=T.RepeatWrapping;map.magFilter=map.minFilter=T.LinearFilter;map.needsUpdate=true;
  const uniforms={cloudTransmission:{value:map},cloudOffset:{value:new T.Vector2()}};
  const direction='getDirectionalLightInfo( directionalLight, directLight );';
  const lighting=T.ShaderChunk.lights_fragment_begin.replace(direction,direction+'\n directLight.color *= gardenSun;');
  function apply(scene){
    const seen=new Set();
    scene.traverse(object=>{
      const materials=Array.isArray(object.material)?object.material:[object.material];
      for(const mat of materials){
        if(!mat||seen.has(mat)||!(mat.isMeshStandardMaterial||mat.isMeshLambertMaterial||mat.isMeshPhongMaterial))continue;
        seen.add(mat);
        const previous=mat.onBeforeCompile,cache=mat.customProgramCacheKey();
        mat.customProgramCacheKey=()=>cache+'-garden-cloud-light';
        mat.onBeforeCompile=function(shader,renderer){
          previous.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);
          shader.vertexShader=cloudProjection+'\nvarying float gardenSun;\n'+shader.vertexShader.replace('#include <project_vertex>',
            '#include <project_vertex>\n gardenSun=sunlightAt(cameraPosition+transpose(mat3(viewMatrix))*mvPosition.xyz);');
          shader.fragmentShader='varying float gardenSun;\n'+shader.fragmentShader.replace('#include <lights_fragment_begin>',lighting);
        };
      }
    });
  }
  function update(seconds){uniforms.cloudOffset.value.set(.18+seconds*.00023,.16-seconds*.00012)}
  return {uniforms,apply,update};
}
