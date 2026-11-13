(() => {
'use strict';
const C=MineCore,$=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const KEY='mineworld.save.v1',BACKUP=KEY+'.backup';let W=1280,H=1040;
const canvas=$('#game'),ctx=canvas.getContext('2d'),mini=$('#minimap canvas'),mc=mini.getContext('2d');
let state,world,player={x:180,y:180,tx:180,ty:180,hp:100,invuln:0},target=null,cam={x:0,y:0},path=[];
let width=400,height=400,zoom=1.05,dpr=1,paused=false,suspended=false,modalTab=null,previous=0,saveTimer=0,hudTimer=0,clock=0;
let swing=0,attackClock=0,particles=[],floats=[],ripples=[],bullets=[],warningZones=[],cooldowns={dash:0,slam:0,luck:0},luckTime=0;
let shake=0,toastTimer=0,sessionValue=0,sessionSeconds=0,storageFailed=false,audio=null,lastInput=0,giantTimer=5,midasTimer=5,companionTimer=0,orbitTimer=0,bgmTimer=0;
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const safeNumber=(n,a,b,f)=>Number.isFinite(n)?clamp(n,a,b):f;
function readSave(){for(const key of[KEY,BACKUP])try{const p=JSON.parse(localStorage.getItem(key));if(p&&[1,2].includes(p.version)&&p.levels)return C.normalize(p);}catch(e){}return C.fresh();}
state=readSave();C.refreshDay(state);const startingOffline=C.offline(state);if(startingOffline)C.credit(state,startingOffline);
function snapshot(){return{...world,nodes:world.nodes.map(({flash,...n})=>n),boss:world.boss?{...world.boss,timer:Math.max(.5,world.boss.timer)}:null,bossHp:world.boss?.hp,player:{x:player.x,y:player.y,hp:player.hp},w:W,h:H};}
function save(){try{state.world=snapshot();state.lastSeen=Date.now();const old=localStorage.getItem(KEY);if(old)try{const v=JSON.parse(old);if([1,2].includes(v.version)&&v.levels)localStorage.setItem(BACKUP,old);}catch(e){}localStorage.setItem(KEY,JSON.stringify(state));storageFailed=false;}catch(e){if(!storageFailed)toast('저장 공간을 확인해 줘. 설정에서 코드를 백업할 수 있어.');storageFailed=true;}}
function combat(){const trial=C.TRIALS.find(t=>t.id===world?.trial),hard=trial?.hard&&['power','power2'].includes(trial.type),cap=trial?.cap?(trial.type==='power2'?trial.cap*world.floor:trial.cap):0;return{...state,trialCap:cap,suit:hard?'miner':world?.tempSuit||state.suit,...(hard?{relics:{power:0,fortune:0,vault:0},pickaxe:{repaired:false,options:[]}}:{})};}
function hardMode(){return C.TRIALS.find(t=>t.id===world?.trial)?.hard&&['power','power2'].includes(C.TRIALS.find(t=>t.id===world?.trial).type);}
function has(id){return!hardMode()&&combat().suit!=='prisoner'&&state.items[id]>0;}
function maxHealth(){return C.maxHealth(combat());}
function finalFloor(){return world.mode==='trial'?C.TRIALS.find(t=>t.id===world.trial).floors:world.mode==='daily'?world.dayIndex===6?3:1:C.MINES[world.biome].floors;}
function node(id,x,y,kind='ore',extra={}){const o=C.ORES[id],m=C.MINES[world.biome];const max=kind==='life'?Math.max(45,m.unlock*2):o.hardness*(1+(world.floor-1)*.08);return{id,x,y,kind,hp:max,max,remaining:kind==='life'?1:o.qty,flash:0,first:true,...extra};}
function special(kind,x,y,extra={}){return node(0,x,y,kind,{remaining:1,hp:1,max:1,...extra});}
function makeBoss(name){const m=C.MINES[world.biome],def=C.BOSSES.find(b=>b.name===name)||C.BOSSES[0],max=Math.max(440,m.unlock*130,m.fee*.08)*(world.mode==='trial'?1+world.floor*.12:1);return{x:W/2,y:H*.4,name:def.name,pattern:def.pattern,max,hp:max,timer:1.8,phase:0,rotation:0,stage:0,charge:0,homeX:W/2,homeY:H*.4};}
function addLife(count=6){const b=world.boss;if(!b)return;for(let i=0;i<count;i++){const a=i*Math.PI*2/count;world.nodes.push(node(8,clamp(b.x+Math.cos(a)*190,90,W-90),clamp(b.y+Math.sin(a)*180,120,H-100),'life'));}}
function bossName(){const m=C.MINES[world.biome],trial=C.TRIALS.find(t=>t.id===world.trial);if(trial?.type==='power'){const names=['진흙 골렘','고블린','황금 전사','크라켄','고대의 신','망각의 유령','나무의 악령','심연 주시자','쌍둥이 비룡','드래곤 로드'];return names[world.floor-1];}if(trial?.type==='power2')return['신기루 포탑','숲의 수호자','예티','해적 해골','붉은 악마','화염의 정령','섭리','혼돈','유적 감시자','풀려난 파괴자'][world.floor-1];if(world.mode==='daily'&&world.dayIndex===6)return['고블린','진흙 골렘','거대 슬라임'][world.floor-1];return m.bosses[Math.floor(Math.random()*m.bosses.length)];}
function buildNormal(){
 const m=C.MINES[world.biome],trial=C.TRIALS.find(t=>t.id===world.trial),bossFloor=world.mode==='snow'||world.mode==='trial'&&['power','power2'].includes(trial.type)||world.mode==='daily'&&world.dayIndex===6||world.mode==='mine'&&world.floor===m.floors&&![12,13,14,15,17,19].includes(m.id)&&(m.id!==16||state.pickaxe.repaired);
 if(bossFloor){world.boss=makeBoss(world.mode==='snow'?'거대 눈사람':bossName());if(world.mode==='snow'){world.timeLeft=90;for(let i=0;i<12;i++)world.nodes.push(node(27,rand(100,W-100),rand(150,H-100),'snow',{remaining:1000}));}else addLife();return;}
 const count=[1,6].includes(m.id)?90:72+Math.min(40,world.floor*3),rare=(has('map')?1.4:1)*(1+C.option(state,'rare'));
 for(let i=0;i<count;i++){
   let pool=m.ores;if(world.mode==='trial')pool=trial.type==='speed'?world.floor>10?C.MINES[7].ores:world.floor>5?C.MINES[5].ores:C.MINES[3].ores:m.ores;
   if(world.mode==='daily')pool=world.dayIndex===4?[23,24,25]:world.dayIndex===7?[11,12,17,26,30,33,37,42]:m.ores;
   let pick=Math.min(pool.length-1,Math.floor(Math.pow(Math.random(),1.9/rare)*pool.length));const id=pool[pick],x=rand(85,W-85),y=rand(120,H-85);
   if(Math.hypot(x-180,y-190)<90||Math.hypot(x-world.gate.x,y-world.gate.y)<60)continue;
   if(world.nodes.some(n=>distance(n,{x,y})<42))continue;
   world.nodes.push(node(id,x,y,'ore',{remaining:C.ORES[id].qty*(world.mode==='trial'||world.mode==='daily'?2:1)}));
 }
 // Keep a visible, easy-to-read first cluster; don't depend on procedural luck to start playing.
 world.nodes=world.nodes.filter(n=>Math.hypot(n.x-255,n.y-235)>130);
 const startPool=world.mode==='daily'?(world.dayIndex===4?[23,24,25]:world.dayIndex===7?[11,12,17,26,30,33,37,42]:m.ores):m.ores;
 for(let i=0;i<4;i++)world.nodes.push(node(startPool[i%startPool.length],240+i*64,220+(i%2)*75));
 if(world.floor>=3)world.nodes.push(node(m.ores[m.ores.length-1],460,340));
 if(!has('rubble')||m.id===5)for(let i=0;i<10;i++)world.nodes.push(node(0,rand(95,W-90),rand(140,H-90),m.id===5?'tree':'stone'));
 if(world.mode==='trial'){
   if(trial.type==='speed'){world.nodes=world.nodes.filter(n=>n.id!==17);world.nodes.push(node(17,W-150,H-160),node(17,W-210,H-210));if(trial.hard)for(let y=280;y<H-160;y+=160){const gap=(Math.floor(y/160)%2?3:W/40-6);for(let x=80;x<W-80;x+=40)if(Math.abs(x/40-gap)>1)world.obstacles.push({x,y,w:40,h:40});}}
   if(trial.type==='tech')world.hazardTimer=1;
   world.nodes=world.nodes.filter(n=>!world.obstacles.some(o=>n.x>o.x-12&&n.x<o.x+o.w+12&&n.y>o.y-12&&n.y<o.y+o.h+12));
   return;
 }
 if(world.mode==='daily')return;
 world.nodes.push(special('chest',370,360,{chest:m.event==='silver'?'silver':m.event==='goldChest'?'gold':m.event==='treeChest'?'tree':'normal'}));
 const p={x:W*.58,y:H*.58};
 if(m.event==='blocks')world.nodes.push(special('puzzle',p.x,p.y));
 if(m.event==='switches')for(let i=0;i<4;i++)world.nodes.push(special('switch',p.x+(i%2)*65,p.y+Math.floor(i/2)*65,{colorIndex:i}));
 if(m.event==='map')world.nodes.push(special('map',p.x,p.y));
 if(m.event==='bomb'||has('bomb')&&Math.random()<.4)world.nodes.push(special('bomb',p.x+95,p.y));
 if(m.event==='blackhole'&&world.floor%3===0)world.nodes.push(special('blackhole',p.x,p.y));
 if(m.event==='shortcut'&&world.floor<9)world.nodes.push(special('shortcut',p.x,p.y));
 if(m.event==='memo')world.nodes.push(special('memo',p.x,p.y,{number:world.floor}));
 if(m.id===12&&world.floor===10)world.nodes.push(special('doors',W/2,H/2));
 if(m.id===13&&world.floor===6){world.nodes=world.nodes.filter(n=>n.id!==59);world.nodes.push(node(59,W/2,H/2,'ore',{remaining:80}));}
 if(m.id===14){world.nodes.push(special('cipher',p.x,p.y,{solved:false}));if(world.floor===10)world.nodes.push(special('electronicPortal',W/2,H-250));}
 if(m.id===16&&world.floor===10&&!state.pickaxe.found)world.nodes.push(special('brokenPick',W/2,H/2));
 if(m.id===17)world.nodes.push(special('exit',W/2,H-200));
 if(m.id===19&&!state.secret.completed)world.nodes.push(special('blacklist',W/2,H/2));
 if(state.secret.enabled&&[2,6,11,1].includes(m.id)&&world.floor<=2)world.nodes.push(special('sequence',W-200,200,{sequenceMine:m.id}));
 if(world.floor===1&&m.id===0&&state.secret.enabled)world.nodes.push(special('sequence',W-210,260,{sequenceMine:-1}));
 if(has('map')&&Math.random()<.45)world.nodes.push(special(['key','potion','treasure'][Math.floor(rand(0,3))],p.x+100,p.y+110));
 if(m.id===6)world.nodes.push(special('snowEntry',p.x,p.y));
}
function generate(biome=0,floor=1,saved=null,mode='mine',extra={}){
 biome=Number.isInteger(biome)&&biome>=0&&biome<C.MINES.length?biome:0;const m=C.MINES[biome];mode=['mine','seal','trial','daily','snow','temple'].includes(saved?.mode||mode)?saved?.mode||mode:'mine';
 W=m.w;H=m.h;const savedTrial=C.TRIALS.find(t=>t.id===(saved?.trial||extra.trial));const floorLimit=mode==='trial'?(savedTrial?.floors||10):mode==='daily'?3:m.floors;floor=Number.isInteger(floor)?clamp(floor,1,floorLimit):1;
 world={biome,floor,mode,nodes:[],obstacles:[],mined:0,cleared:false,gate:{x:W-120,y:H-120},boss:null,revived:false,trial:null,timeLeft:0,trialTime:0,score:0,enemyScore:0,dayIndex:0,day:C.dayKey(),dailyKinds:[],styleCounts:{},tempSuit:null,ultTime:0,ultMode:'',puzzle:null,returnTo:null,...extra,trial:mode==='trial'?(savedTrial?.id||'speed'):null};
 if(mode==='seal'){
   const req=biome===16?[3e6,3.7e6,4.4e6,5.1e6,5.8e6,6.5e6,8e6][state.dimensionSeals]:C.sealRequirement(state,biome);world.nodes=[special('seal',W/2,H/2,{hp:Math.max(300,req*30),max:Math.max(300,req*30),requirement:req})];world.gate={x:180,y:H-140};
 }else if(mode==='temple'){
   world.templeStage=extra.templeStage||'puzzle';world.timeLeft=90;world.gate={x:180,y:H-130};world.nodes=[special('altar',W/2,H/2)];
   if(world.templeStage==='escape'){world.chaser={x:W-130,y:H-140};world.nodes=[];}
 }else buildNormal();
 if(saved){
   const modeSafe=world.mode;const oldNodes=world.nodes;world={...world,...saved,mode:modeSafe,biome,floor,trial:modeSafe==='trial'?(savedTrial?.id||'speed'):null,dayIndex:Math.floor(safeNumber(saved.dayIndex,0,7,0)),timeLeft:safeNumber(saved.timeLeft,0,100000,0),mined:safeNumber(saved.mined,0,1e12,0)};
   world.nodes=Array.isArray(saved.nodes)?saved.nodes.slice(0,250).filter(n=>n&&Number.isInteger(n.id)&&C.ORES[n.id]&&typeof n.kind!=='function'&&Number.isFinite(n.x)&&Number.isFinite(n.y)).map(n=>{
     const kind=['ore','stone','tree','life','snow','seal','chest','switch','map','bomb','blackhole','shortcut','memo','doors','cipher','electronicPortal','brokenPick','exit','blacklist','sequence','key','potion','treasure','snowEntry','puzzle','altar','hiddenEntry'].includes(n.kind)?n.kind:n.life?'life':'ore';
     const v=node(n.id,clamp(n.x,55,W-55),clamp(n.y,85,H-55),kind);return{...v,...n,kind,x:clamp(n.x,55,W-55),y:clamp(n.y,85,H-55),hp:safeNumber(n.hp,.001,1e25,v.max),max:safeNumber(n.max,1,1e25,v.max),remaining:Math.floor(safeNumber(n.remaining,0,1e8,v.remaining)),flash:0};
   }).filter(n=>n.remaining>0):oldNodes;
   world.obstacles=Array.isArray(saved.obstacles)?saved.obstacles.slice(0,400).filter(o=>[o.x,o.y,o.w,o.h].every(Number.isFinite)):[];
   if(saved.boss){const b=makeBoss(typeof saved.boss.name==='string'?saved.boss.name:m.boss);world.boss={...b,...saved.boss,name:b.name,pattern:b.pattern,max:b.max,x:safeNumber(saved.boss.x,80,W-80,b.x),y:safeNumber(saved.boss.y,110,H-80,b.y),hp:safeNumber(saved.boss.hp,1,b.max,b.max),timer:Math.max(.5,saved.boss.timer||1)};}
   else if(saved.cleared)world.boss=null;
 }
 const p=saved?.player;player.x=safeNumber(p?.x,50,W-50,180);player.y=safeNumber(p?.y,100,H-50,215);player.tx=player.x;player.ty=player.y;player.hp=safeNumber(p?.hp,1,maxHealth(),maxHealth());player.invuln=world.boss?1:0;
 target=null;path=[];bullets=[];warningZones=[];particles=[];floats=[];attackClock=0;sessionValue=0;sessionSeconds=0;lastInput=clock;
 cam.x=clamp(player.x-width/zoom/2,0,Math.max(0,W-width/zoom));cam.y=clamp(player.y-height/zoom/2,0,Math.max(0,H-height/zoom));state.stats.deepest=Math.max(state.stats.deepest,m.rank*10+floor);
 if(!saved&&has('dream')&&Math.random()<.025&&mode==='mine'){for(const n of[...world.nodes])if(['ore','stone','tree'].includes(n.kind))mine(n,1,Math.max(1,C.level(combat(),'speed')/5),false);toast('몽상가의 추억 · 유성우가 광산을 비췄어.');}
 if(state.settings.music&&mode==='mine'&&m.id>=9&&audio)playNote(110,.2,.01);
 hud();
}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');toastTimer=3.5;}
function playNote(f,d=.09,volume=.025){try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.type='triangle';o.frequency.setValueAtTime(f,audio.currentTime);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.start();o.stop(audio.currentTime+d);}catch(e){}}
function sound(type='hit'){if(state.settings.sound)playNote(type==='coin'?780:type==='upgrade'?520:type==='hurt'?100:260);}
function vibrate(){if(state.settings.vibration&&window.MineworldNative)try{MineworldNative.tap();}catch(e){}}
function float(text,x,y,color='#f8db8d'){floats.push({text,x,y,life:1.1,color});if(floats.length>30)floats.shift();}
function burst(x,y,color,n=8){if(state.settings.reduced)return;for(let i=0;i<n;i++)particles.push({x,y,vx:rand(-70,70),vy:rand(-100,30),life:rand(.25,.65),color,size:rand(2,5)});if(particles.length>220)particles.splice(0,particles.length-220);}
function ripple(x,y,color='#b2f5c5',max=50){if(!state.settings.reduced)ripples.push({x,y,r:8,max,life:.5,color});}
function blocked(x,y){return x<45||y<90||x>W-45||y>H-45||world.obstacles.some(o=>x>o.x-10&&x<o.x+o.w+10&&y>o.y-10&&y<o.y+o.h+10);}
function findPath(x,y){
 if(!world.obstacles.length)return[{x,y}];const cols=Math.floor(W/40),rows=Math.floor(H/40),sx=Math.floor(player.x/40),sy=Math.floor(player.y/40),gx=clamp(Math.floor(x/40),1,cols-2),gy=clamp(Math.floor(y/40),2,rows-2),start=sy*cols+sx,end=gy*cols+gx,queue=[start],parents=new Map([[start,-1]]);let at=0;
 while(at<queue.length){const cell=queue[at++];if(cell===end)break;for(const[nx,ny]of[[cell%cols+1,Math.floor(cell/cols)],[cell%cols-1,Math.floor(cell/cols)],[cell%cols,Math.floor(cell/cols)+1],[cell%cols,Math.floor(cell/cols)-1]]){if(nx<1||ny<2||nx>=cols-1||ny>=rows-1||blocked(nx*40+20,ny*40+20))continue;const id=ny*cols+nx;if(!parents.has(id)){parents.set(id,cell);queue.push(id);}}}
 if(!parents.has(end))return[];const result=[];for(let i=end;i!==start&&i>=0;i=parents.get(i))result.push({x:(i%cols)*40+20,y:Math.floor(i/cols)*40+20});return result.reverse();
}
function moveTo(x,y){player.tx=clamp(x,48,W-48);player.ty=clamp(y,100,H-48);path=findPath(player.tx,player.ty);}
function select(n){target=n;n.rush=0;attackClock=0;moveTo(n.x,n.y);lastInput=clock;ripple(n.x,n.y,'#cff5be',24);if((has('wings')&&combat().suit!=='sniper'||combat().suit==='santa')&&!world.obstacles.length){player.x=clamp(n.x-32,50,W-50);player.y=clamp(n.y+20,100,H-50);path=[];if(combat().suit==='santa')for(const o of[...world.nodes])if(['ore','stone','life'].includes(o.kind)&&distance(n,o)<110)mine(o,1,1,false);}}
function screenToWorld(x,y){const r=canvas.getBoundingClientRect();return{x:(x-r.left)/zoom+cam.x,y:(y-r.top)/zoom+cam.y};}
canvas.addEventListener('pointerdown',e=>{if(paused||suspended)return;e.preventDefault();lastInput=clock;const p=screenToWorld(e.clientX,e.clientY);let nearest=null,best=35;for(const n of world.nodes){const d=distance(n,p);if(d<best){best=d;nearest=n;}}if(nearest)select(nearest);else if(world.boss&&distance(world.boss,p)<65)select(world.boss);else{target=null;moveTo(p.x,p.y);ripple(p.x,p.y);}});
function removeNode(n){world.nodes=world.nodes.filter(v=>v!==n);if(target===n){target=null;path=[];player.tx=player.x;player.ty=player.y;}}
function mine(n,scale=1,hits=1,proc=true){
 if(!n||n.remaining===0||n!==world.boss&&!world.nodes.includes(n)||world.cleared&&world.mode==='temple')return;
 if(n!==world.boss&&!['ore','stone','tree','life','snow','seal'].includes(n.kind)){interact(n);return;}
 if(n.kind==='seal'&&C.total(state)<n.requirement){if(target===n&&toastTimer<1)toast('봉인 요구 합계 '+C.format(n.requirement)+' · 현재 '+C.format(C.total(state)));n.hp=n.max;return;}
 const cc=combat();let dmg=C.damage(cc)*scale*(cc.suit==='ghost'&&clock-lastInput>4?Math.min(1,.5+C.option(state,'ghost')):1)*(has('rush')?1+Math.min(60,n.rush||0)*.04:1);let lucky=false;
 if(proc&&n.first&&has('lucky')&&Math.random()<.1){hits+=Math.ceil(6/Math.max(1e-9,C.interval(cc)));n.hp=1;lucky=true;}n.first=false;
 if(luckTime>0){dmg=Math.max(dmg,n.max);lucky=true;}
 if(n===world.boss){n.hp-=dmg*hits*(1+C.option(state,'boss'));n.flash=.12;if(n.hp<=0)bossWin();return;}
 const available=n.remaining,damage=dmg*hits,oldHp=n.hp;let cycles=damage>=oldHp?1+Math.floor((damage-oldHp)/n.max):0;cycles=Math.min(available,cycles);n.hp=cycles?n.max-((damage-oldHp)%n.max):oldHp-damage;n.remaining-=cycles;n.flash=.1;swing=.18;
 if(cycles){
   if(n.goldBreak){n.goldBreak=Math.max(0,n.goldBreak-Math.min(.25,cycles*.01));n.max=Math.max(1,n.originalMax*Math.pow(.7,n.goldBreak));n.hp=Math.min(n.hp,n.max);}
   if(n.kind==='life'){const b=world.boss;if(b){b.hp-=b.max*.19;player.hp=Math.min(maxHealth(),player.hp+12);ripple(n.x,n.y,'#fff3cc',110);float('생명석 파괴',n.x,n.y,'#caffdf');if(b.hp<=0)bossWin();}}
   else if(n.kind==='seal'){
     if(C.unseal(state,world.biome)){toast(world.biome===16?'차원 봉인 '+state.dimensionSeals+'/7 해제':'봉인 해제! '+C.MINES[world.biome].name);if(world.biome===16&&state.dimensionSeals<7)generate(16,1,null,'seal');else generate(world.biome,1);save();return;}
   }else if(n.kind==='snow'){world.mined+=cycles;if(world.boss){world.boss.hp-=world.boss.max*cycles/120;ripple(player.x,player.y,'#ddf6ff',40);if(world.boss.hp<=0)bossWin();}}
   else{
     let value=C.reward(state,n.id,cycles);if(world.mode==='daily'&&world.dayIndex===5){C.credit(state,value*2);value*=3;}
     sessionValue+=value;world.mined+=cycles;world.score+=cycles;if(!world.dailyKinds.includes(n.id))world.dailyKinds.push(n.id);
     if(world.mode==='daily'&&world.dayIndex===3)world.styleCounts[cc.suit]=(world.styleCounts[cc.suit]||0)+cycles;
     float('+'+C.format(value)+(cycles>1?' ×'+C.format(cycles):'')+(lucky?' 행운':''),n.x,n.y);sound('coin');
     if(n.id===59&&n.remaining<=0&&world.biome===13&&world.floor===6){const required=[...new Set(C.MINES.slice(0,14).flatMap(m=>m.ores))];if(required.every(id=>state.seen[id]>0)){state.temple.unlocked=true;toast('죽음의 꽃 완전 채굴 · 각인의 사원이 열렸어!');}else toast('각인의 사원: 심연까지의 미발견 광물 '+required.filter(id=>!state.seen[id]).length+'종 남음');}
   }
 }else if(proc&&Math.random()<.2)sound('hit');
 if(n.remaining<=0&&world.nodes.includes(n)){burst(n.x,n.y,C.ORES[n.id].color,10);const debris=['ore'].includes(n.kind)&&!has('rubble')&&!['trial','daily'].includes(world.mode);const x=n.x,y=n.y;removeNode(n);if(debris)world.nodes.push(node(0,x,y,'stone'));}
}
function interact(n){
 if(!world.nodes.includes(n))return;target=null;
 if(n.kind==='chest'){
   if(n.chest==='silver'){state.items.trialPass=Math.min(99,state.items.trialPass+1);toast('은 상자 · 속도의 시련 출입증 +1');}
   else if(n.chest==='gold'){for(const o of world.nodes)if(o.id===22){o.id=21;o.max=C.ORES[21].hardness;o.hp=o.max;}toast('금 상자 · 석관이 에메랄드 풍뎅이로 변했어!');}
   else if(n.chest==='tree'){for(const o of world.nodes)if(o.kind==='tree'){o.id=Math.random()<.5?23:24;o.kind='ore';o.max=C.ORES[o.id].hardness;o.hp=o.max;o.remaining=C.ORES[o.id].qty;}toast('다이아 상자 · 나무가 버섯과 호박으로 변했어!');}
   else{const value=Math.floor((250+world.floor*80)*(1+C.total(state)*.1));C.credit(state,value);toast('보급 상자 · +'+C.format(value)+' G');}state.stats.treasures++;removeNode(n);
 }else if(n.kind==='map'){world.nodes.push(special('key',n.x+65,n.y),special('hiddenEntry',n.x+110,n.y+70));toast('보물지도 발견 · 열쇠와 숨겨진 길을 찾았어.');removeNode(n);}
 else if(n.kind==='key'){state.items.keys++;toast('비밀 열쇠 +1 · 보유 '+state.items.keys+'개');removeNode(n);}
 else if(n.kind==='potion'){state.items.potions++;state.boostUntil=Math.max(Date.now(),state.boostUntil)+60000;toast('능력치 물약 · 1분 동안 +50%');removeNode(n);}
 else if(n.kind==='treasure'){C.credit(state,10000*(1+C.total(state)));state.stats.treasures++;toast('숨겨진 보물 발견!');removeNode(n);}
 else if(n.kind==='bomb'){removeNode(n);ripple(n.x,n.y,'#ffd590',350);for(const o of[...world.nodes])if(['ore','stone','tree','life'].includes(o.kind)&&distance(n,o)<350)mine(o,2,10,false);sound('upgrade');}
 else if(n.kind==='switch'){n.colorIndex=(n.colorIndex+1)%4;const switches=world.nodes.filter(x=>x.kind==='switch');if(switches.length===4&&switches.every(x=>x.colorIndex===n.colorIndex)){for(const x of switches)removeNode(x);world.nodes.push(node(46,n.x,n.y));state.stats.puzzles++;toast('네 가지 빛의 공명 · 유물 상자가 나타났어!');}else toast(['붉은','푸른','초록','분홍'][n.colorIndex]+' 스위치');target=null;}
 else if(n.kind==='puzzle'||n.kind==='altar')puzzleModal(n.kind==='altar');
 else if(n.kind==='blackhole'){const biome=world.biome;generate(biome,world.floor);for(const o of[...world.nodes])if(o.kind==='ore')mine(o,1,Math.max(1,C.level(state,'speed')/10),false);toast('블랙홀의 반향 · 별들이 광산을 휩쓸었어!');}
 else if(n.kind==='shortcut'){generate(world.biome,9);toast('시간 지름길 · B9로 이동했어.');}
 else if(n.kind==='memo'){if(!state.notes.includes(n.number))state.notes.push(n.number);removeNode(n);showModal('memo','천상의 비망록 '+n.number,'<p class="intro">'+['산은 멀리서 보면 하나지만, 안으로 들어가면 수천 개의 길이다.','돌조차 언젠가는 빛을 낸다.','세 개의 문은 끈기, 발견, 승리를 기억한다.','무한은 끝없는 깊이가 아니라 다시 시작하는 용기다.','시간의 수확자는 같은 계절을 쉰 번 기다린다.','비밀 열쇠 일곱 개가 두 번째 문을 연다.','작은 돌 삼억 개가 첫 번째 문을 기억한다.','전자와 별의 길이 다른 광산에서 이어진다.','죽음의 꽃은 모든 발견을 알고 있다.','세 개의 문 너머, 무한의 열쇠가 기다린다.'][n.number-1]+'</p><button class="primary" data-action="close">기록하고 돌아가기</button>');}
 else if(n.kind==='doors')skyModal();
 else if(n.kind==='cipher')cipherModal(n);
 else if(n.kind==='electronicPortal'){state.secret.enabled=true;state.secret.step=0;generate(0,1);toast('포탈 암호: 다이아 → 얼음 → 시간 → 황금 → 환생 사원');}
 else if(n.kind==='sequence'){
   const order=[2,6,11,1,-1];if(n.sequenceMine===order[state.secret.step]){state.secret.step++;removeNode(n);if(state.secret.step===5){generate(19,1);toast('전자광산 비밀의 방에 도착했어.');}else toast('포탈 연결 '+state.secret.step+'/5 · 다음 '+['다이아','얼음','시간','황금','환생 사원'][state.secret.step]);}else{state.secret.step=0;toast('포탈 순서가 어긋났어. 다이아 광산부터 다시 연결해.');}target=null;
 }else if(n.kind==='brokenPick'){state.pickaxe.found=true;removeNode(n);toast('부서진 차원의 곡괭이 발견! 장비에서 파편 50개로 수리해.');}
 else if(n.kind==='blacklist'){if(!state.secret.completed){state.secret.completed=true;C.reward(state,65,5);state.souls+=500;}removeNode(n);toast('일급 비밀 5개 · 전자 징표 획득! 금고와 미다스 효율 2배');}
 else if(n.kind==='hiddenEntry'){if((state.items.keys||0)>=7){state.items.keys-=7;const back=snapshot();generate(17,1,null,'mine',{returnTo:back});toast('숨겨진 방 · 귀한 보석을 찾아 봐.');}else toast('숨겨진 방에는 비밀 열쇠 7개가 필요해.');}
 else if(n.kind==='snowEntry'){const back=snapshot();generate(18,1,null,'snow',{returnTo:back});toast('눈덮인 산 · 눈을 캐서 눈사람을 맞혀!');}
 else if(n.kind==='exit'){leaveSpecial();}
 save();hud();
}
function leaveSpecial(){const back=world.returnTo;if(back)generate(back.biome,back.floor,back);else generate(0,1);}
function bossWin(){
 const b=world.boss;if(!b)return;const name=b.name;burst(b.x,b.y,'#ffd99c',50);ripple(b.x,b.y,'#fff2c2',220);const gold=C.bossReward(state,world.biome,name);
 world.boss=null;world.cleared=true;world.nodes=[];target=null;path=[];bullets=[];warningZones=[];player.hp=maxHealth();player.tx=player.x;player.ty=player.y;
 if(world.mode==='snow'){state.trialMarks.snow=Math.min(5,(state.trialMarks.snow||0)+1);toast('눈덮인 산 정복 · 눈의 징표 2 획득!');if(world.dailySource)C.finishDaily(state,world.score);}
 else toast(name+' 격파! +'+C.format(gold)+' G · 영혼 +'+(3+C.MINES[world.biome].rank*3));
 if(world.mode==='trial')C.trialReward(state,world.trial,world.floor);
 if(world.mode==='daily'&&world.floor>=3)dailyComplete();sound('upgrade');save();hud();
}
function hitPlayer(amount,slow=false){if(player.invuln>0)return;player.hp-=Math.round(amount*(1-Math.min(.6,(state.trialMarks.power2Hard||0)*.015)));player.invuln=combat().suit==='warden'?1.4:.8;if(slow)world.slowUntil=clock+2;shake=state.settings.reduced?0:4;vibrate();sound('hurt');float('-'+Math.round(amount),player.x,player.y-20,'#ff9c89');
 if(player.hp<=0){if(world.boss&&state.reviveEnabled&&state.items.reviveBook>0&&!world.revived){state.items.reviveBook--;world.revived=true;player.hp=maxHealth();player.invuln=3;toast('부활의 책 · 이번 전투 한 번 더!');return;}state.stats.deaths++;if(world.mode==='trial')C.trialReward(state,world.trial,world.floor-1);const lost=Math.floor(state.gold*.05);state.gold-=lost;generate(0,1);save();toast('구조되었어. 골드 5%를 잃고 자유 광산으로 귀환했어.');}}
function shoot(b,angle,speed=120,extra={}){if(bullets.length<260)bullets.push({x:b.x,y:b.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:6,life:9,color:'#ffd39b',...extra});}
function ring(b,count=8,speed=120,offset=0,extra={}){for(let i=0;i<count;i++)shoot(b,offset+i*Math.PI*2/count,speed,extra);}
function fan(b,a,count=5,spread=.8,speed=140,extra={}){for(let i=0;i<count;i++)shoot(b,a+(i-(count-1)/2)*spread/Math.max(1,count-1),speed,extra);}
function warn(x,y,r=55,t=1,extra={}){warningZones.push({x,y,r,t,delay:t,duration:.25,active:0,...extra});}
function charge(b,a,speed=320,duration=.7){b.charge=duration;b.vx=Math.cos(a)*speed;b.vy=Math.sin(a)*speed;ripple(b.x,b.y,'#f7c6a0',70);}
function bossUpdate(dt){
 const b=world.boss;if(!b)return;const low=b.hp/b.max<.4,ang=Math.atan2(player.y-b.y,player.x-b.x);b.timer-=dt;b.phase+=dt;b.rotation+=dt*(low?1.7:1);
 if(b.charge>0){b.charge-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.x<85||b.x>W-85)b.vx*=-1;if(b.y<120||b.y>H-85)b.vy*=-1;b.x=clamp(b.x,80,W-80);b.y=clamp(b.y,115,H-80);if(distance(b,player)<52)hitPlayer(18,b.pattern==='yeti'||b.pattern==='twins');}
 if(b.timer<=0){
   b.timer=low?1:1.8;b.stage++;const move=()=>{b.x=clamp(player.x+rand(-230,230),130,W-130);b.y=clamp(player.y+rand(-210,210),150,H-130);ripple(b.x,b.y,'#b7deef',90);};
   switch(b.pattern){
    case'summon':shoot(b,ang,120);world.minions=world.minions||[];if(world.minions.length<5)world.minions.push({x:b.x+rand(-70,70),y:b.y+70,hp:50,kind:'goblin'});break;
    case'charge':if(b.stage%2)fan(b,ang,5,1.2,110);else charge(b,ang,330);break;
    case'bounce':charge(b,ang,260,1);ring(b,6,85);break;
    case'spiral':if(b.stage%2)charge(b,ang,330,.45);ring(b,low?2:6,120,b.rotation);break;
    case'cross':ring(b,4,145,b.rotation);b.timer=.85;break;
    case'homing':if(b.stage%4===0)fan(b,ang,7,1.1,105,{homing:.5});else charge(b,ang,290,.5);break;
    case'cage':for(let i=0;i<8;i++){const a=i*Math.PI/4;warn(player.x+Math.cos(a)*100,player.y+Math.sin(a)*100,25,1.3);}fan(b,ang,3,.7,115,{homing:.25});break;
    case'teleport':move();fan(b,Math.atan2(player.y-b.y,player.x-b.x),low?5:9,2,140);break;
    case'earth':for(let i=0;i<5;i++)shoot({x:90,y:100+i*190},Math.atan2(H-100-i*190,W-180),180,{r:16,color:'#aac9ae'});break;
    case'ghost':charge(b,ang+Math.PI/4,300);fan(b,ang,3,1.1,120,{homing:.35,color:'#b2b5ed'});break;
    case'watcher':if(low){b.timer=.4;shoot(b,ang,220);}else fan(b,ang,5,.8,90,{homing:.35});break;
    case'dragon':if(b.stage%2)move();ring(b,low?22:10,low?170:100,b.rotation,{color:'#dfadf2',homing:low?0:.25});break;
    case'twins':fan(b,ang,5,1.2,140,{color:b.stage%2?'#fa8e87':'#8ecfff',slow:b.stage%2===0});if(b.stage%3===0)charge(b,ang,300);break;
    case'meteor':for(let i=0;i<(low?8:3);i++)warn(i===0?player.x:rand(100,W-100),i===0?player.y:rand(140,H-100),45,1.1,{meteor:true});ring(b,8,100,b.rotation);break;
    case'laser':warn(b.x,b.y,14,.95,{shape:'line',angle:ang,len:1500,duration:1});fan(b,ang,3,1.2,110,{homing:.2,slow:low});break;
    case'forest':fan(b,ang,6,1.5,145,{homing:.45});if(b.stage%3===0)charge(b,ang,270);break;
    case'centaur':charge(b,ang,360,.6);fan(b,ang,8,2,135);break;
    case'yeti':charge(b,ang,300,.6);if(b.stage%2){warn(b.x,b.y,20,.8,{shape:'line',angle:ang,len:650,duration:.4,slow:true});}else fan(b,ang,7,2.2,90,{r:15,color:'#d6eeff',slow:true});break;
    case'pirate':ring(b,10,65,b.rotation);fan(b,ang,6,1.3,120,{homing:.22});break;
    case'sharks':if(b.stage%2)charge(b,ang,360,.7);else ring(b,12,135,b.rotation);break;
    case'quarters':{const q=(b.stage*3)%4;warn((q%2)*W/2,Math.floor(q/2)*H/2,0,1.05,{shape:'rect',w:W/2,h:H/2,duration:.5});break;}
    case'halves':{const horizontal=b.stage%2===0,side=b.stage%4<2;warn(horizontal?0:side?W/2:0,horizontal?(side?H/2:0):0,0,1.15,{shape:'rect',w:horizontal?W:W/2,h:horizontal?H/2:H,duration:.55});break;}
    case'providence':if(b.stage%2)warn(player.x,player.y,110,1.2,{outside:true,duration:.45});else warn(player.x,player.y,130,1.1,{duration:.5});fan(b,ang,4,1.6,100,{homing:.35});break;
    case'chaos':charge(b,ang,320,.8);ring(b,22,85,b.rotation);shoot(b,ang,210,{r:15});break;
    case'guardian':if(b.stage%3===0){for(const n of world.nodes.filter(n=>n.kind==='life'))fan(n,Math.atan2(player.y-n.y,player.x-n.x),4,.65,170,{color:'#b9b2f7'});}else charge(b,ang,350,.45);break;
    case'worm':charge(b,ang,400,.8);fan(b,ang,9,1.8,170);world.wormTrail=world.wormTrail||[];world.wormTrail.push({x:b.x,y:b.y});if(world.wormTrail.length>8)world.wormTrail.shift();break;
    case'reaper':move();warn(player.x,player.y,85,low?.7:1.3,{meteor:true});ring(b,12,135,b.rotation,{slow:b.stage%3===0,color:'#dbb7f2'});break;
    case'miner':if(b.stage%3===0){move();warn(b.x,b.y,165,.7,{duration:.5});}else if(b.stage%3===1){ring(b,18,155,b.rotation);}else{fan(b,ang,5,.6,220,{homing:.2});}break;
    case'snowman':b.timer=1.4;charge(b,ang,220,.65);fan(b,ang,7,1.8,100,{r:11,color:'#def3ff',slow:true});break;
    default:ring(b,8,120,b.rotation);
   }
   if(world.boss!==b)return;
   if(!world.nodes.some(n=>n.kind==='life')&&world.mode!=='snow')addLife(b.pattern==='guardian'?4:3);
   if(['ghost','guardian','worm'].includes(b.pattern))for(const n of world.nodes)if(n.kind==='life'){n.spirit=true;n.color='#c4b4ff';}
 }
 if(has('limit')&&world.ultMode==='shield'&&world.ultTime>0&&Math.floor(b.phase*2)!==Math.floor((b.phase-dt)*2)){const n=world.nodes.find(n=>n.kind==='life');if(n)mine(n,2,Math.max(1,.5/C.interval(combat())),false);}
 if(C.option(state,'decay')&&Math.floor(b.phase/5)!==Math.floor((b.phase-dt)/5)){b.hp-=b.max*C.option(state,'decay');if(b.hp<=0)bossWin();}
}
function hazards(dt){
 for(const bullet of bullets){
  if(bullet.homing){const a=Math.atan2(player.y-bullet.y,player.x-bullet.x),speed=Math.hypot(bullet.vx,bullet.vy);bullet.vx+=(Math.cos(a)*speed-bullet.vx)*dt*bullet.homing;bullet.vy+=(Math.sin(a)*speed-bullet.vy)*dt*bullet.homing;}
  bullet.x+=bullet.vx*dt;bullet.y+=bullet.vy*dt;bullet.life-=dt;
  if(world.nodes.some(n=>n.kind==='life'&&distance(n,bullet)<19))bullet.life=0;
  const shields=combat().suit==='shield'||world.ultMode==='shield'&&world.ultTime>0;
  if(shields&&orbitTimer<=0){const orb={x:player.x+Math.cos(clock*3)*52,y:player.y+Math.sin(clock*3)*38};if(distance(orb,bullet)<24){bullet.life=0;orbitTimer=.45;ripple(orb.x,orb.y,'#cad7ff',30);}}
  if(bullet.life>0&&distance(player,bullet)<bullet.r+11){bullet.life=0;hitPlayer(12+C.MINES[world.biome].rank*.8,bullet.slow);}
 }
 bullets=bullets.filter(b=>b.life>0&&b.x>30&&b.y>65&&b.x<W-30&&b.y<H-30);
 for(const z of warningZones){
  z.t-=dt;if(z.t>0)continue;z.active+=dt;
  let hit=z.shape==='rect'?player.x>=z.x&&player.x<=z.x+z.w&&player.y>=z.y&&player.y<=z.y+z.h:z.shape==='line'?Math.abs((player.x-z.x)*Math.sin(z.angle)-(player.y-z.y)*Math.cos(z.angle))<z.r+12:z.outside?distance(player,z)>z.r:distance(player,z)<z.r;
  if(hit)hitPlayer(22,z.slow);if(z.active<dt*1.5&&z.meteor)burst(z.x,z.y,'#f4bba4',18);
 }
 warningZones=warningZones.filter(z=>z.t>0||z.active<z.duration);
 if(world.minions)for(const m of world.minions){const d=distance(m,player);m.x+=(player.x-m.x)/Math.max(1,d)*62*dt;m.y+=(player.y-m.y)/Math.max(1,d)*62*dt;if(d<22)hitPlayer(9);if(combat().suit==='shield'&&d<80)m.hp=0;}
 world.minions=(world.minions||[]).filter(m=>m.hp>0).slice(0,10);
}
function skill(id){const need={dash:15,slam:30,luck:60}[id];if(C.total(combat())<need||cooldowns[id]>0||paused||hardMode()||combat().suit==='prisoner')return;
 if(id==='dash'){let dx=player.tx-player.x,dy=player.ty-player.y,d=Math.hypot(dx,dy);if(d<10){const n=world.nodes.filter(n=>['ore','life','stone'].includes(n.kind)).sort((a,b)=>distance(a,player)-distance(b,player))[0];if(n){select(n);dx=n.x-player.x;dy=n.y-player.y;d=Math.hypot(dx,dy);}}if(d<1){toast('먼저 이동할 곳을 눌러 줘.');return;}const step=Math.min(d,260);let x=player.x+dx/d*step,y=player.y+dy/d*step;if(!blocked(x,y)){burst(player.x,player.y,'#b6f3d3',12);player.x=x;player.y=y;path=[];}player.invuln=.6;cooldowns.dash=5;state.stats.dashes++;ripple(player.x,player.y,'#cfffe4',80);
 }else if(id==='slam'){cooldowns.slam=12;areaMine(player.x,player.y,190,4,1);shake=state.settings.reduced?0:4;}
 else{cooldowns.luck=30;luckTime=7;toast('행운 채굴 · 7초 동안 단단한 광맥도 한 번에!');}sound('upgrade');vibrate();hud();}
