const {JSDOM}=require('jsdom');const fs=require('fs');
// Playzone in jsdom: menu, Screen-time redemption (once, parent-only, insufficient balance), and the three games' logic.
const dir=require('path').join(__dirname,'..','public')+'/';
const html=fs.readFileSync(dir+'index.html','utf8').replace(/<script src="[^"]+"><\/script>/g,'');
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
['questions.js','trophies.js','parent.js','report.js','store.js','audio.js','menus.js','playzone.js','pz-designer.js','pz-reaction.js','pz-balloon.js','game.js'].forEach(f=>w.eval(fs.readFileSync(dir+f,'utf8')));
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
const unlockViaUi=()=>{ // the real parent question in the Playzone cost screen
  const q=$('pzChallenge').textContent; $('pzAnswer').value=solveParent(q);
  click($('pzParent').querySelector('button.primary-button'));
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
  ok(txt.every(t=>/⏱ \d+ min/.test(t)),'every card shows its cost');
  ok(txt[0].includes('1 player')&&txt[1].includes('2 players')&&txt[2].includes('1 player'),'cards show one-player / two-player');
  ok(cards().every(c=>c.querySelector('.pz-icon')&&c.querySelector('.pz-desc').textContent.length>5),'cards have an icon and a description');
  ok(!w.MQPlayzone.register({id:'x',cost:1,mount(){}})===false&&cards().length===4,'a new game can be registered and appears');
  ok(!w.MQPlayzone.register({id:'bad',cost:0,mount(){}})&&!w.MQPlayzone.register({id:'designer',cost:1,mount(){}}),'invalid cost and duplicate ids are refused');
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
  click(card('designer')); ok($('pzPlay').disabled&&$('pzConfirm').textContent.includes('Not enough minutes'),'zero balance: start disabled with a message');
  click($('pzPlay')); ok(profile.rewards.redeemed===0&&hidden('pzStageView'),'tapping a disabled start does nothing');
  click($('pzCancel'));

  // ---- balance of 3 min (test setup writes the bank directly)
  profile.rewards.earned=3; w.MQStore.save();
  w.MQPlayzone.open();
  ok($('pzBalance').textContent.includes('3 min'),'balance shows 3 min');
  const costs=Object.fromEntries(cards().map(c=>[c.dataset.game,+c.textContent.match(/⏱ (\d+) min/)[1]]));
  ok(costs.designer===2&&costs.reaction===1&&costs.balloon===1,'costs are 2 / 1 / 1 minutes');
  click(card('designer'));
  ok($('pzConfirm').textContent.includes('costs 2 min')&&$('pzConfirm').textContent.includes('has 3 min'),'cost and balance are shown before starting');
  ok(!$('pzPlay').disabled&&hidden('pzStageView'),'start is enabled but nothing has started or been charged yet');
  click($('pzPlay')); click($('pzPlay'));
  ok($('pzPlay').disabled,'the start button is disabled after one tap');
  ok(d.querySelectorAll('#pzChallenge').length===1,'repeated taps show only one parent question');
  ok(profile.rewards.redeemed===0,'nothing is deducted before the parent answers');
  // wrong answer: nothing deducted
  $('pzAnswer').value='999999'; click($('pzParent').querySelector('button.primary-button'));
  ok(profile.rewards.redeemed===0&&hidden('pzStageView'),'a wrong parent answer deducts nothing and does not start');
  const unlockBtn=()=>$('pzParent').querySelector('button.primary-button');
  const oldUnlock=unlockBtn();
  unlockViaUi();
  ok(!hidden('pzStageView')&&hidden('pzMenuView'),'correct parent answer starts the game');
  ok(profile.rewards.redeemed===2&&profile.rewards.redeemTx.length===1&&profile.rewards.redeemTx[0].minutes===2,'exactly 2 minutes were deducted once');
  ok(!w.MQParent.isUnlocked(),'the parent lock is released again after redeeming');
  click(oldUnlock); click(oldUnlock);
  ok(profile.rewards.redeemed===2&&profile.rewards.redeemTx.length===1,'tapping the old unlock button again does not deduct again');
  ok(store().profiles[0].rewards.redeemed===2,'the deduction is saved in the existing profile storage');
  ok(profile.rewards.earned===3,'earned minutes are unchanged (no credits for playing)');
  ok(d.querySelector('#pzHost .pz-choose')&&d.querySelectorAll('.pz-pick-pizza,.pz-pick-cake').length===2,'Pizza & Cake Designer starts on the choose screen');

  // ---- Pizza & Cake Designer
  click(d.querySelector('.pz-pick-pizza'));
  const inst=w.MQPlayzone.current();
  const svg=d.querySelector('#pzHost svg.pz-canvas');
  svg.getBoundingClientRect=()=>({left:0,top:0,width:400,height:400,right:400,bottom:400});   // 1 client px = 1 artwork unit
  const decoBtn=t=>d.querySelector(`.pz-deco[data-deco="${t}"]`);
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

  // ---- leaving the stage keeps the balance and returns to Playzone
  click($('pzLeave'));
  ok(!hidden('pzMenuView')&&hidden('pzStageView')&&$('pzHost').innerHTML===''&&!d.body.classList.contains('pz-stage'),'← Playzone returns to the menu and clears the game');
  ok($('pzBalance').textContent.includes('1 min')&&profile.rewards.redeemed===2,'balance is now 1 min and leaving did not charge again');

  // ---- insufficient balance for the 2-min game, but 1-min games are fine
  ok(card('designer').textContent.includes('🔒')&&!card('balloon').textContent.includes('🔒'),'the cost chip shows a lock only on games that cannot be afforded');
  click(card('designer')); ok($('pzPlay').disabled&&$('pzConfirm').textContent.includes('Not enough minutes'),'1 min is not enough for the 2-min game: start is disabled');
  click($('pzPlay')); ok(hidden('pzStageView')&&profile.rewards.redeemed===2,'insufficient balance: nothing starts and nothing is charged');
  click($('pzCancel'));

  // ---- Balloon Pop through the real flow (1 min)
  click(card('balloon')); click($('pzPlay')); unlockViaUi();
  ok(profile.rewards.redeemed===3&&!hidden('pzStageView'),'Balloon Pop: 1 min deducted once and the game starts');
  ok(d.querySelectorAll('.pz-balloon').length>=1&&/0/.test(d.querySelector('.pz-score').textContent),'Balloon Pop: a balloon appears at the start, score 0');
  const b1=d.querySelector('.pz-balloon');
  ok(/^#[0-9a-f]{6}$/i.test(b1.style.getPropertyValue('--c'))&&b1.style.left.endsWith('%')&&parseFloat(b1.style.animationDuration)>=4,'balloons have a colour, a random position and a rising animation');
  ptr(b1,'pointerdown'); ptr(b1,'pointerdown');
  ok(/1/.test(d.querySelector('.pz-score').textContent)&&!/2/.test(d.querySelector('.pz-score').textContent),'popping a balloon scores once, even if tapped twice');
  await sleep(1700);
  ok(d.querySelectorAll('.pz-balloon:not(.popped)').length>=2,'more balloons keep appearing');
  click($('pzLeave'));
  ok(hidden('pzStageView')&&!!w.MQPlayzone,'Balloon Pop: leaving stops the game');
  const balloon=w.MQPlayzone.game('balloon');
  const host=d.createElement('div'); d.body.append(host);
  const bi=balloon.mount(host,{duration:2});
  ptr(host.querySelector('.pz-balloon'),'pointerdown'); await sleep(900); ptr(host.querySelector('.pz-balloon:not(.popped)'),'pointerdown');
  ok(/2/.test(host.querySelector('.pz-score').textContent),'Balloon Pop: each pop adds one to the score');
  await sleep(1300);
  ok(!host.querySelector('.pz-over').classList.contains('hidden')&&host.querySelector('.pz-over-text').textContent.includes('2 balloons')&&host.querySelectorAll('.pz-balloon').length===0,'Balloon Pop: the game ends on time and shows the final score');
  click(host.querySelector('.pz-over .primary-button'));
  ok(host.querySelector('.pz-over').classList.contains('hidden')&&/0/.test(host.querySelector('.pz-score').textContent)&&host.querySelectorAll('.pz-balloon').length===1,'Balloon Pop: Play again restarts with score 0');
  bi.destroy(); const n=host.querySelectorAll('.pz-balloon').length; await sleep(900);
  ok(host.querySelectorAll('.pz-balloon').length<=n,'Balloon Pop: no new balloons after the game is destroyed');
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

  // ---- the only storage Playzone touches is the existing profile key
  ok(Object.keys(w.localStorage).length===1&&w.localStorage.key(0)==='mathQuizBattle.v1','Playzone adds no new localStorage keys');
  click($('pzBack')); ok(!hidden('setupPanel'),'Back to the main menu works after playing');
})().catch(e=>{console.error('ERR',e);process.exit(1)});
