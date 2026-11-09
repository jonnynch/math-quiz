const {JSDOM}=require('jsdom');const fs=require('fs');const path=require('path');
// Read-aloud and sound effects in jsdom: availability/fallback, speech stops, sounds respect the setting, persistence.
const dir=path.join(__dirname,'..','public')+'/';
const html=fs.readFileSync(dir+'index.html','utf8').replace(/<script src="[^"]+"><\/script>/g,'');
const SCRIPTS=['questions.js','trophies.js','parent.js','report.js','store.js','audio.js','menus.js','game.js'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failures=0;
const ok=(cond,msg)=>{console.log((cond?'PASS ':'FAIL ')+msg); if(!cond) failures++;};

// Boots a fresh page. opts: speech (fake speechSynthesis), audio ('ok' | 'throws' | none), seed (saved localStorage text).
function boot({speech=true,audio='ok',seed=null}={}){
  const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  if(seed) w.localStorage.setItem('mathQuizBattle.v1',seed);
  const log=[];const tones=[];
  if(speech){
    w.SpeechSynthesisUtterance=function(text){this.text=text;};
    w.speechSynthesis={speak:u=>log.push('speak:'+u.text),cancel:()=>log.push('cancel')};
  }
  if(audio==='ok'||audio==='throws'){
    w.AudioContext=function(){
      if(audio==='throws') throw new Error('blocked');
      this.state='suspended';this.currentTime=0;this.destination={};
      this.resume=()=>Promise.reject(new Error('needs gesture'));
      this.createGain=()=>({gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}});
      this.createOscillator=()=>{const o={frequency:{},connect(){},start(){tones.push(o.frequency.value);},stop(){}};return o;};
    };
  }
  SCRIPTS.forEach(f=>w.eval(fs.readFileSync(dir+f,'utf8')));
  const d=w.document;const $=id=>d.getElementById(id);
  const tap=b=>b.dispatchEvent(new w.Event('pointerdown',{bubbles:true,cancelable:true}));
  const setLevel=v=>{$('difficulty1').value=v;$('difficulty1').dispatchEvent(new w.Event('change',{bubbles:true}));};
  const setSetting=(name,value)=>d.querySelector(`[data-setting=${name}][data-value=${value}]`).click();
  const answers=()=>[...d.querySelectorAll('.question-board')[0].querySelectorAll('.answer-button')];
  const store=()=>JSON.parse(w.localStorage.getItem('mathQuizBattle.v1')||'{}');
  // Solo: tap answers in order; wrong ones are disabled and the player keeps trying until the correct one.
  const solveByTapping=()=>{let wrong=0;for(const b of answers()){tap(b);if(b.classList.contains('correct'))break;if(b.classList.contains('wrong'))wrong++;}return wrong;};
  return {w,d,$,log,tones,tap,setLevel,setSetting,answers,store,solveByTapping};
}

