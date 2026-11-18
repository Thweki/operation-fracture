// The coaxial rings are a portable version of the garden gate. The chamber
// holds the projectile horizontally, with an open view through the axle.
export function buildOrbitalArm(T,parent,assembly,{surface,dark,steel,brass,ceramic}){
  const group=new T.Group();group.name='Verdigris orrery';group.visible=false;parent.add(group);
  const body=assembly(T,group),dial=assembly(T,group);
  const enamel=new T.MeshStandardMaterial({color:0x47806c,metalness:.55,roughness:.34,map:surface,bumpMap:surface,bumpScale:.002});
  const glass=new T.MeshStandardMaterial({color:0x74b995,metalness:.25,roughness:.21,emissive:0x32684d,emissiveIntensity:.6});
  const trace=new T.MeshBasicMaterial({color:new T.Color(.74,2.18,1.06)});
  const dot=new T.MeshBasicMaterial({color:new T.Color(2.38,2.02,1.09)});
  const stock=[[-.28,-.11],[-.32,.04],[-.21,.15],[.08,.19],[.29,.10],[.27,-.12],[.09,-.19],[-.14,-.17]];
  body.shell(dark,stock,1.01,0,-.18,-.02,.036);
  body.shell(enamel,stock,.55,0,-.13,.42,.028);
  body.shell(brass,stock,.025,0,-.13,1.015,.018);
  body.shell(dark,stock.map(([x,y])=>[x*.92,y*.82]),.033,0,-.13,1.059,.012);
  for(const side of [-1,1]){
    body.box(steel,side*.34,-.11,.06,.13,.12,.93,-.02,side*.24,-side*.13);
    body.box(ceramic,side*.41,-.073,-.18,.10,.083,.77,0,side*.21,-side*.14);
    body.box(brass,side*.49,-.04,-.40,.064,.06,.53,0,side*.12);
    body.box(enamel,side*.49,-.01,-.42,.09,.048,.34,0,side*.12);
    for(let i=0;i<6;i++)body.box(i%3?brass:trace,side*.314,-.021,.30+i*.102,.036,.043,.020,0,0,side*.32);
    body.box(dark,side*.29,-.09,.68,.17,.139,.24);
  }
  // Arched stoneware collars span two quarters of the chamber, leaving both
  // ends of the flying wheel visible even in a first-person firing pose.
  const centerZ=-.78;
  function rim(batch,m,r,w,y,from,arc){
    batch.part(new T.TorusGeometry(r,w,6,Math.ceil(48*arc/(Math.PI*2)),arc),m,0,y,centerZ,-Math.PI/2,0,from);
  }
  for(const from of [.13,Math.PI+.13]){
    rim(body,steel,.59,.068,-.045,from,2.83);
    rim(body,ceramic,.595,.044,.007,from+.02,1.97);
    rim(body,brass,.569,.021,.044,from+.042,2.60);
    rim(body,trace,.563,.010,.061,from+.56,1.28);
    rim(body,glass,.593,.045,.007,from+2.08,.56);
  }
  for(let j=0;j<22;j++){
    const a=.12+j*(Math.PI*2/22),major=j%3===0;
    body.box(major?dot:dark,Math.cos(a)*.594,.053,centerZ+Math.sin(a)*.594,major?.063:.036,.012,major?.015:.010,0,-a);
  }
  // The outer leaves have crescent tips and an open filigree centre.
  const leaf=[[.21,-.088],[.34,-.096],[.47,-.084],[.518,-.040],[.494,.055],[.418,.113],[.462,.026],[.35,.033],[.25,.065]];
  for(let j=0;j<5;j++){
    const a=j*Math.PI*2/5,cs=Math.cos(a),sn=Math.sin(a);
    const shape=new T.Shape();
    leaf.forEach(([x,z],i)=>{const u=x*cs-z*sn,v=x*sn+z*cs;i?shape.lineTo(u,v):shape.moveTo(u,v)});shape.closePath();
    dial.part(new T.ExtrudeGeometry(shape,{depth:.027,bevelEnabled:true,bevelSize:.009,bevelThickness:.007,bevelSegments:1}),j%2?brass:enamel,0,.031,0,-Math.PI/2);
    dial.part(new T.TorusGeometry(.375,.009,5,12,.40),trace,0,.075,0,-Math.PI/2,0,a-.05);
    dial.part(new T.OctahedronGeometry(1),glass,.315*cs,.071,-.315*sn,0,a,0,.055,.021,.037);
  }
  for(const [r,w,m] of [[.215,.029,brass],[.177,.014,trace],[.138,.021,steel]]){
    dial.part(new T.TorusGeometry(r,w,6,38),m,0,.052,0,-Math.PI/2);
  }
  body.box(dark,0,.032,.62,.36,.052,.39);
  for(let i=0;i<9;i++)body.box(i%3===0?dot:trace,(i-4)*.032,.063,.62,.015,.008,i%3===0?.094:.045);
  body.ring(brass,0,.20,.18,.099,.018,Math.PI*1.67,Math.PI*.67,1.26,.88);
  body.box(trace,0,.135,.18,.019,.043,.021);
  const wheel=dial.seal();body.seal();wheel.position.z=centerZ;
  return {group,muzzle:[0,.061,-1.39],sight:[0,.20,.18,.073],scale:.98,kick:.18,recovery:7.6,tilt:.068,
    update(time,heat,kick,glow,reduced){
      wheel.rotation.y=reduced?0:time*.72+kick*1.51;
      wheel.position.y=reduced?0:.025*Math.sin(time*1.37)+kick*.098;
      glass.emissiveIntensity=.62+glow*.96;trace.color.setRGB(.53+glow*.51,1.72+glow*.63,.78+heat*.004);
    }};
}