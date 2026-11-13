(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MineCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const VERSION = 1, MAX_LEVEL = 500;
  const MINES = [
    {name:'이끼빛 갱도', subtitle:'햇빛이 닿는 마지막 광산', color:'#78dcb2', floor:'#26392f', wall:'#14231e', unlock:0, scale:1, boss:'이끼바위 수호자'},
    {name:'서리 수정굴', subtitle:'깊은 얼음 속, 푸른 빛의 흔적', color:'#84d8ff', floor:'#293d4b', wall:'#162533', unlock:45, scale:6, boss:'수정 눈의 파수꾼'},
    {name:'잿불 심장부', subtitle:'산의 심장이 뛰는 곳', color:'#ffa776', floor:'#48312c', wall:'#2b1d22', unlock:120, scale:28, boss:'잿불 왕관 거인'}
  ];
  const names = ['구리','철','은','금','자수정','에메랄드','루비','다이아몬드','청금석','빙정석','아쿠아마린','서리 진주','푸른 사파이어','오로라 수정','별빛 오팔','영원의 얼음','유황','흑요석','홍옥','용암석','태양석','용의 비늘','불사조 결정','심장의 보석'];
  const colors = ['#c98b66','#a1acb2','#d6e6e1','#ffda77','#bfa1f5','#70edbb','#f2798c','#b2f5ff','#658fff','#b3e4ff','#64e0dc','#e0eefa','#6eabff','#baacff','#ffb6e2','#d0fffa','#e9db68','#b6a5c8','#ff7d7d','#f89954','#ffd28a','#d98ee0','#ffc1ab','#fff5ad'];
  const ORES = names.map((name,id) => ({id,name,color:colors[id],tier:id%8,biome:Math.floor(id/8),value:Math.round(8*Math.pow(1.72,id%8)*MINES[Math.floor(id/8)].scale),hardness:Math.round(12*Math.pow(1.4,id%8)*Math.pow(MINES[Math.floor(id/8)].scale,.7))}));
  const RELICS = [
    {id:'power', name:'단단한 곡괭이', desc:'영구 채굴 위력 +15%', base:3},
    {id:'fortune', name:'빛나는 주머니', desc:'영구 채굴 수익 +12%', base:3},
    {id:'vault', name:'자동 금고', desc:'오프라인 보관 시간 +1시간', base:4}
  ];
  const SUITS = [
    {id:'miner',name:'개척자',cost:0,desc:'이동과 채굴의 기본에 충실한 탐험가'},
    {id:'scout',name:'바람 길잡이',cost:12,desc:'이동속도 +35%, 채굴 사거리 +30%'},
    {id:'warden',name:'수정 수호자',cost:18,desc:'보스전 체력 +50%, 피격 무적시간 증가'},
    {id:'alchemist',name:'황금 연금술사',cost:24,desc:'채굴 수익 +25%, 이동속도 -10%'}
  ];
  const finite = (v,d=0,min=0,max=1e100) => Number.isFinite(v)?Math.max(min,Math.min(max,v)):d;
  const integer = (v,d=0,min=0,max=1e9) => Math.floor(finite(v,d,min,max));
  function fresh(now=Date.now()) {
    return {version:VERSION,gold:0,souls:0,earned:0,runEarned:0,levels:{speed:0,power:0,skill:0},relics:{power:0,fortune:0,vault:0},owned:['miner'],suit:'miner',unlocked:[true,false,false],seen:Array(24).fill(0),stats:{mined:0,bosses:0,rebirths:0,deepest:1,runBosses:0,dashes:0},claimed:[],settings:{sound:true,vibration:true,reduced:false,balance:false,buy:1},rate:0,lastSeen:now,world:null,tutorial:false};
  }
  function normalize(raw,now=Date.now()) {
    const s=fresh(now); if(!raw || typeof raw!=='object' || Array.isArray(raw))return s;
    for(const k of ['gold','souls','earned','runEarned'])s[k]=finite(raw[k]);
    for(const k of Object.keys(s.levels))s.levels[k]=integer(raw.levels?.[k],0,0,MAX_LEVEL);
    for(const k of Object.keys(s.relics))s.relics[k]=integer(raw.relics?.[k],0,0,100);
    for(const k of Object.keys(s.stats))s.stats[k]=integer(raw.stats?.[k],k==='deepest'?1:0);
    s.owned=SUITS.filter(x=>x.id==='miner'||(Array.isArray(raw.owned)&&raw.owned.includes(x.id))).map(x=>x.id);
    s.suit=s.owned.includes(raw.suit)?raw.suit:'miner';
    s.unlocked=MINES.map((_,i)=>i===0 || raw.unlocked?.[i]===true);
    s.seen=ORES.map((_,i)=>integer(raw.seen?.[i]));
    s.claimed=Array.isArray(raw.claimed)?raw.claimed.filter(v=>typeof v==='string').slice(0,100):[];
    for(const k of ['sound','vibration','reduced','balance'])if(typeof raw.settings?.[k]==='boolean')s.settings[k]=raw.settings[k];
    s.settings.buy=[1,10,1000].includes(raw.settings?.buy)?raw.settings.buy:1;
    s.rate=finite(raw.rate,0,0,1e15);s.lastSeen=finite(raw.lastSeen,now,0,now);
    s.tutorial=raw.tutorial===true;
    if(raw.world && typeof raw.world==='object')s.world=raw.world;
    return s;
  }
  function total(s){return s.levels.speed+s.levels.power+s.levels.skill;}
  function damage(s){return (8+s.levels.power*3.8)*(1+s.relics.power*.15);}
  function interval(s){return Math.max(.055,.72/(1+s.levels.speed*.08));}
  function multiplier(s){return (1+s.levels.skill*.12)*(1+s.relics.fortune*.12)*(s.suit==='alchemist'?1.25:1);}
  function cost(level){return Math.ceil(22*Math.pow(1.115,level));}
  function upgrade(s,key,count=s.settings.buy) {
    if(!Object.hasOwn(s.levels,key))return 0;
    let bought=0;
    for(let i=0;i<Math.min(1000,count);i++){
      const k=s.settings.balance?Object.keys(s.levels).reduce((a,b)=>s.levels[a]<=s.levels[b]?a:b):key;
      if(s.levels[k]>=MAX_LEVEL)break;
      const price=cost(s.levels[k]);if(s.gold<price)break;
      s.gold-=price;s.levels[k]++;bought++;
    }
    return bought;
  }
  function credit(s,amount){amount=finite(amount);s.gold=finite(s.gold+amount);s.earned=finite(s.earned+amount);s.runEarned=finite(s.runEarned+amount);}
  function reward(s,id,n=1){const ore=ORES[id];if(!ore)return 0;n=integer(n,1,0,10000);const value=Math.floor(ore.value*multiplier(s))*n;credit(s,value);s.seen[id]+=n;s.stats.mined+=n;return value;}
  function rebirthReward(s){return Math.max(1,Math.floor(Math.sqrt(s.runEarned/9000))+s.stats.runBosses*3);}
  function canRebirth(s){return total(s)>=90;}
  function rebirth(s){
    if(!canRebirth(s))return 0;
    const amount=rebirthReward(s);s.souls+=amount;s.stats.rebirths++;s.gold=0;s.runEarned=0;s.stats.runBosses=0;
    s.levels={speed:0,power:0,skill:0};s.world=null;return amount;
  }
  function relicCost(s,id){const r=RELICS.find(x=>x.id===id);return r?Math.ceil(r.base*Math.pow(1.45,s.relics[id])):Infinity;}
  function buyRelic(s,id){if(!RELICS.some(x=>x.id===id)||s.relics[id]>=100)return false;const price=relicCost(s,id);if(s.souls<price)return false;s.souls-=price;s.relics[id]++;return true;}
  function suit(s,id){const r=SUITS.find(x=>x.id===id);if(!r)return false;if(!s.owned.includes(id)){if(s.souls<r.cost)return false;s.souls-=r.cost;s.owned.push(id);}s.suit=id;return true;}
  function offline(s,now=Date.now()) {
    const seconds=Math.min(Math.max(0,(now-s.lastSeen)/1000),(2+s.relics.vault)*3600);
    s.lastSeen=now;
    // A fixed fraction of measured active earnings; no idle rewards before the first mining session.
    return seconds>=60?Math.floor(s.rate*.25*seconds):0;
  }
  const ACHIEVEMENTS = [
    ...[10,100,500,2000,10000].map((n,i)=>({id:'mine'+n,name:['첫 곡괭이질','광부의 손끝','보석 사냥꾼','갱도의 주인','산을 옮기는 사람'][i],desc:`광물 ${n.toLocaleString()}회 채굴`,goal:n,type:'mined',reward:(i+1)*2})),
    ...[1,5,20,100].map((n,i)=>({id:'boss'+n,name:['수호자와의 첫 만남','다섯 번의 승리','수호자 추적자','거인의 천적'][i],desc:`보스 ${n}회 처치`,goal:n,type:'bosses',reward:(i+1)*4})),
    ...[30,90,200].map((n,i)=>({id:'level'+n,name:['성장의 시작','다시 떠날 준비','숙련된 탐험가'][i],desc:`현재 능력치 합계 ${n}`,goal:n,type:'level',reward:(i+1)*3})),
    {id:'book',name:'보석 백과사전',desc:'광물 24종 모두 발견',goal:24,type:'book',reward:20},
    {id:'rebirth',name:'새로운 발걸음',desc:'첫 환생 완료',goal:1,type:'rebirths',reward:5},
    {id:'dash',name:'바람보다 빠르게',desc:'돌진 20회 사용',goal:20,type:'dashes',reward:3}
  ];
  function progress(s,a){return a.type==='level'?total(s):a.type==='book'?s.seen.filter(x=>x>0).length:s.stats[a.type]||0;}
  function claim(s,id){const a=ACHIEVEMENTS.find(x=>x.id===id);if(!a||s.claimed.includes(id)||progress(s,a)<a.goal)return 0;s.claimed.push(id);s.souls+=a.reward;return a.reward;}
  function format(n){if(n<1000)return Math.floor(n).toLocaleString('ko-KR');const units=[[1e24,'자'],[1e20,'해'],[1e16,'경'],[1e12,'조'],[1e8,'억'],[1e4,'만'],[1e3,'천']];for(const [v,u]of units)if(n>=v)return(n/v).toFixed(n/v>=100?0:1).replace(/\.0$/,'')+u;return'0';}
  return {VERSION,MAX_LEVEL,MINES,ORES,RELICS,SUITS,ACHIEVEMENTS,fresh,normalize,total,damage,interval,multiplier,cost,upgrade,credit,reward,rebirthReward,canRebirth,rebirth,relicCost,buyRelic,suit,offline,progress,claim,format};
});
