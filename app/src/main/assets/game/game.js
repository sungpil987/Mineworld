(() => {
'use strict';
const C=MineCore,$=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const KEY='mineworld.save.v1', BACKUP=KEY+'.backup', W=1280,H=1040;
const canvas=$('#game'),ctx=canvas.getContext('2d'),mini=$('#minimap canvas'),mc=mini.getContext('2d');
let state,world,player={x:180,y:180,tx:180,ty:180,hp:100,invuln:0},target=null,cam={x:0,y:0};
let width=400,height=400,zoom=1.18,dpr=1,paused=false,suspended=false,modalTab=null,previous=0,saveTimer=0,hudTimer=0,clock=0;
let swing=0,attackClock=0,particles=[],floats=[],ripples=[],bullets=[],warningZones=[],cooldowns={dash:0,slam:0,luck:0},luckTime=0;
let shake=0,toastTimer=0,sessionValue=0,sessionSeconds=0,storageFailed=false,audio=null;
function readSave(){
  for(const key of [KEY,BACKUP])try{const raw=localStorage.getItem(key);if(!raw)continue;const parsed=JSON.parse(raw);if(!parsed||parsed.version!==1||!parsed.levels)continue;return C.normalize(parsed);}catch(e){}
  return C.fresh();
}
state=readSave();
const startingOffline=C.offline(state);if(startingOffline)C.credit(state,startingOffline);
function snapshot(){
  return {biome:world.biome,floor:world.floor,nodes:world.nodes.map(n=>({id:n.id,x:n.x,y:n.y,hp:n.hp,remaining:n.remaining,life:n.life||false})),mined:world.mined,cleared:world.cleared,bossHp:world.boss?.hp,player:{x:player.x,y:player.y,hp:player.hp}};
}
function save(){
  try{
    state.world=snapshot();state.lastSeen=Date.now();
    const value=JSON.stringify(state);const old=localStorage.getItem(KEY);
    if(old)try{const v=JSON.parse(old);if(v.version===1&&v.levels)localStorage.setItem(BACKUP,old);}catch(e){}
    localStorage.setItem(KEY,value);storageFailed=false;
  }catch(e){if(!storageFailed)toast('저장 공간을 확인해 줘. 설정에서 저장 코드를 복사할 수 있어.');storageFailed=true;}
}
function rand(a,b){return a+Math.random()*(b-a);}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function safeNumber(n,a,b,fallback){return Number.isFinite(n)?clamp(n,a,b):fallback;}
function maxHealth(){return state.suit==='warden'?150:100;}
function makeNode(id,x,y,life=false){const ore=C.ORES[id],max=life?45*Math.pow(C.MINES[world.biome].scale,.65):ore.hardness*(1+(world.floor-1)*.14);return{id,x,y,hp:max,max,remaining:life?1:Math.floor(rand(2,6)),life,flash:0};}
function generate(biome=0,floor=1,saved=null){
  biome=Number.isInteger(biome)&&biome>=0&&biome<3&&state.unlocked[biome]?biome:0;
  floor=Number.isInteger(floor)?clamp(floor,1,5):1;
  world={biome,floor,nodes:[],mined:0,cleared:false,gate:{x:W-135,y:H-130},boss:null};
  if(floor===5){
    const max=440*Math.pow(C.MINES[biome].scale,.7);world.boss={x:W/2,y:350,hp:max,max,timer:1.8,phase:0};
    for(let i=0;i<6;i++){const a=i*Math.PI/3;world.nodes.push(makeNode(biome*8+5,W/2+Math.cos(a)*210,390+Math.sin(a)*175,true));}
  }else{
    // Weighted veins: lower tiers are common, precious gems become more likely deeper down.
    const count=70+floor*5;
    for(let i=0;i<count;i++){
      let tier=Math.min(7,Math.floor(Math.pow(Math.random(),1.9)*8+(floor-1)*.18));
      let x=rand(90,W-90),y=rand(110,H-100);
      if(Math.hypot(x-180,y-180)<85||Math.hypot(x-world.gate.x,y-world.gate.y)<60){i--;continue;}
      if(world.nodes.some(n=>Math.hypot(n.x-x,n.y-y)<43)){i--;continue;}
      world.nodes.push(makeNode(biome*8+tier,x,y));
    }
    // A readable starting cluster and a guaranteed rare discovery on the third floor.
    world.nodes=world.nodes.filter(n=>Math.hypot(n.x-240,n.y-190)>110);
    for(let i=0;i<4;i++)world.nodes.push(makeNode(biome*8+i,260+i*56,165+(i%2)*62));
    if(floor>=3)world.nodes.push(makeNode(biome*8+7,470,310));
  }
  if(saved&&Array.isArray(saved.nodes)&&saved.nodes.length<=160&&saved.biome===biome&&saved.floor===floor){
    world.nodes=saved.nodes.filter(n=>n&&Number.isInteger(n.id)&&n.id>=biome*8&&n.id<biome*8+8&&Number.isFinite(n.x)&&Number.isFinite(n.y)).map(n=>{
      const node=makeNode(n.id,clamp(n.x,64,W-64),clamp(n.y,88,H-64),floor===5&&n.life===true);
      node.hp=safeNumber(n.hp,.001,node.max,node.max);node.remaining=Math.floor(safeNumber(n.remaining,0,5,1));return node;
    }).filter(n=>n.remaining>0);
    world.mined=Math.floor(safeNumber(saved.mined,0,1e6,0));world.cleared=saved.cleared===true;
    if(world.boss){world.boss.hp=safeNumber(saved.bossHp,1,world.boss.max,world.boss.max);if(world.cleared)world.boss=null;}
  }
  const p=saved?.player;
  player.x=safeNumber(p?.x,50,W-50,180);player.y=safeNumber(p?.y,75,H-50,180);
  player.tx=player.x;player.ty=player.y;player.hp=safeNumber(p?.hp,1,maxHealth(),maxHealth());player.invuln=world.boss?1:0;
  target=null;bullets=[];warningZones=[];particles=[];floats=[];attackClock=0;sessionValue=0;sessionSeconds=0;
  cam.x=clamp(player.x-width/zoom/2,0,W-width/zoom);cam.y=clamp(player.y-height/zoom/2,0,H-height/zoom);
  state.stats.deepest=Math.max(state.stats.deepest,biome*5+floor);hud();
}
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('show');toastTimer=3.3;}
function sound(type='hit'){
  if(!state.settings.sound)return;
  try{
    if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();
    if(audio.state==='suspended')audio.resume();
    const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.type=type==='hit'?'triangle':'sine';
    const f=type==='coin'?850:type==='upgrade'?520:type==='hurt'?100:260;
    o.frequency.setValueAtTime(f,audio.currentTime);o.frequency.exponentialRampToValueAtTime(f*(type==='upgrade'?1.7:.6),audio.currentTime+.09);
    g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.12);o.start();o.stop(audio.currentTime+.13);
  }catch(e){}
}
function vibrate(){if(state.settings.vibration&&window.MineworldNative)try{MineworldNative.tap();}catch(e){}}
function float(text,x,y,color='#f8db8d'){floats.push({text,x,y,life:1,color});if(floats.length>35)floats.shift();}
function burst(x,y,color,n=8){if(state.settings.reduced)return;for(let i=0;i<n;i++)particles.push({x,y,vx:rand(-70,70),vy:rand(-100,30),life:rand(.25,.65),color,size:rand(2,5)});if(particles.length>220)particles.splice(0,particles.length-220);}
function ripple(x,y,color='#b2f5c5',max=50){if(!state.settings.reduced)ripples.push({x,y,r:8,max,life:.5,color});}
function screenToWorld(x,y){const r=canvas.getBoundingClientRect();return{x:(x-r.left)/zoom+cam.x,y:(y-r.top)/zoom+cam.y};}
function select(n){target=n;player.tx=n.x;player.ty=n.y;attackClock=0;ripple(n.x,n.y,'#cff5be',24);}
canvas.addEventListener('pointerdown',e=>{
  if(paused||suspended)return;e.preventDefault();sound('select');
  const p=screenToWorld(e.clientX,e.clientY);
  let nearest=null,best=35;
  for(const n of world.nodes){const d=distance(n,p);if(d<best){best=d;nearest=n;}}
  if(nearest)select(nearest);
  else if(world.boss&&distance(world.boss,p)<67)select(world.boss);
  else{target=null;player.tx=clamp(p.x,48,W-48);player.ty=clamp(p.y,78,H-48);ripple(player.tx,player.ty);}
});
function mine(n,scale=1,allowProc=true){
  if(!n||n.remaining===0)return;
  const isBoss=n===world.boss;
  let dmg=C.damage(state)*scale;
  const lucky=luckTime>0||(allowProc&&C.total(state)>=60&&Math.random()<.08);
  if(lucky&&!isBoss)dmg=Math.max(dmg,n.max);
  n.hp-=dmg;n.flash=.12;swing=.22;sound('hit');burst(n.x,n.y,isBoss?'#f0b599':C.ORES[n.id].color,4);
  if(isBoss){if(n.hp<=0)bossWin();return;}
  if(n.hp>0)return;
  n.remaining--;n.hp=n.max;
  if(n.life){
    const b=world.boss;if(b){b.hp-=b.max*.19;float('결정 파괴!',n.x,n.y,'#baf8df');ripple(n.x,n.y,'#fff3cc',120);if(b.hp<=0)bossWin();}
  }else{
    const value=C.reward(state,n.id,lucky?2:1);sessionValue+=value;world.mined++;
    float('+'+C.format(value)+(lucky?' 행운!':''),n.x,n.y);sound('coin');
  }
  if(n.remaining<=0){world.nodes=world.nodes.filter(v=>v!==n);burst(n.x,n.y,C.ORES[n.id].color,12);if(target===n){target=null;player.tx=player.x;player.ty=player.y;}}
}
function bossWin(){
  if(!world.boss)return;
  const b=world.boss;burst(b.x,b.y,'#ffd99c',60);ripple(b.x,b.y,'#fff2c2',240);
  const gold=Math.floor(1400*Math.pow(C.MINES[world.biome].scale,1.1)*C.multiplier(state));
  C.credit(state,gold);state.souls+=3+world.biome*2;state.stats.bosses++;state.stats.runBosses++;
  world.boss=null;world.cleared=true;world.nodes=[];target=null;bullets=[];warningZones=[];
  player.hp=maxHealth();player.tx=player.x;player.ty=player.y;
  toast('수호자 격파! +'+C.format(gold)+' G · 영혼 결정 +'+(3+world.biome*2));sound('upgrade');save();hud();
}
function hitPlayer(amount){
  if(player.invuln>0)return;
  player.hp-=amount;player.invuln=state.suit==='warden'?1.4:.8;shake=state.settings.reduced?0:5;vibrate();sound('hurt');float('-'+amount,player.x,player.y-20,'#ff9c89');
  if(player.hp<=0){
    const lost=Math.floor(state.gold*.05);state.gold-=lost;generate(world.biome,1);save();
    toast('구조되었어. 골드 5%를 잃고 B1으로 돌아왔어.');
  }
}
function bossUpdate(dt){
  const b=world.boss;if(!b)return;b.timer-=dt;b.phase+=dt;
  if(b.timer<=0){
    b.timer=b.hp/b.max<.4?1.05:1.8;
    const angle=Math.atan2(player.y-b.y,player.x-b.x),count=8+world.biome*2;
    for(let i=0;i<count;i++){const a=angle+i*Math.PI*2/count;bullets.push({x:b.x,y:b.y,vx:Math.cos(a)*(105+world.biome*20),vy:Math.sin(a)*(105+world.biome*20),r:7,life:8});}
    if(b.hp/b.max<.65)warningZones.push({x:player.x,y:player.y,t:1.05,r:58});
    if(!world.nodes.some(n=>n.life))for(let i=0;i<3;i++)world.nodes.push(makeNode(world.biome*8+5,rand(220,W-200),rand(230,H-200),true));
  }
  for(const bullet of bullets){bullet.x+=bullet.vx*dt;bullet.y+=bullet.vy*dt;bullet.life-=dt;if(distance(player,bullet)<bullet.r+12){bullet.life=0;hitPlayer(12+world.biome*3);}}
  bullets=bullets.filter(b=>b.life>0&&b.x>30&&b.y>60&&b.x<W-30&&b.y<H-30);
  for(const z of warningZones){z.t-=dt;if(z.t<=0){burst(z.x,z.y,'#ffb38b',20);if(distance(z,player)<z.r)hitPlayer(22);}}
  warningZones=warningZones.filter(z=>z.t>0);
}
function skill(id){
  const need={dash:15,slam:30,luck:60}[id];if(C.total(state)<need||cooldowns[id]>0||paused)return;
  if(id==='dash'){
    let dx=player.tx-player.x,dy=player.ty-player.y,d=Math.hypot(dx,dy);
    if(d<10){const n=world.nodes.slice().sort((a,b)=>distance(a,player)-distance(b,player))[0];if(n){select(n);dx=n.x-player.x;dy=n.y-player.y;d=Math.hypot(dx,dy);}}
    if(d<1){toast('먼저 이동할 곳이나 광물을 눌러 줘.');return;}
    const step=Math.min(d,260);burst(player.x,player.y,'#b6f3d3',12);player.x=clamp(player.x+dx/d*step,48,W-48);player.y=clamp(player.y+dy/d*step,78,H-48);player.invuln=.6;
    cooldowns.dash=5;state.stats.dashes++;ripple(player.x,player.y,'#cfffe4',80);
  }else if(id==='slam'){
    cooldowns.slam=12;ripple(player.x,player.y,'#d3e7a8',190);shake=state.settings.reduced?0:4;
    for(const n of [...world.nodes])if(distance(n,player)<190)mine(n,4,false);
    if(world.boss&&distance(world.boss,player)<190)mine(world.boss,2,false);
  }else{cooldowns.luck=30;luckTime=7;toast('7초 동안 행운 채굴! 채굴 성공 시 보상 2배');}
  sound('upgrade');vibrate();hud();
}
function descend(){
  if(world.floor===5&&!world.cleared){toast('생명 결정을 캐서 수호자를 약화시켜!');return;}
  if(world.floor<5&&world.mined<12){toast('광물을 '+(12-world.mined)+'회 더 캐면 계단이 열려.');return;}
  if(distance(player,world.gate)>95){target=null;player.tx=world.gate.x;player.ty=world.gate.y;toast('계단으로 이동 중. 도착하면 한 번 더 눌러 줘.');return;}
  if(world.floor===5){generate(world.biome,1);toast('탐험 완료! 새로운 B1에서 다시 시작해.');}
  else{generate(world.biome,world.floor+1);toast(world.floor===5?'수호자의 방 · 빛나는 생명 결정을 채굴해!':'B'+world.floor+' · 더 깊은 곳에 도착했어.');}
  save();
}
function update(dt){
  clock+=dt;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('#toast').classList.remove('show');}
  if(paused||suspended)return;
  sessionSeconds+=dt;saveTimer+=dt;hudTimer+=dt;
  for(const k of Object.keys(cooldowns))cooldowns[k]=Math.max(0,cooldowns[k]-dt);
  luckTime=Math.max(0,luckTime-dt);player.invuln=Math.max(0,player.invuln-dt);swing=Math.max(0,swing-dt);shake=Math.max(0,shake-dt*20);
  let stop=target?(state.suit==='scout'?61:47):3;
  const dx=player.tx-player.x,dy=player.ty-player.y,d=Math.hypot(dx,dy);
  if(d>stop){const speed=155*(state.suit==='scout'?1.35:state.suit==='alchemist'?.9:1),step=Math.min(d-stop,speed*dt);player.x+=dx/d*step;player.y+=dy/d*step;}
  if(target&&distance(player,target)<=stop+2){attackClock+=dt;let attempts=0;while(target&&attackClock>=C.interval(state)&&attempts++<8){attackClock-=C.interval(state);mine(target);}}
  bossUpdate(dt);
  for(const n of world.nodes)n.flash=Math.max(0,n.flash-dt);
  for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=150*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);
  for(const f of floats){f.y-=26*dt;f.life-=dt;}floats=floats.filter(f=>f.life>0);
  for(const r of ripples){r.r+=(r.max-r.r)*dt*8;r.life-=dt;}ripples=ripples.filter(r=>r.life>0);
  const cx=clamp(player.x-width/zoom/2,0,Math.max(0,W-width/zoom)),cy=clamp(player.y-height/zoom/2,0,Math.max(0,H-height/zoom));
  const blend=state.settings.reduced?1:Math.min(1,dt*8);cam.x+=(cx-cam.x)*blend;cam.y+=(cy-cam.y)*blend;
  if(saveTimer>=10){if(sessionSeconds>10)state.rate=Math.min(1e15,sessionValue/sessionSeconds);save();saveTimer=0;}
  if(hudTimer>.15){hud();hudTimer=0;}
}
function hud(){
  if(!world)return;
  $('#gold').innerHTML=C.format(state.gold)+' <small>G</small>';$('#souls').innerHTML=C.format(state.souls)+' <small>◆</small>';
  $('#mine-name').textContent=C.MINES[world.biome].name;$('#floor').textContent='B'+world.floor;
  $('#objective').textContent=world.boss?'생명 결정 파괴 → 수호자 약화':world.cleared?'수호자 격파 · 계단으로 탐험 마무리':world.mined>=12?'계단 개방 · 더 깊은 곳으로 내려가자':'계단 개방까지 채굴 '+Math.min(world.mined,12)+' / 12';
  $('#floor-progress i').style.width=(world.boss?(1-world.boss.hp/world.boss.max)*100:Math.min(100,world.mined/12*100))+'%';
  $('#descend').textContent=world.cleared?'탐험 완료 ↗':world.mined>=12?'다음 층 ↓':'계단 찾기 ↓';
  $('#health').classList.toggle('hidden',!world.boss);$('#boss-health').classList.toggle('hidden',!world.boss);
  if(world.boss){$('#health i').style.width=player.hp/maxHealth()*100+'%';$('#health b').textContent=Math.ceil(player.hp);$('#boss-health span').textContent=C.MINES[world.biome].boss;$('#boss-health i').style.width=Math.max(0,world.boss.hp/world.boss.max*100)+'%';}
  $('#total-level').textContent='Lv.'+C.total(state);
  for(const b of $$('[data-upgrade]')){const k=b.dataset.upgrade,lv=state.levels[k];b.querySelector('b').textContent=lv;b.querySelector('em').textContent=lv>=500?'MAX':C.format(C.cost(lv))+' G';b.classList.toggle('unaffordable',state.gold<C.cost(lv));}
  $('#buy-mode').textContent='강화 '+(state.settings.buy===1000?'MAX':'×'+state.settings.buy);
  for(const [id,need] of Object.entries({dash:15,slam:30,luck:60})){
    const b=$('#'+id),locked=C.total(state)<need;b.disabled=locked||cooldowns[id]>0;b.classList.toggle('ready',!locked&&cooldowns[id]===0);
    b.querySelector('small').textContent=locked?'합계 Lv.'+need:cooldowns[id]>0?Math.ceil(cooldowns[id])+'초':id==='luck'&&luckTime>0?'행운 발동 중':'사용 가능';
  }
  $('#badge').classList.toggle('hidden',!C.ACHIEVEMENTS.some(a=>!state.claimed.includes(a.id)&&C.progress(state,a)>=a.goal));
  const ti=$('#target-info');ti.classList.toggle('hidden',!target);
  if(target){const boss=target===world.boss;ti.innerHTML='<b>'+(boss?C.MINES[world.biome].boss:target.life?'생명 결정':C.ORES[target.id].name)+'</b><small>'+(boss?'생명 결정을 캐면 더 큰 피해를 줘':target.life?'파괴 시 수호자 체력 19% 감소':C.format(Math.floor(C.ORES[target.id].value*C.multiplier(state)))+' G / 채굴 · 남은 광맥 '+target.remaining)+'</small><div class="bar"><i style="width:'+Math.max(0,target.hp/target.max*100)+'%"></i></div>';}
}
// All artwork is drawn locally from original pixel primitives. No downloaded assets.
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function line(x1,y1,x2,y2,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function hash(x,y){return Math.abs(Math.sin(x*127.1+y*311.7)*43758.5453)%1;}
function terrain(){
  const theme=C.MINES[world.biome];ctx.fillStyle=theme.floor;ctx.fillRect(0,0,W,H);
  const tile=40,x0=Math.max(0,Math.floor(cam.x/tile)-1),y0=Math.max(0,Math.floor(cam.y/tile)-1);
  const x1=Math.min(W/tile,Math.ceil((cam.x+width/zoom)/tile)+1),y1=Math.min(H/tile,Math.ceil((cam.y+height/zoom)/tile)+1);
  const shades=world.biome===0?['#293c30','#2c4033','#25372d','#304135']:world.biome===1?['#2d4351','#29414f','#304654','#273b49']:['#4b332e','#50352e','#43302b','#4b3030'];
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const seed=hash(x,y);rect(x*tile,y*tile,tile-1,tile-1,shades[Math.floor(seed*4)]);
    if(seed>.65){rect(x*tile+8,y*tile+9,4,2,'#ffffff0b');rect(x*tile+26,y*tile+25,3,3,'#00000015');}
    if(seed>.93){rect(x*tile+15,y*tile+27,9,3,world.biome===0?'#405e39':world.biome===1?'#638294':'#9a5e3c');}
    if(x===0||y<2||x===31||y===25){rect(x*tile,y*tile,tile,tile,theme.wall);rect(x*tile+3,y*tile+4,34,27,'#ffffff06');rect(x*tile,y*tile+32,40,8,'#00000035');}
  }
  // Abandoned rails and wooden ties provide landmarks in the large scrolling map.
  for(let y=Math.max(100,Math.floor(cam.y/30)*30);y<Math.min(H-70,cam.y+height/zoom+30);y+=30)rect(602,y,66,7,world.biome===2?'#664037':'#5b513b');
  rect(613,90,4,H-150,'#869184');rect(651,90,4,H-150,'#626e66');
  for(const p of [{x:100,y:145},{x:480,y:460},{x:1050,y:210},{x:940,y:760}]){
    if(p.x<cam.x-60||p.x>cam.x+width/zoom+60||p.y<cam.y-80||p.y>cam.y+height/zoom+80)continue;
    rect(p.x-5,p.y-10,10,25,'#443e2d');rect(p.x-8,p.y-20,16,12,'#e7c878');
    if(!state.settings.reduced){const g=ctx.createRadialGradient(p.x,p.y-17,2,p.x,p.y-17,72);g.addColorStop(0,'#ffe39425');g.addColorStop(1,'#ffe39400');ctx.fillStyle=g;ctx.fillRect(p.x-75,p.y-90,150,150);}
  }
}
function drawGate(){
  const g=world.gate,open=world.mined>=12||world.cleared;ellipse(g.x,g.y+12,38,18,'#07171277');
  rect(g.x-28,g.y-24,56,49,'#13241e');rect(g.x-32,g.y-28,64,9,'#88947b');rect(g.x-32,g.y-19,8,48,'#65755e');rect(g.x+24,g.y-19,8,48,'#65755e');
  for(let i=0;i<5;i++)rect(g.x-22+i*2,g.y-8+i*7,44-i*4,4,open?'#9eae8c':'#516453');
  if(!open){line(g.x-20,g.y-12,g.x+20,g.y+19,'#6b5b42',6);line(g.x+20,g.y-12,g.x-20,g.y+19,'#6b5b42',6);}
  else{ctx.fillStyle='#c9f1b5';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.fillText('↓',g.x,g.y-36+Math.sin(clock*3)*3);}
}
function drawOre(n){
  const ore=C.ORES[n.id],x=Math.round(n.x),y=Math.round(n.y),t=ore.tier;
  ellipse(x,y+13,25,10,'#07131070');
  const base=world.biome===0?'#596353':world.biome===1?'#607e8b':'#76605d';
  rect(x-23,y+1,43,16,'#15221e');rect(x-20,y-5,37,20,base);rect(x-12,y-12,24,9,base);
  if(t<3&&!n.life){
    for(let i=0;i<4;i++){const dx=[-13,1,9,-4][i],dy=[0,-8,2,6][i];rect(x+dx,y+dy,8,7,ore.color);rect(x+dx,y+dy,5,2,'#ffffff5c');}
  }else{
    const c=n.life?'#c4ffe4':ore.color;
    ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x-16,y+5);ctx.lineTo(x-12,y-18);ctx.lineTo(x-5,y-26);ctx.lineTo(x+2,y-17);ctx.lineTo(x+6,y-30);ctx.lineTo(x+16,y-18);ctx.lineTo(x+19,y+5);ctx.lineTo(x+5,y+13);ctx.closePath();ctx.fill();
    ctx.fillStyle='#ffffff60';ctx.beginPath();ctx.moveTo(x-12,y-18);ctx.lineTo(x-5,y-26);ctx.lineTo(x-3,y+6);ctx.lineTo(x-16,y+5);ctx.closePath();ctx.fill();
    ctx.fillStyle='#091f253a';ctx.beginPath();ctx.moveTo(x+6,y-30);ctx.lineTo(x+16,y-18);ctx.lineTo(x+19,y+5);ctx.lineTo(x+5,y+13);ctx.closePath();ctx.fill();
    line(x+5,y-25,x+5,y+5,'#ffffff3c',2);
  }
  if((t>=5||n.life)&&!state.settings.reduced){const tw=Math.sin(clock*3+n.x);if(tw>.3){rect(x-23,y-25,2,8,'#edffe5');rect(x-26,y-22,8,2,'#edffe5');}}
  if(n.life){ellipse(x,y+6,30,17,'#b8ffdb1b');}
  if(n.flash>0){ctx.globalAlpha=n.flash*3;rect(x-22,y-20,44,36,'#ffffff');ctx.globalAlpha=1;}
  if(target===n){ctx.strokeStyle='#c1f7ba';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+13,31,17,0,0,Math.PI*2);ctx.stroke();}
}
function drawPlayer(){
  if(player.invuln>0&&Math.floor(clock*14)%2===0)return;
  const x=Math.round(player.x),y=Math.round(player.y),moving=Math.hypot(player.tx-player.x,player.ty-player.y)>50;
  const bob=state.settings.reduced?0:moving?Math.round(Math.sin(clock*13)*2):0;
  const right=(target?target.x:player.tx)>=x;
  ellipse(x,y+12,17,7,'#04110e80');
  const suit=state.suit,coat=suit==='warden'?'#9eafcd':suit==='alchemist'?'#e2c975':suit==='scout'?'#86c2a1':'#e4ac6b';
  rect(x-10,y-6+bob,20,20,'#253c3b');rect(x-8,y-6+bob,16,13,coat);
  rect(x-8,y+7,6,7,'#172a2a');rect(x+3,y+7,6,7,'#172a2a');
  if(moving){rect(x-10,y+12+(bob>0?1:-1),8,4,'#282c29');rect(x+3,y+12+(bob>0?-1:1),8,4,'#282c29');}
  rect(x-9,y-24+bob,19,18,'#f4cf9e');rect(x-11,y-26+bob,23,7,'#b78351');rect(x-13,y-20+bob,27,5,coat);rect(x-7,y-30+bob,15,7,coat);
  rect(x-3,y-28+bob,6,6,'#f4e9bb');rect(x+(right?4:-6),y-12+bob,3,3,'#233731');
  rect(x-13,y-4+bob,5,12,'#f4cf9e');rect(x+10,y-4+bob,5,12,'#f4cf9e');
  ctx.save();ctx.translate(x+(right?12:-12),y-3+bob);ctx.scale(right?1:-1,1);ctx.rotate(swing>0?-.9+(.22-swing)*8:.4);
  rect(0,-16,4,26,'#9c764b');rect(-9,-21,24,6,'#c7dbd3');rect(12,-16,5,7,'#a8bfb9');ctx.restore();
  if(luckTime>0){ellipse(x,y+12,24,11,'#f9e8a638');}
}
function drawBoss(){
  const b=world.boss;if(!b)return;const x=b.x,y=b.y+(state.settings.reduced?0:Math.sin(clock*2)*3),c=world.biome===0?'#8a9971':world.biome===1?'#92bacc':'#b87c66';
  ellipse(x,y+39,69,27,'#07120c99');rect(x-41,y-34,82,67,'#2c3c35');rect(x-38,y-37,76,58,c);
  rect(x-62,y-22,22,48,c);rect(x+40,y-22,22,48,c);rect(x-37,y+20,25,24,c);rect(x+12,y+20,25,24,c);
  rect(x-24,y-64,49,40,c);rect(x-29,y-54,58,12,c);rect(x-18,y-46,12,6,'#caffbd');rect(x+8,y-46,12,6,'#caffbd');
  rect(x-13,y-28,27,5,'#3d4c3b');rect(x-24,y-5,48,17,'#ffffff20');rect(x-10,y-16,20,25,world.biome===2?'#ffe0a0':'#c8ffe2');
  if(world.biome===0){rect(x-30,y-65,18,7,'#415b32');rect(x+10,y-70,13,12,'#55733c');}
  if(world.biome===1){rect(x-40,y-29,11,15,'#cefcff');rect(x+34,y-31,11,19,'#cefcff');}
  if(world.biome===2){rect(x-28,y-76,8,18,'#ffc27d');rect(x-4,y-82,8,24,'#ffd69b');rect(x+20,y-76,8,18,'#ffc27d');}
}
function draw(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  ctx.save();const shakeX=shake?Math.sin(clock*90)*shake:0;ctx.translate(shakeX,0);ctx.scale(zoom,zoom);ctx.translate(-cam.x,-cam.y);terrain();drawGate();
  for(const z of warningZones){ellipse(z.x,z.y,z.r,z.r,'#ed815c33');ctx.strokeStyle='#ffb195';ctx.lineWidth=2;ctx.beginPath();ctx.arc(z.x,z.y,z.r*(1-z.t/1.05),0,Math.PI*2);ctx.stroke();}
  const entities=world.nodes.filter(n=>n.x>cam.x-60&&n.x<cam.x+width/zoom+60&&n.y>cam.y-70&&n.y<cam.y+height/zoom+70).map(n=>({y:n.y,draw:()=>drawOre(n)}));
  entities.push({y:player.y,draw:drawPlayer});if(world.boss)entities.push({y:world.boss.y,draw:drawBoss});entities.sort((a,b)=>a.y-b.y).forEach(e=>e.draw());
  if(!target&&Math.hypot(player.tx-player.x,player.ty-player.y)>12){ctx.strokeStyle='#c6e4bd66';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(player.tx,player.ty,10,6,0,0,Math.PI*2);ctx.stroke();}
  for(const b of bullets){ellipse(b.x,b.y,b.r+3,b.r+3,'#ffd29b33');rect(b.x-b.r/2,b.y-b.r/2,b.r,b.r,'#ffd39b');rect(b.x-2,b.y-2,4,4,'#fff2d5');}
  for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*3);rect(p.x,p.y,p.size,p.size,p.color);}ctx.globalAlpha=1;
  for(const r of ripples){ctx.globalAlpha=r.life;ctx.strokeStyle=r.color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(r.x,r.y,r.r,r.r*.65,0,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
  for(const f of floats){ctx.globalAlpha=Math.min(1,f.life*3);ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.strokeStyle='#14251e';ctx.lineWidth=3;ctx.strokeText(f.text,f.x,f.y-30);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y-30);}ctx.globalAlpha=1;ctx.restore();
  const gradient=ctx.createRadialGradient(width/2,height/2,Math.min(width,height)*.25,width/2,height/2,Math.max(width,height)*.7);gradient.addColorStop(0,'#07100c00');gradient.addColorStop(1,'#07100c77');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
  drawMini();
}
function drawMini(){
  mc.clearRect(0,0,116,90);const sx=116/W,sy=90/H;
  for(const n of world.nodes){mc.fillStyle=n.life?'#fff3bd':C.ORES[n.id].color;mc.fillRect(n.x*sx,n.y*sy,2,2);}
  mc.strokeStyle='#96bca372';mc.lineWidth=.6;mc.strokeRect(cam.x*sx,cam.y*sy,width/zoom*sx,height/zoom*sy);
  mc.fillStyle='#dce2b1';mc.fillRect(world.gate.x*sx-2,world.gate.y*sy-2,4,4);
  if(world.boss){mc.fillStyle='#f5a486';mc.fillRect(world.boss.x*sx-3,world.boss.y*sy-3,6,6);}
  mc.fillStyle='#fff';mc.beginPath();mc.arc(player.x*sx,player.y*sy,2.5,0,Math.PI*2);mc.fill();
}
function resize(){const r=$('#viewport').getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.imageSmoothingEnabled=false;zoom=width<360?1.05:1.18;}
new ResizeObserver(resize).observe($('#viewport'));
function showModal(tab,title,html,eyebrow='탐험가의 기록'){
  modalTab=tab;paused=true;$('#modal-title').textContent=title;$('#modal-eyebrow').textContent=eyebrow;$('#modal-content').innerHTML=html;$('#modal').classList.remove('hidden');$('.sheet').scrollTop=0;$('#close-modal').focus();
}
function closeModal(){if(modalTab==='welcome')state.tutorial=true;modalTab=null;paused=false;$('#modal').classList.add('hidden');save();}
function mapModal(){
  const html='<p class="intro">광산마다 5개의 층과 고유한 수호자가 있어. 일반층에서 12회 채굴하면 계단이 열려. 광산을 변경하면 해당 광산 B1에서 시작해.</p>'+C.MINES.map((m,i)=>{
    const open=state.unlocked[i],can=C.total(state)>=m.unlock;
    return '<article class="card"><span class="chip">'+(open?'탐험 가능':'봉인된 광산')+'</span><h2 style="color:'+m.color+'">'+m.name+'</h2><p>'+m.subtitle+'<br>광물 8종 · 5개 층 · '+m.boss+'</p><div class="row"><small>'+(open?(world.biome===i?'현재 탐험 중 · B'+world.floor:'봉인 해제 완료'):'봉인 해제: 능력치 합계 '+m.unlock)+'</small><button data-action="mine" data-id="'+i+'" '+(!open&&!can?'disabled':'')+'>'+(open?'B1 입장':can?'봉인 해제':'성장 필요')+'</button></div></article>';
  }).join('');showModal('map','어디까지 내려가 볼까',html,'광산 탐험');
}
function bookModal(){
  showModal('book','광물 도감','<p class="intro">발견한 광물 '+state.seen.filter(x=>x>0).length+' / 24종. 표기 가격은 현재 솜씨와 영구 강화가 반영된 1회 채굴 가치야.</p>'+C.MINES.map((m,i)=>'<h3>'+m.name+'</h3><div class="book-grid">'+C.ORES.filter(o=>o.biome===i).map(o=>'<div class="ore-card '+(!state.seen[o.id]?'unknown':'')+'"><span class="gem" style="--gem:'+(state.seen[o.id]?o.color:'#6d8580')+'"></span><b>'+(state.seen[o.id]?o.name:'미발견')+'</b><small>'+(state.seen[o.id]?C.format(o.value*C.multiplier(state))+' G · '+C.format(state.seen[o.id])+'회':'광산에서 발견해 봐')+'</small></div>').join('')+'</div>').join(''));
}
function shopModal(){
  showModal('shop','다음 탐험을 더 강하게','<p class="intro">보유 영혼 결정 <b style="color:var(--mint)">'+C.format(state.souls)+' ◆</b><br>보스·업적·환생으로 얻는 재화야. 영구 강화와 코스튬은 환생해도 유지돼.</p><h3>영구 강화</h3>'+C.RELICS.map(r=>'<article class="card row"><div><h2>'+r.name+' <small>Lv.'+state.relics[r.id]+'</small></h2><p>'+r.desc+'</p></div><button data-action="relic" data-id="'+r.id+'" '+(state.souls<C.relicCost(state,r.id)||state.relics[r.id]>=100?'disabled':'')+'>'+(state.relics[r.id]>=100?'MAX':C.format(C.relicCost(state,r.id))+' ◆')+'</button></article>').join('')+'<h3>탐험 코스튬</h3>'+C.SUITS.map(s=>'<article class="card row"><div><h2>'+s.name+(state.suit===s.id?' <small>착용 중</small>':'')+'</h2><p>'+s.desc+'</p></div><button data-action="suit" data-id="'+s.id+'" '+(state.suit===s.id||(!state.owned.includes(s.id)&&state.souls<s.cost)?'disabled':'')+'>'+(state.suit===s.id?'착용 중':state.owned.includes(s.id)?'착용':s.cost+' ◆')+'</button></article>').join(''),'영혼 상점');
}
function achievementModal(){
  const count=state.claimed.length;
  showModal('achievements','작은 발견, 커다란 기록','<p class="intro">완료한 업적 '+count+' / '+C.ACHIEVEMENTS.length+'개. 보상은 직접 받아야 영혼 결정에 추가돼.</p>'+C.ACHIEVEMENTS.map(a=>{
    const p=C.progress(state,a),done=state.claimed.includes(a.id);return '<article class="card"><div class="row"><div><h2>'+a.name+'</h2><small>'+a.desc+'</small></div><button data-action="claim" data-id="'+a.id+'" '+(done||p<a.goal?'disabled':'')+'>'+(done?'수령 완료':a.reward+' ◆ 받기')+'</button></div><div class="progress"><i style="width:'+Math.min(100,p/a.goal*100)+'%"></i></div><small>'+C.format(Math.min(p,a.goal))+' / '+C.format(a.goal)+'</small></article>';
  }).join(''),'업적 '+count+'/'+C.ACHIEVEMENTS.length);
}
function rebirthModal(){
  const ready=C.canRebirth(state),reward=C.rebirthReward(state);
  showModal('rebirth','더 강하게, 다시 시작','<span class="hero-gem"></span><p class="intro">능력치 합계 90부터 환생할 수 있어. 이번 탐험에서 번 골드와 보스 처치 수에 따라 영혼 결정을 받아.</p><div class="stat-grid"><div>이번 탐험 수익<b>'+C.format(state.runEarned)+' G</b></div><div>환생 예상 보상<b>'+reward+' ◆</b></div><div>현재 능력치 합계<b>'+C.total(state)+' / 90</b></div><div>지금까지 환생<b>'+state.stats.rebirths+'회</b></div></div><article class="card"><h2>환생하면 이렇게 바뀌어</h2><p>골드와 속도·힘·솜씨는 0으로 초기화돼. 이끼빛 갱도 B1에서 다시 출발해.<br><br>영혼 결정, 영구 강화, 코스튬, 광산 해금, 도감, 업적은 모두 유지돼.</p></article><button class="primary" data-action="rebirth-check" '+(!ready?'disabled':'')+'>'+(ready?'환생 준비 · '+reward+' ◆':'능력치 합계 '+(90-C.total(state))+' 더 필요')+'</button>','환생 '+state.stats.rebirths+'회');
}
function settingsModal(){
  showModal('settings','탐험 설정','<p class="intro">마인월드 v1.0 · 인터넷 없이 플레이할 수 있어.<br>앱 삭제 전에는 아래 저장 코드를 따로 보관해 줘.</p>'+[['sound','효과음'],['vibration','진동'],['reduced','화면 흔들림·입자 줄이기'],['balance','균등 강화 · 가장 낮은 능력치 우선']].map(([id,label])=>'<label class="setting">'+label+'<input type="checkbox" data-setting="'+id+'" '+(state.settings[id]?'checked':'')+'></label>').join('')+'<div class="stat-grid"><div>누적 채굴<b>'+C.format(state.stats.mined)+'회</b></div><div>수호자 처치<b>'+state.stats.bosses+'회</b></div><div>채굴 간격<b>'+C.interval(state).toFixed(2)+'초</b></div><div>채굴 위력<b>'+C.format(C.damage(state))+'</b></div></div><h3>저장 코드 백업 / 복원</h3><p class="intro">내보내기를 누르고 코드를 길게 눌러 복사해 둬. 복원은 현재 진행을 교체하므로 확인 후 적용해.</p><textarea id="save-code" aria-label="저장 코드" placeholder="내보낸 코드가 여기에 표시돼. 복원할 코드를 붙여 넣을 수도 있어." spellcheck="false"></textarea><div class="row"><button class="secondary" data-action="export">내보내기</button><button class="secondary" data-action="import-check">코드 복원</button></div><button class="secondary" data-action="backup-check">이전 자동 저장 복구</button><div id="save-status" role="status"></div><button class="secondary" data-action="help">조작·성장 도움말</button>','게임 및 저장');
}
function helpModal(welcome=false){
  showModal(welcome?'welcome':'help',welcome?'산너머에 뭐가 있을까':'탐험가 안내서','<span class="hero-gem"></span><p class="intro">작은 곡괭이 하나로 시작해, 산속에 잠든 보석과 수호자를 찾아 떠나자.</p><ol class="feature-list"><li>바닥을 누르면 이동해.</li><li>광물을 한 번 누르면 다 캘 때까지 자동 채굴해.</li><li>골드로 속도·힘·솜씨를 강화해.</li><li>일반층에서 12회 채굴하고 계단으로 이동해.</li><li>B5에서는 탄막을 피하며 생명 결정을 캐.</li><li>합계 Lv.90부터 환생과 영구 성장을 시작해.</li></ol><p class="intro">돌진 Lv.15 · 광역 강타 Lv.30 · 행운 채굴 Lv.60에 해금돼. 획득한 업적 보상도 챙겨 줘.</p>'+(startingOffline&&welcome?'<article class="card"><h2>쉬는 동안 모인 골드</h2><p>'+C.format(startingOffline)+' G가 자동으로 지급되었어.</p></article>':'')+'<button class="primary" data-action="close">'+(welcome?'첫 탐험 시작하기':'이제 알겠어')+'</button>','MINEWORLD · 산너머 보석광산');
}
function confirmModal(title,desc,action,label){showModal('confirm',title,'<p class="intro">'+desc+'</p><button class="primary" data-action="'+action+'">'+label+'</button><button class="secondary" data-action="close">취소하고 돌아가기</button>','한 번 더 확인');}
let pendingImport=null;
$('#modal-content').addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const action=b.dataset.action,id=b.dataset.id;
  if(action==='close'){closeModal();return;}
  if(action==='mine'){
    const i=Number(id);if(!Number.isInteger(i)||i<0||i>2)return;
    if(!state.unlocked[i]){if(C.total(state)<C.MINES[i].unlock)return;state.unlocked[i]=true;}
    generate(i,1);closeModal();toast(C.MINES[i].name+' B1 · 탐험 시작');
  }else if(action==='relic'){if(C.buyRelic(state,id)){save();sound('upgrade');shopModal();}}
  else if(action==='suit'){const fraction=player.hp/maxHealth();if(C.suit(state,id)){player.hp=Math.max(1,fraction*maxHealth());save();shopModal();}}
  else if(action==='claim'){if(C.claim(state,id)){save();sound('upgrade');achievementModal();}}
  else if(action==='rebirth-check'){confirmModal('이번 탐험을 마칠까?','골드와 능력치를 초기화하고 영혼 결정 '+C.rebirthReward(state)+'개를 받아. 영구 강화와 수집 기록은 유지돼.','rebirth','환생하고 다시 출발');}
  else if(action==='rebirth'){
    const amount=C.rebirth(state);if(amount){cooldowns={dash:0,slam:0,luck:0};luckTime=0;generate(0,1);closeModal();toast('환생 완료! 영혼 결정 +'+amount);sound('upgrade');}
  }else if(action==='export'){
    save();$('#save-code').value=JSON.stringify(state);$('#save-code').focus();$('#save-code').select();$('#save-status').textContent='코드를 길게 눌러 복사해서 따로 보관해 줘.';
  }else if(action==='import-check'){
    try{
      const text=$('#save-code').value;if(text.length>200000)throw new Error();const raw=JSON.parse(text);
      if(raw?.version!==1||!raw.levels||!Array.isArray(raw.seen))throw new Error();pendingImport=C.normalize(raw);
      confirmModal('저장 코드로 복원할까?','현재 진행 대신 코드의 기록을 불러와. 코드 기록: 합계 Lv.'+C.total(pendingImport)+' · '+C.format(pendingImport.gold)+' G.','import','코드로 복원');
    }catch(err){$('#save-status').textContent='올바른 마인월드 v1 저장 코드를 넣어 줘.';}
  }else if(action==='backup-check'){
    try{const raw=JSON.parse(localStorage.getItem(BACKUP));if(raw?.version!==1||!raw.levels)throw new Error();pendingImport=C.normalize(raw);confirmModal('이전 자동 저장을 불러올까?','이전 기록: 합계 Lv.'+C.total(pendingImport)+' · '+C.format(pendingImport.gold)+' G. 현재 기록이 교체돼.','import','이전 기록 복구');}catch(err){$('#save-status').textContent='복구할 이전 자동 저장이 없어.';}
  }else if(action==='import'){
    if(!pendingImport)return;state=pendingImport;pendingImport=null;cooldowns={dash:0,slam:0,luck:0};luckTime=0;
    const w=state.world;generate(w?.biome||0,w?.floor||1,w);closeModal();toast('저장 기록을 복원했어.');
  }else if(action==='help')helpModal();
  else if(action==='home'){generate(world.biome,1);closeModal();toast('B1으로 귀환했어. 체력도 회복되었어.');}
  hud();
});
$('#modal-content').addEventListener('change',e=>{const key=e.target.dataset.setting;if(key&&Object.hasOwn(state.settings,key)){state.settings[key]=e.target.checked;save();}});
$('#close-modal').onclick=closeModal;
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))closeModal();});
$('#settings').onclick=settingsModal;$('#map-button').onclick=mapModal;$('#descend').onclick=descend;
$('#home').onclick=()=>confirmModal('잠시 쉬어 갈까?','골드와 성장은 유지돼. 현재 층을 떠나 이 광산 B1에서 체력을 회복해.','home','B1으로 귀환');
const tabs={book:bookModal,shop:shopModal,achievements:achievementModal,rebirth:rebirthModal};
for(const b of $$('[data-tab]'))b.onclick=()=>{save();tabs[b.dataset.tab]();};
for(const b of $$('[data-upgrade]'))b.onclick=()=>{
  const old=C.total(state),bought=C.upgrade(state,b.dataset.upgrade);
  if(bought){sound('upgrade');vibrate();for(const n of [15,30,60,90])if(old<n&&C.total(state)>=n)toast(n===90?'환생이 가능해졌어!':n===15?'돌진 해금!':n===30?'광역 강타 해금!':'행운 채굴 해금!');save();hud();}
  else toast(state.levels[b.dataset.upgrade]>=500?'최대 레벨에 도달했어.':'골드가 부족해. 광물을 더 캐 보자.');
};
$('#buy-mode').onclick=()=>{state.settings.buy=({1:10,10:1000,1000:1})[state.settings.buy];save();hud();};
for(const id of ['dash','slam','luck'])$('#'+id).onclick=()=>skill(id);
function suspend(){if(suspended)return;save();suspended=true;audio?.suspend();}
function resume(){
  if(!suspended)return;suspended=false;previous=performance.now();const amount=C.offline(state);if(amount){C.credit(state,amount);toast('쉬는 동안 +'+C.format(amount)+' G');}save();hud();
}
document.addEventListener('visibilitychange',()=>document.hidden?suspend():resume());
window.addEventListener('pagehide',suspend);
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(modalTab)closeModal();else settingsModal();}if(e.key==='Tab'&&modalTab){const focusable=$$('#modal button:not(:disabled),#modal input,#modal textarea'),first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
window.MW={suspend,resume,back(){if(modalTab)closeModal();else settingsModal();},getState(){return JSON.parse(JSON.stringify({...state,world:snapshot()}));}};
resize();const restored=state.world;generate(restored?.biome||0,restored?.floor||1,restored);
if(!state.tutorial)helpModal(true);else if(startingOffline)toast('쉬는 동안 +'+C.format(startingOffline)+' G');
function frame(now){const dt=Math.min(.05,Math.max(0,(now-(previous||now))/1000));previous=now;update(dt);draw();requestAnimationFrame(frame);}
requestAnimationFrame(frame);
})();