function areaMine(x,y,r,scale=1,hits=1){ripple(x,y,'#d7edb8',r);for(const n of[...world.nodes])if(['ore','stone','tree','life','snow','seal'].includes(n.kind)&&distance(n,{x,y})<r)mine(n,scale,hits,false);}
function ultimate(){
 const suit=combat().suit;if(suit==='prisoner'||hardMode()||!has('limit')||state.limitGauge<100||paused)return;
 state.limitGauge-=100;state.limitUses++;world.ultMode=suit;world.ultPulse=0;world.handOrigin={x:player.x,y:player.y};world.ultTime=suit==='hammer'?15:suit==='scientist'?3:10;
 if(['miner','scout','warden','alchemist','sniper','beach','santa','valentine'].includes(suit))for(const n of[...world.nodes])if(['ore','stone','life','tree','snow'].includes(n.kind)&&n.x>cam.x&&n.x<cam.x+width/zoom&&n.y>cam.y&&n.y<cam.y+height/zoom)mine(n,4,Math.max(2,1/C.interval(combat())),false);
 if(suit==='gold')for(const n of world.nodes)if(['ore','stone','life','seal'].includes(n.kind)&&(n.goldBreak||0)<3){n.originalMax=n.originalMax||n.max;n.goldBreak=(n.goldBreak||0)+1;n.max=Math.max(1,n.originalMax*Math.pow(.7,n.goldBreak));n.hp=Math.min(n.hp,n.max);}
 if(suit==='drill'){const a=Math.atan2(player.ty-player.y,player.tx-player.x);world.drill={x:player.x,y:player.y,vx:Math.cos(a)*250,vy:Math.sin(a)*250,hits:0};}
 toast(C.SUITS.find(s=>s.id===suit).name+' · 리미트 해제!');sound('upgrade');save();hud();
}
function readyGate(){if(world.mode==='seal')return false;if(world.mode==='temple')return world.templeStage==='escape';if(world.boss)return false;if(world.cleared)return true;if(world.mode==='trial'){const t=C.TRIALS.find(t=>t.id===world.trial);return t.type==='speed'?world.nodes.filter(n=>n.id===17).length===0:world.mined>=20;}
 if(world.biome===13)return!world.nodes.some(n=>n.id===56&&n.kind==='ore');return world.mined>=12;}
