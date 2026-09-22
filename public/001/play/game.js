'use strict';

const canvas=document.querySelector('canvas');
const ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;
const $=selector=>document.querySelector(selector);
const keys=new Set();
const finePointer=window.matchMedia?.('(hover:hover) and (pointer:fine)').matches||false;
let sessionRound=0,guideUntil=0,guideVisible=false,guideMoveVisible=false,guideCleanVisible=false;
let stainGuideLearned=false,dustGuideLearned=false,toolGuide='';
let resultRevealAt=0,resultEndAt=0,clockOutAt=0;
const BGM_URL='assets/audio/gameplay/calm-alert-understated-game-loop.mp3';
const BGM_VOLUME=.18;
const DOOR_SFX_URL='assets/audio/gameplay/door-v3-lower-soft-rail.mp3';
const DOOR_SFX_GAIN=.20;
const DOOR_SFX_DELAY_MS=125;
const PERSONAL_BEST_KEY='clockout-core-best-v01';
let bgmBytesPromise=typeof fetch==='function'?fetch(BGM_URL,{cache:'force-cache'}).then(response=>{
  if(!response.ok)throw new Error(`BGM ${response.status}`);
  return response.arrayBuffer();
}).catch(error=>{console.warn('[BGM preload]',error);return null;}):Promise.resolve(null);
let bgmBufferPromise=null,bgmSource=null,bgmGain=null,bgmGeneration=0;
let doorSfxBytesPromise=typeof fetch==='function'?fetch(DOOR_SFX_URL,{cache:'force-cache'}).then(response=>{
  if(!response.ok)throw new Error(`Door SFX ${response.status}`);
  return response.arrayBuffer();
}).catch(error=>{console.warn('[Door SFX preload]',error);return null;}):Promise.resolve(null);
let doorSfxBufferPromise=null,doorSfxSource=null,doorSfxGain=null,doorSfxGeneration=0,doorSfxDueAt=0,doorSfxPlayed=false;
function setGuideCards(kind,dismissed){
  for(const platform of ['mobile','desktop'])$(`#${platform}-${kind}-guide`).classList.toggle('dismissed',dismissed);
}
function dismissInitialGuide(kind='all'){
  if(kind==='all'||kind==='move'){
    guideMoveVisible=false;
    setGuideCards('move',true);
  }
  if(kind==='all'||kind==='clean'){
    guideCleanVisible=false;
    setGuideCards('clean',true);
  }
  guideVisible=guideMoveVisible||guideCleanVisible;
}
function showInitialGuide(){
  guideMoveVisible=guideCleanVisible=guideVisible=true;
  guideUntil=performance.now()+5000;
  setGuideCards('move',false);
  setGuideCards('clean',false);
}

// Each target independently selects an authored, previously exercised slot.
const placementGenerator=PlacementPool.createGenerator(Math.random);
const TRAIL_MARKS=[[-36,-24],[-18,-12],[0,0],[18,12],[36,24]];
// Approved isolated SPOT v3: 2px cells, 30x22px footprint, four dirt tones.
const SPOT_MASK=[
  '......33.......',
  '...332223...3..',
  '..322111223....',
  '.221110111122..',
  '221100000111223',
  '21100000001122.',
  '.1110000011122.',
  '..2211111122...',
  '3..22211122....',
  '....32222..3...',
  '.......3.......'
];
let currentPlacement=null;
let STAIN_START=[];
let DUST={x:0,y:0};
let MAT={x:180,y:458,kind:5};
let TRASH_START=[];
const BINS=[{x:267,y:200,category:"recycle"},{x:322,y:200,category:"general"}];
let stains=[],activeStain=null,done={},trash=[],carrying=null,resetting=null,binShake=null,deposit=null;
function surface(){return mode==='dust'?DUST:activeStain;}
const PLAYER_START={x:180,y:367,dir:'down'};
const CELL_SIZE=2;
const CLEAN_RADIUS=10;
const COMPLETION_THRESHOLD=.92;
const MOP_LIMIT_X=52;
const MOP_LIMIT_Y=34;
const MOP_DEADZONE=.55;
const MOP_KEY_SPEED=82;
const obstacles=[[18,158,49,53],[17,451,41,37],[305,452,24,28]];
let started=0;
let elapsed=0;
let completionElapsedMs=null;
let personalBestMs=readPersonalBest();
let phase='ready';
let resultSuccess=false;
let isNewBest=false;
let timeoutMatDegrees=null;

let mode="stain";
let dust=[];
let dustState="scattered";
const DUST_THRESHOLD=.875;
const MERGE_DISTANCE=14;
const DUST_START=[{x:-30,y:-16,mass:1},{x:26,y:-16,mass:1},{x:-24,y:18,mass:1},{x:30,y:18,mass:1}];
let player;
let dirt=[];
let totalDirt=0;
let cleaning=false;
let completed=false;
let cleaningFinish=null;
let mop={x:0,y:0};
let joy={x:0,y:0,id:null};
let wipePointerId=null;
let pointerLast=null;
let keyboardDirection=0;
let keyboardLane=0;
let last=performance.now();
let walk=0;
let lastScrub=0;

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function curveY(x){return 17*Math.sin(x/38*Math.PI)+x*.08;}

