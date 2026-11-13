(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./data.js'):root.MineData);if(typeof module==='object'&&module.exports)module.exports=api;else root.MineCore=api;})(globalThis,function(D){
'use strict';
const {MINES,ORES,ITEMS,SUITS,BOSSES,TRIALS,OPTIONS}=D,VERSION=2,MAX_LEVEL=2000000000;
const finite=(v,d=0,min=0,max=1e100)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):d;
const integer=(v,d=0,min=0,max=Number.MAX_SAFE_INTEGER)=>Math.floor(finite(v,d,min,max));
const tiers=[1,6,18,54,108,174],tierBonus=[0,6,18,54,108,174,174];
function fresh(now=Date.now()){
 return {version:2,gold:0,souls:0,catalysts:0,engraving:0,shards:0,earned:0,runEarned:0,levels:{speed:0,power:0,skill:0},relics:{power:0,fortune:0,vault:0},owned:['miner'],suit:'miner',unlocked:MINES.map((_,i)=>i===0),seen:ORES.map(()=>0),marks:Array(14).fill(0),trialMarks:{},items:{...Object.fromEntries(ITEMS.map(i=>[i.id,0])),keys:0,potions:0,treasure:0,trialPass:0},tickets:[0,0,0,0],bossKills:BOSSES.map(()=>0),mineKills:MINES.map(()=>0),notes:[],infiniteKeys:0,dimensionSeals:0,engraveCount:0,awakened:false,compression:0,pickaxe:{found:false,repaired:false,options:[],saved:[],locked:-1},secret:{step:0,enabled:false,completed:false},temple:{unlocked:false,completed:false},boostUntil:0,limitGauge:0,limitUses:0,reviveEnabled:true,rebirthUse:0,daily:{day:'',claimed:false,completed:false,best:0},stats:{mined:0,stone:0,bosses:0,rebirths:0,deepest:1,runBosses:0,dashes:0,trials:0,seals:0,treasures:0,puzzles:0,deaths:0},claimed:[],settings:{sound:true,music:true,vibration:true,reduced:false,balance:false,buy:1,autoNext:false},rate:0,lastSeen:now,world:null,tutorial:false};
}
function normalize(raw,now=Date.now()){
 const s=fresh(now);if(!raw||typeof raw!=='object'||![1,2].includes(raw.version))return s;
 for(const k of ['gold','souls','catalysts','engraving','shards','earned','runEarned','boostUntil','limitGauge'])s[k]=finite(raw[k]);
 for(const k of Object.keys(s.levels))s.levels[k]=integer(raw.levels?.[k],0,0,MAX_LEVEL);
 for(const k of Object.keys(s.relics))s.relics[k]=integer(raw.relics?.[k],0,0,100);
 for(const k of Object.keys(s.stats))s.stats[k]=integer(raw.stats?.[k],k==='deepest'?1:0);
 for(const k of ['dimensionSeals','engraveCount','compression','limitUses','infiniteKeys'])s[k]=integer(raw[k],0,0,k==='compression'?50:1000000);
 s.dimensionSeals=Math.min(7,s.dimensionSeals);s.awakened=raw.awakened===true;s.reviveEnabled=raw.reviveEnabled!==false;s.rebirthUse=integer(raw.rebirthUse,0,0,20);
 for(const k of Object.keys(s.items))s.items[k]=integer(raw.items?.[k],0,0,ITEMS.find(i=>i.id===k)?.max||1e8);
 s.owned=SUITS.filter(x=>x.id==='miner'||(Array.isArray(raw.owned)&&raw.owned.includes(x.id))).map(x=>x.id);s.suit=s.owned.includes(raw.suit)?raw.suit:'miner';
 for(const k of Object.keys(s.settings))if(typeof s.settings[k]==='boolean'&&typeof raw.settings?.[k]==='boolean')s.settings[k]=raw.settings[k];
 s.settings.buy=[1,10,100,1000,1e12].includes(raw.settings?.buy)?raw.settings.buy:1;
 s.claimed=Array.isArray(raw.claimed)?[...new Set(raw.claimed.filter(v=>typeof v==='string'))].slice(0,250):[];
 s.rate=finite(raw.rate,0,0,1e30);s.lastSeen=finite(raw.lastSeen,now,0,now);s.tutorial=raw.tutorial===true;
 if(raw.version===1){
   D.legacyNames.forEach((name,i)=>{const id=D.oid(name==='구리'?'동':name);s.seen[id]=integer(raw.seen?.[i]);});
   for(const [old,n]of [[0,0],[1,6],[2,8]])if(raw.unlocked?.[old])s.unlocked[n]=true;
   if(raw.world){const w=JSON.parse(JSON.stringify(raw.world)),map=[0,6,8];w.biome=map[w.biome]||0;w.floor=w.floor===5?MINES[w.biome].floors:integer(w.floor,1,1,5);w.nodes=Array.isArray(w.nodes)?w.nodes.map(n=>({...n,id:D.oid(D.legacyNames[n.id]==='구리'?'동':D.legacyNames[n.id])})).filter(n=>n.id>=0):[];w.mode='mine';s.world=w;}
 }else{
   s.seen=ORES.map((_,i)=>integer(raw.seen?.[i]));s.unlocked=MINES.map((_,i)=>i===0||raw.unlocked?.[i]===true);
   s.marks=s.marks.map((_,i)=>integer(raw.marks?.[i],0,0,5));s.tickets=s.tickets.map((_,i)=>integer(raw.tickets?.[i],0,0,99));
   s.bossKills=BOSSES.map((_,i)=>integer(raw.bossKills?.[i]));s.mineKills=MINES.map((_,i)=>integer(raw.mineKills?.[i]));
   s.notes=Array.isArray(raw.notes)?[...new Set(raw.notes.filter(n=>Number.isInteger(n)&&n>=1&&n<=10))]:[];
   for(const t of TRIALS)s.trialMarks[t.id]=integer(raw.trialMarks?.[t.id],0,0,5);
   s.trialMarks.snow=integer(raw.trialMarks?.snow,0,0,5);
   s.temple={unlocked:raw.temple?.unlocked===true,completed:raw.temple?.completed===true};
   s.secret={step:integer(raw.secret?.step,0,0,5),enabled:raw.secret?.enabled===true,completed:raw.secret?.completed===true};
   const cleanOptions=xs=>Array.isArray(xs)?xs.slice(0,4).filter(o=>OPTIONS.some(p=>p.id===o?.id)).map(o=>({id:o.id,value:finite(o.value,0,0,1e6),ore:integer(o.ore,0,0,ORES.length-1)})):[];
   s.pickaxe={found:raw.pickaxe?.found===true,repaired:raw.pickaxe?.repaired===true,options:cleanOptions(raw.pickaxe?.options),saved:cleanOptions(raw.pickaxe?.saved),locked:integer(raw.pickaxe?.locked,-1,-1,3)};
   if(raw.world&&typeof raw.world==='object')s.world=raw.world;
   if(raw.daily&&typeof raw.daily.day==='string')s.daily={day:raw.daily.day.slice(0,10),claimed:raw.daily.claimed===true,completed:raw.daily.completed===true,best:integer(raw.daily.best)};
 }
 return s;
}
function baseTotal(s){return s.levels.speed+s.levels.power+s.levels.skill;}
function tier(n){return tiers.filter(t=>n>=t).length;}
function bookBonus(s){return s.seen.reduce((sum,n)=>sum+tierBonus[tier(n)],0);}
function option(s,key,ore=-1){if(!s.pickaxe.repaired)return 0;return s.pickaxe.options.filter(o=>o.id===key&&(key!=='value'||o.ore===ore)).reduce((sum,o)=>sum+o.value,0);}
function bonus(s){return Math.floor(bookBonus(s)/3)+s.marks.reduce((v,n,i)=>v+n*(i+1),0)+Object.entries(s.trialMarks).reduce((v,[k,n])=>v+n*(k==='tech'?5:k==='snow'?10:k==='power2'?8:4),0)+s.items.spirit*4+s.engraveCount*2+option(s,'flat')+s.compression*5;}
function level(s,key,now=Date.now()){
 let value=(s.levels[key]+bonus(s))*(s.awakened?1.1:1)*(1+option(s,'percent'));
 if(s.boostUntil>now)value*=1.5;return Math.min(MAX_LEVEL,s.trialCap?Math.floor(s.trialCap/3):MAX_LEVEL,Math.floor(value));
}
function total(s){return level(s,'speed')+level(s,'power')+level(s,'skill');}
function damage(s){return (8+level(s,'power')*3.8)*(1+s.relics.power*.15)*(s.suit==='drill'?1/3:1);}
function interval(s){return .72/(1+level(s,'speed')*.08)/(s.suit==='drill'?5:s.suit==='bighand'?.5:1);}
function multiplier(s,id=-1){return(1+level(s,'skill')*.12)*(1+s.relics.fortune*.12)*(s.suit==='alchemist'?1.25:1)*(1+s.items.analysis*.02)*(1+option(s,'value',id))*(id>=0&&tier(s.seen[id])>=6?2:1);}
function maxHealth(s){return Math.round(100*(1+s.items.coat*.05+option(s,'health'))*(['hammer','valentine'].includes(s.suit)?2:s.suit==='warden'?1.5:1));}
function cost(l){return Math.ceil(22+9*l+2*Math.pow(l,1.25));}
function costTotal(l,n){
 n=Math.max(0,Math.min(MAX_LEVEL-l,Math.floor(n)));if(n<=1024){let price=0;for(let i=0;i<n;i++)price+=cost(l+i);return price;}
 // Midpoint integration for the smooth power term avoids a billion-iteration MAX purchase.
 const a=Math.max(0,l-.5),b=l+n-.5;
 return Math.ceil(22*n+9*(n*l+n*(n-1)/2)+2*(Math.pow(b,2.25)-Math.pow(a,2.25))/2.25+n*.5);
}
function affordable(l,budget,cap){let lo=0,hi=Math.min(cap,MAX_LEVEL-l);while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(costTotal(l,mid)<=budget)lo=mid;else hi=mid-1;}return lo;}
function upgrade(s,key,count=s.settings.buy){
 if(!Object.hasOwn(s.levels,key))return 0;count=Math.min(6e9,Math.floor(count));let bought=0;
 if(s.settings.balance&&count>1024){
   const max=Math.min(MAX_LEVEL,Math.max(...Object.values(s.levels))+Math.ceil(count/3));let lo=Math.min(...Object.values(s.levels)),hi=max;
   while(lo<hi){const m=Math.ceil((lo+hi)/2),units=Object.values(s.levels).reduce((n,l)=>n+Math.max(0,m-l),0),price=Object.values(s.levels).reduce((n,l)=>n+costTotal(l,Math.max(0,m-l)),0);if(units<=count&&price<=s.gold)lo=m;else hi=m-1;}
   for(const k of Object.keys(s.levels)){const n=Math.max(0,lo-s.levels[k]);s.gold=Math.max(0,s.gold-costTotal(s.levels[k],n));s.levels[k]+=n;bought+=n;}
   count=Math.min(3,count-bought);
 }
 if(s.settings.balance){for(let i=0;i<count;i++){const k=Object.keys(s.levels).reduce((a,b)=>s.levels[a]<=s.levels[b]?a:b),p=cost(s.levels[k]);if(s.levels[k]>=MAX_LEVEL||s.gold<p)break;s.gold-=p;s.levels[k]++;bought++;}}
 else{const n=affordable(s.levels[key],s.gold,count);s.gold=Math.max(0,s.gold-costTotal(s.levels[key],n));s.levels[key]+=n;bought=n;}
 if(s.items.limit)s.limitGauge=Math.min(1e9,s.limitGauge+bought/Math.max(1,10+s.limitUses));return bought;
}
function credit(s,amount){amount=finite(amount);s.gold=finite(s.gold+amount);s.earned=finite(s.earned+amount);s.runEarned=finite(s.runEarned+amount);}
function reward(s,id,n=1,roll=Math.random()){
 const o=ORES[id];if(!o)return 0;n=integer(n,1,0,100000000);let scale=s.suit==='gold'&&roll<.02?30:1;if(s.compression&&roll<Math.min(1,s.compression*.2))scale*=2;
 const value=Math.floor(o.value*multiplier(s,id)*n*scale);credit(s,value);s.seen[id]=Math.min(Number.MAX_SAFE_INTEGER,s.seen[id]+n);s.stats.mined+=n;if(id===0)s.stats.stone+=n;
 const drops=({34:100,38:400,42:2000,46:5000,54:100,62:100,65:50})[id];if(drops)s.souls+=drops*n;
 if([60,61].includes(id)&&roll<.04)s.shards++;if(id===62)s.shards+=Math.min(n,3);
 return value;
}
function sealRequirement(s,id){const m=MINES[id];return Math.ceil(m.unlock*(1-Math.min(.3,(s.mineKills[Math.max(0,id-1)]||0)*.03))*(1-Math.min(.5,s.engraveCount*.01)));}
function canEnter(s,id){
 const m=MINES[id];if(!m)return{ok:false,reason:'알 수 없는 광산'};
 if(m.access==='infinite')return{ok:s.infiniteKeys>0&&total(s)>=m.unlock,reason:'천상 3개의 문과 능력치 합계 20만 필요'};
 if(m.access==='dimension')return{ok:s.engraveCount>0&&s.dimensionSeals>=7,reason:'첫 각인 후 일곱 봉인석을 해제해야 해'};
 if(m.access==='hidden')return{ok:s.items.map>0&&s.items.keys>=7,reason:'비밀지도와 열쇠 7개 필요'};
 if(m.access==='secret')return{ok:s.secret.step>=5,reason:'전자 → 다이아 → 얼음 → 시간 → 황금 → 사원 포탈 순서 필요'};
 if(m.access==='snow')return{ok:s.unlocked[6],reason:'얼음 광산을 먼저 해금해 줘'};
 if(m.access==='seal')return{ok:s.unlocked[id],reason:'봉인석을 채굴해야 해'};
 return{ok:true};
}
function enter(s,id){
 const result=canEnter(s,id);if(!result.ok)return result;const m=MINES[id];
 if(m.access==='ticket'&&!s.items.identity){if(s.tickets[id]>0)s.tickets[id]--;else{const fee=Math.ceil(m.fee*(s.suit==='hammer'?.5:1));if(s.gold<fee)return{ok:false,reason:'입장권 또는 '+format(fee)+' G가 필요해'};s.gold-=fee;}}
 if(m.access==='hidden')s.items.keys-=7;
 return{ok:true,floor:m.access==='infinite'?Math.max(1,s.infiniteKeys):1};
}
function unseal(s,id){
 if(id===16){if(!s.engraveCount||s.dimensionSeals>=7)return false;const req=[3e6,3.7e6,4.4e6,5.1e6,5.8e6,6.5e6,8e6][s.dimensionSeals];if(total(s)<req)return false;s.dimensionSeals++;if(s.dimensionSeals===7)s.unlocked[16]=true;}
 else{if(!MINES[id]||MINES[id].access!=='seal'||total(s)<sealRequirement(s,id))return false;s.unlocked[id]=true;}
 s.stats.seals++;return true;
}
function itemCost(s,id){const i=ITEMS.find(x=>x.id===id);if(!i)return Infinity;return Math.ceil(i.cost*Math.pow(i.max===1?1:1.15,s.items[id]||0));}
function buyItem(s,id){const i=ITEMS.find(x=>x.id===id);if(!i||i.max&&s.items[id]>=i.max)return false;if(id==='spirit'&&!s.stats.rebirths||id==='fragmentPack'&&!s.pickaxe.repaired||id==='coat'&&s.items.coat>=Math.floor((bonus(s)*3+1)/100))return false;const price=itemCost(s,id);if(s[i.currency]<price)return false;s[i.currency]-=price;if(id==='fragmentPack')s.shards+=50;else s.items[id]++;return true;}
function suitAvailable(id,now=Date.now()){const d=new Date(new Date(now).toLocaleString('en-US',{timeZone:'Asia/Seoul'})),m=d.getMonth()+1;return id==='beach'?m>=6&&m<=8:id==='santa'?[12,1,2].includes(m):id==='valentine'?d.getDate()===14:true;}
function suit(s,id,now=Date.now()){const v=SUITS.find(x=>x.id===id);if(!v)return false;if(!s.owned.includes(id)){if(!suitAvailable(id,now)||s[v.currency]<v.cost)return false;s[v.currency]-=v.cost;s.owned.push(id);}s.suit=id;return true;}
function relicCost(s,id){const bases={power:3,fortune:3,vault:4};return id in bases?Math.ceil(bases[id]*Math.pow(1.45,s.relics[id])):Infinity;}
function buyRelic(s,id){if(!(id in s.relics)||s.relics[id]>=100)return false;const p=relicCost(s,id);if(s.souls<p)return false;s.souls-=p;s.relics[id]++;return true;}
function rebirthReward(s){return Math.max(1,Math.floor(Math.sqrt(s.runEarned/9000))+s.stats.runBosses*3+Math.floor(baseTotal(s)*.08))*(1+Math.min(20,s.items.rebirthBook,s.rebirthUse)*.05);}
function canRebirth(s){return baseTotal(s)>=Math.max(90,s.engraveCount?bonus(s)*1.5:90);}
function rebirth(s){if(!canRebirth(s))return 0;const n=Math.floor(rebirthReward(s));s.souls+=n;s.items.rebirthBook-=Math.min(20,s.items.rebirthBook,s.rebirthUse);s.stats.rebirths++;s.gold=0;s.runEarned=0;s.stats.runBosses=0;s.levels={speed:0,power:0,skill:0};if(!s.items.identity){s.items.shoes=0;s.items.lantern=0;}s.world=null;return n;}
function useBook(s,id,now=Date.now()){if(id!=='boostBook'||s.items[id]<1)return false;s.items[id]--;s.boostUntil=Math.max(now,s.boostUntil)+300000;return true;}
function dayKey(now=Date.now()){return new Date(now+9*3600000).toISOString().slice(0,10);}
function dailyIndex(now=Date.now()){return Math.floor((now+9*3600000)/86400000)%D.DAILY.length;}
function refreshDay(s,now=Date.now()){const day=dayKey(now);if(s.daily.day!==day)s.daily={day,claimed:false,completed:false,best:0};}
function claimDaily(s,now=Date.now()){refreshDay(s,now);if(s.daily.claimed)return false;s.daily.claimed=true;s.catalysts+=3;s.souls+=10;return true;}
function finishDaily(s,score,now=Date.now()){refreshDay(s,now);s.daily.best=Math.max(s.daily.best,score);if(s.daily.completed)return false;s.daily.completed=true;s.catalysts+=5;s.souls+=30;return true;}
function offline(s,now=Date.now()){const seconds=Math.min(Math.max(0,(now-s.lastSeen)/1000),(2+s.relics.vault+s.items.vault)*3600);s.lastSeen=now;return seconds>=60?Math.floor(s.rate*.25*seconds*(s.secret.completed?2:1)):0;}
function bossReward(s,mineId,name){
 const m=MINES[mineId],b=BOSSES.find(x=>x.name===name);const gold=Math.floor(Math.max(1400,Math.pow(Math.max(1,m.unlock),1.12)*30,m.fee*.8)*multiplier(s)*(s.items.sage?1.5:1));credit(s,gold);
 s.souls+=3+m.rank*3;s.stats.bosses++;s.stats.runBosses++;s.mineKills[mineId]++;if(b)s.bossKills[b.id]++;
 if(mineId<14)s.marks[mineId]=Math.min(5,s.marks[mineId]+1);
 if(s.stats.bosses%3===0)s.catalysts++;if(name==='광부')s.shards+=6;return gold;
}
function trialReward(s,id,floor){const t=TRIALS.find(t=>t.id===id);if(!t)return 0;const n=Math.max(0,Math.min(t.floors,floor));s.trialMarks[id]=Math.min(5,Math.max(s.trialMarks[id]||0,n));s.stats.trials++;s.souls+=n*(t.hard?8:4);return n;}
function skyDoors(s){return[s.stats.stone>=300000000,(s.items.keys||0)>=7,s.bossKills[BOSSES.findIndex(b=>b.name==='시간 수확자')]>=50];}
function openSky(s){if(!skyDoors(s).every(Boolean))return false;s.items.keys-=7;s.infiniteKeys++;s.unlocked[15]=true;return true;}
function canEngrave(s){return s.temple.completed;}
function engrave(s){
 if(!canEngrave(s))return 0;const n=Math.max(1,Math.min(500,ITEMS.filter(i=>i.currency==='souls').reduce((v,i)=>v+(s.items[i.id]||0),0)+Object.values(s.relics).reduce((a,b)=>a+b,0)+s.owned.length-1));s.engraving+=n;s.engraveCount++;s.awakened=true;s.gold=0;s.souls=0;s.runEarned=0;s.stats.runBosses=0;s.levels={speed:0,power:0,skill:0};s.relics={power:0,fortune:0,vault:0};
 for(const i of ITEMS)if(['gold','souls'].includes(i.currency))s.items[i.id]=0;
 s.owned=['miner'];s.suit='miner';s.dimensionSeals=0;s.unlocked[16]=false;s.temple.completed=false;s.temple.unlocked=false;s.world=null;return n;
}
function rollOptions(s,random=Math.random){const n=s.items.helmet?4:3,old=s.pickaxe.options,options=[];for(let i=0;i<n;i++){if(i===s.pickaxe.locked&&old[i])options.push({...old[i]});else{const o=OPTIONS[Math.floor(random()*OPTIONS.length)];options.push({id:o.id,value:o.id==='value'?Math.round((.1+random()*1.9)*100)/100:o.value,ore:Math.floor(random()*66)});}}return options;}
function repairPick(s){if(!s.pickaxe.found||s.pickaxe.repaired||s.shards<50)return false;s.shards-=50;s.pickaxe.repaired=true;s.pickaxe.options=rollOptions(s);return true;}
function reroll(s){const price=s.items.helmet&&s.pickaxe.locked>=0?10:5;if(!s.pickaxe.repaired||s.shards<price)return false;s.shards-=price;s.pickaxe.options=rollOptions(s);return true;}
function swapRecord(s){if(!s.items.record||!s.pickaxe.repaired||s.shards<5)return false;s.shards-=5;const old=s.pickaxe.options;s.pickaxe.options=s.pickaxe.saved.length?s.pickaxe.saved:rollOptions(s);s.pickaxe.saved=old;s.pickaxe.locked=-1;return true;}
function compress(s){if(baseTotal(s)<MAX_LEVEL*3)return false;const fraction=Math.min(.95,.5+s.compression*.1);for(const k of Object.keys(s.levels))s.levels[k]=Math.floor(s.levels[k]*(1-fraction));s.compression++;return true;}
const RELICS=[{id:'power',name:'단단한 곡괭이',desc:'영구 채굴 위력 +15%'},{id:'fortune',name:'빛나는 주머니',desc:'영구 채굴 수익 +12%'},{id:'vault',name:'오프라인 금고',desc:'보관 시간 +1시간'}];
const ACHIEVEMENTS=[
...[10,100,500,2000,10000,1000000,300000000].map((n,i)=>({id:'mine'+n,name:['첫 곡괭이질','광부의 손끝','보석 사냥꾼','갱도의 주인','산을 옮기는 사람','백만 번의 발견','대지의 개척자'][i],desc:'광물 '+n.toLocaleString()+'회 채굴',goal:n,type:'mined',reward:(i+1)*2})),
...[1,5,20,100,500].map((n,i)=>({id:'boss'+n,name:['첫 수호자','다섯 번의 승리','수호자 추적자','거인의 천적','보스 사냥의 전설'][i],desc:'보스 '+n+'회 처치',goal:n,type:'bosses',reward:(i+1)*4})),
...[30,90,200,3000,120000,6000000000].map((n,i)=>({id:'level'+n,name:['성장의 시작','다시 떠날 준비','숙련된 탐험가','천의 경지','차원 너머의 힘','끝없는 성장'][i],desc:'기본 능력치 합계 '+n.toLocaleString(),goal:n,type:'level',reward:(i+1)*3})),
{id:'book',name:'보석 백과사전',desc:'기본 광물 66종 모두 발견',goal:66,type:'book',reward:200},{id:'rebirth',name:'두 번째 삶',desc:'첫 환생 완료',goal:1,type:'rebirths',reward:5},{id:'dash',name:'바람보다 빠르게',desc:'돌진 20회 사용',goal:20,type:'dashes',reward:3},
{id:'suits',name:'코스튬 마스터',desc:'코스튬 5개 보유',goal:5,type:'suits',reward:30},{id:'dragon',name:'드래곤 슬레이어',desc:'다크 드래곤 처치',goal:1,type:'dragon',reward:50},{id:'trial',name:'시련을 넘어서',desc:'시련 7종 도전',goal:7,type:'trials',reward:80},{id:'engrave',name:'각인의 깨달음',desc:'첫 각인 완료',goal:1,type:'engrave',reward:100},{id:'pick',name:'차원을 여는 곡괭이',desc:'차원의 곡괭이 수리',goal:1,type:'pick',reward:150},{id:'secret',name:'숨겨진 진실',desc:'전자광산 비밀의 방 발견',goal:1,type:'secret',reward:100},{id:'fortune',name:'9,000의 행운',desc:'누적 9,000 G 획득',goal:9000,type:'earned',reward:5}
];
function progress(s,a){return a.type==='level'?baseTotal(s):a.type==='book'?s.seen.slice(0,66).filter(x=>x>0).length:a.type==='suits'?s.owned.length:a.type==='dragon'?s.bossKills[BOSSES.findIndex(b=>b.name==='다크 드래곤')]:a.type==='engrave'?s.engraveCount:a.type==='pick'?Number(s.pickaxe.repaired):a.type==='secret'?Number(s.secret.completed):a.type==='earned'?s.earned:a.type==='trials'?Object.keys(s.trialMarks).filter(k=>s.trialMarks[k]>0).length:s.stats[a.type]||0;}
function claim(s,id){const a=ACHIEVEMENTS.find(x=>x.id===id);if(!a||s.claimed.includes(id)||progress(s,a)<a.goal)return 0;s.claimed.push(id);s.souls+=a.reward;return a.reward;}
function format(n){if(!Number.isFinite(n))return'0';if(n<1000)return Math.floor(n).toLocaleString('ko-KR');for(const[v,u]of [[1e24,'자'],[1e20,'해'],[1e16,'경'],[1e12,'조'],[1e8,'억'],[1e4,'만'],[1e3,'천']])if(n>=v)return(n/v).toFixed(n/v>=100?0:1).replace(/\.0$/,'')+u;return'0';}
return{...D,VERSION,MAX_LEVEL,RELICS,ACHIEVEMENTS,fresh,normalize,baseTotal,bonus,bookBonus,tier,option,level,total,damage,interval,multiplier,maxHealth,cost,costTotal,upgrade,credit,reward,sealRequirement,canEnter,enter,unseal,itemCost,buyItem,suitAvailable,suit,relicCost,buyRelic,canRebirth,rebirthReward,rebirth,useBook,dayKey,dailyIndex,refreshDay,claimDaily,finishDaily,offline,bossReward,trialReward,skyDoors,openSky,canEngrave,engrave,repairPick,reroll,swapRecord,compress,progress,claim,format};
});
