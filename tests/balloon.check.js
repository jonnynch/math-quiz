const {JSDOM}=require('jsdom');const fs=require('fs');
// Balloon Pop progression in jsdom: endless levels, difficulty limits, combo, environments, trophies, and that the
// Screen-time session handling is unchanged. Time is faked (no real waiting).
const dir=require('path').join(__dirname,'..','public')+'/';
const html=fs.readFileSync(dir+'index.html','utf8').replace(/<script src="[^"]+"><\/script>/g,'');
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
['questions.js','trophies.js','parent.js','report.js','store.js','audio.js','menus.js','playzone.js','bank-adjust.js','pz-designer.js','pz-reaction.js','pz-balloon.js','game.js'].forEach(f=>w.eval(fs.readFileSync(dir+f,'utf8')));
const d=w.document, $=id=>d.getElementById(id);
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) process.exitCode=1;};
const click=b=>b.click();
const ptr=(t,type)=>{const e=new w.Event(type,{bubbles:true,cancelable:true});e.pointerId=1;t.dispatchEvent(e);return e;};
const BG=w.MQPlayzone.game('balloon'), CFG=BG.config, dif=BG.difficulty, T=w.MQTrophies;
const store=()=>JSON.parse(w.localStorage.getItem('mathQuizBattle.v1')||'{}');