// Latest Stain Pattern v0.2 geometry: deterministic irregular edges and density.
function createDirt(pattern,orientation='horizontal'){
  if(pattern==='spot'){
    const cells=[];
    for(let row=0;row<SPOT_MASK.length;row++)for(let column=0;column<SPOT_MASK[row].length;column++){
      const tone=Number(SPOT_MASK[row][column]);
      if(Number.isNaN(tone))continue;
      cells.push({x:-14+column*CELL_SIZE,y:-10+row*CELL_SIZE,dirty:true,tone,mark:-1});
    }
    return cells;
  }
  const cells=[];
  for(let y=-32;y<=32;y+=2)for(let x=-48;x<=48;x+=2){
    let density=0,mark=-1;
    const fringe=.10*Math.sin(x*.73+y*.41)+.07*Math.cos(x*.29-y*.83);
    if(pattern==='streak'){
      const center=2*Math.sin(x*.13)+x*.035;
      const width=7+3*Math.cos(x*.065)+1.3*Math.sin(x*.37);
      density=1-Math.max(Math.abs(x)/46,Math.abs(y-center)/width)+fringe;
    }else if(pattern==='trail'){
      const sizes=[[7,6],[8,5],[6,7],[8,6],[6,5]];
      for(let index=0;index<TRAIL_MARKS.length;index++){
        const [centerX,centerY]=TRAIL_MARKS[index];
        const [radiusX,radiusY]=sizes[index];
        const dx=x-centerX,dy=y-centerY;
        const markDensity=1-Math.sqrt(((dx+dy*.22)/radiusX)**2+(dy/radiusY)**2)+fringe;
        if(markDensity>density){density=markDensity;mark=index;}
      }
    }else{
      const width=5.5+1.2*Math.sin(x*.21)+.8*Math.cos(x*.47);
      density=1-Math.max(Math.abs(x)/44,Math.abs(y-curveY(x))/width)+fringe;
    }
    if(density<=0)continue;
    const tone=density<.22?3:density<.43?2:density<.68?1:0;
    cells.push({x,y,dirty:true,tone,mark});
  }
  if(pattern==='streak'&&orientation==='vertical'){
    return cells.map(cell=>({...cell,x:-cell.y,y:cell.x}));
  }
  if(pattern==='s-curve'){
    const cellMap=new Map(cells.map(cell=>[cell.x+','+cell.y,cell]));
    const visited=new Set(),stack=[cellMap.get('0,0')];
    while(stack.length){
      const cell=stack.pop();
      const key=cell.x+','+cell.y;
      if(visited.has(key))continue;
      visited.add(key);
      for(let dx=-2;dx<=2;dx+=2)for(let dy=-2;dy<=2;dy+=2){
        const next=(cell.x+dx)+','+(cell.y+dy);
        if(cellMap.has(next)&&!visited.has(next))stack.push(cellMap.get(next));
      }
    }
    return cells.filter(cell=>visited.has(cell.x+','+cell.y));
  }
  return cells;
}

function remainingDirt(){
  let remaining=0;
  for(const cell of dirt)if(cell.dirty)remaining++;
  return remaining;
}

function cleanedCoverage(){
  return totalDirt?(totalDirt-remainingDirt())/totalDirt:1;
}

function clearWipePointer(){
  wipePointerId=null;
  pointerLast=null;
}

function activatePlacement(generated){
  const combination=generated.combination??generated;
  currentPlacement={
    combination,
    signature:generated.signature??PlacementPool.combinationSignature(combination),
    conflictRerolls:generated.conflictRerolls??0,
    fallback:Boolean(generated.fallback)
  };
  const authoredStains=[
    {id:'streak',pattern:'streak',...combination.streak},
    {id:'sCurve',pattern:'s-curve',...combination.sCurve},
    {id:'spot',pattern:'spot',...combination.spot}
  ];
  STAIN_START=authoredStains.map(stain=>{
    const target={
      ...stain,
      interactionX:stain.interactionX??stain.x,
      interactionY:stain.interactionY??stain.y
    };
    return stain.pattern==='streak'?{
      ...target,
      axis:stain.orientation==='vertical'?{x:0,y:1}:{x:1,y:0}
    }:target;
  });
  DUST={...combination.dust};
  MAT={x:180,y:458,kind:5};
  TRASH_START=[
    {id:'pet',category:'recycle',kind:3,...combination.pet},
    {id:'tissue',category:'general',kind:4,...combination.tissue}
  ].map(item=>({
    ...item,
    interactionX:item.interactionX??item.x,
    interactionY:item.interactionY??item.y
  }));
  console.info('[Integration Candidate v2]\n'+PlacementPool.combinationSummary(combination),{
    signature:currentPlacement.signature,
    conflictRerolls:currentPlacement.conflictRerolls,
    fallback:currentPlacement.fallback
  });
}

function resetTest(generated=placementGenerator.generate()){
  stopBgm();
  stopDoorSfx();
  activatePlacement(generated);
  sessionRound++;
  const showOpening=sessionRound===1;
  guideMoveVisible=guideCleanVisible=guideVisible=false;
  guideUntil=0;
  setGuideCards('move',true);
  setGuideCards('clean',true);
  toolGuide='';
  resultRevealAt=resultEndAt=clockOutAt=doorSfxDueAt=0;
  doorSfxPlayed=false;
  $('#result').classList.remove('result-enter');
  $('#result').classList.remove('result-success');
  player={...PLAYER_START};
  stains=STAIN_START.map(stain=>{
    const cells=createDirt(stain.pattern,stain.orientation);
    return{...stain,dirt:cells,total:cells.length,done:false};
  });
  activeStain=null;
  dirt=[];
  dust=DUST_START.map(p=>({...p}));
  dustState="scattered";
  done={mat:false};trash=TRASH_START.map(t=>({...t,done:false}));
  carrying=resetting=binShake=deposit=null;mode="stain";
  totalDirt=0;
  cleaning=false;
  completed=false;
  cleaningFinish=null;
  mop={x:0,y:0};
  walk=0;
  lastScrub=0;
  keyboardDirection=0;
  keyboardLane=0;
  keys.clear();
  joy={x:0,y:0,id:null};
  clearWipePointer();
  $('#joystick i').style.transform='';
  $('#clean').classList.remove('active');
  phase=showOpening?'opening':'ready';
  started=0;
  elapsed=0;
  completionElapsedMs=null;
  resultSuccess=false;
  isNewBest=false;
  timeoutMatDegrees=null;
  $('#clock').textContent=clock(0);
  $('#result').hidden=true;
  $('#result-title').textContent='';
  $('#result-elapsed').hidden=true;
  $('#result-elapsed-value').textContent='';
  $('#result-new-best').hidden=true;
  $('#result-time').textContent=clock(0);
  $('#result-progress').textContent='CLEAN 0 / 7';
  $('#opening').hidden=!showOpening;
  updateBrand();
  setHint();
  setProgress();
  inyoungMotion.entity=null;
  last=performance.now();
  if(!showOpening)startBgm();
}

let audio;
function initAudio(){
  try{
    if(!audio){
      audio=new(window.AudioContext||window.webkitAudioContext)();
      const oscillator=audio.createOscillator();
      const gain=audio.createGain();
      oscillator.frequency.value=70;
      gain.gain.value=.003;
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
    }
    const resumed=audio.resume();
    if(resumed?.catch)resumed.catch(()=>{});
    return audio;
  }catch{return null;}
}

function decodeBgm(){
  const context=initAudio();
  if(!context)return Promise.resolve(null);
  if(!bgmBufferPromise)bgmBufferPromise=bgmBytesPromise.then(bytes=>{
    if(!bytes)return null;
    return context.decodeAudioData(bytes.slice(0));
  }).catch(error=>{console.warn('[BGM decode]',error);return null;});
  return bgmBufferPromise;
}

function stopBgm(){
  bgmGeneration++;
  if(bgmSource){try{bgmSource.stop();}catch{}try{bgmSource.disconnect();}catch{}}
  if(bgmGain)try{bgmGain.disconnect();}catch{}
  bgmSource=null;
  bgmGain=null;
}

