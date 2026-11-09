// Clock questions (5 answers + analogue clock) on phones held sideways: question, clock and every answer must be on screen
// without scrolling, in Solo and 1 vs 1, at all text sizes, with the colour-blind palette and reduced motion. Env: VP, REPS, CHROME_PATH.
const chromium=require('@sparticuz/chromium').default||require('@sparticuz/chromium');
const puppeteer=require('puppeteer-core');
const launch=async()=>puppeteer.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH,args:['--no-sandbox'],headless:true}:{executablePath:await chromium.executablePath(),args:[...chromium.args,'--no-sandbox'],headless:'shell'});
const url=require('url').pathToFileURL(require('path').join(__dirname,'..','public','index.html')).href;
const VIEWPORTS=(process.env.VP||'568x280,640x312,667x300,667x375,720x312,844x390,932x430').split(',').map(s=>s.split('x').map(Number));
const REPS=Number(process.env.REPS||3);
const MIN_TOUCH=30; // px: smallest answer button allowed (the layout itself aims for 32px x text scale)
(async()=>{
  const browser=await launch(); const page=await browser.newPage();
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  const seed=(text)=>JSON.stringify({settings:{palette:text==='normal'?'standard':'cb',text},profiles:[
    {id:'a1',name:'Maximilian-Joe',avatar:'🦊',stickers:[],totals:{},bests:{},history:[],created:1},
    {id:'b2',name:'Wilhelmina Rose',avatar:'🐼',stickers:[],totals:{},bests:{},history:[],created:2}]});
  const problems=[]; let checks=0;
  for(const text of ['normal','large','xlarge']){
    for(const [W,H] of VIEWPORTS){
      await page.setViewport({width:W,height:H,isMobile:true,hasTouch:true,deviceScaleFactor:1});
      for(const mode of ['solo','versus']){
        for(let rep=0;rep<REPS;rep++){
          await page.evaluateOnNewDocument((s)=>{ localStorage.setItem('mathQuizBattle.v1',s); },seed(text));
          await page.goto(url);
          await page.evaluate((mode)=>{
            document.querySelector(`[data-mode=${mode}]`).click();
            const set=(n,l)=>{const d=document.getElementById('difficulty'+n);d.value=l;d.dispatchEvent(new Event('change'));document.getElementById('topic'+n).value='clock';};
            set(1,'grade4'); if(mode==='versus') set(2,'grade1');
            document.getElementById('profile1').value='a1'; if(mode==='versus') document.getElementById('profile2').value='b2';
            document.getElementById('startButton').click();
          },mode);
          await new Promise(r=>setTimeout(r,60));
          const res=await page.evaluate((mode,MIN_TOUCH)=>{
            const H=innerHeight,W=innerWidth,out=[],de=document.documentElement;
            const boards=document.querySelectorAll('.question-board');
            if(boards.length!==(mode==='solo'?1:2)) out.push(`expected ${mode==='solo'?1:2} boards, found ${boards.length}`);
            if(de.scrollWidth>W+1) out.push('horizontal overflow');
            if(de.scrollHeight>H+1) out.push(`needs vertical scroll ${de.scrollHeight}>${H}`);
            const chk=(el,name)=>{const r=el.getBoundingClientRect(); if(r.bottom>H+.5||r.top<-.5||r.right>W+.5||r.left<-.5) out.push(`${name} outside viewport`);};
            boards.forEach((b,i)=>{
              if(!b.querySelector('.figure-clock')) out.push(`board${i} has no clock`);
              chk(b,`board${i}`); chk(b.querySelector('.question-text'),`board${i} question`);
              const f=b.querySelector('.figure-clock'); if(f){chk(f,`board${i} clock`); if(f.getBoundingClientRect().height<48) out.push(`board${i} clock too small`);}
              const btns=b.querySelectorAll('.answer-button'); if(btns.length!==5) out.push(`board${i} has ${btns.length} answers`);
              btns.forEach((a,j)=>{chk(a,`board${i} answer${j}`); if(a.getBoundingClientRect().height<MIN_TOUCH) out.push(`board${i} answer${j} too small`); if(a.scrollWidth>a.clientWidth+1) out.push(`board${i} answer${j} text overflow`);});
              const lbl=b.querySelector('.player-label'); if(lbl.getBoundingClientRect().height>26) out.push(`board${i} player name wraps`);
            });
            return [...new Set(out)];
          },mode,MIN_TOUCH);
          checks++; if(res.length) problems.push(`${text} ${W}x${H} ${mode}: ${res.slice(0,3).join('; ')}`);
        }
      }
    }
  }
  console.log('clock layout checks',checks,'problems',problems.length);
  problems.slice(0,20).forEach(p=>console.log('  ',p));
  process.exitCode=problems.length?1:0; await browser.close();
})();
