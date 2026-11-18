import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildOrbitalArm} from './orbital-arm.js';

// Each articulated assembly has one draw per finish. The individual inlays,
// vents and engraved graduations never become separate scene objects.
function assembly(T,parent) {
  const group=new T.Group(), batches=new Map(), matrix=new T.Matrix4(), euler=new T.Euler();
  const q=new T.Quaternion(), v=new T.Vector3(), s=new T.Vector3();
  parent.add(group);
  function part(shape,material,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){
    matrix.compose(v.set(x,y,z),q.setFromEuler(euler.set(rx,ry,rz)),s.set(sx,sy,sz));
    const geometry=shape.index?shape.toNonIndexed():shape;
    geometry.applyMatrix4(matrix);
    if(!batches.has(material))batches.set(material,[]);
    batches.get(material).push(geometry);
    if(shape!==geometry)shape.dispose();
  }
  const box=(m,x,y,z,w,h,d,rx=0,ry=0,rz=0)=>part(new T.BoxGeometry(w,h,d),m,x,y,z,rx,ry,rz);
  const ring=(m,x,y,z,r,t,arc=Math.PI*2,rot=0,sx=1,sy=1)=>
    part(new T.TorusGeometry(r,t,5,Math.max(6,Math.ceil(36*arc/(Math.PI*2))),arc),m,x,y,z,0,0,rot,sx,sy,1);
  function shell(m,outline,depth,x,y,z,bevel=.022,rz=0,ry=0){
    const shape=new T.Shape();
    outline.forEach(([u,v],i)=>i?shape.lineTo(u,v):shape.moveTo(u,v));shape.closePath();
    part(new T.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1}),m,x,y,z,0,ry,rz);
  }
  function seal(){
    for(const [material,source] of batches){
      const mesh=new T.Mesh(mergeGeometries(source),material);
      mesh.frustumCulled=false;group.add(mesh);source.forEach(g=>g.dispose());
    }
    batches.clear();
    return group;
  }
  return {part,box,ring,shell,seal,group};
}

const roundedHex=[[-.94,-.26],[-.83,.54],[-.40,.91],[.42,.91],[.86,.56],[.99,-.18],[.57,-.76],[-.56,-.76]];
const shrink=(outline,x,y)=>outline.map(([u,v])=>[u*x,v*y]);