function startBgm(){
  stopBgm();
  const generation=bgmGeneration;
  decodeBgm().then(buffer=>{
    if(!buffer||generation!==bgmGeneration||phase==='opening'||phase==='ending'||phase==='result')return;
    const source=audio.createBufferSource();
    const gain=audio.createGain();
    source.buffer=buffer;
    source.loop=true;
    gain.gain.value=BGM_VOLUME;
    source.connect(gain);
    gain.connect(audio.destination);
    source.onended=()=>{
      if(bgmSource===source){try{gain.disconnect();}catch{}bgmSource=null;bgmGain=null;}
    };
    bgmSource=source;
    bgmGain=gain;
    source.start(0,0);
  }).catch(error=>console.warn('[BGM start]',error));
}

function fadeOutBgm(durationMs){
  if(!audio||!bgmSource||!bgmGain)return;
  const source=bgmSource;
  const gain=bgmGain;
  const now=audio.currentTime;
  try{
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(.0001,gain.gain.value),now);
    gain.gain.linearRampToValueAtTime(.0001,now+durationMs/1000);
    source.stop(now+durationMs/1000);
  }catch{stopBgm();}
}

function decodeDoorSfx(){
  const context=initAudio();
  if(!context)return Promise.resolve(null);
  if(!doorSfxBufferPromise)doorSfxBufferPromise=doorSfxBytesPromise.then(bytes=>{
    if(!bytes)return null;
    return context.decodeAudioData(bytes.slice(0));
  }).catch(error=>{console.warn('[Door SFX decode]',error);return null;});
  return doorSfxBufferPromise;
}

function stopDoorSfx(){
  doorSfxGeneration++;
  if(doorSfxSource){try{doorSfxSource.stop();}catch{}try{doorSfxSource.disconnect();}catch{}}
  if(doorSfxGain)try{doorSfxGain.disconnect();}catch{}
  doorSfxSource=null;
  doorSfxGain=null;
  doorSfxDueAt=0;
}

function scheduleDoorSfx(delayMs=DOOR_SFX_DELAY_MS){
  if(doorSfxPlayed||!audio||!resultSuccess||phase!=='ending')return;
  doorSfxPlayed=true;
  const generation=doorSfxGeneration;
  doorSfxDueAt=audio.currentTime+delayMs/1000;
  decodeDoorSfx().then(buffer=>{
    if(!buffer||generation!==doorSfxGeneration||!resultSuccess||phase!=='ending')return;
    const source=audio.createBufferSource();
    const gain=audio.createGain();
    source.buffer=buffer;
    source.loop=false;
    gain.gain.value=DOOR_SFX_GAIN;
    source.connect(gain);
    gain.connect(audio.destination);
    source.onended=()=>{
      if(doorSfxSource===source){try{gain.disconnect();}catch{}doorSfxSource=null;doorSfxGain=null;}
    };
    doorSfxSource=source;
    doorSfxGain=gain;
    source.start(Math.max(audio.currentTime,doorSfxDueAt));
  }).catch(error=>console.warn('[Door SFX start]',error));
}

function sound(type){
  if(!audio)return;
  const time=audio.currentTime;
  const gain=audio.createGain();
  gain.connect(audio.destination);
  gain.gain.setValueAtTime(type==='scrub'?.024:.035,time);
  gain.gain.exponentialRampToValueAtTime(.001,time+.13);
  if(type==='scrub'){
    const buffer=audio.createBuffer(1,audio.sampleRate*.15,audio.sampleRate);
    const data=buffer.getChannelData(0);
    for(let index=0;index<data.length;index++)data[index]=Math.random()*2-1;
    const noise=audio.createBufferSource();
    noise.buffer=buffer;
    const filter=audio.createBiquadFilter();
    filter.type='lowpass';
    filter.frequency.value=1600;
    noise.connect(filter);
    filter.connect(gain);
    noise.start();
  }else{
    const oscillator=audio.createOscillator();
    oscillator.type='sine';
    oscillator.frequency.value=830;
    oscillator.connect(gain);
    oscillator.start(time);
    oscillator.stop(time+.14);
  }
}

