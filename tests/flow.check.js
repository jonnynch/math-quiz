const {JSDOM}=require('jsdom');const fs=require('fs');
// End-to-end UI flow in jsdom: topics, profiles, settings, streaks, stickers, personal bests, saving.
const dir=require('path').join(__dirname,'..','public')+'/';
const html=fs.readFileSync(dir+'index.html','utf8').replace(/<script src="[^"]+"><\/script>/g,'');
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
['questions.js','store.js','menus.js','game.js'].forEach(f=>w.eval(fs.readFileSync(dir+f,'utf8')));
const d=w.document;
const $=id=>d.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tap=b=>b.dispatchEvent(new w.Event('pointerdown',{bubbles:true,cancelable:true}));
const click=b=>b.click();
const change=(sel,val)=>{sel.value=val;sel.dispatchEvent(new w.Event('change',{bubbles:true}));};
const ok=(cond,msg)=>{console.log((cond?'PASS ':'FAIL ')+msg); if(!cond) process.exitCode=1;};
const btns=(i=0)=>[...d.querySelectorAll('.question-board')[i].querySelectorAll('.answer-button')];
const solve=(i=0)=>{ // answers tables / compare questions
  const t=d.querySelectorAll('.question-board')[i].querySelector('.question-text').textContent;
  let m;
  if(m=t.match(/^What is (\d+) (×|÷) (\d+)\?$/)) return String(m[2]==='×'?+m[1]*+m[3]:+m[1]/+m[3]);
  if(m=t.match(/^(\d+) × \? = (\d+)$/)) return String(+m[2]/+m[1]);
  if(m=t.match(/^Compare: (\d+) \? (\d+)$/)) return +m[1]<+m[2]?'<':+m[1]===+m[2]?'=':'>';
  throw new Error('cannot solve '+t);
};
const answerBtn=(i=0)=>{const a=solve(i);return btns(i).find(b=>{const txt=b.textContent.replace(/^[A-E]\. /,'');return txt===a||txt.startsWith(a+' ');});};
const wrongBtn=(i=0)=>btns(i).find(b=>b!==answerBtn(i));
const store=()=>JSON.parse(w.localStorage.getItem('mathQuizBattle.v1')||'{}');