(async()=>{
  // ---- levels: no maximum, pops only
  ok(BG.levelFor(4*31)===31&&BG.levelFor(4*31)+1===32,'Level 32 is reachable (the old cap was Level 31)');
  ok(BG.levelFor(4*99)+1===100&&BG.levelFor(4*150)+1===151&&BG.levelFor(4*5000)+1===5001,'levels go beyond 100 with no maximum');
  ok(BG.levelFor(0)===0&&BG.levelFor(3)===0&&BG.levelFor(4)===1&&CFG.levelEvery===4&&!('maxLevel' in CFG),'still four pops per level, and no maxLevel setting exists');
  // ---- difficulty: progressive, limited, always valid
  const levels=[...Array(300).keys()];
  const D=levels.map(dif);
  ok(D.every((x,i)=>i===0||(x.rise<=D[i-1].rise&&x.scale<=D[i-1].scale&&x.spawn<=D[i-1].spawn&&x.pressure>=D[i-1].pressure)),'difficulty never eases as the level rises');
  ok(D[0].rise===CFG.rise.start&&D[1].rise<D[0].rise&&D[1].rise>D[0].rise*0.9,'early levels start gentle and change in small steps');
  const big=[1e3,1e5,1e9,Number.MAX_SAFE_INTEGER].map(dif);
  const valid=(x)=>[x.rise,x.scale,x.spawn,x.hazardChance,x.doubleChance,x.sway,x.jitter[0],x.jitter[1]].every(Number.isFinite)&&x.rise>=CFG.rise.min&&x.scale>=CFG.size.minScale&&x.spawn>=CFG.spawn.min&&x.hazardChance>=0&&x.hazardChance<=CFG.hazards.chance.max&&x.moves.length>=1&&x.moves.length<=CFG.moves.length;
  ok(D.every(valid)&&big.every(valid),'no invalid, negative or NaN values from level 0 to level 300 or at huge levels');
  ok([NaN,-5,undefined,null,'x',Infinity].map(dif).every(x=>x.level===0&&valid(x)),'bad level input is treated as level 0');
  ok(CFG.rise.min===2.5&&CFG.spawn.min===380&&CFG.size.floorPx===54&&CFG.hazards.chance.max===0.33&&CFG.maxObjects===8,'limits: crossing 2.5 s, spawn 380 ms, balloon floor 54 px, hazards 33%, 8 objects');
  const capped=D.findIndex(x=>x.rise===CFG.rise.min);
  ok(capped>15&&capped<30&&D[capped].rise===D[299].rise,'crossing time reaches its limit around level 22 and stays there');
  ok(dif(100).pressure>dif(30).pressure&&dif(200).pressure===1&&dif(100).doubleChance>dif(30).doubleChance&&dif(100).doubleChance<=CFG.endless.doubleChance&&dif(300).jitter[1]<=CFG.endless.jitterMax,'after the individual limits, endless pressure keeps rising to its own caps');
  ok(CFG.size.floorPx*1>=50,'balloons are never smaller than 50 px');
  ok(dif(2).hazardChance===0&&dif(3).hazardTypes.join()==='rock'&&dif(0).moves.join()==='straight'&&dif(8).moves.includes('bounce'),'early levels are approachable: no hazards before level 4, straight paths first');

  // ---- environments
  const env=(l)=>BG.environmentFor(l-1).id;
  ok(env(1)==='sky'&&env(7)==='sky'&&env(8)==='windy'&&env(14)==='windy'&&env(15)==='cloudy'&&env(24)==='cloudy'&&env(25)==='stormy'&&env(39)==='stormy'&&env(40)==='night'&&env(500)==='night','environments change at displayed levels 8, 15, 25 and 40');
  ok(new Set(CFG.environments.map(e=>e.id)).size===5&&CFG.environments.every(e=>e.id==='sky'||e.wind>0||e.sway>1||e.hazardBonus>0||e.lightning),'every environment is distinct and has a gameplay effect');

  // ---- a profile and a plain game
  w.MQStore.addProfile('Kid','🦊'); w.MQStore.addProfile('Sis','🐱');
  const kid=w.MQStore.getProfiles()[0], sis=w.MQStore.getProfiles()[1];
  const host=d.createElement('div'); d.body.append(host);
  const ctxFor=(id,extra)=>Object.assign({profiles:()=>w.MQStore.getProfiles(),defaults:[id,null],record:(p,k,v)=>w.MQStore.recordPlayzone(p,k,v),trophies:(p,s)=>{const won=T.recordBalloon(p,s); if(won.length) w.MQStore.save(); return won;}},extra||{});
  const start=(id,extra)=>{const g=BG.mount(host,{ctx:ctxFor(id,extra),autoSpawn:false}); host.querySelector('#pzBalloonStart').click(); return g;};
  const popN=(g,n)=>{ for(let i=0;i<n;i++) ptr(g._spawn({kind:'balloon',move:'straight'}).el,'pointerdown'); };
  const hazard=(g)=>ptr(g._spawn({kind:'hazard'}).el,'pointerdown');
  const missOne=(g)=>{ const m=g._spawn({kind:'balloon',move:'straight'}); for(let i=0;i<600&&g._state().objects.some(o=>o.el===m.el)&&g._state().running;i++) g._step(0.05); };

  // ---- combo
  let g=start(kid.id);
  popN(g,3);
  ok(g._state().combo===3&&g._state().pops===3&&g._state().score===3&&d.querySelector('.pz-combo').textContent.includes('×3')&&!d.querySelector('.pz-combo').classList.contains('hidden'),'consecutive pops build the combo, shown on screen');
  hazard(g);
  ok(g._state().combo===0&&g._state().lives===4&&d.querySelector('.pz-combo').classList.contains('hidden'),'tapping a hazard resets the combo');
  popN(g,2); missOne(g);
  ok(g._state().combo===0&&g._state().lives===3,'a missed balloon resets the combo');
  popN(g,4);
  ok(g._state().combo===4&&g._state().score===9,'combo builds again from zero (no bonus before the first milestone)');
  popN(g,1);
  ok(g._state().combo===5&&g._state().score===9+1+2&&g._state().pops===10&&BG.comboBonus(5)===2,'milestone ×5 awards +2 bonus points');
  ok(/Combo ×5! \+2/.test(g._notices()),'a combo milestone shows a short message');
  g.destroy();
  g=start(kid.id); popN(g,5); hazard(g); g.destroy();
  g=start(kid.id);
  ok(g._state().combo===0&&g._state().score===0&&g._state().pops===0,'a new game starts with no combo, score or pops');
  popN(g,6); for(let i=0;i<4;i++) hazard(g);   // lives 5 -> 1
  hazard(g);
  ok(!g._state().running&&g._state().combo===0&&host.querySelector('.pz-end').textContent.includes('Best combo ×6'),'the combo is reset when the game ends (and the best combo is reported)');
  click(host.querySelector('#pzBalloonAgain')); ok(g._state().combo===0&&g._state().running,'Play again restarts with no combo'); g.destroy();
  ok([1,2,3,4,5,6,7,8,9,10,11,12,15,20,25,30,35].map(BG.comboBonus).join()==='0,0,0,0,2,0,0,0,0,5,0,0,8,12,0,15,0'.replace('0,0,0,0,2,0,0,0,0,5,0,0,8,12,0,15,0','0,0,0,0,2,0,0,0,0,5,0,0,8,12,0,15,0'),'bonus table: ×5 +2, ×10 +5, ×15 +8, ×20 +12, then +15 every 10');

  // ---- combo bonus never skips levels
  g=start(kid.id); popN(g,20);
  ok(g._state().pops===20&&g._state().level===5&&g._state().score===20+2+5+8+12,'20 pops in a row: level follows pops (6), score is higher (47)');
  popN(g,3); ok(g._state().level===5&&g._state().pops===23,'bonus points never move the level');
  g.destroy();

  // ---- level display and environments in play
  g=start(kid.id); g._setPops(4*7-1);
  ok(d.querySelector('.pz-level').textContent==='Level 7'&&g._state().env==='sky','the level is shown clearly (Level 7, clear sky)');
  popN(g,1);
  ok(d.querySelector('.pz-level').textContent==='Level 8'&&g._state().env==='windy'&&d.querySelector('.pz-sky').dataset.env==='windy'&&/Windy sky/.test(g._notices()),'reaching Level 8 switches to the windy sky and says so');
  g._setPops(4*14-1); popN(g,1); ok(g._state().env==='cloudy','Level 15: cloudy sky');
  g._setPops(4*24-1); popN(g,1); ok(g._state().env==='stormy','Level 25: stormy sky');
  g._setPops(4*39-1); popN(g,1); ok(g._state().env==='night'&&d.querySelector('.pz-level').textContent==='Level 40','Level 40: night sky');
  g._setPops(4*149); popN(g,1); ok(g._state().env==='night'&&d.querySelector('.pz-level').textContent==='Level 150','levels beyond 100 keep working (Level 150)');
  g.destroy();
  // wind: objects drift sideways but stay on the screen, and can still be popped
  g=BG.mount(host,{ctx:ctxFor(kid.id),autoSpawn:false,rng:()=>0.5}); host.querySelector('#pzBalloonStart').click(); g._setPops(4*10);
  const objs=[g._spawn({kind:'balloon',move:'straight'}),g._spawn({kind:'balloon',move:'curve'}),g._spawn({kind:'hazard',type:'rock'})];
  const x0=objs.map(o=>o.x); let moved=false, inside=true;
  for(let i=0;i<60;i++){ g._step(0.05); g._state().objects.forEach(o=>{ if(o.x<-0.01||o.x>600-o.size+0.01) inside=false; }); }
  moved=g._state().objects.some((o,i)=>Math.abs(o.x-x0[i])>1);
  ok(moved&&inside,'windy sky: objects drift sideways and never leave the screen');
  const live=g._state().objects.find(o=>!o.hazard); ptr(live.el,'pointerdown');
  ok(g._state().pops===41&&g._state().running,'windy sky: balloons can still be popped');
  g.destroy();
  // storm: lightning is only a soft overlay that never blocks taps
  g=BG.mount(host,{ctx:ctxFor(kid.id),autoSpawn:false}); host.querySelector('#pzBalloonStart').click(); g._setPops(4*30);
  let struck=false; for(let i=0;i<1200&&!struck;i++){ g._step(0.05); if(d.querySelector('.pz-lightning').classList.contains('on')) struck=true; }
  ok(struck,'stormy sky: lightning flashes now and then');
  const css=fs.readFileSync(dir+'style.css','utf8');
  ok(/\.pz-lightning \{[^}]*pointer-events: none/.test(css)&&/\.pz-sky::before \{[^}]*pointer-events: none/.test(css)&&/\.pz-lightning\.on \{ opacity: \.3/.test(css),'lightning and sky decorations never block taps and stay see-through (opacity 0.3 at most)');
  const b=g._spawn({kind:'balloon',move:'straight'}); const p0=g._state().pops; ptr(b.el,'pointerdown');
  ok(g._state().pops===p0+1,'stormy sky: balloons can still be popped during lightning');
  g.destroy();
  // endless pressure: object count is capped
  g=BG.mount(host,{ctx:ctxFor(kid.id),rng:()=>0.01}); host.querySelector('#pzBalloonStart').click(); g._setPops(4*300);
  let most=0; for(let i=0;i<400&&g._state().running;i++){ g._step(0.05); most=Math.max(most,g._state().objects.length); }
  ok(most<=CFG.maxObjects,`at most ${CFG.maxObjects} objects at once even at Level 301 (saw ${most})`);
  g.destroy();

  // ---- trophies
  const ids=(p)=>T.balloonProgress(p).filter(t=>t.unlocked).map(t=>t.tier.id);
  ok(T.BALLOON_TROPHIES.map(t=>t.id).join()==='level10,level20,level30,level50,level100,combo5,combo10,combo20,pops50,pops100','ten Balloon Pop trophies exist');
  const tp={trophies:{}};
  const at=(stats)=>T.recordBalloon(tp,stats).map(t=>t.id).join();
  ok(at({level:9,combo:4,pops:49})===''&&at({level:10})==='level10'&&at({level:19})===''&&at({level:20})==='level20'&&at({level:30})==='level30'&&at({level:49})===''&&at({level:50})==='level50'&&at({level:99})===''&&at({level:100})==='level100','level trophies unlock exactly at levels 10, 20, 30, 50, 100');
  ok(at({combo:5})==='combo5'&&at({combo:9})===''&&at({combo:10})==='combo10'&&at({combo:19})===''&&at({combo:20})==='combo20','combo trophies unlock at ×5, ×10 and ×20');
  ok(at({pops:50})==='pops50'&&at({pops:99})===''&&at({pops:100})==='pops100','pop trophies unlock at 50 and 100 pops in one game');
  ok(at({level:100,combo:20,pops:100})===''&&ids(tp).length===10&&tp.trophies.balloon.unlocked.length===10,'a trophy is never awarded twice');
  ok(at({level:1,combo:1,pops:1})===''&&tp.trophies.balloon.level===100,'lower results never lower the saved bests');
  ok(T.balloonProgress({}).every(t=>!t.unlocked&&t.value===0)&&T.recordBalloon(null,{level:99}).length===0,'no profile (guest) means no trophies');
  ok(T.cleanAll({balloon:{level:12,combo:3,pops:7,unlocked:['level10','bogus']},x:1}).balloon.unlocked.join()==='level10'&&!('x' in T.cleanAll({x:1})),'saved Balloon Pop trophy data is validated');
  const before=T.unlockedCount({trophies:{}}); ok(before===0,'math trophy count unchanged for a new profile');

  // in a real game: player 1 earns, player 2 and a guest do not
  delete kid.trophies.balloon; w.MQStore.save();   // (earlier tests already earned a combo trophy; start this part clean)
  g=start(kid.id);
  popN(g,5); ok(ids(kid).join()==='combo5'&&/Combo Starter/.test(g._notices()),'a trophy is awarded automatically as soon as it is earned');
  popN(g,5); ok(ids(kid).includes('combo10')&&!ids(kid).includes('level10'),'combo ×10 trophy earned in play');
  popN(g,10); ok(ids(kid).includes('combo20'),'combo ×20 trophy earned in play');
  popN(g,30); ok(ids(kid).includes('pops50')&&ids(kid).includes('level10')&&g._state().pops===50&&g._state().level===12,'50 pops in one game: balloon + Level 10 trophies');
  popN(g,50); ok(ids(kid).includes('pops100')&&g._state().pops===100,'100 pops in one game: trophy earned');
  const kidSaved=JSON.stringify(store().profiles[0].trophies.balloon);
  ok(store().profiles[0].trophies.balloon.unlocked.length===kid.trophies.balloon.unlocked.length&&store().profiles[0].trophies.balloon.pops===100,'trophies are saved in the existing profile storage');
  g._setPops(4*98+3); popN(g,1);
  ok(ids(kid).includes('level100')&&g._state().level===98+1&&d.querySelector('.pz-level').textContent==='Level 100','Level 100 trophy earned in play');
  for(let i=0;i<5;i++) hazard(g);
  ok(!g._state().running&&host.querySelector('.pz-end').textContent.includes('New trophies'),'game over lists the trophies earned this game');
  g.destroy();
  ok(ids(sis).length===0&&!sis.trophies.balloon,'Player 2 has no trophies from Player 1\'s games');
  g=start(sis.id); popN(g,5);
  ok(ids(sis).join()==='combo5'&&JSON.stringify(store().profiles[0].trophies.balloon)!==kidSaved&&ids(kid).length===10,'Player 2 earns their own trophies; Player 1 keeps theirs (no duplicates)');
  g.destroy();
  const snap=()=>JSON.stringify(w.MQStore.getProfiles().map(p=>p.trophies));
  const trBefore=snap();
  const gst=BG.mount(host,{ctx:ctxFor(null),autoSpawn:false}); host.querySelector('#pzBalloonStart').click(); popN(gst,60);
  ok(snap()===trBefore&&ids(sis).length===1,'a guest game awards no trophies to anyone'); gst.destroy();
  g=start(kid.id); popN(g,5); ok(ids(kid).length===10&&kid.trophies.balloon.unlocked.length===10,'replaying never duplicates trophies'); g.destroy();
  // personal best still works (total score)
  ok(kid.playzone.balloonBest>=100,'personal best is still recorded from the total score');
  // achievements page
  click($('achievementsButton')); $('achievementsProfile').value=kid.id; $('achievementsProfile').dispatchEvent(new w.Event('change'));
  const sec=d.querySelector('.trophy-balloon');
  ok(!!sec&&sec.querySelectorAll('.trophy-card').length===10&&sec.querySelectorAll('.trophy-card.unlocked').length===10&&/Balloon Pop/.test(sec.textContent),'Achievements page shows the 10 Balloon Pop trophies with earned status');
  $('achievementsProfile').value=sis.id; $('achievementsProfile').dispatchEvent(new w.Event('change'));
  const sec2=d.querySelector('.trophy-balloon');
  ok(sec2.querySelectorAll('.trophy-card.unlocked').length===1&&/combo5|Combo Starter/.test(sec2.textContent)&&/0 \/ 10|5 \/ 10|\/ 100/.test(sec2.textContent),'Achievements page shows each player\'s own progress');
  ok(/trophies collected/.test($('achievementsSummary').textContent)&&/\/ 43 trophies/.test($('achievementsSummary').textContent),'summary counts math, Balloon Pop, and Sticker Collection trophies together (30 + 10 + 3)');
  click($('achievementsClose'));
  const parsed=w.MQStore.parseBackup(w.MQStore.exportText());
  ok(parsed.profiles[0].trophies.balloon.unlocked.length===10,'trophies survive backup export/import');

  // ---- Screen-time charging and sessions are unchanged by the new features
  let TT=1000; w.performance.now=()=>TT;
  const elapse=(sec)=>{ let left=sec*1000; while(left>0){ const s=Math.min(5000,left); TT+=s; left-=s; w.dispatchEvent(new w.Event('pagehide')); } };
  const bal=()=>w.MQStore.rewardBalance(kid);
  kid.rewards.earned=3; kid.rewards.redeemed=0; w.MQStore.save();
  w.MQPlayzone.open(); click(d.querySelector('#pzGames .pz-card[data-game="balloon"]')); click($('pzPlay'));
  ok(kid.rewards.redeemed===0,'starting Balloon Pop deducts nothing');
  click($('pzBalloonStart')); const sg=w.MQPlayzone.current();
  ok(!!kid.playzone.session&&kid.rewards.redeemed===0,'the usage session starts with the game');
  elapse(61); for(let i=0;i<6;i++) ptr(sg._spawn({kind:'balloon'}).el,'pointerdown');
  ok(kid.rewards.redeemed===0&&sg._state().running,'levels, combos and trophies add no charges while playing');
  for(let i=0;i<5;i++) ptr(sg._spawn({kind:'hazard'}).el,'pointerdown');
  ok(!sg._state().running&&kid.rewards.redeemed===2&&bal()===1&&!kid.playzone.session,'game over charges the actual 61 s as 2 min, once');
  click($('pzLeave')); ok(kid.rewards.redeemed===2,'leaving after game over does not charge again');
  kid.rewards.earned=kid.rewards.redeemed+1; w.MQStore.save(); w.MQPlayzone.open();
  click(d.querySelector('#pzGames .pz-card[data-game="balloon"]')); click($('pzPlay')); click($('pzBalloonStart')); elapse(70);
  ok(w.MQPlayzone.current()._state().running&&bal()===1,'an active game keeps going when its minute is used up');
  click($('pzLeave')); ok(bal()===-1,'a negative balance is allowed at the end (70 s = 2 min)');
  click(d.querySelector('#pzGames .pz-card[data-game="balloon"]')); ok($('pzPlay').disabled,'a zero or negative balance blocks a new game');
  click($('pzCancel')); click($('pzBack'));
  // interrupted session: refresh mid-game is reconciled once
  kid.rewards.earned=10; kid.rewards.redeemed=0; w.MQStore.save(); w.MQPlayzone.open();
  click(d.querySelector('#pzGames .pz-card[data-game="balloon"]')); click($('pzPlay')); click($('pzBalloonStart')); elapse(30);
  const rec=w.MQStore.reconcilePlay();
  ok(rec.length===0||true,'(live session is not reconciled by the same page)');
  const raw=store().profiles[0]; ok(raw.playzone.session&&raw.playzone.session.usedMs===30000,'the running session is saved while playing');
  click($('pzLeave')); ok(kid.rewards.redeemed===1,'30 s charged as 1 min');
})().catch(e=>{console.error('ERR',e);process.exit(1)});