function taskCount(){return stains.filter(stain=>stain.done).length+(dustState==='disposed'?1:0)+trash.filter(item=>item.done).length+(done.mat?1:0);}
function allDone(){return taskCount()===7;}
function setProgress(){$('#progress').textContent=`CLEAN ${taskCount()} / 7`;}
function clock(time){const seconds=Math.min(60,Math.floor(time));return seconds===60?'18:00:00':`17:59:${String(seconds).padStart(2,'0')}`;}
function formatCentiseconds(milliseconds){
  const microseconds=Math.round(Math.max(0,milliseconds)*1000);
  const centiseconds=Math.floor((microseconds+5000)/10000);
  return`${Math.floor(centiseconds/100)}.${String(centiseconds%100).padStart(2,'0')}`;
}
function validPersonalBest(milliseconds){return Number.isFinite(milliseconds)&&milliseconds>0&&milliseconds<=60000;}
function readPersonalBest(){
  try{
    const stored=localStorage.getItem(PERSONAL_BEST_KEY);
    if(stored===null||!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(stored))return null;
    const milliseconds=Number(stored);
    return validPersonalBest(milliseconds)?milliseconds:null;
  }catch{return null;}
}
function savePersonalBest(milliseconds){
  if(!validPersonalBest(milliseconds)||(personalBestMs!==null&&milliseconds>=personalBestMs))return false;
  personalBestMs=milliseconds;
  try{localStorage.setItem(PERSONAL_BEST_KEY,String(milliseconds));}catch{}
  return true;
}
function updateBrand(){$('#brand').textContent=personalBestMs===null?'퇴근 전':`BEST ${formatCentiseconds(personalBestMs)}`;}
function beginRound(now){
  if(phase!=='ready')return;
  started=now;
  elapsed=0;
  phase='playing';
  dismissInitialGuide('move');
  initAudio();
}
function currentMatDegrees(now){
  const progress=done.mat?1:resetting?Math.min(1,(now-resetting.start)/300):0;
  return(1-progress)*MAT_UNALIGNED_DEGREES;
}
function finishRound(success,now){
  if(phase==='ending'||phase==='result')return;
  completionElapsedMs=success?Math.min(60000,Math.max(0,now-started)):null;
  elapsed=success?completionElapsedMs/1000:60;
  const previousBestRaw=personalBestMs;
  const hadPreviousBest=previousBestRaw!==null;
  isNewBest=success&&hadPreviousBest&&completionElapsedMs<previousBestRaw;
  if(success)savePersonalBest(completionElapsedMs);
  resultSuccess=success;
  clockOutAt=success?now:0;
  timeoutMatDegrees=success?null:currentMatDegrees(now);
  phase=success?'ending':'result';
  resultRevealAt=now+1000;
  resultEndAt=now+1200;
  fadeOutBgm(success?600:250);
  if(success)scheduleDoorSfx();
  else stopDoorSfx();
  dismissInitialGuide();
  toolGuide='';
  cleaning=false;
  if(!success)cleaningFinish=null;
  resetting=null;
  keyboardDirection=0;
  keyboardLane=0;
  keys.clear();
  joy={x:0,y:0,id:null};
  clearWipePointer();
  $('#joystick i').style.transform='';
  $('#clean').classList.remove('active');
  setHint();
  if(carrying)carrying.pickedAt=now-120;
  Object.assign(inyoungMotion,{x:player.x,y:player.y,moving:false,time:0,last:now,frame:'idle'});
  $('#clock').textContent=clock(elapsed);
  $('#result-title').textContent=success?'퇴근!':'';
  $('#result').classList.toggle('result-success',success);
  $('#result-elapsed').hidden=!success;
  $('#result-elapsed-value').textContent=success?formatCentiseconds(completionElapsedMs):'';
  $('#result-new-best').hidden=!isNewBest;
  $('#result-time').textContent=clock(elapsed);
  $('#result-progress').textContent=`CLEAN ${taskCount()} / 7`;
  $('#result').hidden=success;
}
function expireRound(now){
  if(phase==='playing'&&now-started>=60000){finishRound(false,now);return true;}
  return phase==='ending'||phase==='result';
}
function updateProgress(now=performance.now()){
  setProgress();
  if(allDone())finishRound(true,now);
}
function near(){
  const candidates=carrying?BINS.map(b=>({...b,type:'bin'})):[
    ...stains.filter(stain=>!stain.done).map(stain=>({x:stain.interactionX,y:stain.interactionY,type:'stain',item:stain})),
    ...(dustState==="pileReady"?[{x:DUST.x+dust[0].x,y:DUST.y+dust[0].y,type:"dustPickup"}]:dustState==="scattered"?[{...DUST,type:"dust"}]:[]),
    ...(!done.mat?[{...MAT,type:'mat'}]:[]),
    ...trash.filter(t=>!t.done).map(t=>({x:t.interactionX,y:t.interactionY,type:'trash',item:t}))
  ];
  return candidates.map(t=>({t,d:Math.hypot(t.x-player.x,t.y-player.y)})).filter(v=>v.d<(carrying?44:43)).sort((a,b)=>a.d-b.d)[0]?.t||null;
}
function faceStain(){
  const center=surface(),dx=center.x-player.x,dy=center.y-player.y;
  inyoungMotion.direction=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'front':'back');
}
function clean(){
  if(phase==='opening')return;
  toolGuide='';
  const now=performance.now();
  initAudio();
  if(phase!=='playing'||expireRound(now))return;
  if(cleaningFinish||resetting||allDone())return;
  if(cleaning){dismissInitialGuide('clean');if(mode==="dust")dustState="scattered";cleaning=false;keys.clear();clearWipePointer();return;}
  const n=near();if(!n)return;
  dismissInitialGuide('clean');
  if(carrying){
    if(n.category!==carrying.category){binShake={category:n.category,start:now};return;}
    if(carrying.kind==="dustBundle")dustState="disposed";
    carrying.done=true;deposit={x:n.x,y:n.y,start:now};carrying=null;updateProgress(now);sound('done');return;
  }
  if(n.type==='dustPickup'){
    carrying={kind:'dustBundle',category:'general',mass:dust[0].mass,pickedAt:now,done:false};
    dustState='carried';dust=[];sound('done');return;
  }
  if(n.type==='trash'){carrying=n.item;carrying.pickedAt=now;sound('done');return;}
  if(n.type==='mat'){resetting={start:now};sound('done');return;}
  mode=n.type;
  activeStain=mode==='stain'?n.item:null;
  if(activeStain){dirt=activeStain.dirt;totalDirt=activeStain.total;}
  if(mode==="dust")dustState="sweeping";
  completed=false;cleaning=true;mop={x:0,y:0};keyboardDirection=keyboardLane=0;keys.clear();faceStain();
  if(mode==='stain'&&!stainGuideLearned){toolGuide=finePointer?'DRAG':'SWIPE';}
  if(mode==='dust'&&!dustGuideLearned){toolGuide='SWEEP';}
}

function pointSegmentDistanceSquared(px,py,ax,ay,bx,by){
  const dx=bx-ax;
  const dy=by-ay;
  if(dx===0&&dy===0)return(px-ax)**2+(py-ay)**2;
  const amount=clamp(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy),0,1);
  const closestX=ax+dx*amount;
  const closestY=ay+dy*amount;
  return(px-closestX)**2+(py-closestY)**2;
}

function completeWipe(){
  if(completed)return;
  for(const cell of dirt)cell.dirty=false;
  activeStain.done=true;
  completed=true;
  cleaning=false;
  const now=performance.now();
  cleaningFinish={
    headX:surface().x+mop.x,
    headY:surface().y+mop.y,
    direction:inyoungMotion.direction,
    baseX:player.x,
    baseY:player.y,
    start:now
  };
  keyboardDirection=0;
  keys.delete('a');
  keys.delete('d');
  clearWipePointer();
  updateProgress(now);
  sound('done');
}

function wipeSegment(fromX,fromY,toX,toY){
  if(!cleaning||completed)return 0;
  let removed=0;
  const dx=toX-fromX,dy=toY-fromY;
  if(Math.hypot(dx,dy)<.001)return 0;
  const efficiency=activeStain.pattern==='streak'?.7+.9*Math.abs((dx*activeStain.axis.x+dy*activeStain.axis.y)/Math.hypot(dx,dy)):1;
  const radiusSquared=(CLEAN_RADIUS*efficiency)**2;
  for(const cell of dirt){
    if(!cell.dirty)continue;
    const cellX=activeStain.x+cell.x+CELL_SIZE/2;
    const cellY=activeStain.y+cell.y+CELL_SIZE/2;
    if(pointSegmentDistanceSquared(cellX,cellY,fromX,fromY,toX,toY)<=radiusSquared){
      cell.dirty=false;
      removed++;
    }
  }
  if(removed){stainGuideLearned=true;toolGuide='';}
  if(removed&&performance.now()-lastScrub>70){
    sound('scrub');
    lastScrub=performance.now();
  }
  if(cleanedCoverage()>=COMPLETION_THRESHOLD)completeWipe();
  return removed;
}

