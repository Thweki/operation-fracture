import {buildMagneticVeil} from './magnetic-veil.js';
// Reclaimed generators transmit along the abandoned surface network. The
// carrier sits against the terrain and lifts only across the two broken spans.
export function buildRelayLines(T,scene,heightAt){
  const paths=[
    {site:'tide',hue:new T.Color(.19,1.55,1.29),anchors:[[-153,-72],[-135,-61],[-112,-61],[-91,-47],[-64,-44],[-39,-57],[-12,-51]]},
    {site:'forge',hue:new T.Color(2.10,.85,.21),anchors:[[159,-19],[140,-27],[123,-44],[96,-56],[75,-54],[53,-66],[29,-58],[12,-48]]},
  ];
  const layers=paths.map(({site,hue,anchors})=>{
    const spline=new T.CatmullRomCurve3(anchors.map(([x,z])=>new T.Vector3(x,0,z)),false,'centripetal');
    const positions=[],uv=[],index=[],point=new T.Vector3(),tangent=new T.Vector3();
    for(const band of [-1,1]){
      const start=positions.length/3;
      for(let i=0;i<=180;i++){
        const u=i/180;spline.getPointAt(u,point);spline.getTangentAt(u,tangent);
        const spread=.42+.34*Math.sin(u*17)**2;
        for(const side of [-1,1]){
          const offset=band*spread+side*.105;
          const x=point.x+tangent.z*offset,z=point.z-tangent.x*offset;
          const y=Math.max(heightAt(x,z)+.20,1.3+Math.sin(u*Math.PI)*.8);
          positions.push(x,y,z);uv.push(u,side);
        }
        const n=start+i*2;if(i<180)index.push(n,n+1,n+2,n+2,n+1,n+3);
      }
    }
    const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(positions,3));geom.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geom.setIndex(index);geom.computeBoundingSphere();
    const uniforms={seconds:{value:0},radiance:{value:hue}};
    const material=new T.ShaderMaterial({uniforms,side:T.DoubleSide,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
      vertexShader:`varying vec2 strip;varying float depth;void main(){strip=uv;vec4 mv=modelViewMatrix*vec4(position,1.);depth=-mv.z;gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform float seconds;uniform vec3 radiance;varying vec2 strip;varying float depth;
        void main(){float phase=fract(strip.x*3.-seconds*.17);float pulse=exp(-phase*21.);
        float terminal=smoothstep(0.,.025,strip.x)*(1.-smoothstep(.975,1.,strip.x));float profile=1.-smoothstep(.15,1.,abs(strip.y));
        float fade=1.-smoothstep(70.,155.,depth);gl_FragColor=vec4(radiance*(.62+2.8*pulse),(.14+.64*pulse)*terminal*fade*profile);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
    const mesh=new T.Mesh(geom,material);mesh.name=site+' recovered relay';mesh.visible=false;mesh.renderOrder=2;scene.add(mesh);
    return {site,uniforms,mesh};
  });
  const veil=buildMagneticVeil(T,scene);
  return {update(time,cleared){
    veil.update(time,cleared.has('gate'));
    for(const layer of layers){layer.mesh.visible=cleared.has(layer.site);layer.uniforms.seconds.value=time}
  }};
}
