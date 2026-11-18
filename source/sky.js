export const SUN_DIRECTION = Object.freeze([-0.66, 0.195, -0.73]);

// The sky is projected at infinity. Ridges and flocks occupy world space so that
// they keep their parallax as the observer crosses the garden.
function makeRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function noiseAtlas(T) {
  const size = 256;
  const bytes = new Uint8Array(size * size * 4);
  const random = makeRandom(0xa221b0);
  for (let i = 0; i < bytes.length; i += 4) {
    bytes[i] = random() * 255;
    bytes[i + 1] = random() * 255;
    bytes[i + 2] = random() * 255;
    bytes[i + 3] = 255;
  }
  const texture = new T.DataTexture(bytes, size, size, T.RGBAFormat);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.magFilter = texture.minFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// Pack tileable octave fields once. Marching the cloud deck then costs two
// filtered lookups for its density and one for the solar shadow at each step.
function weatherAtlas(T) {
  const size=256, seed=makeRandom(0x7f249b3d);
  const grids=[4,8,16,32,64,128].map(n=>Float32Array.from({length:n*n},()=>seed()));
  const data=new Uint8Array(size*size*4);
  function value(grid,n,x,y){
    const fx=x*n,fy=y*n,ix=Math.floor(fx),iy=Math.floor(fy),mask=n-1;
    let u=fx-ix,v=fy-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);
    const row=(iy&mask)*n,next=((iy+1)&mask)*n,a=ix&mask,b=(ix+1)&mask;
    return (grid[row+a]*(1-u)+grid[row+b]*u)*(1-v)+(grid[next+a]*(1-u)+grid[next+b]*u)*v;
  }
  const persistence=[.49,.258,.14,.071,.028,.013];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,i=(y*size+x)*4;
    let primary=0,billow=0;
    for(let octave=0;octave<grids.length;octave++){
      const n=4<<octave,w=persistence[octave],grid=grids[octave];
      primary+=w*value(grid,n,u,v);
      billow+=w*(1.-Math.abs(2.*value(grid,n,u+.324,v+.672)-1.));
    }
    data[i]=Math.round(255*primary);data[i+1]=Math.round(255*billow);
    data[i+2]=Math.round(255*value(grids[1],8,u+.17,v+.41));data[i+3]=255;
  }
  const tex=new T.DataTexture(data,size,size,T.RGBAFormat);
  tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.magFilter=T.LinearFilter;
  tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;
  return tex;
}

const skyVertex = `
  varying vec3 sight;
  void main() {
    sight = position;
    vec4 projected = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
    gl_Position = projected.xyww;
  }
`;