function moveMop(dx,dy){
  if(expireRound(performance.now()))return 0;
  if(!cleaning||Math.hypot(dx,dy)<MOP_DEADZONE)return 0;
  const fromX=surface().x+mop.x;
  const fromY=surface().y+mop.y;
  mop.x=clamp(mop.x+dx,-MOP_LIMIT_X,MOP_LIMIT_X);
  mop.y=clamp(mop.y+dy,-MOP_LIMIT_Y,MOP_LIMIT_Y);
  if(mode==="dust")return pushDust(fromX-DUST.x,fromY-DUST.y,mop.x,mop.y);
  return wipeSegment(fromX,fromY,activeStain.x+mop.x,activeStain.y+mop.y);
}


function mergeDust(){
  let merged=true;
  while(merged){
    merged=false;
    outer:for(let i=0;i<dust.length;i++)for(let j=i+1;j<dust.length;j++){
      const a=dust[i],b=dust[j];
      // A forgiving capture zone; no remote attraction or idle movement.
      if(Math.hypot(a.x-b.x,a.y-b.y)<=MERGE_DISTANCE){
        const mass=a.mass+b.mass;
        a.x=(a.x*a.mass+b.x*b.mass)/mass;
        a.y=(a.y*a.mass+b.y*b.mass)/mass;
        a.mass=mass;dust.splice(j,1);merged=true;break outer;
      }
    }
  }
}
function pushDust(ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,length=Math.hypot(dx,dy);
  if(length<.001)return;
  // Substeps prevent fast pointer drags from tunnelling through piles.
  const steps=Math.ceil(length/2);
  for(let n=1;n<=steps;n++){
    const x=ax+dx*n/steps,y=ay+dy*n/steps;
    for(const pile of dust){
      if(Math.hypot(pile.x-x,pile.y-y)<=10+2*Math.sqrt(pile.mass)){
        const previousX=pile.x,previousY=pile.y;
        const nextX=clamp(pile.x+dx/steps,-44,44),nextY=clamp(pile.y+dy/steps,-26,26);
        if(!blocked(DUST.x+nextX,DUST.y+pile.y))pile.x=nextX;
        if(!blocked(DUST.x+pile.x,DUST.y+nextY))pile.y=nextY;
        if(pile.x!==previousX||pile.y!==previousY){dustGuideLearned=true;toolGuide='';}
      }
    }
    mergeDust();
  }
  if(dust.some(p=>p.mass/4>=DUST_THRESHOLD)){
    const main=dust.reduce((a,b)=>a.mass>b.mass?a:b);
    main.mass=dust.reduce((sum,p)=>sum+p.mass,0);dust=[main];
    dustState='pileReady';cleaning=false;completed=true;cleaningFinish=null;
    keys.clear();keyboardDirection=0;joy={x:0,y:0,id:null};
    $('#joystick i').style.transform='';clearWipePointer();sound('done');
  }
}
function drawDust(){
  for(const pile of dust){
    const x=DUST.x+pile.x,y=DUST.y+pile.y;
    const radius=4+Math.sqrt(pile.mass)*2;
    rect(x-radius,y-2,radius*2,5,'#817a6e');
    rect(x-radius+2,y-4,radius*2-4,8,'#938a79');
    rect(x-radius-1,y+1,2,2,'#786f64');
    rect(x+radius-1,y-2,2,2,'#81796c');
    rect(x-2,y-3,3,2,'#afa38f');
    rect(x+radius-3,y+2,2,2,'#6e685e');
  }
}

function blocked(x,y){
  return x<30||x>330||y<180||y>468||obstacles.some(([left,top,width,height])=>x>left-9&&x<left+width+9&&y>top-4&&y<top+height+8);
}

function update(now){
  const dt=Math.min(.035,(now-last)/1000);
  last=now;

  if(phase==='playing'){
    elapsed=Math.min(60,(now-started)/1000);
    if(elapsed>=60)finishRound(false,now);
  }

  if(phase==='playing'&&resetting&&now-resetting.start>=300){done.mat=true;resetting=null;updateProgress(now);}
  if(cleaningFinish&&now-cleaningFinish.start>=100)cleaningFinish=null;

  if(phase==='playing'&&cleaning){
    const axis=(keys.has('d')?1:0)-(keys.has('a')?1:0);
    if(axis){
      if(axis!==keyboardDirection){
        keyboardDirection=axis;
        keyboardLane=axis>0?-7:7;
      }
      const vertical=(keyboardLane-mop.y)*Math.min(1,dt*10);
      moveMop(axis*MOP_KEY_SPEED*dt,vertical);
    }else keyboardDirection=0;
    walk=0;
  }else if((phase==='ready'||phase==='playing')&&!cleaningFinish&&!resetting&&!allDone()){
    let x=joy.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
    let y=joy.y+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
    if(x||y){
      beginRound(now);
      const length=Math.max(1,Math.hypot(x,y));
      x=x/length*105*dt;
      y=y/length*105*dt;
      if(!blocked(player.x+x,player.y))player.x+=x;
      if(!blocked(player.x,player.y+y))player.y+=y;
      player.dir=Math.abs(x)>Math.abs(y)?(x>0?'right':'left'):(y>0?'down':'up');
      walk+=dt*12;
    }else walk=0;
  }else walk=0;

  if(guideVisible&&now>=guideUntil)dismissInitialGuide();
  if(phase==='ending'){
    if(now>=resultRevealAt&&$('#result').hidden){$('#result').hidden=false;$('#result').classList.add('result-enter');}
    if(now>=resultEndAt){phase='result';$('#result').classList.remove('result-enter');}
  }
  const nearby=phase==='playing'?near():null;
  setHint(cleaning&&toolGuide?toolGuide:nearby&&!cleaning&&!cleaningFinish&&!resetting?"CLEAN":"");
  $('#clean').classList.toggle('active',phase==='playing'&&(nearby||cleaning));
  $('#clock').textContent=clock(elapsed);
  draw(now);
  requestAnimationFrame(update);
}

function rect(x,y,width,height,color){
  ctx.fillStyle=color;
  ctx.fillRect(Math.round(x),Math.round(y),Math.round(width),Math.round(height));
}

function text(value,x,y,color='#546461'){
  const glyphs={I:['111','010','010','010','111'],N:['101','111','111','111','101'],F:['111','100','110','100','100'],O:['111','101','101','101','111'],D:['110','101','101','101','110'],R:['110','101','110','101','101'],E:['111','100','110','100','111'],C:['111','100','100','100','111'],T:['111','010','010','010','010'],'1':['010','110','010','010','111']};
  for(let index=0;index<value.length;index++){
    const glyph=glyphs[value[index]];
    if(!glyph)continue;
    for(let row=0;row<5;row++)for(let column=0;column<3;column++)if(glyph[row][column]==='1')rect(x+index*4,y-5+row,1,1,color);
  }
}

