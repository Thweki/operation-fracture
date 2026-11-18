export function encounterEffects(T,parent,random,lentLights=[]) {
  const limit=620, particles=[], beams=[], chips=[], waves=[],freeParticles=[],freeBeams=[],freeChips=[];
  const points=new T.BufferGeometry(),positions=new Float32Array(limit*3),colors=new Float32Array(limit*3);
  const scale=new Float32Array(limit),alpha=new Float32Array(limit);
  for(const [name,arr,size] of [['position',positions,3],['tint',colors,3],['scale',scale,1],['alpha',alpha,1]]){
    points.setAttribute(name,new T.BufferAttribute(arr,size).setUsage(T.DynamicDrawUsage));
  }
  points.setDrawRange(0,0);
  const halos=new T.Points(points,new T.ShaderMaterial({transparent:true,depthWrite:false,
    blending:T.AdditiveBlending,
    vertexShader:`attribute vec3 tint;attribute float scale;attribute float alpha;varying vec3 hue;varying float opacity;
    void main(){vec4 p=modelViewMatrix*vec4(position,1.);hue=tint;opacity=alpha;
    gl_PointSize=clamp(470.*projectionMatrix[1][1]*scale/max(.2,-p.z),1.,120.);gl_Position=projectionMatrix*p;}`,
    fragmentShader:`varying vec3 hue;varying float opacity;void main(){float r=dot(gl_PointCoord-.5,gl_PointCoord-.5)*4.;
    if(r>1.)discard;gl_FragColor=vec4(hue*(2.3+2.75*exp(-22.*r)),(exp(-6.*r)+.32*exp(-20.*r))*opacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,
  }));
  halos.frustumCulled=false;halos.visible=false;halos.renderOrder=9;parent.add(halos);
  const pointAttributes=Object.values(points.attributes);
  const beamMesh=new T.InstancedMesh(new T.CylinderGeometry(1,1,1,7),
    new T.MeshBasicMaterial({color:0xffffff,toneMapped:false}),86);
  const chipMesh=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),
    new T.MeshStandardMaterial({color:0xffffff,metalness:.42,roughness:.6}),112);
  for(const m of [beamMesh,chipMesh]){
    m.setColorAt(0,new T.Color(1,1,1));m.instanceColor.setUsage(T.DynamicDrawUsage);
    m.count=0;m.visible=false;m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;parent.add(m);
  }
  const waveform=new T.TorusGeometry(1,.012,5,96),waveMat=new T.MeshBasicMaterial({transparent:true,depthWrite:false});
  for(let i=0;i<8;i++){
    const mesh=new T.Mesh(waveform,waveMat.clone());mesh.visible=false;parent.add(mesh);
    waves.push({mesh,life:0,total:1,radius:1});
  }
  const lights=[0,1].map(i=>{
    const object=lentLights[i]??new T.PointLight(0xffffff,0,9,2);
    const home=lentLights[i]?{parent:object.parent,position:object.position.clone(),color:object.color.clone(),distance:object.distance,intensity:object.intensity}:null;
    if(!home)parent.add(object);
    return {object,home,life:0,power:0,duration:1,bolt:null};
  });
  // Reuse the gate lamps in the distant arena, keeping the light count and
  // the scene's lighting shader unchanged when the encounter begins.
  function borrowLights(){for(const l of lights)if(l.home)parent.add(l.object)}
  function restoreLights(){for(const {home,object} of lights)if(home){home.parent.add(object);object.position.copy(home.position);object.color.copy(home.color);object.distance=home.distance;object.intensity=home.intensity}}
  const assigned=new Set();
  const obj=new T.Object3D(),axis=new T.Vector3(0,1,0),delta=new T.Vector3(),color=new T.Color();
  const V=(x,y,z)=>new T.Vector3(x,y,z),motion=V(),zero=V(),tail=V(),coreTail=V();
  let overwritten=0;
  function particle(p,v,hue,size,life,gravity=0) {
    const item=particles.length>=limit?particles[overwritten++%limit]:(freeParticles.pop()??{p:V(),v:V(),color:new T.Color()});
    item.p.copy(p);item.v.copy(v);item.color.set(hue);item.size=size;item.life=item.total=life;item.gravity=gravity;
    if(particles.length<limit)particles.push(item);
  }
  function flash(p,hue,power=15,duration=.19) {
    // A beam hit and the machine's disintegration can share an origin in the
    // same simulation tick. Their stronger flash should occupy just one light.
    const atOrigin=lights.find(l=>l.life>0&&l.object.position.distanceToSquared(p)<.18);
    const f=atOrigin??lights.reduce((a,b)=>a.life<b.life?a:b);
    if(atOrigin&&f.object.intensity>power&&f.life>duration*.5)return;
    f.bolt=null;
    f.object.color.set(hue);f.object.position.copy(p);f.life=f.duration=duration;f.power=power;
    f.object.distance=Math.min(21,6+Math.sqrt(power)*.8);
    f.object.intensity=power;
  }
  function burst(p,hue,count,force,shards=0) {
    for(let i=0;i<count;i++){
      const phi=random()*Math.PI*2, y=random()*2-1, flat=Math.sqrt(1-y*y);
      motion.set(Math.cos(phi)*flat,y,Math.sin(phi)*flat).multiplyScalar(force*(.18+random()*.82));
      particle(p,motion,hue,.08+random()*.24,.18+random()*.63,1.1);
    }
    particle(p,zero,hue,force*.29,.23);
    for(let i=0;i<shards;i++){
      const c=chips.length>=112?chips.shift():(freeChips.pop()??{p:V(),v:V(),rotation:V(),spin:V()});
      c.p.copy(p);c.v.set(random()-.5,random()*.9,random()-.5).multiplyScalar(force*.85);
      c.rotation.set(random()*5,random()*5,random()*5);c.spin.set(random()*6-3,random()*6-3,random()*6-3);
      c.size=.07+random()*.23;c.life=.54+random()*.65;c.hue=random()<.32?'#e0c296':'#726d5d';chips.push(c);
    }
    if(shards>=10){
      // The moment the core opens, a short white-hot centre throws warm light
      // across the platform; its debris fades much more slowly than the flash.
      particle(p,zero,'#fff9e1',force*.42,.15);
      flash(p,'#ffcc87',Math.min(230,force*15),shards>20?.29:.21);
    }else flash(p,hue,Math.min(75,force*4.4));
  }
  function beam(a,b,hue,width,life) {
    const b1=beams.length>=46?beams.shift():(freeBeams.pop()??{a:V(),b:V()});
    b1.a.copy(a);b1.b.copy(b);b1.hue=hue;b1.width=width;b1.life=b1.total=life;beams.push(b1);
  }
  function wave(p,radius,hue,life,horizontal=true) {
    const w=waves.reduce((a,b)=>a.life<b.life?a:b);
    w.generation=(w.generation??0)+1;
    w.mesh.visible=true;w.mesh.position.copy(p);w.mesh.material.color.set(hue);
    w.mesh.rotation.set(horizontal?Math.PI*.5:random()*2,0,horizontal?0:random()*3);
    w.mesh.scale.setScalar(.1);w.mesh.material.opacity=1;w.radius=radius;w.life=w.total=life;w.warning=false;
  }
  function warning(p,radius,hue,life) {
    const w=waves.reduce((a,b)=>a.life<b.life?a:b);
    const generation=w.generation=(w.generation??0)+1;
    w.mesh.visible=true;w.mesh.position.copy(p);w.mesh.material.color.set(hue);
    w.mesh.rotation.set(Math.PI*.5,0,0);w.mesh.scale.setScalar(radius);
    w.mesh.material.opacity=.85;w.radius=radius;w.life=w.total=life;w.warning=true;
    return ()=>{if(w.generation===generation){w.life=0;w.mesh.visible=false;}};
  }
  // The signal travels along the three survey conduits and radial joints in
  // the pavement. Build their terrain-conforming ribbons once per arena and
  // animate their light in the shader, keeping the center of the sight clear.
  const signalMat=new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{progress:{value:0},mode:{value:0},still:{value:0},tone:{value:new T.Color()}},
    vertexShader:`
      attribute vec4 conduit;varying vec4 wire;
      void main(){wire=conduit;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `,
    fragmentShader:`
      varying vec4 wire;uniform float progress;uniform float mode;uniform float still;uniform vec3 tone;
      void main(){
        float r=wire.x, ang=wire.y, ring=wire.z;
        float x=mix(1.0-progress,progress,step(.5,mode));
        float head=exp(-abs(r-x)*18.0);
        float trail=exp(-abs(r-x-(mode<.5?.12:-.12))*8.5)*.34;
        float gate=.28+.72*pow(.5+.5*cos(ang*3.0-progress*3.7),2.0);
        float field=(head+trail)*(1.0-ring*.25)+ring*gate*.19;
        float envelope=smoothstep(0.,.10,progress)*(1.-smoothstep(.73,1.,progress));
        float edge=1.-smoothstep(.40,1.,abs(wire.w));
        float strength=mix(field*envelope,.19*envelope,still);
        if(strength<.012)discard;
        gl_FragColor=vec4(tone*(1.25+2.3*strength),min(.90,strength*edge));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const signal=new T.Mesh(new T.BufferGeometry(),signalMat);signal.name='North court relay conduits';
  signal.visible=false;signal.renderOrder=2;parent.add(signal);
  const courtCenter=V(),routeEnds=[],courtAngles=[-2.56,-.69,1.95];
  let courtReady=false,signalTime=0,signalTotal=1;
  function placeCourt(center,heightAt) {
    const y=heightAt(center.x,center.z);
    if(courtReady&&center.x===courtCenter.x&&center.z===courtCenter.z&&courtCenter.y===y)return;
    courtCenter.set(center.x,y,center.z);courtReady=true;routeEnds.length=0;
    const p=[],data=[],index=[];
    function pair(r,a,tangentX,tangentZ,width,ring) {
      const x=center.x+Math.cos(a)*r,z=center.z+Math.sin(a)*r;
      for(const s of [-1,1]){
        const px=x+s*tangentX*width,pz=z+s*tangentZ*width;
        p.push(px,heightAt(px,pz)+.30,pz);data.push(r/30,a,ring,s);
      }
    }
    function join(start,count){
      for(let i=0;i<count-1;i++){const n=start+i*2;index.push(n,n+1,n+2,n+1,n+3,n+2);}
    }
    for(const a of courtAngles){
      const co=Math.cos(a),si=Math.sin(a);
      for(const side of [-1,1]){
        const start=p.length/3;
        for(let i=0;i<=30;i++){
          const r=1.2+i*.96,offset=side*.12,ca=a+Math.atan2(offset,r);
          pair(Math.hypot(r,offset),ca,-si,co,.053,0);
        }
        join(start,31);
      }
      const x=center.x+co*24,z=center.z+si*24;routeEnds.push(V(x,heightAt(x,z)+.35,z));
    }
    for(const [r,segments] of [[9,42],[22,76],[30,96]]){
      for(let i=0;i<segments;i++){
        if(i%13===5||i%13===6)continue;
        const start=p.length/3,a=i*Math.PI*2/segments,b=(i+.92)*Math.PI*2/segments;
        pair(r,a,Math.cos(a),Math.sin(a),r===22?.117:.087,1);
        pair(r,b,Math.cos(b),Math.sin(b),r===22?.117:.087,1);join(start,2);
      }
    }
    const g=new T.BufferGeometry().setIndex(index);
    g.setAttribute('position',new T.Float32BufferAttribute(p,3));
    g.setAttribute('conduit',new T.Float32BufferAttribute(data,4));g.computeBoundingSphere();
    signal.geometry.dispose();signal.geometry=g;
  }
  function relay(mode,waveIndex,duration,reduced) {
    if(!courtReady)return;
    signalTime=signalTotal=duration;signal.visible=true;
    const u=signalMat.uniforms,release=mode==='release';
    u.progress.value=0;u.mode.value=mode==='gather'?0:1;
    u.tone.value.set(release?'#91e2cd':waveIndex===3?'#e5a171':waveIndex===2?'#d8bc87':'#a6d7c9');
    u.still.value=reduced?1:0;
    if(reduced||mode==='open')return;
    // Current vents out of the perimeter joints after the final machine falls.
    // During a regroup it draws the same small glints back toward the center.
    for(let j=0;j<routeEnds.length;j++)for(let i=0;i<(release?6:3);i++){
      const a=courtAngles[j],sgn=i%2?1:-1,t=i*.33;
      const start=routeEnds[j];
      tail.set(start.x+Math.cos(a)*t,start.y+.07+(i%3)*.07,start.z+Math.sin(a)*t);
      motion.set(Math.cos(a)*(release?1.15:-1.0)-Math.sin(a)*sgn*.28,.35+t*.35,
        Math.sin(a)*(release?1.15:-1.0)+Math.cos(a)*sgn*.28);
      particle(tail,motion,release?'#a1e6ce':'#e4c79d',.16+.025*i,release?1.10:.84,.23);
    }
  }
  function crown(p,heading,horizontal,radius,reduced) {
    if(reduced)return;
    // Only the two outer shoulders and upper keystone light up. The eye and
    // its approach corridor stay unobstructed and the arcs face the observer.
    const base=V().copy(p).addScaledVector(heading,radius*.41);
    function at(a,r,z,out){
      return out.copy(base).addScaledVector(horizontal,Math.cos(a)*r)
        .addScaledVector(axis,Math.sin(a)*r).addScaledVector(heading,z);
    }
    for(const [from,to,scale] of [[.17,.86,1.13],[1.28,1.85,.99],[2.28,2.97,1.13]]){
      for(let k=0;k<5;k++){
        const a=from+(to-from)*k/5,b=from+(to-from)*(k+.92)/5;
        at(a,radius*scale,(k-2)*.055,tail);at(b,radius*scale,(k-1)*.055,coreTail);
        beam(tail,coreTail,'#dbb47a',.024,.46+.093*k);
        if(k%2===0){
          at(b,radius*(scale+.045),(k-1)*.055,motion);
          beam(coreTail,motion,'#9cd6c5',.019,.44+.093*k);
        }
      }
    }
  }
  function upload(active,attribute) {
    if(!active||!attribute)return;
    const count=active*attribute.itemSize,range=attribute.updateRanges[0];
    if(range)range.count=count;else attribute.addUpdateRange(0,count);
    attribute.needsUpdate=true;
  }
  function instanced(mesh,count) {
    mesh.visible=count>0;mesh.count=count;
    upload(count,mesh.instanceMatrix);upload(count,mesh.instanceColor);
  }
  function tick(dt,bolts,charges,observer,reduced=false) {
    if(signalTime>0){
      signalTime=Math.max(0,signalTime-dt);signal.visible=signalTime>0;
      signalMat.uniforms.progress.value=1-signalTime/signalTotal;
      signalMat.uniforms.still.value=reduced?1:0;
    }
    let count=0;
    function writeDot(p,hue,size,opacity){
      if(count>=limit)return;
      const o=count*3;
      positions[o]=p.x;positions[o+1]=p.y;positions[o+2]=p.z;
      colors[o]=hue.r;colors[o+1]=hue.g;colors[o+2]=hue.b;
      scale[count]=size;alpha[count++]=opacity;
    }
    for(const b of bolts)writeDot(b.p,color.set(b.hue),b.width*8,1.4);
    for(const c of charges)writeDot(c.p,color.set(c.hue??'#ff7849'),.39+c.amount*c.amount*2.1,.9);
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];p.life-=dt;
      if(p.life<=0){particles[i]=particles[particles.length-1];particles.pop();freeParticles.push(p);continue;}
      p.p.addScaledVector(p.v,dt);p.v.y-=p.gravity*dt;const t=p.life/p.total;
      writeDot(p.p,p.color,p.size*(.32+.68*t),Math.min(1.5,2*t));
    }
    for(const a of pointAttributes)upload(count,a);
    points.setDrawRange(0,count);halos.visible=count>0;
    let n=0;
    function line(a,b,hue,width){
      if(n>=86)return;
      delta.subVectors(b,a);const length=delta.length();if(length<.002)return;
      obj.position.copy(a).lerp(b,.5);obj.quaternion.setFromUnitVectors(axis,delta.multiplyScalar(1/length));
      obj.scale.set(width,length,width);obj.updateMatrix();beamMesh.setMatrixAt(n,obj.matrix);
      beamMesh.setColorAt(n++,color.set(hue).multiplyScalar(3.8));
    }
    for(const b of bolts){
      tail.copy(b.p).addScaledVector(b.dir,-b.width*7.2);
      coreTail.copy(b.p).addScaledVector(b.dir,-b.width*2);
      line(tail,b.p,b.hue,b.width*.82);line(coreTail,b.p,'#fff2cd',b.width);
    }
    for(let i=beams.length-1;i>=0;i--){
      const b=beams[i];b.life-=dt;
      if(b.life<=0){beams[i]=beams[beams.length-1];beams.pop();freeBeams.push(b);continue;}
      line(b.a,b.b,b.hue,b.width*Math.min(1,1.7*b.life/b.total));
    }
    instanced(beamMesh,n);
    n=0;
    for(let i=chips.length-1;i>=0;i--){
      const c=chips[i];c.life-=dt;
      if(c.life<=0){chips[i]=chips[chips.length-1];chips.pop();freeChips.push(c);continue;}
      c.p.addScaledVector(c.v,dt);c.v.y-=9.7*dt;c.rotation.addScaledVector(c.spin,dt);
      obj.position.copy(c.p);obj.rotation.set(c.rotation.x,c.rotation.y,c.rotation.z);
      const s=c.size*Math.min(1,c.life*4);obj.scale.set(s*1.7,s*.62,s);obj.updateMatrix();chipMesh.setMatrixAt(n,obj.matrix);
      chipMesh.setColorAt(n++,color.set(c.hue));
    }
    instanced(chipMesh,n);
    for(const w of waves){
      if(w.life<=0)continue;w.life-=dt;w.mesh.visible=w.life>0;
      const t=1-Math.max(0,w.life/w.total);
      if(w.warning){w.mesh.scale.setScalar(w.radius*(1.06-.06*t));w.mesh.material.opacity=.46+.47*t;}
      else{w.mesh.scale.setScalar(.13+w.radius*(1-(1-t)**1.6));w.mesh.material.opacity=.82*Math.pow(1-t,.72);}
    }
    assigned.clear();
    for(const l of lights){
      l.life=Math.max(0,l.life-dt);
      if(l.life>0){l.object.intensity=l.power*(l.life/l.duration)**2;continue;}
      let best=null,bestScore=Infinity;
      for(const bolt of bolts){
        if(assigned.has(bolt))continue;
        let score=observer?bolt.p.distanceToSquared(observer):bolt.life;
        // Keep the source on the same projectile unless another one becomes
        // appreciably closer, avoiding colour pops when a salvo crosses itself.
        if(bolt===l.bolt)score*=.70;
        for(const other of assigned)if(bolt.p.distanceToSquared(other.p)<12)score+=80;
        if(score<bestScore){best=bolt;bestScore=score;}
      }
      l.bolt=best;
      if(!best){l.object.intensity=0;continue;}
      assigned.add(best);l.object.position.copy(best.p);l.object.color.set(best.hue);
      l.object.distance=best.width>.16?18:15;
      l.object.intensity=(best.width>.16?155:108)*(.95+.05*Math.sin(best.life*21));
    }
  }
  function clear(){
    freeParticles.push(...particles);freeBeams.push(...beams);freeChips.push(...chips);
    particles.length=beams.length=chips.length=0;instanced(beamMesh,0);instanced(chipMesh,0);
    points.setDrawRange(0,0);halos.visible=false;
    signalTime=0;signal.visible=false;
    assigned.clear();
    for(const l of lights){l.life=l.object.intensity=0;l.bolt=null;}for(const w of waves){w.life=0;w.mesh.visible=false;}
  }
  return {burst,particle,beam,wave,warning,flash,tick,clear,borrowLights,restoreLights,placeCourt,relay,crown};
}
