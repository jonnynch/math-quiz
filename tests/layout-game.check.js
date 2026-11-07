// Game screen in a real browser across phone sizes (landscape), text sizes and topics. Env: VP, TEXTS, REPS, SHOW, CHROME_PATH.
const chromium=require('@sparticuz/chromium').default||require('@sparticuz/chromium');
const puppeteer=require('puppeteer-core');
const launch=async()=>puppeteer.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH,args:['--no-sandbox'],headless:true}:{executablePath:await chromium.executablePath(),args:[...chromium.args,'--no-sandbox'],headless:'shell'});
const url=require('url').pathToFileURL(require('path').join(__dirname,'..','public','index.html')).href;
const VIEWPORTS=(process.env.VP||'568x280,667x300,740x320,800x300,844x340,844x390,932x360').split(',').map(s=>s.split('x').map(Number));
const TEXTS=(process.env.TEXTS||'normal,large,xlarge').split(',');
const CONFIGS=[['toddler'],['age4'],['age5'],['age6'],['grade1','clock'],['grade2','shapes'],['grade3','fractions'],['grade4','clock'],['grade5','fractions'],['grade6','shapes'],['grade6','mixed'],['grade4','money'],['grade3','compare'],['grade4','mixed'],['grade2','tables']];
const REPS=Number(process.env.REPS||2);
(async()=>{
  const browser=await launch();
  const page=await browser.newPage();
  // seed two profiles with long names (and use the colour-blind palette for some runs)
  const seed=(text,palette)=>JSON.stringify({settings:{palette,text},profiles:[
    {id:'a1',name:'Maximilian-Joe',avatar:'🦊',stickers:[],totals:{},bests:{},history:[],created:1},
    {id:'b2',name:'Wilhelmina Rose',avatar:'🐼',stickers:[],totals:{},bests:{},history:[],created:2}]});
  const problems=[];let checks=0;
  for(const text of TEXTS){
    for(const [W,H] of VIEWPORTS){
      await page.setViewport({width:W,height:H,isMobile:true,hasTouch:true,deviceScaleFactor:1});
      await page.evaluateOnNewDocument((s)=>{ if(!localStorage.getItem('seeded')){localStorage.setItem('mathQuizBattle.v1',s);localStorage.setItem('seeded','1');} },seed(text,text==='xlarge'?'cb':'standard'));
      await page.goto(url); await page.evaluate((text)=>{localStorage.setItem('mathQuizBattle.v1',localStorage.getItem('mathQuizBattle.v1').replace(/"text":"[a-z]+"/,`"text":"${text}"`)); },text);
      await page.reload();
      for(const mode of ['solo','versus']){
        for(const timed of [false,true]){
          for(const [lv,topic] of CONFIGS){
            for(let rep=0;rep<REPS;rep++){
              const lv2=mode==='versus'?CONFIGS[(CONFIGS.findIndex(c=>c[0]===lv&&c[1]===topic)+5)%CONFIGS.length]:null;
              await page.evaluate((mode,lv,topic,lv2,timed)=>{
                document.getElementById('changeSetupButton').click();
                document.querySelector(`[data-mode=${mode}]`).click();
                document.querySelector(`[data-length=${timed?'timed':'endless'}]`).click();
                const set=(n,l,t)=>{const d=document.getElementById('difficulty'+n);d.value=l;d.dispatchEvent(new Event('change'));if(t){const s=document.getElementById('topic'+n);s.value=t;}};
                set(1,lv,topic); if(lv2) set(2,lv2[0],lv2[1]);
                const p1=document.getElementById('profile1'); p1.value='a1'; if(lv2){document.getElementById('profile2').value='b2';}
                document.getElementById('startButton').click();
              },mode,lv,topic,lv2,timed);
              await new Promise(r=>setTimeout(r,50));
              // stress: streak badge, long feedback message
              await page.evaluate(()=>{
                document.querySelectorAll('.score-name').forEach(n=>{const b=document.createElement('span');b.className='streak-badge';b.textContent='🔥 15';n.append(b);});
                document.getElementById('roundFeedback').className='round-feedback success';
                document.getElementById('roundFeedback').textContent='🦊 Maximilian-Joe answered correctly! +1 point · 🔥 15 in a row! New sticker 🦄';
              });
              const res=await page.evaluate(()=>{
                const H=innerHeight,W=innerWidth,out=[];
                const de=document.documentElement;
                if(de.scrollWidth>W+1) out.push(`horizontal overflow ${de.scrollWidth}>${W}`);
                if(de.scrollHeight>H+1) out.push(`needs vertical scroll ${de.scrollHeight}>${H}`);
                const chk=(el,name)=>{const r=el.getBoundingClientRect(); if(r.bottom>H+0.5||r.top<-0.5||r.right>W+0.5||r.left<-0.5) out.push(`${name} outside viewport`);};
                document.querySelectorAll('.question-board').forEach((b,i)=>{chk(b,'board'+i);
                  b.querySelectorAll('.answer-button').forEach((a,j)=>{chk(a,`board${i} answer${j}`); if(a.scrollWidth>a.clientWidth+1) out.push(`board${i} answer text overflow`);});
                  const q=b.querySelector('.question-text'); chk(q,`board${i} question`); if(q.scrollWidth>q.clientWidth+1) out.push(`board${i} question overflow`);
                  const st=b.querySelector('.object-stage,.counting-visual,.figure'); if(st) chk(st,`board${i} objects/figure`);
                  const bb=b.getBoundingClientRect(); b.querySelectorAll('*').forEach(e=>{const r=e.getBoundingClientRect(); if(r.width&&(r.right>bb.right+1||r.bottom>bb.bottom+1)) out.push(`board${i} ${e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className||e.tagName} spills out of board`);});
                });
                chk(document.getElementById('roundFeedback'),'feedback'); chk(document.getElementById('stopButton'),'stop button');
                const cd=document.getElementById('countdown'); if(!cd.classList.contains('hidden')) chk(cd,'countdown');
                document.querySelectorAll('.score-card').forEach((c,i)=>{chk(c,'score'+i); const cr=c.getBoundingClientRect(); const sv=c.querySelector('.score-value').getBoundingClientRect(); if(sv.right>cr.right+0.5||sv.left<cr.left-0.5) out.push('score number outside its card'+i); const n=c.querySelector('.score-name'); if(n.scrollWidth>c.clientWidth) out.push('score name overflow'+i);});
                return [...new Set(out)];
              });
              checks++;
              if(res.length) problems.push(`${text} ${W}x${H} ${mode}${timed?' timed':''} ${lv}/${topic}${lv2?' + '+lv2.join('/'):''}: ${res.slice(0,3).join('; ')}`);
            }
          }
        }
      }
    }
  }
  console.log('checks',checks,'problems',problems.length);
  const agg={};problems.forEach(p=>{const parts=p.split(': ');const head=parts[0].split(' ');const k=head[0]+' '+head[1]+' | '+parts.slice(1).join(': ').replace(/\d+/g,'#').slice(0,100);agg[k]=(agg[k]||0)+1;});
  Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,30).forEach(([k,v])=>console.log(v,k));
  if(process.env.SHOW) problems.slice(0,Number(process.env.SHOW)).forEach(p=>console.log('  e.g.',p));
  await browser.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