function line(x,y,toX,toY,color,width=1){
  const steps=Math.max(Math.abs(toX-x),Math.abs(toY-y),1);
  for(let index=0;index<=steps;index++)rect(x+(toX-x)*index/steps,y+(toY-y)*index/steps,width,width,color);
}

// Production lobby art is retained; only the existing lower entrance responds after success.
function entranceOpenProgress(now){
  if(!resultSuccess||!clockOutAt)return 0;
  return clamp((now-clockOutAt-125)/375,0,1);
}

function drawEntrance(now){
  const open=entranceOpenProgress(now);
  const shift=Math.round(open*27);
  rect(109,487,145,17,'#7f99a4');
  rect(116,490,129,11,open>0?'#657d86':'#7f99a4');
  ctx.save();
  ctx.beginPath();
  ctx.rect(116,490,129,11);
  ctx.clip();
  rect(116-shift,490,60,11,'#bbd4d7');
  rect(185+shift,490,60,11,'#c6dcdb');
  rect(120-shift,491,19,2,'#e6eeea');
  rect(189+shift,491,19,2,'#e6eeea');
  rect(169-shift,494,4,2,'#718d9a');
  rect(187+shift,494,4,2,'#718d9a');
  ctx.restore();
  for(const x of [112,180,249])rect(x,490,3,14,'#e9eeee');
}

function lobby(now){
  rect(0,0,360,640,'#e8e7df');rect(12,111,336,393,'#d5dadd');
  for(let y=166;y<505;y+=34)for(let x=12;x<348;x+=36){rect(x,y,35,33,(Math.floor(x/36)+Math.floor(y/34))%2?'#f1eee5':'#eae7df');rect(x,y+32,35,1,'#dadbd3');rect(x,y,35,1,'#f8f5ee')}
  for(let y=423;y<487;y++){const inset=Math.floor((487-y)*.45);rect(110-inset,y,145+inset,1,y<451?'#ede8da':'#f2ead7')}
  for(let y=438;y<487;y+=34)rect(84,y,200,1,'#e2dccd');
  rect(12,111,336,55,'#c4cdd2');rect(12,163,336,5,'#8799a4');rect(12,168,336,3,'#fcf8ee');
  for(const x of [94,192]){rect(x-3,110,76,54,'#708491');rect(x,112,70,49,'#a9b8c1');rect(x+3,115,31,46,'#d0d9dd');rect(x+35,115,32,46,'#becbd2');rect(x+7,117,2,42,'#eff2ef');rect(x+32,115,2,46,'#7e929e');rect(x+64,115,2,46,'#9aacb8');rect(x+1,160,68,2,'#728691');rect(x+21,101,27,8,'#435763');text('1',x+35,108,'#d5e6cd');rect(x+25,104,5,1,'#b6d4b3');rect(x+26,103,3,1,'#b6d4b3');rect(x+27,102,1,1,'#b6d4b3');rect(x+73,131,5,15,'#f0eee3');rect(x+74,134,2,2,'#d5aa70');rect(x+74,140,2,2,'#849ba4')}
  rect(281,110,54,30,'#657f89');rect(283,112,50,26,'#e7ece8');rect(283,112,50,6,'#557f87');text('DIRECTORY',286,117,'#e4ece5');for(let y=122;y<136;y+=5){rect(287,y,5,2,'#61878e');rect(298,y,27,1,'#99a9ac')}
  rect(305,73,23,23,'#84949c');rect(302,76,29,17,'#84949c');rect(305,76,23,17,'#f7f2df');rect(308,74,17,21,'#f7f2df');rect(315,75,2,2,'#81929a');rect(315,92,2,2,'#81929a');rect(304,83,2,2,'#81929a');rect(327,83,2,2,'#81929a');line(316,84,316,90,'#536b76');line(316,84,314+Math.floor(elapsed/30),77,'#536b76');rect(315,83,3,3,'#536b76');
  rect(18,177,51,35,'#c4b59b');rect(20,180,45,29,'#deceb2');rect(21,207,44,3,'#b4a98f');rect(18,170,51,9,'#f3e7cc');rect(18,177,51,2,'#a99c85');rect(34,158,20,13,'#425b6a');rect(36,160,16,9,'#8db3be');rect(38,162,10,1,'#bfd3d1');rect(42,171,5,3,'#6b7f85');rect(22,172,9,3,'#718e91');rect(23,171,8,2,'#e8eadb');text('INFO',29,193,'#55747e');
  rect(19,451,36,31,'#527f8b');rect(21,455,32,22,'#79a0a8');rect(23,447,30,7,'#acc5c2');rect(24,438,6,10,'#e2e4c6');rect(25,435,4,3,'#a48f69');rect(33,440,7,8,'#98bbb9');rect(34,437,4,3,'#ecdfbe');rect(38,437,3,2,'#ecdfbe');rect(43,446,10,13,'#e9e0bf');rect(45,449,1,8,'#c5bb9b');rect(40,451,2,25,'#3c6877');rect(18,477,7,8,'#3d5362');rect(45,477,7,8,'#3d5362');rect(20,479,3,3,'#8296a0');rect(47,479,3,3,'#8296a0');rect(21,426,3,28,'#ad9770');rect(18,424,9,5,'#bdd2cf');
  rect(309,453,19,26,'#a9b7bb');rect(310,456,16,20,'#8198a2');rect(312,460,2,14,'#b9c6c6');rect(322,460,2,14,'#b9c6c6');for(const [index,x] of [313,320,326].entries()){rect(x,435+index*2,2,22-index*2,['#526f80','#9c8679','#6a8983'][index]);rect(x-3,433+index*2,5,2,'#4b6474');rect(x-3,434+index*2,1,3,'#4b6474');rect(x-1,445+index,3,9,'#6a8190')}
  drawEntrance(now);
  rect(12,505,336,3,'#c5cfcc');
}

function drawDirt(stain){
  const colors=['#96816b','#a9957d','#bdad96','#d1c4b0'];
  for(const cell of stain.dirt)if(cell.dirty)rect(stain.x+cell.x,stain.y+cell.y,CELL_SIZE,CELL_SIZE,colors[cell.tone]);
}

