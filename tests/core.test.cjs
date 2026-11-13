const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../app/src/main/assets/game/core.js');
test('24 unique minerals across three biomes with increasing values and hardness',()=>{
  assert.equal(C.ORES.length,24);assert.equal(new Set(C.ORES.map(o=>o.name)).size,24);
  for(let b=0;b<3;b++){const ores=C.ORES.filter(o=>o.biome===b);assert.equal(ores.length,8);for(let i=1;i<8;i++){assert.ok(ores[i].value>ores[i-1].value);assert.ok(ores[i].hardness>ores[i-1].hardness);}}
});
test('mining credits exact earnings, run earnings and collection once',()=>{const s=C.fresh();const gold=C.reward(s,5,2);assert.equal(s.gold,C.ORES[5].value*2);assert.equal(s.earned,gold);assert.equal(s.runEarned,gold);assert.equal(s.seen[5],2);assert.equal(s.stats.mined,2);});
test('bulk purchases equal sequential purchases and never overdraft',()=>{
  const a=C.fresh(),b=C.fresh();a.gold=b.gold=5000;const n=C.upgrade(a,'power',1000);let m=0;while(C.upgrade(b,'power',1))m++;assert.equal(n,m);assert.deepEqual(a.levels,b.levels);assert.equal(a.gold,b.gold);assert.ok(a.gold>=0);
});
test('balanced max purchase keeps all levels within one and honors 500 cap',()=>{const s=C.fresh();s.gold=1e50;s.settings.balance=true;C.upgrade(s,'power',1000);C.upgrade(s,'power',1000);assert.equal(C.total(s),1500);assert.deepEqual(s.levels,{speed:500,power:500,skill:500});});
test('growth independently improves damage, interval, and payout',()=>{const s=C.fresh();const d=C.damage(s),i=C.interval(s),m=C.multiplier(s);s.levels.power=10;assert.ok(C.damage(s)>d);assert.equal(C.interval(s),i);s.levels.speed=10;assert.ok(C.interval(s)<i);s.levels.skill=10;assert.ok(C.multiplier(s)>m);});
test('rebirth gate prevents early resets and preserves permanent progress',()=>{
 const s=C.fresh();s.gold=100;assert.equal(C.rebirth(s),0);assert.equal(s.gold,100);
 s.levels={speed:30,power:30,skill:30};s.runEarned=81000;s.stats.runBosses=2;s.unlocked[1]=true;s.seen[4]=12;s.relics.power=3;s.owned.push('scout');s.suit='scout';s.claimed.push('mine10');s.world={floor:4};
 assert.equal(C.rebirth(s),9);assert.equal(s.gold,0);assert.equal(C.total(s),0);assert.equal(s.stats.runBosses,0);assert.equal(s.stats.rebirths,1);assert.equal(s.world,null);assert.ok(s.unlocked[1]);assert.equal(s.seen[4],12);assert.equal(s.relics.power,3);assert.equal(s.suit,'scout');assert.deepEqual(s.claimed,['mine10']);
});
test('offline rewards bounded by measured income, time cap, and cannot claim twice',()=>{
 const s=C.fresh(1000000);s.rate=80;assert.equal(C.offline(s,1000000+30*1000),0);s.lastSeen=1000000;assert.equal(C.offline(s,1000000+12*3600*1000),80*.25*2*3600);assert.equal(C.offline(s,s.lastSeen),0);s.lastSeen=1000000;s.relics.vault=1;assert.equal(C.offline(s,1000000+12*3600*1000),80*.25*3*3600);
});
test('clock moving backwards cannot produce offline gold',()=>{const s=C.fresh(50000);s.rate=100;assert.equal(C.offline(s,10000),0);});
test('normalization rejects nonfinite, negative, unknown and oversized fields',()=>{
 const s=C.normalize({gold:NaN,souls:-1,levels:{speed:Infinity,power:10000,skill:-50},suit:'unknown',owned:['unknown','scout'],seen:[-1,Infinity],settings:{buy:90000},relics:{power:9999}},1000);
 assert.equal(s.gold,0);assert.equal(s.souls,0);assert.equal(s.levels.speed,0);assert.equal(s.levels.power,500);assert.equal(s.levels.skill,0);assert.equal(s.suit,'miner');assert.deepEqual(s.owned,['miner','scout']);assert.equal(s.seen.length,24);assert.equal(s.seen[0],0);assert.equal(s.relics.power,100);assert.equal(s.settings.buy,1);
});
test('achievement rewards cannot be claimed early or twice',()=>{const s=C.fresh();assert.equal(C.claim(s,'mine10'),0);s.stats.mined=10;assert.equal(C.claim(s,'mine10'),2);assert.equal(C.claim(s,'mine10'),0);assert.equal(s.souls,2);});
test('shop purchases consume currency once and reject unavailable items',()=>{const s=C.fresh();assert.equal(C.buyRelic(s,'power'),false);s.souls=100;assert.ok(C.buyRelic(s,'power'));assert.equal(s.souls,97);assert.equal(s.relics.power,1);assert.ok(C.suit(s,'scout'));assert.equal(s.souls,85);assert.ok(C.suit(s,'miner'));assert.ok(C.suit(s,'scout'));assert.equal(s.souls,85);assert.equal(C.buyRelic(s,'unknown'),false);});
test('first progression is attainable without purchases',()=>{const s=C.fresh();for(let i=0;i<100;i++)C.reward(s,i%5);s.settings.balance=true;C.upgrade(s,'power',1000);assert.ok(C.total(s)>=30);assert.ok(s.gold>=0);});
