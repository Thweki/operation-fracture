import {SUN_DIRECTION} from './sky.js';

// Cold air collects at the foot of the shelves. The higher, thinner banks
// sit beside the falls and in the two saddles flanking the Meridian Gate.
// Each record contains a world-space center, three half-axes, optical depth
// and the fraction of incident warm light.
const banks = [
  [-39,8.2,-70, 23,4.9,13, .27,.78], [36,8.8,-69, 24,5.1,15,.24,.39],
  [-64,11.0,-46, 24,5.0,15,.25,.82], [58,11.0,-39, 28,5.5,18,.22,.46],
  [-34,4.8,-38, 21,3.8,13,.39,.79], [36,5.0,-42, 22,4.5,14,.38,.43],
  [-11,-2.1,-29, 24,5.4,16,.47,.77], [11,-.2,-21, 21,4.6,14,.34,.57],
  [-6,3.1,-26, 16,2.4,10,.30,.89],
  [-24,8.8,-18, 13,3.2,8,.36,.83], [37,9.5,-12, 20,3.4,11,.36,.61],
  [-10,-14.1,-12, 28,8.7,19,1.12,.48], [9,-11.0,-5, 24,8.0,19,.93,.49],
  [-7,-5.4,-9, 19,5.3,13,.66,.66], [16,-2.8,-9, 17,4.5,12,.48,.53],
  [-12,-3.2,3, 17,4.6,12,.46,.82], [18,2.8,-3, 16,3.3,11,.24,.60],
  [-4,-14.4,14, 27,8.3,17,1.05,.48], [13,-9.8,20, 21,6.8,16,.87,.50],
  [-9,-4.8,18, 19,5.3,13,.62,.71], [-11,.55,14, 14,3.3,10,.39,.90],
  [-13,4.3,9, 11,2.6,8,.35,.87], [4,3.5,4, 15,2.7,9,.35,.81],
  [1,-2,25, 17,4.5,11,.46,.64], [-12,-8.9,33, 19,6.4,13,.78,.71],
  [-20,-11.8,42, 20,7.2,15,.79,.70], [-28,-5.0,40, 16,4.9,10,.47,.77],
  [-44,4,29, 21,4.2,10,.25,.79], [40,5,17, 16,3.2,12,.21,.48],
];

function vaporTexture(T) {
  const size=128;
  const grid=new Float32Array(size*size);
  let seed=0x87935b;
  for(let i=0;i<grid.length;i++) {
    seed=(Math.imul(1664525,seed)+1013904223)>>>0;
    grid[i]=seed/4294967296;
  }
  const smooth=t=>t*t*(3-2*t);
  function noise(x,y,period,offset) {
    x*=period; y*=period;
    const i=Math.floor(x), j=Math.floor(y), fx=smooth(x-i), fy=smooth(y-j);
    const lookup=(dx,dy)=>grid[((i+dx)%period+offset*3)%size+size*(((j+dy)%period+offset)%size)];
    const a=lookup(0,0),b=lookup(1,0),c=lookup(0,1),d=lookup(1,1);
    return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
  }
  const bytes=new Uint8Array(size*size*4);
  for(let j=0;j<size;j++) for(let i=0;i<size;i++) {
    const x=i/size,y=j/size;
    const f=(sx,sy,k)=>0.50*noise(sx,sy,4,k)+0.27*noise(sx,sy,8,k+7)
      +0.14*noise(sx,sy,16,k+11)+0.065*noise(sx,sy,32,k+13)+0.025*noise(sx,sy,64,k+19);
    const n=(i+j*size)*4;
    bytes[n]=255*f(x,y,3);
    bytes[n+1]=255*f(x,y,23);
    bytes[n+2]=255*f(y,x,13);
    bytes[n+3]=255;
  }
  const texture=new T.DataTexture(bytes,size,size,T.RGBAFormat);
  texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.minFilter=T.LinearMipmapLinearFilter;
  texture.magFilter=T.LinearFilter;
  texture.generateMipmaps=true;
  texture.needsUpdate=true;
  return texture;
}