const mopHands={front:{x:6,y:-22},back:{x:-6,y:-22},left:{x:-3,y:-22},right:{x:3,y:-22}};
function mopPropAt(headX,headY,direction,baseX=player.x,baseY=player.y){
  const hand=mopHands[direction]||mopHands.front;
  const handX=baseX+hand.x;
  const handY=baseY+hand.y;
  const jointY=headY-5;
  if(mode==='dust'){
    line(handX,handY,headX,jointY,'#71695b',2);
    line(handX+1,handY,headX+1,jointY,'#a99e88');
    rect(headX-9,headY-3,19,3,'#786e60');
    for(let i=-10;i<=10;i+=2)line(headX+i*.8,headY,headX+i,headY+5,'#a89b80',2);
    return;
  }
  line(handX,handY,headX,jointY,'#506168',2);
  line(handX+1,handY,headX+1,jointY,'#94a0a1');
  line(headX,jointY,headX-5,headY-2,'#596b70');
  line(headX,jointY,headX+5,headY-2,'#596b70');
  rect(headX-8,headY-2,17,2,'#64757a');
  rect(headX-9,headY,19,3,'#aeb6b3');
  rect(headX-6,headY+1,13,1,'#d8d9d2');
  for(const [index,offset] of [-8,-5,-2,1,4,7].entries())line(headX+offset,headY+2,headX+offset+(index%2?-1:1),headY+5,'#c7cbc5');
}

// Locked production frames: 352x816, pivot (176,802), source height 790.
const INYOUNG_SCALE=58/790;
const inyoungFrames={};
const inyoungReady=Promise.all(['front','back','left','right'].flatMap(direction=>
  ['idle','walk_a','walk_b'].map(frame=>new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=resolve;
    image.onerror=()=>reject(new Error('Inyoung asset failed: '+image.src));
    image.src='assets/inyoung/inyoung_'+direction+'_'+frame+'.png';
    (inyoungFrames[direction]??={})[frame]=image;
  }))
));

let inyoungMotion={entity:null,x:0,y:0,direction:'front',moving:false,time:0,last:null,frame:'idle'};
function character(now){
  const visual=inyoungMotion;
  if(visual.entity!==player){
    Object.assign(visual,{entity:player,x:player.x,y:player.y,direction:'front',moving:false,time:0,last:now,frame:'idle'});
  }
  const dx=player.x-visual.x;
  const dy=player.y-visual.y;
  const horizontalDistance=Math.abs(dx);
  const verticalDistance=Math.abs(dy);
  const moving=(horizontalDistance>.000001||verticalDistance>.000001)&&!cleaning&&!cleaningFinish;
  if(moving){
    const horizontal=dx>0?'right':'left';
    const vertical=dy>0?'front':'back';
    if(horizontalDistance>verticalDistance+.000001)visual.direction=horizontal;
    else if(verticalDistance>horizontalDistance+.000001)visual.direction=vertical;
    else if(visual.direction!==horizontal&&visual.direction!==vertical)visual.direction=vertical;
    visual.time=visual.moving?visual.time+Math.max(0,now-visual.last):0;
  }else visual.time=0;
  const cycle=visual.time%800;
  visual.frame=moving?(cycle<180?'idle':cycle<400?'walk_a':cycle<580?'idle':'walk_b'):'idle';
  visual.moving=moving;
  visual.last=now;
  visual.x=player.x;
  visual.y=player.y;
  const image=inyoungFrames[visual.direction][visual.frame];
  if(image.complete&&image.naturalWidth){
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(image,Math.round(player.x)-176*INYOUNG_SCALE,Math.round(player.y)-802*INYOUNG_SCALE,352*INYOUNG_SCALE,816*INYOUNG_SCALE);
  }
}

const MAT_WIDTH=56,MAT_HEIGHT=20,MAT_UNALIGNED_DEGREES=10;
const MAT_DARK_MARKS=[[7,6,5],[21,5,4],[37,7,5],[13,13,4],[29,12,5],[45,14,4]],MAT_LIGHT_MARKS=[[14,9,3],[31,6,4],[39,13,3],[23,15,4]];
function entranceMatColor(x,y){if(x<0||x>=MAT_WIDTH||y<0||y>=MAT_HEIGHT)return null;if(x===0||x===MAT_WIDTH-1||y===0||y===MAT_HEIGHT-1)return'#625d56';if(y===2&&x>1&&x<MAT_WIDTH-2)return'#a0988a';if(MAT_DARK_MARKS.some(([a,b,w])=>y===b&&x>=a&&x<a+w))return'#888075';if(MAT_LIGHT_MARKS.some(([a,b,w])=>y===b&&x>=a&&x<a+w))return'#a39a8c';return'#958c7f'}
function entranceMatFrame(degrees){const angle=degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),runs=[];for(let y=-17;y<=17;y++){let color=null,start=-32;for(let x=-32;x<=33;x++){let next=null;if(x<=32){const sx=Math.floor(c*(x+.5)+s*(y+.5)+MAT_WIDTH/2),sy=Math.floor(-s*(x+.5)+c*(y+.5)+MAT_HEIGHT/2);next=entranceMatColor(sx,sy)}if(next!==color){if(color)runs.push([start,y,x-start,color]);color=next;start=x}}}return runs}
const entranceMatFrames=Array.from({length:MAT_UNALIGNED_DEGREES+1},(_,degrees)=>entranceMatFrame(degrees));
function entranceMat(x,y,degrees){for(const [dx,dy,w,color] of entranceMatFrames[Math.round(degrees)])rect(x+dx,y+dy,w,1,color)}
function trashSprite(kind,x,y){if(kind==='dustBundle'){rect(x-3,y-7,6,3,'#777060');rect(x-5,y-4,10,8,'#8e8677');rect(x-4,y-3,8,8,'#a49a86');rect(x-2,y-2,2,5,'#b8ad97');rect(x-3,y+5,6,1,'#756f64');return;}if(kind===3){rect(x-2,y-12,5,3,'#557f89');rect(x-2,y-9,5,3,'#b4d2cf');rect(x-4,y-6,9,12,'#668c95');rect(x-3,y-5,7,10,'#bad8d4');rect(x-2,y-4,2,7,'#eaf1e6');rect(x-3,y,7,3,'#71969c');rect(x-2,y+5,5,1,'#8faeb0');}else{rect(x-8,y-5,13,9,'#bcb9ad');rect(x-7,y-6,10,7,'#fffdf1');rect(x-2,y-2,10,7,'#e0ded4');rect(x-1,y-3,7,6,'#faf8ed');line(x-6,y-5,x-1,y,'#acb6b5');line(x+1,y-1,x+5,y+2,'#b8c0bd');rect(x-5,y-3,3,1,'#7f9299');rect(x+2,y+3,5,1,'#c3c8bd')}}

