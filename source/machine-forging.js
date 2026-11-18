// Local +Z faces the observer. Each blueprint is forged into a solid hull,
// a single moving assembly, and a single luminous circuit for the whole unit.
export function forgeMachine(T, kind, hull, dial, light) {
  const pi=Math.PI, up=new T.Vector3(0,1,0);
  const dark='#26353a', seam='#364244', steel='#667777', ivory='#d8cfac', brass='#bda570';
  function ball(batch,p,size,hue){
    batch.put(new T.SphereGeometry(1,14,8),p,size,null,hue);
  }
  function box(batch,p,size,hue,rot){
    batch.put(new T.BoxGeometry(...size),p,[1,1,1],rot,hue);
  }
  function tube(batch,a,b,start,end,hue,sides=10){
    const v=new T.Vector3(...a),d=new T.Vector3(...b).sub(v),length=d.length();
    batch.put(new T.CylinderGeometry(end,start,length,sides),v.addScaledVector(d,.5).toArray(),
      [1,1,1],new T.Quaternion().setFromUnitVectors(up,d.normalize()),hue);
  }
  function cable(batch,points,width,hue){
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    batch.put(new T.TubeGeometry(curve,Math.max(6,points.length*2),width,5,false),[0,0,0],[1,1,1],null,hue);
  }
  function turned(batch,p,profile,hue,angle=0,segments=16){
    const coords=profile.map(([r,y])=>new T.Vector2(r,y));
    batch.put(new T.LatheGeometry(coords,segments),p,[1,1,1],[angle,0,0],hue);
  }
  function optic(x,y,z,r,glow){
    const p=[x,y,z];
    turned(hull,p,[[0,-.12*r],[r*.89,-.14*r],[r,0],[r*.91,.12*r],[r*.81,.16*r],[r*.78,.12*r]],brass,pi/2);
    ball(hull,[x,y,z+.04*r],[r*.86,r*.86,r*.18],dark);
    ball(light,[x,y,z+.18*r],[r*.62,r*.59,r*.25],glow);
    ball(light,[x-.12*r,y+.18*r,z+.38*r],[r*.14,r*.085,r*.04],'#ffffef');
  }
  function lensSlit(x,y,z,w,h,glow){
    ball(hull,[x,y,z],[w,h,.10],dark);
    ball(light,[x,y,z+.062],[w*.83,h*.44,.063],glow);
  }
  function fins(batch,x,y,z,width,n,hue){
    for(let i=0;i<n;i++)box(batch,[x,y-i*.09,z+i*.007],[width*(1-i*.042),.031,.078],hue,[-.18,0,0]);
  }
  const signs=[-1,1];
  if(kind==='skirmisher'){
    // Broad delta planform with a narrow waist; three gill openings are cut
    // between the leading plates and the dark, swept flight membranes.
    ball(hull,[0,.02,.02],[.31,.265,.78],dark);
    for(const s of signs){
      hull.carapace([[.09,.16,.59],[.24,-.09,.52],[.47,-.085,.08],[1.27,-.28,-.31],
        [1.63,-.04,-.91],[1.06,.16,-.42],[.43,.29,-.20]],
        [.49,.16,.245],.078,['#637574','#c8c2a5','#b9a279','#89968c','#d9d8c1','#7c867b'],s);
      hull.carapace([[.28,.01,-.22],[.46,-.14,-.74],[1.14,-.38,-1.0],[.99,-.16,-.70],[.58,-.02,-.40]],
        [.55,-.10,-.54],.054,['#484e51','#748082','#959e8e'],s);
      hull.carapace([[.16,.18,-.37],[.24,.21,-.86],[.51,.62,-1.0],[.49,.65,-.88],[.37,.40,-.38]],
        [.35,.44,-.68],.07,['#5d6a6e','#b0b3a5','#a6a38c'],s);
      tube(hull,[s*.358,-.12,-.06],[s*.47,-.14,-.73],.16,.19,steel);
      tube(light,[s*.47,-.14,-.74],[s*.49,-.14,-.96],.133,.065,'#6cfff4');
      for(let j=0;j<3;j++)tube(hull,[s*(.60+j*.13),.102-j*.034,.04-j*.13],
        [s*(.80+j*.13),.047-j*.032,-.08-j*.13],.021,.009,seam,5);
      hull.carapace([[.58,.22,-.075],[.75,.18,-.16],[1.27,.028,-.61],[1.12,.116,-.46],[.69,.25,-.127]],
        [.84,.192,-.234],.030,['#a54f3d','#be6851','#a25542'],s);
      tube(hull,[s*.38,.18,.36],[s*.48,.185,.13],.040,.021,brass,7);
      light.rod([s*.74,.142,-.17],[s*1.28,.018,-.60],.019,'#ed7256');
    }
    hull.carapace([[-.22,.13,.44],[0,-.08,.92],[.22,.13,.44],[.16,.29,-.18],[-.16,.29,-.18]],
      [0,.27,.48],.06,['#727b78','#d0bca0','#a8a799','#706d61']);
    lensSlit(0,.04,.69,.19,.11,'#ff714d');
    for(const s of signs){
      tube(dial,[s*.17,-.12,.12],[s*.23,-.16,.64],.08,.061,dark);
      tube(light,[s*.23,-.16,.59],[s*.23,-.16,.67],.044,.042,'#ff6d46');
    }
  }else if(kind==='lancer'){
    // A heron-like hull between exposed parallel accelerator rails.
    ball(hull,[0,.03,-.22],[.34,.61,.44],seam);
    for(const s of signs){
      hull.carapace([[.14,.51,-.12],[.35,.02,.24],[.68,-.32,-.02],[.60,.35,-.39],
        [.68,.98,-.58],[.52,1.19,-.71],[.36,.64,-.40]],
        [.42,.46,-.06],.11,['#989b82','#455b56','#97a184','#d1c5a2','#9c825c'],s);
      tube(hull,[s*.32,-.05,-.18],[s*.46,-.29,.15],.145,.12,brass);
      tube(dial,[s*.46,-.29,-.2],[s*.46,-.29,.48],.142,.12,dark);
      tube(dial,[s*.46,-.29,.43],[s*.46,-.29,1.33],.094,.071,ivory,8);
      tube(dial,[s*.46,-.29,1.18],[s*.46,-.29,1.38],.101,.085,seam,8);
      tube(dial,[s*.46,-.29,1.38],[s*.46,-.29,1.385],.055,.055,'#d89554',8);
      for(let j=0;j<4;j++)
        tube(dial,[s*.46,-.29,.04+j*.14],[s*.46,-.29,.09+j*.14],.15-j*.006,.14-j*.006,brass,8);
      cable(hull,[[s*.24,-.20,-.38],[s*.36,-.61,-.34],[s*.48,-.54,.01],[s*.46,-.37,.22]],.032,seam);
      box(hull,[s*.24,.02,.27],[.12,.16,.08],brass,[.16,0,s*.14]);
      hull.carapace([[.12,-.27,-.01],[.12,-.72,.01],[.29,-1.25,-.30],[.44,-1.38,-.56],[.38,-.68,-.49]],
        [.29,-.64,-.12],.074,['#4d6760','#95aa8b','#b1b393','#566e62'],s);
      light.rod([s*.39,.43,-.029],[s*.49,.72,-.25],.022,'#d8a8ff');
    }
    optic(0,.215,.245,.25,'#e4adff');
    tube(hull,[0,.5,-.26],[-.028,1.53,-.71],.075,.011,brass,6);
    light.rod([0,-.14,.25],[0,-.37,.20],.030,'#dbb1ff');
  }else if(kind==='weaver'){
    // A porcelain bell suspends paired articulated tines and optical fibres.
    turned(hull,[0,.10,-.12],[[.09,.32],[.56,.31],[.70,.40],[.66,.55],[.48,.72],[.22,.78],[0,.81]],'#d0c5b4');
    turned(hull,[0,.10,-.12],[[.17,-.12],[.41,.08],[.62,.18],[.69,.32],[.61,.37]],'#616268');
    turned(hull,[0,.10,-.12],[[.658,.36],[.689,.372],[.689,.39],[.670,.399]],brass);
    for(let i=0;i<7;i++){
      const a=2*pi*i/7+.25,co=Math.cos(a),si=Math.sin(a),m=i%2;
      const v=(r,y,t=0)=>[co*r-si*t,y,si*r+co*t-.12];
      const root=v(.45,.31),joint=v(.83,.08),elbow=v(.95,-.24),wrist=v(.55,-.56-m*.11),tip=v(.69,-.94-m*.12);
      tube(hull,root,joint,.11,.084,brass,7);ball(hull,joint,[.13,.12,.13],'#74717e');
      tube(hull,joint,elbow,.089,.055,ivory,7);
      tube(hull,elbow,wrist,.057,.042,'#727f82',7);tube(hull,wrist,tip,.047,.008,ivory,7);
      ball(light,elbow,[.047,.047,.047],'#8fffd0');
      cable(dial,[v(.23,.16),v(.35,-.27,.09),v(.28,-.65,.20),v(.17,-1.12-m*.22,.22)],.016,'#abb5bc');
      cable(hull,[v(.075,.901),v(.294,.864),v(.474,.807),v(.619,.692),v(.666,.618)],.014,'#998980');
      tube(hull,v(.576,.441),v(.686,.52),.053,.034,'#877b70',7);
    }
    ball(hull,[0,-.015,.02],[.30,.35,.29],dark);
    turned(hull,[0,.885,-.12],[[0,-.025],[.102,-.027],[.128,0],[.100,.042],[.027,.055]],brass);
    optic(0,.023,.278,.20,'#7dffd4');
    for(const s of signs){
      ball(light,[s*.38,.46,.402],[.088,.04,.045],'#b1ffe0');
      tube(hull,[s*.18,.79,-.12],[s*.38,1.11,-.28],.049,.010,'#a3998d',6);
    }
  }else if(kind==='mortar'){
    // A counterweighted artillery crab: two emitter sockets above a squat
    // gearbox, four outriggers below and a cooling rack across the belly.
    box(hull,[0,-.12,-.11],[1.19,.52,.94],dark);
    for(const s of signs){
      hull.carapace([[.10,.26,.38],[.24,-.16,.54],[.81,-.29,.45],[1.02,-.07,.06],
        [.83,.29,-.25],[.28,.36,-.05]],[.58,.22,.53],.19,
        ['#ad7152','#a89977','#6b6152','#cf9364','#806e54'],s);
      for(const z of [-.48,.32]){
        const a=[s*.56,-.19,z],b=[s*1.13,-.12,z-.06],c=[s*1.31,-.63,z+.03];
        tube(hull,a,b,.14,.17,steel,7);ball(hull,b,[.19,.15,.16],'#776c58');
        tube(hull,b,c,.15,.071,'#ad9b79',7);box(hull,[c[0],c[1]-.022,c[2]+.04],[.25,.09,.28],dark);
      }
      const barrel=[s*.35,.22,-.03];
      turned(dial,barrel,[[.13,-.36],[.22,-.30],[.23,.12],[.28,.22],[.29,.42],[.21,.47],[.158,.43],[.158,.24]],
        '#969a89',.68,14);
      const cap=[s*.35,.22+.33*Math.cos(.68),-.03+.33*Math.sin(.68)];
      turned(dial,cap,[[.03,-.11],[.15,-.10],[.158,.067]],dark,.68,14);
      const ember=[s*.35,.22+.314*Math.cos(.68),-.03+.314*Math.sin(.68)];
      turned(light,ember,[[.02,.002],[.103,.005],[.102,.01]],'#ff9a51',.68,12);
      for(let j=0;j<3;j++)tube(hull,[s*.94,.12-j*.092,.11],[s*.93,.12-j*.092,.37],.023,.018,seam,6);
    }
    fins(hull,0,-.25,.401,.64,4,steel);lensSlit(0,.014,.479,.24,.12,'#ffab49');
    for(let j=0;j<4;j++)box(light,[(j-1.5)*.095,-.095,.51],[.043,.024,.021],'#ff9c4a');
  }else if(kind==='tideBoss'){
    // Each overlapping feather has a folded porcelain plate, a separate
    // turquoise blade, an exposed gilt shaft and a small glowing ocellus.
    for(let i=-5;i<=5;i++){
      const a=i*.259,co=Math.cos(a),si=Math.sin(a),length=1.92-.24*Math.abs(i)/5+.10*Math.cos(i*1.8);
      const v=(t,r,z)=>[si*r+co*t,co*r-si*t-.20,z-.20*Math.abs(i)/5];
      const hues=['#397c7c','#83b7ac','#c7d6bb','#639b97','#65918b'];
      hull.carapace([v(-.059,.49,-.19),v(-.18,1.20,-.25),v(-.143,length-.12,-.49),
        v(-.018,length,-.56),v(.097,length-.095,-.49),v(.172,1.25,-.27),v(.076,.66,-.18)],
        v(.024,1.18,-.076),.065,hues);
      hull.carapace([v(-.10,1.21,-.102),v(-.082,length-.22,-.32),v(.014,length-.12,-.363),
        v(.076,length-.30,-.273),v(.059,1.16,-.086)],v(.012,1.48,-.13),.025,
        ['#337f80','#67afa2','#b3c3a1','#449a91']);
      tube(hull,v(0,.59,-.050),v(.010,length-.22,-.17),.023,.009,brass,6);
      ball(light,v(.01,length-.26,-.124),[.052,.075,.029],i%2?'#75ffe8':'#a6fff1');
    }
    turned(hull,[0,-.18,-.12],[[.12,-.68],[.38,-.49],[.47,-.14],[.39,.26],[.22,.58],[.03,.66]],'#447672');
    for(const s of signs){
      hull.carapace([[.12,.46,.17],[.16,.15,.43],[.31,-.23,.45],[.53,-.49,.20],[.78,-.35,-.15],
        [.63,.10,-.13],[.40,.46,-.08]],[.37,.12,.54],.15,['#90b0a7','#4c8882','#d0d4b8','#7c9a8e'],s);
      tube(hull,[s*.42,-.25,-.02],[s*1.10,-.45,-.14],.13,.105,'#718f83');
      hull.carapace([[.85,-.34,.01],[1.04,-.55,.17],[1.43,-.82,.19],[1.69,-.76,.06],
        [1.27,-.42,-.12]],[1.20,-.49,.19],.09,['#91ada0','#45847e','#d8cba3','#698b84'],s);
      for(let j=0;j<3;j++){
        const l=j*.115;
        cable(dial,[[s*(.20+l),-.34,-.08],[s*(.32+l),-.90,.04],[s*(.16+l),-1.26,-.14],
          [s*(.38+l),-1.55+j*.12,-.32]],.030-j*.004,'#7cada6');
      }
    }
    optic(0,.052,.46,.33,'#75fff3');
    for(const s of signs)optic(s*.34,.32,.35,.094,'#b5fff8');
    light.rod([0,-.38,.34],[0,-.64,.17],.033,'#87ffee');
  }else if(kind==='forgeBoss'){
    // A riveted furnace with side flywheels, flared chimneys and wide gantry
    // feet. The crucible glows through individual slats in the chest grille.
    box(hull,[0,-.06,-.14],[1.68,1.32,1.11],dark);
    turned(hull,[0,-.05,.25],[[.46,-.82],[.65,-.54],[.62,.35],[.45,.57]],'#655e4d');
    for(const s of signs){
      hull.carapace([[.48,.59,.33],[.62,.06,.58],[1.04,-.16,.62],[1.62,.12,.33],
        [1.71,.46,-.12],[1.45,.79,-.35],[.77,.79,-.13]],
        [1.10,.55,.64],.26,['#95503b','#c27c4e','#ad7953','#684f40','#b29369','#a05e41'],s);
      hull.carapace([[.66,-.31,.49],[.59,-1.04,.45],[1.14,-1.37,.17],[1.59,-1.19,-.23],
        [1.40,-.70,-.35],[1.05,-.23,-.16]],[1.01,-.73,.54],.19,
        ['#805744','#ab8b62','#5d6258','#786e54','#a2704f'],s);
      for(let j=0;j<2;j++){
        const x=s*(.60+j*.39),y=.48-j*.13,z=-.39-j*.17,angle=-.15-j*.09;
        turned(hull,[x,y,z],[[.17,-.18],[.23,.02],[.18,.19],[.19,.68],[.26,.77],[.26,.90],[.16,.90],[.15,.73]],'#817967',angle,12);
        turned(light,[x,y,z],[[.10,.77],[.153,.79],[.148,.805]],'#ff933c',angle,12);
      }
      const wheel=[s*1.42,-.24,-.14];
      hull.put(new T.CylinderGeometry(.46,.46,.33,16),wheel,[1,1,1],[0,0,pi/2],seam);
      for(let j=0;j<3;j++)tube(hull,[s*(1.23+j*.10),-.24,-.14],[s*(1.28+j*.10),-.24,-.14],.49,.49,brass,16);
      for(let j=0;j<4;j++)tube(hull,[s*(.79+j*.168),.49,.64-j*.014],[s*(.79+j*.168),.54,.67-j*.014],.037,.036,'#d3b480',7);
      cable(hull,[[s*.55,-.62,-.36],[s*1.16,-.84,-.43],[s*1.35,-.61,-.16]],.082,dark);
      box(hull,[s*.80,-1.25,-.08],[.74,.24,.76],seam);
    }
    turned(hull,[0,-.13,.833],[[.35,-.16],[.50,-.09],[.525,.034],[.50,.085],[.434,.091],[.403,.035]],
      '#a88355',pi/2,24);
    ball(hull,[0,-.13,.892],[.447,.447,.048],dark);
    ball(light,[0,-.13,.92],[.403,.397,.044],'#ff7026');
    ball(light,[.033,-.156,.952],[.177,.235,.029],'#ffd66a');
    for(let j=-2;j<=2;j++){
      const y=-.13+j*.126,span=.445*Math.sqrt(1-(j*.31)**2);
      tube(hull,[-span,y,.984],[span,y,.984],.028,.031,'#514e44',8);
    }
    for(let j=0;j<8;j++){const a=j*pi/4+.18;
      tube(hull,[.478*Math.cos(a),-.13+.478*Math.sin(a),.896],
        [.478*Math.cos(a),-.13+.478*Math.sin(a),.927],.030,.030,brass,6);
    }
    turned(dial,[0,.60,.03],[[.30,-.13],[.39,-.07],[.35,.11],[.28,.39],[.13,.48]],'#997a53');
    lensSlit(0,.78,.316,.24,.084,'#fff090');
    for(const s of signs)light.rod([s*.78,.24,.59],[s*1.24,.32,.55],.024,'#ff9251');
  }else if(kind==='warden'){
    // A ceremonial gate in miniature. The still uprights frame a hollow
    // armillary, and three gilded shoes suspend the rotating inner cage.
    for(const s of signs){
      const x=s*1.34;
      hull.carapace([[1.14,-1.23,.13],[1.03,-.82,.28],[1.14,.67,.30],[1.41,1.05,.095],
        [1.50,.56,-.18],[1.49,-.97,-.24]],[1.30,-.18,.42],.23,
        ['#8b8c7e','#bdaf83','#bfbea0','#746c56','#68746b','#a49c77'],s);
      for(let j=0;j<6;j++)box(hull,[x,-.71+j*.235,.26],[.39,.048,.24],j%2?brass:seam,[0,0,s*.08]);
      tube(hull,[s*1.14,-.99,-.25],[s*.73,-1.47,-.20],.148,.097,steel,8);
      hull.carapace([[.84,-1.17,-.10],[.57,-1.57,-.17],[.47,-1.83,-.36],[.76,-1.72,-.44],
        [.98,-1.35,-.34]],[.75,-1.48,.038],.1,['#c5ba92','#7c8479','#a09c7c'],s);
      tube(hull,[s*1.28,.63,-.21],[s*.94,1.49,-.34],.10,.08,'#858779');
      hull.carapace([[1.12,.91,-.06],[.85,1.38,-.13],[.65,1.80,-.29],[.89,1.68,-.43],
        [1.32,1.13,-.33]],[.99,1.34,.015],.11,[brass,ivory,'#7b806e'],s);
      light.rod([s*1.22,-.51,.384],[s*1.24,.55,.409],.028,'#fcdb87');
      hull.carapace([[.06,1.19,-.29],[.69,1.10,-.22],[1.12,.68,-.18],[1.23,.89,-.28],
        [.76,1.31,-.39],[.14,1.42,-.41]],[.66,1.24,-.12],.15,
        ['#84785d','#b3ab82','#939679','#a89871'],s);
      for(let j=0;j<7;j++){
        const a=.56+j*.095,r=.971;
        tube(hull,[s*Math.cos(a)*r,Math.sin(a)*r,-.30],[s*Math.cos(a)*(r+.092),Math.sin(a)*(r+.092),-.28],
          .013,.021,'#c8bc8f',5);
      }
    }
    for(let i=0;i<8;i++){
      const a=i*pi/4+.055;
      hull.torus(1.16,.090,-.29,i%2?brass:'#8f8b72',a,.665);
      dial.torus(.90,.061,.04,ivory,a+.04,.58);
      const x=Math.cos(a),y=Math.sin(a);
      tube(dial,[x*.81,y*.81,.005],[x*1.01,y*1.01,.022],.045,.068,brass,7);
      if(i%2===0)ball(light,[1.12*x,1.12*y,-.15],[.052,.052,.07],'#ffe2a1');
    }
    dial.put(new T.TorusGeometry(.66,.054,6,42),[0,0,.04],[1,1,1],[.93,-.33,.38],brass);
    dial.put(new T.TorusGeometry(.62,.044,6,42),[0,0,.06],[1,1,1],[.38,.87,-.57],ivory);
    dial.put(new T.TorusGeometry(.48,.041,5,38),[0,0,.04],[1,1,1],[.87,.69,.35],steel);
    dial.put(new T.OctahedronGeometry(1,0),[0,0,.055],[.272,.412,.248],[.12,.39,.12],dark);
    light.put(new T.OctahedronGeometry(1,0),[0,0,.245],[.133,.27,.136],[.12,.39,.12],'#ffe4a6');
    for(let j=0;j<3;j++){
      const a=j*2*pi/3,x=Math.cos(a),y=Math.sin(a);
      tube(hull,[x*.91,y*.91,-.28],[x*.56,y*.56,-.56],.060,.044,seam,8);
    }
  }
}
