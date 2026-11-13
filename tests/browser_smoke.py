from playwright.sync_api import sync_playwright
from pathlib import Path
import os, subprocess, sys, time, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
import json
root=Path(__file__).resolve().parents[1]
out=root/'test-results';out.mkdir(exist_ok=True)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root/'app/src/main/assets/game')))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_address[1]}'
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':412,'height':892},device_scale_factor=2,is_mobile=True,has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(url);page.get_by_role('button',name='첫 탐험 시작하기').click();page.wait_for_timeout(500)
 page.screenshot(path=str(out/'01-first-play.png'))
 print('canvas',page.locator('#game').bounding_box())
 
 # Click the guaranteed copper vein using camera inferred from the starting pose.
 page.evaluate('''() => {const s=MW.getState();const n=s.world.nodes.find(n=>n.id===0&&n.x===260);const el=document.querySelector('#game');const r=el.getBoundingClientRect();const zoom=1.18;const camX=Math.max(0,180-r.width/zoom/2),camY=Math.max(0,180-r.height/zoom/2);el.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+(n.x-camX)*zoom,clientY:r.top+(n.y-camY)*zoom,bubbles:true}));}''')
 page.wait_for_timeout(5500)
 s=page.evaluate('MW.getState()');assert s['stats']['mined']>=1,s['stats'];assert s['gold']>0
 page.get_by_role('button',name='속도').click();page.wait_for_timeout(100)
 page.evaluate('MW.suspend()');before=page.evaluate('MW.getState()');page.reload();page.wait_for_timeout(500);after=page.evaluate('MW.getState()');assert before['levels']==after['levels'];assert before['gold']==after['gold'];assert before['world']['nodes']==after['world']['nodes']
 for tab,title in [('book','광물 도감'),('shop','다음 탐험을 더 강하게'),('achievements','작은 발견, 커다란 기록'),('rebirth','더 강하게, 다시 시작')]:
  page.locator('[data-tab='+tab+']').click();assert page.locator('#modal-title').inner_text()==title;page.screenshot(path=str(out/('tab-'+tab+'.png')));page.locator('#close-modal').click()
 page.locator('#settings').click();page.get_by_role('button',name='내보내기',exact=True).click();assert len(page.locator('#save-code').input_value())>100
 page.locator('#save-code').fill('invalid');page.get_by_role('button',name='코드 복원',exact=True).click();assert '올바른' in page.locator('#save-status').inner_text();page.locator('#close-modal').click()
 # Load a mid-game save to exercise boss and permanent progression through real UI.
 page.evaluate('MW.suspend()')
 page.evaluate('''() => {const s=MineCore.fresh();s.tutorial=true;s.levels={speed:35,power:35,skill:35};s.gold=25000;s.souls=100;s.unlocked=[true,true,false];s.world={biome:0,floor:5,player:{x:850,y:390,hp:100},nodes:Array.from({length:6},()=>({id:5,x:870,y:390,hp:45,remaining:1,life:true}))};localStorage.setItem('mineworld.save.v1',JSON.stringify(s));}''');page.reload();page.wait_for_timeout(700)
 assert page.locator('#boss-health').is_visible();page.screenshot(path=str(out/'02-boss.png'))
 page.locator('[data-tab=shop]').click();page.locator('[data-action=suit][data-id=warden]').click();assert page.evaluate('MW.getState().suit')=='warden';page.locator('#close-modal').click()
 # Defeat the boss by mining all six life crystals (no direct state mutation).
 for i in range(6):
  page.evaluate('''() => {const s=MW.getState();const el=document.querySelector('#game');const r=el.getBoundingClientRect();const camX=Math.max(0,s.world.player.x-r.width/1.18/2),camY=Math.max(0,s.world.player.y-r.height/1.18/2);el.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+(870-camX)*1.18,clientY:r.top+(390-camY)*1.18,bubbles:true}));}''')
  page.wait_for_timeout(350)
 assert page.evaluate('MW.getState().stats.bosses')==1
 assert not page.locator('#boss-health').is_visible()
 page.screenshot(path=str(out/'boss-defeated.png'))
 page.locator('[data-tab=rebirth]').click();page.locator('[data-action=rebirth-check]').click();page.locator('[data-action=rebirth]').click();assert page.evaluate('MW.getState().stats.rebirths')==1;assert page.evaluate('MineCore.total(MW.getState())')==0;assert page.evaluate('MW.getState().suit')=='warden'
 # On a short viewport every control must fit and the canvas must remain usable.
 page.set_viewport_size({'width':360,'height':640});page.wait_for_timeout(200);page.screenshot(path=str(out/'03-small-screen.png'))
 assert page.locator('#game').bounding_box()['height']>=180
 assert page.locator('nav').bounding_box()['y']+page.locator('nav').bounding_box()['height']<=641
 assert not errors,errors
 print('PASS: mining, upgrade, persistent world, four tabs, export/import validation, suit, boss entry, rebirth, short viewport; no JS errors')
 b.close()
server.shutdown()
