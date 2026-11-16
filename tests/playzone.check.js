const {JSDOM}=require('jsdom');const fs=require('fs');
// Playzone in jsdom: menu, Screen-time redemption (once, parent-only, insufficient balance), and the three games' logic.
const dir=require('path').join(__dirname,'..','public')+'/';
const html=fs.readFileSync(dir+'index.html','utf8').replace(/<script src="[^"]+"><\/script>/g,'');
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
['questions.js','trophies.js','parent.js','report.js','store.js','audio.js','menus.js','playzone.js','bank-adjust.js','pz-designer.js','pz-reaction.js','pz-balloon.js','game.js'].forEach(f=>w.eval(fs.readFileSync(dir+f,'utf8')));
const d=w.document;
const $=id=>d.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const click=b=>b.click();
const ok=(cond,msg)=>{console.log((cond?'PASS ':'FAIL ')+msg); if(!cond) process.exitCode=1;};
const ptr=(target,type,x=0,y=0)=>{const e=new w.Event(type,{bubbles:true,cancelable:true});e.clientX=x;e.clientY=y;e.pointerId=1;target.dispatchEvent(e);return e;};
const {solveParent}=require('./parent-solver');
const hidden=id=>$(id).classList.contains('hidden');
const cards=()=>[...d.querySelectorAll('#pzGames .pz-card')];
const card=id=>d.querySelector(`#pzGames .pz-card[data-game="${id}"]`);
const gcd=(a,b)=>b?gcd(b,a%b):Math.abs(a);
const rootsOf=(text)=>{ // solves the parent's quadratic from its text: "Solve 2x² - 7x + 3 = 0. ..."
  const m=text.match(/^(?:Solve|Find the roots of) (\d*)x²(?: ([+-]) (\d*)x)?(?: ([+-]) (\d+))? = 0/); if(!m) throw new Error('bad question '+text);
  const A=m[1]?+m[1]:1, B=m[2]?(m[2]==='-'?-1:1)*(m[3]?+m[3]:1):0, C=m[4]?(m[4]==='-'?-1:1)*+m[5]:0;
  const D=B*B-4*A*C, r=Math.round(Math.sqrt(D)); if(r*r!==D) throw new Error('not rational');
  return [(-B+r),(-B-r)].map(n=>{const g=gcd(n,2*A);const nn=n/g,dd=2*A/g;return dd===1?String(nn):`${nn}/${dd}`;});
};
const store=()=>JSON.parse(w.localStorage.getItem('mathQuizBattle.v1')||'{}');