const skyFragment = `
  varying vec3 sight;
  uniform sampler2D atlas;
  uniform sampler2D weather;
  uniform float phase;
  uniform vec3 sunward;

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f*f*(3.0 - 2.0*f);
    return texture2D(atlas, (i + f + 0.5) / 256.0).r;
  }
  float cloudNoise(vec2 p) {
    mat2 twist = mat2(1.63,1.14,-1.14,1.63);
    float v = 0.52 * noise2(p);
    p = twist*p + 17.62;
    v += 0.265 * noise2(p);
    p = twist*p - 11.36;
    v += 0.135 * noise2(p);
    p = twist*p + 8.27;
    v += 0.065 * noise2(p);
    return v;
  }

  void main() {
    vec3 rd = normalize(sight);
    vec3 sun = sunward;
    float h = max(rd.y, 0.0);
    float facing = max(0.0, dot(sun, rd));
    float sunDistance = length(rd - sun);
    vec3 zenith = vec3(.071,.208,.307);
    vec3 horizon = mix(vec3(.541,.667,.724),vec3(.995,.757,.455),pow(facing,5.4));
    vec3 sky = mix(horizon,zenith, 1.0-exp(-4.7*pow(h,.88)));
    sky = mix(sky,vec3(1.065,.783,.45),.96*exp(-3.7*sunDistance));
    vec2 stellar=vec2(atan(rd.x,rd.z),asin(clamp(rd.y,-1.,1.)))*124.;
    vec3 cell=texture2D(atlas,(floor(stellar)+.5)/256.).rgb;
    float point=length(fract(stellar)-(.20+.60*cell.gb));
    float stars=step(.994,cell.r)*(1.-smoothstep(.035,.13,point));
    sky+=vec3(.51,.59,.61)*stars*smoothstep(.17,.58,h)*(1.-.90*pow(facing,4.5));

    // Ray/plane and ray/sphere intersections keep the rings correctly occulted
    // by the near hemisphere, including at shallow viewing angles.
    vec3 center = normalize(vec3(0.325,0.277,-0.952));
    float radius = 0.151;
    vec3 orbitNormal = normalize(vec3(0.255,-0.887,-0.388));
    float projection = dot(rd, center);
    vec3 miss = rd*projection-center;
    float impact = length(miss);
    float sphereNear = 3.0;
    if (projection > 0.0 && impact < radius) {
      sphereNear = projection - sqrt(max(0.0,radius*radius-impact*impact));
      vec3 n = normalize(rd*sphereNear-center);
      vec3 source = sunward;
      float sunlight = dot(n,source);
      float latitude = dot(n,orbitNormal);
      vec3 east = normalize(cross(orbitNormal,vec3(0.,0.,1.)));
      vec3 prime = cross(east,orbitNormal);
      float longitude = atan(dot(n,east),dot(n,prime));
      vec2 weather = vec2(longitude*3.9,latitude*19.0);
      float shear = cloudNoise(weather + 2.0*noise2(weather*0.39));
      float lat = latitude + (shear-0.5)*0.046;
      float belt = noise2(vec2(lat*11.2,110.8));
      float filaments = cloudNoise(vec2(longitude*9.0,lat*96.0)+vec2(shear*0.6,shear*2.0));
      float stream = noise2(vec2(lat*43.0+shear*0.9,52.0));
      vec3 darkFace = vec3(.215,.350,.403);
      vec3 lightFace = vec3(.933,.792,.615);
      vec3 body = mix(darkFace,lightFace,smoothstep(-.43,.69,sunlight));
      body += vec3(.168,.123,.084)*(belt-.45);
      body += vec3(0.066,0.060,0.049)*(0.43*(stream-0.5)+0.93*(filaments-0.5));
      float limb = pow(1.0-max(0.0,dot(n,-rd)),2.45);
      body += vec3(.184,.143,.092)*limb*(.19+.81*max(0.,sunlight));
      float edge = 1.0-smoothstep(radius-0.0013,radius,impact);
      sky = mix(sky,body,edge*.87);
    }
    float planeDot = dot(rd,orbitNormal);
    if (abs(planeDot)>0.00001 && projection>0.8) {
      float t = dot(center,orbitNormal)/planeDot;
      float r = length(rd*t-center)/radius;
      float extent = smoothstep(1.22,1.35,r)*(1.0-smoothstep(2.01,2.054,r));
      if (extent>0.0 && t>0.0 && t<sphereNear) {
        float division = (r-1.75)*42.0;
        float cassini = 1.0-0.91*exp(-division*division);
        float spoke = noise2(vec2(r*76.0,91.72));
        float band = 0.71+0.17*noise2(vec2(r*22.0,9.0))+0.12*spoke;
        float innerWidth = (r-1.55)*5.6;
        float weight = extent*band*cassini*(0.57+0.43*exp(-innerWidth*innerWidth));
        vec3 ringColor=mix(vec3(.71,.708,.628),vec3(.954,.819,.607),smoothstep(1.2,1.8,r));
        vec3 disk=rd*t-center;float along=dot(disk,sunward);
        float eclipse=step(along,0.)*(1.-smoothstep(.82,1.05,length(disk-sunward*along)/radius));
        ringColor=mix(ringColor,vec3(.36,.475,.492),eclipse*.76);
        sky=mix(sky,ringColor,weight*.75);
      }
    }

    vec2 wind=vec2(phase*.000037,phase*.000018);
    vec2 cloudPlane=rd.xz/(.235+max(-.025,rd.y));
    vec2 highUV=cloudPlane*vec2(.33,.73)+vec2(.54,.29)+wind;
    vec3 cirrusNoise=texture2D(weather,highUV).rgb;
    float strands=texture2D(weather,highUV*vec2(1.9,3.7)+cirrusNoise.rg*.17).g;
    float cirrus=smoothstep(.50,.76,cirrusNoise.r+(strands-.55)*.19)*smoothstep(.02,.25,h);
    sky=mix(sky,mix(vec3(.553,.670,.704),vec3(.991,.787,.579),pow(facing,6.)),cirrus*.25);

    // Eight samples through a tilted slab. The front lifts above the giant,
    // leaving the rings visible, while the lower edge hangs over the setting sun.
    float stormHeight=.267+.109*sin(rd.x*3.6+.18)+.035*cos(rd.z*8.);
    float overhead=smoothstep(-.17,.135,h-stormHeight);
    float clearPlanet=exp(-8.5*length(rd-center));
    float threshold=.559-.117*overhead+.071*clearPlanet;
    float sunGap=.062*exp(-13.*sunDistance);
    float pathLength=1./(.43+.50*h);
    float trans=1.;
    vec3 scattered=vec3(0.);
    for(int i=0;i<8;i++){
      float z=(float(i)+.5)/8.;
      vec2 p=cloudPlane*(.245+.072*z)+vec2(.674,.393)+wind;
      vec3 broad=texture2D(weather,p).rgb;
      vec3 curls=texture2D(weather,p*2.43+vec2(broad.b*.107,-broad.r*.083)+z*vec2(.053,-.029)).rgb;
      float field=broad.r*.75+curls.g*.25+.075*(broad.g-.54);
      float heightProfile=.124*pow(abs(z*2.-1.),1.45);
      float density=max(0.,field-threshold-heightProfile-sunGap)*3.8;
      vec3 upSun=texture2D(weather,p+sunward.xz*.046+vec2(.009,-.023)).rgb;
      float shadow=max(0.,upSun.r-threshold-.018);
      float transmission=exp(-4.4*density-7.1*shadow);
      float sunTone=pow(facing,6.);
      vec3 underside=mix(vec3(.112,.217,.318),vec3(.337,.299,.315),sunTone*.69);
      vec3 illuminated=mix(vec3(.617,.710,.754),vec3(1.225,.849,.494),sunTone);
      float sculpt=clamp(.35+(field-upSun.r)*2.7+.34*z+.14*(curls.g-.5),0.,1.);
      vec3 cloudColor=mix(underside,illuminated,clamp(.74*transmission+.32*sculpt,0.,1.));
      float extinction=exp(-density*pathLength*1.58);
      scattered+=trans*(1.-extinction)*cloudColor;
      trans*=extinction;
    }
    float deck=smoothstep(-.03,.13,h);
    sky=mix(sky,sky*trans+scattered,deck);
    vec3 marine=texture2D(weather,cloudPlane*vec2(.56,.87)+vec2(.27,.74)-wind*.56).rgb;
    float seaBank=smoothstep(.53,.73,marine.r+.055*marine.g)*exp(-14.*abs(h-.071));
    sky=mix(sky,mix(vec3(.66,.736,.744),vec3(.954,.791,.601),pow(facing,4.)),seaBank*.52);
    // Unlit gaps in the tilted deck cast broad, diverging shafts into the low
    // aerosol layer. The geometry shares the scene's solar direction.
    vec3 side=normalize(cross(sun,vec3(0.,1.,0.)));
    vec2 cone=vec2(dot(rd,side),dot(rd,cross(side,sun)));
    float slope=cone.x/(max(0.,-cone.y)+.045);
    float opening=texture2D(weather,vec2(.68+slope*.115,.53)).r;
    float ray=smoothstep(.41,.67,opening)*exp(-1.34*abs(slope))
      *smoothstep(.006,.088,-cone.y)*exp(-3.9*sunDistance)*deck;
    sky+=vec3(.113,.069,.026)*ray*(.32+.68*trans);
    sky+=vec3(.22,.116,.040)*exp(-sunDistance*17.)*(.29+.71*trans);
    float sunDisc=1.-smoothstep(.0124,.0139,sunDistance);
    if(rd.y<0.)sky=mix(sky,horizon,smoothstep(.0,.18,-rd.y));
    vec3 radiance=pow(max(sky,0.),vec3(2.2));
    radiance+=vec3(14.1,8.35,3.52)*sunDisc*max(.045,trans)*exp(-cirrus*.18-seaBank*.36);
    gl_FragColor = vec4(radiance,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function mountainChain(T,scene,layer,atlas) {
  const tau=2*Math.PI, distance=[460,632,815][layer];
  const depthScale=[1.72,2.0,2.16][layer];
  const reliefScale=[2.04,2.24,2.40][layer];
  const segments=[880,760,660][layer], rows=[15,15,16][layer];
  const random=makeRandom(0xa992119+layer*11);
  const positions=[],levels=[],erosion=[],indices=[];
  const lattice=Float32Array.from({length:512},()=>random());
  function noise(a,frequency,offset){
    const phase=a*frequency/tau,cell=Math.floor(phase),fraction=phase-cell;
    const k=((cell%frequency)+frequency)%frequency;
    const l=(k+1)%frequency;
    const f=fraction*fraction*(3-2*fraction);
    return lattice[(k+offset)&511]*(1-f)+lattice[(l+offset)&511]*f;
  }
  function hillside(a,u,horizontal,vertical,offset){
    const v=u*vertical,cell=Math.floor(v),t=v-cell,f=t*t*(3-2*t);
    return noise(a,horizontal,offset+67*cell)*(1-f)+noise(a,horizontal,offset+67*(cell+1))*f;
  }
  // Massifs form long asymmetric spines, broken into benches, high cols and
  // individual horns. The front-facing passes are placed around the sun and
  // gate to leave two windows into the next geological range.
  const summits=[];
  function summit(center,left,right,height){
    summits.push([center,left,right,height,.22+random()*.38,.25+random()*.45,.48+random()*.28]);
  }
  for(let i=0;i<13;i++){
    const center=((i+random()*.7)/13*tau+Math.PI)%tau-Math.PI;
    if(center> -1.24&&center<1.03)continue;
    summit(center,.24+random()*.39,.21+random()*.43,(.27+.73*random())*[24,35,42][layer]);
  }
  const front=[
    [[-1.14,.35,.59,21],[-.46,.24,.37,17],[.19,.32,.35,13],[.65,.28,.54,21]],
    [[-1.06,.53,.47,23],[-.58,.22,.42,26],[-.15,.39,.31,17],[.43,.30,.53,34],[.97,.46,.20,24]],
    [[-.96,.57,.59,39],[-.53,.32,.50,29],[.015,.40,.38,44],[.52,.31,.50,34],[1.00,.34,.42,41]],
  ];
  for(const args of front[layer])summit(...args);
  const ease=t=>t*t*(3-2*t);
  // The eastern fault thrust sheets up in steps. These elevations are the
  // continental-scale skyline; finer cuts and gullies are applied below.
  const skyline=[
    [[-1.30,16],[-1.05,9],[-.91,17],[-.77,12],[-.65,4],[-.48,11],[-.42,20],[-.36,14],[-.30,16],[-.20,6],[-.139,9],[-.09,4],[.01,6],[.096,15],[.141,13],[.18,21],[.28,9],[.37,5],[.53,12],[.64,22],[.74,13],[.97,15]],
    [[-1.30,22],[-1.07,32],[-.95,26],[-.81,13],[-.71,12],[-.63,20],[-.54,31],[-.48,27],[-.405,28],[-.35,20],[-.27,14],[-.22,18],[-.16,10],[-.084,17],[-.028,25],[.022,21],[.085,24],[.19,13],[.32,21],[.38,38],[.45,32],[.52,34],[.64,19],[.83,26],[.97,26]],
    [[-1.30,29],[-1.08,40],[-.97,44],[-.91,37],[-.82,34],[-.76,22],[-.66,26],[-.58,35],[-.53,33],[-.48,39],[-.42,28],[-.34,20],[-.27,15],[-.23,31],[-.197,35],[-.177,33],[-.149,54],[-.128,52],[-.105,39],[-.076,42],[-.042,34],[-.013,36],[.04,22],[.12,16],[.20,24],[.27,40],[.31,36],[.36,42],[.45,29],[.61,26],[.69,38],[.82,32],[.97,41]],
  ][layer];
  function horizon(a) {
    let peak=0;
    const warp=a+(noise(a,18,31)-.5)*.074;
    for(const [center,left,right,height,bench,shoulder,ledge] of summits) {
      const d=warp-center-tau*Math.round((warp-center)/tau),x=Math.abs(d)/(d<0?left:right);
      if(x>=1)continue;
      const knee=d<0?bench:shoulder,top=d<0?ledge:.9-ledge*.34;
      const span=x<knee?x/knee:(x-knee)/(1-knee);
      const w=x<knee?1-(1-top)*Math.pow(span,.78):top*(1-(.56*span+.44*ease(span)));
      peak=Math.max(peak,w*height);
    }
    const angle=Math.atan2(Math.sin(warp),Math.cos(warp));
    if(angle>skyline[0][0]&&angle<skyline[skyline.length-1][0]){
      let j=1;while(skyline[j][0]<angle)j++;
      const [az0,h0]=skyline[j-1],[az1,h1]=skyline[j];
      const t=(angle-az0)/(az1-az0),local=h0+(h1-h0)*(.77*t+.23*ease(t));
      const weight=Math.min(1,(angle+1.30)*9,(.97-angle)*9);
      peak+=(local-peak)*weight;
    }
    const fault=noise(a,49,64),teeth=noise(a,132,151),strata=noise(a,275,45);
    const exposed=.46+Math.min(1,peak/25)*.75;
    const ravine=Math.max(0,1-Math.abs(2*noise(a,173,113)-.85)*2.4);
    const incision=exposed*((fault-.5)*12.5+(teeth-.5)*9.4+(strata-.5)*5.4
      +(noise(a,497,267)-.5)*2.7-5.5*ravine);
    return [7.5,12.4,18.3][layer]+peak+6.3*(noise(a,11,14)-.5)+incision;
  }
  for(let i=0;i<=segments;i++) {
    const theta=i/segments*tau;
    const spine=horizon(theta);
    const baseRadius=distance+depthScale*(8.6*Math.sin(theta*5+layer)+4.9*Math.cos(theta*13-layer));
    for(let j=0;j<=rows;j++) {
      const u=j/rows, foothill=1-u;
      const shear=(layer%2?-.12:.12)+.115*Math.sin(theta*4+layer*1.47);
      const a=theta+foothill*(shear+(noise(theta,16,329)-.5)*.057);
      const run=theta+foothill*((noise(theta,17,68)-.5)*.18+.077*Math.sin(theta*11+layer+u*2.55));
      const split=run+foothill*(hillside(run,u,29,3,190)-.5)*.13;
      const spur=Math.abs(Math.sin(run*39+11*noise(run,13,133)+3.4*noise(run,28,300)));
      const flutes=Math.abs(Math.sin(split*84+5.6*noise(split,22,67)+spur*1.4));
      const apron=noise(theta,24,132),face=noise(theta,16,396);
      const tilted=Math.pow(u,1.16+.28*spur+.21*face);
      const height=tilted+.05*(ease(Math.min(1,Math.max(0,(u-.58-(face-.5)*.24)*10)))-u);
      const rubble=hillside(a,u,138,9,41),seam=hillside(run,u,65,5,288);
      const recess=((spur-.38)*12.4+(flutes-.39)*6.1)*(.43+.56*Math.sin(u*2.48));
      const radius=baseRadius+depthScale*(-53*Math.pow(foothill,.78)-5.6*apron+recess+(seam-.5)*8.2+(rubble-.5)*3.7);
      const y=reliefScale*(-49+(spine+49)*height+u*foothill*(35*(.55-spur)+14*(.50-flutes)+22*(seam-.5)+7*(rubble-.5)));
      positions.push(Math.sin(a)*radius,y,-Math.cos(a)*radius);
      levels.push(u);
      erosion.push(spur*.72+flutes*.28);
      if(i<segments && j<rows) {
        const k=i*(rows+1)+j;
        indices.push(k,k+rows+1,k+1,k+1,k+rows+1,k+rows+2);
      }
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('altitude',new T.Float32BufferAttribute(levels,1));
  geometry.setAttribute('incision',new T.Float32BufferAttribute(erosion,1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material=new T.ShaderMaterial({
    uniforms:{
      atlas:{value:atlas},
      sunward:{value:new T.Vector3(...SUN_DIRECTION).normalize()},
      shade:{value:new T.Color(['#36545b','#506b7b','#6c8494'][layer])},
      sunlight:{value:new T.Color(['#968f71','#b19a7d','#d4b592'][layer])},
      air:{value:new T.Color(['#85a2a5','#98acb2','#afb8b3'][layer])},
      distanceLayer:{value:layer*.5}
    },
    vertexShader:`attribute float altitude,incision; varying vec3 point; varying vec3 wall; varying vec2 relief;
      void main(){point=position;wall=normal;relief=vec2(altitude,incision);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform sampler2D atlas; uniform vec3 shade,sunlight,air,sunward; uniform float distanceLayer;
      varying vec3 point; varying vec3 wall; varying vec2 relief;
      void main(){
        vec3 facet=normalize(cross(dFdx(point),dFdy(point)));
        vec3 n=normalize(mix(normalize(wall),facet,.31));
        vec3 towards=normalize(point-cameraPosition);
        float mu=max(0.,dot(towards,sunward));
        vec2 p=vec2(point.x+point.z*.47,point.y+point.z*.12);
        vec3 macro=texture2D(atlas,(p*vec2(.127,.095)+17.)/256.).rgb;
        vec2 washed=vec2(p.x+.44*p.y+macro.g*2.7,p.y*.39);
        vec3 scratch=texture2D(atlas,(washed*vec2(.82,.67)+macro.rg*3.)/256.).rgb;
        float seam=point.y*.37+point.x*.049+point.z*.069+macro.r*3.1;
        float bedding=sin(seam)*(1.-smoothstep(.5,2.2,fwidth(seam)));
        float cut=relief.y*.70+scratch.b*.30;
        // Screen derivatives recover tangent-plane rock normals from the
        // actual strata height field, including on grazing cliffs.
        float reliefHeight=macro.g*.82+scratch.r*.48+.09*bedding;
        vec3 dpdx=dFdx(point),dpdy=dFdy(point);
        vec3 across=cross(dpdy,n),along=cross(n,dpdx);
        float area=dot(dpdx,across);
        n=normalize(abs(area)*n-sign(area)*(dFdx(reliefHeight)*across+dFdy(reliefHeight)*along)*.74);
        float diffuse=dot(n,sunward)+n.y*.19;
        float fold=clamp(.21+.76*diffuse+(macro.g-.5)*.19+(scratch.g-.5)*.14-(cut-.48)*.15,0.,1.);
        float skylight=clamp(.43+.47*n.y+.21*n.x,0.,1.);
        vec3 rock=mix(shade*(.69+.49*skylight),sunlight,fold*(1.-.19*distanceLayer));
        rock*=.88+.20*macro.r+.09*(scratch.r-.4)+.033*bedding;
        float scree=smoothstep(.34,.86,n.y)*smoothstep(29.,72.,point.y)*smoothstep(.43,.74,macro.b+.15*bedding);
        rock=mix(rock,sunlight,scree*.20);
        float valley=pow(clamp(1.-relief.x,0.,1.),.81);
        float forward=pow(mu,7.0);
        vec3 vapor=mix(air,vec3(.697,.506,.317),forward*(.58+.15*distanceLayer));
        float haze=.065+.14*distanceLayer+.49*valley+.15*forward+.055*valley*(macro.g-.50);
        gl_FragColor=vec4(mix(rock,vapor,clamp(haze,0.,.88)),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const ridge=new T.Mesh(geometry,material);
  ridge.name=['Jade foothills','Siltstone ridges','Distant continental divide'][layer];
  scene.add(ridge);
}

function driftingSeeds(T,scene) {
  const count = 108;
  const random = makeRandom(0x9a6f1220);
  const pos = [], seeds = [];
  for(let i=0;i<count;i++) {
    pos.push((random()-0.5)*98, 3+random()*34, (random()-0.3)*115);
    seeds.push(random()*12,0.25+random()*0.75);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geometry.setAttribute('seed',new T.Float32BufferAttribute(seeds,2));
  const material = new T.ShaderMaterial({
    uniforms:{time:{value:0},energy:{value:0}},transparent:true,depthWrite:false,
    vertexShader:`attribute vec2 seed; uniform float time; uniform float energy; varying float alpha;
      void main(){
        float p= time*(0.12+seed.y*0.11)+seed.x;
        vec3 drift = vec3(2.2*sin(p)+sin(p*0.45),0.7*sin(1.2*p+seed.x),1.5*cos(p));
        vec4 mv = modelViewMatrix*vec4(position+drift,1.0);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(42.0*seed.y/max(1.0,-mv.z),1.2,4.5);
        alpha=(0.37+0.24*sin(p*2.0))*(0.55+0.4*seed.y+0.4*energy)*smoothstep(1.1,5.0,-mv.z);
      }`,
    fragmentShader:`varying float alpha; void main(){
      float r=length(gl_PointCoord-0.5)*2.0;
      gl_FragColor=vec4(1.32,1.05,0.58,alpha*(1.0-smoothstep(0.08,1.0,r)));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
  });
  const points = new T.Points(geometry,material);
  points.name='Airborne seeds';
  scene.add(points);
  return material.uniforms;
}

function gliders(T,scene) {
  const random=makeRandom(8110);
  const birds=[];
  for (let i=0;i<23;i++) {
    const group = i<9 ? [-28,33,-71] : [24,43,-97];
    const scatter=i<9?6.5:9.5;
    birds.push({x:group[0]+(random()-0.5)*scatter*2,y:group[1]+random()*scatter*0.64,z:group[2]+(random()-0.5)*scatter,phase:random()*6.28,span:0.32+random()*0.36});
  }
  const coords = new Float32Array(birds.length*18*3);
  const geometry=new T.BufferGeometry();
  const attribute = new T.BufferAttribute(coords,3).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position',attribute);
  const flock = new T.Mesh(geometry,new T.MeshBasicMaterial({color:0x405951,side:T.DoubleSide}));
  flock.name = 'Gliding migrants';
  flock.frustumCulled=false;
  scene.add(flock);
  return t=>{
    let k=0;
    function vertex(a) {coords[k++]=a[0];coords[k++]=a[1];coords[k++]=a[2];}
    function triangle(a,b,c){vertex(a);vertex(b);vertex(c);}
    birds.forEach((bird,i)=>{
      const p=t*0.042+(i<9?0.2:2.4);
      const x=bird.x+4.6*Math.sin(p)+0.7*Math.sin(p*1.7+bird.phase);
      const y=bird.y+0.83*Math.cos(p+bird.phase);
      const z=bird.z+2.8*Math.cos(p);
      const flap= Math.sin(t*(2.1+0.22*bird.span)+bird.phase)*0.38;
      const s=bird.span;
      const head=[x,y,z-0.23*s],tail=[x,y,z+0.46*s];
      for(const side of [-1,1]){
        const joint=[x+side*s*0.43,y+s*(0.13+flap*0.22),z-0.035*s];
        const back=[x+side*s*0.43,y+s*(0.12+flap*0.22),z+0.24*s];
        const tip=[x+side*s,y+s*(flap+0.1),z+0.36*s];
        triangle(head,joint,tail);triangle(tail,joint,back);triangle(joint,tip,back);
      }
    });
    attribute.needsUpdate=true;
  };
}

export function buildSky(THREE, scene) {
  const uniforms={atlas:{value:noiseAtlas(THREE)},weather:{value:weatherAtlas(THREE)},phase:{value:0},sunward:{value:new THREE.Vector3(...SUN_DIRECTION).normalize()}};
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1,48,28),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,depthTest:true,depthFunc:THREE.LessEqualDepth,uniforms,
    vertexShader:skyVertex,fragmentShader:skyFragment
  }));
  sky.name='Sky and ringed primary';
  sky.frustumCulled=false;
  // Depth at infinity lets the opaque scene reject hidden sky fragments before
  // evaluating the atmospheric noise. Transparency still draws over the sky.
  sky.renderOrder=1000;
  scene.add(sky);
  for(let i=2;i>=0;i--) mountainChain(THREE,scene,i,uniforms.atlas.value);
  const seeds=driftingSeeds(THREE,scene);
  const flock=gliders(THREE,scene);
  flock(0);
  return {
    update(time,resonance=0) {
      uniforms.phase.value=time;
      seeds.time.value=time;
      seeds.energy.value=Number(resonance)||0;
      flock(time);
    }
  };
}