function descend(){
 if(world.mode==='temple'){if(world.templeStage!=='escape'){puzzleModal(true);return;}if(distance(player,world.gate)>90){moveTo(world.gate.x,world.gate.y);return;}state.temple.completed=true;generate(0,1);engraveModal();save();return;}
 if(!readyGate()){toast(world.boss?'생명석을 캐서 보스를 약화시켜!':world.biome===13?'이 층의 심연석을 전부 캐야 길이 열려.':world.mode==='trial'?'시련 목표를 먼저 완료해 줘.':'광물을 '+Math.max(0,12-world.mined)+'회 더 캐면 계단이 열려.');return;}
 if(distance(player,world.gate)>95){target=null;moveTo(world.gate.x,world.gate.y);toast('계단으로 이동 중 · 도착하면 한 번 더 눌러 줘.');return;}
 if(world.mode==='daily'){if(world.dayIndex===6&&world.floor<3){generate(world.biome,world.floor+1,null,'daily',{dayIndex:6,day:world.day});}else if(dailyGoal()){dailyComplete();}else toast('일일 목표를 먼저 완료해 줘.');save();return;}
 if(world.mode==='snow'){leaveSpecial();save();return;}
 if(world.floor>=finalFloor()){if(world.mode==='trial'){C.trialReward(state,world.trial,world.floor);toast('시련 완주! 징표와 영혼 결정을 획득했어.');generate(0,1);}else{generate(world.biome,1);toast('탐험 완료! B1에서 다시 시작해.');}}
 else{
  if(world.biome===15&&C.total(state)<200000+(world.floor+1)*100000){toast('무한 봉인 · 다음 층 요구 '+C.format(200000+(world.floor+1)*100000));return;}
  const {biome,floor,mode,trial,timeLeft,dayIndex,day}=world;const t=C.TRIALS.find(t=>t.id===trial);generate(biome,floor+1,null,mode,{trial,timeLeft:t?.type==='tech'?120*timerMultiplier():timeLeft,dayIndex,day});toast('B'+world.floor+' · 탐험을 계속하자.');
 }
 save();
}
function timerMultiplier(){return(combat().suit==='hammer'?1.25:1)*(1+C.option(state,'time')+(state.trialMarks.tech||0)*.02);}
function dailyGoal(){if(world.dayIndex===0)return world.score>=100&&world.enemyScore<100;if(world.dayIndex===1)return world.mined>=20&&distance(player,world.gate)<100;if(world.dayIndex===3)return['miner','drill','shield'].every(id=>(world.styleCounts[id]||0)>=10);if(world.dayIndex===4)return world.score>=80;if(world.dayIndex===5)return world.score>=150;if(world.dayIndex===7)return world.dailyKinds.length>=5;return world.cleared;}
function dailyComplete(){if(world.dailyFinished)return;world.dailyFinished=true;world.cleared=true;world.timeLeft=0;const reward=world.day===C.dayKey()&&C.finishDaily(state,world.score);toast(reward?'일일 광산 완료 · 촉매 +5 · 영혼 +30':'일일 도전 완료 · 오늘 보상은 이미 받았어.');save();}
function update(dt){
 clock+=dt;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('#toast').classList.remove('show');}if(paused||suspended)return;
 const scene=world;sessionSeconds+=dt;saveTimer+=dt;hudTimer+=dt;bgmTimer+=dt;C.refreshDay(state);
 if(state.settings.music&&audio&&bgmTimer>2.5){bgmTimer=0;const tones=C.MINES[world.biome].rank>=9?[130.81,196,246.94,293.66]:[164.81,220,261.63,329.63];playNote(tones[Math.floor(clock/2.5)%4],1.6,.008);}
 for(const k of Object.keys(cooldowns))cooldowns[k]=Math.max(0,cooldowns[k]-dt);luckTime=Math.max(0,luckTime-dt);player.invuln=Math.max(0,player.invuln-dt);swing=Math.max(0,swing-dt);shake=Math.max(0,shake-dt*20);orbitTimer=Math.max(0,orbitTimer-dt);
 if(world.timeLeft>0&&!world.dailyFinished){world.timeLeft-=dt;if(world.timeLeft<=0){if(world.mode==='trial')C.trialReward(state,world.trial,world.floor-1);generate(0,1);toast('제한시간 종료 · 다음 탐험에서 다시 도전해 봐.');save();return;}}
 if(world.mode==='temple'&&world.templeStage==='escape'){const c=world.chaser,d=distance(c,player);c.x+=(player.x-c.x)/Math.max(1,d)*145*dt;c.y+=(player.y-c.y)/Math.max(1,d)*145*dt;if(d<30)hitPlayer(35);}
 if(world.mode==='daily'&&world.dayIndex===0){world.enemyScore+=dt*.7;if(world.enemyScore>=100&&!dailyGoal()){generate(0,1);toast('채광 배틀 종료 · 라이벌이 먼저 100개를 캤어.');return;}}
 if(world.mode==='daily'&&!world.dailyFinished&&![2,6].includes(world.dayIndex)&&dailyGoal())dailyComplete();
 if(world.mode==='trial'&&C.TRIALS.find(t=>t.id===world.trial).type==='tech'){world.hazardTimer-=dt;if(world.hazardTimer<=0){world.hazardTimer=1.3;shoot({x:rand(100,W-100),y:90},Math.PI/2,140,{slow:true});warn(player.x,player.y,38,1.2);}}
 const cc=combat(),suit=cc.suit,range=suit==='sniper'?Math.max(width,height)/zoom:suit==='ninja'?180:suit==='scout'?61:['scientist','beach','valentine'].includes(suit)?70:47;
 if(suit==='ghost'&&(clock-lastInput>4||world.ultTime>0)&&!target){const n=world.nodes.filter(n=>['ore','stone','life','snow'].includes(n.kind)).sort((a,b)=>distance(a,player)-distance(b,player))[0];if(n){target=n;moveTo(n.x,n.y);}}
 const nearTarget=target&&distance(player,target)<=range+2;
 if(path.length&&(!nearTarget||suit==='ninja')){const p=path[0],dx=p.x-player.x,dy=p.y-player.y,d=Math.hypot(dx,dy),speed=155*(suit==='scout'?1.35:suit==='ninja'?1.5:suit==='alchemist'?.9:1)*(has('shoes')?1.15:1)*(has('boots')&&!nearTarget?1+Math.min(.7,(clock-lastInput)*.1):1)*(1+C.option(state,'move'))*(world.slowUntil>clock?.5:1)*(suit==='ghost'&&clock-lastInput>4?.75:1),step=Math.min(d,speed*dt);if(d<4)path.shift();else{const x=player.x+dx/Math.max(1,d)*step,y=player.y+dy/Math.max(1,d)*step;if(!blocked(x,player.y))player.x=x;if(!blocked(player.x,y))player.y=y;}}
 if(target&&distance(player,target)<=range+3){
  if(!['ore','stone','tree','life','snow','seal'].includes(target.kind)&&target!==world.boss){interact(target);}
  else{target.rush=(target.rush||0)+dt;attackClock+=dt;const interval=Math.max(1e-10,C.interval(cc)),hits=Math.min(1e8,Math.floor(attackClock/interval));if(hits>0){attackClock=Math.min(1,attackClock-hits*interval);const n=target;mine(n,1,hits);
    if(world!==scene)return;
    if(suit==='bighand')for(const o of[...world.nodes])if(o!==n&&['ore','stone','tree','life'].includes(o.kind)&&distance(player,o)<100)mine(o,1,hits,false);
    if(['scientist','beach'].includes(suit)){let point=n;const used=new Set([n]);for(let j=0;j<(suit==='scientist'?4:2);j++){const next=world.nodes.filter(o=>['ore','stone','life'].includes(o.kind)&&!used.has(o)&&distance(point,o)<170).sort((a,b)=>distance(point,a)-distance(point,b))[0];if(!next)break;lineEffects.push({x:point.x,y:point.y,x2:next.x,y2:next.y,life:.2});mine(next,.5,hits,false);used.add(next);point=next;}}
  }}
 }
 if(world!==scene)return;
 giantTimer-=dt;if(giantTimer<=0){giantTimer=5;if(has('giant'))areaMine(player.x,player.y,175,3,1);}
 midasTimer-=dt;if(midasTimer<=0){midasTimer=5;if(has('midas')){const v=Math.floor((1000+C.total(state)*2+C.option(state,'midas')+C.total(state)*C.option(state,'midasLevel'))*C.multiplier(state)*(state.secret.completed?2:1));C.credit(state,v);float('미다스 +'+C.format(v),player.x,player.y);}}
 companionTimer-=dt;if(companionTimer<=0){companionTimer=Math.max(.06,C.interval(cc)*2);if(has('shadow')||world.ultTime>0&&world.ultMode==='ninja'){const n=world.nodes.filter(n=>['ore','stone','life'].includes(n.kind)&&distance(player,n)<150).sort((a,b)=>distance(a,player)-distance(b,player))[0];if(n)mine(n,.5,Math.max(1,.15/Math.max(1e-9,C.interval(cc))),false);}}
 if(suit==='shield'&&Math.floor(clock*2)!==Math.floor((clock-dt)*2)){const orb={x:player.x+Math.cos(clock*3)*52,y:player.y+Math.sin(clock*3)*38};for(const n of[...world.nodes])if(['ore','stone','tree','life'].includes(n.kind)&&distance(n,orb)<35)mine(n,1.2,Math.max(1,.5/Math.max(1e-9,C.interval(cc))),false);}
 if(world.ultTime>0){world.ultTime-=dt;world.ultPulse=(world.ultPulse||0)-dt;if(world.ultPulse<=0){world.ultPulse=.15;if(world.ultMode==='bighand'){const hand=world.handOrigin||player;areaMine(hand.x,hand.y,155,1,Math.max(1,.15/Math.max(1e-9,C.interval(cc))));}if(world.ultMode==='scientist'){let point=player;const used=new Set();for(let j=0;j<8;j++){const n=world.nodes.filter(n=>['ore','stone','tree','life'].includes(n.kind)&&!used.has(n)&&distance(point,n)<230).sort((a,b)=>distance(point,a)-distance(point,b))[0];if(!n)break;lineEffects.push({x:point.x,y:point.y,x2:n.x,y2:n.y,life:.25});mine(n,1,Math.max(1,.15/Math.max(1e-9,C.interval(cc))),false);used.add(n);point=n;}}}if(world.ultMode==='hammer')areaMine(player.x,player.y,130,2,Math.max(1,dt/Math.max(1e-9,C.interval(cc))));if(world.ultMode==='drill'&&world.drill){const d=world.drill;d.x+=d.vx*dt;d.y+=d.vy*dt;for(const n of[...world.nodes])if(['ore','stone','life','seal'].includes(n.kind)&&distance(n,d)<65){mine(n,4,5,false);d.hits++;}if(d.hits>=20||d.x<50||d.y<95||d.x>W-50||d.y>H-50){areaMine(clamp(d.x,60,W-60),clamp(d.y,110,H-60),260,6,10);world.drill=null;}}}
 bossUpdate(dt);hazards(dt);if(world!==scene)return;
 if(state.settings.autoNext&&readyGate()&&!target&&world.mode==='mine'&&world.biome!==15){moveTo(world.gate.x,world.gate.y);if(distance(player,world.gate)<90)descend();}
 for(const n of world.nodes)n.flash=Math.max(0,n.flash-dt);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=150*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);for(const f of floats){f.y-=26*dt;f.life-=dt;}floats=floats.filter(f=>f.life>0);for(const r of ripples){r.r+=(r.max-r.r)*dt*8;r.life-=dt;}ripples=ripples.filter(r=>r.life>0);for(const l of lineEffects)l.life-=dt;lineEffects=lineEffects.filter(l=>l.life>0);
 const cx=clamp(player.x-width/zoom/2,0,Math.max(0,W-width/zoom)),cy=clamp(player.y-height/zoom/2,0,Math.max(0,H-height/zoom)),blend=state.settings.reduced?1:Math.min(1,dt*9);cam.x+=(cx-cam.x)*blend;cam.y+=(cy-cam.y)*blend;
 if(saveTimer>=10){if(sessionSeconds>10)state.rate=Math.min(1e30,sessionValue/sessionSeconds);save();saveTimer=0;}if(hudTimer>.16){hud();hudTimer=0;}
}
let lineEffects=[];
function objective(){
 if(world.mode==='seal')return'봉인석 · 합계 '+C.format(world.nodes[0]?.requirement||0)+' 필요';
 if(world.mode==='temple')return world.templeStage==='escape'?'사신을 피해 출구로 돌아가!':'다섯 블록을 옮겨 마법진을 복구해';
 if(world.mode==='trial'){const t=C.TRIALS.find(t=>t.id===world.trial);return t.type==='speed'?'길을 찾아 암흑물질을 채굴해':t.type==='tech'?'탄막 회피 · 채굴 '+Math.min(world.mined,20)+'/20':world.cleared?'보스 격파 · 다음 시련으로':'생명석을 노리고 탄막을 피해';}
 if(world.mode==='daily'){const goals=['라이벌보다 먼저 100회 채굴 · '+C.format(world.score)+'/100','20회 채굴 후 출구로 이동 · '+Math.min(20,world.mined)+'/20','눈을 캐서 거대 눈사람을 맞혀','개척자·드릴·방패 각각 10회 채굴','버섯과 나무 80회 채굴 · '+Math.min(80,world.score)+'/80','불타는 수익 3배 · '+Math.min(150,world.score)+'/150','수호자 3연전 · '+(world.floor-1)+'/3','희귀 광물 5종 발견 · '+world.dailyKinds.length+'/5'];return world.dailyFinished?'일일 도전 완료 · 보상 지급됨':goals[world.dayIndex];}
 if(world.mode==='snow')return'눈을 캐서 눈사람을 맞혀 · 제한시간 90초';
 if(world.boss)return'생명석 파괴 → '+world.boss.name+' 약화';
 if(world.cleared)return'보스 격파 · 출구로 탐험 마무리';
 if(world.biome===13)return'남은 심연석 '+world.nodes.filter(n=>n.id===56&&n.kind==='ore').length+'개를 전부 채굴해';
 return readyGate()?'계단 개방 · 더 깊은 곳으로':'계단 개방까지 채굴 '+Math.min(world.mined,12)+' / 12';
}
function hud(){if(!world)return;
 const cc=combat();$('#gold').innerHTML=C.format(state.gold)+' <small>G</small>';$('#souls').innerHTML=C.format(state.souls)+' <small>◆</small>';
 $('#mine-name').textContent=world.mode==='trial'?C.TRIALS.find(t=>t.id===world.trial).name:world.mode==='daily'?'일일 · '+C.DAILY[world.dayIndex]:world.mode==='temple'?'각인의 사원':C.MINES[world.biome].name;$('#floor').textContent='B'+world.floor;$('#objective').textContent=objective();
 $('#floor-progress i').style.width=(world.boss?(1-world.boss.hp/world.boss.max)*100:world.mode==='daily'?Math.min(100,world.score/100*100):Math.min(100,world.mined/12*100))+'%';
 $('#descend').textContent=world.mode==='temple'?'출구로 ↗':world.cleared?'탐험 완료 ↗':readyGate()?'다음 층 ↓':'계단 찾기 ↓';
 $('#health').classList.toggle('hidden',!world.boss&&!['trial','temple','snow'].includes(world.mode));$('#health i').style.width=player.hp/maxHealth()*100+'%';$('#health b').textContent=Math.ceil(player.hp);
 $('#boss-health').classList.toggle('hidden',!world.boss);if(world.boss){$('#boss-health span').textContent=world.boss.name;$('#boss-health i').style.width=Math.max(0,world.boss.hp/world.boss.max*100)+'%';}
 $('#total-level').textContent='Lv.'+C.format(C.baseTotal(state))+' +'+C.format(C.bonus(state)*3);$('#buy-mode').textContent='강화 '+(state.settings.buy===1e12?'MAX':'×'+state.settings.buy);
 for(const b of $$('[data-upgrade]')){const k=b.dataset.upgrade,lv=state.levels[k];b.querySelector('b').textContent=C.format(lv);b.querySelector('em').textContent=lv>=C.MAX_LEVEL?'MAX':C.format(C.cost(lv))+' G';b.classList.toggle('unaffordable',state.gold<C.cost(lv));}
 for(const[id,need]of Object.entries({dash:15,slam:30,luck:60})){const b=$('#'+id),locked=C.total(cc)<need||hardMode()||cc.suit==='prisoner';b.disabled=locked||cooldowns[id]>0;b.classList.toggle('ready',!locked&&cooldowns[id]===0);b.querySelector('small').textContent=locked?'합계 Lv.'+need:cooldowns[id]>0?Math.ceil(cooldowns[id])+'초':'사용 가능';}
 $('#ultimate').disabled=!has('limit')||state.limitGauge<100;$('#ultimate').innerHTML='<span>✦ 리미트</span><b>'+C.format(state.limitGauge)+'%</b>';
 $('#timer').classList.toggle('hidden',world.timeLeft<=0);$('#timer').textContent=Math.max(0,Math.ceil(world.timeLeft))+'s';
 $('#badge').classList.toggle('hidden',!C.ACHIEVEMENTS.some(a=>!state.claimed.includes(a.id)&&C.progress(state,a)>=a.goal));
 $('#catalyst-count').textContent=C.format(state.catalysts)+' 촉매';$('#boost-status').textContent=state.boostUntil>Date.now()?'부스트 '+Math.ceil((state.boostUntil-Date.now())/60000)+'분':world.ultTime>0?'리미트 '+Math.ceil(world.ultTime)+'초':C.SUITS.find(s=>s.id===cc.suit)?.name||'';
 const ti=$('#target-info');ti.classList.toggle('hidden',!target);if(target){const b=target===world.boss,ore=['ore','stone','tree'].includes(target.kind);ti.innerHTML='<b>'+(b?target.name:target.kind==='life'?target.spirit?'영혼석':'생명석':target.kind==='seal'?'봉인석':ore?C.ORES[target.id].name:specialName(target))+'</b><small>'+(b?'생명석을 캐면 더 큰 피해를 줘':ore?C.format(C.ORES[target.id].value*C.multiplier(cc,target.id))+' G · 잔량 '+C.format(target.remaining):target.kind==='life'?'파괴 시 보스 체력 감소·플레이어 회복':'가까이 다가가 상호작용')+'</small><div class="bar"><i style="width:'+Math.max(0,target.hp/target.max*100)+'%"></i></div>';}
}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,Math.max(0,rx),Math.max(0,ry),0,0,Math.PI*2);ctx.fill();}
function line(x1,y1,x2,y2,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function hash(x,y){return Math.abs(Math.sin(x*127.1+y*311.7)*43758.5453)%1;}
function polygon(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
function terrain(){
 const m=C.MINES[world.biome],space=['space','dimension','electronic','secret'].includes(m.theme),color=world.biome===15?['#30483d','#394956','#443b50','#514037','#414a31','#3c414c','#47384c'][world.floor%7]:m.floor;
 ctx.fillStyle=color;ctx.fillRect(0,0,W,H);const tile=40,x0=Math.max(0,Math.floor(cam.x/tile)-1),y0=Math.max(0,Math.floor(cam.y/tile)-1),x1=Math.min(W/tile,Math.ceil((cam.x+width/zoom)/tile)+1),y1=Math.min(H/tile,Math.ceil((cam.y+height/zoom)/tile)+1);
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
   const h=hash(x,y);rect(x*tile,y*tile,tile-1,tile-1,h>.6?'#ffffff06':'#00000008');
   if(h>.45){rect(x*tile+8,y*tile+9,4,2,'#ffffff0b');rect(x*tile+26,y*tile+25,3,3,'#00000020');}
   if(h>.92){if(space){rect(x*tile+14,y*tile+13,2,2,'#d6f2fb88');}else if(m.theme==='lava'){rect(x*tile+5,y*tile+14,28,2,'#f9ac5859');rect(x*tile+19,y*tile+16,2,11,'#f9ac583d');}else{rect(x*tile+15,y*tile+27,9,3,m.theme==='forest'?'#74945866':'#bdd2b41d');}}
   if(x===0||y<2||x===W/tile-1||y===H/tile-1){rect(x*tile,y*tile,tile,tile,m.wall);rect(x*tile+3,y*tile+4,34,27,'#ffffff0c');rect(x*tile,y*tile+32,40,8,'#00000042');}
 }
 if(['moss','gold','ruins','sand'].includes(m.theme)){
   for(let y=Math.max(100,Math.floor(cam.y/30)*30);y<Math.min(H-70,cam.y+height/zoom+30);y+=30)rect(W/2-31,y,66,7,'#7d6b4f');rect(W/2-20,90,4,H-150,'#acb7a0');rect(W/2+18,90,4,H-150,'#83927e');
 }
 for(const o of world.obstacles){rect(o.x,o.y,o.w,o.h,'#17292a');rect(o.x+3,o.y+3,o.w-6,o.h-9,'#66777a');rect(o.x+6,o.y+5,o.w-12,4,'#c1d1cd33');}
 for(const p of[{x:100,y:155},{x:440,y:440},{x:W-210,y:230},{x:W-220,y:H-210}]){
  if(p.x<cam.x-70||p.x>cam.x+width/zoom+70||p.y<cam.y-90||p.y>cam.y+height/zoom+90)continue;
  rect(p.x-5,p.y-10,10,25,'#55482f');rect(p.x-10,p.y-23,20,17,'#2a3029');rect(p.x-7,p.y-20,14,10,space?'#a6f3d7':'#f4d58b');
  const glow=ctx.createRadialGradient(p.x,p.y-15,2,p.x,p.y-15,80);glow.addColorStop(0,space?'#a3ffdc2a':'#ffe3942a');glow.addColorStop(1,'#ffe39400');ctx.fillStyle=glow;ctx.fillRect(p.x-85,p.y-100,170,170);
 }
 if(world.mode==='temple'){ctx.strokeStyle='#d8a9f4';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(W/2,H/2,130,85,0,0,Math.PI*2);ctx.stroke();line(W/2-110,H/2,W/2+110,H/2,'#b794de',2);line(W/2,H/2-80,W/2,H/2+80,'#b794de',2);}
}
function drawGate(){const g=world.gate,open=readyGate();ellipse(g.x,g.y+14,40,20,'#08161899');rect(g.x-30,g.y-30,60,58,'#112623');rect(g.x-34,g.y-34,68,10,'#a9b796');rect(g.x-34,g.y-24,9,55,'#718b76');rect(g.x+25,g.y-24,9,55,'#718b76');for(let i=0;i<5;i++)rect(g.x-23+i*2,g.y-12+i*8,46-i*4,5,open?'#c2d2a8':'#526359');if(!open){line(g.x-20,g.y-14,g.x+20,g.y+22,'#927952',6);line(g.x+20,g.y-14,g.x-20,g.y+22,'#927952',6);}else{ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.fillStyle='#d4f6bf';ctx.fillText('↓',g.x,g.y-44+(state.settings.reduced?0:Math.sin(clock*3)*3));}}
function gem(x,y,color,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);polygon([[-17,7],[-13,-17],[-5,-27],[2,-16],[8,-30],[17,-17],[20,7],[4,16]],color);polygon([[-13,-17],[-5,-27],[-2,7],[-17,7]],'#ffffff60');polygon([[8,-30],[17,-17],[20,7],[4,16]],'#0c192939');line(6,-25,6,4,'#ffffff4d',2);ctx.restore();}
function drawOre(n){
 const o=C.ORES[n.id],x=Math.round(n.x),y=Math.round(n.y),shape=n.kind==='tree'?'tree':n.kind==='life'?'spirit':n.kind==='snow'?'snow':o.shape;
 ellipse(x,y+15,25,9,'#06131470');const color=n.kind==='life'?n.spirit?'#c1acfc':'#a6f3d6':o.color;
 if(['tree','mushroom','pumpkin'].includes(shape)){
   if(shape==='tree'){rect(x-6,y-15,12,31,'#94724c');polygon([[x-27,y-9],[x-18,y-30],[x-9,y-35],[x+5,y-40],[x+25,y-25],[x+28,y-5]],'#6f9365');rect(x-13,y-17,7,7,n.kind==='tree'?'#a0bd79':'#f4d97f');rect(x+9,y-24,6,6,n.kind==='tree'?'#8fab6c':'#f4d97f');}
   else if(shape==='mushroom'){rect(x-5,y-2,10,18,'#d5c49b');ellipse(x,y-5,23,15,color);rect(x-15,y-8,6,4,'#ffefd7');rect(x+5,y-13,6,4,'#ffefd7');}
   else{ellipse(x,y,21,19,color);line(x-7,y-15,x-7,y+17,'#ba763e',2);line(x+7,y-15,x+7,y+17,'#ba763e',2);rect(x-3,y-25,6,10,'#80a66f');}
 }else if(['cloud','tar','snow'].includes(shape)){
   ellipse(x-12,y,13,12,color);ellipse(x+8,y-5,18,15,color);ellipse(x,y+7,23,10,color);rect(x-13,y+7,28,4,'#ffffff23');if(n.id===52){line(x,y-10,x-7,y+1,'#f1d68e',4);line(x-7,y+1,x+5,y+3,'#f1d68e',4);}
 }else if(['orb','planet','egg','coin','infinite'].includes(shape)){
   ellipse(x,y-3,21,shape==='egg'?28:21,color);ellipse(x-7,y-10,6,8,'#ffffff40');if(shape==='planet'){ctx.strokeStyle='#d4def0';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y,31,9,-.4,0,Math.PI*2);ctx.stroke();}if(shape==='coin'){ctx.fillStyle='#72542f';ctx.font='bold 22px monospace';ctx.textAlign='center';ctx.fillText('₿',x,y+5);}if(shape==='infinite'){ctx.fillStyle='#264e42';ctx.font='bold 27px sans-serif';ctx.textAlign='center';ctx.fillText('∞',x,y+5);}
 }else if(['brick','book','chest','pillar','machine','clock','relic','code'].includes(shape)){
   rect(x-23,y-22,46,35,'#162b27');rect(x-20,y-25,40,34,color);rect(x-18,y-23,36,6,'#ffffff3d');rect(x-20,y+5,40,5,'#00000034');
   if(shape==='chest'){rect(x-22,y-5,44,4,'#b5965f');rect(x-3,y-7,7,11,'#f4d994');}else if(shape==='pillar'){rect(x-12,y-38,24,49,color);rect(x-22,y-42,44,9,color);line(x-5,y-30,x-5,y+5,'#ffffff40',3);}else if(shape==='clock'){ellipse(x,y-7,13,13,'#1d343a');line(x,y-7,x+7,y-12,'#f7e0bc',2);line(x,y-7,x,y-17,'#f7e0bc',2);}else if(shape==='code'){rect(x-4,y-17,8,26,'#184638');rect(x-14,y-8,28,8,'#184638');}else{line(x-13,y-7,x+12,y-7,'#1c34454d',3);line(x-12,y,x+7,y,'#1c34454d',3);}
 }else if(['coral','flower','flame','vortex','rift','star','foot','beetle','shell','fountain'].includes(shape)){
   if(shape==='star'){const points=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?10:25;points.push([x+Math.cos(a)*r,y+Math.sin(a)*r]);}polygon(points,color);polygon([[x,y-25],[x-6,y+3],[x-23,y-8]],'#ffffff43');}
   else if(shape==='rift'||shape==='vortex'){for(let i=3;i>=0;i--){ellipse(x+Math.sin(clock+i)*3,y-i*6,22-i*4,7,color+'99');}ellipse(x,y-9,7,16,'#12182d');}
   else if(shape==='flower'){rect(x-3,y-3,6,20,'#7caa7e');for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ellipse(x+Math.cos(a)*12,y-15+Math.sin(a)*12,10,7,color);}ellipse(x,y-15,6,6,'#fff3b9');}
   else if(shape==='shell'){ellipse(x,y,25,17,color);polygon([[x-20,y-3],[x,y-18],[x+20,y-3]],'#ffffff44');ellipse(x,y+2,8,8,'#faf0ed');}
   else if(shape==='foot'){ellipse(x,y+2,14,18,color);for(let i=0;i<3;i++)ellipse(x-12+i*11,y-18,5,6,color);}
   else if(shape==='beetle'){ellipse(x,y-3,15,20,color);line(x,y-20,x,y+15,'#183d3355',2);for(const a of[-1,1])for(let i=0;i<3;i++)line(x+a*10,y-14+i*11,x+a*25,y-18+i*14,color,3);}
   else if(shape==='coral'){for(let i=0;i<4;i++){line(x-18+i*11,y+13,x-18+i*11,y-10-i%2*12,color,5);line(x-18+i*11,y-3,x-25+i*11,y-12,color,4);}}
   else if(shape==='fountain'){ellipse(x,y+6,26,12,'#accdc2');line(x,y-28,x,y+8,color,8);line(x,y-24,x-18,y-10,color,3);line(x,y-24,x+18,y-10,color,3);}
   else gem(x,y,color,1);
 }else if(n.id<5||n.kind==='stone'){
   rect(x-23,y-6,46,24,'#1b2826');polygon([[x-22,y+12],[x-21,y-6],[x-9,y-18],[x+11,y-15],[x+23,y],[x+19,y+14]],n.id===0?'#7f8c7b':'#637466');for(let i=0;i<4;i++){const dx=[-14,0,9,-4][i],dy=[-3,-12,-2,6][i];rect(x+dx,y+dy,8,7,color);rect(x+dx,y+dy,5,2,'#ffffff55');}
 }else{rect(x-21,y+2,42,17,'#182926');gem(x,y,color,n.kind==='life'?1.1:.95);}
 if((n.kind==='life'||o.value>=5000)&&!state.settings.reduced&&Math.sin(clock*3+n.x)>.6){rect(x-24,y-27,2,8,'#ecffe4');rect(x-27,y-24,8,2,'#ecffe4');}
 if(n.flash>0){ctx.globalAlpha=n.flash*3;ellipse(x,y,23,20,'#ffffff');ctx.globalAlpha=1;}
 if(target===n){ctx.strokeStyle='#c1f7ba';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+16,31,14,0,0,Math.PI*2);ctx.stroke();}
}
const SPECIALS={chest:['▣','보급 상자'],switch:['◈','빛의 스위치'],map:['⌘','보물지도'],bomb:['✹','광산 폭탄'],blackhole:['◉','작은 블랙홀'],shortcut:['◷','시간 지름길'],memo:['▤','천상의 비망록'],doors:['♜','천상의 세 문'],cipher:['01','전자 수수께끼'],electronicPortal:['◎','전자 포탈'],brokenPick:['⚒','부서진 곡괭이'],exit:['↗','돌아가는 길'],blacklist:['▥','블랙리스트'],sequence:['◎','연결 포탈'],key:['⚿','비밀 열쇠'],potion:['♙','능력치 물약'],treasure:['◆','숨겨진 보물'],snowEntry:['❄','눈덮인 산 입구'],puzzle:['▦','밀어내기 퍼즐'],altar:['✦','사원의 마법진'],seal:['⛉','봉인석'],hiddenEntry:['↧','숨겨진 방']};
function specialName(n){return SPECIALS[n.kind]?.[1]||'발견물';}
function drawSpecial(n){const x=n.x,y=n.y,color=n.kind==='switch'?['#f48a80','#88c6f1','#a2d9a6','#d2a6e9'][n.colorIndex]:n.kind==='seal'?'#bb9ed2':'#f0d395';ellipse(x,y+15,25,10,'#06131588');if(n.kind==='seal'){polygon([[x-28,y+17],[x-25,y-23],[x-14,y-35],[x+21,y-27],[x+30,y+13]],'#64747a');line(x-18,y-15,x+18,y+9,color,4);line(x+15,y-20,x-12,y+12,color,4);}else if(['sequence','electronicPortal','blackhole','hiddenEntry'].includes(n.kind)){for(let i=3;i>0;i--)ellipse(x,y-4,7+i*8,12+i*9,(i%2?'#b6c4ed':'#91edc5')+'55');ellipse(x,y-4,15,23,'#152134');}else{rect(x-22,y-20,44,34,'#203a34');rect(x-20,y-22,40,7,color);rect(x-20,y+9,40,5,color+'99');ctx.font='bold 24px monospace';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(SPECIALS[n.kind]?.[0]||'?',x,y+5);}ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillStyle='#e4ecd7';ctx.strokeStyle='#15231e';ctx.lineWidth=3;ctx.strokeText(specialName(n),x,y-43);ctx.fillText(specialName(n),x,y-43);}
function drawPlayerAt(x,y,suit,alpha=1){
 ctx.save();ctx.globalAlpha=alpha;const moving=path.length>0,bob=state.settings.reduced?0:moving?Math.round(Math.sin(clock*13)*2):0,right=(target?target.x:player.tx)>=x,coat=C.SUITS.find(s=>s.id===suit)?.color||'#e4ac6b';
 ellipse(x,y+14,17,7,'#04110e80');rect(x-10,y-5+bob,20,20,'#27413c');rect(x-8,y-5+bob,16,13,coat);rect(x-8,y+8,6,7,'#162d2b');rect(x+3,y+8,6,7,'#162d2b');rect(x-10,y+14+(moving?bob:0),8,4,'#1b2927');rect(x+3,y+14-(moving?bob:0),8,4,'#1b2927');
 rect(x-9,y-23+bob,19,18,'#f4cf9e');rect(x-11,y-25+bob,23,7,'#9d764f');rect(x-13,y-20+bob,27,5,coat);rect(x-7,y-31+bob,15,8,coat);rect(x-3,y-28+bob,6,6,'#ffefc5');rect(x+(right?4:-6),y-11+bob,3,3,'#233731');rect(x-13,y-3+bob,5,12,'#f4cf9e');rect(x+10,y-3+bob,5,12,'#f4cf9e');
 if(suit==='ninja'){rect(x-9,y-19+bob,20,8,'#4e426a');rect(x-15,y-13+bob,10,4,'#b59be6');}if(suit==='santa'){polygon([[x-10,y-26+bob],[x+5,y-46+bob],[x+12,y-24+bob]],'#e98d8b');ellipse(x+5,y-43+bob,4,4,'#fff1e6');}if(suit==='ghost'){ellipse(x,y-8,23,28,'#b7f4f11f');}
 ctx.save();ctx.translate(x+(right?13:-13),y-2+bob);ctx.scale(right?1:-1,1);ctx.rotate(swing>0?-.9+(.18-swing)*9:.4);
 if(suit==='drill'){rect(-4,-6,14,20,'#a8b2cf');polygon([[2,-25],[13,-6],[-7,-6]],'#d0d8e8');}
 else if(suit==='hammer'){rect(0,-18,4,30,'#9c764b');rect(-11,-24,28,12,'#e8b7d2');}
 else if(suit==='sniper'){line(3,-23,3,13,'#d6d9b6',4);line(3,-23,14,-5,'#a8d3dd',2);line(14,-5,3,13,'#a8d3dd',2);}
 else{rect(0,-16,4,28,'#a28055');rect(-10,-21,26,7,state.pickaxe.repaired?'#d2b4f7':'#d2e4d7');rect(12,-16,5,8,'#a8bfb9');}ctx.restore();ctx.restore();
}
function drawPlayer(){const blink=player.invuln>0&&Math.floor(clock*14)%2===0;drawPlayerAt(Math.round(player.x),Math.round(player.y),combat().suit,blink?.45:1);if(luckTime>0)ellipse(player.x,player.y+14,25,10,'#ffe8a433');if(has('shadow')||world.ultMode==='ninja'&&world.ultTime>0)drawPlayerAt(player.x-36,player.y+25,'ninja',.5);
 if(combat().suit==='shield'||world.ultMode==='shield'&&world.ultTime>0){const x=player.x+Math.cos(clock*3)*52,y=player.y+Math.sin(clock*3)*38;ellipse(x,y,15,18,'#849bc7');ellipse(x,y,9,12,'#d4dfef');rect(x-3,y-4,6,8,'#7e97b8');}
 if(has('radar')){const n=world.nodes.filter(n=>world.boss?n.kind==='life':n.kind==='ore').sort((a,b)=>C.ORES[b.id].value-C.ORES[a.id].value||distance(a,player)-distance(b,player))[0];if(n)directionArrow(n,'#b7f2c5',0);}
 if(has('compass'))directionArrow(world.boss||world.gate,'#f4b39d',12);
}
function directionArrow(p,color,offset){const a=Math.atan2(p.y-player.y,p.x-player.x),x=player.x+Math.cos(a)*(43+offset),y=player.y+Math.sin(a)*(43+offset);ctx.save();ctx.translate(x,y);ctx.rotate(a);polygon([[12,0],[-7,-6],[-3,0],[-7,6]],color);ctx.restore();}
function drawBoss(){const b=world.boss;if(!b)return;const x=b.x,y=b.y+(state.settings.reduced?0:Math.sin(clock*2)*3),p=b.pattern,color=C.MINES[world.biome].color;ellipse(x,y+33,62,24,'#06101199');
 if(['bounce','snowman'].includes(p)){ellipse(x,y,53,p==='snowman'?53:37,p==='snowman'?'#cde4e7':color);ellipse(x-20,y-27,13,8,'#ffffff44');rect(x-22,y-6,9,7,'#243e39');rect(x+15,y-6,9,7,'#243e39');rect(x-10,y+13,23,4,'#365249');if(p==='snowman'){rect(x-27,y-67,54,12,'#6e6f7e');rect(x-20,y-87,40,23,'#777b8c');}}
 else if(['dragon','twins','chaos'].includes(p)){polygon([[x-22,y-9],[x-85,y-62],[x-78,y+16],[x-40,y+8]],'#8b819c');polygon([[x+22,y-9],[x+85,y-62],[x+78,y+16],[x+40,y+8]],color);ellipse(x,y,35,41,color);polygon([[x-22,y-29],[x-17,y-63],[x+23,y-49],[x+36,y-27]],color);rect(x+5,y-46,10,6,'#fff2c4');line(x-20,y+20,x-50,y+47,color,12);if(p==='twins')ellipse(x-85,y+10,22,30,'#8ac7f3');}
 else if(['worm','homing','sharks'].includes(p)){for(let i=0;i<5;i++){const a=clock+i*.7;ellipse(x+Math.cos(a)*i*18,y+Math.sin(a)*i*9,28-i*2,25-i,color);}rect(x-19,y-11,9,7,'#f5e4a4');rect(x+10,y-11,9,7,'#f5e4a4');}
 else if(['ghost','watcher','reaper','providence'].includes(p)){polygon([[x-42,y+35],[x-32,y-20],[x,y-58],[x+34,y-20],[x+43,y+35],[x+13,y+24],[x,y+39],[x-14,y+23]],color);ellipse(x,y-11,23,25,'#1e253a');rect(x-15,y-14,10,7,'#ffceb8');rect(x+6,y-14,10,7,'#ffceb8');if(p==='reaper'){line(x+48,y-55,x+48,y+40,'#a8b9b4',6);line(x+48,y-55,x+4,y-75,'#c8d9d8',7);}}
 else if(p==='laser'){rect(x-35,y-36,70,63,'#9d9d80');rect(x-23,y-52,46,20,color);ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(player.y-y,player.x-x));rect(0,-10,70,20,'#c5c8aa');ctx.restore();ellipse(x,y,13,13,'#f0dcc0');}
 else{const c=p==='miner'?'#c5b08b':color;rect(x-39,y-32,78,61,c);rect(x-60,y-19,21,44,c);rect(x+39,y-19,21,44,c);rect(x-32,y+21,23,22,c);rect(x+11,y+21,23,22,c);rect(x-25,y-60,50,37,c);rect(x-30,y-50,60,10,c);rect(x-17,y-43,10,6,'#e7ffcf');rect(x+9,y-43,10,6,'#e7ffcf');rect(x-10,y-24,25,5,'#294c4566');rect(x-10,y-7,20,19,'#d3ffe2');if(p==='miner'){rect(x-34,y-60,68,8,'#dfca89');rect(x-22,y-80,44,22,'#c0aa70');line(x+53,y-46,x+53,y+44,'#96774e',8);line(x+26,y-55,x+78,y-38,'#c8c7e7',10);}}
}
function draw(){
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.save();ctx.translate(shake?Math.sin(clock*90)*shake:0,0);ctx.scale(zoom,zoom);ctx.translate(-cam.x,-cam.y);terrain();drawGate();
 for(const z of warningZones){ctx.globalAlpha=z.t>0?.2+.25*(1-z.t/z.delay):.7;const color=z.t>0?'#f8b89a':'#ffe5bf';if(z.shape==='rect')rect(z.x,z.y,z.w,z.h,color);else if(z.shape==='line')line(z.x-Math.cos(z.angle)*z.len,z.y-Math.sin(z.angle)*z.len,z.x+Math.cos(z.angle)*z.len,z.y+Math.sin(z.angle)*z.len,color,z.r*2);else if(z.outside){ctx.fillStyle=color;ctx.beginPath();ctx.rect(40,80,W-80,H-120);ctx.arc(z.x,z.y,z.r,0,Math.PI*2,true);ctx.fill('evenodd');}else ellipse(z.x,z.y,z.r,z.r,color);ctx.globalAlpha=1;}
 const entities=world.nodes.filter(n=>n.x>cam.x-80&&n.x<cam.x+width/zoom+80&&n.y>cam.y-90&&n.y<cam.y+height/zoom+90).map(n=>({y:n.y,draw:()=>['ore','stone','tree','life','snow'].includes(n.kind)?drawOre(n):drawSpecial(n)}));entities.push({y:player.y,draw:drawPlayer});if(world.boss)entities.push({y:world.boss.y,draw:drawBoss});entities.sort((a,b)=>a.y-b.y).forEach(e=>e.draw());
 for(const m of world.minions||[]){ellipse(m.x,m.y,12,13,'#90b582');rect(m.x-6,m.y-4,4,4,'#eaffd7');rect(m.x+3,m.y-4,4,4,'#eaffd7');}
 if(world.chaser){const c=world.chaser;polygon([[c.x-20,c.y+20],[c.x-15,c.y-20],[c.x,c.y-30],[c.x+17,c.y-15],[c.x+24,c.y+20]],'#b8a0d8');rect(c.x-10,c.y-13,6,5,'#f7c1d7');rect(c.x+5,c.y-13,6,5,'#f7c1d7');}
 if(world.ultMode==='bighand'&&world.ultTime>0&&world.handOrigin){drawPlayerAt(world.handOrigin.x-25,world.handOrigin.y-10,'bighand',.45);}
 if(world.drill){const d=world.drill;ctx.save();ctx.translate(d.x,d.y);ctx.rotate(Math.atan2(d.vy,d.vx));polygon([[35,0],[-25,-20],[-25,20]],'#c8c4ee');ctx.restore();}
 if(!target&&path.length){const p=path[path.length-1];ctx.strokeStyle='#d2e6c477';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p.x,p.y,10,6,0,0,Math.PI*2);ctx.stroke();}
 for(const b of bullets){ellipse(b.x,b.y,b.r+3,b.r+3,b.slow?'#a7dcff33':'#ffd29b33');rect(b.x-b.r/2,b.y-b.r/2,b.r,b.r,b.color||'#ffd39b');rect(b.x-2,b.y-2,4,4,'#fff2d5');}
 for(const l of lineEffects){ctx.globalAlpha=l.life*4;line(l.x,l.y,l.x2,l.y2,'#d4f4dc',3);}ctx.globalAlpha=1;
 for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*3);rect(p.x,p.y,p.size,p.size,p.color);}ctx.globalAlpha=1;for(const r of ripples){ctx.globalAlpha=r.life;ctx.strokeStyle=r.color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(r.x,r.y,r.r,r.r*.65,0,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
 for(const f of floats){ctx.globalAlpha=Math.min(1,f.life*3);ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.strokeStyle='#15251e';ctx.lineWidth=3;ctx.strokeText(f.text,f.x,f.y-30);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y-30);}ctx.globalAlpha=1;ctx.restore();
 const dark=!state.items.lantern&&['abyss','hidden'].includes(C.MINES[world.biome].theme);const g=ctx.createRadialGradient(width/2,height/2,dark?60:Math.min(width,height)*.25,width/2,height/2,Math.max(width,height)*.7);g.addColorStop(0,'#07100c00');g.addColorStop(1,dark?'#07100cdd':'#07100c55');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);drawMini();
}
function drawMini(){mc.clearRect(0,0,116,90);const sx=116/W,sy=90/H;for(const n of world.nodes){mc.fillStyle=n.kind==='life'?'#fff3bd':['ore','stone','tree'].includes(n.kind)?C.ORES[n.id].color:'#f5dc9a';mc.fillRect(n.x*sx,n.y*sy,n.kind==='ore'?2:3,2);}for(const o of world.obstacles){mc.fillStyle='#96b8a344';mc.fillRect(o.x*sx,o.y*sy,o.w*sx,o.h*sy);}mc.strokeStyle='#96bca366';mc.lineWidth=.6;mc.strokeRect(cam.x*sx,cam.y*sy,width/zoom*sx,height/zoom*sy);mc.fillStyle='#dce2b1';mc.fillRect(world.gate.x*sx-2,world.gate.y*sy-2,4,4);if(world.boss){mc.fillStyle='#f5a486';mc.fillRect(world.boss.x*sx-3,world.boss.y*sy-3,6,6);}mc.fillStyle='#fff';mc.beginPath();mc.arc(player.x*sx,player.y*sy,2.5,0,Math.PI*2);mc.fill();}
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.imageSmoothingEnabled=false;zoom=width<360?.94:1.05;}
new ResizeObserver(resize).observe($('#viewport'));
let focusBefore=null,pendingImport=null,pendingCipher=null,puzzleInterval=null;
function showModal(tab,title,html,eyebrow='탐험가의 기록'){
 if($('#modal').classList.contains('hidden'))focusBefore=document.activeElement;modalTab=tab;paused=true;$('#modal-title').textContent=title;$('#modal-eyebrow').textContent=eyebrow;$('#modal-content').innerHTML=html;$('#modal').classList.remove('hidden');$('.sheet').scrollTop=0;$('#close-modal').focus();
}
function closeModal(){if(modalTab==='welcome')state.tutorial=true;if(puzzleInterval){clearInterval(puzzleInterval);puzzleInterval=null;}modalTab=null;paused=false;target=null;$('#modal').classList.add('hidden');focusBefore?.focus();save();}
function tabs(active,items){return'<div class="sheet-tabs">'+items.map(([id,name])=>'<button class="'+(active===id?'active':'')+'" data-action="route" data-id="'+id+'">'+name+'</button>').join('')+'</div>';}
const exploreTabs=[['map','광산'],['trials','시련'],['daily','일일 광산'],['temples','사원']];
const shopTabs=[['shop','도구'],['skillsShop','스킬'],['suits','옷장'],['books','촉매'],['forge','차원 장비']];
const curLabel=k=>({gold:'G',souls:'◆',catalysts:'촉매',engraving:'각인'})[k];
function walletStrip(){return'<div class="resource-strip"><span>◆ '+C.format(state.souls)+'</span><span>촉매 '+state.catalysts+'</span><span>각인 '+state.engraving+'</span><span>파편 '+state.shards+'</span></div>';}
function mapModal(){
 showModal('map','광산 원정 지도',tabs('map',exploreTabs)+'<p class="intro">자유 광산 5층 · 심연 6층 · 일반 광산 10층. 광산 변경 시 B1에서 시작해. 입장권은 골드로, 상위 광산은 봉인석 채굴로 해금해.</p>'+C.MINES.map((m,i)=>{
  const open=C.canEnter(state,i).ok,req=C.sealRequirement(state,i),seal=m.access==='seal'&&!state.unlocked[i]||m.access==='dimension'&&state.dimensionSeals<7;const label=seal?'봉인 도전':open?'입장':'조건 확인';
  return'<article class="mine-card" style="--mine:'+m.color+'"><div class="mine-rank">'+String(i+1).padStart(2,'0')+'</div><div class="mine-detail"><span class="chip">'+(m.id===15?'무한층':m.floors+'개 층')+' · '+(seal?'봉인됨':open?'탐험 가능':'잠겨 있음')+'</span><h2>'+m.name+'</h2><p>'+m.ores.slice(0,4).map(id=>C.ORES[id].name).join(' · ')+'</p><small>'+(seal?(m.id===16?'각인 후 일곱 봉인 · '+state.dimensionSeals+'/7':'봉인 요구 '+C.format(req)):m.fee&&!state.items.identity?'입장 '+C.format(m.fee)+' G · 입장권 '+state.tickets[i]+'장':m.access==='infinite'?'무한의 열쇠 '+state.infiniteKeys+'개':open?'해금 완료':C.canEnter(state,i).reason)+'</small><div class="mine-actions"><button data-action="mine" data-id="'+i+'">'+label+'</button>'+(m.fee?'<button class="ghost-button" data-action="ticket" data-id="'+i+'">입장권 구입</button>':'')+'</div></div></article>';
 }).join(''),'20개 탐험 지역');
}
function trialModal(){showModal('trials','성장만으로 넘을 수 없는 길',tabs('trials',exploreTabs)+'<p class="intro">제한시간과 전투 규칙이 다른 시련 7종. 하드 전투 시련에서는 능력치 상한을 적용하고 스킬·코스튬을 잠시 봉인해. 원래 성장은 입장 전 상태로 유지돼.</p>'+C.TRIALS.map(t=>'<article class="card"><span class="chip">'+(t.hard?'HARD':'NORMAL')+' · '+t.floors+'층</span><h2>'+t.name+'</h2><p>'+(t.type==='speed'?'암흑물질을 캐서 출구를 열어. '+(t.hard?'격자 벽 사이의 길을 찾아 이동하는 미로야.':'광물 채굴 순서를 골라 빠르게 이동해.'):t.type==='tech'?'탄막을 피하면서 층마다 20회 채굴.':'층마다 다른 보스와 전투. 생명석을 파괴하고 다음 층으로.')+' '+(t.time?t.time+'초':t.cap?'합계 상한 '+C.format(t.cap):'시간 제한 없음')+'</p><div class="row"><small>보유 징표 '+(state.trialMarks[t.id]||0)+'/5</small><button data-action="trial" data-id="'+t.id+'">도전하기</button></div></article>').join(''),'시련의 문');}
function dailyModal(){C.refreshDay(state);const index=C.dailyIndex();showModal('daily','오늘만의 새로운 발견',tabs('daily',exploreTabs)+walletStrip()+'<article class="daily-hero"><span>'+C.dayKey()+' · 매일 자정(한국시간) 갱신</span><h2>'+C.DAILY[index]+'</h2><p>오늘의 도전을 완료하면 촉매 5개와 영혼 결정 30개를 받아. 반복 도전은 가능하고 완료 보상은 하루 한 번이야.</p><button class="primary" data-action="daily">'+(state.daily.completed?'오늘 광산 다시 탐험':'오늘의 광산 입장')+'</button></article><article class="card row"><div><h2>매일 탐험 보급</h2><p>촉매 3개 · 영혼 결정 10개</p></div><button data-action="daily-claim" '+(state.daily.claimed?'disabled':'')+'>'+(state.daily.claimed?'수령 완료':'받기')+'</button></article><p class="intro">광고나 결제를 요구하지 않아. 촉매는 일일 보급, 일일 도전, 보스 처치로 획득해.</p><h3>일일 광산 순환</h3><div class="tag-list">'+C.DAILY.map((n,i)=>'<span class="'+(i===index?'active':'')+'">'+n+'</span>').join('')+'</div>','일일 원정');}
function templeModal(){showModal('temples','기억이 힘으로 바뀌는 곳',tabs('temples',exploreTabs)+'<article class="card"><h2>환생의 사원</h2><p>기본 능력치를 초기화하고 영혼 결정을 얻어 영구 성장을 이어가.</p><button data-action="route" data-id="rebirth">환생 확인</button></article><article class="card"><h2>각인의 사원</h2><p>심연까지의 광물을 모두 발견하고 죽음의 꽃을 전부 채굴하면 사원이 열려. 다섯 블록의 마법진을 복구하고 사신을 피해 돌아오면 각인할 수 있어.</p><small>사원 '+(state.temple.unlocked?'발견 완료':'미발견')+' · 의식 '+(state.temple.completed?'완료':'미완료')+'</small><button class="primary" data-action="temple" '+(!state.temple.unlocked?'disabled':'')+'>각인의 사원 입장</button><button class="secondary" data-action="route" data-id="engrave">각인 효과와 초기화 확인</button></article><article class="card"><h2>천상의 세 문</h2><p>돌 3억 회 · 비밀 열쇠 7개 · 시간 수확자 50회 처치. 천상의 광산 B10에서 무한의 열쇠를 얻을 수 있어.</p><button data-action="route" data-id="sky">문 조건 확인</button></article><article class="card"><h2>차원과 전자의 비밀</h2><p>첫 각인 후 차원의 광산에서 일곱 봉인석에 도전할 수 있어. 전자 광산 B10의 포탈은 다른 광산을 연결하는 암호를 알려줘.</p><small>차원 봉인 '+state.dimensionSeals+'/7 · 포탈 암호 '+state.secret.step+'/5</small></article>','사원');}
function bookModal(){
 const bonus=C.bookBonus(state),known=state.seen.slice(0,66).filter(n=>n>0).length;showModal('book','광물 도감',tabs('book',[['book','광물'],['marks','징표'],['records','기록']])+'<p class="intro">기본 광물 '+known+' / 66종 · 도감 보너스 +'+C.format(bonus)+'<br>등록 등급: 동 → 은 → 금 → 플래티넘 → 다이아. 채굴 1 / 6 / 18 / 54 / 108 / 174회에 보너스가 늘고, 최종 등급은 가치가 2배가 돼.</p><div class="book-grid">'+C.ORES.map(o=>{
 const seen=state.seen[o.id],t=C.tier(seen);return'<div class="ore-card '+(!seen?'unknown':'')+'"><span class="gem shape-'+o.shape+'" style="--gem:'+(seen?o.color:'#708681')+'"></span><b>'+(seen?o.name:'미발견')+'</b><small>'+(seen?C.format(o.value*C.multiplier(state,o.id))+' G · 잔량 '+C.format(o.qty):o.legacy?'이전 탐험의 기억':'광산에서 발견해 봐')+'</small><div class="tier-dots">'+Array.from({length:6},(_,i)=>'<i class="'+(t>i?'on':'')+'"></i>').join('')+'</div><small>'+(seen?C.format(seen)+'회 채굴':'???')+'</small></div>';
 }).join('')+'</div>','발견과 수집');
}
function marksModal(){showModal('marks','탐험을 기억하는 징표',tabs('marks',[['book','광물'],['marks','징표'],['records','기록']])+'<p class="intro">영구 보너스는 환생해도 유지돼. 현재 능력치별 보너스 +'+C.format(C.bonus(state))+' · 도감 총 보너스 +'+C.format(C.bookBonus(state))+'</p>'+C.MARKS.map((name,i)=>'<article class="card row"><div><h2>'+name+'의 징표</h2><p>각 능력치 +'+(i+1)+' / 개 · '+C.MINES[i].name+'에서 획득</p></div><b>'+state.marks[i]+' / 5</b></article>').join('')+C.TRIALS.map(t=>'<article class="card row"><div><h2>'+t.name+'의 징표</h2><p>'+(['powerHard','power2Hard'].includes(t.id)?'능력치 보너스와 보스전 보정':'영구 능력치 보너스')+'</p></div><b>'+(state.trialMarks[t.id]||0)+' / 5</b></article>').join('')+'<article class="card"><h2>각인의 징표 '+state.engraving+'개</h2><p>능력치 보너스 · 봉인석 완화 · 첫 각인 이후 총 능력치 +10%</p></article><article class="card"><h2>압축의 징표 '+state.compression+'개</h2><p>만렙 이후 능력치를 소모하여 영구 이중 채굴 확률을 올려.</p><button data-action="compression-check" '+(C.baseTotal(state)<6e9?'disabled':'')+'>만렙 압축</button></article>');}
function recordsModal(){showModal('records','발자국은 사라지지 않아',tabs('records',[['book','광물'],['marks','징표'],['records','기록']])+'<div class="stat-grid">'+[['누적 채굴',C.format(state.stats.mined)+'회'],['누적 수익',C.format(state.earned)+' G'],['수호자 처치',state.stats.bosses+'회'],['환생',state.stats.rebirths+'회'],['각인',state.engraveCount+'회'],['열쇠',state.items.keys+'개'],['퍼즐 해결',state.stats.puzzles+'회'],['비망록',state.notes.length+'/10']].map(([k,v])=>'<div>'+k+'<b>'+v+'</b></div>').join('')+'</div><h3>보스 도감</h3>'+C.BOSSES.map(b=>'<article class="card row"><div><h2>'+b.name+'</h2><small>'+(({charge:'돌진 예고를 보고 옆으로 피해.',laser:'레이저 예고선을 벗어나.',homing:'생명석 뒤에서 유도탄을 막아.',meteor:'운석 경고 원 밖으로 이동해.',quarters:'빛나는 구역에서 빠져나와.',halves:'다음 공격 방향을 확인해.'})[b.pattern]||'탄막을 피해 생명석을 채굴해.')+'</small></div><b>'+state.bossKills[b.id]+'회</b></article>').join(''));}
function shopModal(section='shop'){
 const ids=section==='skillsShop'?['rush','giant','lucky','bomb','shadow','dream','map']:['shoes','lantern','boots','wings','sage','midas','limit','rubble','radar','compass','identity','spirit','vault','coat'];
 showModal(section,section==='skillsShop'?'광산의 규칙을 바꾸는 기술':'다음 원정을 위한 준비',tabs(section,shopTabs)+walletStrip()+'<p class="intro">골드 도구는 환생 시 초기화돼. 특별 신분증을 갖고 있으면 보존돼. 영혼 도구와 스킬은 환생 후에도 유지돼.</p>'+C.ITEMS.filter(i=>ids.includes(i.id)).map(i=>'<article class="card item-row"><span class="item-icon">'+(({limit:'✦',midas:'✋',map:'⌘',compass:'➤',radar:'◎',lantern:'◈',wings:'➶',shadow:'♟',dream:'✧'})[i.id]||'◇')+'</span><div><h2>'+i.name+(state.items[i.id]?' <small>Lv.'+state.items[i.id]+'</small>':'')+'</h2><p>'+i.desc+'</p>'+(i.id==='coat'?'<small>추가 보너스 100레벨마다 한 번 구매</small>':'')+'</div><button data-action="item" data-id="'+i.id+'" '+(i.max&&state.items[i.id]>=i.max||state[i.currency]<C.itemCost(state,i.id)?'disabled':'')+'>'+(i.max&&state.items[i.id]>=i.max?'보유 중':C.format(C.itemCost(state,i.id))+' '+curLabel(i.currency))+'</button></article>').join('')+(section==='shop'?'<h3>이전 원정의 영구 강화</h3>'+C.RELICS.map(r=>'<article class="card row"><div><h2>'+r.name+' <small>Lv.'+state.relics[r.id]+'</small></h2><p>'+r.desc+'</p></div><button data-action="relic" data-id="'+r.id+'" '+(state.souls<C.relicCost(state,r.id)||state.relics[r.id]>=100?'disabled':'')+'>'+C.format(C.relicCost(state,r.id))+' ◆</button></article>').join(''):''),'탐험가 상점');
}
function suitModal(){showModal('suits','같은 광산, 다른 플레이',tabs('suits',shopTabs)+walletStrip()+'<p class="intro">모든 코스튬은 채굴 방식과 리미트 해제 효과가 달라. 기간 한정 코스튬도 보유하고 나면 언제든 착용할 수 있어.</p>'+C.SUITS.map(s=>{
 const own=state.owned.includes(s.id),available=C.suitAvailable(s.id),wear=state.suit===s.id;return'<article class="card item-row"><span class="suit-avatar" style="--coat:'+s.color+'"><i></i></span><div><h2>'+s.name+'</h2><p>'+s.desc+'</p></div><button data-action="suit" data-id="'+s.id+'" '+(wear||!own&&(!available||state[s.currency]<s.cost)?'disabled':'')+'>'+(wear?'착용 중':own?'착용':!available?'시즌 한정':s.cost+' '+curLabel(s.currency))+'</button></article>';
 }).join(''),'코스튬 17종');}
