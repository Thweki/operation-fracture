import {createCombatAudio} from './combat-audio.js';

function envelope(parameter, time, peak, attack, decay) {
  parameter.setValueAtTime(0.0001,time);
  parameter.exponentialRampToValueAtTime(peak,time+attack);
  parameter.exponentialRampToValueAtTime(0.0001,time+attack+decay);
}

function placeInStereo(context, position, output) {
  if (!context.createStereoPanner) return output;
  const panner = context.createStereoPanner();
  panner.pan.value = position;
  panner.connect(output);
  return panner;
}

function windyAir(context, output) {
  const seconds = 12;
  const sampleCount = Math.floor(context.sampleRate*seconds);
  const buffer = context.createBuffer(1,sampleCount,context.sampleRate);
  const wave = buffer.getChannelData(0);
  let rumble=0;
  let soft=0;
  for(let i=0;i<sampleCount;i++) {
    const white = Math.random()*2-1;
    rumble = rumble*0.974+white*0.026;
    soft = soft*0.72+white*0.28;
    wave[i]=rumble*1.5+soft*0.28;
  }
  // Crossfade the ends into an unbroken, slowly breathing noise floor.
  const blend=Math.floor(context.sampleRate*0.12);
  for(let i=0;i<blend;i++) {
    const t=i/blend;
    wave[sampleCount-blend+i]=wave[sampleCount-blend+i]*(1-t)+wave[i]*t;
  }
  for(const [pan,frequency,rate,volume,offset] of [[-0.52,470,0.036,0.23,0.8],[0.56,690,0.049,0.17,5.3]]) {
    const source=context.createBufferSource();
    source.buffer=buffer;
    source.loop=true;
    source.loopStart=blend/context.sampleRate;
    source.loopEnd=seconds;
    const highpass=context.createBiquadFilter();
    highpass.type='highpass';
    highpass.frequency.value=78;
    const lowpass=context.createBiquadFilter();
    lowpass.type='lowpass';
    lowpass.frequency.value=frequency;
    lowpass.Q.value=0.5;
    const gust=context.createOscillator();
    gust.frequency.value=rate;
    const shift=context.createGain();
    shift.gain.value=frequency*0.43;
    gust.connect(shift).connect(lowpass.frequency);
    const level=context.createGain();
    level.gain.value=volume;
    source.connect(highpass).connect(lowpass).connect(level).connect(placeInStereo(context,pan,output));
    source.start(0,offset);
    gust.start();
  }
}

function resonantFloor(context,output) {
  // Just fifths above the low D share partials with the activation chime.
  for(const [frequency,loudness,pan] of [[73.416,0.035,-0.22],[110.124,0.014,0.26],[184.99,0.004,-0.48]]) {
    const oscillator=context.createOscillator();
    oscillator.frequency.value=frequency;
    oscillator.type='sine';
    const level=context.createGain();
    level.gain.value=loudness;
    const breath=context.createOscillator();
    breath.frequency.value=0.025+frequency*0.00013;
    const depth=context.createGain();
    depth.gain.value=loudness*0.43;
    breath.connect(depth).connect(level.gain);
    oscillator.connect(level).connect(placeInStereo(context,pan,output));
    oscillator.start();
    breath.start();
  }
}

