// Validates every generated question for every level and topic (correct answer, order, ranges, no duplicates).
const path=require('path');
const Q=require(path.join(__dirname,'..','public','questions.js'));
const gcd=(a,b)=>b?gcd(b,a%b):a;
const frac=s=>{const m=s.match(/^(\d+)\/(\d+)$/);return m?[+m[1],+m[2]]:[+s,1]};
const val=s=>{const [n,d]=frac(s);return n/d};
let total=0; const fails={};
const fail=(k,msg,q)=>{ (fails[k]=fails[k]||[]).push(msg+' :: '+JSON.stringify(q)); };
const N=3000;
// Grade 1 and the age levels (Age 2-3 to Grade 1 curriculum) are checked in tests/questions-early.check.js.
const grades=[2,3,4,5,6];
for(const g of grades){
  for(const t of Q.topicsFor('grade'+g)){
    const k=`g${g}/${t.value}`; const pos={};
    for(let i=0;i<N;i++){
      const q=Q.generateQuestion('grade'+g,t.value); total++;
      const a=q.answers, c=q.correct;
      if(!(c>=0&&c<a.length)) {fail(k,'bad correct index',q);continue}
      if(new Set(a).size!==a.length) fail(k,'duplicate answers',q);
      if(a.some(x=>x===''||x==null)) fail(k,'empty answer',q);
      pos[c]=(pos[c]||0)+1;
      const text=q.question, ans=a[c];
      const numeric=a.every(x=>!isNaN(Number(x)));
      if(numeric){ const n=a.map(Number); if(n.some((v,j)=>j&&v<=n[j-1])) fail(k,'not ascending',q); if(n.some(v=>v<0)) fail(k,'negative',q); }
      // topic specific verification
      let m;
      if(t.value==='mixed'||t.value==='add'||t.value==='sub'||t.value==='mul'||t.value==='div'||t.value==='tables'){
        if((m=text.match(/^What is (\d+) (\+|−|×|÷) (\d+)\?$/))){const x=+m[1],y=+m[3];const r={'+':x+y,'−':x-y,'×':x*y,'÷':x/y}[m[2]]; if(r!==Number(ans)||!Number.isInteger(r)) fail(k,'wrong arithmetic',q);
          const allowed={mixed:g===1?'+−':'+−×÷',add:'+',sub:'−',mul:'×',div:'÷',tables:'×÷'}[t.value]; if(!allowed.includes(m[2])) fail(k,'operator not allowed '+m[2],q);
          if(g>=4){const last=ans.slice(-1); if(!a.some((x,j)=>j!==c&&x.slice(-1)===last)) fail(k,'no same last digit',q);}
        } else if((m=text.match(/^(\d+) × \? = (\d+)$/))){ if(+m[1]*Number(ans)!==+m[2]) fail(k,'wrong missing factor',q);} else fail(k,'unrecognised text',q);
        if(t.value==='tables'){ /* tables restricted ranges */ if((m=text.match(/^What is (\d+) × (\d+)\?$/))&&g===2&&![2,5,10].includes(+m[1])&&![2,5,10].includes(+m[2])) fail(k,'g2 table out of range',q);}
      }
      if(t.value==='compare'){ m=text.match(/^Compare: (\d+) \? (\d+)$/); if(!m) fail(k,'compare text',q); else{const x=+m[1],y=+m[2];const exp=x<y?0:x===y?1:2; if(c!==exp) fail(k,'wrong compare',q); const max=[0,20,99,999,9999][g]; if(x>max||y>max) fail(k,'compare range',q);} if(a.length!==3) fail(k,'compare answers',q);}
      if(t.value==='money'){ const nn=Number(ans); if(m=text.match(/^You have (.+)\. How many cents altogether\?$/)){const s=m[1].split(', ').reduce((s,x)=>s+(x.startsWith('$')?100*+x.slice(1):+x.slice(0,-1)),0); if(s!==nn) fail(k,'coins wrong',q);}
        else if(m=text.match(/^Something costs (\d+)c\. You pay (\S+)\. How many cents change\?$/)){const pay=m[2].startsWith('$')?100*+m[2].slice(1):+m[2].slice(0,-1); if(pay-m[1]!==nn||pay-m[1]<=0) fail(k,'change wrong',q);}
        else if(m=text.match(/^A pen costs (\d+)c and a rubber costs (\d+)c/)){ if(+m[1]+ +m[2]!==nn) fail(k,'sum wrong',q);}
        else if(m=text.match(/^(\d+) stickers cost (\d+)c each/)){ if(m[1]*m[2]!==nn) fail(k,'qty wrong',q);}
        else if(m=text.match(/^A book costs (\d+)c\. You pay \$(\d+)/)){ if(m[2]*100-m[1]!==nn||nn<=0) fail(k,'book change wrong',q);}
        else fail(k,'money text',q);}
      if(t.value==='clock'){ const f=q.figure; if(!f||f.type!=='clock') {fail(k,'no clock figure',q);} else { const lbl=`${f.hour}:${String(f.minute).padStart(2,'0')}`; if(ans!==lbl) fail(k,'clock label mismatch',q);
          const mins=a.map(x=>{const [h,mm]=x.split(':').map(Number);return (h%12)*60+mm}); if(mins.some((v,j)=>j&&v<=mins[j-1])) fail(k,'clock not sorted',q);
          const step=[0,30,15,5,1][g]; if(f.minute%step!==0) fail(k,'clock minute grid',q);} }
      if(t.value==='shapes'){ if(g<=2){ if(!q.figure||q.figure.type!=='polygon'||String(q.figure.sides)!==ans) fail(k,'polygon mismatch',q);} 
        else if(g===3 && (m=text.match(/^How many (faces|edges|vertices) does a (.+) have\?$/))){const S={'cube':[6,12,8],'rectangular prism':[6,12,8],'triangular prism':[5,9,6],'square pyramid':[5,8,5],'triangular pyramid':[4,6,4]}[m[2]];const idx={faces:0,edges:1,vertices:2}[m[1]]; if(S[idx]!==+ans) fail(k,'solid wrong',q);}
        else if(g===3 && (m=text.match(/^How many sides does a (\w+) have\?$/))){const n={triangle:3,square:4,pentagon:5,hexagon:6,heptagon:7,octagon:8,nonagon:9,decagon:10}[m[1]]; if(n!==+ans) fail(k,'polygon name wrong',q);}
        else if(m=text.match(/third angle/)){ const mm=text.match(/angles of (\d+)° and (\d+)°/); if(180-mm[1]-mm[2]!==+ans||+ans<=0) fail(k,'triangle angle',q);}
        else if(m=text.match(/^A rectangle is (\d+) cm long and (\d+) cm wide\. What is its (perimeter in cm|area in cm²)\?$/)){ const exp=m[3].startsWith('perimeter')?2*(+m[1]+ +m[2]):m[1]*m[2]; if(exp!==+ans) fail(k,'rect wrong',q);}
        else if(m=text.match(/^A square has sides of (\d+) cm/)){ if(m[1]*m[1]!==+ans) fail(k,'square wrong',q);}
        else if(m=text.match(/^A triangle has a base of (\d+) cm and a height of (\d+) cm/)){ if(m[1]*m[2]/2!==+ans||(m[1]*m[2])%2) fail(k,'tri area wrong',q);}
        else if(m=text.match(/^A parallelogram has a base of (\d+) cm and a height of (\d+) cm/)){ if(m[1]*m[2]!==+ans) fail(k,'para wrong',q);}
        else if(m=text.match(/^A quadrilateral has angles of (\d+)°, (\d+)° and (\d+)°/)){ if(360-m[1]-m[2]-m[3]!==+ans||+ans<=0) fail(k,'quad wrong',q);}
        else fail(k,'unrecognised shapes text',q);}
      if(t.value==='fractions'){
        if(m=text.match(/^What is half of (\d+)\?$/)){ if(m[1]/2!==+ans) fail(k,'half wrong',q);}
        else if(m=text.match(/^What is (\d+)\/(\d+) of (\d+)\?$/)){ if(m[1]*m[3]/m[2]!==+ans||!Number.isInteger(m[3]/m[2])) fail(k,'fraction of amount wrong',q);}
        else if(m=text.match(/^(\d+)\/(\d+) = \?\/(\d+)$/)){ if(m[1]/m[2]!==+ans/m[3]) fail(k,'equiv wrong',q);}
        else if(m=text.match(/^Compare: (\d+)\/(\d+) \? (\d+)\/(\d+)$/)){ const x=m[1]/m[2],y=m[3]/m[4]; const exp=Math.abs(x-y)<1e-12?1:x<y?0:2; if(c!==exp) fail(k,'frac compare wrong',q);}
        else if(m=text.match(/^(\d+)\/(\d+) ([+−×÷]) (\d+)(?:\/(\d+))? = \? \(simplest form\)$/)){
          const x=m[1]/m[2]; const y=m[5]?m[4]/m[5]:+m[4]; const r={'+':x+y,'−':x-y,'×':x*y,'÷':x/y}[m[3]]; if(Math.abs(val(ans)-r)>1e-9) fail(k,'frac arithmetic wrong',q);
          const [n,d]=frac(ans); if(gcd(n,d)!==1&&d!==1) fail(k,'not simplest',q); if(r<=0) fail(k,'non-positive result',q);
          const vals=a.map(val); if(vals.some((v,j)=>j&&v<=vals[j-1]+1e-12)) fail(k,'fractions not sorted',q);}
        else if(m=text.match(/^How many 1\/(\d+)s are in (\d+)\?$/)){ if(m[1]*m[2]!==+ans) fail(k,'howmany wrong',q);}
        else if(m=text.match(/^What is 1\/(\d+) of (\d+)\?$/)){ if(m[2]/m[1]!==+ans) fail(k,'unit frac wrong',q);}
        else fail(k,'unrecognised fraction text',q);
      }
    }
    // position spread check
    const n=Object.keys(pos).length; const exp=1/ (q0(g,t)); 
    global.POS=global.POS||{}; global.POS[k]=pos;
  }
}
function q0(g,t){return 1}
// "Mixed All Questions" (topic 'all'): every category the grade offers must appear, and nothing else.
for(const g of grades){
  const avail=new Set(Q.topicsFor('grade'+g).map(t=>t.value)); const k=`g${g}/all`; const seen={};
  for(let i=0;i<3000;i++){
    const q=Q.generateQuestion('grade'+g,'all'); total++; const x=q.question;
    if(!(q.correct>=0&&q.correct<q.answers.length)||new Set(q.answers).size!==q.answers.length) fail(k,'bad question',q);
    let cat;
    if(q.figure&&q.figure.type==='clock') cat='clock';
    else if(q.figure&&q.figure.type==='polygon') cat='shapes';
    else if(/^Compare: \d+ \? \d+$/.test(x)) cat='compare';
    else if(/cents/.test(x)) cat='money';
    else if(/\d\/\d|half of/.test(x)) cat='fractions';
    else if(/cm|°|faces|edges|vertices|sides/.test(x)) cat='shapes';
    else if(/^What is \d+ [+−×÷] \d+\?$|^\d+ × \? = \d+$/.test(x)) cat='arithmetic';
    else { fail(k,'unrecognised mixed-all question',q); continue; }
    seen[cat]=(seen[cat]||0)+1;
    if(cat!=='arithmetic'&&!avail.has(cat)) fail(k,'category not offered at this grade: '+cat,q);
  }
  ['arithmetic','compare','fractions','money','clock','shapes'].filter(c=>c==='arithmetic'||avail.has(c)).forEach(c=>{
    if((seen[c]||0)<150) fail(k,`category "${c}" too rare (${seen[c]||0}/3000)`,{});
  });
}
// Topic order and default: Mixed All Questions first and default; unsupported topics are not offered or generated.
if(Q.topicsFor('grade3')[0].value!=='all'||Q.DEFAULT_TOPIC!=='all'||Q.normaliseTopic('grade3','bogus')!=='all'||Q.normaliseTopic('grade5','tables')!=='all'||Q.normaliseTopic('grade3','mixed')!=='mixed') fail('topic-default','Mixed All Questions is not first/default',{});
for(const g of grades){ const offered=Q.topicsFor('grade'+g).map(t=>t.value); if(offered[0]!=='all') fail('g'+g+'/order','all is not first',offered); }
console.log('questions checked:',total);
const keys=Object.keys(fails);
console.log('failing groups:',keys.length);
keys.slice(0,15).forEach(k=>console.log(k,fails[k].length,'e.g.',fails[k][0].slice(0,230)));
// show position spread for a few groups
['g4/mixed','g4/fractions','g5/fractions','g3/clock','g4/clock','g5/shapes','g6/shapes','g2/money','g4/money','g6/fractions','g4/shapes'].forEach(k=>{const p=global.POS[k];if(p){const t=Object.values(p).reduce((a,b)=>a+b,0);console.log(k.padEnd(14),Object.keys(p).sort().map(i=>i+':'+Math.round(p[i]/t*100)+'%').join(' '))}});
// Fail the run (and CI) if any generated question was wrong.
process.exit(keys.length ? 1 : 0);