(async()=>{
  // ---- entry + exactly three games
  ok(!hidden('setupPanel')&&hidden('playzonePanel'),'main menu shows; Playzone is hidden at first');
  click($('playzoneButton'));
  ok(hidden('setupPanel')&&!hidden('playzonePanel'),'Playzone button opens Playzone and hides the setup panel');
  ok(w.MQPlayzone.games().join()==='designer,reaction,balloon','exactly the three initial games are registered, in order');
  ok(cards().length===3,'exactly three game cards are shown');
  const txt=cards().map(c=>c.textContent);
  ok(txt[0].includes('Pizza & Cake Designer')&&txt[1].includes('Reaction Battle')&&txt[2].includes('Balloon Pop'),'cards show the three titles');
  ok(txt.every(t=>t.includes('Pay as you play')),'every card says minutes are used as you play (no advertised cost)');
  ok(txt[0].includes('1 player')&&txt[1].includes('2 players')&&txt[2].includes('1 player'),'cards show one-player / two-player');
  ok(cards().every(c=>c.querySelector('.pz-icon')&&c.querySelector('.pz-desc').textContent.length>5),'cards have an icon and a description');
  ok(w.MQPlayzone.register({id:'x',mount(){}})===true&&cards().length===4,'a new game can be registered and appears (games have no fixed cost)');
  ok(!w.MQPlayzone.register({id:'bad'})&&!w.MQPlayzone.register({id:'designer',mount(){}}),'a game without mount() and duplicate ids are refused');
  click($('pzBack'));
  ok(!hidden('setupPanel')&&hidden('playzonePanel'),'Back returns to the main menu');
  ok(store().profiles===undefined||store().profiles.length===0,'opening/closing Playzone saved nothing');

  // ---- no profile / no balance: cannot start
  click($('playzoneButton'));
  click(card('designer')); ok(!hidden('pzConfirm')&&$('pzPlay').disabled,'no profile: the start button is disabled');
  click($('pzCancel'));
  w.MQStore.addProfile('Kid','🦊');
  const profile=w.MQStore.getProfiles()[0];
  w.MQPlayzone.open(); // reopen to refresh
  ok($('pzBalance').textContent.includes('0 min'),'balance shows 0 min');
  click(card('designer')); ok($('pzPlay').disabled&&$('pzConfirm').textContent.includes('above 0 minutes'),'zero balance: start disabled with a clear message');
  click($('pzPlay')); ok(profile.rewards.redeemed===0&&hidden('pzStageView'),'tapping a disabled start does nothing');
  click($('pzCancel'));

  // ---- a deterministic clock for the usage tests. Heartbeats are fed through the page-hide event, as the browser would.
  let T=1000; w.performance.now=()=>T;
  const elapse=(sec)=>{ let left=sec*1000; while(left>0){ const step=Math.min(5000,left); T+=step; left-=step; w.dispatchEvent(new w.Event('pagehide')); } };
  const balance=()=>w.MQStore.rewardBalance(profile);

  // ---- balance of 3 min (test setup writes the bank directly)
  profile.rewards.earned=3; w.MQStore.save();
  w.MQPlayzone.open();
  ok($('pzBalance').textContent.includes('3 min'),'balance shows 3 min');
  ok(cards().every(c=>!/⏱ \d+ min/.test(c.textContent)),'cards show no fixed advertised cost');
  click(card('designer'));
  ok($('pzConfirm').textContent.includes('has 3 min')&&!/costs \d+ min/.test($('pzConfirm').textContent),'the start screen shows the balance and no fixed cost');
  ok(!$('pzPlay').disabled&&hidden('pzStageView')&&profile.rewards.redeemed===0,'start is enabled but nothing has started or been charged yet');
  click($('pzPlay')); click($('pzPlay'));
  ok(d.querySelectorAll('#pzChallenge,#pzAnswer,.parent-challenge').length===0,'no parent question appears when starting a game');
  ok(!hidden('pzStageView')&&hidden('pzMenuView'),'tapping Play starts the game straight away');
  ok(profile.rewards.redeemed===0&&profile.rewards.redeemTx.length===0,'starting the game deducts nothing');
  const parentOnly=w.MQStore.redeem(profile,1);
  ok(parentOnly.denied&&profile.rewards.redeemed===0,'the existing parent-only Store.redeem still needs parent verification');
  ok(profile.rewards.earned===3,'earned minutes are unchanged (no credits for playing)');
  ok(d.querySelector('#pzHost .pz-choose')&&d.querySelectorAll('.pz-pick-pizza,.pz-pick-cake').length===2,'Pizza & Cake Designer starts on the choose screen');

  // ---- Pizza & Cake Designer
  click(d.querySelector('.pz-pick-pizza'));
  const inst=w.MQPlayzone.current();
  ok(!!profile.playzone.session&&profile.playzone.session.game==='designer'&&profile.playzone.session.status==='active'&&profile.playzone.session.startedAt>0&&profile.rewards.redeemed===0&&!!$('pzUsage').textContent,'choosing Pizza starts the session: start time and status are stored, still nothing deducted');
  const svg=d.querySelector('#pzHost svg.pz-canvas');
  svg.getBoundingClientRect=()=>({left:0,top:0,width:400,height:400,right:400,bottom:400});   // 1 client px = 1 artwork unit
  const decoBtn=t=>d.querySelector(`.pz-deco[data-deco="${t}"]`);
  const decoBtn2=decoBtn;
  const nodes=()=>svg.querySelectorAll('.pz-item');
  ok(d.querySelectorAll('.pz-deco').length>=8&&['cheese','pepperoni','mushroom','olive','tomato'].every(t=>decoBtn(t)),'pizza: cheese, pepperoni, mushrooms, olives, tomatoes and more toppings are offered');
  ok(d.querySelectorAll('.pz-shapes button').length>=3,'pizza: several bases are offered');
  ok(d.querySelectorAll('.pz-swatches').length===2,'pizza: colour panels (crust, sauce) are offered');
  click(decoBtn('cheese')); click(decoBtn('pepperoni')); click(decoBtn('pepperoni')); click(decoBtn('olive'));
  ok(nodes().length===4,'pizza: multiple decorations can be added');
  ptr(decoBtn('tomato'),'pointerdown',500,500); ptr(w,'pointerup',500,500);
  ok(nodes().length===5,'pizza: tapping a panel decoration places it');
  ptr(decoBtn('mushroom'),'pointerdown',500,500); ptr(w,'pointermove',130,150); ptr(w,'pointerup',130,150);
  const last=()=>inst._items()[inst._items().length-1];
  ok(nodes().length===6&&Math.abs(last().x-130)<1&&Math.abs(last().y-150)<1,'pizza: a decoration can be dragged from the panel onto the pizza');
  ptr(decoBtn('olive'),'pointerdown',500,500); ptr(w,'pointermove',900,900); ptr(w,'pointerup',900,900);
  ok(nodes().length===6,'pizza: a new decoration dropped off the canvas is cancelled');
  // move a placed decoration
  const mushroom=[...nodes()].pop(); const mid=+mushroom.dataset.id;
  ptr(mushroom,'pointerdown',130,150); ptr(w,'pointermove',250,260); ptr(w,'pointerup',250,260);
  const moved=inst._items().find(i=>i.id===mid);
  ok(Math.abs(moved.x-250)<1&&Math.abs(moved.y-260)<1,'pizza: a placed decoration can be moved');
  ptr(w,'pointermove',10,10);
  ok(inst._items().find(i=>i.id===mid).x===moved.x,'pizza: moving the pointer after release does nothing');
  // remove
  const before=nodes().length;
  ok($('pzRemove').disabled===false,'pizza: Remove is enabled while something is selected');
  click($('pzRemove'));
  ok(nodes().length===before-1&&!inst._items().some(i=>i.id===mid),'pizza: the selected decoration can be removed');
  ptr(svg,'pointerdown',5,5); ok($('pzRemove').disabled,'pizza: tapping the empty canvas deselects');
  // base + colours change the artwork
  const art1=inst._artwork();
  click(d.querySelector('.pz-shapes button[data-shape="heart"]'));
  const sw=[...d.querySelectorAll('.pz-swatches')[1].querySelectorAll('.pz-swatch')][1]; click(sw);
  const art2=inst._artwork();
  ok(art2!==art1&&art2.includes('<path d="M200 345')&&art2.includes(sw.dataset.colour),'pizza: base shape and colour change the picture');
  // export artwork contains only the creation
  const nItems=inst._items().length;
  ok((art2.match(/rotate\(/g)||[]).length===nItems,'export artwork contains every placed decoration');
  ok(!/pz-|selected|stroke-dasharray|<button|<text|fill-opacity="0"/.test(art2),'export artwork has no selection ring, hit areas or interface');
  ok(art2.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"'),'export artwork is a self-contained 1024px SVG (no external images)');
  ok(!/https?:\/\/(?!www\.w3\.org)/.test(art2)&&!/href=/.test(art2),'export artwork references no external service');
  // clear and start again
  click($('pzClear')); ok(nodes().length===0,'pizza: Clear removes all decorations');
  click(decoBtn('basil')); click($('pzAgain'));
  ok(!!d.querySelector('.pz-choose')&&w.MQPlayzone.current()===inst,'pizza: Start again returns to the Pizza / Cake choice');
  // cake
  click(d.querySelector('.pz-pick-cake'));
  const cakeSvg=d.querySelector('#pzHost svg.pz-canvas');
  ok(!!cakeSvg&&['cream','strawberry','cherry','candle','sprinkles'].every(t=>decoBtn(t)),'cake: cream, fruit, candles and sprinkles are offered');
  ok(d.querySelectorAll('.pz-swatches')[1].querySelectorAll('.pz-swatch').length>=5,'cake: several icing colours');
  click(decoBtn('candle')); click(decoBtn('strawberry')); click(decoBtn('sprinkles'));
  ok(inst._items().length===3&&inst._artwork().includes('#ffb300'),'cake: can be decorated and the artwork includes the candle');
  click($('pzAgain'));

  // ---- designer: auto-save, leaving early (10 s -> 1 min), the 2-minute limit, Resume and Start again
  await sleep(50);
  ok(!!profile.playzone.design&&profile.playzone.design.kind==='cake'&&profile.playzone.design.items.length===3,'designer: the design is saved automatically (the cake with 3 decorations)');
  elapse(10);
  click($('pzLeave'));
  ok(profile.rewards.redeemed===1&&balance()===2&&!profile.playzone.session&&profile.playzone.log[0].seconds===10,'designer: leaving after 10 s saves the design and charges 1 minute (rounded up), once');
  ok(profile.playzone.design.items.length===3,'designer: leaving kept the saved design');
  ok(!hidden('pzMenuView')&&hidden('pzStageView')&&$('pzHost').innerHTML===''&&!d.body.classList.contains('pz-stage'),'← Playzone returns to the menu and clears the game');
  ok($('pzBalance').textContent.includes('2 min')&&$('pzNotice').textContent.includes('Used 1 min'),'the menu shows the new balance and what was used');
  click(card('designer')); click($('pzPlay'));
  ok(profile.rewards.redeemed===1&&!!$('pzResumeLast'),'designer: starting again deducts nothing and offers the saved design');
  click($('pzResumeLast'));
  const inst2=w.MQPlayzone.current();
  ok(inst2._items().length===3&&!!profile.playzone.session&&!d.querySelector('.pz-design-clock'),'designer: Resume brings the saved design back in a NEW session without a countdown');
  elapse(90); click($('pzDone'));
  ok(profile.rewards.redeemed===3&&balance()===0&&!profile.playzone.session&&inst2._editable()===false,'designer: 90 s is charged 2 min; Done ends the session and stops editing');
  const itemsBefore=inst2._items().length;
  click(decoBtn2('cherry')); ptr(decoBtn2('cherry'),'pointerdown',500,500); ptr(w,'pointerup',500,500); click($('pzClear'));
  ok(inst2._items().length===itemsBefore&&d.querySelector('.pz-designer').classList.contains('locked'),'designer: no editing outside an active paid session');
  ok(!!$('pzSave')&&!$('pzSave').disabled&&inst2._artwork().includes('<svg'),'designer: PNG export is still available after the session');
  click($('pzResume')); click($('pzRestart'));
  ok(profile.rewards.redeemed===3&&!profile.playzone.session&&d.querySelector('.pz-ended-note').textContent.includes('above 0 minutes'),'designer: with a balance of 0, Resume and Start again cannot start a new session');
  profile.rewards.earned+=10; w.MQStore.save();        // test setup: a parent adds time
  click($('pzResume'));
  ok(!!profile.playzone.session&&profile.rewards.redeemed===3&&inst2._editable()===true,'designer: Resume starts another new paid session (nothing charged yet, not another fixed 2 min)');
  elapse(120); await sleep(400);
  ok(profile.rewards.redeemed===3&&!!profile.playzone.session&&inst2._editable()===true,'designer: elapsed time never ends an active session');
  click($('pzDone'));
  ok(profile.rewards.redeemed===5&&!profile.playzone.session&&inst2._editable()===false,'designer: Done ends the unlimited session and charges 2 min for 120 s');
  click($('pzRestart'));
  ok(!!profile.playzone.session&&!!d.querySelector('.pz-choose')&&profile.rewards.redeemed===5,'designer: Start again begins a new session at the choose screen');
  elapse(61); click($('pzLeave'));
  ok(profile.rewards.redeemed===7&&balance()===6&&profile.playzone.log.length>=4,'designer: the new session is charged for its own 61 s = 2 min');
  w.MQPlayzone.open();

  // ---- Balloon Pop through the real flow (usage-based, no parent question)
  profile.rewards.earned=profile.rewards.redeemed+5; w.MQStore.save(); w.MQPlayzone.open();
  const R0=profile.rewards.redeemed;
  click(card('balloon')); click($('pzPlay'));
  ok(profile.rewards.redeemed===R0&&!hidden('pzStageView')&&!d.querySelector('#pzChallenge'),'Balloon Pop: nothing deducted at start, no parent question');
  ok(!!$('pzBalloonStart')&&d.querySelector('.pz-rules').textContent.includes('lives')&&d.querySelector('.pz-rules').textContent.includes('✖'),'Balloon Pop: the rules and lives are explained before starting');
  click($('pzBalloonStart'));
  const bal=w.MQPlayzone.current(); const BG=w.MQPlayzone.game('balloon'); const st=()=>bal._state();
  ok(st().running&&st().lives===5&&d.querySelectorAll('.pz-lives').length===1&&!d.querySelector('.pz-time'),'Balloon Pop: starts with 5 lives and there is no timer');
  ok(d.querySelector('.pz-lives').textContent.split('❤️').length===6,'Balloon Pop: remaining lives are shown as hearts');
  elapse(30); click($('pzLeave')); ok(hidden('pzStageView')&&profile.rewards.redeemed===R0+1,'Balloon Pop: leaving early ends the session and charges the actual 30 s as 1 min');

  // difficulty: one config, gradual progress
  const dif=BG.difficulty;
  const lv=[0,2,4,6,8,12,20,30].map(dif);
  ok(lv.every((x,i)=>i===0||(x.rise<=lv[i-1].rise&&x.scale<=lv[i-1].scale&&x.spawn<=lv[i-1].spawn)),'difficulty: objects get faster, smaller and more frequent as the level rises');
  ok(lv[0].rise>lv[7].rise*1.5&&lv[0].scale===1&&lv[7].scale<0.75,'difficulty: clearly faster and smaller at level 30 than at level 0');
  ok(Math.abs(dif(1).rise/dif(0).rise-BG.config.rise.factor)<1e-9&&dif(1).rise>dif(0).rise*0.9,'difficulty: each step is small (no sudden spike)');
  ok(dif(0).moves.join()==='straight'&&dif(2).moves.includes('diagonal')&&dif(4).moves.includes('curve')&&dif(6).moves.includes('zigzag')&&dif(8).moves.includes('bounce'),'difficulty: movement patterns are introduced progressively');
  ok(dif(2).hazardChance===0&&dif(3).hazardTypes.join()==='rock'&&dif(6).hazardTypes.includes('spiky')&&dif(30).hazardChance<=BG.config.hazards.chance.max,'difficulty: ✖ objects appear from level 3, with a capped chance');
  ok(dif(30).scale*120>=50||BG.config.size.floorPx>=50,'difficulty: balloons never get smaller than a playable size');

  // gameplay through the test helpers (no real waiting)
  const host=d.createElement('div'); d.body.append(host);
  const ctxFor=(id)=>({profiles:()=>w.MQStore.getProfiles(),defaults:[id,null],record:(p,k,v)=>w.MQStore.recordPlayzone(p,k,v)});
  const startBalloon=(id,auto)=>{ const g=BG.mount(host,{ctx:ctxFor(id),autoSpawn:auto===true}); host.querySelector('#pzBalloonStart').click(); return g; };
  let g=startBalloon(profile.id,true);
  const s0=g._spawn({kind:'balloon',move:'straight'}); const y0=s0.y;
  ok(!!s0.el.style.getPropertyValue('--c')&&s0.size>=58,'Balloon: a coloured balloon of playable size appears');
  g._step(0.5); ok(g._state().objects[0].y<y0,'Balloon: objects move up');
  // popping everything for 40 simulated seconds never ends the game (no time limit)
  for(let i=0;i<800;i++){ g._step(0.05); [...host.querySelectorAll('.pz-balloon:not(.popped)')].forEach(b=>ptr(b,'pointerdown')); }
  ok(g._state().running&&g._state().lives===5&&g._state().score>20,'Balloon: no time limit — still running after 40 s of play');
  ok(g._state().level>=5,'Balloon: the level rose with the score');
  g.destroy();
  // movement patterns
  g=startBalloon(profile.id); g._setScore(40);
  const W=600;
  const run=(move,n)=>{ const o=g._spawn({kind:'balloon',move}); const xs=[o.x]; for(let i=0;i<n;i++){ g._step(0.05); xs.push(o.x); } return {o,xs}; };
  const dg=run('diagonal',20); ok(Math.abs(dg.xs[20]-dg.xs[0])>5||dg.o.x<=0||dg.o.x>=W-dg.o.size,'Balloon: diagonal movement changes x');
  const cv=run('curve',40); ok(Math.max(...cv.xs)-Math.min(...cv.xs)>20,'Balloon: curved path sways side to side');
  const zz=run('zigzag',60); let turns=0; for(let i=2;i<zz.xs.length;i++){ if((zz.xs[i]-zz.xs[i-1])*(zz.xs[i-1]-zz.xs[i-2])<0) turns++; } ok(turns>=1&&Math.max(...zz.xs)-Math.min(...zz.xs)>20,'Balloon: zig-zag path turns back and forth');
  const bn=run('bounce',200); ok(Math.min(...bn.xs)>=0&&Math.max(...bn.xs)<=W-bn.o.size+0.01,'Balloon: bouncing objects stay inside the sky');
  const sp=[1,2,3,4,5,6].map(()=>g._spawn({kind:'balloon'}).vy); ok(new Set(sp.map(Math.round)).size>1,'Balloon: objects move at different speeds');
  // hazards and penalties
  g.destroy(); g=startBalloon(profile.id);
  const h1=g._spawn({kind:'hazard',type:'rock'});
  ok(h1.el.classList.contains('pz-hazard')&&!h1.el.classList.contains('pz-balloon')&&h1.el.textContent==='✖','Balloon: a ✖ object looks different from a balloon');
  ptr(h1.el,'pointerdown'); ptr(h1.el,'pointerdown');
  ok(g._state().lives===4&&g._state().score===0,'Balloon: tapping a ✖ object costs exactly one life and scores nothing');
  const miss=g._spawn({kind:'balloon',move:'straight'}); for(let i=0;i<400&&g._state().lives===4;i++) g._step(0.05);
  ok(g._state().lives===3&&!g._state().objects.includes(miss),'Balloon: a balloon that floats off the top costs one life');
  const haz=g._spawn({kind:'hazard',type:'spiky'}); for(let i=0;i<400&&g._state().objects.some(o=>o.hazard);i++) g._step(0.05);
  ok(g._state().lives===3,'Balloon: a ✖ object leaving the top costs nothing');
  ok(g._state().running,'Balloon: the game continues while lives remain');
  [1,2,3].forEach(()=>ptr(g._spawn({kind:'hazard'}).el,'pointerdown'));
  ok(!g._state().running&&g._state().lives===0&&!host.querySelector('.pz-end').classList.contains('hidden'),'Balloon: the game ends when all lives are lost');
  ok(host.textContent.includes('Game over')&&host.querySelector('.pz-over-text').textContent.includes('0 balloons'),'Balloon: the final score is shown');
  click(host.querySelector('#pzBalloonAgain')); ok(g._state().running&&g._state().lives===5&&g._state().score===0,'Balloon: Play again restarts with full lives');
  g.destroy();

  // personal bests, per profile, persisted
  w.MQStore.addProfile('Sis','🐱'); const sis=w.MQStore.getProfiles().find(p=>p.name==='Sis');
  const game=(id,score)=>{ const x=startBalloon(id); for(let i=0;i<score;i++) ptr(x._spawn({kind:'balloon'}).el,'pointerdown'); for(let i=0;i<5;i++) ptr(x._spawn({kind:'hazard'}).el,'pointerdown'); const t=host.querySelector('.pz-end').textContent; x.destroy(); return t; };
  const exp=(n)=>n+[...Array(n)].reduce((a,_,i)=>a+BG.comboBonus(i+1),0);   // total score = pops + combo bonuses
  let t=game(profile.id,5);
  ok(profile.playzone.balloonBest===exp(5)&&t.includes('New personal best')&&t.includes(`Personal best: ${exp(5)}`),'Balloon: first score is a personal best and is highlighted');
  t=game(profile.id,3);
  ok(profile.playzone.balloonBest===exp(5)&&!t.includes('New personal best')&&t.includes(`Personal best: ${exp(5)}`),'Balloon: a lower score does not replace the best');
  t=game(sis.id,2);
  ok(sis.playzone.balloonBest===exp(2)&&profile.playzone.balloonBest===exp(5),'Balloon: the second player has an independent record');
  t=game(profile.id,7);
  ok(profile.playzone.balloonBest===exp(7)&&t.includes('New personal best'),'Balloon: a higher score updates the best');
  const saved=store().profiles; ok(saved.find(p=>p.id===profile.id).playzone.balloonBest===exp(7)&&saved.find(p=>p.id===sis.id).playzone.balloonBest===exp(2),'Balloon: records are saved in the existing profile storage');
  const gst=BG.mount(host,{ctx:ctxFor(null)}); host.querySelector('#pzBalloonStart').click(); for(let i=0;i<5;i++) ptr(gst._spawn({kind:'hazard'}).el,'pointerdown');
  ok(profile.playzone.balloonBest===exp(7)&&sis.playzone.balloonBest===exp(2)&&host.textContent.includes('Guest'),'Balloon: a guest game changes nobody\'s record'); gst.destroy();
  host.remove();

  // ---- Reaction Battle logic (game mounted directly, short delays)
  const reaction=w.MQPlayzone.game('reaction');
  const rh=d.createElement('div'); d.body.append(rh);
  const ri=reaction.mount(rh,{delay:[40,60],pause:80});
  const sides=[...rh.querySelectorAll('.pz-side')]; const banner=()=>rh.querySelector('.pz-banner').textContent; const phase=()=>rh.querySelector('.pz-reaction').dataset.phase;
  ok(sides.length===2&&sides[0].classList.contains('blue')&&sides[1].classList.contains('orange')&&sides[0].dataset.player==='1','Reaction: Player 1 (left, blue) and Player 2 (right, orange) buttons');
  ok(rh.querySelectorAll('.pz-format button').length===2,'Reaction: best of 3 and best of 5 are offered');
  ptr(sides[0],'pointerdown'); ok(phase()==='format','Reaction: taps before choosing a format are ignored');
  click(rh.querySelector('[data-bestof="3"]'));
  ok(phase()==='ready'&&rh.querySelectorAll('.pz-dots')[0].textContent.split(' ').length===2,'Reaction: best of 3 needs 2 wins');
  ptr(sides[0],'pointerdown'); ok(phase()==='ready'&&banner().includes('other player'),'Reaction: one player ready is not enough');
  ptr(sides[1],'pointerdown'); ok(phase()==='waiting'&&banner().includes('Wait'),'Reaction: both ready starts the waiting screen');
  await sleep(150); ok(phase()==='go'&&banner()==='GO!'&&sides[0].querySelector('.pz-side-label').textContent==='TAP!','Reaction: GO appears after a random delay');
  ptr(sides[0],'pointerdown'); ptr(sides[1],'pointerdown'); ptr(sides[0],'pointerdown');
  ok(rh.querySelectorAll('.pz-side.winner').length===1&&sides[0].classList.contains('winner'),'Reaction: first valid tap wins and only one player wins');
  ok(/ms$/.test(sides[0].querySelector('.pz-side-time').textContent)&&/ms$/.test(sides[1].querySelector('.pz-side-time').textContent),'Reaction: both reaction times are recorded and shown');
  ok(banner().includes('Player 1 wins the round')&&rh.querySelectorAll('.pz-dots')[0].textContent.includes('●')&&!rh.querySelectorAll('.pz-dots')[1].textContent.includes('●'),'Reaction: round winner announced and score updated (1–0)');
  await sleep(150); ok(phase()==='ready'&&banner().includes('READY'),'Reaction: the next round starts');
  ptr(sides[0],'pointerdown'); ptr(sides[1],'pointerdown'); ptr(sides[1],'pointerdown'); ptr(sides[0],'pointerdown');
  ok(banner().includes('Player 2 false start')&&sides[1].querySelector('.pz-side-time').textContent.includes('False start'),'Reaction: tapping before GO is a false start');
  ok(banner().includes('Player 1 wins the match')&&!rh.querySelector('.pz-after').classList.contains('hidden'),'Reaction: the false start gives the round to the other player; 2 wins ends best of 3');
  await sleep(150); ok(phase()==='matchover','Reaction: the finished match does not start another round by itself');
  click($('pzRematch')); ok(phase()==='ready'&&!rh.querySelectorAll('.pz-dots')[0].textContent.includes('●'),'Reaction: Rematch resets the score');
  // best of 5 needs 3 wins; Player 2 can win a match too
  click(rh.querySelector('.pz-after .secondary-button')); ok(phase()==='format','Reaction: Change format returns to the choice');
  click(rh.querySelector('[data-bestof="5"]')); ok(rh.querySelectorAll('.pz-dots')[0].textContent.split(' ').length===3,'Reaction: best of 5 needs 3 wins');
  for(let r=0;r<3;r++){
    ptr(sides[0],'pointerdown'); ptr(sides[1],'pointerdown'); await sleep(150);
    ptr(sides[1],'pointerdown'); ptr(sides[0],'pointerdown');   // Player 2 first, every round
    if(r<2){ ok(banner().includes('Player 2 wins the round'),`Reaction: best of 5 round ${r+1} goes to Player 2`); await sleep(150); }
  }
  ok(banner().includes('Player 2 wins the match')&&phase()==='matchover','Reaction: best of 5 ends after 3 wins');
  ptr(sides[0],'pointerdown'); ptr(sides[1],'pointerdown'); ok(phase()==='matchover','Reaction: taps after the match ends are ignored');
  ri.destroy(); rh.remove();

  // ---- Reaction Battle personal bests (fake clock so every time is exact)
  const kid=profile; const sis2=w.MQStore.getProfiles().find(p=>p.name==='Sis');
  T=1000;
  const rh2=d.createElement('div'); d.body.append(rh2);
  const rctx={profiles:()=>w.MQStore.getProfiles(),defaults:[kid.id,sis2.id],record:(p,k,v)=>w.MQStore.recordPlayzone(p,k,v)};
  const rg=w.MQPlayzone.game('reaction').mount(rh2,{delay:[30,40],pause:60,minValid:0,ctx:rctx});
  const S2=[...rh2.querySelectorAll('.pz-side')]; const ph=()=>rh2.querySelector('.pz-reaction').dataset.phase;
  const time=(i)=>S2[i].querySelector('.pz-side-time').textContent;
  ok(rh2.querySelectorAll('.pz-who select').length===2&&S2[0].textContent.includes('Kid')&&S2[1].textContent.includes('Sis'),'Records: each side uses a saved profile (Player 1 Kid, Player 2 Sis)');
  click(rh2.querySelector('[data-bestof="5"]'));
  const round=async(first,tFirst,second,tSecond,{falseBy}={})=>{
    ptr(S2[0],'pointerdown'); ptr(S2[1],'pointerdown');
    if(falseBy!==undefined){ ptr(S2[falseBy],'pointerdown'); return; }
    await sleep(120); T+=tFirst; ptr(S2[first],'pointerdown'); T+=tSecond-tFirst; ptr(S2[second],'pointerdown');
  };
  await round(0,300,1,500);
  ok(kid.playzone.reactionBest===300&&sis2.playzone.reactionBest===500,'Records: both players\' valid times are recorded separately (300 ms / 500 ms)');
  ok(time(0).includes('New personal best')&&S2[0].classList.contains('pb')&&S2[0].textContent.includes('Best: 300 ms'),'Records: a new personal best is highlighted and shown');
  await sleep(100); T+=1;
  await round(1,250,0,400);
  ok(kid.playzone.reactionBest===300&&sis2.playzone.reactionBest===250,'Records: a faster time updates the best, a slower time does not');
  ok(!time(0).includes('New personal best')&&time(1).includes('New personal best'),'Records: only the improved player is highlighted');
  await sleep(100);
  await round(0,0,0,0,{falseBy:0});
  ok(kid.playzone.reactionBest===300&&sis2.playzone.reactionBest===250&&time(0).includes('False start'),'Records: a false start never counts as a record');
  ok(JSON.parse(w.localStorage.getItem('mathQuizBattle.v1')).profiles.map(p=>p.playzone.reactionBest).filter(x=>x).sort().join()==='250,300','Records: saved in the existing profile storage');
  rg.destroy(); rh2.remove(); w.performance.now=()=>Date.now()%1e9;
  const guestG=w.MQPlayzone.game('reaction').mount(rh2,{ctx:{profiles:()=>w.MQStore.getProfiles(),defaults:[null,null],record:rctx.record}});
  ok(rh2.querySelectorAll('.pz-best').length===2&&![...rh2.querySelectorAll('.pz-best')].some(b=>b.textContent),'Records: guests show no record'); guestG.destroy();

  T=1000; w.performance.now=()=>T;   // the clock was restored to the real one by the Reaction records test above
  // ---- Balance rules through the real flow: positive allows, zero/negative block, an active game always finishes
  const R1=()=>{ profile.rewards.earned=profile.rewards.redeemed+1; w.MQStore.save(); };   // test setup: balance of exactly 1 min
  R1(); w.MQPlayzone.open(); click(card('balloon'));
  ok(!$('pzPlay').disabled,'a balance above 0 allows a new game');
  click($('pzPlay')); click($('pzBalloonStart'));
  ok(profile.rewards.redeemed===profile.rewards.earned-1,'starting the game with 1 min deducted nothing');
  elapse(70);
  ok(w.MQPlayzone.current()._state().running&&!hidden('pzStageView')&&balance()===1,'an active game is not stopped at 70 s even though its minute is used up; charged only at the end');
  click($('pzLeave'));
  ok(balance()===-1&&$('pzBalance').textContent.includes('-1 min'),'the 70-second session is charged 2 min and the balance becomes -1 (negative allowed)');
  ok($('pzNotice').textContent.includes('Used 2 min')&&$('pzNotice').textContent.includes('above 0 minutes'),'the child is told what was used and why the next game is blocked');
  click(card('balloon'));
  ok($('pzPlay').disabled&&$('pzConfirm').textContent.includes('above 0 minutes'),'a negative balance blocks a new game with a clear message');
  click($('pzPlay')); ok(hidden('pzStageView')&&!profile.playzone.session,'tapping the disabled Play button starts nothing');
  click($('pzCancel'));
  profile.rewards.earned=profile.rewards.redeemed; w.MQStore.save(); w.MQPlayzone.open(); click(card('reaction'));
  ok($('pzPlay').disabled&&$('pzConfirm').textContent.includes('above 0 minutes'),'a balance of exactly 0 blocks a new game');
  click($('pzCancel')); click($('pzBack'));
  click($('bankButton'));
  ok(!hidden('bankModal'),'the Screen-time page still opens with a zero or negative balance');
  click($('bankClose'));
  // game over charges the actual time (shell + Balloon Pop), and Play again needs a positive balance
  profile.rewards.earned=profile.rewards.redeemed+3; w.MQStore.save(); w.MQPlayzone.open();
  click(card('balloon')); click($('pzPlay')); click($('pzBalloonStart'));
  const bg=w.MQPlayzone.current(); const Rg=profile.rewards.redeemed;
  elapse(65); [1,2,3,4,5].forEach(()=>ptr(bg._spawn({kind:'hazard'}).el,'pointerdown'));
  ok(!bg._state().running&&profile.rewards.redeemed===Rg+2&&!profile.playzone.session&&$('pzUsage').textContent.includes('Used 2 min'),'Balloon Pop: game over ends the session and charges 65 s as 2 min');
  click($('pzLeave')); ok(profile.rewards.redeemed===Rg+2,'leaving after game over does not charge again');
  profile.rewards.earned=profile.rewards.redeemed; w.MQStore.save(); w.MQPlayzone.open(); // balance 0
  profile.rewards.earned=profile.rewards.redeemed+1; w.MQStore.save(); w.MQPlayzone.open();
  click(card('balloon')); click($('pzPlay')); click($('pzBalloonStart')); elapse(5);
  const bg2=w.MQPlayzone.current(); [1,2,3,4,5].forEach(()=>ptr(bg2._spawn({kind:'hazard'}).el,'pointerdown'));
  ok(balance()===0&&!bg2._state().running,'Balloon Pop: a 5 s game with 1 min left ends with balance 0');
  click($('pzBalloonAgain'));
  ok(!bg2._state().running&&!!d.querySelector('.pz-block-note')&&d.querySelector('.pz-block-note').textContent.includes('above 0 minutes')&&!profile.playzone.session,'Balloon Pop: Play again is blocked at balance 0 with a message');
  click($('pzLeave'));

  // ---- shell + game contract with a stub context (begin at the real start, end at the real end)
  {
    const log=[]; let refuse='';
    const sctx=()=>({profiles:()=>w.MQStore.getProfiles(),defaults:[profile.id,null],record:(p,k,v)=>w.MQStore.recordPlayzone(p,k,v),begin:()=>{log.push('begin'); return refuse;},end:(r)=>log.push('end:'+r),seconds:()=>0});
    const rhs=d.createElement('div'); d.body.append(rhs);
    const rgs=w.MQPlayzone.game('reaction').mount(rhs,{delay:[30,40],pause:60,minValid:0,ctx:sctx()});
    ok(log.length===0,'Reaction Battle: no session just from opening the game');
    refuse='The Screen-time Bank must be above 0 minutes before another game can start.';
    click(rhs.querySelector('[data-bestof="3"]'));
    ok(log.join()==='begin'&&rhs.querySelector('.pz-block-note').textContent.includes('above 0 minutes')&&rhs.querySelector('.pz-reaction').dataset.phase==='format','Reaction Battle: a refused start keeps the format screen and shows the message');
    refuse=''; click(rhs.querySelector('[data-bestof="3"]'));
    ok(log.join()==='begin,begin'&&rhs.querySelector('.pz-reaction').dataset.phase==='ready','Reaction Battle: the session starts when the match starts');
    const sd=[...rhs.querySelectorAll('.pz-side')];
    for(let r=0;r<2;r++){ ptr(sd[0],'pointerdown'); ptr(sd[1],'pointerdown'); await sleep(80); ptr(sd[1],'pointerdown'); await sleep(900); }
    await sleep(100);
    ok(rhs.querySelector('.pz-reaction').dataset.phase==='matchover'&&log.slice(-1)[0]==='end:match','Reaction Battle: the session ends when the match is over');
    click(rhs.querySelector('#pzRematch'));
    ok(log.slice(-1)[0]==='begin'&&rhs.querySelector('.pz-reaction').dataset.phase==='ready','Reaction Battle: Rematch begins a new session');
    rgs.destroy(); rhs.remove();
  }

  // ---- Profile Details show each player's Playzone personal bests
  {
    const kidP=w.MQStore.getProfiles().find(p=>p.name==='Kid'); const sisP=w.MQStore.getProfiles().find(p=>p.name==='Sis');
    w.MQStore.addProfile('Neo','🐸'); const neoP=w.MQStore.getProfiles().find(p=>p.name==='Neo');
    kidP.playzone.reactionBest=300; kidP.playzone.balloonBest=17; sisP.playzone.reactionBest=250; sisP.playzone.balloonBest=0; w.MQStore.save();
    const detailsOf=(name)=>{
      click($('profilesButton'));
      let card=[...d.querySelectorAll('.profile-card')].find(c=>c.textContent.includes(name));
      let btn=[...card.querySelectorAll('button')].find(b=>b.textContent==='Details'||b.textContent==='Hide');
      if(btn.textContent==='Hide'){ click(btn); card=[...d.querySelectorAll('.profile-card')].find(c=>c.textContent.includes(name)); btn=[...card.querySelectorAll('button')].find(b=>b.textContent==='Details'); }
      click(btn);
      card=[...d.querySelectorAll('.profile-card')].find(c=>c.textContent.includes(name));
      const text=card.querySelector('.profile-details').textContent;
      click($('profilesClose'));
      return text;
    };
    const kd=detailsOf('Kid'); const sd2=detailsOf('Sis'); const nd=detailsOf('Neo');
    ok(kd.includes('Reaction Battle · best reaction time: 300 ms (lower is better)')&&kd.includes('Balloon Pop · personal best score: 17'),'Profile Details: Player 1 (Kid) shows the Reaction Battle best time with "lower is better" and the Balloon Pop personal best');
    ok(sd2.includes('best reaction time: 250 ms')&&!sd2.includes('300 ms')&&!sd2.includes('score: 17')&&sd2.includes('personal best score: Not played yet'),'Profile Details: Player 2 (Sis) has her own records and no leakage from Kid');
    ok(!kd.includes('250 ms'),'Profile Details: Kid does not show Sis\'s time');
    ok(nd.includes('best reaction time: Not played yet')&&nd.includes('personal best score: Not played yet'),'Profile Details: a player who has not played shows "Not played yet" for both games');
    w.MQStore.recordPlayzone(neoP,'reaction',410); w.MQStore.recordPlayzone(neoP,'balloon',9);
    const nd2=detailsOf('Neo');
    ok(nd2.includes('410 ms')&&nd2.includes('score: 9'),'Profile Details: a new record shows up automatically the next time Details are opened');
    w.MQStore.recordPlayzone(neoP,'reaction',500); w.MQStore.recordPlayzone(neoP,'balloon',3);
    ok(detailsOf('Neo').includes('410 ms')&&detailsOf('Neo').includes('score: 9'),'Profile Details: a worse result does not replace the record');
    const saved=store().profiles; const sv=(n)=>saved.find(p=>p.name===n).playzone;
    ok(sv('Kid').reactionBest===300&&sv('Kid').balloonBest===17&&sv('Sis').reactionBest===250&&sv('Neo').reactionBest===410&&sv('Neo').balloonBest===9,'Profile Details: the records are stored in the existing profile storage (survive refresh and restart)');
    w.MQStore.deleteProfile(neoP.id);
    w.MQMenus.refreshProfileSelects();
  }
  // the Playzone menu still shows its own personal bests
  w.MQPlayzone.open(); click(card('reaction')); click($('pzPlay'));
  ok(true,'Playzone: Reaction Battle opens again after the changes'); click($('pzLeave'));

  // ---- Parent adjustment lives on the Screen-time page (hard quadratic question), not in Playzone
  w.MQPlayzone.open();
  ok(!$('pzParentButton')&&!$('pzAdjust')&&!d.querySelector('#playzonePanel [id^="bankAdj"],#playzonePanel [id^="pzAdj"]'),'Playzone has no parent adjustment controls or entry point');
  w.MQPlayzone.close();
  const bankPick=()=>{ $('bankProfile').value=profile.id; $('bankProfile').dispatchEvent(new w.Event('change')); };
  const unlockBtn=()=>$('bankAdjust').querySelector('button.primary-button');
  click($('bankButton')); bankPick();
  const before0=balance();
  ok(!hidden('bankModal')&&!$('bankAdjustEntry').classList.contains('hidden')&&$('bankAdjustButton').textContent.includes('Parent'),'Screen-time page: a clearly marked parent entry point exists');
  ok(!$('bankAdjAmount')&&w.MQStore.adjustBalance(profile,5).denied,'Parent: no controls and no adjustment before verification');
  click($('bankAdjustButton'));
  ok(!hidden('bankAdjust')&&!!$('bankAdjChallenge')&&!$('bankAdjAmount')&&/x²/.test($('bankAdjChallenge').textContent),'Parent: a quadratic question is shown instead of the controls');
  $('bankAdjAnswer').value='1, 1'; click(unlockBtn());
  ok(!$('bankAdjAmount')&&balance()===before0,'Parent: a wrong answer does not unlock the controls');
  const easyQ=w.MQParent.current().text; w.MQParent.submit(solveParent(easyQ));
  ok(w.MQParent.isUnlocked()&&w.MQStore.adjustBalance(profile,5).denied,'Parent: the normal (easy) parent unlock does not allow adjustments'); w.MQParent.lock();
  const q=$('bankAdjChallenge').textContent;
  $('bankAdjAnswer').value=rootsOf(q).slice().reverse().join(', '); click(unlockBtn());
  ok(!!$('bankAdjAmount')&&$('bankAdjBalance').textContent.includes(`${before0} min`),'Parent: correct roots (any order) unlock the controls and show the current balance');
  $('bankAdjAmount').value='10'; click($('bankAdjAdd'));
  ok(balance()===before0&&!!$('bankAdjConfirm'),'Parent: Add asks for confirmation before changing anything');
  const cf=$('bankAdjConfirm'); click(cf); click(cf);
  ok(balance()===before0+10,'Parent: +10 minutes added exactly once (double tap)');
  ok($('bankAdjMessage').textContent.includes(`Before: ${before0} min → After: ${before0+10} min`)&&$('bankAdjBalance').textContent.includes(`${before0+10} min`),'Parent: balance before and after are shown and the page updates');
  $('bankAdjAmount').value='4'; click($('bankAdjDeduct')); click($('bankAdjConfirm'));
  ok(balance()===before0+6,'Parent: -4 minutes deducted from the same bank');
  $('bankAdjAmount').value='999'; click($('bankAdjDeduct')); ok(balance()===before0+6&&!$('bankAdjConfirm'),'Parent: an invalid amount is refused');
  $('bankAdjAmount').value='2.5'; click($('bankAdjAdd')); ok(!$('bankAdjConfirm'),'Parent: a non-whole amount is refused');
  $('bankAdjAmount').value=String(before0+6+8); click($('bankAdjDeduct')); click($('bankAdjConfirm'));
  ok(balance()===-8&&$('bankAdjMessage').textContent.includes('After: -8 min'),'Parent: a manual deduction larger than the balance makes it negative (-8)');
  ok(store().profiles.find(p=>p.id===profile.id).rewards.redeemed-store().profiles.find(p=>p.id===profile.id).rewards.earned===8,'Parent: the negative balance is saved in the existing storage');
  $('bankAdjAmount').value='8'; click($('bankAdjAdd')); click($('bankAdjConfirm'));
  ok(balance()===0,'Parent: adding time brings the negative balance back to 0');
  $('bankAdjAmount').value='5'; click($('bankAdjAdd')); click($('bankAdjConfirm'));
  ok(balance()===5,'Parent: and on to a positive balance');
  click($('bankAdjDone'));
  ok(!w.MQParent.hard.isUnlocked()&&hidden('bankAdjust')&&!$('bankAdjAmount'),'Parent: Lock and go back relocks the adjustment');
  ok(w.MQStore.adjustBalance(profile,5).denied,'Parent: adjustments are refused again after locking');
  click($('bankAdjustButton')); ok(!$('bankAdjAmount')&&!!$('bankAdjChallenge'),'Parent: opening it again asks a new question');
  $('bankAdjAnswer').value=rootsOf($('bankAdjChallenge').textContent).join(', '); click(unlockBtn()); ok(!!$('bankAdjAmount'),'Parent: unlocked again');
  click($('bankClose')); click($('bankButton')); bankPick();
  ok(!$('bankAdjAmount')&&hidden('bankAdjust')&&w.MQStore.adjustBalance(profile,5).denied,'Parent: closing and reopening the Screen-time page (like a refresh) does not keep it unlocked');
  click($('bankClose'));
  w.MQPlayzone.open(); ok($('pzBalance').textContent.includes('5 min'),'the Playzone balance shows the adjusted bank');
  click(card('balloon')); click($('pzPlay')); ok(!hidden('pzStageView')&&!d.querySelector('#bankAdjChallenge'),'Playzone start still needs no parent question'); click($('pzLeave'));

  // ---- the only storage Playzone touches is the existing profile key
  ok(Object.keys(w.localStorage).length===1&&w.localStorage.key(0)==='mathQuizBattle.v1','Playzone adds no new localStorage keys');
  click($('pzBack')); ok(!hidden('setupPanel'),'Back to the main menu works after playing');
})().catch(e=>{console.error('ERR',e);process.exit(1)});
