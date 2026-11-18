// Each plant, including its buds and pollen, is a single indexed mesh.
export function flowerGeometry(T,variant,lod){
  const position=[],color=[],floral=[],index=[];
  const tau=2*Math.PI, high=lod===3, medium=lod===2, fine=lod>=2;
  const vec=(x,y,z)=>new T.Vector3(x,y,z);
  const tmp=new T.Color(),tints=new Map();
  function hue(s){if(!tints.has(s))tints.set(s,new T.Color(s));return tints.get(s)}
  function vertex(p,c,brightness=1,u=0,v=0,organ=0){
    const i=position.length/3;position.push(p.x,p.y,p.z);color.push(c.r*brightness,c.g*brightness,c.b*brightness);floral.push(u,v,organ);return i;
  }
  function quad(a,b,c,d){index.push(a,b,d,b,c,d)}
  function connect(a,b){for(let j=0;j<a.length-1;j++)quad(a[j],a[j+1],b[j+1],b[j])}
  const h=[.91,1.06,.82][variant],drift=vec([-.16,.13,.21][variant],0,[.09,.16,-.13][variant]);
  const stalk=t=>vec(drift.x*t*t,h*t,drift.z*t*t*t);
  function stem(path,radius,segments,sides){
    let previous;
    for(let i=0;i<=segments;i++){
      const t=i/segments,p=path(t),r=radius*(1-.38*t),row=[];
      for(let j=0;j<=sides;j++){
        const a=j*tau/sides;
        row.push(vertex(p.clone().add(vec(Math.cos(a)*r,0,Math.sin(a)*r)),hue('#708755'),.84+.14*Math.cos(a-.6)));
      }
      if(previous)connect(previous,row);previous=row;
    }
  }
  stem(stalk,.0115,high?4:1,high?5:3);
  function leaf(from,az,len,width,rise){
    const base=stalk(from),co=Math.cos(az),si=Math.sin(az),rows=high?9:medium?4:2;
    let previous;
    for(let n=0;n<rows;n++){
      const t=n/(rows-1),v=Math.sin(Math.PI*t),r=len*t;
      const lobes=.72+.28*Math.cos(t*8.3*Math.PI+from*5);
      const half=width*(.008+Math.pow(v,.79)*lobes),bend=.052*Math.sin(t*4.6+az)*t;
      const row=(high?[-1,-.47,0,.47,1]:[-1,0,1]).map(u=>{
        const d=u*half+bend;
        const p=vec(base.x+co*r-si*d,base.y+t*rise+v*.12+.046*u*t*Math.sin(az)+.033*v*(1-Math.abs(u)),
          base.z+si*r+co*d);
        const c=u===0?hue('#99ac65'):hue(n%3===0?'#567e55':'#5e7d4b');
        return vertex(p,c,.70+.25*t+.18*v,(u+1)*.5,t,.5);
      });
      if(previous)connect(previous,row);previous=row;
    }
  }
  const leaves=high?5:medium?3:lod===1?2:1;
  for(let j=0;j<leaves;j++)leaf(.09+j*.105,j*2.38+variant*.61,.43-j*.043,.089-j*.007,.16+j*.007);

  const head=stalk(1),tilt=[.20,.43,.60][variant],axis=variant*1.67+.82;
  const top=vec(Math.sin(tilt)*Math.cos(axis),Math.cos(tilt),Math.sin(tilt)*Math.sin(axis));
  const east=vec(1,0,0).addScaledVector(top,-top.x).normalize(),north=east.clone().cross(top);
  function at(x,y,z){return head.clone().addScaledVector(east,x).addScaledVector(top,y).addScaledVector(north,z)}
  const bases=['#62192d','#802027','#60192c'],mids=['#c8363e','#d64c39','#b32b43'],tips=['#f27066','#f78964','#e25565'];
  function petal(az,j,inner){
    const curl=.80+.20*Math.sin(j*13.1+variant);
    const radius=(inner?.235:.326)*curl*(variant===2?.88:1),height=(inner?.174:.102)*(variant===2?1.24:1);
    const rows=high?6:medium?3:lod===1&&!inner?3:2,cols=high?15:medium?6:lod===1?4:3;
    const ca=Math.cos(az),sa=Math.sin(az);
    let previous;
    for(let n=0;n<rows;n++){
      const t=n/(rows-1),row=[];
      for(let k=0;k<cols;k++){
        const u=2*k/(cols-1)-1,edge=Math.abs(u),lip=t*t*t;
        // Narrow claws separate the lobes. The reflexed lip and asymmetric
        // fold let daylight catch both faces of the same petal.
        const flute=Math.sin(12*u+1.2*j)*.68+Math.sin(23*u+2*j)*.32;
        const width=radius*(inner?.77:.82)*(.055+.945*Math.sin(t*1.92)**.82);
        const tangent=u*width+.024*t*Math.sin(t*2.3+j)+.013*u*u*t;
        const reach=.018+radius*(t-.44*u*u*lip)+.007*flute*lip;
        const scallop=.010*Math.cos(6.1*u+j*.72)*lip+.004*Math.sin(13*u+j)*lip;
        const shoulder=height*Math.sin(t*(inner?1.50:2.0))+.026*t*t*edge+.012*flute*t*t;
        const y=(inner?.022:0)+shoulder+scallop+(j%3-1)*.026*t+.029*u*t*Math.sin(j*2.1);
        const p=at(ca*reach-sa*tangent,y,sa*reach+ca*tangent);
        const base=hue(bases[variant]),mid=hue(mids[variant]),tip=hue(tips[variant]);
        if(t<.38)tmp.copy(base).lerp(mid,t/.38);else tmp.copy(mid).lerp(tip,Math.min(1,(t-.38)*.93+(inner?.18:0)));
        row.push(vertex(p,tmp,(inner?1.06:.90)+.07*Math.sin(az*3)+.055*flute,.5+.5*u,t,1));
      }
      if(previous)connect(previous,row);previous=row;
    }
  }
  const outerCount=variant===2?5:4,innerCount=lod===0?0:fine?4:2;
  for(let j=0;j<outerCount;j++)petal(j*tau/outerCount+variant*.31,j,false);
  for(let j=0;j<innerCount;j++)petal((j+.47)*tau/innerCount+variant*.31,j+outerCount,true);
  function capsule(center,axisY,rad,length,stages,style,segments){
    const tangent=east.clone().addScaledVector(axisY,-east.dot(axisY)).normalize(),side=tangent.clone().cross(axisY);
    let prior;
    for(const [t,width,col] of stages){
      const row=[];
      for(let n=0;n<=segments;n++){
        const a=n*tau/segments,r=rad*width*(1+.055*Math.cos(a*5));
        const p=center.clone().addScaledVector(axisY,t*length).addScaledVector(tangent,Math.cos(a)*r).addScaledVector(side,Math.sin(a)*r);
        row.push(vertex(p,hue(col),.85+.14*Math.cos(a*5),n/segments,t,style));
      }
      if(prior)connect(prior,row);prior=row;
    }
  }
  const seedHead=[[0,.38,'#553c36'],[.25,.82,'#69734d'],[.70,1,'#97945e'],[1,.72,'#c4b278'],[1.03,.02,'#9a8f61']];
  capsule(at(0,.014,0),top,.040,.117,high?seedHead:[seedHead[0],seedHead[2],seedHead[4]],0,high?14:fine?6:3);
  if(high)for(let j=0;j<7;j++){
    const a=j*tau/7,ca=Math.cos(a),sa=Math.sin(a);
    const l=vertex(at(ca*.027-sa*.004,.130,sa*.027+ca*.004),hue('#ab8c45'));
    const r=vertex(at(ca*.030+sa*.004,.130,sa*.030-ca*.004),hue('#dec273'));
    index.push(l,r,vertex(at(ca*.002,.137,sa*.002),hue('#b69458')));
  }
  const pollen=high?24:medium?8:lod===1?3:0;
  for(let j=0;j<pollen;j++){
    const a=j*tau/pollen+.11*Math.sin(j*4.4),ca=Math.cos(a),sa=Math.sin(a);
    const r=.052+.026*(.5+.5*Math.sin(j*2.43)),y=.104+.040*(.5+.5*Math.sin(j*1.70));
    const w=.005,l=.011;
    const root=vertex(at(ca*r*.47,.037,sa*r*.47),hue('#3d3037'));
    const v=vertex(at(ca*r-sa*.003,y,sa*r+ca*.003),hue('#a37e4f'));
    const w0=vertex(at(ca*r+sa*.003,y,sa*r-ca*.003),hue('#b38a56'));index.push(root,v,w0);
    const left=vertex(at(ca*r-sa*l,y+.008,sa*r+ca*l),hue('#d99539'));
    const right=vertex(at(ca*r+sa*l,y+.009,sa*r-ca*l),hue('#eab958'));
    const apex=vertex(at(ca*r,y+.014,sa*r),hue('#ffdb89'));
    const edge=vertex(at(ca*(r+w),y+.007,sa*(r+w)),hue('#f1bf5d'));
    index.push(left,right,apex,left,edge,apex,right,apex,edge,left,v,edge,edge,w0,right);
  }
  if(fine){
    const a=variant*2.40+.38,ca=Math.cos(a),sa=Math.sin(a),fork=stalk(.57),length=variant===1?.30:.23;
    const branch=t=>fork.clone().add(vec(ca*length*(.49*t+.51*t*t),.32*Math.sin(2.05*t),sa*length*t));
    stem(branch,.007,high?4:2,3);
    const budAxis=vec(ca*.64,variant===1?.33:-.46,sa*.64).normalize();
    const scales=[[0,.20,'#6d7e4b'],[.20,.70,'#798954'],[.50,1,'#92a468'],[.76,.71,'#b57d68'],[1,.07,'#b56356']];
    capsule(branch(1),budAxis,.045*(variant===1?1.12:1),.138,high?scales:[scales[0],scales[2],scales[4]],.35,high?10:5);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(color,3));
  geometry.setAttribute('floral',new T.Float32BufferAttribute(floral,3));
  geometry.setIndex(index);geometry.computeVertexNormals();return geometry;
}

