// A thin phosphor core is bolted to the inside of the ring. Its radiance is
// intentionally above display white; the HDR optics spread it onto adjacent
// pixels and these two small practical lights illuminate the nearby casing.
function buildPilotRail(T,scene){
  const fixture=new T.Group();
  fixture.name='Recessed meridian light guides';
  fixture.position.set(0,24.8,-48);fixture.rotation.set(.035,-.43,-.105,'YXZ');
  scene.add(fixture);
  const positions=[],colors=[];
  function strip(r,width,z,start,end,emission){
    const steps=Math.ceil((end-start)*37);
    for(let j=0;j<steps;j++){
      const a=start+(end-start)*j/steps,b=start+(end-start)*(j+1)/steps;
      for(const [angle,rad] of [[a,r],[b,r],[a,r+width],[a,r+width],[b,r],[b,r+width]]){
        positions.push(Math.cos(angle)*rad,Math.sin(angle)*rad,z);colors.push(...emission);
      }
    }
  }
  for(let i=0;i<28;i++){
    const a=i*Math.PI*2/28,b=a+Math.PI*2/28;
    const active=i%8!==3&&i%11!==5;
    if(!active)continue;
    const tint=i%6===0?[.40,.63,.58]:[1.,.82,.49];
    strip(16.49,.17,1.50,a+.010,b-.013,tint);
    strip(16.49,.13,-1.43,a+.012,b-.018,tint);
    if(i%3===1)strip(17.26,.085,1.54,a+.042,a+.121,[.60,.77,.64]);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const phosphor=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,color:new T.Color(4.25,3.75,3.10)});
  fixture.add(new T.Mesh(geometry,phosphor));
  const uplight=new T.PointLight(0xffd193,43,19,2),returnLight=new T.PointLight(0xb8eddf,27,15,2);
  uplight.position.set(-8,-14,2.1);returnLight.position.set(14.7,7.3,1.9);
  fixture.add(uplight,returnLight);
  return {lights:[uplight,returnLight],update(seconds,strength){
    const pilot=.93+.032*Math.cos(seconds*.64),calibration=1+strength*1.12;
    phosphor.color.setRGB(4.25*pilot*calibration,3.75*pilot*calibration,3.10*pilot*calibration);
    if(uplight.parent===fixture){uplight.intensity=43+63*strength;returnLight.intensity=27+41*strength}
  }};
}