const mistVertex=`
  attribute vec3 center;
  attribute vec3 radii;
  attribute vec3 vapor;
  uniform float clock;
  uniform vec3 sunward;
  varying vec2 vLocal;
  varying vec3 vProperties;
  varying float vDistance;
  varying float vSun;
  void main() {
    vec3 right = vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
    vec2 extent = vec2(length(right*radii),length(up*radii));
    float phase = vapor.z*6.28;
    vec3 origin=center+vec3(1.15*sin(clock*.049+phase),.37*sin(clock*.098+phase),.85*cos(clock*.053+phase));
    vSun=pow(max(0.,dot(normalize(origin-cameraPosition),sunward)),6.);
    vec4 mv=modelViewMatrix*vec4(origin,1.0);
    vDistance=-mv.z;
    vLocal=position.xy;
    vProperties=vapor;
    mv.xy+=position.xy*extent;
    gl_Position=projectionMatrix*mv;
  }
`;

const mistFragment=`
  uniform sampler2D clouds;
  uniform float clock;
  uniform vec3 cool;
  uniform vec3 lit;
  varying vec2 vLocal;
  varying vec3 vProperties;
  varying float vDistance;
  varying float vSun;
  void main() {
    vec2 uv=vLocal;
    vec2 offset=vec2(vProperties.z*1.13,vProperties.z*.83);
    vec2 breeze=clock*vec2(.0016,-.00048);
    vec3 macro=texture2D(clouds,uv*vec2(.34,.26)+offset+breeze).rgb;
    vec2 curl=(macro.gb-.5)*.29;
    float wisps=texture2D(clouds,uv*vec2(.77,.83)+curl+offset*1.75-breeze*.63).g;
    float billow=(macro.r-.50)*.34+(wisps-.5)*.13;
    float height=uv.y-billow;
    float dome=max(0.0,1.0-uv.x*uv.x-height*height);
    float density=vProperties.x*pow(dome,1.54)*smoothstep(.20,.73,.67*macro.r+.33*wisps);
    float alpha=(1.0-exp(-density))*(.78+.18*vSun)*smoothstep(1.5,13.0,vDistance);
    float illumination=clamp(.045+vProperties.y*.43+height*.31+(macro.g-.49)*.66+.32*vSun,0.,1.);
    vec3 vapor=mix(cool,lit,illumination);
    vapor+=vec3(.10,.061,.023)*vSun*smoothstep(-.19,.64,height);
    gl_FragColor=vec4(vapor,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function buildMist(THREE,scene) {
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));
  geometry.setIndex([0,1,2,0,2,3]);
  const centers=[],radii=[],properties=[];
  banks.forEach(([x,y,z,rx,ry,rz,density,sun],i)=>{
    centers.push(x,y,z); radii.push(rx,ry,rz);
    properties.push(density,sun,(i*0.618033989+0.31)%1);
  });
  geometry.setAttribute('center',new THREE.InstancedBufferAttribute(new Float32Array(centers),3));
  geometry.setAttribute('radii',new THREE.InstancedBufferAttribute(new Float32Array(radii),3));
  geometry.setAttribute('vapor',new THREE.InstancedBufferAttribute(new Float32Array(properties),3));
  geometry.instanceCount=banks.length;
  const uniforms={clock:{value:0},clouds:{value:vaporTexture(THREE)},sunward:{value:new THREE.Vector3(...SUN_DIRECTION).normalize()},
    cool:{value:new THREE.Color('#739ba8')},lit:{value:new THREE.Color('#f3cd98')}};
  const material=new THREE.ShaderMaterial({uniforms,vertexShader:mistVertex,fragmentShader:mistFragment,transparent:true,depthWrite:false});
  const cloudbanks=new THREE.Mesh(geometry,material);
  cloudbanks.frustumCulled=false;
  cloudbanks.name='Mist caught in the ravine';
  cloudbanks.renderOrder=1;
  scene.add(cloudbanks);
  return {update(seconds){uniforms.clock.value=seconds;}};
}