// Recover a local midrib for each connected leaf in the existing grass
// meshes. This supplies shading coordinates without adding any triangles.
export function grassCoordinates(T,geometry){
  const p=geometry.attributes.position,indices=geometry.index.array,parents=Array.from({length:p.count},(_,i)=>i);
  function root(i){while(i!==parents[i])i=parents[i];return i}
  for(let i=0;i<indices.length;i+=3){
    const a=root(indices[i]);parents[root(indices[i+1])]=a;parents[root(indices[i+2])]=a;
  }
  const leaves=new Map(),uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){const key=root(i);if(!leaves.has(key))leaves.set(key,[]);leaves.get(key).push(i)}
  for(const leaf of leaves.values()){
    let ymin=Infinity,ymax=-Infinity;
    for(const i of leaf){ymin=Math.min(ymin,p.getY(i));ymax=Math.max(ymax,p.getY(i))}
    if(ymax-ymin<.16)continue; // Tiny copper blossoms keep their petal surfaces.
    const axis=new T.Vector2(),base=new T.Vector2(),tip=new T.Vector2();
    let nbase=0,ntip=0;
    for(const i of leaf){
      if(p.getY(i)<ymin+.015){base.x+=p.getX(i);base.y+=p.getZ(i);nbase++}
      if(p.getY(i)>ymax-.015){tip.x+=p.getX(i);tip.y+=p.getZ(i);ntip++}
    }
    base.multiplyScalar(1/nbase);tip.multiplyScalar(1/ntip);
    axis.subVectors(tip,base).normalize();const across=i=>-axis.y*(p.getX(i)-base.x)+axis.x*(p.getZ(i)-base.y);
    let width=.001;for(const i of leaf)width=Math.max(width,Math.abs(across(i)));
    for(const i of leaf){uv[i*2]=across(i)/width;uv[i*2+1]=1+(p.getY(i)-ymin)/(ymax-ymin)}
  }
  geometry.setAttribute('bladeUV',new T.BufferAttribute(uv,2));
}
