import { WORLD_BOUNDS } from './terrain.js';

export const places = [
  {
    name:'花园眺台', title:'寂静花园', latin:'The Silent Garden',
    description:'绯红花海尽头，一座失落的星门仍在等待回应。',
    position:[19,18,67], target:[-4,15,-36], fov:53,
    marker:[13,37,-44], artifact:'环状星门', coordinates:'18° 42′ N　073° 16′ E',
    entry:'星门外壳上的凹槽收集着风中的红色花粉。扫描脉冲触及内环时，尘封的导轨依次亮起，回传了一个长达十三秒的古老音节。',
    material:'矿物陶瓷 / 铜合金', frequency:'41.2 Hz',
  },
  {
    name:'星门基座', title:'天穹之环', latin:'The Meridian Gate',
    description:'穿过层叠的石阶，倾听黄铜刻盘深处的低鸣。',
    position:[-24,15,-12], target:[2,22,-49], fov:67,
    marker:[-8,6,-44], artifact:'校准刻盘', coordinates:'18° 48′ N　073° 09′ E',
    entry:'内缘的七十二枚齿片朝向不同星区。将频率对准缺失的第三枚刻度后，另一侧的接收器亮起。这里曾经是一台用整颗行星定位的仪器。',
    material:'烧结青铜 / 导光晶体', frequency:'82.4 Hz',
  },
  {
    name:'回声断崖', title:'回声断崖', latin:'The Echo Ravine',
    description:'水雾漫过折断的廊桥，远处石碑仍保留着最后一段讯号。',
    position:[-43,24,17], target:[4,10,-40], fov:61,
    marker:[-37,16,-47], artifact:'回声石碑', coordinates:'18° 39′ N　072° 58′ E',
    entry:'水流替代了早已停转的冷却泵。碑上的接点每隔一阵便短暂导通，记录仪从水声里分离出星门应答的最后一个谐音。',
    material:'风化硅岩 / 金属导线', frequency:'123.6 Hz',
  },
  {
    name:'潮汐花圃',title:'潮汐花圃',latin:'The Tidal Conservatory',
    description:'蓝色花萼沿着潮线依次亮起，池心的晶体正在应答。',
    position:[-127,19,-39],target:[-159,11,-78],fov:57,
    marker:[-159,14,-78],artifact:'潮汐谐振器',coordinates:'18° 54′ N　072° 31′ E',
    entry:'水下的沟槽从晶座一直延伸到每一株蓝花。潮水穿过沟槽时，花瓣的晶脉会把振动送回中央。你测到了两次不同的回波，其中一次来自池床以下。',
    material:'滤光晶簇 / 海蚀青铜',frequency:'164.8 Hz',
  },
  {
    name:'日冕熔炉',title:'日冕熔炉',latin:'The Helioforge',
    description:'金色镜田仍追随日光，把余热送入悬空的熔芯。',
    position:[132,23,24],target:[163,17,-19],fov:60,
    marker:[163,22,-19],artifact:'蓄光核心',coordinates:'18° 46′ N　073° 57′ E',
    entry:'每面定日镜背后都刻着相同的黄昏时刻。停摆的镜阵已错失了数千个日落，熔芯内部却仍包裹着旧恒星的一层薄光。',
    material:'蓄热陶金 / 日辉玻璃',frequency:'206.0 Hz',
  },
];