(async()=>{
  // ---- topics only for grades
  const topicIds=s=>[...$(s).options].map(o=>o.value);
  ok(!$('topicRow1').classList.contains('hidden'),'topic row visible for default Grade 3');
  ok(topicIds('topic1').join()==='mixed,add,sub,mul,div,tables,compare,fractions,money,clock,shapes','Grade 3 has all 11 topics');
  change($('difficulty1'),'grade1');
  ok(topicIds('topic1').join()==='mixed,add,sub,compare,fractions,money,clock,shapes','Grade 1 excludes multiplication, division and times tables');
  change($('difficulty1'),'grade5');
  ok(topicIds('topic1').join()==='mixed,add,sub,mul,div,fractions,shapes','Grade 5 topics are arithmetic, fractions, shapes');
  for(const lv of ['toddler','age4','age5','age6']){ change($('difficulty1'),lv); ok($('topicRow1').classList.contains('hidden'),`no topic row for ${lv}`); }
  change($('difficulty1'),'grade3');

  // ---- settings
  click($('settingsButton')); ok(!$('settingsModal').classList.contains('hidden'),'settings window opens');
  click(d.querySelector('[data-setting=palette][data-value=cb]')); click(d.querySelector('[data-setting=text][data-value=large]'));
  ok(d.documentElement.dataset.palette==='cb'&&d.documentElement.dataset.text==='large','palette and text size applied to the page');
  ok(store().settings.palette==='cb'&&store().settings.text==='large','settings saved');
  click($('settingsClose')); ok($('settingsModal').classList.contains('hidden'),'settings window closes');
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));

  // ---- profiles
  click($('profilesButton')); ok(!$('profilesModal').classList.contains('hidden'),'profiles window opens');
  $('profileName').value='   '; click($('addProfileButton')); ok($('profileMessage').textContent.includes('name'),'empty name rejected');
  $('profileName').value='<b>Mia</b>'; click($('addProfileButton'));
  ok(store().profiles.length===1&&store().profiles[0].name==='<b>Mia</b>'.slice(0,14),'profile saved (name kept as plain text)');
  ok(!d.querySelector('#profileList b'),'profile names are shown as text, not HTML');
  $('profileName').value='Leo'; click(d.querySelectorAll('.avatar-button')[3]); click($('addProfileButton'));
  ok(store().profiles.length===2,'second profile added');
  $('profileName').value='leo'; click($('addProfileButton')); ok($('profileMessage').textContent.includes('already'),'duplicate name rejected');
  ok($('profile1').value===store().profiles[0].id,'new profile auto-selected for Player 1');
  click($('profilesClose'));

  // ---- play solo as first profile: Grade 2 times tables
  change($('difficulty1'),'grade2'); change($('topic1'),'tables');
  click($('startButton')); await sleep(80);
  const mia=()=>store().profiles[0];
  ok(d.querySelector('.score-name').textContent.includes('<b>Mia'),'scoreboard shows the profile name');
  ok(d.querySelector('.score-detail').textContent==='Grade 2 · Times tables','scoreboard shows level and topic');
  ok(d.body.classList.contains('playing'),'playing class set');
  tap(answerBtn()); await sleep(900);
  ok(!d.querySelector('.streak-badge'),'no streak badge after 1 correct');
  tap(answerBtn()); ok(!!d.querySelector('.streak-badge')&&d.querySelector('.streak-badge').textContent.includes('2'),'streak badge appears at 2 in a row'); await sleep(900);
  tap(answerBtn());
  const fb=$('roundFeedback').textContent;
  ok(fb.includes('3 in a row')&&fb.includes('New sticker'),'3 in a row shows streak message and a new sticker: '+fb);
  ok(d.querySelectorAll('.confetto').length>=50,'confetti launched ('+d.querySelectorAll('.confetto').length+' pieces)');
  ok(store().profiles[0].stickers.length===1,'sticker saved to the profile immediately');
  await sleep(900);
  tap(wrongBtn()); ok(!d.querySelector('.streak-badge'),'wrong answer resets the streak');
  tap(answerBtn()); await sleep(900);
  click($('stopButton'));
  const st=mia();
  ok(st.totals.games===1&&st.totals.correct===4&&st.totals.taps===5&&st.totals.correctTaps===4&&st.totals.bestStreak===3,'profile totals saved: '+JSON.stringify(st.totals));
  ok(st.history.length===1&&st.history[0].level==='grade2'&&st.history[0].topic==='tables'&&st.history[0].mode==='solo','game added to history');
  ok(st.lastSetup.difficulty==='grade2'&&st.lastSetup.topic==='tables','last level and topic remembered');
  const card=$('finalScores').textContent;
  ok(card.includes('⭐')&&card.includes('Best streak')&&card.includes('🔥 3')&&card.includes('New stickers'),'result card shows stars, best streak and new stickers');
  ok(d.querySelector('.star-rating').textContent==='⭐⭐☆','4 of 5 answers correct = 80% → 2 stars');

  // ---- lastSetup restored when the profile is chosen again
  click($('changeSetupButton'));
  change($('profile1'),''); change($('difficulty1'),'age5');
  change($('profile1'),mia().id);
  ok($('difficulty1').value==='grade2'&&$('topic1').value==='tables','choosing the profile restores Grade 2 · Times tables');

  // ---- versus: duplicates blocked, timed game, personal best
  click(d.querySelector('[data-mode=versus]'));
  const leoId=store().profiles[1].id;
  change($('profile2'),mia().id);
  ok($('profile1').querySelector(`option[value="${mia().id}"]`)!==null,'profile options present');
  ok([...$('profile1').options].find(o=>o.value===mia().id).disabled===false||true,'(duplicate check below)');
  change($('profile2'),leoId);
  ok([...$('profile1').options].find(o=>o.value===leoId).disabled===true,'Player 1 cannot pick the profile Player 2 chose');
  ok([...$('profile2').options].find(o=>o.value===mia().id).disabled===true,'Player 2 cannot pick the profile Player 1 chose');
  change($('difficulty2'),'grade3'); change($('topic2'),'compare'); change($('difficulty1'),'grade3'); change($('topic1'),'compare');
  click(d.querySelector('[data-length=timed]')); $('duration').innerHTML='<option value="1" selected>1</option>';
  click($('startButton')); await sleep(80);
  ok(d.querySelectorAll('.question-board').length===2,'two boards in 1 vs 1');
  tap(answerBtn(0));
  ok(d.querySelector('.score-card.orange')&&true,'scoreboard rendered');
  await sleep(1300);
  ok(!$('resultPanel').classList.contains('hidden')&&$('resultEyebrow').textContent.includes('TIME'),'timed versus game ended');
  ok(mia().bests['grade3|compare|1']===1,'best timed score recorded for the level/topic: '+JSON.stringify(mia().bests));
  ok(store().profiles[1].history.length===0&&store().profiles[1].totals.games===0,'player 2 (never tapped) not recorded');
  // second timed game, higher score → new personal best
  click($('rematchButton')); await sleep(80);
  tap(answerBtn(0)); await sleep(900); tap(answerBtn(0)); await sleep(500);
  await sleep(700);
  ok(!$('resultPanel').classList.contains('hidden'),'second game ended');
  ok($('finalScores').textContent.includes('New personal best'),'new personal best badge shown');

  // ---- profile details + delete (two taps)
  click($('changeSetupButton')); click($('profilesButton'));
  const detailsBtn=[...d.querySelectorAll('.profile-card .secondary-button')].find(b=>b.textContent==='Details'); click(detailsBtn);
  ok(d.querySelectorAll('.sticker-book .sticker').length===24&&d.querySelectorAll('.sticker-book .sticker:not(.locked)').length===1,'sticker book shows 24 stickers, 1 collected');
  ok(d.querySelector('.detail-list').textContent.length>0,'recent games listed');
  const delBtn=()=>[...d.querySelectorAll('.profile-card .secondary-button.danger')][1];
  click(delBtn()); ok(delBtn().textContent.includes('again'),'delete asks for a second tap');
  click(delBtn()); ok(store().profiles.length===1&&$('profile1').options.length===2,'profile deleted after second tap; selectors updated');
  click($('profilesClose'));

  // ---- backup: copy text, import (merge / replace / undo), error messages
  click($('profilesButton'));
  click($('copyBackupButton')); await sleep(30);
  const copied=$('exportText').value;
  ok(!$('exportText').classList.contains('hidden')&&JSON.parse(copied).app==='mathQuizBattle','copy backup shows the backup text when the clipboard is unavailable');
  click($('importToggleButton')); ok(!$('importPanel').classList.contains('hidden'),'import panel opens');
  $('importText').value='not json'; click($('checkImportButton')); ok($('backupMessage').classList.contains('error'),'invalid backup shows an error message');
  const backup=JSON.parse(copied); backup.profiles.push({id:'extra1',name:'Nina',avatar:'🐙',stickers:['🐱']}); backup.profiles[0].name='Mia';
  $('importText').value=JSON.stringify(backup); click($('checkImportButton'));
  ok(!$('importPreview').classList.contains('hidden')&&$('importSummary').textContent.includes('Found 2 profiles'),'valid backup shows a preview before anything changes');
  ok(store().profiles.length===1,'nothing is changed by only checking the backup');
  click($('importMergeButton'));
  ok(store().profiles.length===2&&store().profiles.some(p=>p.name==='Nina'),'merge adds the new profile');
  ok($('backupMessage').textContent.includes('added')&&!$('undoImportButton').classList.contains('hidden'),'import summary shown and Undo offered');
  ok($('profile1').options.length===3,'profile selectors updated after import');
  click($('undoImportButton')); ok(store().profiles.length===1&&$('backupMessage').textContent.includes('undone'),'undo restores the previous profiles');
  click($('importToggleButton')); $('importText').value=JSON.stringify(backup); click($('checkImportButton'));
  click($('importReplaceButton')); ok(store().profiles.length===1,'replace needs a second tap (nothing replaced yet)');
  click($('importReplaceButton')); ok(store().profiles.length===2,'second tap replaces everything with the backup');
  click($('profilesClose'));

  // ---- failed saves are reported for settings changes and profile deletion
  const realSetItem=w.Storage.prototype.setItem;
  w.Storage.prototype.setItem=function(){ throw new Error('QuotaExceededError'); };
  click($('settingsButton'));
  ok($('settingsMessage').classList.contains('hidden'),'no settings warning when nothing failed');
  click(d.querySelector('[data-setting=text][data-value=xlarge]'));
  ok(!$('settingsMessage').classList.contains('hidden')&&$('settingsMessage').textContent.includes('would not save'),'settings change shows a warning when the browser cannot save');
  ok(d.documentElement.dataset.text==='xlarge','the setting still applies for this session');
  w.Storage.prototype.setItem=realSetItem;
  click(d.querySelector('[data-setting=text][data-value=large]'));
  ok($('settingsMessage').classList.contains('hidden'),'the warning clears after a successful save');
  click($('settingsClose'));
  click($('profilesButton'));
  ok($('profileListMessage').classList.contains('hidden'),'no profile warning before deleting');
  w.Storage.prototype.setItem=function(){ throw new Error('QuotaExceededError'); };
  const delFailBtn=()=>[...d.querySelectorAll('.profile-card .secondary-button.danger')][0];
  const profilesBeforeFail=store().profiles.length;
  click(delFailBtn()); click(delFailBtn());
  ok(!$('profileListMessage').classList.contains('hidden')&&$('profileListMessage').textContent.includes('would not save'),'deleting a profile shows a warning when the browser cannot save');
  ok($('profile1').options.length===profilesBeforeFail,'the profile is removed from the selectors for this session');
  w.Storage.prototype.setItem=realSetItem;
  click($('profilesClose'));
  // restore the saved data to what the next section expects
  click($('profilesButton')); $('profileName').value='Mia2'; click($('addProfileButton')); click($('profilesClose'));
  click($('settingsButton')); click(d.querySelector('[data-setting=text][data-value=normal]')); click($('settingsClose'));

  // ---- guest streak stickers are not saved
  change($('profile1'),''); change($('profile2'),'');
  click(d.querySelector('[data-mode=solo]')); click(d.querySelector('[data-length=endless]'));
  change($('difficulty1'),'grade3'); change($('topic1'),'compare');
  const gamesBefore=store().profiles[0].totals.games, countBefore=store().profiles.length;
  click($('startButton')); await sleep(80);
  for(let i=0;i<3;i++){ tap(answerBtn()); await sleep(900); }
  click($('stopButton'));
  ok($('finalScores').textContent.includes('create a profile to keep them'),'guest sees the "create a profile" hint for stickers');
  ok(store().profiles.length===countBefore&&store().profiles[0].totals.games===gamesBefore,'guest game did not change saved profiles');
  process.exit(process.exitCode||0);
})().catch(e=>{console.error('ERROR',e);process.exit(1)});
