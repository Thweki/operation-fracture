import {geologyMap,geologySlopes,mineralNormals,rockGeometry,rockMaterial} from './rocks.js';
// Every landform and plant is generated in world space, including the texture maps.
const TAU = Math.PI * 2;
export const WORLD_BOUNDS=Object.freeze({minX:-218,maxX:218,minZ:-225,maxZ:214});
const mix = (a, b, t) => a + (b - a) * t;
const sat = x => Math.max(0, Math.min(1, x));
function smooth(a, b, v) { const t = sat((v - a) / (b - a)); return t * t * (3 - 2 * t); }
function hash(x, z) {
  let n = Math.imul(x, 374761393) + Math.imul(z, 668265263);
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return ((n ^ n >>> 16) >>> 0) / 4294967295;
}
function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const u = smooth(0, 1, x - ix), v = smooth(0, 1, z - iz);
  return mix(mix(hash(ix, iz), hash(ix + 1, iz), u), mix(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v);
}
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}

// Elliptical shelves use a sequence of ledges, so valley walls have discernible
// sediment layers even from the other side of the basin.
const shelves = [
  [17, 77, 49, 48, 11.3], [47, 47, 20, 34, 10.0],
  [-52, 15, 31, 40, 13.3], [-43, -25, 24, 31, 9.8],
  [-64, -54, 31, 30, 15.2], [58, -3, 31, 55, 12.1],
  [45, -50, 18, 34, 7.7], [1, -50, 31, 28, 2.4],
  [-10, -87, 42, 23, 2], [73, -84, 27, 27, 18],
  [-94, -4, 28, 73, 15], [100, 39, 31, 70, 13],
  [-122,-38,32,43,9],[-160,-77,50,43,4.4],[-191,-107,31,49,8],
  [-201,-39,27,51,12],[-168,-139,43,24,10],[-129,-157,49,36,12],
  [-66,-151,42,40,11],[6,-150,48,41,5.6],[68,-136,43,32,9],
  [115,-111,40,43,14],[149,-68,32,44,8],[166,-23,48,54,6.9],
  [127,16,38,36,12],[197,4,38,58,11],[191,85,36,58,19],
  [116,125,52,47,12],[44,155,47,48,8],[-22,126,44,45,7],
  [-83,136,45,55,13],[-139,85,43,70,11],[-178,36,34,41,12],
  [-150,172,59,37,20],[-188,-190,43,43,20],[-58,-205,47,34,19],
  [70,-205,55,38,16],[155,-170,52,46,18],[188,167,42,51,18],
  [6,206,74,27,13]
];
export function heightAt(x, z) {
  const continental = noise(x * .076 + 21.4, z * .076 + 3.1);
  const rough = noise(x * .27 - 8.4, z * .27 + 5.9);
  const strata = noise(x * .022, z * .022 - 8);
  const warp = (continental - .5) * 6 + (rough - .5) * 1.45;
  const floor = -34 + strata * 3.6;
  const border=smooth(3,69,Math.max(Math.abs(x)-104,z-105,-z-114));
  let y = mix(floor,-11+strata*13+continental*4,border*.9);
  for (const [cx, cz, rx, rz, level] of shelves) {
    const dx = (x - cx) / rx, dz = (z - cz) / rz;
    if (Math.abs(dx) > 1.65 || Math.abs(dz) > 1.65) continue;
    const d = (1 - Math.sqrt(dx * dx + dz * dz)) * Math.min(rx, rz) + warp;
    if (d < -14) continue;
    const rise = .21 * smooth(-14, -8, d) + .28 * smooth(-7.6, -5.4, d)
      + .17 * smooth(-4.9, -3, d) + .27 * smooth(-2.6, .45, d) + .07 * smooth(.4, 3.8, d);
    const top = (continental - .48) * 2.9 + (rough - .48) * .38 + (strata - .5) * 4;
    y = Math.max(y, mix(floor, level + top, rise));
  }
  // A brackish tidal pool has a sloping littoral shelf. Its bed stays physical
  // for the low flight limit. The glacial field beyond the gate is almost level.
  if(x< -115 && z< -36){
    const basin=Math.hypot((x+159)/35,(z+78)/24);
    y=mix(y,-2.8+rough*.55,smooth(.99,.55,basin));
  }
  if(x>116&&x<211&&z<25&&z>-64){
    const plaza=Math.hypot((x-163)/34,(z+19)/33);
    y=mix(y,5.86+.45*continental+.18*rough,1-smooth(.60,1.28,plaza));
  }
  if(Math.abs(x-6)<44&&Math.abs(z+150)<44){
    const radius=Math.hypot(x-6,z+150);
    y=mix(y,5.55+.35*continental+.12*rough,1-smooth(29,43,radius));
  }
  return y;
}
function pathX(z) { return 9 + (z - 47) * .37 + Math.sin((z - 46) * .115) * 2.1; }
function pathDist(x, z) { return z < 30 || z > 104 ? 99 : Math.abs(x - pathX(z)); }
function meadow(x, z) {
  const fold = Math.sin(x * .105 + z * .077 + noise(x * .035, z * .035) * 5);
  return .49 + .31 * fold + .32 * (noise(x * .26 + 41, z * .26) - .5);
}
function geometryBuilder(THREE) {
  const pos = [], rgb = [], idx = [];
  const color = new THREE.Color();
  function v(x, y, z, hex, light = 1) {
    const i = pos.length / 3;
    pos.push(x, y, z);
    color.set(hex);
    rgb.push(color.r * light, color.g * light, color.b * light);
    return i;
  }
  function tri(a, b, c) { idx.push(a, b, c); }
  function quad(a, b, c, d) { tri(a, b, d); tri(b, c, d); }
  function finish() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
    geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
    return geo;
  }
  return { v, tri, quad, finish };
}
function mineralMap(THREE) {
  const size = 256, data = new Uint8Array(size * size * 4);
  function tile(x, y, sx, sy, offset) {
    x *= sx; y *= sy;
    const a = Math.floor(x), b = Math.floor(y);
    const fx = smooth(0, 1, x-a), fy = smooth(0, 1, y-b);
    const h = (i, j) => hash((i % sx + sx) % sx + offset, (j % sy + sy) % sy);
    return mix(mix(h(a,b), h(a+1,b), fx), mix(h(a,b+1), h(a+1,b+1), fx), fy);
  }
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = i / size, y = j / size;
    const coarse = tile(x,y,5,5,12), fleck = tile(x,y,57,49,29);
    const vein = tile(x + coarse*.035, y + coarse*.06, 12,34,9);
    const grit = hash(i,j), crystal = grit > .95 && fleck > .55 ? 21 : 0;
    const p = (j*size+i)*4;
    const value = 143 + 60*coarse + 28*fleck + 20*grit + 14*vein + crystal - (vein < .23 ? 18 : 0);
    data[p] = Math.min(255,value); data[p+1] = Math.min(255,value * .985 + 2); data[p+2] = Math.min(255,value*.93 + 8); data[p+3] = 255;
  }
  const map = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.anisotropy=8; map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true;
  return map;
}
function land(THREE, scene, map, geology) {
  // Retain the original sampling around the garden. Coarser peripheral tiles
  // extend past every flight bound and still share vertices along their seams.
  function axis(start,count,min,max){
    const a=Array.from({length:count+1},(_,i)=>start+i*1.285);
    for(let p=start-2.45;p>=min;p-=2.45)a.unshift(p);
    for(let p=start+count*1.285+2.45;p<=max;p+=2.45)a.push(p);
    return a;
  }
  const xs=axis(-140,208,-275,277),zs=axis(-135,196,-282,272),nx=xs.length-1,nz=zs.length-1;
  const heights=new Float32Array(xs.length*zs.length);
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++)heights[j*(nx+1)+i]=heightAt(xs[i],zs[j]);
  const vertices = new Float32Array((nx+1)*(nz+1)*3), colors = new Float32Array(vertices.length);
  const uv = new Float32Array(vertices.length / 3 * 2), indices = [];
  const dry = new THREE.Color('#b0a26b'), olive = new THREE.Color('#78824b'), green = new THREE.Color('#4d613e');
  const lichen = new THREE.Color('#808163'), blackrock = new THREE.Color('#404848'), rock = new THREE.Color('#868477');
  const red = new THREE.Color('#99503c'), marsh=new THREE.Color('#547a6a'), reeds=new THREE.Color('#74886d');
  const grit=new THREE.Color('#948974'),loam=new THREE.Color('#766b50');
  const col = new THREE.Color(), stone = new THREE.Color();
  for (let j=0;j<=nz;j++) for (let i=0;i<=nx;i++) {
    const n = j*(nx+1)+i, x=xs[i], z=zs[j], y=heights[n];
    const li=Math.max(0,i-1),ri=Math.min(nx,i+1),tj=Math.max(0,j-1),bj=Math.min(nz,j+1);
    const dx=1.16*(heights[j*(nx+1)+ri]-heights[j*(nx+1)+li])/(xs[ri]-xs[li]);
    const dz=1.16*(heights[bj*(nx+1)+i]-heights[tj*(nx+1)+i])/(zs[bj]-zs[tj]);
    const slope = Math.hypot(dx,dz);
    const macro = noise(x*.085+2,z*.085+21), detail=noise(x*.47,z*.47);
    const strata = Math.sin(y * 2.2 + x*.075 + .5*Math.sin(z*.14) + detail*.5);
    stone.copy(blackrock).lerp(rock,.27 + .32*macro + .22*strata + .13*detail);
    stone.lerp(lichen, .30*macro);
    col.copy(green).lerp(olive, .14+macro*.81).lerp(dry, .48*noise(x*.16-10,z*.16+3));
    const flowers = smooth(.54,.83, meadow(x,z));
    col.lerp(red,flowers*.79);
    if(x< -100&&z<1){
      const coastal=smooth(-101,-148,x)*smooth(0,-42,z);
      col.lerp(marsh,coastal*(.56+.38*macro));col.lerp(reeds,coastal*detail*.32);
      if(y<2.8)col.lerp(blackrock,coastal*.67);
    }
    if(x>104) col.lerp(dry,smooth(104,151,x)*(.42+.27*detail));
    const verge=pathDist(x,z),worn=1-smooth(.67,2.95+1.29*macro,verge+.48*(detail-.5));
    col.lerp(loam,worn*(.38+.24*detail));col.lerp(grit,worn*(.35+.42*macro));
    col.lerp(stone, Math.max(smooth(.48, 2.1, slope), (1-smooth(-29,-19,y))*.85));
    col.multiplyScalar(.85 + detail*.24);
    vertices.set([x,y,z],n*3); colors.set([col.r,col.g,col.b],n*3);
    // Steep surfaces keep detail without stretching their entire height over a single row.
    uv.set([(x + y*.31)*.26,(z + y*.73)*.26], n*2);
    if (i<nx && j<nz) { const k=n+nx+1; indices.push(n,k,n+1, n+1,k,k+1); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(vertices,3));
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2)); geo.setIndex(indices); geo.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,map,roughness:1,metalness:.025});
  material.onBeforeCompile=shader=>{
    shader.uniforms.geologyAtlas={value:geology};
    shader.uniforms.mineralSlopes={value:geologySlopes(THREE,geology)};
    shader.vertexShader='varying vec3 vLandPoint;\nvarying vec3 vLandNormal;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>',`#include <begin_vertex>
      vLandPoint=position;
      vLandNormal=normal;`);
    shader.fragmentShader=mineralNormals+'\nvarying vec3 vLandPoint;\nvarying vec3 vLandNormal;\nuniform sampler2D geologyAtlas;\n'+shader.fragmentShader
      .replace('#include <color_fragment>',`#include <color_fragment>
      vec3 pStone=vLandPoint;
      vec3 landN=normalize(vLandNormal);
      vec3 planes=pow(abs(landN),vec3(4.));
      planes/=max(.0001,dot(planes,vec3(1.)));
      float exposed=1.-smoothstep(.54,.92,landN.y);
      vec4 deposit=texture2D(geologyAtlas,vec2(pStone.x*.034+pStone.z*.022,pStone.y*.039-pStone.z*.017));
      vec3 warped=pStone+vec3(deposit.a*.32,deposit.r*.41,deposit.g*.30);
      vec2 uvX=vec2(warped.z*.195,warped.y*.26+warped.z*.037),uvY=warped.xz*.21;
      vec2 uvZ=vec2(warped.x*.195,warped.y*.26-warped.x*.037);
      vec4 rockX=texture2D(geologyAtlas,uvX);
      vec4 rockY=texture2D(geologyAtlas,uvY);
      vec4 rockZ=texture2D(geologyAtlas,uvZ);
      vec4 mineral=rockX*planes.x+rockY*planes.y+rockZ*planes.z;
      // Bedding runs along the wall. Narrow vertical couloirs and offset
      // seams cross it, independent of the direction of the terrain mesh.
      float along=pStone.x*.78+pStone.z*.62;
      vec4 runnels=texture2D(geologyAtlas,vec2(along*.12+deposit.g*.027,pStone.y*.015+along*.011));
      float gutter=1.-smoothstep(.30,.50,runnels.b+.10*(deposit.r-.5));
      float fault=smoothstep(.42,.55,runnels.b);
      float shelfPhase=pStone.y*.51+pStone.x*.033-pStone.z*.021+deposit.r*.40+fault*.27;
      float stratum=fract(shelfPhase);
      float traceVisibility=1.-smoothstep(.075,.44,fwidth(shelfPhase));
      float cracked=(1.-smoothstep(.015,.135,abs(stratum-.41)))*(.49+.51*deposit.b);
      float seam=cracked*traceVisibility*(.33+.67*smoothstep(.33,.65,deposit.g*.64+mineral.b*.36));
      float flake=smoothstep(.49,.70,stratum)*(1.-smoothstep(.73,.95,stratum));
      float fragmentGrain=clamp(mineral.r*.72+deposit.r*.40,0.,1.);
      vec3 bed=mix(vec3(.067,.083,.082),vec3(.237,.239,.207),fragmentGrain);
      bed*=.79+.36*mineral.a+.125*flake;
      bed*=1.-.23*gutter-.26*seam;
      float shelfMoss=smoothstep(.42,.66,mineral.g*.65+deposit.g*.35)*
            smoothstep(.17,.79,landN.y+deposit.b*.20-.12*gutter);
      bed=mix(bed,vec3(.11,.143,.072)*(.68+mineral.r*.64),shelfMoss*.69);
      diffuseColor.rgb=mix(diffuseColor.rgb,bed,exposed);
      float closeGround=1.-smoothstep(6.,25.,length(vViewPosition));
      float soilPores=.5;
      if(closeGround>.002){
        vec2 tiny=vec2(pStone.x*.91+pStone.z*.37,pStone.z*.85-pStone.x*.29+pStone.y*.63);
        vec4 soil=texture2D(geologyAtlas,tiny*1.91);
        soilPores=soil.a;
        diffuseColor.rgb*=1.+closeGround*.41*(soil.r-.51);
        float mossLobes=smoothstep(.48,.76,soil.g+mineral.g*.11)*shelfMoss;
        diffuseColor.rgb+=closeGround*vec3(.025,.034,.013)*mossLobes;
      }`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=clamp(.96-exposed*.14+.09*shelfMoss+closeGround*(soilPores-.5)*.075,.7,1.);`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      if(closeGround>.002){
        vec3 slope=mineralGradient(planes,uvX,uvY,uvZ,vec3(.195,.21,.26),.037)*(.012+.019*exposed);
        slope-=landN*dot(landN,slope);
        normal=normalize(normal-mat3(viewMatrix)*slope*closeGround*inversesqrt(1.+dot(slope,slope)/.078));
      }`);
  };
  // Neighboring tiles use the same vertex normals. Their surface remains
  // continuous, while the renderer can discard the land behind the observer.
  const tile=40;
  for(let row=0;row<nz;row+=tile)for(let column=0;column<nx;column+=tile){
    const piece=new THREE.BufferGeometry(),list=[],bounds=new THREE.Box3(),point=new THREE.Vector3();
    for(const [key,attribute] of Object.entries(geo.attributes))piece.setAttribute(key,attribute);
    const endRow=Math.min(row+tile,nz),endColumn=Math.min(column+tile,nx);
    for(let j=row;j<=endRow;j++)for(let i=column;i<=endColumn;i++){
      const k=j*(nx+1)+i;
      bounds.expandByPoint(point.fromArray(vertices,k*3));
      if(j<endRow&&i<endColumn)list.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2);
    }
    piece.setIndex(list);piece.boundingBox=bounds;piece.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());
    const mesh=new THREE.Mesh(piece,material);mesh.name='Vegetated rock shelf';mesh.receiveShadow=true;
    const coarse=new THREE.BufferGeometry(),reduced=[];
    for(const [key,attribute] of Object.entries(geo.attributes))coarse.setAttribute(key,attribute);
    const at=(x,z)=>z*(nx+1)+x;
    for(let z=row;z<endRow;z+=3)for(let x=column;x<endColumn;x+=3){
      const ex=Math.min(endColumn,x+3),ez=Math.min(endRow,z+3);
      const a=at(x,z),b=at(x,ez),c=at(ex,ez),d=at(ex,z);
      if(x!==column&&z!==row&&ex!==endColumn&&ez!==endRow || ex-x<2 || ez-z<2){reduced.push(a,b,d,b,c,d);continue;}
      const rim=[a];
      if(x===column)for(let j=z+1;j<ez;j++)rim.push(at(x,j));rim.push(b);
      if(ez===endRow)for(let i=x+1;i<ex;i++)rim.push(at(i,ez));rim.push(c);
      if(ex===endColumn)for(let j=ez-1;j>z;j--)rim.push(at(ex,j));rim.push(d);
      if(z===row)for(let i=ex-1;i>x;i--)rim.push(at(i,z));
      const middle=at((x+ex)>>1,(z+ez)>>1);
      for(let k=0;k<rim.length;k++)reduced.push(middle,rim[k],rim[(k+1)%rim.length]);
    }
    coarse.setIndex(reduced);coarse.boundingBox=bounds;coarse.boundingSphere=piece.boundingSphere;
    const far=new THREE.Mesh(coarse,material);far.name=mesh.name;far.receiveShadow=true;
    const lod=new THREE.LOD();bounds.getCenter(lod.position);mesh.position.copy(lod.position).negate();far.position.copy(mesh.position);
    lod.addLevel(mesh,0);lod.addLevel(far,137,.09);scene.add(lod);
  }
}
// Each tree texture is a small botanical study drawn from a seeded branch
// skeleton. Sprays are painted in depth order; the tips and gaps survive the
// alpha cutoff even when their projected size is just a few screen pixels.
function canopyMaterial(THREE, seed, pine) {
  const rr=makeRandom(seed), canvas=document.createElement('canvas');
  const width=pine?384:192, height=576;
  canvas.width=width*1.5; canvas.height=height*1.5;
  const ctx=canvas.getContext('2d'), mid=width*.5, bottom=height-4, span=height-15;
  ctx.scale(1.5,1.5);
  const bend=(t)=>Math.sin(t*3.5+seed)*t*(pine?12:4)+Math.sin(t*7)*t*2;
  const xAt=t=>mid+bend(t), yAt=t=>bottom-span*t;
  const twigs=[], foliage=[];
  const branch=(x0,y0,x1,y1,t,depth,kind)=>{
    twigs.push({x0,y0,x1,y1,t,depth,kind});
  };
  function spray(x,y,rx,ry,rootDepth,side,count){
    foliage.push({x,y,rx,ry,depth:rootDepth,side,count,grain:rr()});
  }
  if(!pine){
    for(let i=0;i<315;i++){
      const t=.09+rr()*.875, az=rr()*TAU, crown=(t-.09)/.875;
      const girth=(.15+.85*Math.sin(crown*Math.PI)**.77)*(1-.44*crown);
      const radius=girth*width*.50*(.47+.55*rr()), side=Math.cos(az), depth=Math.sin(az);
      const dx=radius*side, climb=(.018+.085*rr())*(.52+.48*Math.sin(crown*Math.PI));
      const x0=xAt(t), y0=yAt(t), x1=x0+dx, y1=yAt(Math.min(.999,t+climb));
      branch(x0,y0,x1,y1,1.0+girth,depth,0);
      const amount=3+Math.floor(rr()*3);
      for(let k=0;k<amount;k++){
        const q=.24+.76*(k+rr()*.65)/amount;
        const sx=mix(x0,x1,q)+(rr()-.5)*8, sy=mix(y0,y1,q)+(1-q)*4;
        spray(sx,sy,(3.6+rr()*6)*(.65+.38*girth),(7+rr()*10)*(.58+.46*girth),depth+.07*rr(),side,21);
      }
    }
  }else{
    // A windswept umbrella pine has a broad broken crown and open lower limbs.
    for(let i=0;i<11;i++){
      const az=(i+rr()*.52)*TAU/11, radial=.41+rr()*.56, depth=Math.sin(az)*radial;
      const side=Math.cos(az), yTip=.69+.24*(1-radial)+rr()*.13;
      const yFork=.40+rr()*.31, x0=xAt(yFork),y0=yAt(yFork);
      const x1=xAt(yTip)+radial*side*width*.45, y1=yAt(yTip);
      const xm=mix(x0,x1,.63),ym=mix(y0,y1,.36);
      branch(x0,y0,xm,ym,3.7+rr()*2.9,depth,1);
      branch(xm,ym,x1,y1,2.1+rr()*1.7,depth,1);
      for(let fork=0;fork<5;fork++){
        const tipX=x1+(rr()-.5)*62,tipY=y1-rr()*29;
        branch(mix(xm,x1,.55),mix(ym,y1,.55),tipX,tipY,1.4+rr(),depth+.02,1);
        for(let k=0;k<11;k++){
          const scale=.6+.56*rr();
          const sx=tipX+(rr()-.5)*33,sy=tipY+(rr()-.48)*17;
          spray(sx,sy,(13+rr()*11)*scale,(6+rr()*6)*scale,depth+rr()*.08,side,24);
        }
      }
    }
    for(let i=0;i<100;i++){
      const a=rr()*TAU,r=Math.sqrt(rr()),x=xAt(.93)+Math.cos(a)*r*width*.15;
      const y=yAt(.92+.045*(1-r))+Math.sin(a)*r*11;
      spray(x,y,9+rr()*13,5+rr()*10,.14+rr()*.6,Math.cos(a),20);
    }
  }
  const line=(x0,y0,x1,y1,w,color)=>{
    ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
  };
  ctx.lineCap='round';
  function wood(twig){
    const {x0,y0,x1,y1,t,depth}=twig;
    const shade=Math.round(45+12*(depth+1));
    line(x0,y0,x1,y1,t,`rgb(${shade+8},${shade+6},${shade-2})`);
  }
  function needles(p){
    const {x,y,rx,ry,depth,side,count,grain}=p;
    const crownLight=sat((depth*.29+.43)-.19*side+.10*grain);
    const coarse=rr()*.13+.87,base=[mix(34,91,crownLight)*coarse,mix(49,105,crownLight)*coarse,mix(40,69,crownLight)*coarse];
    const tint=(f,warm=0)=>`rgb(${Math.round(base[0]*f+warm)},${Math.round(base[1]*f+warm*.65)},${Math.round(base[2]*f+warm*.15)})`;
    // The torn margins pick up scattered sunlight. Fine flecks inside each
    // spray stay visibly darker than the new growth at the branch tips.
    ctx.beginPath();
    for(let k=0;k<13;k++){
      const a=TAU*k/13, radius=.55+rr()*.43;
      const px=x+Math.cos(a)*rx*radius,py=y+Math.sin(a)*ry*radius;
      if(k===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    }
    ctx.closePath();ctx.fillStyle=tint(.8+.16*grain);ctx.fill();
    for(let n=0;n<count;n++){
      const az=rr()*TAU, radius=Math.sqrt(rr()),px=x+Math.cos(az)*rx*radius,py=y+Math.sin(az)*ry*radius;
      const sun=.6+rr()*.29+.28*(1-Math.sin(az))*.5+.11*(1-Math.cos(az))*.5;
      const dx=(pine?Math.cos(az):side*.37+Math.cos(az)*.71)*(1.8+rr()*3.3);
      const dy=pine?-1.4-rr()*3.1:-2.7-rr()*5.2;
      line(px,py,px+dx,py+dy,.75+rr()*1.95,tint(sun,rr()>.88?11:0));
    }
  }
  twigs.sort((a,b)=>a.depth-b.depth);foliage.sort((a,b)=>a.depth-b.depth);
  twigs.filter(t=>t.depth<0).forEach(wood);foliage.filter(t=>t.depth<0).forEach(needles);
  const stem=pine?10.5:7;
  for(let i=0;i<28;i++){
    const t=i/28,q=(i+1)/28,w=Math.max(1,stem*(1-t*.92));
    line(xAt(t),yAt(t),xAt(q),yAt(q),w,'#514e40');
    line(xAt(t)-w*.24,yAt(t),xAt(q)-w*.24,yAt(q),Math.max(.6,w*.25),'#8e856a');
    if(i<17)for(let k=0;k<3;k++){
      const offset=(k-1)*w*.21,notch=.23*Math.sin(i*.83+k);
      line(xAt(t)+offset,yAt(t),xAt(q)+offset+notch,yAt(q),.38,k===1?'#847661':'#49473c');
    }
  }
  twigs.filter(t=>t.depth>=0).forEach(wood);foliage.filter(t=>t.depth>=0).forEach(needles);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.anisotropy=4;
  const mat=new THREE.MeshBasicMaterial({map:texture,alphaTest:.22,side:THREE.DoubleSide});
  mat.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
      #if defined(USE_INSTANCING) && defined(USE_MAP)
      vec2 baseTree=instanceMatrix[3].xz;
      float crownSeed=fract(sin(dot(baseTree,vec2(.787,.321)))*7423.82);
      if(crownSeed>.50)vMapUv.x=1.-vMapUv.x;
      vMapUv.x+=.024*sin(3.14159*vMapUv.y)*sin(6.283*vMapUv.y+crownSeed*6.283);
      #endif`);};
  mat.alphaToCoverage=true;return mat;
}
function treeCards(THREE,pine,detail){
  const count=[2,3,4][detail], width=pine?.69:.27, pos=[],uv=[],indices=[];
  for(let i=0;i<count;i++){
    const angle=i*Math.PI/count, sn=Math.sin(angle),cs=Math.cos(angle);
    const start=pos.length/3;
    for(const v of [0,.49,1])for(const u of [0,.5,1]){
      const x=(u-.5)*width,depth=Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*width*.12;
      pos.push(x*cs-depth*sn,v,x*sn+depth*cs);uv.push(u,v);
    }
    for(let j=0;j<2;j++)for(let k=0;k<2;k++){
      const n=start+j*3+k;indices.push(n,n+1,n+3,n+1,n+4,n+3);
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);
  geo.computeBoundingSphere();return geo;
}
function tuft(THREE, seed, red, blossom, detail=2) {
  const b=geometryBuilder(THREE), rr=makeRandom(seed);
  const leaves=detail>=2?(blossom?8:11):(detail===1?5:3);
  for(let i=0;i<leaves;i++){
    const a=rr()*TAU, dist=rr()*.37, rx=Math.cos(a)*dist, rz=Math.sin(a)*dist;
    const h=.32+rr()*.66, lean=.14+rr()*.26, width=(.014+rr()*.024)*(red?1.45:1);
    const sx=Math.sin(a)*width, sz=-Math.cos(a)*width, dx=Math.cos(a)*lean,dz=Math.sin(a)*lean;
    const baseColor=red?'#582e2a':'#59613a', midColor=red?'#a54e3d':'#8b9854', tipColor=red?'#d17e56':'#c4bc76';
    if(detail===3&&i<4){
      const bands=[];
      for(const t of [0,.27,.55,.80,.98]){
        const fw=.016+Math.sin(Math.PI*t)**.72,xx=rx+dx*t*t,zz=rz+dz*t*t,yy=h*(t+.085*Math.sin(t*Math.PI));
        const col=t===0?baseColor:t>.79?tipColor:midColor;
        const ring=[b.v(xx-sx*fw,yy,zz-sz*fw,col,.82),
          b.v(xx+.012*Math.cos(a)*fw,yy+.008*fw,zz+.012*Math.sin(a)*fw,col,1.08),
          b.v(xx+sx*fw,yy,zz+sz*fw,col,.95)];
        if(bands.length){const prior=bands.at(-1);b.quad(prior[0],prior[1],ring[1],ring[0]);b.quad(prior[1],prior[2],ring[2],ring[1]);}
        bands.push(ring);
      }
    }else{
      const p=b.v(rx,0,rz,baseColor), l=b.v(rx+dx*.25+sx,h*.53,rz+dz*.25+sz,midColor);
      const r=b.v(rx+dx*.25-sx,h*.53,rz+dz*.25-sz,midColor,.82);
      const tip=b.v(rx+dx,h,rz+dz,tipColor);
      b.tri(p,r,l); b.tri(l,r,tip);
    }
    if(blossom && i<(detail>=2?4:detail===1?2:0)){
      const tx=rx+dx, tz=rz+dz, petalRad=.043+rr()*.034, a0=rr()*TAU;
      const core=b.v(tx,h-.011,tz,'#704327');
      for(let k=0;k<4;k++){
        const pa=k*TAU/4+a0, ca=Math.cos(pa), sa=Math.sin(pa), s=petalRad;
        const p1=b.v(tx+(ca*.69+sa*.64)*s,h+s*.22,tz+(sa*.69-ca*.64)*s,'#c34933');
        const p2=b.v(tx+ca*s,h+.46*s,tz+sa*s,'#ed7655');
        const p3=b.v(tx+(ca*.69-sa*.64)*s,h+s*.20,tz+(sa*.69+ca*.64)*s,'#d65b42');
        b.quad(core,p1,p2,p3);
      }
    }
  }
  return b.finish();
}
function slabGeometry(THREE, seed) {
  const b=geometryBuilder(THREE), rr=makeRandom(seed), shape=[[-.47,-.5],[.29,-.51],[.49,-.38],[.5,.33],[.38,.49],[-.39,.49],[-.5,.33],[-.5,-.39]];
  const side=seed%2===0?2:5,a=shape[side],d=shape[side+1];
  shape.splice(side+1,0,[mix(a[0],d[0],.27),mix(a[1],d[1],.27)],
    [mix(a[0],d[0],.41)*.88,mix(a[1],d[1],.41)*.88],[mix(a[0],d[0],.51),mix(a[1],d[1],.51)]);
  const bottom=[],top=[],cap=[];
  for(const [x,z] of shape) {
    const d=.96+.08*rr();
    bottom.push(b.v(x,0,z,'#69685c'));
    top.push(b.v(x*d,.72+rr()*.15,z*d,'#a8a58b'));
    cap.push(b.v(x*.92,1,z*.92,'#cdc6a7',.88+rr()*.17));
  }
  const mid=b.v(0,1.02,0,'#c7c3a9');
  for(let i=0;i<shape.length;i++){const k=(i+1)%shape.length;b.quad(bottom[k],bottom[i],top[i],top[k]);b.quad(top[k],top[i],cap[i],cap[k]);b.tri(mid,cap[k],cap[i]);}
  return b.finish();
}
function flagstoneMaterial(T,atlas){
  const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:.05});
  mat.onBeforeCompile=s=>{
    s.uniforms.slabAtlas={value:atlas};
    s.vertexShader='varying vec3 flagWorld;varying vec3 flagLocal;\n'+s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      flagWorld=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;flagLocal=position;`);
    s.fragmentShader='varying vec3 flagWorld;varying vec3 flagLocal;uniform sampler2D slabAtlas;\n'+s.fragmentShader
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec2 fp=flagWorld.xz+.44*flagWorld.y;
        vec4 wear=texture2D(slabAtlas,fp*.37),aggregate=texture2D(slabAtlas,fp*2.27);
        vec2 edgeDist=.5-abs(flagLocal.xz);
        float border=min(edgeDist.x,edgeDist.y),rim=1.-smoothstep(.003,.016+fwidth(border),abs(border-.062));
        float patina=smoothstep(.45,.70,wear.g*.70+aggregate.g*.30)*
          (1.-smoothstep(.01,.26,border))*(.9+.12*aggregate.b);
        float chip=(1.-smoothstep(.004,.025,abs(wear.a-.48)))*smoothstep(.49,.62,wear.r);
        diffuseColor.rgb*=.63+.43*wear.r+.29*aggregate.r;
        diffuseColor.rgb*=1.-rim*(.1+.22*wear.b)-chip*.10;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.095,.117,.062)*(.74+.6*aggregate.r),patina*.81);
        float flagRelief=(wear.a-.5)*.057+(aggregate.a-.5)*.008-rim*.012-chip*.016;
      `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=clamp(.75+.17*patina+.13*wear.a,.65,.99);`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec3 vx=dFdx(-vViewPosition),vy=dFdy(-vViewPosition),sx=cross(vy,normal),sy=cross(normal,vx);
        float fd=dot(vx,sx),fs=max(abs(fd),.000001);
        vec3 fg=sign(fd)*(sx*dFdx(flagRelief)+sy*dFdy(flagRelief));
        normal=normalize(fs*normal-fg*min(1.,fs*.67/max(length(fg),.000001)));
      `);
  };
  return mat;
}
function waterfalls(THREE, scene) {
  const positions=[], uvs=[], indices=[];
  const streams=[[-39,14,1,0,1.22],[-37,9,1,0,.50],[-38,7,1,0,.33],[48,-3,-1,0,.78],[46,-7,-1,0,.34],[-9,-44,0,1,.59]];
  for(const [sx,sz,dx,dz,width] of streams) {
    let x=sx,z=sz,lastY=heightAt(x,z);
    for(let k=0;k<75;k++){
      const nx=x+dx*.55,nz=z+dz*.55,y=heightAt(nx,nz);
      if(lastY-y>.35 && lastY>-1)break;
      x=nx;z=nz;lastY=y;
    }
    if(lastY< -8)continue;
    const offset=positions.length/3, drop=lastY+30;
    for(let j=0;j<=20;j++) {
      const t=j/20, travel=4.8*(1-Math.exp(-t*10)), px=x+dx*travel,pz=z+dz*travel;
      const span=width*(.65+.48*t+.22*Math.sin(t*9));
      for(const s of [-1,1]){
        positions.push(px+dz*span*s,lastY+.16-drop*t,pz-dx*span*s);
        uvs.push((s+1)/2,t);
      }
      if(j<20){const k=offset+j*2;indices.push(k,k+1,k+2,k+2,k+1,k+3);}
    }
  }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);
  const mat=new THREE.ShaderMaterial({
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{uTime:{value:0}}]),
    vertexShader:`
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main(){vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader:`
      #include <fog_pars_fragment>
      varying vec2 vUv;uniform float uTime;
      void main(){float edges=pow(max(0.,1.-abs(vUv.x*2.-1.)),.72);
      float wave=.48+.23*sin(vUv.x*103.+sin(vUv.y*6.-uTime*2.))+.19*sin(vUv.x*243.+vUv.y*18.-uTime*4.);
      float mist=(1.-smoothstep(.77,1.,vUv.y))*smoothstep(0.,.024,vUv.y);
      gl_FragColor=vec4(vec3(.72,.81,.76),edges*wave*mist*.72);
      #include <fog_fragment>
      #include <colorspace_fragment>
      }`,
    side:THREE.DoubleSide,transparent:true,depthWrite:false,fog:true
  });
  scene.add(new THREE.Mesh(geo,mat)); return mat;
}

function fern(THREE,detail=2) {
  const b=geometryBuilder(THREE), rr=makeRandom(12914);
  const count=[3,5,7][detail], pinnules=[3,5,9][detail];
  for(let j=0;j<count;j++){
    const az=TAU*(j+rr()*.7)/count, reach=.53+rr()*.48, h=.37+rr()*.31;
    const cx=Math.cos(az),cz=Math.sin(az);
    const point=(t,s=0) => [cx*t*reach+cz*s, h*(Math.sin(t*Math.PI*.77)+t*.18), cz*t*reach-cx*s];
    const stemA=b.v(...point(0,-.012),'#645d3b'),stemB=b.v(...point(0,.012),'#656641'),stemC=b.v(...point(.6,-.007),'#92905a'),stemD=b.v(...point(.6,.007),'#97965c'),end=b.v(...point(1),'#b7af6e');
    b.quad(stemA,stemB,stemD,stemC); b.tri(stemC,stemD,end);
    for(let k=1;k<=pinnules;k++){
      const t=k/(pinnules+2), spread=Math.sin(Math.PI*t)**.65*reach*.16;
      for(const s of [-1,1]){
        const base=b.v(...point(t),'#737c4b'), left=b.v(...point(t+.021,s*spread*.61),'#9c9f5d');
        const right=b.v(...point(t+.085,s*spread*.58),'#8a985b'), tip=b.v(...point(t+.126,s*spread),'#b3b06b');
        b.tri(base,left,right); b.tri(left,tip,right);
      }
    }
  }
  return b.finish();
}

export function buildTerrain(THREE, scene) {
  const rr=makeRandom(110863);
  const map=mineralMap(THREE), geology=geologyMap(THREE);
  land(THREE,scene,map,geology);
  const leafMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide});
  const stoneMat=flagstoneMaterial(THREE,geology);
  const leafPhase={value:0};
  const herbMat=leafMat.clone();
  herbMat.onBeforeCompile=shader=>{
    shader.uniforms.uLeafTime=leafPhase;
    shader.vertexShader='uniform float uLeafTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      #ifdef USE_INSTANCING
      vec2 field=instanceMatrix[3].xz;
      float sway=sin(field.x*.19+field.y*.08+uLeafTime*1.3)+.42*sin(field.y*.46+uLeafTime*.91);
      transformed.x+=sway*.047*position.y*position.y;
      transformed.z+=sway*.017*position.y*position.y;
      #endif`);
  };
  const stamp=new THREE.Object3D(), tint=new THREE.Color();
  function batch(name,geometries,mat,placements,lod) {
    if(!placements.length)return;
    const grouped=new Map(), tile=lod?.tile??128;
    for(const p of placements){
      const extent=Math.max(p[3],p[4],p[5]);
      const scaleClass=lod?.rockSize?(extent<.68?0:extent<2.08?1:2):0;
      const key=Math.floor(p[0]/tile)+','+Math.floor(p[2]/tile)+','+scaleClass;
      if(!grouped.has(key))grouped.set(key,[]);
      grouped.get(key).push(p);
    }
    const probe=new THREE.Sphere(), cells=[];
    const geo=geometries[0];if(!geo.boundingSphere)geo.computeBoundingSphere();
    for(const items of grouped.values()){
      const sphere=new THREE.Sphere(),transforms=new Float32Array(items.length*16),colors=new Float32Array(items.length*3);
      let largest=0;
      items.forEach(([x,y,z,w,h,d,r,light,lean=0,pitch=0],i)=>{
        stamp.position.set(x,y,z);stamp.scale.set(w,h,d);stamp.rotation.set(pitch,r,lean,'YXZ');stamp.updateMatrix();
        stamp.matrix.toArray(transforms,i*16);tint.setRGB(light,light*.992,light*.974).toArray(colors,i*3);
        sphere.union(probe.copy(geo.boundingSphere).applyMatrix4(stamp.matrix));
        largest=Math.max(largest,w,h,d);
      });
      sphere.radius+=1.4;
      cells.push({sphere,transforms,colors,length:items.length,lodScale:lod?.rockSize?Math.max(.46,Math.min(3.3,largest)):1});
    }
    // Cells are visibility units, not draw calls. Gather their instance ranges
    // into just one GPU draw per active detail level, even in a wide panorama.
    const group=new THREE.LOD(), previous=new THREE.Matrix4(), clip=new THREE.Matrix4(), frustum=new THREE.Frustum();
    const levels=geometries.map(geometry=>{
      const mesh=new THREE.InstancedMesh(geometry,mat,placements.length);
      mesh.name=name;mesh.frustumCulled=false;mesh.receiveShadow=true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(placements.length*3),3).setUsage(THREE.DynamicDrawUsage);
      group.add(mesh);return mesh;
    });
    group.update=camera=>{
      clip.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      if(clip.equals(previous))return;
      previous.copy(clip);frustum.setFromProjectionMatrix(clip,camera.coordinateSystem,camera.reversedDepth);
      const eye=camera.matrixWorld.elements;
      for(const m of levels)m.count=0;
      for(const cell of cells){
        if(!frustum.intersectsSphere(cell.sphere))continue;
        const c=cell.sphere.center, dist=Math.hypot(c.x-eye[12],c.y-eye[13],c.z-eye[14])/camera.zoom;
        const macro=lod?.micro&&dist<lod.micro+cell.sphere.radius*.37;
        const lodDistance=dist/cell.lodScale;
        const level=macro?3:lod?(lodDistance<lod.near?0:lodDistance<lod.mid?1:2):0;
        const count=lod?Math.ceil(cell.length*mix(1,lod.minimum,smooth(lod.thin,lod.end,dist))):cell.length;
        if(!count)continue;
        const m=levels[level];
        m.instanceMatrix.array.set(cell.transforms.subarray(0,count*16),m.count*16);
        m.instanceColor.array.set(cell.colors.subarray(0,count*3),m.count*3);m.count+=count;
      }
      for(const m of levels){
        m.visible=m.count>0;if(!m.visible)continue;
        for(const [attr,size] of [[m.instanceMatrix,16],[m.instanceColor,3]]){
          attr.clearUpdateRanges();attr.addUpdateRange(0,m.count*size);attr.needsUpdate=true;
        }
      }
    };
    scene.add(group);
  }
  const rocks=[[],[],[]], trees=[[],[],[]], herbs=[[],[],[]], ferns=[], slabs=[[],[]];
  const outer=makeRandom(85493);
  const canopy=(x,z,sz,pine,angle=0)=>{
    const y=heightAt(x,z);
    if(y<-.3 || Math.abs(heightAt(x+1,z)-y)>1.3 || Math.abs(heightAt(x,z+1)-y)>1.3 || pathDist(x,z)<2.5) return;
    const sightline=19*(z+48)/115;
    if(z>24 && z<70 && Math.abs(x-sightline)<12) return;
    const wide=.63+rr()*.81;
    trees[pine?2:rr()<.5?0:1].push([x,y-.08,z,sz*wide,sz,sz*wide,rr()*TAU,.72+rr()*.29,angle]);
  };
  // Groves gather in pockets between exposed shelves. The large silhouettes
  // echo the vertical geometry of the ruins without filling the portal.
  for(const [cx,cz,r,count] of [
    [-41,10,23,68],[-43,-22,20,62],[-65,-45,24,48],
    [54,12,21,60],[54,-23,20,53],[40,-50,15,42],
    [-19,-56,10,30],[22,-61,11,32],[2,-80,30,55],
    [47,48,13,20],[-13,52,14,14],[86,0,30,49],[-86,-7,34,52]
  ]) {
    // Groves advance in uneven fingers between exposed rock. Mature trees
    // occupy the centers and their smaller descendants gather along the edges.
    const pockets=Array.from({length:3+Math.floor(rr()*4)},()=>{
      const a=rr()*TAU,d=Math.sqrt(rr())*r*.82;
      return {x:cx+Math.cos(a)*d,z:cz+Math.sin(a)*d,
        length:r*(.19+.34*rr()),width:r*(.095+rr()*.16),
        axis:rr()*Math.PI,age:.38+rr()*.67};
    });
    for(let j=0;j<count;j++){
      const pocket=pockets[Math.floor(rr()*pockets.length)],a=rr()*TAU;
      const radial=Math.sqrt(rr()),along=Math.cos(a)*radial*pocket.length,across=Math.sin(a)*radial*pocket.width;
      const stray=j%7===0,dist=radial*r;
      const x=stray?cx+Math.cos(a)*dist:pocket.x+along*Math.cos(pocket.axis)-across*Math.sin(pocket.axis);
      const z=stray?cz+Math.sin(a)*dist:pocket.z+along*Math.sin(pocket.axis)+across*Math.cos(pocket.axis);
      const young=rr()<.32,age=young?.25+rr()*.44:pocket.age*(1-.30*radial)+rr()*.34;
      const h=1.25+age*(4.9+rr()*5.2),pine=rr()<.10+.14*pocket.age;
      canopy(x,z,h,pine,(rr()-.5)*.15);
    }
  }
  for(const [x,z,h,p] of [[-11,45,7.6,false],[-14,47,9.3,true],[40,43,6.5,false],[42,44,8.2,false],[-31,4,10.4,false],[-34,1,11.4,false],[38,-8,12.2,false]]) canopy(x,z,h,p);
  for(const [cx,cz,r] of [[-188,-54,23],[-194,-116,24],[-136,-135,33],[-106,-160,28],[-67,-147,24],
    [66,-163,26],[103,-111,17],[178,-69,23],[198,14,22],[176,76,34],[101,128,32],
    [43,162,32],[-44,140,28],[-98,138,31],[-143,83,31],[-183,31,29],[-140,177,27],[-180,-183,34]]){
    for(let i=0;i<45;i++){
      const a=outer()*TAU,d=Math.sqrt(outer())*r,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d*.65,y=heightAt(x,z);
      if(y<1||Math.abs(heightAt(x+1,z)-y)>1 || noise(x*.11,z*.11)<.33)continue;
      const h=1.55+outer()**1.45*9.3, w=h*(.72+outer()*.58);
      trees[i%5===1?2:i%2].push([x,y-.08,z,w,h,w,outer()*TAU,.68+outer()*.3,(outer()-.5)*.11]);
    }
  }
  for(let i=0;i<trees.length;i++)batch(i===2?'Wind-shaped pines':'Columnar cypress grove',
    [2,1,0].map(detail=>treeCards(THREE,i===2,detail)),canopyMaterial(THREE,491+i,i===2),trees[i],
    {tile:27,near:35,mid:82,thin:125,end:220,minimum:.85});

  // Detaching fractured outcrops from the height field creates broken cliff
  // silhouettes, shadowed blocks, scree and isolated stones on the lawns.
  for(let i=0;i<4100;i++){
    const x=-109+rr()*216,z=-103+rr()*194,y=heightAt(x,z);
    if(y< -27 || pathDist(x,z)<2.2) continue;
    const dx=heightAt(x+.9,z)-heightAt(x-.9,z),dz=heightAt(x,z+.9)-heightAt(x,z-.9);
    const steep=Math.hypot(dx,dz)>1.7;
    if(!steep && (rr()>.19 || noise(x*.12-31,z*.12)<.37))continue;
    const w=steep? .85+rr()**1.55*3.6 : .19+rr()**2*1.47;
    const h=steep? w*(.43+rr()*.99):w*(.22+rr()*.48);
    const fault=-.65+.51*Math.sin(z*.05)+.28*Math.sin(x*.08)+(rr()-.5)*.49;
    const inset=steep?Math.min(1.35,w*.34)/Math.max(.001,Math.hypot(dx,dz)):0;
    rocks[i%3].push([x+dx*inset,y-h*(steep?.43:.19),z+dz*inset,w,h,w*(.46+rr()*.46),steep?fault:rr()*TAU,.74+rr()*.23,(rr()-.5)*.21,(rr()-.5)*.14]);
  }
  for(let i=0;i<450;i++){
    const z=33+rr()*61,side=rr()<.5?-1:1,x=pathX(z)+side*(1.9+rr()**1.7*13);
    const y=heightAt(x,z); if(y<1)continue;
    const w=.075+rr()**2*.59;
    rocks[i%3].push([x,y-.04,z,w,w*(.27+rr()*.36),w*(.54+rr()*.4),rr()*TAU,.78+rr()*.25]);
  }
  const outcropMaterial=rockMaterial(THREE,geology);
  for(let i=0;i<5300;i++){
    const x=(outer()-.5)*465,z=(outer()-.5)*472;
    if(Math.abs(x)<105&&z<99&&z>-108 || Math.abs(x-6)<32&&z< -117&&z> -180)continue;
    const y=heightAt(x,z);if(y< -17||Math.hypot((x+159)/33,(z+78)/22)<1)continue;
    const sx=heightAt(x+1,z)-y,sz=heightAt(x,z+1)-y,slope=Math.abs(sx)+Math.abs(sz);
    if(slope<.5&&outer()>.21)continue;
    const w=.35+outer()**1.9*(slope>.7?4.4:2),h=w*(.24+outer()*.75);
    const inset=slope>1.15?Math.min(1.10,w*.27)/Math.max(.001,Math.hypot(sx,sz)):0;
    rocks[i%3].push([x+sx*inset,y-h*.36,z+sz*inset,w,h,w*(.47+outer()*.48),-.6+Math.sin(z*.055)+outer()*.38,.65+outer()*.32,(outer()-.5)*.23]);
  }
  for(let i=0;i<rocks.length;i++)batch('Banded weathered outcrops',
    [2,1,0].map(detail=>rockGeometry(THREE,34+i,detail)),outcropMaterial,rocks[i],
    {tile:24,near:16,mid:37,thin:49,end:160,minimum:.42,rockSize:true});
  // Each row is split at a different joint. Shifting shoulders and gaps leave
  // space for grasses to break through this former survey causeway.
  for(let z=31;z<105;){
    const len=.83+rr()*.72, xc=pathX(z), theta=Math.atan2(pathX(z+.1)-pathX(z-.1),.2);
    const half=1.03+rr()*.44, seam=(rr()-.5)*.79;
    for(const [lo,hi] of [[-half,seam],[seam+.025,half]]){
      if(rr()<.18)continue;
      const off=(lo+hi)*.5,x=xc+Math.cos(theta)*off,zz=z-Math.sin(theta)*off;
      const y=heightAt(x,zz); if(y<2)continue;
      const dYdx=(heightAt(x+.3,zz)-heightAt(x-.3,zz))/.6, dYdz=(heightAt(x,zz+.3)-heightAt(x,zz-.3))/.6;
      slabs[rr()<.5?0:1].push([x,y-.11,zz,(hi-lo)*.97,.18+rr()*.12,len*.96,theta+(rr()-.5)*.065,.7+rr()*.25, Math.atan(dYdx)*.91,-Math.atan(dYdz)*.91]);
    }
    z+=len+.051+rr()*.16;
  }
  for(let i=0;i<2;i++)batch('Fractured causeway flags', [slabGeometry(THREE,9123+i)],stoneMat,slabs[i]);

  for(let i=0;i<27500;i++){
    // Near the starting camera small leaves resolve individually. In the
    // distance the terrain itself carries the color of each meadow.
    const near=i<11500;
    const x=near?-20+rr()*71:-93+rr()*184, z=near?27+rr()*55:-90+rr()*180;
    const y=heightAt(x,z);if(y<-.4)continue;
    const slope=Math.abs(heightAt(x+.65,z)-y)+Math.abs(heightAt(x,z+.65)-y);
    if(slope>.88 || pathDist(x,z)<1.42 && rr()>.037)continue;
    const field=meadow(x,z), red=field>.55+(rr()-.5)*.21;
    const kind=red?(rr()<.32?2:1):0;
    const h=(near?.38:.6)+rr()**1.6*(near?.72:1), w=.62+rr()*.66;
    herbs[kind].push([x,y-.045,z,w,h,w,rr()*TAU,.7+rr()*.33]);
    if(i%21===0 && field<.62 && pathDist(x,z)>2) {
      const s=.52+rr()**1.6*1.03;
      ferns.push([x,y-.06,z,s,s,s,rr()*TAU,.78+rr()*.2]);
    }
  }
  const marshGrass=[];
  for(let i=0;i<17100;i++){
    const coast=i<8600,a=outer()*TAU,r=Math.sqrt(outer()),x=(coast?-153:158)+Math.sin(a)*r*55,z=(coast?-66:-10)+Math.cos(a)*r*57;
    if(!coast&&Math.hypot(x-163,z+19)<14)continue;
    const y=heightAt(x,z);
    if(y<-.48||Math.abs(heightAt(x+.7,z)-y)+Math.abs(heightAt(x,z+.7)-y)>.88||noise(x*.146,z*.146)<.25)continue;
    const scale=.47+outer()**1.4*.92;
    (coast?marshGrass:herbs[0]).push([x,y-.045,z,scale*1.15,scale,scale*1.15,outer()*TAU,.71+outer()*.29]);
  }
  const wetGrass=herbMat.clone();
  wetGrass.color.set('#98c1b2');wetGrass.onBeforeCompile=herbMat.onBeforeCompile;
  batch('Silver marsh sedges',[2,1,0,3].map(detail=>tuft(THREE,713,false,false,detail)),wetGrass,marshGrass,
    {tile:17,near:15,mid:40,micro:3,thin:17,end:105,minimum:.02});
  for(let i=0;i<3;i++)batch(['Wind grass','Crimson reed beds','Copper poppies'][i],
    [2,1,0,3].map(detail=>tuft(THREE,221+i,i!==0,i===2,detail)),herbMat,herbs[i],
    {tile:16,near:19,mid:47,micro:3,thin:18,end:113,minimum:.045});
  batch('Fern beds',[2,1,0].map(detail=>fern(THREE,detail)),herbMat,ferns,
    {tile:19,near:18,mid:42,thin:18,end:105,minimum:.025});
  const falls=waterfalls(THREE,scene);
  return {heightAt,update(time){ leafPhase.value=time; falls.uniforms.uTime.value=time; }};
}