function struckTone(context,output,time,startHz,endHz,volume,attack,tail) {
  const oscillator=context.createOscillator();
  oscillator.frequency.setValueAtTime(startHz,time);
  oscillator.frequency.exponentialRampToValueAtTime(endHz,time+attack+tail);
  const gain=context.createGain();
  envelope(gain.gain,time,volume,attack,tail);
  oscillator.connect(gain).connect(output);
  oscillator.onended=()=>{
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(time);
  oscillator.stop(time+attack+tail+0.025);
}

export function createAmbience() {
  let context=null;
  let master,reflections,left,right,center,thermalGain,mixer,output;
  let volume=1,musicVolume=1;
  let tide=0,forge=0,north=0;
  let enabled=false;
  let birdTimer=0,fadeTimer=0,musicTimer=0,musicStep=0;
  let battle=false,paused=false,intensity=0,focused=true;
  let revision=0;

  function prepareDevice(idle=false) {
    if(context)return true;
    const Audio=window.AudioContext || window.webkitAudioContext;
    if(!Audio)return false;
    try{
      context=new Audio({latencyHint:'interactive'});
      if(idle&&context.state==='running')void context.suspend().catch(()=>{});
      return true;
    }catch{return false}
  }
  function initialize() {
    if(!prepareDevice())return false;
    master=context.createGain();
    master.gain.value=0;
    const limiter=context.createDynamicsCompressor();
    limiter.threshold.value=-13;limiter.knee.value=11;limiter.ratio.value=5;
    limiter.attack.value=.006;limiter.release.value=.19;
    output=context.createGain();output.gain.value=volume;
    master.connect(limiter).connect(output).connect(context.destination);
    mixer=createCombatAudio(context,master);
    mixer.setMusic(musicVolume);
    reflections=context.createGain();
    reflections.connect(master);
    const delay=context.createDelay(1.0);
    delay.delayTime.value=0.43;
    const echo=context.createGain();
    echo.gain.value=0.22;
    const absorption=context.createBiquadFilter();
    absorption.type='lowpass';
    absorption.frequency.value=1700;
    reflections.connect(delay).connect(absorption).connect(echo);
    echo.connect(delay);
    echo.connect(placeInStereo(context,-0.27,master));
    left=placeInStereo(context,-0.59,reflections);
    right=placeInStereo(context,0.63,reflections);
    center=placeInStereo(context,0.055,reflections);
    windyAir(context,master);
    resonantFloor(context,master);
    const turbine=context.createOscillator(),filter=context.createBiquadFilter();
    turbine.type='triangle';turbine.frequency.value=49.06;
    filter.type='lowpass';filter.frequency.value=340;filter.Q.value=.45;
    thermalGain=context.createGain();thermalGain.gain.value=forge*.044;
    turbine.connect(filter).connect(thermalGain).connect(right);turbine.start();
    focused=!document.hidden;
    window.addEventListener('blur',()=>{focused=false;void sync()});
    window.addEventListener('focus',()=>{focused=true;void sync()});
    document.addEventListener('visibilitychange',()=>{
      focused=!document.hidden&&document.hasFocus();
      void sync();
    });
    return true;
  }
  function setClimate(weights){
    tide=weights.x;north=weights.z;
    if(Math.abs(weights.y-forge)<.012)return;
    forge=weights.y;
    if(thermalGain)thermalGain.gain.setTargetAtTime(forge*.044,context.currentTime,.8);
  }

  function scheduleBird(first=false) {
    clearTimeout(birdTimer);
    birdTimer=setTimeout(()=>{
      if(!audible())return;
      if(context.state==='running'&&!battle) {
        const start=context.currentTime+0.035;
        const position=Math.random()>0.5?left:right;
        if(tide>.55){
          const f=Math.random()>.5?659.25:880;
          struckTone(context,position,start,f*1.008,f,.023,.012,.82);
          struckTone(context,position===left?right:left,start+.36,f*1.5,f*1.499,.010,.06,1.21);
        }else if(forge>.55||north>.55){
          const f=forge>.55?98:146.83;
          struckTone(context,position,start,f*1.004,f,.028,.16,1.3);
          struckTone(context,position,start+.21,f*2.39,f*2.37,.012,.06,.85);
        }else{
          const base=1390+Math.random()*540;
          struckTone(context,position,start,base*0.85,base*1.15,0.013,0.054,0.12);
          struckTone(context,position,start+0.24,base*1.11,base*0.90,0.010,0.045,0.19);
        }
      }
      scheduleBird();
    },(first?4.4:11.0)*1000+Math.random()*7200);
  }

  function audible(){return enabled&&focused&&!document.hidden}
  function score(){
    clearTimeout(musicTimer);
    if(!audible()||paused||context.state!=='running')return;
    mixer.music(musicStep++,{tide,forge,north,battle,intensity});
    musicTimer=setTimeout(score,battle?(intensity>.55?295:370):690);
  }
  async function sync(){
    if(!context)return;
    const version=++revision,on=audible();
    clearTimeout(fadeTimer);clearTimeout(birdTimer);clearTimeout(musicTimer);
    try {
      if(on) {
        await context.resume();
        if(version!==revision)return;
      }else mixer.clear();
      const t=context.currentTime;
      if(master.gain.cancelAndHoldAtTime) master.gain.cancelAndHoldAtTime(t);
      else {
        const current=master.gain.value;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(current,t);
      }
      master.gain.linearRampToValueAtTime(on?.72:0,t+(on?.52:.09));
      if(on){scheduleBird(true);score()}
      else fadeTimer=setTimeout(()=>{
        if(!audible()&&version===revision)context.suspend().catch(()=>{});
      },130);
    } catch {
      if(version===revision) enabled=false;
    }
  }
  async function setEnabled(on){
    if(on===enabled)return enabled;
    try{if(on&&!master&&!initialize())return false}
    catch{return false}
    enabled=on;
    await sync();
    return enabled;
  }

  function pulse() {
    if(!audible()||context?.state!=='running'||paused)return;
    const t=context.currentTime+0.02;
    struckTone(context,center,t,146.832,146.832,0.084,0.14,2.8);
    struckTone(context,left,t+0.05,440.52,440.25,0.042,0.08,2.0);
    struckTone(context,right,t+0.13,733.92,734.16,0.017,0.055,2.8);
    struckTone(context,center,t+0.31,1174.8,1174.3,0.009,0.09,2.1);
  }
  function combat(type,pan=0,details={}){
    if(type==='start'||type==='wave'||type==='bossPhase'){
      battle=true;paused=false;
      intensity=type==='bossPhase'||details.boss?1:Math.min(.80,(details.wave||1)*.23);
      if(type==='start')musicStep=0;
    }else if(type==='stop'||type==='win'||type==='lose'){
      battle=false;paused=false;intensity=0;
      if(type==='stop')mixer?.clear();
    }else if(type==='intermission'){intensity=.08}
    else if(type==='pause'||type==='resume'){
      paused=type==='pause';
      if(paused)mixer?.clear();
    }
    if(!audible()||context?.state!=='running')return;
    if(['pause','resume','start','stop'].includes(type))score();
    if(!paused)mixer.play(type,pan,details);
  }
  function setLevels(main,music){
    volume=Math.min(1,Math.max(0,main));musicVolume=Math.min(1,Math.max(0,music));
    if(output)output.gain.setTargetAtTime(volume,context.currentTime,.04);
    mixer?.setMusic(musicVolume);
  }
  return {prepareDevice,setEnabled,toggle:()=>setEnabled(!enabled),pulse,combat,setClimate,setLevels,get enabled(){return enabled;}};
}