(async()=>{
  // ---- spoken symbols
  const A=boot().w.MQAudio;
  ok(A.spokenText('What is 7 + 5?')==='What is 7 plus 5?','"+" is read as "plus"');
  ok(A.spokenText('What is 9 − 4?')==='What is 9 minus 4?'&&A.spokenText('8 - 3')==='8 minus 3','minus (− and -) is read as "minus"');
  ok(A.spokenText('What is 6 × 7?')==='What is 6 times 7?'&&A.spokenText('What is 12 ÷ 4?')==='What is 12 divided by 4?','× and ÷ are read as "times" and "divided by"');
  ok(A.spokenText('3 + ? = 10')==='3 plus what equals 10','a blank "?" is read as "what" and "=" as "equals"');
  ok(A.spokenText('1/2 + 1/4 = ? (simplest form)')==='1 over 2 plus 1 over 4 equals what (simplest form)','fractions are read as "over"');
  ok(A.spokenText('Compare: 4 ? 9')==='Compare 4 and 9'&&A.spokenText('< (less than)')==='less than'&&A.spokenText('= (equal to)')==='equal to','comparison questions and answers are read in words');
  ok(A.spokenText('You have 50c, $1. How many cents altogether?')==='You have 50 cents, 1 dollars. How many cents altogether?','money symbols are read in words');
  ok(A.questionSpeech({question:'What is 2 + 3?',answers:['4','5','6'],simple:false})==='What is 2 plus 3? A, 4. B, 5. C, 6.','questions are read with lettered answers');
  ok(A.questionSpeech({question:'How many apples?',answers:['2','3'],simple:true})==='How many apples? 2. 3.','youngest boards (no letters on screen) are read without letters');

  // ---- defaults, no noise, no Listen buttons
  let g=boot();
  ok(g.w.MQStore.getSettings().readAloud==='off'&&g.w.MQStore.getSettings().sound==='off','read-aloud and sound effects are off by default');
  g.setLevel('age4');g.$('startButton').click();await sleep(80);
  ok(g.log.length<=1&&!g.log.some(x=>x.startsWith('speak:')),'nothing is spoken while read-aloud is off');
  ok(g.d.documentElement.dataset.readAloud==='off','Listen buttons are hidden while read-aloud is off');
  const wrongOff=g.solveByTapping();
  ok(g.tones.length===0,'no sounds play while sound effects are off (correct or wrong)');
  ok(g.d.querySelector('.answer-button.correct')&&g.d.querySelectorAll('.score-value')[0].textContent==='1','answer handling and scoring are unchanged (wrong taps: '+wrongOff+')');

  // ---- sounds on: correct and wrong are different, and respect the setting
  g=boot();g.setSetting('sound','on');
  ok(g.store().settings.sound==='on'&&g.w.MQStore.getSettings().readAloud==='off','Sound effects setting saved; read-aloud separate');
  ok(g.w.MQAudio.playSound('correct')===true&&g.tones.length===2&&g.tones[0]>600,'correct sound: two short rising notes');
  const before=g.tones.length;
  ok(g.w.MQAudio.playSound('wrong')===true&&g.tones.length===before+1&&g.tones[before]<300,'wrong sound: one soft low note');
  g.setSetting('sound','off');
  const n=g.tones.length;g.w.MQAudio.playSound('correct');g.w.MQAudio.playSound('wrong');
  ok(g.tones.length===n,'turning sound effects off silences both sounds');

  // ---- in a real game: taps play sounds only when on
  g=boot();g.setSetting('sound','on');g.setLevel('age5');g.$('startButton').click();await sleep(80);
  const wrongOn=g.solveByTapping();
  ok(g.tones.filter(t=>t>600).length===2&&g.tones.filter(t=>t<300).length===wrongOn,`one correct sound and ${wrongOn} wrong sound(s) during a game`);

  // ---- blocked audio never breaks the game
  g=boot({audio:'throws'});g.setSetting('sound','on');g.setLevel('age4');g.$('startButton').click();await sleep(80);
  ok(g.w.MQAudio.playSound('correct')===false,'playSound returns false when the browser blocks audio');
  g.solveByTapping();
  ok(g.d.querySelectorAll('.score-value')[0].textContent==='1','a blocked audio device does not stop scoring');
  g=boot({audio:'none'});g.setSetting('sound','on');
  ok(g.w.MQAudio.playSound('correct')===false,'no AudioContext: silent, no error');

  // ---- read-aloud: control, auto-read (Solo, Age 2-6), replay, stops
  g=boot();g.setSetting('readAloud','on');
  ok(g.d.documentElement.dataset.readAloud==='on'&&g.store().settings.readAloud==='on','read-aloud setting applied and saved');
  g.setLevel('age6');g.$('startButton').click();await sleep(80);
  const speaks=()=>g.log.filter(x=>x.startsWith('speak:'));
  ok(g.d.querySelector('.speak-button')&&speaks().length===1,'Listen button present and the Age 2-6 question is read once automatically');
  ok(/plus|minus|how many|what|\d/i.test(speaks()[0])&&!/[+−×÷=]/.test(speaks()[0]),'the spoken text uses words, not maths symbols');
  g.log.length=0;g.d.querySelector('.speak-button').click();
  ok(g.log[0]==='cancel'&&g.log[1].startsWith('speak:'),'Listen replays the question (cancels the old speech first, never queues)');
  const questionText=g.d.querySelector('.question-text').textContent;
  g.d.querySelector('.speak-button').dispatchEvent(new g.w.Event('pointerdown',{bubbles:true,cancelable:true}));
  ok(g.d.querySelector('.question-text').textContent===questionText&&!g.d.querySelector('.answer-button.wrong'),'Listen does not answer or change the question');
  g.log.length=0;g.solveByTapping();
  ok(g.log.includes('cancel'),'speech stops when the question is answered correctly');
  g.log.length=0;await sleep(2000);
  ok(g.d.getElementById('roundNumber').textContent==='2'&&g.log[0]==='cancel'&&speaks().length===1,'speech is cancelled before the next question is read');
  g.log.length=0;g.$('stopButton').click();
  ok(g.log.includes('cancel')&&!g.$('resultPanel').classList.contains('hidden'),'speech stops when the game is stopped');
  g.log.length=0;g.$('changeSetupButton').click();
  ok(g.log.includes('cancel'),'speech stops when leaving the game screen');
  g.log.length=0;g.d.dispatchEvent(new g.w.Event('visibilitychange'));g.w.dispatchEvent(new g.w.Event('pagehide'));
  ok(g.log.includes('cancel'),'speech stops when the page is hidden');

  // ---- not automatic outside Solo Age 2-6, but the button still works
  g=boot();g.setSetting('readAloud','on');g.setLevel('grade3');g.$('startButton').click();await sleep(80);
  ok(g.log.filter(x=>x.startsWith('speak:')).length===0&&!!g.d.querySelector('.speak-button'),'Grade levels: no automatic speech, Listen button available');
  g=boot();g.setSetting('readAloud','on');g.d.querySelector('[data-mode=versus]').click();g.setLevel('age4');g.$('startButton').click();await sleep(80);
  ok(g.log.filter(x=>x.startsWith('speak:')).length===0&&g.d.querySelectorAll('.speak-button').length===2,'1 vs 1: no automatic speech, one Listen button per player');

  // ---- speech unavailable: hidden/disabled gracefully, game unaffected
  g=boot({speech:false});
  ok(g.$('readAloudUnavailable').classList.contains('hidden')===false&&[...g.d.querySelectorAll('[data-setting=readAloud]')].every(b=>b.disabled),'no speechSynthesis: read-aloud setting disabled with a short note');
  g.setSetting('readAloud','on');
  g.setLevel('age4');g.$('startButton').click();await sleep(80);
  ok(g.d.querySelectorAll('.speak-button').length===0,'no speechSynthesis: no Listen button is created');
  g.solveByTapping();
  ok(g.d.querySelectorAll('.score-value')[0].textContent==='1','no speechSynthesis: the game plays normally');
  const broken=boot();broken.w.speechSynthesis.speak=()=>{throw new Error('boom');};
  ok(broken.w.MQAudio.speak('hello')===false,'a speech error is caught and never reaches the game');

  // ---- persistence after reload, and backup compatibility
  g=boot();g.setSetting('readAloud','on');g.setSetting('sound','on');
  const saved=g.w.localStorage.getItem('mathQuizBattle.v1');
  const reloaded=boot({seed:saved});
  ok(reloaded.w.MQStore.getSettings().readAloud==='on'&&reloaded.w.MQStore.getSettings().sound==='on','both settings survive a reload');
  ok(reloaded.d.documentElement.dataset.readAloud==='on'&&reloaded.d.querySelector('[data-setting=sound][data-value=on]').classList.contains('selected'),'reloaded page shows the saved choices');
  const old=boot({seed:JSON.stringify({schema:2,settings:{palette:'cb',text:'large'},profiles:[]})});
  ok(old.w.MQStore.getSettings().palette==='cb'&&old.w.MQStore.getSettings().readAloud==='off'&&old.w.MQStore.getSettings().sound==='off','saved data from before these settings loads with both off');
  const junk=boot({seed:JSON.stringify({schema:2,settings:{readAloud:'loud',sound:7},profiles:[]})});
  ok(junk.w.MQStore.getSettings().readAloud==='off'&&junk.w.MQStore.getSettings().sound==='off','invalid saved values fall back to off');
  ok(reloaded.w.MQStore.setSetting('sound','maybe').error&&reloaded.w.MQStore.setSetting('readAloud','x').error,'setSetting rejects values other than on/off');
  reloaded.w.MQStore.addProfile('Mia','🐼');
  const exported=JSON.parse(reloaded.w.MQStore.exportText());
  const parsed=reloaded.w.MQStore.parseBackup(JSON.stringify({app:'mathQuizBattle',schema:2,settings:{palette:'standard',text:'normal'},profiles:[{id:'p1',name:'Mia'}]}));
  ok(!parsed.error&&parsed.settings.readAloud==='off'&&parsed.settings.sound==='off','an older backup file (without these settings) is still importable');
  ok(exported.app==='mathQuizBattle'&&exported.schema===2&&exported.settings.sound==='on'&&reloaded.w.MQStore.parseBackup(JSON.stringify(exported)).settings.readAloud==='on','backup export includes the settings and imports back');

  process.exit(failures?1:0);
})();
