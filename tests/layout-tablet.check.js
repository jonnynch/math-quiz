// iPad gameplay: the question, figure and every answer must be on screen without scrolling, in portrait and landscape,
// Solo and 1 vs 1, with Normal / Large / Extra large text and the colour-blind palette. Clock questions get the full viewport list;
// every other question type is checked on a few key sizes so the tablet rules cannot break them. Env: VP, REPS, TEXTS, CHROME_PATH.
// Viewports are CSS pixels: mini, 10.2", Air / Pro 11", Pro 13" at full height and with the Safari toolbars showing.
const chromium=require('@sparticuz/chromium').default||require('@sparticuz/chromium');
const puppeteer=require('puppeteer-core');
const launch=async()=>puppeteer.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH,args:['--no-sandbox'],headless:true}:{executablePath:await chromium.executablePath(),args:[...chromium.args,'--no-sandbox'],headless:'shell'});
const url=require('url').pathToFileURL(require('path').join(__dirname,'..','public','index.html')).href;
const PORTRAIT=['744x1133','744x1024','810x1080','810x1010','820x1180','820x1080','834x1194','834x1114','1024x1366','1024x1286'];
const LANDSCAPE=['1133x744','1133x670','1080x810','1080x730','1180x820','1180x750','1194x834','1194x754','1366x1024','1366x946','1024x768','1024x694'];
const parse=(l)=>l.map(s=>s.split('x').map(Number));
const CLOCK_VPS=parse((process.env.VP||[...PORTRAIT,...LANDSCAPE].join(',')).split(','));
const OTHER_VPS=parse((process.env.VP||'744x1024,820x1080,1133x744,1024x694').split(','));
const TEXTS=(process.env.TEXTS||'normal,large,xlarge').split(',');
const REPS=Number(process.env.REPS||1);
const MIN_TOUCH=44; // px: smallest answer button allowed on a tablet (the layout itself aims for 48px x text scale)
const OTHER=[['toddler'],['age4'],['age5'],['age6'],['grade1','mixed'],['grade2','shapes'],['grade3','fractions'],['grade4','money'],['grade3','compare'],['grade6','mixed'],['grade2','tables']];
(async()=>{
  const browser=await launch(); const page=await browser.newPage();
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  const problems=[]; let checks=0;
  const run=async(text,W,H,mode,lv,topic,lv2)=>{
    await page.setViewport({width:W,height:H,isMobile:true,hasTouch:true,deviceScaleFactor:1});
    await page.goto(url);
    await page.evaluate((mode,lv,topic,lv2)=>{
      document.querySelector(`[data-mode=${mode}]`).click();
      const set=(n,l,t)=>{const d=document.getElementById('difficulty'+n);d.value=l;d.dispatchEvent(new Event('change'));if(t) document.getElementById('topic'+n).value=t;};
      set(1,lv,topic); if(mode==='versus') set(2,lv2,topic);
      document.getElementById('profile1').value='a1'; if(mode==='versus') document.getElementById('profile2').value='b2';
      document.getElementById('startButton').click();
    },mode,lv,topic,lv2);
    await new Promise(r=>setTimeout(r,50));
    // stress: streak badge and a long feedback message
    await page.evaluate(()=>{
      document.querySelectorAll('.score-name').forEach(n=>{const b=document.createElement('span');b.className='streak-badge';b.textContent='🔥 15';n.append(b);});
      const f=document.getElementById('roundFeedback'); f.className='round-feedback success'; f.textContent='🦊 Maximilian-Joe answered correctly! +1 point · 🔥 15 in a row! New sticker 🦄';
    });
    const res=await page.evaluate((mode,MIN_TOUCH,clock,text)=>{
      const H=innerHeight,W=innerWidth,out=[],de=document.documentElement;
      const boards=document.querySelectorAll('.question-board');
      if(boards.length!==(mode==='solo'?1:2)) out.push(`expected ${mode==='solo'?1:2} boards, found ${boards.length}`);
      if(de.scrollWidth>W+1) out.push('horizontal overflow');
      if(de.scrollHeight>H+1) out.push(`needs vertical scroll ${de.scrollHeight}>${H}`);
      const chk=(el,name)=>{const r=el.getBoundingClientRect(); if(r.bottom>H+.5||r.top<-.5||r.right>W+.5||r.left<-.5) out.push(`${name} outside viewport`);};
      boards.forEach((b,i)=>{
        chk(b,`board${i}`); chk(b.querySelector('.question-text'),`board${i} question`);
        const f=b.querySelector('.figure'); if(f){chk(f,`board${i} figure`); if(clock&&f.getBoundingClientRect().height<90) out.push(`board${i} clock too small`);} else if(clock) out.push(`board${i} has no clock`);
        const st=b.querySelector('.object-stage,.counting-visual'); if(st) chk(st,`board${i} objects`);
        const btns=b.querySelectorAll('.answer-button'); if(btns.length<3) out.push(`board${i} has ${btns.length} answers`); if(clock&&btns.length!==5) out.push(`board${i} has ${btns.length} answers`);
        btns.forEach((a,j)=>{chk(a,`board${i} answer${j}`); if(a.getBoundingClientRect().height<MIN_TOUCH) out.push(`board${i} answer${j} too small`); if(a.scrollWidth>a.clientWidth+1) out.push(`board${i} answer${j} text overflow`);});
        // side by side: question side (info) on the left, all answers on the right. Expected in landscape, in Solo portrait and in
        // 1 vs 1 portrait once the screen is tall enough for two stacked boards (940px, 1010px at Extra large text; see style.css).
        const expectSide=W>H||mode==='solo'||H>=(text==='xlarge'?1010:940);
        if(expectSide){const info=b.querySelector('.board-info').getBoundingClientRect(),g=b.querySelector('.answer-grid').getBoundingClientRect(); if(info.right>g.left+1) out.push(`board${i} question and answers not side by side`);}
        const bb=b.getBoundingClientRect(); b.querySelectorAll('*').forEach(e=>{const r=e.getBoundingClientRect(); if(r.width&&(r.right>bb.right+1||r.bottom>bb.bottom+1)) out.push(`board${i} ${(e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className)||e.tagName} spills out of its board`);});
      });
      chk(document.getElementById('roundFeedback'),'feedback'); chk(document.getElementById('stopButton'),'stop button');
      document.querySelectorAll('.score-card').forEach((c,i)=>{chk(c,'score'+i); const cr=c.getBoundingClientRect(),sv=c.querySelector('.score-value').getBoundingClientRect(); if(sv.right>cr.right+.5||sv.left<cr.left-.5) out.push('score number outside its card'+i);});
      return [...new Set(out)];
    },mode,MIN_TOUCH,topic==='clock',text);
    checks++; if(res.length) problems.push(`${text} ${W}x${H} ${mode} ${lv}/${topic||'-'}: ${res.slice(0,3).join('; ')}`);
  };
  for(const text of TEXTS){
    await page.evaluateOnNewDocument((s)=>{ localStorage.setItem('mathQuizBattle.v1',s); },JSON.stringify({settings:{palette:text==='normal'?'standard':'cb',text},profiles:[
      {id:'a1',name:'Maximilian-Joe',avatar:'🦊',stickers:[],totals:{},bests:{},history:[],created:1},
      {id:'b2',name:'Wilhelmina Rose',avatar:'🐼',stickers:[],totals:{},bests:{},history:[],created:2}]}));
    for(const [W,H] of CLOCK_VPS) for(const mode of ['solo','versus']) for(let r=0;r<REPS;r++) await run(text,W,H,mode,'grade4','clock','grade1');
    for(const [W,H] of OTHER_VPS) for(const mode of ['solo','versus']) for(const [lv,topic] of OTHER) await run(text,W,H,mode,lv,topic,lv);
  }
  console.log('tablet layout checks',checks,'problems',problems.length);
  problems.slice(0,25).forEach(p=>console.log('  ',p));
  process.exitCode=problems.length?1:0; await browser.close();
})();