// The field sits just inside the engine's recessed azimuth rail.
export function buildResonance(THREE, scene) {
  const pilot=buildPilotRail(THREE,scene);
  const field = new THREE.Group();
  field.name = 'Meridian resonance field';
  field.position.set(0, 24.8, -48);
  field.rotation.set(0.035, -0.43, -0.105, 'YXZ');
  scene.add(field);
  const time = { value: 0 }, power = { value: 0 };
  const uniforms = { time, power };
  const radius = 16.19;

  // Polar topology keeps the rim locked to the stone, while the surface
  // billows in depth. A second face is visible from behind the gate.
  const vertices = [], indices = [];
  const radialSteps = 21, angularSteps = 96;
  for (let j = 0; j <= radialSteps; j++) {
    const r = j / radialSteps * radius;
    for (let i = 0; i <= angularSteps; i++) {
      const a = i / angularSteps * Math.PI * 2;
      vertices.push(Math.cos(a) * r, Math.sin(a) * r, -0.94);
    }
  }
  for (let j = 0; j < radialSteps; j++) {
    for (let i = 0; i < angularSteps; i++) {
      const a = j * (angularSteps + 1) + i, b = a + angularSteps + 1;
      indices.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  const skin = new THREE.BufferGeometry();
  skin.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  skin.setIndex(indices);
  const membrane = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `
      uniform float time;
      uniform float power;
      varying vec2 plane;
      void main() {
        plane = position.xy / 16.19;
        float r = length(plane);
        vec3 pos = position;
        float bend = 1.0 - smoothstep(.41, 1.0, r);
        pos.z += power * bend * (1.5 * sin(4.3*r-time*.65)
          + 1.0 * sin(plane.x*3.9 - plane.y*2.4 + time*.39));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float power;
      varying vec2 plane;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
          mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
      }
      float strand(float phase, float thickness) {
        float d = abs(fract(phase)-.5);
        return 1.0 - smoothstep(thickness, thickness+max(.012, fwidth(phase)*.75), d);
      }
      void main() {
        vec2 p = plane;
        float r = length(p);
        float a = atan(p.y,p.x);
        float t = time*.23;
        vec2 drift = vec2(t*.38, -t*.31);
        float broad = noise(p*2.5+drift)*.64+noise(p*5.2-drift*.6)*.28+noise(p*10.2+drift)*.08;
        float gauze = sin(r*8.0-2.2*t + 2.1*sin(a*2.0+t+r*3.8)+broad*6.0);
        float sweep = r*6.3 + broad*1.38 + .48*sin(a*3.0+r*5.0-t) - t*.80;
        float strands = strand(sweep,.012) * smoothstep(-.64,.54,gauze);
        strands += .46*strand(sweep*1.23+.15*sin(a*4.0+r*7.0+t),.009)
          * smoothstep(.24,.74,broad);
        strands *= smoothstep(.05,.45,r);
        float inward = 1.0-r;
        float lip = exp(-inward*72.0);
        float halation = exp(-inward*13.0);
        float clockwork = strand(r*32.0+.05,.028) * smoothstep(.81,.97,r);
        clockwork *= .25+.75*smoothstep(-.18,.35,sin(a*7.0+1.8*t));
        float crest = pow(max(0.0,cos((r*1.8+t*.52)*6.28318+ .34*sin(3.0*a))),14.0);
        float silk = smoothstep(.20,.94,gauze)*(.12+.28*broad);
        float intensity = clamp(.11 + strands*.8 + clockwork*.55
          + lip*.9 + crest*(.10+.19*r) + halation*.27,0.0,1.0);
        vec3 cool = mix(vec3(.048,.18,.17),vec3(.21,.39,.32),silk);
        vec3 warm = mix(vec3(.83,.68,.36),vec3(1.65,1.57,1.18),intensity);
        vec3 color = mix(cool,warm,clamp(intensity+silk*.51,0.0,1.0));
        float alpha = power * clamp(.025+silk*.13 + halation*.25 +
          strands*.55+clockwork*.32+lip*.62+crest*.085,0.0,.94);
        color+=power*(lip*3.6+strands*2.7+clockwork*1.4)*vec3(1.,.89,.63);
        // Even at rest, a thin ion curtain clings to the broken rails.
        // Keep the mountain visible through the centre of the dormant ring.
        float arc=r-(.81+.105*sin(a*2.+t*.44)+.07*(broad-.5));
        float curtain=exp(-abs(arc)*11.)*smoothstep(-.62,.65,sin(a-1.05));
        float threads=.44+.56*pow(.5+.5*sin(a*92.+broad*17.+t*.31),3.);
        float trace=curtain*(.29+.71*threads);
        float residual=(1.-power)*(.022+trace*.67+lip*.21);
        vec3 residualColor=mix(vec3(.043,.14,.15),vec3(.54,2.12,1.48),trace);
        gl_FragColor=vec4((color*alpha+residualColor*residual)/max(.0001,alpha+residual),min(.98,alpha+residual));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  // Render the translucent sheet once at each pixel.
  membrane.forceSinglePass = true;
  const sheet = new THREE.Mesh(skin, membrane);
  sheet.renderOrder = 2;
  field.add(sheet);

  // Calibration filaments are actual open arcs, independently tilted in 3D.
  const filaments = new THREE.Group();
  const wirePositions = [];
  function wire(r, start, arc, tiltX, tiltY, z) {
    const steps = Math.ceil(arc*r*3.2);
    let last;
    for (let i = 0; i <= steps; i++) {
      const a = start + arc * i / steps, x = Math.cos(a)*r, y = Math.sin(a)*r;
      const cy = Math.cos(tiltY), sy = Math.sin(tiltY);
      const cx = Math.cos(tiltX), sx = Math.sin(tiltX);
      const point = [x*cy+y*sx*sy, y*cx, z -x*sy+y*sx*cy];
      if (last) wirePositions.push(...last,...point);
      last = point;
    }
  }
  wire(14.3,-1.42,3.76,0.24,0.085,0.11);
  wire(14.3,2.58,1.76,0.24,0.085,0.11);
  wire(14.02,1.3,1.95,0.24,0.085,0.11);
  wire(12.1,2.12,2.95,-0.23,0.4,-0.21);
  wire(12.1,-.78,1.76,-0.23,0.4,-0.21);
  const track = new THREE.BufferGeometry();
  track.setAttribute('position',new THREE.Float32BufferAttribute(wirePositions,3));
  const wireMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(3.35,2.85,1.63), transparent:true, opacity:0, depthWrite:false,
  });
  const lines = new THREE.LineSegments(track,wireMaterial);
  lines.renderOrder = 3;
  filaments.add(lines); field.add(filaments);

  let seed = 0x56a44de9;
  function random() {
    seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const total = 740, starts = new Float32Array(total * 3), states = new Float32Array(total * 4);
  for (let i=0;i<total;i++) {
    states.set([random(), random(), random(), random()],i*4);
  }
  const dust = new THREE.BufferGeometry();
  dust.setAttribute('position',new THREE.BufferAttribute(starts,3));
  dust.setAttribute('state',new THREE.BufferAttribute(states,4));
  dust.boundingSphere = new THREE.Sphere(new THREE.Vector3(),18.5);
  const sparksMaterial = new THREE.ShaderMaterial({
    uniforms, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    vertexShader: `
      uniform float time;
      uniform float power;
      attribute vec4 state;
      varying float strength;
      varying float tint;
      void main() {
        float age = fract(time*(.10+.15*state.z)+state.x);
        float stream = step(.74,state.y);
        float angle = state.y*47.123 + time*(.04+.16*state.z)
          + age*(.47+state.w*.94)*stream;
        float r = 14.7+1.3*state.x + sin(angle*3.0+age*6.28)*.22
          - stream*(age*age)*(2.0+state.w*9.8);
        float z = -.60 + .22*sin(angle*8.0)+stream*sin(age*3.14)*(state.y*3.9-1.4);
        vec3 pos = vec3(r*cos(angle),r*sin(angle),z);
        vec4 mv = modelViewMatrix * vec4(pos,1);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = clamp((1.32+2.4*pow(state.w,3.0))*87.0/max(1.0,-mv.z),1.0,9.5);
        strength = power * smoothstep(0.0,.15,age)*(1.0-smoothstep(.67,1.0,age))
          * (.25+.75*state.z);
        tint = state.x;
      }
    `,
    fragmentShader: `
      varying float strength;
      varying float tint;
      void main() {
        float d = length(gl_PointCoord-.5)*2.0;
        if(d>1.0) discard;
        vec3 color = mix(vec3(1.16,2.26,1.83),vec3(4.8,3.58,1.91),tint);
        gl_FragColor = vec4(color,strength*exp(-2.6*d*d));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const sparks = new THREE.Points(dust,sparksMaterial);
  sparks.renderOrder = 4;
  field.add(sparks);
  return {
    lights:pilot.lights,
    update(seconds, strength = 0) {
      const level = THREE.MathUtils.clamp(Number(strength) || 0,0,1);
      pilot.update(seconds,level);
      filaments.visible=sparks.visible=level>.001;
      time.value = seconds;
      power.value = level;
      wireMaterial.opacity = level * (.44+.055*Math.sin(seconds*1.35));
      filaments.rotation.z = seconds * .045;
    },
  };
}
