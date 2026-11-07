// Setup, Settings/Profiles windows, game and result screens on phones, tablets and desktop. Env: CHROME_PATH.
const chromium=require('@sparticuz/chromium').default||require('@sparticuz/chromium');
const puppeteer=require('puppeteer-core');
const launch=async()=>puppeteer.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH,args:['--no-sandbox'],headless:true}:{executablePath:await chromium.executablePath(),args:[...chromium.args,'--no-sandbox'],headless:'shell'});
const url=require('url').pathToFileURL(require('path').join(__dirname,'..','public','index.html')).href;
const OUT=require('fs').mkdtempSync(require('path').join(require('os').tmpdir(),'mq-shots-'));
const VPS=[[667,300],[844,390],[390,844],[360,640],[768,1024],[1280,800]];
const mkProfile=(id,name,av,n)=>({id,name,avatar:av,created:n,stickers:['🦄','🐶','🚀','🌟','🎈','🍕','🏆'],totals:{games:12,correct:140,taps:170,correctTaps:140,bestStreak:11},bests:{'grade3|fractions|60':14,'grade2|tables|30':9},history:Array.from({length:5},(_,i)=>({t:Date.now()-i*86400000,level:'grade3',topic:'fractions',mode:'solo',seconds:60,score:10+i,taps:14,correctTaps:10+i,avgTime:3.1,streak:4})),lastSetup:{difficulty:'grade3',topic:'fractions'}});
const seed=JSON.stringify({settings:{palette:'cb',text:'normal'},profiles:[mkProfile('a1','Maximilian-Joe','🦊',1),mkProfile('b2','Wilhelmina Rose','🐼',2),mkProfile('c3','Leo','🦁',3)]});
(async()=>{
  const browser=await launch();
  const page=await browser.newPage();
  const problems=[];
  for(const [W,H] of VPS){
    for(const text of ['normal','xlarge']){
      await page.setViewport({width:W,height:H,isMobile:W<1000,hasTouch:W<1000,deviceScaleFactor:1});
      await page.evaluateOnNewDocument((s,t)=>{ localStorage.setItem('mathQuizBattle.v1',s.replace('"text":"normal"',`"text":"${t}"`)); },seed,text);
      await page.goto(url);
      const tag=`${text} ${W}x${H}`;
      const overflow=async(label)=>{const r=await page.evaluate(()=>({x:document.documentElement.scrollWidth-innerWidth}));if(r.x>1)problems.push(`${tag} ${label}: horizontal overflow ${r.x}px`);};
      // setup (versus shows both player configs)
      await page.evaluate(()=>{document.querySelector('[data-mode=versus]').click();document.querySelector('[data-length=timed]').click();document.getElementById('profile1').value='a1';document.getElementById('profile2').value='b2';});
      await overflow('setup');
      // modals
      for(const [open,modal,close] of [['settingsButton','settingsModal','settingsClose'],['profilesButton','profilesModal','profilesClose']]){
        await page.evaluate((o)=>document.getElementById(o).click(),open);
        if(modal==='profilesModal') await page.evaluate(()=>{const b=[...document.querySelectorAll('.profile-card .secondary-button')].find(x=>x.textContent==='Details');b&&b.click();});
        const m=await page.evaluate((id)=>{const e=document.querySelector('#'+id+' .modal');const r=e.getBoundingClientRect();const done=document.querySelector('#'+id+' .primary-button').getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,H:innerHeight,W:innerWidth,doneTop:done.top,doneBottom:done.bottom,scrolls:e.scrollHeight>e.clientHeight+1};},modal);
        if(m.top<-0.5||m.bottom>m.H+0.5||m.left<-0.5||m.right>m.W+0.5) problems.push(`${tag} ${modal} outside viewport`);
        if(m.doneTop<0||m.doneBottom>m.H) problems.push(`${tag} ${modal} Done button not visible without scrolling`);
        if(W===667&&H===300&&text==='normal'||W===390&&text==='normal'&&modal==='profilesModal') await page.screenshot({path:OUT+`/shot_${modal}_${W}x${H}.png`});
        await page.evaluate((c)=>document.getElementById(c).click(),close);
      }
      // play a short timed game, then check result screen
      await page.evaluate(()=>{document.getElementById('duration').innerHTML='<option value="1" selected>1</option>';document.getElementById('difficulty1').value='grade3';document.getElementById('difficulty1').dispatchEvent(new Event('change'));document.getElementById('topic1').value='clock';document.getElementById('difficulty2').value='grade2';document.getElementById('difficulty2').dispatchEvent(new Event('change'));document.getElementById('topic2').value='shapes';document.getElementById('startButton').click();});
      await new Promise(r=>setTimeout(r,120));
      await overflow('game');
      { const bad=await page.evaluate(()=>[...document.querySelectorAll('.score-card')].some(c=>{const a=c.getBoundingClientRect(),b=c.querySelector('.score-value').getBoundingClientRect();return b.right>a.right+0.5||b.left<a.left-0.5})); if(bad) problems.push(`${tag} score number outside its card`); }
      if(text==='normal'&&[[667,300],[390,844],[1280,800]].some(v=>v[0]===W)) await page.screenshot({path:OUT+`/shot_game_${W}x${H}.png`});
      await new Promise(r=>setTimeout(r,1300));
      await page.evaluate(()=>{ // make the result card show stars/stickers/best by injecting content like the game does
        const card=document.querySelector('.final-score'); if(card){ const s=document.createElement('div'); s.className='star-rating'; s.textContent='⭐⭐☆'; card.append(s); const b=document.createElement('div'); b.className='best-badge'; b.textContent='🏅 New personal best!'; card.append(b); const e=document.createElement('div'); e.className='earned-stickers'; e.innerHTML='<span>New stickers</span><div class="sticker-row">🦄 🚀 🌟</div>'; card.append(e);} });
      await overflow('result');
      const vis=await page.evaluate(()=>!document.getElementById('resultPanel').classList.contains('hidden'));
      if(!vis) problems.push(`${tag} result panel not shown`);
      if(text==='normal'&&[[667,300],[390,844]].some(v=>v[0]===W)) await page.screenshot({path:OUT+`/shot_result_${W}x${H}.png`});
    }
  }
  console.log('problems',problems.length,'| screenshots in',OUT); problems.forEach(p=>console.log(' ',p));
  process.exitCode = problems.length ? 1 : 0;
  await browser.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