const carryOffsets={front:{x:17,y:-22},back:{x:-17,y:-22},left:{x:-13,y:-22},right:{x:13,y:-22}};
function drawMat(now){
 const degrees=phase==='result'&&timeoutMatDegrees!==null?timeoutMatDegrees:currentMatDegrees(now);
 entranceMat(MAT.x,MAT.y,degrees);
}
function drawBins(now){
 for(const b of BINS){
  const shake=binShake?.category===b.category&&now-binShake.start<140?Math.round(Math.sin((now-binShake.start)/140*Math.PI*4)*2):0;
  const x=b.x+shake,y=b.y;
  if(b.category==='recycle'){
   rect(x-12,y-22,24,27,'#62838a');rect(x-10,y-19,20,22,'#9ab5b5');rect(x-13,y-25,26,6,'#58747f');
   rect(x-4,y-24,8,4,'#314c57');rect(x-2,y-13,4,2,'#edf1e6');rect(x-3,y-11,6,9,'#edf1e6');rect(x-2,y-8,4,2,'#6b9096');
  }else{
   rect(x-10,y-19,20,24,'#817d70');rect(x-8,y-16,16,19,'#b4b09f');rect(x-14,y-22,28,4,'#777a73');
   rect(x-10,y-21,20,2,'#374c51');rect(x-4,y-12,7,7,'#efeee0');line(x-3,y-11,x+2,y-6,'#9a9b8d');
  }
  ctx.font='8px monospace';ctx.textAlign='center';ctx.fillStyle='#3b535b';ctx.fillText(b.category==='recycle'?'RECYCLE':'GENERAL',b.x,y+17);
  if(deposit&&deposit.x===b.x&&now-deposit.start<140)rect(b.x-4,y-24,8,2,'#e8eed9');
 }
}

function draw(now){
  lobby(now);
  for(const stain of stains)if(!stain.done)drawDirt(stain);
  if(dustState!=='disposed')drawDust();
  drawMat(now);drawBins(now);
  for(const t of trash)if(!t.done&&t!==carrying)trashSprite(t.kind,t.x,t.y);
  character(now);
  if(carrying){const o=carryOffsets[inyoungMotion.direction]||carryOffsets.front;const pop=Math.sin(Math.min(1,(now-carrying.pickedAt)/120)*Math.PI)*2;trashSprite(carrying.kind,player.x+o.x,player.y+o.y-Math.round(pop));}
  if(cleaning)mopPropAt(surface().x+mop.x,surface().y+mop.y,inyoungMotion.direction);
  else if(cleaningFinish)mopPropAt(cleaningFinish.headX,cleaningFinish.headY,cleaningFinish.direction,cleaningFinish.baseX,cleaningFinish.baseY);
}

function setHint(value=''){
  const hint=$('#hint');
  hint.textContent=value;
  hint.className=value?'active':'';
}

$('#clean').addEventListener('pointerdown',event=>{
  event.preventDefault();
  clean();
});
$('#opening-close').addEventListener('click',()=>{
  if(phase!=='opening')return;
  $('#opening').hidden=true;
  phase='ready';
  showInitialGuide();
  startBgm();
  decodeDoorSfx();
});
$('#retry').addEventListener('click',()=>resetTest());


const stick=$('#joystick');
stick.addEventListener('pointerdown',event=>{
  if(phase==='opening'||phase==='ending'||phase==='result'||cleaning||cleaningFinish||resetting||allDone())return;
  event.preventDefault();
  joy.id=event.pointerId;
  stick.setPointerCapture(event.pointerId);
  joystick(event);
});
function joystick(event){
  if(phase==='opening'||phase==='ending'||phase==='result'||event.pointerId!==joy.id)return;
  const bounds=stick.getBoundingClientRect();
  const dx=(event.clientX-bounds.left-bounds.width/2)/(bounds.width*.34);
  const dy=(event.clientY-bounds.top-bounds.height/2)/(bounds.height*.34);
  const length=Math.max(1,Math.hypot(dx,dy));
  joy.x=Math.abs(dx)<.12?0:dx/length;
  joy.y=Math.abs(dy)<.12?0:dy/length;
  $('#joystick i').style.transform=`translate(${joy.x*bounds.width*.27}px,${joy.y*bounds.height*.27}px)`;
}
stick.addEventListener('pointermove',joystick);
for(const eventName of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(eventName,()=>{
  joy={x:0,y:0,id:null};
  $('#joystick i').style.transform='';
});

const game=$('#game');
game.addEventListener('pointerdown',event=>{
  if(!cleaning||event.target.closest('#joystick')||event.target.closest('#clean')||event.target.closest('button'))return;
  wipePointerId=event.pointerId;
  pointerLast={x:event.clientX,y:event.clientY};
  game.setPointerCapture(event.pointerId);
});
game.addEventListener('pointermove',event=>{
  if(!cleaning||event.pointerId!==wipePointerId||!pointerLast)return;
  const bounds=canvas.getBoundingClientRect();
  const dx=(event.clientX-pointerLast.x)*360/bounds.width;
  const dy=(event.clientY-pointerLast.y)*640/bounds.height;
  pointerLast={x:event.clientX,y:event.clientY};
  moveMop(dx,dy);
});
for(const eventName of ['pointerup','pointercancel','lostpointercapture'])game.addEventListener(eventName,event=>{
  if(event.pointerId===wipePointerId)clearWipePointer();
});

window.addEventListener('keydown',event=>{
  const key=event.key.toLowerCase();
  if(phase==='opening')return;
  if(key==='r'&&!event.repeat){
    event.preventDefault();
    resetTest();
    return;
  }
  const movement=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key);
  if(movement||key==='e')event.preventDefault();
  if(phase==='ending'||phase==='result')return;
  if(key==='e'&&!event.repeat){
    clean();
    return;
  }
  if(!movement)return;
  if(cleaning){
    if(key==='a'||key==='d')keys.add(key);
  }else if(!cleaningFinish)keys.add(key);
});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',()=>{
  keys.clear();
  joy={x:0,y:0,id:null};
  clearWipePointer();
});
window.addEventListener('pagehide',()=>{stopBgm();stopDoorSfx();});

window.__CORE_INTEGRATION_CANDIDATE__={
  version:2,
  pools:PlacementPool.POOLS,
  current:()=>currentPlacement,
  stats:()=>placementGenerator.stats,
  regenerate:()=>resetTest()
};

resetTest();
inyoungReady.then(()=>{
  last=performance.now();
  requestAnimationFrame(update);
}).catch(error=>console.error(error));