function telemetry(T){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const pen=canvas.getContext('2d');
  for(let row=0;row<2;row++){
    const y=row*128;
    pen.fillStyle=row?'#1b1a31':'#2a201a';pen.fillRect(0,y,512,128);
    pen.strokeStyle=row?'#80758d':'#aa8061';pen.lineWidth=3;pen.strokeRect(4,y+4,504,120);
    pen.fillStyle=row?'#d3c2f1':'#eac6a0';
    pen.font='600 33px monospace';pen.fillText(row?'ASTRAL  /  IX':'COROLLA  /  VII',19,y+45);
    pen.font='18px monospace';pen.fillText(row?'PHASE  INTERFEROMETER':'SOLAR  IRIS  ARRAY',20,y+79);
    for(let i=0;i<37;i++)pen.fillRect(18+i*10,y+(i%4===0?95:103),i%4===0?3:2,i%4===0?16:8);
    pen.lineWidth=2;
    for(let j=0;j<3;j++){
      pen.beginPath();pen.arc(445,y+68,15+j*12,row?.34*j:j*.58,Math.PI*(1.65+j*.13));pen.stroke();
    }
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const material=new T.MeshBasicMaterial({map:texture,color:0xd2cdd0,polygonOffset:true,polygonOffsetFactor:-1});
  return function mark(part,row,x,y,z,width,depth){
    const g=new T.PlaneGeometry(width,depth),uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setY(i,(1-row+uv.getY(i))*.5);
    part(g,material,x,y,z,-Math.PI/2);
  };
}

export function buildEnergyArms(T,parent,{surface,dark,steel,brass,ceramic}){
  function alloy(color,metalness,roughness){
    return new T.MeshStandardMaterial({color,metalness,roughness,map:surface,bumpMap:surface,bumpScale:.003});
  }
  const copper=alloy(0xa35837,.63,.35),enamel=alloy(0x86462c,.37,.41);
  const night=alloy(0x303348,.69,.36),pearl=alloy(0xb9b2cb,.49,.31);
  const ember=new T.MeshBasicMaterial({color:new T.Color(2.25,.72,.15)});
  const violet=new T.MeshBasicMaterial({color:new T.Color(1.12,.53,2.58)});
  const warmCore=new T.MeshBasicMaterial({color:new T.Color(2.86,1.6,.57)});
  const coldCore=new T.MeshBasicMaterial({color:new T.Color(1.95,1.55,3.24)});
  const mark=telemetry(T);
  const scatter=new T.Group(),lance=new T.Group();parent.add(scatter,lance);
  scatter.name='Ember corolla';lance.name='Astral filament';scatter.visible=lance.visible=false;

  // A wide seven-lobed corolla, with a combustion iris on each side of its
  // ceramic mantle. The central void visibly opens during the discharge.
  const cast=assembly(T,scatter),bloom=assembly(T,scatter);
  cast.shell(dark,shrink(roundedHex,.51,.38),1.05,0,-.045,-.43,.05);
  cast.shell(enamel,shrink(roundedHex,.50,.36),.37,0,-.04,.59,.045);
  cast.shell(copper,shrink(roundedHex,.43,.32),.047,0,-.04,.974);
  cast.shell(dark,shrink(roundedHex,.39,.275),.025,0,-.04,1.04);
  cast.ring(copper,.04,.005,1.077,.152,.028,Math.PI*2,0,1.16,.87);
  cast.ring(ember,.04,.005,1.086,.116,.009,Math.PI*1.61,.57,1.16,.87);
  for(let i=0;i<7;i++){
    const a=i*Math.PI*2/7;
    cast.box(warmCore,.04+.132*Math.cos(a),.005+.115*Math.sin(a),1.092,.018,.009,.012,0,0,a);
  }
  for(const sign of [-1,1]){
    cast.shell(copper,shrink(roundedHex,.22,.25),.90,.43*sign,-.015,-.69,.039,-sign*.18);
    cast.shell(ceramic,shrink(roundedHex,.206,.242),.48,.451*sign,-.018,.18,.029,-sign*.18);
    for(let i=0;i<6;i++){
      const z=-.59+i*.127;
      cast.box(dark,sign*.482,.23,z,.114,.029,.075,.10,0,-sign*.27);
      cast.box(ember,sign*.482,.249,z,.085,.009,.021,.10,0,-sign*.27);
    }
    cast.shell(enamel,shrink(roundedHex,.19,.178),.43,.39*sign,-.19,-1.04,.026);
    cast.box(brass,sign*.208,.31,.48,.066,.048,.39,-.13,0,-sign*.3);
    for(let j=0;j<3;j++)cast.box(warmCore,sign*.207,.338,.36+j*.074,.039,.018,.019);
    // Raised lacquer ribs catch the low sun along the bell-shaped cowl.
    cast.box(dark,sign*.465,.275,-.15,.12,.023,.69,0,0,-sign*.19);
    cast.box(copper,sign*.465,.292,-.15,.075,.015,.65,0,0,-sign*.19);
    for(let j=0;j<6;j++)cast.box(ember,sign*.465,.302,-.43+j*.107,.052,.011,j%3===0?.038:.019,0,0,-sign*.19);
  }
  cast.shell(dark,shrink(roundedHex,.16,.043),.45,0,.314,.29,.012);
  for(let i=0;i<7;i++){
    const w=.055+.031*Math.sin(i*Math.PI/6);
    cast.box(i===3?warmCore:ember,(i-3)*.034,.363,.49,.014,.008,w,0,.1,0);
  }
  mark(cast.part,0,0,.310,.79,.40,.12);
  // Open horseshoe sight, marked with three amber reference points.
  cast.ring(dark,0,.364,.04,.139,.027,Math.PI*1.45,Math.PI*.78,1.32,.85);
  cast.ring(ember,0,.364,.052,.131,.010,Math.PI*1.42,Math.PI*.80,1.32,.85);
  cast.box(ember,0,.294,-.72,.025,.057,.029);
  cast.ring(copper,0,.025,-.71,.47,.062,Math.PI*2,0,1,.81);
  cast.ring(ember,0,.025,-.748,.429,.011,Math.PI*2,0,1,.81);
  const petal=[[-.14,-.045],[-.18,.086],[-.105,.195],[.063,.23],[.155,.105],[.12,-.036],[.028,-.085]];
  const facet=[[-.125,-.04],[-.10,.065],[.017,.131],[.101,.070],[.088,-.022],[.018,-.069]];
  for(let i=0;i<7;i++){
    const a=i*Math.PI*2/7,c=Math.cos(a),s=Math.sin(a),x=-s*.438,y=c*.402+.027;
    bloom.shell(i%3===1?enamel:copper,petal,.65,x,y,-1.39,.035,a);
    bloom.shell(i%3===1?copper:ceramic,facet,.36,x*1.06,y*1.06,-1.69,.022,a);
    bloom.shell(dark,shrink(facet,.79,.81),.06,x*1.06,y*1.06,-1.763,.009,a);
    bloom.ring(ember,x*1.06,y*1.06,-1.777,.056,.010,Math.PI*1.83,a);
    bloom.box(dark,x-.245*s,y+.245*c,-1.132,.096,.019,.43,0,0,a);
    bloom.box(ember,x-.260*s,y+.260*c,-1.15,.047,.015,.35,0,0,a);
    bloom.box(warmCore,x-.270*s,y+.270*c,-.974,.080,.013,.024,0,0,a);
    for(let j=0;j<3;j++)bloom.box(brass,x-.259*s,y+.259*c,-.924+j*.060,.082,.014,.017,0,0,a);
  }
  bloom.ring(copper,0,.026,-1.27,.335,.035);
  bloom.ring(warmCore,0,.026,-1.31,.313,.011);
  bloom.part(new T.OctahedronGeometry(1),ember,0,.015,-1.26,.14,.17,.1,.135,.145,.324);
  cast.seal();const flower=bloom.seal();

  // Parallel filaments stay separated all the way through the open objective.
  // The transverse crystal bridges move forward momentarily when it sings.
  const truss=assembly(T,lance),string=assembly(T,lance);
  const yoke=[[-.31,-.16],[-.32,-.047],[-.16,.135],[.13,.172],[.26,.092],[.295,-.074],[.12,-.158]];
  truss.shell(night,yoke,1.19,0,-.095,-.29,.042);
  truss.shell(pearl,shrink(yoke,1.01,.79),.55,0,-.083,.57,.026);
  truss.shell(dark,shrink(yoke,.91,.62),.039,0,-.073,1.151,.013);
  for(let j=0;j<3;j++)truss.box(violet,-.12+j*.069,-.021,1.204,.050,.014,.013,0,0,-.31);
  for(const sign of [-1,1]){
    const rib=[[-.046,-.093],[-.069,-.018],[-.034,.113],[.026,.143],[.071,.059],[.049,-.073]];
    truss.shell(pearl,rib,1.53,sign*.208,.003,-2.20,.014,-sign*.21);
    truss.shell(night,shrink(rib,.77,.68),.61,sign*.208,.013,-2.87,.009,-sign*.21);
    truss.box(night,sign*.211,.163,-1.48,.065,.018,1.30);
    truss.box(violet,sign*.211,.177,-1.47,.032,.012,1.27);
    truss.box(coldCore,sign*.206,.129,-2.38,.018,.014,.24);
    truss.box(brass,sign*.249,.102,-1.32,.015,.023,1.23);
    for(let i=0;i<6;i++){
      const z=-.88+i*.192;
      truss.box(night,sign*.258,.112,z,.053,.021,.076,0,.23*sign,0);
      truss.box(violet,sign*.255,.124,z,.026,.007,.030,0,.23*sign,0);
    }
    truss.shell(pearl,shrink(rib,1.23,1.69),.63,sign*.252,-.032,-.55,.019,-sign*.41);
    truss.box(steel,sign*.219,.109,.42,.058,.04,.51,0,0,sign*.31);
    truss.box(brass,sign*.222,.141,.37,.029,.018,.37);
  }
  for(let i=0;i<6;i++){
    const z=-.96-i*.257;
    string.ring(i%2?steel:brass,0,-.011,z,.216-i*.006,.014,Math.PI*1.25,Math.PI*.885,1,.73);
    string.ring(violet,0,-.011,z-.01,.199-i*.006,.007,Math.PI*.56,Math.PI*1.24,1,.73);
  }
  string.part(new T.OctahedronGeometry(1),coldCore,0,.016,-1.66,0,0,.77,.038,.063,.51);
  // Slender vertical split-arch optic and an offset ten-mark telemetry strip.
  for(const z of [.34,-.22]){
    truss.ring(night,-.018,.278,z,.166,.026,Math.PI*2,0,.85,1.1);
    truss.ring(brass,-.018,.278,z+.019,.160,.013,Math.PI*1.78,.48,.85,1.1);
    truss.ring(violet,-.018,.278,z+.029,.136,.007,Math.PI*.74,.53,.85,1.1);
    for(const side of [-1,1])truss.box(night,-.018+side*.087,.111,z,.037,.112,.056,0,0,-side*.29);
  }
  truss.box(violet,-.018,.16,-.23,.013,.045,.018);
  truss.box(night,-.155,.128,.66,.121,.037,.48,0,0,.11);
  for(let i=0;i<10;i++)truss.box(i%3===0?coldCore:violet,-.155,.152,.47+i*.041,i%3===0?.085:.056,.008,.009,0,0,.11);
  for(const sign of [-1,1])for(let i=0;i<5;i++){
    const z=.42+i*.109;
    truss.box(night,sign*.278,.016,z,.032,.053,.067,.2,0,-sign*.25);
    truss.box(violet,sign*.294,.026,z,.012,.018,.046,.2,0,-sign*.25);
  }
  truss.box(night,.025,.104,.875,.37,.022,.126);
  mark(truss.part,1,.025,.117,.875,.34,.102);
  truss.seal();const filament=string.seal();
  return {
    orbit:buildOrbitalArm(T,parent,assembly,{surface,dark,steel,brass,ceramic}),
    scatter:{group:scatter,muzzle:[0,.028,-1.94],sight:[0,.364,.04,.092],scale:.96, kick:.34, recovery:9, tilt:.115,
      update(t,heat,k,glow,reduced){flower.position.z=reduced?0:k*.20;flower.rotation.z=reduced?0:-.25*k;ember.color.setRGB(2.1+glow*.48,.58+glow*.28+heat*.0015,.10+glow*.16)}},
    lance:{group:lance,muzzle:[0,.014,-2.91],sight:[-.018,.278,.34,0],scale:1.04, kick:.23, recovery:6.8, tilt:.043,
      update(t,heat,k,glow,reduced){filament.position.z=reduced?0:-k*.27;violet.color.setRGB(1.00+glow*.56,.48+glow*.42,2.41+Math.sin(t*1.9)*.12+heat*.003)}},
  };
}