const glyphs = {
  orbit:'<circle cx="12" cy="12" r="6"/><ellipse cx="12" cy="12" rx="10" ry="3.9" transform="rotate(-32 12 12)"/>',
  map:'<path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2zM9 3v15m6-12v15"/>',
  book:'<path d="M5 3.5h12.5A1.5 1.5 0 0 1 19 5v15H6.5A2.5 2.5 0 0 1 4 17.5V5a1.5 1.5 0 0 1 1-1.5Zm-.5 14.2C4.5 16 6 16 7 16h12M8 7h6M8 10h4"/>',
  muted:'<path d="M3 9h4l5-4v14l-5-4H3zM16 9l5 6m0-6-5 6"/>',
  sound:'<path d="M3 9h4l5-4v14l-5-4H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  expand:'<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
  collapse:'<path d="M9 4v5H4m16 0h-5V4m0 16v-5h5m-16 0h5v5"/>',
  navigation:'<path d="m12 2 7.6 18-7.6-4.3L4.4 20zM12 4v11.6"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  scan:'<path d="M3 9V4h5m8 0h5v5m0 6v5h-5m-8 0H3v-5"/><path d="m12 8 4 4-4 4-4-4z"/>',
  waypoints:'<path d="m3 7 5-3 5 3-5 3zM3 12l5 3 5-3M3 17l5 3 5-3m2-11 6 3-6 3m0 2 6 3-6 3"/>',
  mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v8M6 10h12"/>',
  scroll:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 5v5"/>',
  back:'<path d="M20 12H4m7-7-7 7 7 7"/>', eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>',
  close:'<path d="m5 5 14 14M19 5 5 19"/>', check:'<path d="m4 12 5 5L20 6"/>',
};
export function drawIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    const name=el.dataset.icon;
    if(el.dataset.drawn===name) return;
    el.dataset.drawn=name;
    el.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">'+(glyphs[name]||'')+'</svg>';
  });
}

// Marching squares turns the same surface the camera explores into an elevation chart.
export function regionChart(heightAt, selected) {
  const w=400,h=169,step=5;
  const {minX,maxX,minZ,maxZ}=WORLD_BOUNDS;
  const toWorld=(x,y)=>[minX+x/w*(maxX-minX),minZ+y/h*(maxZ-minZ)];
  const field=[];
  for(let y=0;y<=h+step;y+=step){
    const row=[];
    for(let x=0;x<=w+step;x+=step) row.push(heightAt(...toWorld(x,y)));
    field.push(row);
  }
  let lines='';
  for(let level=-32;level<30;level+=3.5){
    let d='';
    for(let j=0;j<field.length-1;j++)for(let i=0;i<field[j].length-1;i++){
      const vs=[field[j][i],field[j][i+1],field[j+1][i+1],field[j+1][i]];
      const xs=[i,i+1,i+1,i],ys=[j,j,j+1,j+1],cross=[];
      for(let k=0;k<4;k++){
        const n=(k+1)%4;
        if((vs[k]<level)===(vs[n]<level))continue;
        const t=(level-vs[k])/(vs[n]-vs[k]);
        cross.push(((xs[k]+t*(xs[n]-xs[k]))*step).toFixed(1)+' '+((ys[k]+t*(ys[n]-ys[k]))*step).toFixed(1));
      }
      for(let k=0;k+1<cross.length;k+=2)d+='M'+cross[k]+'L'+cross[k+1];
    }
    lines+='<path d="'+d+'" fill="none" stroke="#969f71" stroke-opacity=".4" stroke-width=".65"/>';
  }
  const positions=places.map(p=>[(p.position[0]-minX)/(maxX-minX)*w,(p.position[2]-minZ)/(maxZ-minZ)*h]);
  const route='<polyline points="'+[3,2,0,1,4].map(i=>positions[i].join(',')).join(' ')+'" fill="none" stroke="#d7df98" stroke-dasharray="3 4" opacity=".6"/>';
  const nodes=positions.map(([x,y],i)=>'<g class="map-node" role="button" tabindex="0" data-site="'+i+'" aria-label="前往'+places[i].name+'" transform="translate('+x+' '+y+')"><circle r="7" fill="#283023" stroke="'+(i===selected?'#f0efa4':'#a6b09a')+'"/><circle r="2.1" fill="#e4eaa5"/><text x="10" y="3" fill="#e9ebbf" font-family="monospace" font-size="9">0'+(i+1)+'</text></g>').join('');
  return '<svg class="zone-map" viewBox="0 0 '+w+' '+h+'" aria-label="五个观测点的地形等高线图"><defs><pattern id="grid" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M18 0H0V18" fill="none" stroke="#9aac87" stroke-opacity=".16" stroke-width=".7"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)"/>'+lines+route+nodes+'</svg>';
}
