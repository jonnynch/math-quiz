// Playzone in a real browser: layout on iPad and phone sizes, real taps through the parent question, PNG export of the
// designer, balloons rising, Reaction Battle GO detection. Env: CHROME_PATH (optional, see docs/TESTING.md).
const chromium=require('@sparticuz/chromium').default||require('@sparticuz/chromium');
const puppeteer=require('puppeteer-core');
const {solveHard}=require('./parent-solver');
const launch=async()=>puppeteer.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH,args:['--no-sandbox'],headless:true}:{executablePath:await chromium.executablePath(),args:[...chromium.args,'--no-sandbox'],headless:'shell'});
const url=require('url').pathToFileURL(require('path').join(__dirname,'..','public','index.html')).href;
const OUT=require('fs').mkdtempSync(require('path').join(require('os').tmpdir(),'mq-pz-'));
const VPS=[[1024,768],[1180,820],[1366,1024],[768,1024],[844,390]];
const seed=JSON.stringify({schema:2,settings:{palette:'standard',text:'normal'},profiles:[{id:'k1',name:'Kid',avatar:'🦊',created:1,stickers:[],rewards:{earned:30,redeemed:0}}]});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser=await launch();
  const page=await browser.newPage();
  const problems=[];
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.evaluateOnNewDocument(s=>{ localStorage.setItem('mathQuizBattle.v1',s); },seed);
  const $=(sel)=>page.$(sel);
  const evalp=(fn,...a)=>page.evaluate(fn,...a);
  const overflow=async(tag,label)=>{const x=await evalp(()=>document.documentElement.scrollWidth-innerWidth);if(x>1)problems.push(`${tag} ${label}: horizontal overflow ${x}px`);};
  const fits=async(tag,label)=>{const r=await evalp(()=>document.documentElement.scrollHeight-innerHeight);if(r>1)problems.push(`${tag} ${label}: needs vertical scrolling (${r}px)`);};
  const redeemStart=async(id)=>{ // real taps: game card, then Play (no parent question)
    await page.click(`#pzGames .pz-card[data-game="${id}"]`);
    await page.click('#pzPlay');
    await page.waitForSelector('#pzStageView:not(.hidden)',{timeout:3000});
    if(await evalp(()=>!!document.getElementById('pzChallenge'))) problems.push('a parent question appeared when starting a game');
  };
  const leave=async()=>{ await page.click('#pzLeave'); await page.waitForSelector('#pzMenuView:not(.hidden)'); };
  for(const [W,H] of VPS){
    const tag=`${W}x${H}`;
    const ipadLandscape=W>=1024&&W>H;
    await page.setViewport({width:W,height:H,deviceScaleFactor:1});
    await page.goto(url);
    await overflow(tag,'main menu');
    if(!(await evalp(()=>{const b=document.getElementById('playzoneButton').getBoundingClientRect();return b.width>100&&b.height>=44&&b.left>=0&&b.right<=innerWidth;}))) problems.push(`${tag} Playzone button missing or too small`);
    await page.click('#playzoneButton');
    await overflow(tag,'playzone menu');
    const cards=await evalp(()=>[...document.querySelectorAll('#pzGames .pz-card')].map(c=>{const r=c.getBoundingClientRect();return {l:r.left,r:r.right,w:r.width,h:r.height};}));
    if(cards.length!==3) problems.push(`${tag} expected 3 game cards, got ${cards.length}`);
    if(cards.some(c=>c.l<0||c.r>W||c.w<150||c.h<150)) problems.push(`${tag} game cards outside the screen or too small`);
    if(ipadLandscape) await fits(tag,'playzone menu');
    if(W===1024) await page.screenshot({path:`${OUT}/menu_${tag}.png`});

    // ---- Designer
    await redeemStart('designer'); await overflow(tag,'designer choose');
    await page.click('.pz-pick-pizza'); await overflow(tag,'designer');
    for(const t of ['cheese','pepperoni','mushroom','olive','tomato','basil']) await page.click(`.pz-deco[data-deco="${t}"]`);
    // drag one decoration from the panel onto the canvas with the mouse
    const from=await evalp(()=>{const r=document.querySelector('.pz-deco[data-deco="pepperoni"]').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
    const to=await evalp(()=>{const r=document.querySelector('.pz-canvas').getBoundingClientRect();return {x:r.left+r.width*.3,y:r.top+r.height*.3};});
    await page.mouse.move(from.x,from.y); await page.mouse.down(); await page.mouse.move(to.x,to.y,{steps:6}); await page.mouse.up();
    const placed=await evalp(()=>document.querySelectorAll('.pz-canvas .pz-item').length);
    if(placed!==7) problems.push(`${tag} designer: expected 7 decorations, got ${placed}`);
    const geo=await evalp(()=>{const c=document.querySelector('.pz-canvas').getBoundingClientRect();const d=[...document.querySelectorAll('.pz-deco')].map(b=>b.getBoundingClientRect());return {cw:c.width,cb:c.bottom,minTap:Math.min(...d.map(r=>Math.min(r.width,r.height))),dBottom:Math.max(...d.map(r=>r.bottom)),H:innerHeight};});
    if(geo.minTap<44) problems.push(`${tag} designer: decoration buttons smaller than 44px (${Math.round(geo.minTap)})`);
    if(ipadLandscape){ await fits(tag,'designer'); if(geo.cw<400) problems.push(`${tag} designer canvas too small (${Math.round(geo.cw)}px)`); }
    if(W===1024||W===844) await page.screenshot({path:`${OUT}/designer_${tag}.png`});
    if(W===1024||W===768){
      // PNG export in the real browser
      await page.click('#pzSave'); await page.waitForSelector('.pz-save-img',{timeout:5000});
      const png=await evalp(async()=>{
        const img=document.querySelector('.pz-save-img'); await img.decode();
        const bytes=new Uint8Array(await (await fetch(img.src)).arrayBuffer());
        const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight; const x=c.getContext('2d'); x.drawImage(img,0,0);
        const px=(a,b)=>[...x.getImageData(a,b,1,1).data].slice(0,3);
        return {sig:[...bytes.slice(0,8)],w:img.naturalWidth,h:img.naturalHeight,corner:px(3,3),centre:px(512,512),name:document.querySelector('.pz-save-link').download,size:bytes.length};
      });
      const sig=png.sig.join()==='137,80,78,71,13,10,26,10';
      if(!sig||png.w!==1024||png.h!==1024) problems.push(`${tag} PNG export is not a 1024px PNG (${png.sig.join()} ${png.w}x${png.h})`);
      if(png.name!=='my-pizza.png') problems.push(`${tag} PNG file name ${png.name}`);
      if(png.corner.join()!=='255,244,224') problems.push(`${tag} PNG corner is not the plain background: ${png.corner}`);
      if(png.centre.join()===png.corner.join()) problems.push(`${tag} PNG centre shows no creation`);
      if(W===1024){ await page.screenshot({path:`${OUT}/save_${tag}.png`}); console.log(`PNG export ok: ${png.size} bytes, ${png.name}`); }
      await page.click('.pz-save .secondary-button:last-child');
      if(await evalp(()=>!!document.querySelector('.pz-save'))) problems.push(`${tag} save window did not close`);
    }
    await leave();

    // ---- Balloon Pop
    await redeemStart('balloon'); await overflow(tag,'balloon intro');
    await page.click('#pzBalloonStart'); await overflow(tag,'balloon');
    const visible=()=>{const s=document.querySelector('.pz-sky').getBoundingClientRect();return [...document.querySelectorAll('.pz-balloon:not(.popped)')].find(b=>{const r=b.getBoundingClientRect();return r.top>s.top+10&&r.bottom<s.bottom-10;});};
    await page.waitForFunction(`(${visible.toString()})()`,{timeout:8000});
    const b0=await evalp((fn)=>{const b=eval(`(${fn})()`);b.dataset.track='1';const r=b.getBoundingClientRect();return {top:r.top,w:r.width,h:r.height};},visible.toString());
    await sleep(300);
    const b1=await evalp(()=>{const b=document.querySelector('[data-track="1"]');const r=b.getBoundingClientRect();return {top:r.top,x:r.left+r.width/2,y:r.top+r.height/2};});
    if(!(b1.top<b0.top-5)) problems.push(`${tag} balloon is not moving up (${b0.top} -> ${b1.top})`);
    if(b0.w<60||b0.h<60) problems.push(`${tag} balloon too small to tap (${Math.round(b0.w)}x${Math.round(b0.h)})`);
    await page.mouse.click(b1.x,b1.y);
    const score=await evalp(()=>document.querySelector('.pz-score').textContent);
    if(!/⭐ 1\b/.test(score)) problems.push(`${tag} tapping a balloon did not score (${score})`);
    if(W===1024) await page.screenshot({path:`${OUT}/balloon_${tag}.png`});
    await leave();

    // ---- Reaction Battle
    await redeemStart('reaction'); await overflow(tag,'reaction setup');
    await page.click('[data-bestof="3"]');
    const rect=await evalp(()=>[...document.querySelectorAll('.pz-side')].map(s=>{const r=s.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,h:r.height};}));
    if(!(rect[0].r<=rect[1].l+1&&rect[0].l>=0&&rect[1].r<=W)) problems.push(`${tag} reaction: players are not side by side`);
    if(rect[0].h<150||rect[0].b>H+1&&ipadLandscape) problems.push(`${tag} reaction: buttons too small or below the screen (${Math.round(rect[0].h)}px, bottom ${Math.round(rect[0].b)})`);
    await overflow(tag,'reaction');
    if(W===1024){
      await page.click('.pz-side[data-player="1"]'); await page.click('.pz-side[data-player="2"]');
      const waiting=await evalp(()=>document.querySelector('.pz-reaction').dataset.phase);
      if(waiting!=='waiting') problems.push(`${tag} reaction: not waiting after both ready (${waiting})`);
      await page.screenshot({path:`${OUT}/reaction_wait_${tag}.png`});
      await page.waitForFunction(()=>document.querySelector('.pz-reaction').dataset.phase==='go',{timeout:6000});
      await page.screenshot({path:`${OUT}/reaction_go_${tag}.png`});
      await page.click('.pz-side[data-player="2"]');
      const res=await evalp(()=>({b:document.querySelector('.pz-banner').textContent,w:document.querySelectorAll('.pz-side.winner').length}));
      if(!res.b.includes('Player 2')||res.w!==1) problems.push(`${tag} reaction: GO tap by Player 2 did not win cleanly (${res.b}, winners ${res.w})`);
    }
    await leave();
    // parent adjustment now lives on the Screen-time page: back to the main menu, open Screen time, hard question, controls
    await page.click('#pzBack');
    const back=await evalp(()=>!document.getElementById('setupPanel').classList.contains('hidden'));
    if(!back) problems.push(`${tag} Back did not return to the main menu`);
    await page.click('#bankButton');
    await page.click('#bankAdjustButton');
    await overflow(tag,'parent question');
    const hq=await evalp(()=>document.getElementById('bankAdjChallenge').textContent);
    await page.type('#bankAdjAnswer',solveHard(hq));
    await page.click('#bankAdjust button.primary-button');
    await page.waitForSelector('#bankAdjAmount',{timeout:3000});
    await overflow(tag,'parent controls');
    if(W===1024||W===844) await page.screenshot({path:`${OUT}/parent_${tag}.png`});
    await page.click('#bankAdjAdd'); await page.click('#bankAdjConfirm');
    const msg=await evalp(()=>document.getElementById('bankAdjMessage').textContent);
    const m=msg.match(/Before: (-?\d+) min → After: (-?\d+) min/);
    if(!m||Number(m[2])!==Number(m[1])+5) problems.push(`${tag} parent adjust message unexpected: ${msg}`);
    await page.click('#bankClose');
    const balance=await evalp(()=>{const d=JSON.parse(localStorage.getItem('mathQuizBattle.v1'));return d.profiles[0].rewards.redeemed;});
    if(!(balance>=1&&balance<=4)) problems.push(`${tag} expected 1-4 min charged for the games played (actual usage, at least 1 per started session), got ${balance}`);
  }
  errors.forEach(e=>problems.push('page error: '+e));
  console.log('problems',problems.length,'| screenshots in',OUT); problems.forEach(p=>console.log(' ',p));
  process.exitCode=problems.length?1:0;
  await browser.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
