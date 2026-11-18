// Two curtains follow the magnetic field of the recovered gate. Each strip has
// a luminous lower edge and long, fading field lines, visible from both sides.
export function buildMagneticVeil(T,scene){
  const positions=[],coords=[],branches=[],indices=[];
  for(const branch of [-1,1]){
    const base=positions.length/3;
    for(let i=0;i<=112;i++){
      const u=i/112;
      const x=branch*(3+154*Math.pow(u,1.16));
      const z=-48-17*Math.sin(u*11.0+branch*.82)-44*u-12*Math.sin(u*4.7);
      const y=40.8+18*Math.sin(Math.PI*u*.82)+26*Math.pow(u,.79)+4.1*Math.sin(u*14.0-.85*branch)*u;
      const width=.35+Math.sin(u*Math.PI*.93)*12.2+12.*u;
      for(const v of [0,.30,.68,1]){
        positions.push(x+branch*v*(3.7+8.4*u),y+v*width,z-v*v*(2.+5.6*u));
        coords.push(u,v);branches.push(branch);
      }
      if(i<112)for(let j=0;j<3;j++){const n=base+i*4+j;indices.push(n,n+1,n+4,n+4,n+1,n+5)}
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(coords,2));
  geo.setAttribute('branch',new T.Float32BufferAttribute(branches,1));geo.setIndex(indices);
  const seconds={value:0},strength={value:0};
  const material=new T.ShaderMaterial({uniforms:{seconds,strength},transparent:true,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:`attribute float branch;uniform float seconds;varying vec2 field;varying float pole;
    void main(){field=uv;pole=branch;vec3 p=position;
      p.z+=sin(uv.x*20.+seconds*.15+branch)*uv.y*(2.4+2.7*uv.x);
      p.y+=sin(uv.x*17.-seconds*.13)*uv.x*(1.2+.9*uv.y);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`uniform float seconds,strength;varying vec2 field;varying float pole;
      void main(){
        float u=field.x,v=field.y;
        float bend=sin(13.*u+pole*1.6+seconds*.085)*.006;
        float f=u+bend*v+.004*sin(u*34.+v*1.8-seconds*.11);
        float drift=sin(f*23.+pole*.6)*.54+sin(f*51.-seconds*.13)*.27+sin(f*137.+seconds*.20)*.19;
        float tongues=.45+.55*smoothstep(-.43,.64,drift);
        float line=f*908.+4.*sin(f*38.-seconds*.075)+2.5*sin(f*119.);
        float filtered=1.-smoothstep(.75,3.1,fwidth(line));
        float folds=.53+.47*mix(.34,pow(.5+.5*cos(line),3.),filtered);
        float foot=.012+.048*(.5+.5*sin(f*24.+pole));
        float edge=exp(-abs(v-foot)*32.);
        float tail=exp(-max(0.,v-foot)*(2.8+1.4*(1.-tongues)))*smoothstep(0.,foot+.02,v);
        float envelope=smoothstep(.003,.048,u)*(1.-smoothstep(.70,1.,u))*(1.-smoothstep(.82,1.,v));
        vec3 base=mix(vec3(.25,2.01,1.33),vec3(1.09,1.19,.59),.46+.41*pole);
        vec3 tip=mix(vec3(.61,.67,1.54),vec3(1.25,.57,.55),.48+.34*pole);
        vec3 hue=mix(base,tip,smoothstep(.12,.83,v));float opacity=(.24*edge+.53*tail)*envelope*tongues*folds*strength;
        gl_FragColor=vec4(hue,opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  material.forceSinglePass=true;
  const mesh=new T.Mesh(geo,material);mesh.name='Awakened magnetosphere';mesh.visible=false;mesh.renderOrder=1;scene.add(mesh);
  let born=null;
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  return {update(time,awake){
    if(awake&&born===null)born=time;
    strength.value=awake?(reduced?.matches?1:Math.min(1,.22+(time-born)*.30)):0;
    seconds.value=time;mesh.visible=awake;
  }};
}