function booksModal(){showModal('books','촘촘하게 준비하는 긴 탐험',tabs('books',shopTabs)+walletStrip()+'<p class="intro">촉매는 일일 보급·도전과 보스 처치로 모아. 레벨 부스트는 중복 사용 시 시간이 연장되고, 환생 부스트는 한 번에 최대 20권을 사용해.</p>'+C.ITEMS.filter(i=>i.currency==='catalysts').map(i=>'<article class="card"><div class="row"><div><h2>'+i.name+'</h2><p>'+i.desc+'</p><small>보유 '+state.items[i.id]+'개</small></div><button data-action="item" data-id="'+i.id+'" '+(state.catalysts<i.cost||i.max&&state.items[i.id]>=i.max?'disabled':'')+'>'+i.cost+' 촉매</button></div>'+(i.id==='boostBook'?'<button class="secondary" data-action="boost" '+(!state.items.boostBook?'disabled':'')+'>1권 사용 · 남은 시간 '+Math.max(0,Math.ceil((state.boostUntil-Date.now())/60000))+'분</button>':'')+'</article>').join('')+'<label class="setting">보스전 부활의 책 사용<input type="checkbox" id="revive-enabled" '+(state.reviveEnabled?'checked':'')+'></label><label class="setting">환생 시 사용할 책<select id="rebirth-use">'+[0,1,5,10,20].map(n=>'<option value="'+n+'" '+(state.rebirthUse===n?'selected':'')+'>'+n+'권</option>').join('')+'</select></label>','촉매와 책');}
function optionLabel(o){const def=C.OPTIONS.find(v=>v.id===o.id);return(o.id==='value'?C.ORES[o.ore].name+' 가치':def.name)+' +'+(['flat','midas','midasLevel'].includes(o.id)?C.format(o.value):Math.round(o.value*100)+'%');}
function forgeModal(){showModal('forge','다른 세계에서 온 도구',tabs('forge',shopTabs)+walletStrip()+'<article class="card"><h2>차원의 곡괭이</h2><p>'+(state.pickaxe.repaired?'파편으로 효과를 재부여해 원하는 조합을 만들 수 있어.':state.pickaxe.found?'부서진 곡괭이를 발견했어. 차원 파편 50개로 수리할 수 있어.':'차원의 광산 B10에 부서진 곡괭이가 잠들어 있어.')+'</p>'+(!state.pickaxe.repaired?'<button data-action="repair" '+(!state.pickaxe.found||state.shards<50?'disabled':'')+'>수리 · 파편 50</button>':'<div class="option-list">'+state.pickaxe.options.map((o,i)=>'<div><span>'+optionLabel(o)+'</span>'+(state.items.helmet?'<button data-action="lock-option" data-id="'+i+'">'+(state.pickaxe.locked===i?'고정 해제':'고정')+'</button>':'')+'</div>').join('')+'</div><button class="primary" data-action="reroll" '+(state.shards<(state.pickaxe.locked>=0?10:5)?'disabled':'')+'>효과 재부여 · 파편 '+(state.pickaxe.locked>=0?10:5)+'</button>')+'</article>'+C.ITEMS.filter(i=>i.currency==='engraving').map(i=>'<article class="card row"><div><h2>'+i.name+' <small>Lv.'+state.items[i.id]+'</small></h2><p>'+i.desc+'</p></div><button data-action="item" data-id="'+i.id+'" '+(state.engraving<C.itemCost(state,i.id)||i.max&&state.items[i.id]>=i.max?'disabled':'')+'>'+C.itemCost(state,i.id)+' 각인</button></article>').join('')+(state.items.record?'<article class="card"><h2>차원의 기록</h2><p>'+(state.pickaxe.saved.length?state.pickaxe.saved.map(optionLabel).join('<br>'):'보관된 효과가 없어. 교환하면 현재 효과가 저장돼.')+'</p><button data-action="record-swap" '+(state.shards<5?'disabled':'')+'>현재 효과와 교환 · 파편 5</button></article>':''),'차원 공방');}
function achievementModal(){showModal('achievements','작은 발견, 커다란 기록','<p class="intro">완료한 업적 '+state.claimed.length+' / '+C.ACHIEVEMENTS.length+'개. 달성 후 보상 버튼을 눌러 영혼 결정을 받아 줘.</p>'+C.ACHIEVEMENTS.map(a=>{const p=C.progress(state,a),done=state.claimed.includes(a.id);return'<article class="card"><div class="row"><div><h2>'+a.name+'</h2><small>'+a.desc+'</small></div><button data-action="claim" data-id="'+a.id+'" '+(done||p<a.goal?'disabled':'')+'>'+(done?'수령 완료':a.reward+' ◆ 받기')+'</button></div><div class="progress"><i style="width:'+Math.min(100,p/a.goal*100)+'%"></i></div><small>'+C.format(Math.min(p,a.goal))+' / '+C.format(a.goal)+'</small></article>';}).join(''),'업적 '+state.claimed.length+'/'+C.ACHIEVEMENTS.length);}
function rebirthModal(){const ready=C.canRebirth(state);showModal('rebirth','더 강하게, 다시 시작','<span class="hero-gem"></span><p class="intro">기본 능력치 합계 90부터 환생할 수 있어. 각인 후에는 추가 보너스에 따른 성장 조건도 필요해. 원정 수익·능력치·보스 처치에 따라 영혼 결정을 얻어.</p><div class="stat-grid"><div>이번 탐험 수익<b>'+C.format(state.runEarned)+' G</b></div><div>예상 환생 보상<b>'+C.format(C.rebirthReward(state))+' ◆</b></div><div>기본 능력치 합계<b>'+C.format(C.baseTotal(state))+'</b></div><div>추가 능력치 합계<b>'+C.format(C.bonus(state)*3)+'</b></div></div><article class="card"><h2>환생 시 변경</h2><p>골드와 기본 능력치가 초기화돼. 특별 신분증이 없으면 골드 도구도 초기화돼.<br>영혼 도구, 코스튬, 영구 강화, 광산 해금, 도감, 업적, 징표는 유지돼.</p></article><button class="primary" data-action="rebirth-check" '+(!ready?'disabled':'')+'>'+(ready?'환생 준비 · '+C.format(C.rebirthReward(state))+' ◆':'환생에 필요한 기본 성장을 더 쌓아 줘')+'</button><button class="secondary" data-action="route" data-id="temples">각인과 사원 확인</button>','환생 '+state.stats.rebirths+'회');}
function engraveModal(){showModal('engrave','기억을 새기고 차원 너머로','<span class="hero-gem purple"></span><p class="intro">각인의 사원에서 다섯 블록의 의식을 마치고 사신을 피해 돌아와야 각인할 수 있어. 첫 각인 이후 총 능력치 +10%와 차원의 광산 봉인 도전이 열려.</p><article class="card"><h2>초기화되는 항목</h2><p>골드, 영혼 결정, 기본 능력치, 골드·영혼으로 구매한 도구, 스킬, 코스튬, 이전 영구 강화.</p><h2>유지되는 항목</h2><p>도감·업적·징표·광산 해금, 촉매와 책, 각인 재화·각인 상점 도구, 차원의 곡괭이.</p></article><p class="intro">구매한 영혼 도구 수에 비례해 각인 결정을 얻어. 현재 의식 '+(state.temple.completed?'완료':'미완료')+' · 각인 '+state.engraveCount+'회</p><button class="primary" data-action="engrave-check" '+(!C.canEngrave(state)?'disabled':'')+'>각인 준비</button><button class="secondary" data-action="route" data-id="temples">사원으로 돌아가기</button>','각인의 의식');}
function skyModal(){const conditions=C.skyDoors(state),timeKills=state.bossKills[C.BOSSES.findIndex(b=>b.name==='시간 수확자')];showModal('sky','천상의 세 문','<p class="intro">천상의 광산 B10에서 세 조건을 만족하면 무한의 열쇠를 얻어. 첫 번째와 세 번째는 누적 기록이고, 비밀 열쇠 7개는 소모돼.</p>'+[['끈기의 문',C.format(state.stats.stone)+' / 3억 · 돌 채굴'],['발견의 문',state.items.keys+' / 7 · 비밀 열쇠'],['승리의 문',timeKills+' / 50 · 시간 수확자']].map(([n,d],i)=>'<article class="card row"><div><h2>'+n+'</h2><p>'+d+'</p></div><b>'+(conditions[i]?'열림':'잠김')+'</b></article>').join('')+'<button class="primary" data-action="sky-open" '+(!conditions.every(Boolean)||world.biome!==12||world.floor!==10?'disabled':'')+'>무한의 열쇠 획득</button>');}
function settingsModal(){showModal('settings','탐험 설정','<p class="intro">마인월드 v2.0 · 오프라인 원정 확장<br>앱 삭제 전 저장 코드를 따로 보관해 줘.</p>'+[['sound','효과음'],['music','배경 음악'],['vibration','진동'],['reduced','화면 흔들림·입자 줄이기'],['balance','균등 강화 · 가장 낮은 능력치 우선'],['autoNext','목표 달성 후 계단 자동 이동']].map(([id,label])=>'<label class="setting">'+label+'<input type="checkbox" data-setting="'+id+'" '+(state.settings[id]?'checked':'')+'></label>').join('')+'<div class="stat-grid"><div>채굴 속도<b>'+C.format(1/C.interval(combat()))+'/초</b></div><div>채굴 위력<b>'+C.format(C.damage(combat()))+'</b></div></div><h3>저장 코드 백업 / 복원</h3><p class="intro">v1 저장도 불러올 수 있어. 복원 시 현재 진행이 교체되므로 확인 후 적용해.</p><textarea id="save-code" aria-label="저장 코드" placeholder="내보내기 또는 저장 코드 붙여넣기" spellcheck="false"></textarea><div class="row"><button class="secondary" data-action="export">내보내기</button><button class="secondary" data-action="import-check">코드 복원</button></div><button class="secondary" data-action="backup-check">이전 자동 저장 복구</button><div id="save-status" role="status"></div><button class="secondary" data-action="help">조작과 성장 도움말</button>','게임 및 저장');}
function helpModal(welcome=false){showModal(welcome?'welcome':'help',welcome?'산너머, 더 깊은 세계로':'탐험가 안내서','<span class="hero-gem"></span><p class="intro">필드에서 보석을 찾고, 광산마다 숨겨진 장치를 풀고, 성장과 환생을 반복하는 광산 RPG야.</p><ol class="feature-list"><li>바닥을 누르면 이동하고, 광물은 한 번 누르면 자동 채굴해.</li><li>광물마다 가격·강도·잔량이 달라. 소진된 광맥은 돌이 돼.</li><li>속도·힘·솜씨를 올리고 MAX·균등 강화를 활용해.</li><li>일반층에서 12회 채굴 후 계단으로 이동해.</li><li>보스층에서 탄막을 피하며 생명석을 캐.</li><li>광산 메뉴에서 시련·일일 광산·사원을 찾아봐.</li><li>기본 합계 Lv.90 환생 · 심연 도감 완성과 사원 의식 후 각인.</li></ol>'+ (startingOffline&&welcome?'<article class="card"><h2>오프라인 보상</h2><p>'+C.format(startingOffline)+' G 지급 완료</p></article>':'')+'<button class="primary" data-action="close">'+(welcome?'원정 시작하기':'이제 알겠어')+'</button>','MINEWORLD · 2.0');}
function confirmModal(title,desc,action,label){showModal('confirm',title,'<p class="intro">'+desc+'</p><button class="primary" data-action="'+action+'">'+label+'</button><button class="secondary" data-action="close">취소하고 돌아가기</button>','한 번 더 확인');}
function puzzleModal(temple=false){
 if(!world.puzzle||world.puzzle.temple!==temple){world.puzzle={temple,player:{x:3,y:5},boxes:Array.from({length:temple?5:3},(_,i)=>({x:i+1,y:3})),goals:Array.from({length:temple?5:3},(_,i)=>({x:i+1,y:1})),start:Date.now(),history:[]};}
 renderPuzzle();if(puzzleInterval)clearInterval(puzzleInterval);puzzleInterval=setInterval(()=>{if(modalTab!=='puzzle'){clearInterval(puzzleInterval);puzzleInterval=null;return;}const p=world.puzzle,left=Math.max(0,Math.ceil((180000-(Date.now()-p.start))/1000));const timer=$('#puzzle-timer');if(timer)timer.textContent=left+'초';if(!left){clearInterval(puzzleInterval);puzzleInterval=null;world.puzzle=null;showModal('puzzle-failed','마법진이 빛을 잃었어','<p class="intro">제한시간이 지났어. 블록을 밀기 전에 위쪽 목표와 이동 경로를 살펴봐.</p><button class="primary" data-action="puzzle-retry" data-id="'+(p.temple?1:0)+'">다시 도전</button>');}},500);
}
function renderPuzzle(){const p=world.puzzle;if(!p)return;let grid='';for(let y=0;y<7;y++)for(let x=0;x<7;x++){const wall=x===0||x===6||y===0||y===6,box=p.boxes.some(b=>b.x===x&&b.y===y),goal=p.goals.some(g=>g.x===x&&g.y===y),person=p.player.x===x&&p.player.y===y;grid+='<button class="puzzle-cell '+(wall?'wall':'')+' '+(goal?'goal':'')+' '+(box?'box':'')+' '+(person?'person':'')+'" data-action="puzzle-cell" data-x="'+x+'" data-y="'+y+'" aria-label="퍼즐 '+x+','+y+'">'+(wall?'':person?'●':box?'▣':goal?'◇':'')+'</button>';}
 showModal('puzzle',p.temple?'다섯 블록의 마법진':'길을 여는 밀어내기 퍼즐','<p class="intro">블록을 위쪽 ◇ 목표에 전부 올려놔. 인접한 칸을 누르거나 방향 버튼으로 움직여. 블록은 밀 수 있지만 당길 수 없어.</p><div class="row"><span class="chip">'+p.boxes.filter(b=>p.goals.some(g=>g.x===b.x&&g.y===b.y)).length+' / '+p.boxes.length+' 완료</span><b id="puzzle-timer">'+Math.max(0,Math.ceil((180000-(Date.now()-p.start))/1000))+'초</b></div><div class="puzzle-grid">'+grid+'</div><div class="dpad"><button data-action="puzzle-move" data-id="up" aria-label="퍼즐 위">↑</button><div><button data-action="puzzle-move" data-id="left" aria-label="퍼즐 왼쪽">←</button><button data-action="puzzle-undo">되돌리기</button><button data-action="puzzle-move" data-id="right" aria-label="퍼즐 오른쪽">→</button></div><button data-action="puzzle-move" data-id="down" aria-label="퍼즐 아래">↓</button></div>','마법진 복구');
}
function puzzleMove(dx,dy){const p=world.puzzle;if(!p||Date.now()-p.start>180000)return;const x=p.player.x+dx,y=p.player.y+dy;if(x<1||y<1||x>5||y>5)return;const b=p.boxes.find(b=>b.x===x&&b.y===y);if(b&&(x+dx<1||y+dy<1||x+dx>5||y+dy>5||p.boxes.some(q=>q.x===x+dx&&q.y===y+dy)))return;p.history.push({player:{...p.player},boxes:p.boxes.map(b=>({...b}))});if(p.history.length>100)p.history.shift();p.player={x,y};if(b){b.x+=dx;b.y+=dy;}sound();
 if(p.boxes.every(b=>p.goals.some(g=>g.x===b.x&&g.y===b.y))){const temple=p.temple;state.stats.puzzles++;world.puzzle=null;closeModal();if(temple){generate(0,1,null,'temple',{templeStage:'escape'});toast('마법진 복구! 사신을 피해 아래쪽 출구로 돌아가.');}else{world.nodes=world.nodes.filter(n=>n.kind!=='puzzle');world.nodes.push(node(17,player.x+80,player.y+10));toast('퍼즐 완성 · 암흑물질이 나타났어!');}save();}else{renderPuzzle();save();}}
