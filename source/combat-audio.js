// Each signature has its own register, interval and warning rhythm. Pitch
// glides, filtered noise and sidebands are synthesized at the listener.
const signatures={
  drone:[238,1.50,1], guard:[132,1.335,2], skirmisher:[331,1.26,3],
  lancer:[392,1.78,1], weaver:[262,1.90,3], mortar:[96,1.50,2],
  tideBoss:[146.83,1.498,3], forgeBoss:[98,1.414,2], warden:[123.47,1.682,3],
};
const warnings=new Set(['charge','bossPhase']);
const remote=new Set(['enemyFire','charge','kill','hit','repair','interrupt','bossPhase','orbitTurn']);
const reflected=new Set(['fire','enemyFire','kill','pulse','ward','arc','bossPhase']);
const floors={hit:.047,kill:.065,hurt:.16,enemyFire:.035,charge:.07,repair:.15,shieldBreak:.09,interrupt:.10,fire:.037,pulse:.18,ward:.25,arc:.22,dash:.15,equip:.09,bossPhase:.3,wave:.25};
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));

export function createCombatAudio(context,output){
  const noiseRate=Math.min(24000,context.sampleRate),noise=context.createBuffer(1,noiseRate*2,noiseRate);
  let seed=48271,slow=0;
  const data=noise.getChannelData(0);
  for(let i=0;i<data.length;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const white=seed/2147483648-1;slow=slow*.77+white*.23;data[i]=slow*.62+white*.39;
  }
  const voices=new Set(),last=new Map(),scoreOutput=context.createGain();
  scoreOutput.connect(output);
  const reflection=context.createGain();
  const taps=[[.086,.13,1950],[.196,.073,1180]].map(([lag,amount,frequency])=>{
    const delay=context.createDelay(.3),damp=context.createBiquadFilter(),level=context.createGain();
    delay.delayTime.value=lag;damp.type='lowpass';damp.frequency.value=frequency;damp.Q.value=.55;
    level.gain.value=amount;reflection.connect(delay).connect(damp).connect(level).connect(output);
    return {damp,level,amount,frequency};
  });
  let turn=0,burst=0;
  const maxVoices=14;
  function take(tag,priority,pan,gain,cutoff,id){
    if(voices.size>=maxVoices){
      let weakest=null;
      for(const v of voices)if(!weakest||v.priority<weakest.priority)weakest=v;
      if(weakest.priority>priority)return null;
      weakest.release();
    }
    const level=context.createGain(),filter=context.createBiquadFilter();
    const panner=context.createStereoPanner?context.createStereoPanner():null;
    if(panner)panner.pan.value=clamp(pan,-.96,.96);
    filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.6;
    level.gain.value=gain;level.connect(filter);
    if(panner)filter.connect(panner);
    const channel=panner||filter;channel.connect(tag==='music'?scoreOutput:output);
    if(reflected.has(tag))channel.connect(reflection);
    const sources=new Set(),t=context.currentTime+.008;
    const voice={tag,id,priority,release};
    voices.add(voice);
    function release(){
      if(!voices.delete(voice))return;
      const now=context.currentTime;
      level.gain.cancelScheduledValues(now);level.gain.setTargetAtTime(.0001,now,.004);
      for(const source of sources){try{source.stop(now+.02)}catch{}}
    }
    function sourceDone(source,nodes){
      source.onended=()=>{
        source.disconnect();for(const node of nodes)node.disconnect();sources.delete(source);
        if(!sources.size){voices.delete(voice);level.disconnect();filter.disconnect();panner?.disconnect()}
      };
      sources.add(source);
    }
    function envelope(amp,at,attack,tail){
      const g=context.createGain();
      g.gain.setValueAtTime(.00001,at);
      g.gain.exponentialRampToValueAtTime(Math.max(.0001,amp),at+attack);
      g.gain.exponentialRampToValueAtTime(.00001,at+attack+tail);
      g.connect(level);return g;
    }
    function tone(start,end,amp,attack,tail,delay=0,wave='sine',mod=0){
      const at=t+delay,stop=at+attack+tail+.012,osc=context.createOscillator();
      osc.type=wave;osc.frequency.setValueAtTime(start,at);osc.frequency.exponentialRampToValueAtTime(end,stop);
      const g=envelope(amp,at,attack,tail);osc.connect(g);
      if(mod){
        const side=context.createOscillator(),depth=context.createGain();
        side.frequency.value=start*1.503;depth.gain.setValueAtTime(mod,at);
        depth.gain.exponentialRampToValueAtTime(.08,at+attack+tail*.55);
        side.connect(depth).connect(osc.frequency);sourceDone(side,[depth]);side.start(at);side.stop(stop);
      }
      sourceDone(osc,[g]);osc.start(at);osc.stop(stop);
    }
    function air(start,end,amp,attack,tail,delay=0,width=.76){
      const at=t+delay,stop=at+attack+tail+.012,source=context.createBufferSource();
      source.buffer=noise;source.loop=true;
      const band=context.createBiquadFilter();band.type='bandpass';band.Q.value=width;
      band.frequency.setValueAtTime(start,at);band.frequency.exponentialRampToValueAtTime(end,stop);
      const g=envelope(amp,at,attack,tail);source.connect(band).connect(g);
      sourceDone(source,[g,band]);source.start(at,(turn++*.327)%1.9);source.stop(stop);
    }
    return {tone,air};
  }
  function cancel(test){for(const v of voices)if(test(v))v.release()}
  function play(type,pan=0,d={}){
    if(type==='skill')type=d.skillId;
    const kind=d.enemyType||d.kind||'drone',now=context.currentTime;
    const boss=kind==='warden'||kind.endsWith('Boss');
    if(d.id!=null&&['enemyFire','interrupt','kill'].includes(type))cancel(v=>v.tag==='charge'&&v.id===d.id);
    const key=warnings.has(type)?type+kind:type;
    if(now-(last.get(key)??-1)<(floors[type]||0))return;
    if(!['fire','equip','hit','kill','charge','enemyFire','repair','interrupt','hurt','shieldBreak','overheat','ready','pulse','ward','arc','dash','wave','bossPhase','win','lose','orbitTurn'].includes(type))return;
    last.set(key,now);
    const distance=remote.has(type)?clamp(Number.isFinite(d.distance)?d.distance:12,0,160):0;
    const gain=1/(1+distance*(warnings.has(type)?.009:.021));
    const priority=type==='hit'||type==='repair'?1:type==='enemyFire'||type==='equip'?2:type==='fire'||type==='kill'?3:4;
    const voice=take(type,priority,remote.has(type)?pan*.84:pan*.19,gain,6500/(1+.010*distance),d.id);
    if(!voice)return;
    const {tone,air}=voice,[base,ratio,count]=signatures[kind]||signatures.drone;
    const drift=1+Math.sin(++burst*2.399)*.024;
    switch(type){
      case 'fire':
        if(d.weaponId==='scatter'){
          tone(143,48,.208,.006,.31,0,'triangle',51);air(1420,179,.41,.006,.25);
          tone(481*drift,326,.056,.015,.29,.02,'sine',77);air(2380,460,.16,.027,.15,.042);
        }else if(d.weaponId==='orbit'){
          tone(283*drift,617,.103,.016,.29,0,'triangle',44);tone(565,831,.051,.024,.40,.022);
          air(740,2130,.12,.018,.21);tone(1020,674,.030,.033,.34,.09);
        }else if(d.weaponId==='lance'){
          tone(228*drift,94,.147,.008,.31,0,'sine',121);tone(1246,520,.082,.018,.50,0,'sine',185);
          tone(1870,736,.033,.018,.43,.024);air(2740,910,.19,.012,.20);
        }else{
          tone(345*drift,121,.154,.004,.125,0,'sine',108);tone(122,70,.092,.006,.12);
          air(1890,490,.17,.004,.09);
        }break;
      case 'equip': {
        const f=d.weaponId==='lance'?493.88:d.weaponId==='orbit'?415.30:d.weaponId==='scatter'?196:329.63;
        air(1200,460,.14,.014,.11);tone(f*.75,f,.052,.015,.16,.038);break;
      }
      case 'hit':
        if(d.shielded){tone(890,694,.065,.005,.13,0,'sine',151);tone(1358,1120,.034,.005,.10)}
        else{air(1970,620,.21,.003,.094);tone(328,176,.055,.008,.117,0,'triangle')}
        break;
      case 'kill':
        tone(base*1.4,47,.13,.012,boss?.69:.39,0,'triangle',45);
        air(1400,196,.24,.011,.31);tone(base*3.5,base*ratio,.046,.018,.38,.04);break;
      case 'charge': {
        const span=clamp(d.duration||.62,.24,2.1),high=base*ratio;
        for(let i=0;i<count;i++)tone(base*(i%2?ratio:1),high,.084,.017,.10,span*.50*i/count,'sine',base*.15);
        tone(base*.82,high,.067,span*.58,span*.21,span*.14,'triangle');
        if(boss)tone(base*.5,base*.87,.075,span*.51,.21);
        break;
      }
      case 'enemyFire':
        tone(base*ratio,base*.51,boss?.12:.091,.007,.19,0,'triangle',base*.29);
        air(base*7.2,base*1.6,.16,.009,boss?.35:.16);break;
      case 'repair':tone(base,base*ratio,.068,.032,.21);tone(base*ratio,base*2,.045,.046,.22,.12);break;
      case 'interrupt':tone(940,390,.082,.004,.10);tone(558,249,.067,.006,.14,.09);break;
      case 'orbitTurn':tone(859,512,.064,.026,.27);tone(1285,772,.024,.038,.33,.045);break;
      case 'hurt':
        tone(d.shielded?218:123,64,.143,.012,.25,0,'triangle');air(d.shielded?1320:610,201,.23,.012,.19);break;
      case 'shieldBreak':
        air(2160,260,.38,.012,.45);tone(d.side==='player'?330:760,98,.106,.015,.44,0,'sine',114);break;
      case 'overheat':tone(288,214,.064,.015,.15);tone(214,158,.06,.02,.24,.16);break;
      case 'ready':tone(330,440,.035,.016,.13);break;
      case 'pulse':
        tone(62,116,.207,.082,.83,0,'sine',17);tone(432,104,.14,.047,.74);
        air(390,1920,.29,.095,.61);break;
      case 'ward':
        for(const [i,f] of [196,293.66,392].entries())tone(f*.89,f,.077,.065,.68,i*.084);
        air(2300,810,.095,.16,.44);break;
      case 'arc':
        for(let i=0;i<4;i++){tone(711*1.13**i,197*1.13**i,.076,.004,.13,i*.066,'sine',210);air(2430,940,.16,.003,.088,i*.066)}
        break;
      case 'dash':air(515,2400,.35,.024,.18);tone(184,66,.094,.016,.21,0,'sine',23);break;
      case 'wave':tone(146.83,146.83,.064,.024,.37);tone(220,220,.059,.028,.43,.21);break;
      case 'bossPhase':
        tone(base*.5,base,.12,.13,.62,0,'triangle');tone(base*1.5,base*ratio,.11,.14,.52,.24);break;
      case 'win':[220,277.18,329.63,440].forEach((f,i)=>tone(f*.997,f,.069,.051,.96,i*.16));break;
      case 'lose':tone(146.83,73.416,.092,.10,.94);tone(164.81,110,.049,.18,1.02,.17);break;
    }
  }
  // Generated score, quietly interleaved with the wind. Regional pedals
  // retain their pitch identity as additional voices enter during encounters.
  function music(step,{tide,forge,north,battle,intensity}){
    for(const {damp,level,amount,frequency} of taps){
      level.gain.setTargetAtTime(amount*(.75+tide*.60+north*.45),context.currentTime,.6);
      damp.frequency.setTargetAtTime(frequency*(1+forge*.28-tide*.14),context.currentTime,.6);
    }
    const root=forge>.48?98:tide>.48?110:north>.48?82.41:73.416;
    const degree=[1,1.5,1.12246,1.33484][Math.floor(step/8)%4],f=root*degree;
    const phrase=step%8,main=phrase===0||battle&&phrase===4;
    if(!main&&(!battle||![2,5,7].includes(phrase)))return;
    const v=take('music',0,Math.sin(step*.83)*.34,1,2200);
    if(!v)return;
    if(main){
      v.tone(f,f,.031,battle?.044:.30,battle?.48:2.61,0,'triangle');
      v.tone(f*2.997,f*3,.018,.29,battle?.64:2.05,.075);
    }else{
      const ratio=phrase===2?2:phrase===5?2.67:1.5;
      v.tone(f*ratio,f*ratio*.998,.027+intensity*.012,.019,.26,0,'sine',14);
      if(intensity>.55&&phrase===7)v.air(634,139,.091,.007,.12);
    }
  }
  return {play,music,setMusic(value){scoreOutput.gain.setTargetAtTime(value,context.currentTime,.05)},clear:()=>{cancel(()=>true);last.clear()}};
}
