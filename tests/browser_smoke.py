"""End-to-end checks against the actual offline game page, using deterministic save fixtures."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
import threading, json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
out=root/'test-results';out.mkdir(exist_ok=True)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root/'app/src/main/assets/game')))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_address[1]}'
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':412,'height':892},device_scale_factor=2,is_mobile=True,has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def seed(fixture):
  page.evaluate('MW.suspend()')
  page.evaluate('''fixture=>{const s=Object.assign(MineCore.fresh(),fixture);s.tutorial=true;localStorage.setItem('mineworld.save.v1',JSON.stringify(s));}''',fixture)
  page.reload();page.wait_for_timeout(200)
 def click_node(kind=None,ore=None):
  found=page.evaluate('''q=>{const s=MW.getState(),v=MW.getView(),n=s.world.nodes.find(n=>(!q.kind||n.kind===q.kind)&&(q.ore===null||n.id===q.ore));if(!n)return false;const el=document.querySelector('#game'),r=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+(n.x-v.cam.x)*v.zoom,clientY:r.top+(n.y-v.cam.y)*v.zoom,bubbles:true}));return true;}''',{'kind':kind,'ore':ore})
  assert found,(kind,ore)
 def state():return page.evaluate('MW.getState()')
 def close():page.locator('#close-modal').click()
 def route(name):page.locator(f'[data-action=route][data-id={name}]').click()
 def solve_puzzle():
  puzzle=state()['world']['puzzle']
  for goal in puzzle['goals']:
   pos=state()['world']['puzzle']['player']
   while pos['y']!=4:
    move='up' if pos['y']>4 else 'down';page.locator(f'[data-action=puzzle-move][data-id={move}]').click();pos=state()['world']['puzzle']['player']
   while pos['x']!=goal['x']:
    move='right' if pos['x']<goal['x'] else 'left';page.locator(f'[data-action=puzzle-move][data-id={move}]').click();pos=state()['world']['puzzle']['player']
   for _ in range(2):page.locator('[data-action=puzzle-move][data-id=up]').click()
 try:
  page.goto(url);page.get_by_role('button',name='원정 시작하기').click();page.wait_for_timeout(300)
  page.screenshot(path=str(out/'01-first-play.png'))
  click_node(ore=1);page.wait_for_timeout(3300);assert state()['stats']['mined']>=1
  page.locator('[data-upgrade=power]').click();page.evaluate('MW.suspend()');before=state();page.reload();page.wait_for_timeout(200);after=state();assert before['levels']==after['levels'];assert before['gold']==after['gold'];assert before['world']['nodes']==after['world']['nodes']
  page.locator('#map-button').click();assert page.locator('.mine-card').count()==20;route('trials');assert page.locator('[data-action=trial]').count()==7;route('daily');page.locator('[data-action=daily-claim]').click();assert state()['catalysts']==3;page.screenshot(path=str(out/'02-expeditions.png'));close()
  page.locator('[data-tab=book]').click();assert page.locator('.ore-card').count()==79;page.screenshot(path=str(out/'03-book.png'));route('marks');route('records');close()
  page.locator('[data-tab=shop]').click();route('suits');assert page.locator('[data-action=suit]').count()==17;page.screenshot(path=str(out/'04-suits.png'));route('skillsShop');assert page.locator('[data-action=item]').count()==7;close()
  # Six life crystals kill a boss and pay the reward once.
  seed({'levels':{'speed':35,'power':35,'skill':35},'souls':1500,'world':{'biome':0,'floor':5,'mode':'mine','player':{'x':180,'y':215,'hp':100},'nodes':[{'id':8,'kind':'life','x':220,'y':220,'hp':45,'max':45,'remaining':1} for _ in range(6)]}})
  assert page.locator('#boss-health').is_visible()
  for _ in range(6):click_node('life');page.wait_for_timeout(350)
  assert state()['stats']['bosses']==1;assert state()['world']['cleared'];page.screenshot(path=str(out/'05-boss-won.png'))
  page.locator('[data-tab=shop]').click();route('suits');page.locator('[data-action=suit][data-id=warden]').click();assert state()['suit']=='warden';close()
  page.locator('[data-tab=rebirth]').click();page.locator('[data-action=rebirth-check]').click();page.locator('[data-action=rebirth]').click();assert state()['stats']['rebirths']==1;assert sum(state()['levels'].values())==0;assert state()['suit']=='warden'
  print('PASS base mining, menus, saves, daily claim, boss, outfit and rebirth',flush=True)
  # Physical seal transitions into an unlocked biome.
  seed({'levels':{'speed':1500,'power':1500,'skill':0},'world':{'biome':4,'floor':1,'mode':'seal','player':{'x':610,'y':500,'hp':100}}})
  click_node('seal');page.wait_for_timeout(600);assert state()['unlocked'][4];assert state()['world']['mode']=='mine'
  # Interactive Sokoban puzzle grants a real dark matter vein.
  seed({'world':{'biome':3,'floor':1,'mode':'mine','player':{'x':180,'y':215,'hp':100},'nodes':[{'id':0,'kind':'puzzle','x':220,'y':220,'hp':1,'max':1,'remaining':1}]}})
  click_node('puzzle');page.wait_for_timeout(300);assert page.locator('.puzzle-cell').count()==49;page.screenshot(path=str(out/'06-puzzle.png'));solve_puzzle();assert state()['stats']['puzzles']==1;assert any(n['id']==17 for n in state()['world']['nodes'])
  # Four colored switches produce a relic chest, not just an information dialog.
  seed({'world':{'biome':10,'floor':1,'mode':'mine','player':{'x':180,'y':215,'hp':100},'nodes':[{'id':0,'kind':'switch','x':x,'y':y,'hp':1,'max':1,'remaining':1,'colorIndex':0} for x,y in [(220,220),(195,240),(155,225),(180,185)]]}})
  # Select four distinct switches by their current color through real pointer events.
  for _ in range(4):
   page.evaluate('''()=>{const s=MW.getState(),v=MW.getView(),n=s.world.nodes.find(n=>n.kind==='switch'&&n.colorIndex===0),el=document.querySelector('#game'),r=el.getBoundingClientRect();if(n)el.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+(n.x-v.cam.x)*v.zoom,clientY:r.top+(n.y-v.cam.y)*v.zoom,bubbles:true}));}''')
   page.wait_for_timeout(150)
  assert state()['stats']['puzzles']==1;assert any(n['id']==46 for n in state()['world']['nodes'])
  # Verify electronic riddle through its real answer buttons.
  seed({'world':{'biome':14,'floor':1,'mode':'mine','player':{'x':180,'y':215,'hp':100},'nodes':[{'id':0,'kind':'cipher','x':220,'y':220,'hp':1,'max':1,'remaining':1}]}})
  click_node('cipher');page.wait_for_timeout(250);assert page.locator('.binary-code').inner_text()=='1000';page.locator('[data-action=cipher-answer][data-id="8"]').click();assert state()['items']['keys']==1;assert not any(n['kind']=='cipher' for n in state()['world']['nodes'])
  print('PASS seal, Sokoban reward and binary cipher',flush=True)
  # Pickaxe is repairable, rerollable, and can preserve an explicitly locked effect.
  seed({'shards':100,'engraving':300,'pickaxe':{'found':True,'repaired':False,'options':[],'saved':[],'locked':-1}})
  page.locator('#inventory').click();route('forge');page.locator('[data-action=repair]').click();assert state()['pickaxe']['repaired'];assert state()['shards']==50
  page.locator('[data-action=item][data-id=helmet]').click();page.locator('[data-action=reroll]').click();assert len(state()['pickaxe']['options'])==4;page.locator('[data-action=lock-option][data-id="0"]').click();old=state()['pickaxe']['options'][0];page.locator('[data-action=reroll]').click();assert state()['pickaxe']['options'][0]==old;assert state()['shards']==35;page.screenshot(path=str(out/'07-forge.png'));close()
  # Five-block temple, physical escape, and explicit engraving confirmation.
  seed({'levels':{'speed':90,'power':90,'skill':90},'temple':{'unlocked':True,'completed':False},'items':{'lucky':1},'world':{'biome':0,'floor':1,'mode':'temple','templeStage':'puzzle','player':{'x':180,'y':215,'hp':100},'nodes':[{'id':0,'kind':'altar','x':220,'y':220,'hp':1,'max':1,'remaining':1}]}})
  click_node('altar');page.wait_for_timeout(250);solve_puzzle();assert state()['world']['templeStage']=='escape'
  page.locator('#descend').click();page.wait_for_timeout(5100);page.locator('#descend').click();assert state()['temple']['completed'];page.locator('[data-action=engrave-check]').click();page.locator('[data-action=engrave]').click();assert state()['engraveCount']==1;assert state()['items']['lucky']==0;assert state()['engraving']>=1
  print('PASS equipment and complete temple engraving flow',flush=True)
  # Hard-trial entry does not overwrite the player's actual progression; all seven routes load.
  for trial in ['speed','speedHard','power','powerHard','power2','power2Hard','tech']:
   seed({'levels':{'speed':10000,'power':11000,'skill':12000},'gold':50000})
   page.locator('#map-button').click();route('trials');page.locator(f'[data-action=trial][data-id={trial}]').click();page.wait_for_timeout(150);assert state()['world']['trial']==trial;assert state()['levels']['power']==11000
   if trial=='speedHard':assert len(state()['world']['obstacles'])>0;page.screenshot(path=str(out/'08-hard-maze.png'))
   page.evaluate('MW.suspend()');page.reload();page.wait_for_timeout(150);assert state()['world']['trial']==trial
  # Each distinct AI pattern executes and renders without an exception.
  bosses=page.evaluate('MineCore.BOSSES')
  for boss in bosses:
   seed({'world':{'biome':0,'floor':5,'mode':'mine','player':{'x':180,'y':215,'hp':100},'boss':{'name':boss['name'],'timer':0.5,'hp':440,'x':640,'y':400}}})
   page.wait_for_timeout(650)
  print('PASS all seven trial routes and 33 boss patterns',flush=True)
  # Backup export and invalid import fail without touching progress.
  page.locator('#settings').click();page.locator('[data-action=export]').click();assert json.loads(page.locator('#save-code').input_value())['version']==2;page.locator('#save-code').fill('invalid');page.locator('[data-action=import-check]').click();assert '올바른' in page.locator('#save-status').inner_text();close()
  page.set_viewport_size({'width':360,'height':640});page.wait_for_timeout(250);page.screenshot(path=str(out/'09-small-screen.png'));assert page.locator('#game').bounding_box()['height']>=180;nav=page.locator('nav').bounding_box();assert nav['y']+nav['height']<=641
  assert not errors,errors
  print('PASS no JavaScript errors; mobile layout and backup validation',flush=True)
 except Exception:
  page.screenshot(path=str(out/'FAILURE.png'));print('JS ERRORS',errors,flush=True);print('STATE',json.dumps(state(),ensure_ascii=False)[:5000],flush=True);raise
 finally:b.close();server.shutdown()
