import {sectors} from './campaign.js';
import {heightAt} from './terrain.js';

const NS='http://www.w3.org/2000/svg', width=410,height=283;
const mapX=x=>(x+203)*.99,mapY=z=>(z+205)*.88;
let cachedContours;
function contourLines(){
  if(cachedContours)return cachedContours;
  const columns=57,rows=42,points=[];
  for(let y=0;y<=rows;y++){
    const row=[];
    for(let x=0;x<=columns;x++){
      const px=x*width/columns,py=y*height/rows;
      row.push([px,py,heightAt(px/.99-203,py/.88-205)]);
    }points.push(row);
  }
  let paths='';
  for(let level=-17;level<34;level+=3){
    let d='';
    for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
      const corners=[points[y][x],points[y][x+1],points[y+1][x+1],points[y+1][x]],cuts=[];
      for(let i=0;i<4;i++){
        const a=corners[i],b=corners[(i+1)%4];if((a[2]>level)===(b[2]>level))continue;
        const t=(level-a[2])/(b[2]-a[2]);cuts.push([(a[0]+(b[0]-a[0])*t).toFixed(1),(a[1]+(b[1]-a[1])*t).toFixed(1)]);
      }
      for(let j=0;j+1<cuts.length;j+=2)d+='M'+cuts[j]+'L'+cuts[j+1];
    }
    paths+='<path d="'+d+'"/>';
  }
  cachedContours=paths;return paths;
}
export function buildChart(svg,campaign,select){
  svg.setAttribute('viewBox','0 0 '+width+' '+height);
  svg.innerHTML='<g class="contours">'+contourLines()+'</g><g class="roads"></g><g class="nodes"></g><path class="pilot-pin" d="M0 -6 4.6 4 0 2 -4.6 4Z"/>';
  const roads=svg.querySelector('.roads'),nodes=svg.querySelector('.nodes'),pin=svg.querySelector('.pilot-pin');
  const place=(s)=>[mapX(s.entry[0]),mapY(s.entry[1])];
  const links=[];
  for(const s of sectors)for(const id of s.requires){
    const [x,y]=place(sectors.find(v=>v.id===id)),[nx,ny]=place(s);
    const edge=document.createElementNS(NS,'path');edge.setAttribute('d','M'+x+' '+y+' Q'+((x+nx)/2)+' '+(y*.65+ny*.35)+' '+nx+' '+ny);roads.append(edge);links.push([edge,id]);
  }
  const points=sectors.map((s,i)=>{
    const [x,y]=place(s),g=document.createElementNS(NS,'g');g.setAttribute('transform','translate('+x+' '+y+')');
    g.innerHTML='<circle class="zone-ring" r="13"/><path class="zone-symbol" d="M0 -7 7 0 0 7 -7 0Z"/><text x="17" y="4">0'+(i+1)+'</text>';
    g.addEventListener('click',()=>select(s));nodes.append(g);return g;
  });
  return {update(selected,position,heading=0){
    points.forEach((p,i)=>{const s=sectors[i];p.setAttribute('class',campaign.cleared.has(s.id)?'cleared':campaign.available(s)?'available':'locked');p.classList.toggle('selected',s===selected)});
    for(const [p,id] of links)p.setAttribute('class',campaign.cleared.has(id)?'open':'');
    pin.setAttribute('visibility',position?'visible':'hidden');
    if(position)pin.setAttribute('transform','translate('+mapX(position.x)+' '+mapY(position.z)+') rotate('+heading+')');
  }};
}
