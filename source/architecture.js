// The observatory is assembled from the same radial sections as a physical gate.
// Static pieces share vertex-coloured geometry so that all the little inlays and
// fasteners don't turn into separate draw calls.
export function buildArchitecture(THREE, scene) {
  let seed = 0x223ab134;
  function random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const between = (a, b) => a + (b - a) * random();
  const tau = Math.PI * 2;
  const identity = (x, y, z) => [x, y, z];
  const stone = ['#aca587', '#99977c', '#a9a58a', '#b6ae8b', '#939581'];
  const bronze = ['#ad9164', '#9e8765', '#bd9e72', '#ad997c', '#958970'];
  const ceramic = ['#d5cab2', '#c2b99e', '#d8c9a6', '#bdba9e'];
  const iron = ['#535653', '#5c625c', '#51594f', '#656454', '#454b46'];
  const moss = ['#68714b', '#85915a', '#98a16a', '#646c40', '#a2a26e'];
  const choose = palette => palette[Math.floor(random() * palette.length)];

  // A seamless, deterministic surface at architectural scale. Large stains,
  // mineral flecks, pits and machining scratches survive different view ranges.
  function weathering() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(size, size);
    const grids = [4, 11, 35, 107].map(n => {
      const base=new Uint16Array(size),next=new Uint16Array(size),weight=new Float32Array(size);
      for(let i=0;i<size;i++){const u=i*n/size;const f=u-Math.floor(u);base[i]=Math.floor(u);next[i]=(base[i]+1)%n;weight[i]=f*f*(3-2*f)}
      return {n,v:Float32Array.from({length:n*n},random),base,next,weight};
    });
    const height=new Float32Array(size*size);
    function sample({ n, v, base, next, weight }, x, y) {
      const a=weight[x],b=weight[y],row=base[y]*n,other=next[y]*n;
      return (v[row+base[x]]*(1-a)+v[row+next[x]]*a)*(1-b)+(v[other+base[x]]*(1-a)+v[other+next[x]]*a)*b;
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const large = sample(grids[0], x, y);
        const medium = sample(grids[1], x, y);
        const fleck = sample(grids[2], x, y);
        const pits = sample(grids[3], x, y);
        const stain = Math.max(0, 0.48 - large * 0.48 - medium * 0.52);
        const crystal=random(),vein=Math.pow(Math.max(0,Math.cos(y*.093+medium*9.1+large*3.1+fleck*.9)),19);
        const pore=Math.max(0,.32-pits)*Math.max(0,.68-fleck)*6;
        const v = 166 + large * 32 + medium * 27 + fleck * 22 + crystal * 16 + vein*12-pore*28 -
          stain * 113 - (pits < 0.22 ? (0.22 - pits) * 162 : 0);
        const i = (y * size + x) * 4;
        image.data[i] = v + 2;
        image.data[i + 1] = v + stain * 23;
        image.data[i + 2] = v - 4 - stain * 19;
        image.data[i + 3] = 255;
        height[i/4]=.22*medium+.14*fleck+.18*pits+.045*crystal+.06*vein-.26*pore;
      }
    }
    ctx.putImageData(image, 0, 0);
    for (let i = 0; i < 1450; i++) {
      const x = random() * size, y = random() * size;
      ctx.strokeStyle = random() < 0.4 ? 'rgba(255,249,225,.25)' : 'rgba(44,40,30,.19)';
      ctx.lineWidth = between(0.35, 1.0);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + between(-1.8, 2.1), y + between(1.2, 9));
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    const normals=new Uint8Array(size*size*4),mask=size-1;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=(y*size+x)*4;
      const dx=(height[y*size+((x-1)&mask)]-height[y*size+((x+1)&mask)])*1.48;
      const dy=(height[((y-1)&mask)*size+x]-height[((y+1)&mask)*size+x])*1.48;
      const inv=1/Math.hypot(dx,dy,1);
      normals[i]=(dx*inv+1)*127.5;normals[i+1]=(-dy*inv+1)*127.5;normals[i+2]=(inv+1)*127.5;normals[i+3]=255;
    }
    const normal=new THREE.DataTexture(normals,size,size);normal.flipY=true;
    normal.wrapS=normal.wrapT=THREE.RepeatWrapping;normal.minFilter=THREE.LinearMipmapLinearFilter;normal.magFilter=THREE.LinearFilter;
    normal.generateMipmaps=true;normal.anisotropy=8;normal.needsUpdate=true;
    return {texture,normal};
  }

  const surface = weathering();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    map: surface.texture, normalMap:surface.normal, normalScale:new THREE.Vector2(.64,.64), vertexColors: true, roughness: 0.85, metalness: 0.16,
    side: THREE.DoubleSide,
  });
  const conductorMaterial = new THREE.MeshStandardMaterial({
    map: surface.texture, normalMap:surface.normal, normalScale:new THREE.Vector2(.31,.31), vertexColors: true, roughness: 0.47, metalness: 0.54,
    side: THREE.DoubleSide,
  });
  const leafMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const lightMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.65, 1.28, 0.72), vertexColors: true, side: THREE.DoubleSide,
  });
  const colors = new Map();
  function tint(key) {
    if (!colors.has(key)) colors.set(key, new THREE.Color(key));
    return colors.get(key);
  }

  function batch(material) {
    const positions = [], rgb = [], uv = [];
    function triangle(a, b, c, color, coords) {
      const value = tint(color);
      const points = [a, b, c];
      for (let i = 0; i < 3; i++) {
        const [x, y, z] = points[i];
        positions.push(x, y, z);
        rgb.push(value.r, value.g, value.b);
        if (coords) uv.push(coords[i][0] * 0.205, coords[i][1] * 0.205);
        else uv.push((x + z * 0.35) * 0.205, (y + z * 0.87) * 0.205);
      }
    }
    return {
      tri: triangle,
      quad(a, b, c, d, color, coords) {
        triangle(a, b, d, color, coords && [coords[0], coords[1], coords[3]]);
        triangle(b, c, d, color, coords && [coords[1], coords[2], coords[3]]);
      },
      flush(parent) {
        if (!positions.length) return;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = material === bodyMaterial;
        mesh.receiveShadow = material !== lightMaterial;
        parent.add(mesh);
      },
    };
  }
  const masonry = batch(bodyMaterial), mechanical = batch(conductorMaterial);
  const foliage = batch(leafMaterial), lamps = batch(lightMaterial);
  const stoneCut = batch(bodyMaterial), hardware = batch(conductorMaterial);
  const wallLamps = batch(lightMaterial), wallFoliage = batch(leafMaterial);

  function prism(target, polygon, zBack, zFront, color, transform = identity) {
    const front = polygon.map(([x, y]) => transform(x, y, zFront));
    const back = polygon.map(([x, y]) => transform(x, y, zBack));
    const indices = THREE.ShapeUtils.triangulateShape(polygon.map(p => new THREE.Vector2(...p)), []);
    for (const [a, b, c] of indices) {
      target.tri(front[a], front[b], front[c], color);
      target.tri(back[c], back[b], back[a], color);
    }
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      target.quad(front[j], front[i], back[i], back[j], color);
    }
  }
  function box(target, x, y, z, w, h, d, color, transform = identity) {
    prism(target, [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2],
      [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]], z - d / 2, z + d / 2, color, transform);
  }
  function frame(x, y, z, yaw = 0, lean = 0) {
    const co = Math.cos(yaw), si = Math.sin(yaw);
    return (u, v, w) => {
      const a = u + lean * v;
      return [x + a * co + w * si, y + v, z - a * si + w * co];
    };
  }
  const radial = (r, a, z) => [Math.cos(a) * r, Math.sin(a) * r, z];

  // Sweep a chamfered, closed profile through an arc. Faces are UV mapped in
  // arc length so texture density matches even on broken or very narrow plates.
  function arc(target, inner, outer, from, to, back, front, color, bevel = 0.045) {
    const ch = Math.min(bevel, (outer - inner) * 0.24, (front - back) * 0.24);
    const profile = [
      [inner + ch, front], [outer - ch, front], [outer, front - ch],
      [outer, back + ch], [outer - ch, back], [inner + ch, back],
      [inner, back + ch], [inner, front - ch],
    ];
    const steps = Math.max(1, Math.ceil((to - from) * outer / 1.3));
    const at = (p, a) => radial(p[0], a, p[1]);
    for (let i = 0; i < steps; i++) {
      const a = from + (to - from) * i / steps;
      const b = from + (to - from) * (i + 1) / steps;
      for (let j = 0; j < profile.length; j++) {
        const p = profile[j], q = profile[(j + 1) % profile.length];
        const pu = p[0] + p[1] * 0.8, qu = q[0] + q[1] * 0.8;
        target.quad(at(p, a), at(q, a), at(q, b), at(p, b), color,
          [[pu, a * outer], [qu, a * outer], [qu, b * outer], [pu, b * outer]]);
      }
    }
    for (let k = 1; k < profile.length - 1; k++) {
      target.tri(at(profile[0], from), at(profile[k + 1], from), at(profile[k], from), color);
      target.tri(at(profile[0], to), at(profile[k], to), at(profile[k + 1], to), color);
    }
  }
  function vane(target, points, a, z, depth, color) {
    const c = Math.cos(a), s = Math.sin(a);
    prism(target, points, z - depth, z, color,
      (radius, tangent, axial) => [radius * c - tangent * s, radius * s + tangent * c, axial]);
  }

  const ring = new THREE.Group();
  ring.name = 'The meridian engine';
  ring.position.set(0, 24.8, -48);
  ring.rotation.set(0.035, -0.43, -0.105, 'YXZ');
  scene.add(ring);
  const sectors = 18, sector = tau / sectors;
  const broken = new Set([2, 7, 8, 14]);
  for (let i = 0; i < sectors; i++) {
    const start = i * sector;
    const end = (i + 1) * sector;
    const a = start + 0.009, b = end - 0.009;
    const missing = broken.has(i);
    // The deep dark backing can be seen at every expansion joint and breach.
    arc(masonry, 17.12, missing ? 21.75 : 23.65, a, b, -2.9, -0.36, choose(iron), 0.27);
    arc(mechanical, 16.75, 17.8, a, b, -2.2, 1.32, choose(bronze), 0.13);
    arc(mechanical, 19.25, 19.64, a - 0.003, b + 0.003, -1.65, 0.75, choose(bronze));
    arc(mechanical, 20.8, 21.23, a - 0.003, b + 0.003, -1.75, 0.48, choose(bronze));
    arc(mechanical, 22.64, 22.95, a, b, -2.83, -1.3, choose(iron));
    if (!missing) {
      const back = between(-0.55, -0.19), face = between(1.3, 1.7);
      arc(masonry, 18.35, 23.67 + between(-0.2, 0.3), a + 0.006, b - 0.006, back, face,
        choose(stone), 0.27);
      arc(mechanical, 17.99, 18.47, a + 0.015, b - 0.014, 0.44, face + 0.11, choose(bronze));
      arc(mechanical, 19.7, 19.84, a + 0.028, b - 0.04, face, face + 0.045, choose(iron), 0.006);
      arc(mechanical, 21.4, 21.53, a + 0.019, b - 0.045, face, face + 0.06, choose(iron), 0.008);
      arc(mechanical, 23.1, 23.38, a + 0.017, b - 0.018, face - 0.07, face + 0.10, choose(ceramic));
      // A recessed calibration cartouche and pair of uneven marker strokes.
      const center = (a + b) * 0.5;
      vane(mechanical, [[20.0,-0.43],[21.21,-0.43],[21.21,0.47],[20.3,0.47],[20,0.16]],
        center, face + 0.105, 0.17, choose(iron));
      for (let j = 0; j < 3; j++) {
        const rr = 20.17 + j * 0.335;
        vane(mechanical, [[rr,-0.26], [rr+0.10,-0.26], [rr+0.10, j === 1 ? 0.08 : 0.32],
          [rr,j === 1 ? 0.08 : 0.32]], center, face + 0.13, 0.05, choose(ceramic));
      }
      // Paired tracks carry a binary alignment code across the removable
      // faceplate. Fine marks are coplanar strips in the existing metal batch.
      const onFace=(r,s,z)=>[r*Math.cos(center)-s*Math.sin(center),r*Math.sin(center)+s*Math.cos(center),face+z];
      const stroke=(r,s,u,v,width,color)=>{
        const dx=u-r,dy=v-s,l=Math.hypot(dx,dy),ox=-dy/l*width*.5,oy=dx/l*width*.5;
        mechanical.quad(onFace(r+ox,s+oy,.075),onFace(r-ox,s-oy,.075),onFace(u-ox,v-oy,.075),onFace(u+ox,v+oy,.075),color);
      };
      for(const sign of [-1,1]){
        const offset=sign*.96;
        stroke(20.1,offset,20.1,sign*1.65,.043,'#464d41');
        stroke(20.1,sign*1.65,20.68,sign*2.10,.043,'#494e43');
        stroke(20.68,sign*2.10,22.6,sign*2.10,.043,'#494e43');
        stroke(20.28,sign*1.15,20.28,sign*1.54,.025,'#ddd1a6');
        for(let j=0;j<6;j++){
          const s=sign*(.9+j*.17),long=((i+1)*(j+2))%5<2;
          stroke(22.1,s,22.1+(long?.50:.23),s,.063,long?'#52564a':'#8a7959');
        }
      }
    } else {
      // Damaged bays expose the long rails and copper heat-exchanger leaves.
      for (let j = 1; j <= 9; j++) {
        if (j === 5 && i === 8) continue;
        const angle = a + (b - a) * j / 10;
        vane(mechanical, [[17.5,-0.14],[21.8,-0.14],[between(22.1,22.7),0.05],
          [21.3,0.19],[17.5,0.19]], angle, between(0.06,0.5), 1.75, choose(bronze));
      }
      arc(masonry, 22.35, 23.85, a + 0.018, a + (b - a) * 0.38,
        -0.7, 1.46, choose(stone), 0.14);
    }
    // The narrow luminous lip is divided by joints and stays readable in mist.
    arc(lamps, 16.69, 16.82, a + 0.002, b - 0.002, 1.09, 1.39, '#fff5d8', 0.012);
    arc(mechanical, 16.48, 16.69, a + 0.003, b - 0.003, -1.3, 1.42, choose(iron), 0.065);
    if (i % 3 !== 2) {
      const c = a + (b - a) * 0.22;
      arc(lamps, 17.36, 17.42, c, c + (b - a) * 0.36, 1.32, 1.35, '#f4dbaa', 0.005);
    }
    // Broad load-bearing saddles break the exterior silhouette at chosen joints.
    const large = i % 4 === 0;
    const out = large ? between(24.7, 25.7) : between(23.6, 24.2);
    const width = large ? 1.12 : 0.61;
    vane(masonry, [[17.64,-width*0.55],[19.27,-width],[out-0.5,-width],
      [out,-width*0.45],[out,width*0.69],[out-1.2,width],[19.4,width],[17.64,width*0.49]],
      start, large ? 2.14 : 1.86, large ? 3.92 : 2.85, choose(large ? ceramic : bronze));
    if (large) {
      vane(mechanical, [[20.3,-0.14],[out-0.42,-0.14],[out-0.42,0.09],[20.65,0.09]],
        start, 2.175, 0.11, choose(iron));
    }
  }

  function vine(target, x, y, z, length, spread, transform = identity) {
    let last = transform(x, y, z);
    const phase = between(0, tau);
    const count = Math.max(4, Math.floor(length * 2.9));
    for (let i = 1; i <= count; i++) {
      const t = i / count;
      const vx = x + Math.sin(t * 4 + phase) * spread * t + Math.sin(t * 8) * 0.10;
      const vy = y - t * length;
      const vz = z + 0.17 * Math.sin(phase + t * 3);
      const p = transform(vx, vy, vz);
      const side = i % 2 === 0 ? -1 : 1;
      const size = between(0.08, 0.29) * (1.15 - t * 0.52);
      target.quad(last, [last[0]+0.027,last[1],last[2]], [p[0]+0.022,p[1],p[2]], p, '#566447');
      target.tri(p, transform(vx + side * size, vy + size * 0.39, vz + 0.04),
        transform(vx + side * size * 1.66, vy - size * 0.69, vz + 0.02), choose(moss));
      last = p;
    }
  }
  // Pockets of plants collect along the upper rim then trail down the armour.
  for (const [angle, width, count] of [[0.29,0.13,18],[1.10,0.20,44],[2.12,0.17,46],[2.93,0.16,25]]) {
    for (let i = 0; i < count; i++) {
      const a = angle + between(-width,width), r = between(21.9,23.95);
      const [x,y] = radial(r,a,0);
      vine(foliage,x,y,between(1.71,2.17), between(0.3, 3.2), between(0.07, 0.41));
    }
  }
  masonry.flush(ring); mechanical.flush(ring); foliage.flush(ring); lamps.flush(ring);

  // A recessed azimuth rail turns independently of the collapsed stone casing.
  const dial = new THREE.Group();
  ring.add(dial);
  const indexMetal = batch(conductorMaterial);
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * tau;
    vane(indexMetal, [[16.28,-0.055],[16.55,-0.055],[16.55,0.052],[16.28,0.052]],
      a, -0.74, 0.29, choose(i % 6 === 0 ? ceramic : bronze));
  }
  arc(indexMetal, 16.25, 16.40, 0, tau, -1.07, -0.81, '#91866c');
  indexMetal.flush(dial);

  // Structural stone blocks with a bevelled foot and cut-back crown. Their
  // individual dimensions keep the ruins varied while sharing a construction style.
  function monolith(x, z, w, height, depth, yaw, lean, detailed = true, base = -1.1) {
    const transform = frame(x, base, z, yaw, lean);
    const hw = w / 2;
    const cut = Math.min(w * 0.27, height * 0.07);
    prism(stoneCut, [[-hw,0],[hw,0],[hw,height*0.66],[hw-cut*0.55,height*0.68],
      [hw-cut*0.55,height-cut*0.74],[hw-cut*1.4,height],[ -hw+cut,height+cut*0.23],
      [-hw,height-cut*0.58]], -depth/2, depth/2, choose(stone), transform);
    // A full-height recess, limestone flanges, then an inset bronze spine.
    const face = depth/2;
    box(hardware,-w*0.15,height*0.48,face+0.05,w*0.27,height*0.89,0.16,choose(iron),transform);
    box(hardware,-w*0.18,height*0.52,face+0.15,w*0.045,height*0.80,0.10,choose(bronze),transform);
    prism(stoneCut, [[-hw*1.03,0],[-hw*0.42,0],[-hw*0.42,height*0.87],[-hw*0.57,height*0.9],
      [-hw*1.03,height*0.89]], face-0.57, face+0.22,choose(ceramic),transform);
    box(stoneCut,w*0.29,height*0.45,face+0.04,w*0.22,height*0.82,0.24,choose(stone),transform);
    if (detailed) {
      const n = Math.max(3, Math.floor(height / 3.6));
      for (let i = 1; i < n; i++) {
        const y = (i/n)*height*0.91;
        box(hardware,-w*0.354,y,face+0.23,w*0.28,0.075,0.075,choose(iron),transform);
        box(hardware,w*0.19,y+0.53,face+0.18,w*0.22,0.06,0.07,choose(bronze),transform);
      }
      box(wallLamps,-w*0.099,height*0.63,face+0.15,0.042,height*0.10,0.04,'#e9d8b2',transform);
      for (let i = 0; i < 16; i++) {
        vine(wallFoliage,between(-hw,hw*0.55),height-cut*0.6,
          face+0.25,between(0.7,3.9),between(0.15,0.47),transform);
      }
    }
    box(stoneCut,0,0.5,0,w*1.30,2.0,depth*1.28, choose(stone),transform);
    // Foundations descend below the lowest exposed canyon shelf. When a shelf
    // falls away beside a monument it reveals its massive buried support.
    box(stoneCut,0,-18.6,0,w*1.13,37.4,depth*1.1,choose(iron),transform);
  }
  function deck(x, y, z, length, depth, yaw = 0) {
    const t = frame(x,y,z,yaw);
    const count = Math.ceil(length / 5.3);
    for (let i = 0; i < count; i++) {
      const w = length / count;
      const a = -length*0.5 + w*i + 0.045, b = a+w-0.09;
      prism(stoneCut, [[a+0.42,-1.3],[b-0.56,-1.3],[b,-0.77],[b,0],
        [a,0],[a,-0.74]], -depth/2,depth/2, choose(stone),t);
      box(hardware,(a+b)/2,-0.32,depth*0.5+0.036,w*0.90,0.13,0.09,choose(bronze),t);
      if (i % 4 === 1) {
        box(stoneCut,(a+b)/2,0.54,-depth*0.43,w*0.8,1.08,0.42,choose(stone),t);
      }
    }
  }

  // Broad terraced drum underneath the ring and its two anchoring shoulders.
  deck(-0.1, 1.1, -47.1, 43.5, 18.1, -0.19);
  deck(-0.1, 2.25, -47.6, 38.6, 16.0, -0.19);
  deck(-0.1, 3.37, -48.05, 31.8, 13.9, -0.19);
  deck(-0.1, 4.43, -48.5, 25, 12.1, -0.19);
  monolith(-16.2,-53.8,4.7,12.8,5.1,-0.26,0.12);
  monolith(16.1,-44.6,4.5,12.9,5.1,-0.26,-0.12);

  // Faulted flanking ruins. Towers use paired blades, cut crowns and deep slots.
  monolith(-38.2,-46.7,5.6,21.0,5.5,0.49,-0.045,true,7.2);
  monolith(-42.4,-48.6,3.3,13.0,4.9,0.49,-0.06,true,7.2);
  monolith(-46.8,-49.7,2.8,24.3,3.5,0.49,-0.035,true,7.2);
  monolith(-59.0,-68.5,5.8,15.4,5.8,-0.19,0.07,true,8.1);
  monolith(36.7,-44.3,5.4,26.8,5.0,-0.46,0.035);
  monolith(41.6,-42.5,2.9,33.7,4.2,-0.46,0.034);
  monolith(44.2,-41.1,1.7,24.5,3.4,-0.46,0.021);
  monolith(47.7,-38.9,2.9,16.8,5.0,-0.46,0.035);
  monolith(60.4,-72,6.7,20.6,5.2,0.7,-0.035);
  monolith(70.7,-73,3.4,26.4,4.5,0.7,-0.05);
  deck(-43,19.3,-63.7,42.2,5.2,0.19);
  for (const [x,z] of [[-59,-60.7],[-47.3,-62.9],[-32.9,-65.6]]) {
    monolith(x,z,2.7,19.85,3.7,0.19,-0.02,false);
  }
  deck(54.8, 17.8, -59.4, 44.2, 4.0, -0.35);
  for (const [x,z] of [[36.7,-66.0],[49.4,-61.4],[62.9,-56.5],[73.1,-52.9]]) {
    monolith(x,z,2.0,18.25,3.5,-0.35,0.02,false);
  }
  for (const [x,z,h,w] of [[-70,-110,21,4],[-75,-107,28,2.2],[-23,-112,10,3.1],
    [91,-126,32,5],[99,-122,17,4],[-95,-82,13,4],[35,-104,10,2.7]]) {
    monolith(x,z,w,h,3.5,between(-0.7,0.65),between(-0.075,0.075),false);
  }
  stoneCut.flush(scene); hardware.flush(scene); wallLamps.flush(scene); wallFoliage.flush(scene);

  return {
    update(time, resonance = 0) {
      const level = Math.max(0, Math.min(1, Number(resonance) || 0));
      const pulse = 1 + 0.035 * Math.sin(time * 0.76) + level * (0.64 + 0.13 * Math.sin(time * 3.8));
      lightMaterial.color.setRGB(pulse * 1.65, pulse * 1.35, pulse * (0.84 + 0.15 * level));
      dial.rotation.z = 0.08 * Math.sin(time * 0.035) + level * 0.12;
    },
  };
}