function cipherModal(n){pendingCipher=n;const value=(world.floor*3+5)%16,choices=[value,(value+3)%16,(value+7)%16].sort(()=>Math.random()-.5);showModal('cipher','0과 1 사이의 암호','<p class="intro">벽에 새겨진 네 자리 이진수를 십진수로 바꿔 줘.<br>왼쪽부터 8 · 4 · 2 · 1의 값을 더하면 돼.</p><div class="binary-code">'+value.toString(2).padStart(4,'0')+'</div><div class="choice-row">'+choices.map(v=>'<button data-action="cipher-answer" data-id="'+v+'">'+v+'</button>').join('')+'</div>','전자 광산 수수께끼');}
function inventoryModal(){showModal('inventory','지금 필요한 한 가지',walletStrip()+'<div class="stat-grid"><div>비밀 열쇠<b>'+state.items.keys+'개</b></div><div>속도의 시련 출입증<b>'+state.items.trialPass+'장</b></div><div>부활의 책<b>'+state.items.reviveBook+'권</b></div><div>레벨 부스트 책<b>'+state.items.boostBook+'권</b></div></div><button class="primary" data-action="boost" '+(!state.items.boostBook?'disabled':'')+'>레벨 부스트 책 1권 사용</button><button class="secondary" data-action="route" data-id="books">책 구입·부활 설정</button><button class="secondary" data-action="route" data-id="suits">옷장 열기</button><button class="secondary" data-action="route" data-id="forge">차원의 곡괭이 확인</button>'+(world.mode==='daily'&&world.dayIndex===3?'<h3>오늘의 패션쇼 · 체험 코스튬</h3><p class="intro">각 코스튬으로 10회씩 채굴해. 오늘 원정 안에서만 체험할 수 있어.</p><div class="choice-row">'+['miner','drill','shield'].map(id=>'<button data-action="daily-suit" data-id="'+id+'">'+C.SUITS.find(s=>s.id===id).name+'<small>'+(world.styleCounts[id]||0)+'/10</small></button>').join('')+'</div>':''),'탐험 가방');}
const routes={map:mapModal,trials:trialModal,daily:dailyModal,temples:templeModal,book:bookModal,marks:marksModal,records:recordsModal,shop:()=>shopModal('shop'),skillsShop:()=>shopModal('skillsShop'),suits:suitModal,books:booksModal,forge:forgeModal,achievements:achievementModal,rebirth:rebirthModal,engrave:engraveModal,sky:skyModal,inventory:inventoryModal,settings:settingsModal};
$('#modal-content').addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action,id=b.dataset.id;
 if(a==='close'){closeModal();return;}
 if(a==='route'){routes[id]?.();return;}
 if(a==='mine'){
  const i=Number(id),m=C.MINES[i];if(!m)return;const seal=m.access==='seal'&&!state.unlocked[i]||m.access==='dimension'&&state.dimensionSeals<7;
  if(seal){if(m.id===16&&!state.engraveCount){toast('첫 각인을 마치면 차원의 일곱 봉인에 도전할 수 있어.');return;}generate(i,1,null,'seal');closeModal();toast('봉인석을 터치해 채굴해. 요구 레벨에 도달해야 부술 수 있어.');}
  else{const result=C.enter(state,i);if(!result.ok){toast(result.reason);return;}generate(i,result.floor||1,null,i===18?'snow':'mine');closeModal();toast(m.name+' · 원정 시작');}
 }else if(a==='ticket'){
  const i=Number(id),m=C.MINES[i];if(!m?.fee)return;const fee=Math.ceil(m.fee*(state.suit==='hammer'?.5:1));if(state.gold<fee||state.tickets[i]>=99){toast('골드가 부족하거나 입장권을 99장 보유 중이야.');return;}state.gold-=fee;state.tickets[i]++;save();mapModal();
 }else if(a==='trial'){
  const t=C.TRIALS.find(t=>t.id===id);if(!t)return;
  if(t.id==='speed'){if(state.items.trialPass>0)state.items.trialPass--;else if(state.gold>=1000)state.gold-=1000;else{toast('속도의 시련 출입증 또는 1,000 G가 필요해.');return;}}
  generate(t.type==='power2'?4:0,1,null,'trial',{trial:t.id,timeLeft:t.time*timerMultiplier()});closeModal();toast(t.name+' · 도전 시작');
 }else if(a==='daily'){
  const index=C.dailyIndex();if(index===2)generate(18,1,null,'snow',{dailySource:true});else generate(index===4?5:index===5?8:0,1,null,'daily',{dayIndex:index,day:C.dayKey(),timeLeft:120*timerMultiplier()});closeModal();toast('오늘의 도전 · '+C.DAILY[index]);
 }else if(a==='daily-claim'){if(C.claimDaily(state)){sound('upgrade');save();dailyModal();}}
 else if(a==='temple'){if(!state.temple.unlocked)return;generate(0,1,null,'temple');closeModal();toast('사원 중앙의 마법진을 조사해.');}
 else if(a==='item'){
  if(C.buyItem(state,id)){sound('upgrade');save();(routes[modalTab]||routes.shop)();}else toast(id==='coat'?'외투는 추가 능력치 100레벨당 한 번 구매할 수 있어.':id==='spirit'?'첫 환생 후에 구매할 수 있어.':id==='fragmentPack'?'차원의 곡괭이를 먼저 수리해 줘.':'재화나 구매 조건을 확인해 줘.');
 }else if(a==='relic'){if(C.buyRelic(state,id)){save();sound('upgrade');shopModal();}}
 else if(a==='suit'){const fraction=player.hp/maxHealth();if(C.suit(state,id)){player.hp=Math.max(1,fraction*maxHealth());save();suitModal();}}
 else if(a==='daily-suit'){if(world.mode==='daily'&&world.dayIndex===3&&['miner','drill','shield'].includes(id)){world.tempSuit=id;closeModal();toast('체험 코스튬 · '+C.SUITS.find(s=>s.id===id).name);}}
 else if(a==='boost'){if(C.useBook(state,'boostBook')){save();toast('5분 동안 능력치 +50%');(routes[modalTab]||routes.inventory)();}}
 else if(a==='claim'){if(C.claim(state,id)){save();sound('upgrade');achievementModal();}}
 else if(a==='rebirth-check')confirmModal('이번 원정을 마칠까?','골드와 기본 능력치가 초기화돼. 신분증이 없다면 골드 도구도 사라져. 영혼 결정 '+C.format(C.rebirthReward(state))+'개를 받아.','rebirth','환생하고 다시 출발');
 else if(a==='rebirth'){const n=C.rebirth(state);if(n){cooldowns={dash:0,slam:0,luck:0};luckTime=0;generate(0,1);closeModal();toast('환생 완료! 영혼 결정 +'+C.format(n));}}
 else if(a==='engrave-check')confirmModal('새로운 기억을 새길까?','골드·영혼 결정·기본 능력치와 골드/영혼으로 구매한 도구·코스튬·스킬·이전 영구 강화가 초기화돼. 각인 재화와 도감·징표는 유지돼.','engrave','각인 실행');
 else if(a==='engrave'){const n=C.engrave(state);if(n){generate(0,1);closeModal();toast('각인 완료 · 각인 결정 +'+n+' · 차원의 봉인이 열렸어.');}}
 else if(a==='sky-open'){if(world.biome===12&&world.floor===10&&C.openSky(state)){save();skyModal();toast('세 문이 열렸다 · 무한의 열쇠 +1');}}
 else if(a==='repair'){if(C.repairPick(state)){if(world.biome===16&&world.floor===10){world.boss=makeBoss('광부');world.cleared=false;addLife();}save();forgeModal();toast('차원의 곡괭이 수리 완료!');}}
 else if(a==='reroll'){if(C.reroll(state)){save();forgeModal();}}
 else if(a==='lock-option'){const i=Number(id);if(state.items.helmet&&Number.isInteger(i)&&i>=0&&i<state.pickaxe.options.length){state.pickaxe.locked=state.pickaxe.locked===i?-1:i;save();forgeModal();}}
 else if(a==='record-swap'){if(C.swapRecord(state)){save();forgeModal();}}
 else if(a==='compression-check')confirmModal('만렙을 압축할까?','현재 능력치의 '+Math.round(Math.min(.95,.5+state.compression*.1)*100)+'%를 소모하여 영구 이중 채굴 확률을 올려.','compression','능력치 압축');
 else if(a==='compression'){if(C.compress(state)){closeModal();toast('압축의 징표 +1');}}
 else if(a==='puzzle-move'){const moves={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};puzzleMove(...moves[id]);}
 else if(a==='puzzle-cell'){const p=world.puzzle;if(p){const dx=Number(b.dataset.x)-p.player.x,dy=Number(b.dataset.y)-p.player.y;if(Math.abs(dx)+Math.abs(dy)===1)puzzleMove(dx,dy);}}
 else if(a==='puzzle-undo'){const p=world.puzzle,old=p?.history.pop();if(old){p.player=old.player;p.boxes=old.boxes;renderPuzzle();}}
 else if(a==='puzzle-retry')puzzleModal(id==='1');
 else if(a==='cipher-answer'){if(!pendingCipher||!world.nodes.includes(pendingCipher))return;const answer=(world.floor*3+5)%16;if(Number(id)===answer){state.stats.puzzles++;state.items.keys++;removeNode(pendingCipher);pendingCipher=null;closeModal();toast('암호 해독 성공 · 비밀 열쇠 +1');}else toast('다시 계산해 봐. 각 자리의 값은 8, 4, 2, 1이야.');}
 else if(a==='export'){save();$('#save-code').value=JSON.stringify(state);$('#save-code').focus();$('#save-code').select();$('#save-status').textContent='코드를 길게 눌러 복사해서 따로 보관해 줘.';}
 else if(a==='import-check'||a==='backup-check'){
  try{const rawText=a==='backup-check'?localStorage.getItem(BACKUP):$('#save-code').value;if(!rawText||rawText.length>500000)throw new Error();const raw=JSON.parse(rawText);if(![1,2].includes(raw?.version)||!raw.levels||!Array.isArray(raw.seen))throw new Error();pendingImport=C.normalize(raw);confirmModal('이 기록으로 복원할까?','현재 진행이 교체돼. 기본 합계 Lv.'+C.format(C.baseTotal(pendingImport))+' · '+C.format(pendingImport.gold)+' G.','import','기록 복원');}catch(err){$('#save-status').textContent='올바른 마인월드 저장 코드를 확인해 줘.';}
 }else if(a==='import'){if(!pendingImport)return;state=pendingImport;pendingImport=null;cooldowns={dash:0,slam:0,luck:0};luckTime=0;const w=state.world;generate(w?.biome||0,w?.floor||1,w);closeModal();toast('저장 기록을 복원했어.');}
 else if(a==='help')helpModal();
 else if(a==='home'){if(world.mode==='trial')C.trialReward(state,world.trial,world.floor-1);generate(0,1);closeModal();toast('자유 광산으로 귀환했어. 체력도 회복했어.');}
 hud();
});
$('#modal-content').addEventListener('change',e=>{const key=e.target.dataset.setting;if(key&&Object.hasOwn(state.settings,key)){state.settings[key]=e.target.checked;save();}if(e.target.id==='revive-enabled'){state.reviveEnabled=e.target.checked;save();}if(e.target.id==='rebirth-use'){state.rebirthUse=Number(e.target.value);save();}});
$('#close-modal').onclick=closeModal;$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))closeModal();});$('#settings').onclick=settingsModal;$('#map-button').onclick=mapModal;$('#descend').onclick=descend;$('#ultimate').onclick=ultimate;$('#inventory').onclick=inventoryModal;
$('#home').onclick=()=>confirmModal('잠시 쉬어 갈까?','골드와 성장은 유지돼. 현재 원정을 떠나 자유 광산 B1으로 돌아가. 시련은 완료한 층까지의 징표를 받아.','home','자유 광산으로 귀환');
for(const b of $$('[data-tab]'))b.onclick=()=>{save();routes[b.dataset.tab]?.();};
let holdTimer=null,holdDelay=null,held=false;
for(const b of $$('[data-upgrade]')){
 const apply=()=>{const old=C.total(state),n=C.upgrade(state,b.dataset.upgrade);if(n){sound('upgrade');for(const lv of[15,30,60,90])if(old<lv&&C.total(state)>=lv)toast(lv===15?'돌진 해금!':lv===30?'광역 강타 해금!':lv===60?'행운 채굴 해금!':'환생에 도전할 수 있어!');save();hud();}else if(!held)toast('골드가 부족하거나 최대 레벨이야.');};
 b.onclick=()=>{if(!held)apply();};b.addEventListener('pointerdown',()=>{held=false;holdDelay=setTimeout(()=>{held=true;apply();holdTimer=setInterval(apply,120);},450);});
 const stop=()=>{clearTimeout(holdDelay);clearInterval(holdTimer);if(held)setTimeout(()=>held=false,100);};b.addEventListener('pointerup',stop);b.addEventListener('pointercancel',stop);b.addEventListener('pointerleave',stop);
}
$('#buy-mode').onclick=()=>{const modes=[1,10,100,1e12];state.settings.buy=modes[(modes.indexOf(state.settings.buy)+1)%modes.length];save();hud();};for(const id of['dash','slam','luck'])$('#'+id).onclick=()=>skill(id);
function suspend(){if(suspended)return;clearTimeout(holdDelay);clearInterval(holdTimer);save();suspended=true;audio?.suspend();}
function resume(){if(!suspended)return;suspended=false;previous=performance.now();const n=C.offline(state);if(n){C.credit(state,n);toast('쉬는 동안 +'+C.format(n)+' G');}save();hud();}
document.addEventListener('visibilitychange',()=>document.hidden?suspend():resume());window.addEventListener('pagehide',suspend);
window.addEventListener('keydown',e=>{if(modalTab==='puzzle'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();puzzleMove(...({ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]})[e.key]);return;}if(e.key==='Escape'){if(modalTab)closeModal();else settingsModal();}if(e.key==='Tab'&&modalTab){const f=$$('#modal button:not(:disabled),#modal input,#modal textarea,#modal select'),first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
window.MW={suspend,resume,back(){if(modalTab)closeModal();else settingsModal();},getView(){return{cam:{...cam},zoom,width,height};},getState(){return JSON.parse(JSON.stringify({...state,world:snapshot()}));}};
resize();const restored=state.world;generate(restored?.biome||0,restored?.floor||1,restored);if(!state.tutorial)helpModal(true);else if(startingOffline)toast('쉬는 동안 +'+C.format(startingOffline)+' G');
function frame(now){const dt=Math.min(.05,Math.max(0,(now-(previous||now))/1000));previous=now;update(dt);draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();
