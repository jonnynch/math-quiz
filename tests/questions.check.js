// Validates every generated question for every level and topic (correct answer, order, ranges, no duplicates).
const path=require('path');
const Q=require(path.join(__dirname,'..','public','questions.js'));
const gcd=(a,b)=>b?gcd(b,a%b):a;
const frac=s=>{const m=s.match(/^(\d+)\/(\d+)$/);return m?[+m[1],+m[2]]:[+s,1]};
const val=s=>{const [n,d]=frac(s);return n/d};
let total=0; const fails={};
const fail=(k,msg,q)=>{ (fails[k]=fails[k]||[]).push(msg+' :: '+JSON.stringify(q)); };
const N=3000;
const grades=[1,2,3,4,5,6];
const grade5Kinds={};
function checkPresentation(level,q,label){
  const paired=level==='toddler'&&q.question==='Which group has more?';
  const groupCompare=['age4','age5'].includes(level)&&/^Which group has (more|fewer)\?$/.test(q.question);
  const fixedCompare=/^Compare: /.test(q.question);
  const threeCategory=level==='grade2'&&q.question==='Which has the most?';
  const twoChoice=level==='grade4'&&q.kind==='prime';
  const grade5TwoChoice=level==='grade5'&&['divisible','likely'].includes(q.kind);
  const expected=level==='toddler'?(paired?2:3):paired||groupCompare||grade5TwoChoice?2:twoChoice?2:fixedCompare||threeCategory?3:4;
  if(q.answers.length!==expected)fail(label,'answer count should be '+expected,q);
  if(!(q.correct>=0&&q.correct<q.answers.length)||new Set(q.answers).size!==q.answers.length)fail(label,'invalid or duplicate answer choices',q);
  if(/^What is \d+ (?:\+|−|×|÷) \d+\?$/.test(q.question))fail(label,'arithmetic should use equation notation',q);
}
function checkGrade2Arithmetic(k,q,topic){
  const text=q.question, value=Number(q.answers[q.correct]), allowed=topic==='add'?['+']:topic==='sub'?['−']:topic==='mul'?['×']:topic==='div'?['÷']:topic==='tables'?['×','÷']:['+','−','×','÷']; let m;
  if((m=text.match(/^(\d+) ([+−×÷]) (\d+) = \?$/))){const a=+m[1],b=+m[3],op=m[2],result={'+':a+b,'−':a-b,'×':a*b,'÷':a/b}[op];if(!allowed.includes(op)||result!==value||!Number.isInteger(result)||result<0)fail(k,'Grade 2 arithmetic result/operator',q);if(op==='×'&&(![2,5,10].includes(a)&&![2,5,10].includes(b)||Math.max(a,b)>10))fail(k,'Grade 2 multiplication range',q);if(op==='÷'&&a%b!==0)fail(k,'Grade 2 division not exact',q);}
  else if((m=text.match(/^\? × (2|5|10) = (\d+)$/))){if(value*+m[1]!==+m[2]||value>10||!allowed.includes('×'))fail(k,'missing factor',q);}
  else if((m=text.match(/^(\d+) ÷ \? = (\d+)$/))){if(+m[1]/value!==+m[2]||![2,5,10].includes(value)||!allowed.includes('÷'))fail(k,'missing divisor',q);}
  else if((m=text.match(/^\? \+ (\d+) = (\d+)$/))){if(value+ +m[1]!==+m[2]||!allowed.includes('+'))fail(k,'missing first addend',q);}
  else if((m=text.match(/^(\d+) \+ \? = (\d+)$/))){if(+m[1]+value!==+m[2]||!allowed.includes('+'))fail(k,'missing addend',q);}
  else if((m=text.match(/^(\d+) − \? = (\d+)$/))){if(+m[1]-value!==+m[2]||!allowed.includes('−'))fail(k,'missing subtrahend',q);}
  else if((m=text.match(/^(\d+) \+ (\d+) = (\d+), so (\d+) − (\d+) = \?$/))){if(+m[1]+ +m[2]!==+m[3]||+m[4]- +m[5]!==value||!allowed.includes('+'))fail(k,'inverse addition',q);}
  else if((m=text.match(/^(\d+) − (\d+) = (\d+), so (\d+) \+ (\d+) = \?$/))){if(+m[1]- +m[2]!==+m[3]||+m[4]+ +m[5]!==value||!allowed.includes('−'))fail(k,'inverse subtraction',q);}
  else fail(k,'unrecognised Grade 2 arithmetic',q);
}
for(const g of grades){
  for(const t of Q.topicsFor('grade'+g)){
    const k=`g${g}/${t.value}`; const pos={};
    for(let i=0;i<N;i++){
      const q=Q.generateQuestion('grade'+g,t.value); total++;
      if(g===5&&q.topic)grade5Kinds[`${q.topic}/${q.kind}`]=(grade5Kinds[`${q.topic}/${q.kind}`]||0)+1;
      checkPresentation('grade'+g,q,k);
      const a=q.answers, c=q.correct;
      if(!(c>=0&&c<a.length)) {fail(k,'bad correct index',q);continue}
      if(new Set(a).size!==a.length) fail(k,'duplicate answers',q);
      if(a.some(x=>x===''||x==null)) fail(k,'empty answer',q);
      pos[c]=(pos[c]||0)+1;
      const text=q.question, ans=a[c];
      if(g===5&&/quadratic|square root|factorisation|long division|compound probability/i.test(text))fail(k,'Grade 7–10 content appeared',q);
      const numeric=a.every(x=>!isNaN(Number(x)));
      if(numeric){ const n=a.map(Number); if(n.some((v,j)=>j&&v<=n[j-1])) fail(k,'not ascending',q); if(n.some(v=>v<0)) fail(k,'negative',q); }
      // topic specific verification
      let m;
      if(g===1&&t.value!=='clock') continue;   // Grade 1 has its own, stricter checks in curriculum.check.js
      if(t.value==='mixed'||t.value==='add'||t.value==='sub'||t.value==='mul'||t.value==='div'||t.value==='tables'){
        if(g===2) checkGrade2Arithmetic(k,q,t.value);
        else if(g===3 && ['mixed','add','sub'].includes(t.value)) { m=text.match(/^(\d+) ([+−×÷]) (\d+) = \?$/); if(m){const expected={'+':+m[1]+ +m[3],'−':+m[1]- +m[3],'×':+m[1]* +m[3],'÷':+m[1]/+m[3]}[m[2]];if(expected!==Number(ans)||expected<0||!Number.isInteger(expected)||expected>1000||(t.value==='add'&&m[2]!=='+')||(t.value==='sub'&&m[2]!=='−'))fail(k,'Grade 3 arithmetic',q);} else if((m=text.match(/^\? \+ (\d+) = (\d+)$/))){if(Number(ans)+ +m[1]!==+m[2])fail(k,'Grade 3 missing addend',q);} else if((m=text.match(/^(\d+) \+ \? = (\d+)$/))){if(+m[1]+Number(ans)!==+m[2])fail(k,'Grade 3 missing addend',q);} else if((m=text.match(/^(\d+) − \? = (\d+)$/))){if(+m[1]-Number(ans)!==+m[2])fail(k,'Grade 3 missing subtrahend',q);} else if((m=text.match(/^(\d+) × \? = (\d+)$/))){if(+m[1]*Number(ans)!==+m[2])fail(k,'Grade 3 missing factor',q);} else if((m=text.match(/^(\d+) ÷ \? = (\d+)$/))){if(+m[1]/Number(ans)!==+m[2])fail(k,'Grade 3 missing divisor',q);} else if(!/so \d+ [−+] \d+ = \?$/.test(text))fail(k,'unrecognised Grade 3 arithmetic',q); }
        else if(g===3 && (t.value==='mul'||t.value==='div'||t.value==='tables')) { m=text.match(/^(\d+) ([×÷]) (\d+) = \?$/); if(m){const result=m[2]==='×'?+m[1]* +m[3]:+m[1]/+m[3];if(result!==Number(ans)||!Number.isInteger(result))fail(k,'Grade 3 multiplication/division',q);} else if((m=text.match(/^(\d+) × \? = (\d+)$/))){if(+m[1]*Number(ans)!==+m[2])fail(k,'Grade 3 missing factor',q);} else if((m=text.match(/^(\d+) ÷ \? = (\d+)$/))){if(+m[1]/Number(ans)!==+m[2])fail(k,'Grade 3 missing divisor',q);} else fail(k,'unrecognised Grade 3 facts',q); }
        else if(g===4||g===5){
          if((m=text.match(/^(\d+) ([+−×÷]) (\d+) = \?$/))){const x=+m[1],y=+m[3],r={'+':x+y,'−':x-y,'×':x*y,'÷':x/y}[m[2]];if(r!==Number(ans)||!Number.isInteger(r))fail(k,'Grade 4 arithmetic result',q);}
          else if((m=text.match(/^□ × (\d+) = (\d+)$/))){if(Number(ans)* +m[1]!==+m[2])fail(k,'Grade 4 missing factor',q);}
          else if((m=text.match(/^(\d+) × \? = (\d+)$/))){if(+m[1]*Number(ans)!==+m[2]||Number(ans)>10)fail(k,'Grade 4 table missing factor',q);}
          else if((m=text.match(/^(\d+) ÷ □ = (\d+)$/))){if(+m[1]/Number(ans)!==+m[2])fail(k,'Grade 4 missing divisor',q);}
          else if((m=text.match(/^□ \+ (\d+) = (\d+)$/))){if(Number(ans)+ +m[1]!==+m[2])fail(k,'Grade 4 missing addend',q);}
          else if((m=text.match(/^(\d+) \+ □ = (\d+)$/))){if(+m[1]+Number(ans)!==+m[2])fail(k,'Grade 4 missing addend',q);}
          else if((m=text.match(/^(\d+) − □ = (\d+)$/))){if(+m[1]-Number(ans)!==+m[2])fail(k,'Grade 4 missing subtrahend',q);}
          else if((m=text.match(/^(\d+) \+ (\d+) = (\d+), so (\d+) − (\d+) = \?$/))){if(+m[1]+ +m[2]!==+m[3]||+m[4]- +m[5]!==Number(ans))fail(k,'Grade 4 inverse addition',q);}
          else if((m=text.match(/^(\d+) − (\d+) = (\d+), so (\d+) \+ (\d+) = \?$/))){if(+m[1]- +m[2]!==+m[3]||+m[4]+ +m[5]!==Number(ans))fail(k,'Grade 4 inverse subtraction',q);}
          else fail(k,'unrecognised Grade 4 arithmetic',q);
          if(a.every(x=>!isNaN(Number(x)))&&!a.some((x,j)=>j!==c&&x.slice(-1)===ans.slice(-1)))fail(k,'Grade 4 arithmetic lacks same-last-digit distractor',q);
          if(g===5){
            const values=(text.match(/\d+/g)||[]).map(Number);
            if(values.some(value=>value>999))fail(k,'Grade 5 arithmetic operand/result too large',q);
            const equation=text.match(/^(\d+) ([+−×÷]) (\d+) = \?$/);
            if(equation){const x=+equation[1],y=+equation[3],op=equation[2];if((op==='+'||op==='−')&&(x<100||y<100)||op==='×'&&!((x>=12&&x<=35&&y>=2&&y<=9)||(y>=12&&y<=35&&x>=2&&x<=9))||op==='÷'&&(y<2||y>9||+ans<12||+ans>24))fail(k,'Grade 5 mental arithmetic range',q);}
          }
        }
        else if((m=text.match(/^(\d+) (\+|−|×|÷) (\d+) = \?$/))){const x=+m[1],y=+m[3];const r={'+':x+y,'−':x-y,'×':x*y,'÷':x/y}[m[2]]; if(r!==Number(ans)||!Number.isInteger(r)) fail(k,'wrong arithmetic',q);
          const allowed={mixed:g===1?'+−':'+−×÷',add:'+',sub:'−',mul:'×',div:'÷',tables:'×÷'}[t.value]; if(!allowed.includes(m[2])) fail(k,'operator not allowed '+m[2],q);
          if(g>=4){const last=ans.slice(-1); if(!a.some((x,j)=>j!==c&&x.slice(-1)===last)) fail(k,'no same last digit',q);}
        } else if((m=text.match(/^(\d+) × \? = (\d+)$/))){ if(+m[1]*Number(ans)!==+m[2]) fail(k,'wrong missing factor',q);} else fail(k,'unrecognised text',q);
        if(t.value==='tables'){ /* tables restricted ranges */ if((m=text.match(/^(\d+) × (\d+) = \?$/))&&g===2&&![2,5,10].includes(+m[1])&&![2,5,10].includes(+m[2])) fail(k,'g2 table out of range',q);}
      }
      if(g===5&&t.value==='numbers'){
        if((m=text.match(/^Is (\d+) divisible by (\d+)\?$/))){if((+m[1]%+m[2]===0)!==(ans==='yes'))fail(k,'divisibility',q);}
        else if((m=text.match(/^Which list shows all factors of (\d+)\?$/))){const expected=Array.from({length:+m[1]},(_,i)=>i+1).filter(v=>+m[1]%v===0).join(', ');if(ans!==expected)fail(k,'factor list',q);}
        else if((m=text.match(/^First five multiples of (\d+):$/))){if(ans!==Array.from({length:5},(_,i)=>(i+1)*+m[1]).join(', '))fail(k,'multiple list',q);}
        else if((m=text.match(/^Estimate (\d+) \+ (\d+) by rounding each to the nearest 100\.$/))){const round=v=>Math.round(v/100)*100;if(round(+m[1])+round(+m[2])!==+ans)fail(k,'estimation',q);}
        else if((m=text.match(/^(\d+) rounded to the nearest (10|100|1000) = \?$/))){if(Math.round(+m[1]/+m[2])*+m[2]!==+ans)fail(k,'rounding',q);}
        else if((m=text.match(/^□ × (\d+) = (\d+)$/))){if(+ans*+m[1]!==+m[2])fail(k,'missing factor',q);}
        else if((m=text.match(/^\((\d+) \+ (\d+)\) × (\d+) = \?$/))){if((+m[1]+ +m[2])*+m[3]!==+ans)fail(k,'order of operations with brackets',q);}
        else if((m=text.match(/^(\d+) \+ (\d+) × (\d+) = \?$/))){if(+m[1]+ +m[2]*+m[3]!==+ans)fail(k,'order of operations',q);}
        else fail(k,'unrecognised Grade 5 number question',q);
      }
      if(g===2&&t.value==='numbers'){
        if((m=text.match(/^What number is (\d+) tens and (\d+) ones\?$/))){if(+m[1]*10 + +m[2]!==Number(ans)||Number(ans)<10||Number(ans)>99)fail(k,'two-digit place value',q);}
        else if((m=text.match(/^What number is (\d+) hundreds, (\d+) tens and (\d+) ones\?$/))){if(+m[1]*100 + +m[2]*10 + +m[3]!==Number(ans)||Number(ans)<100||Number(ans)>999)fail(k,'three-digit place value',q);}
        else if((m=text.match(/^(\d+) = \?$/))){if(ans.split(' + ').reduce((s,x)=>s+Number(x),0)!==+m[1])fail(k,'expanded notation',q);}
        else if((m=text.match(/^□00 \+ (\d+) \+ (\d+) = (\d+)$/))){if(Number(ans)*100 + +m[1] + +m[2]!==+m[3])fail(k,'missing hundreds',q);}
        else if((m=text.match(/^(\d+) \+ □0 \+ (\d+) = (\d+)$/))){if(+m[1] + Number(ans)*10 + +m[2]!==+m[3])fail(k,'missing tens',q);}
        else if((m=text.match(/^Compare: (\d+) \? (\d+)$/))){const expected=+m[1]<+m[2]?0:+m[1]>+m[2]?2:1;if(c!==expected)fail(k,'number comparison',q);}
        else if(text==='Order from smallest to largest.'){const ns=ans.split(',').map(Number);if(ns.length!==3||ns.some((v,i)=>i&&v<=ns[i-1]))fail(k,'number ordering',q);}
        else if(q.numbers){const hole=q.numbers.indexOf('?'), known=q.numbers.map((v,i)=>[i,Number(v)]).filter(([i])=>i!==hole), step=(known[1][1]-known[0][1])/(known[1][0]-known[0][0]);if(hole<0||q.numbers.filter(v=>v==='?').length!==1||Number(q.numbers[0])+hole*step!==Number(ans)||Math.abs(step)>50)fail(k,'number sequence',q);}
        else fail(k,'unrecognised Grade 2 number question',q);
      }
      if(t.value==='money'){ const nn=Number(ans); if((!Array.isArray(q.coins)||!q.coins.length)&&(!Array.isArray(q.notes)||!q.notes.length)) fail(k,'money illustration missing',q); if((q.coins||[]).some(v=>![5,10,20,50,100,200].includes(v))||(q.notes||[]).some(v=>![500,1000].includes(v))) fail(k,'invalid Australian money illustration',q); if(m=text.match(/^You have (.+)\. How many cents altogether\?$/)){const s=m[1].split(', ').reduce((s,x)=>s+(x.startsWith('$')?100*+x.slice(1):+x.slice(0,-1)),0); if(s!==nn) fail(k,'coins wrong',q);}
        else if(m=text.match(/^Something costs (\d+)c\. You pay (\S+)\. How many cents change\?$/)){const pay=m[2].startsWith('$')?100*+m[2].slice(1):+m[2].slice(0,-1); if(pay-m[1]!==nn||pay-m[1]<=0) fail(k,'change wrong',q);}
        else if(m=text.match(/^A pen costs (\d+)c and a rubber costs (\d+)c/)){ if(+m[1]+ +m[2]!==nn) fail(k,'sum wrong',q);}
        else if(m=text.match(/^(\d+) stickers cost (\d+)c each/)){ if(m[1]*m[2]!==nn) fail(k,'qty wrong',q);}
        else if(m=text.match(/^A book costs (\d+)c\. You pay \$(\d+)/)){ if(m[2]*100-m[1]!==nn||nn<=0) fail(k,'book change wrong',q);}
        else fail(k,'money text',q);}
      if(t.value==='clock'&&g===3&&q.kind==='elapsed'){const m=text.match(/^(\d+) h (\d+) min = \? min$/);if(!m||+m[1]*60+ +m[2]!==Number(ans))fail(k,'elapsed time',q);}
      else if(t.value==='clock'){ const f=q.figure; if(!f||f.type!=='clock') {fail(k,'no clock figure',q);} else { const lbl=`${f.hour}:${String(f.minute).padStart(2,'0')}`; if(ans!==lbl) fail(k,'clock label mismatch',q);
          const mins=a.map(x=>{const [h,mm]=x.split(':').map(Number);return (h%12)*60+mm}); if(mins.some((v,j)=>j&&v<=mins[j-1])) fail(k,'clock not sorted',q);
          const step=[0,30,5,5,1][g]; if(f.minute%step!==0) fail(k,'clock minute grid',q);} }
      if(t.value==='shapes'){ if(g===1){ if(!q.figure||q.figure.type!=='polygon'||String(q.figure.sides)!==ans) fail(k,'polygon mismatch',q);}
        else if(g===2){const f=q.figure;if(q.kind==='polygon'&&(!f||f.type!=='polygon'||String(f.sides)!==ans))fail(k,'polygon mismatch',q);else if(q.kind==='solid'&&(!q.picture||q.picture.label!=='A '+ans))fail(k,'solid mismatch',q);else if(q.kind==='measure'){const mm=text.match(/^Compare: (\d+) (cm|kg|L) \? (\d+) \2$/),exp=+mm?.[1]<+mm?.[3]?0:+mm?.[1]>+mm?.[3]?2:1;if(!mm||c!==exp)fail(k,'measurement compare',q);}else if(q.kind==='perimeter'&&(!f||f.type!=='perimeter'||+ans!==2*(f.length+f.width)))fail(k,'rectangle perimeter',q);else if(q.kind==='symmetry'&&+ans!==({triangle:3,square:4,rectangle:2}[text.match(/^(triangle|square|rectangle): lines of symmetry = \?$/)?.[1]]))fail(k,'symmetry',q);else if(q.kind==='identify'&&({3:'triangle',4:'square',5:'pentagon',6:'hexagon'}[f?.sides]!==ans))fail(k,'shape identification',q);}
        else if(g===4 && (q.kind==='area'||q.kind==='perimeter')){const f=q.figure,expected=q.kind==='area'?f?.length*f?.width:2*((f?.length||0)+(f?.width||0));if(!f||f.type!=='rectangle-measure'||Number(ans)!==expected)fail(k,'Grade 4 rectangle calculation',q);}
        else if(g===4&&q.kind==='angle'){const d=q.figure?.degrees,expected=d<90?'acute':d===90?'right':'obtuse';if(q.figure?.type!=='angle'||ans!==expected)fail(k,'Grade 4 angle identification',q);}
        else if(g===4&&q.kind==='angleCompare'){const m=text.match(/^Compare: (\d+)° \? (\d+)°$/),expected=+m?.[1]<+m?.[2]?0:+m?.[1]>+m?.[2]?2:1;if(!m||c!==expected)fail(k,'Grade 4 angle comparison',q);}
        else if(g===4&&q.kind==='convert'){const m=text.match(/^(\d+(?:\.\d+)?) m = \? cm$/);if(!m||Number(m[1])*100!==Number(ans))fail(k,'Grade 4 metric conversion',q);}
        else if(g===4&&q.kind==='duration'){const m=text.match(/^(\d+) h (\d+) min = \? min$/);if(!m||+m[1]*60+ +m[2]!==Number(ans))fail(k,'Grade 4 time duration',q);}
        else if(g===4&&q.kind==='symmetry'){const m=text.match(/^Lines of symmetry in a (.+) = \?$/),expected={'square':4,'rectangle':2,'equilateral triangle':3}[m?.[1]];if(Number(ans)!==expected||q.figure?.type!=='shape')fail(k,'Grade 4 symmetry',q);}
        else if(g===4&&q.kind==='properties'){const m=text.match(/^Sides of a (\w+) = \?$/),expected={pentagon:5,hexagon:6,octagon:8}[m?.[1]];if(Number(ans)!==expected)fail(k,'Grade 4 shape property',q);}
        else if(g===5&&q.kind==='area'){const m=text.match(/^Area of (\d+) cm × (\d+) cm rectangle = \? cm²$/);if(!m||+m[1]*+m[2]!==+ans)fail(k,'Grade 5 rectangle area',q);}
        else if(g===5&&q.kind==='squareArea'){const m=text.match(/^Area of square with (\d+) cm sides = \? cm²$/);if(!m||+m[1]*+m[1]!==+ans)fail(k,'Grade 5 square area',q);}
        else if(g===5&&q.kind==='perimeter'){const m=text.match(/^Perimeter of (\d+) cm × (\d+) cm rectangle = \? cm$/);if(!m||2*(+m[1]+ +m[2])!==+ans)fail(k,'Grade 5 perimeter',q);}
        else if(g===5&&q.kind==='compositeArea'){const m=text.match(/^L-shape area: (\d+) × (\d+) − (\d+) × (\d+) = \? cm²$/);if(!m||+m[1]*+m[2]- +m[3]*+m[4]!==+ans)fail(k,'Grade 5 composite area',q);}
        else if(g===5&&q.kind==='volume'){const m=text.match(/^Volume: (\d+) × (\d+) × (\d+) unit cubes = \?$/);if(!m||+m[1]*+m[2]*+m[3]!==+ans)fail(k,'Grade 5 volume',q);}
        else if(g===5&&q.kind==='angle'){const m=text.match(/^Angles on a straight line total 180°. One is (\d+)°. The other = \?$/);if(!m||180- +m[1]!==+ans)fail(k,'Grade 5 angle relation',q);}
        else if(g===5&&q.kind==='convert'){const m=text.match(/^(\d+(?:\.\d+)?) m = \? cm$/);if(!m||+m[1]*100!==+ans)fail(k,'Grade 5 conversion',q);}
        else if(g===5&&q.kind==='coordinate'){const m=text.match(/^On a coordinate grid, point A is at \((\d+), (\d+)\)\. What is its ([xy])-coordinate\?$/);if(!m||+(m[3]==='x'?m[1]:m[2])!==+ans)fail(k,'Grade 5 coordinate',q);}
        else if(g===5&&q.kind==='duration'){const m=text.match(/^(\d+) h (\d+) min \+ (\d+) min = \? min$/);if(!m||+m[1]*60+ +m[2]+ +m[3]!==+ans)fail(k,'Grade 5 time calculation',q);}
        else if(g===3 && q.kind==='area'){const f=q.figure;if(!f||f.type!=='grid-area'||f.rows*f.cols!==+ans)fail(k,'unit square area',q);}
        else if(g===3 && q.kind==='angle'){const f=q.figure,expected=f?.degrees<90?'acute':f?.degrees===90?'right':'obtuse';if(!f||f.type!=='angle'||ans!==expected)fail(k,'angle identification',q);}
        else if(g===3 && q.kind==='perimeter'){const f=q.figure;if(!f||f.type!=='perimeter'||2*(f.length+f.width)!==+ans)fail(k,'rectangle perimeter',q);}
        else if(g===3 && q.kind==='convert'){if(!/^\d+ m = \? cm$/.test(text)||+ans!==Number(text.match(/^(\d+)/)[1])*100)fail(k,'metric conversion',q);}
        else if(g===3 && q.kind==='measure'){const mm=text.match(/^Compare: (\d+) (cm|kg|L) \? (\d+) \2$/),expected=+mm?.[1]<+mm?.[3]?0:+mm?.[1]>+mm?.[3]?2:1;if(!mm||c!==expected)fail(k,'measurement comparison',q);}
        else if(g===3 && (m=text.match(/^(faces|edges|vertices) of a (.+) = \?$/))){const S={'cube':[6,12,8],'rectangular prism':[6,12,8],'triangular prism':[5,9,6],'square pyramid':[5,8,5],'triangular pyramid':[4,6,4]}[m[2]];const idx={faces:0,edges:1,vertices:2}[m[1]]; if(!S||S[idx]!==+ans) fail(k,'solid wrong',q);}
        else if(g===3 && (m=text.match(/^Sides of (\w+) = \?$/))){const n={triangle:3,square:4,pentagon:5,hexagon:6,heptagon:7,octagon:8,nonagon:9,decagon:10}[m[1]]; if(n!==+ans) fail(k,'polygon name wrong',q);}
        else if((m=text.match(/^Third angle = 180° − (\d+)° − (\d+)°$/))){ if(180-m[1]-m[2]!==+ans||+ans<=0) fail(k,'triangle angle',q);}
        else if(m=text.match(/^(Perimeter|Area) of (\d+) cm × (\d+) cm rectangle = \? cm(²)?$/)){ const exp=m[1]==='Perimeter'?2*(+m[2]+ +m[3]):m[2]*m[3]; if(exp!==+ans) fail(k,'rect wrong',q);}
        else if(m=text.match(/^Area of square with (\d+) cm sides = \? cm²$/)){ if(m[1]*m[1]!==+ans) fail(k,'square wrong',q);}
        else if(m=text.match(/^Triangle area: (\d+) cm × (\d+) cm ÷ 2 = \? cm²$/)){ if(m[1]*m[2]/2!==+ans||(m[1]*m[2])%2) fail(k,'tri area wrong',q);}
        else if(m=text.match(/^Parallelogram area: (\d+) cm × (\d+) cm = \? cm²$/)){ if(m[1]*m[2]!==+ans) fail(k,'para wrong',q);}
        else if(m=text.match(/^Fourth angle = 360° − (\d+)° − (\d+)° − (\d+)°$/)){ if(360-m[1]-m[2]-m[3]!==+ans||+ans<=0) fail(k,'quad wrong',q);}
        else fail(k,'unrecognised shapes text',q);}
      if(t.value==='fractions'){
        if(m=text.match(/^1\/2 of (\d+) = \?$/)){ if(m[1]/2!==+ans) fail(k,'half wrong',q);}
        else if(m=text.match(/^(\d+)\/(\d+) of (\d+) = \?$/)){ if(m[1]*m[3]/m[2]!==+ans||!Number.isInteger(m[3]/m[2])) fail(k,'fraction of amount wrong',q);}
        else if((g===2||g===3)&&text==='What fraction of the shape is shaded?'){const f=q.figure,match=String(ans).match(/^(\d+)\/(\d+)$/);if(!f||f.type!=='fraction'||!match||Math.abs(+match[1]/+match[2]-f.numerator/f.denominator)>1e-9)fail(k,'fraction diagram wrong',q);}
        else if(g===4&&text==='What fraction is shown?'){const f=q.figure,match=String(ans).match(/^(\d+)\/(\d+)$/);if(!f||f.type!=='fraction-bar'||!match||Math.abs(+match[1]/+match[2]-f.numerator/f.denominator)>1e-9)fail(k,'Grade 4 fraction bar',q);}
        else if(g===4&&q.kind==='order'){const input=text.match(/^Order from smallest to largest: (.+)\.$/)?.[1].split(', ').map(val),ordered=ans.split(', ').map(val);if(!input||input.some((v,i)=>ordered[i]!==[...input].sort((a,b)=>a-b)[i]))fail(k,'Grade 4 fraction order',q);}
        else if(g===4&&q.kind==='mixed'){const m=text.match(/^(\d+) (\d+)\/(\d+) = \?\/(\d+)$/);if(!m||+m[1]* +m[4]+ +m[2]!==Number(ans)||+m[3]!==+m[4])fail(k,'Grade 4 mixed-number equivalence',q);}
        else if(g===5&&(m=text.match(/^(\d+)\/(\d+) = \? \(simplest form\)$/))){const [n,d]=frac(ans);if(+m[1]/+m[2]!==n/d||gcd(n,d)!==1)fail(k,'simplifying fraction',q);}
        else if((g===3||g===4)&&text==='1/2 = ?/4'){if(Number(ans)!==2)fail(k,'equivalent fraction',q);}
        else if(g===2&&text==='1/2 = ?/4'){if(+ans!==2)fail(k,'equivalent halves and quarters',q);}
        else if(m=text.match(/^(\d+)\/(\d+) = \?\/(\d+)$/)){ if(m[1]/m[2]!==+ans/m[3]) fail(k,'equiv wrong',q);}
        else if(m=text.match(/^Compare: (\S+) \? (\S+)$/)){ // Grades 5-6 only: exactly one decimal and one fraction
          const dec=m.slice(1,3).filter(x=>/^0\.\d+$/.test(x)), fr=m.slice(1,3).filter(x=>/^\d+\/\d+$/.test(x));
          if((g===2||g===3||g===4||g===5)&&dec.length===0&&fr.length===2){const x=val(fr[0]),y=val(fr[1]),exp=x<y?0:x>y?2:1;if(c!==exp)fail(k,'fraction comparison wrong',q);}
          else if(g<5||dec.length!==1||fr.length!==1) fail(k,'comparison must be supported by this grade',q);
          else { const [n,d]=frac(fr[0]); const x=+dec[0]; const y=n/d; const dv=m[1]===dec[0]?x-y:y-x; const exp=Math.abs(dv)<1e-12?1:dv<0?0:2; if(c!==exp) fail(k,'decimal/fraction compare wrong',q); } }
        else if(m=text.match(/^(\d+)\/(\d+) ([+−×÷]) (\d+)(?:\/(\d+))? = \? \(simplest form\)$/)){
          const x=m[1]/m[2]; const y=m[5]?m[4]/m[5]:+m[4]; const r={'+':x+y,'−':x-y,'×':x*y,'÷':x/y}[m[3]]; if(Math.abs(val(ans)-r)>1e-9) fail(k,'frac arithmetic wrong',q);
          const [n,d]=frac(ans); if(gcd(n,d)!==1&&d!==1) fail(k,'not simplest',q); if(r<=0) fail(k,'non-positive result',q);
          const vals=a.map(val); if(vals.some((v,j)=>j&&v<=vals[j-1]+1e-12)) fail(k,'fractions not sorted',q);}
        else if(m=text.match(/^(\d+) ÷ \(1\/(\d+)\) = \?$/)){ if(+m[1]*+m[2]!==+ans) fail(k,'unit fraction division wrong',q);}
        else if(m=text.match(/^1\/(\d+) of (\d+) = \?$/)){ if(m[2]/m[1]!==+ans) fail(k,'unit frac wrong',q);}
        else fail(k,'unrecognised fraction text',q);
      }
      if(t.value==='decimals'&&(g===4||g===5)){
        if(g===5&&q.kind==='order'){const input=text.match(/^Order from smallest to largest: (.+)\.$/)?.[1].split(', ').map(Number),ordered=ans.split(', ').map(Number);if(!input||ordered.some((v,i)=>v!==[...input].sort((a,b)=>a-b)[i]))fail(k,'decimal ordering',q);}
        else if((m=text.match(/^Compare: (\d*\.\d+) \? (\d*\.\d+)$/))){const expected=+m[1]<+m[2]?0:+m[1]>+m[2]?2:1;if(c!==expected)fail(k,'decimal comparison',q);}
        else if((m=text.match(/^(\d+(?:\.\d+)?) ([+−×÷]) (\d+(?:\.\d+)?) = \?$/))){const expected={'+':+m[1]+ +m[3],'−':+m[1]- +m[3],'×':+m[1]* +m[3],'÷':+m[1]/+m[3]}[m[2]];if(Math.abs(expected-Number(ans))>1e-9)fail(k,'decimal arithmetic',q);}
        else if((m=text.match(/^(\d+)\/(\d+) = \?$/))){if(Math.abs(+m[1]/+m[2]-Number(ans))>1e-9)fail(k,'fraction/decimal relationship',q);}
        else if((m=text.match(/^0\.(\d{3}) = \?\/1000$/))){if(+m[1]!==Number(ans))fail(k,'thousandths place value',q);}
        else if((m=text.match(/^0\.(\d{2}) = \?\/100$/))){if(+m[1]!==Number(ans))fail(k,'hundredths place value',q);}
        else if((m=text.match(/^0\.(\d) = \?\/10$/))){if(+m[1]!==Number(ans))fail(k,'tenths place value',q);}
        else if((m=text.match(/^(\d*\.\d+) = \?\/100$/))){if(Math.abs(+m[1]*100-Number(ans))>1e-9)fail(k,'decimal/fraction conversion',q);}
        else fail(k,'unrecognised decimal question',q);
      }
      if(t.value==='percentages'){
        if((m=text.match(/^(\d+)% of (\d+) = \?$/))){if(+m[1]*+m[2]/100!==+ans)fail(k,'percentage of quantity',q);}
        else if((m=text.match(/^(\d+)% = \? \(simplest form\)$/))){if(Math.abs(val(ans)- +m[1]/100)>1e-9||gcd(...frac(ans))!==1)fail(k,'percentage to fraction',q);}
        else if((m=text.match(/^(\d+)% = \?$/))){if(Math.abs(Number(ans)- +m[1]/100)>1e-9)fail(k,'percentage to decimal',q);}
        else if((m=text.match(/^(\d+(?:\.\d+)?) = \?(%)$/))){if(+m[1]*100!==+ans)fail(k,'decimal to percentage',q);}
        else if((m=text.match(/^(\d+)\/(\d+) = \?(%)$/))){if(+m[1]/+m[2]*100!==+ans)fail(k,'fraction to percentage',q);}
        else if((m=text.match(/^Compare: (\d+)% \? (\d*\.\d+)$/))){const expected=+m[1]/100<+m[2]?0:+m[1]/100>+m[2]?2:1;if(c!==expected)fail(k,'percentage comparison',q);}
        else fail(k,'unrecognised percentage question',q);
      }
      if(t.value==='ratio'){
        if((m=text.match(/^Simplify (\d+):(\d+)\.$/))){if(ans!==`${+m[1]/gcd(+m[1],+m[2])}:${+m[2]/gcd(+m[1],+m[2])}`)fail(k,'ratio simplification',q);}
        else if((m=text.match(/^Red : Blue = (\d+):(\d+)\. Total = (\d+)\. How many are red\?$/))){if(+ans!==+m[1]*+m[3]/(+m[1]+ +m[2]))fail(k,'ratio part of total',q);}
        else if((m=text.match(/^(\d+):(\d+) = (\d+):□$/))){if(+m[1]*+ans!==+m[2]*+m[3])fail(k,'proportional ratio',q);}
        else fail(k,'unrecognised ratio question',q);
      }
      if(t.value==='probability'){
        if((m=text.match(/^A bag has (\d+) red and (\d+) blue balls\. P\(red\) = \?$/))){if(Math.abs(val(ans)- +m[1]/(+m[1]+ +m[2]))>1e-9)fail(k,'bag probability',q);}
        else if(text==='A fair coin is tossed. P(heads) = ?'||text==='A fair die is rolled. P(even) = ?'){if(ans!=='1/2')fail(k,'fair-event probability',q);}
        else if(text==='A bag has 3 red and 2 blue balls. Which colour is more likely?'){if(ans!=='red')fail(k,'likely event',q);}
        else fail(k,'unrecognised probability question',q);
      }
    }
    // position spread check
    const n=Object.keys(pos).length; const exp=1/ (q0(g,t)); 
    global.POS=global.POS||{}; global.POS[k]=pos;
  }
}
function q0(g,t){return 1}
for(const kind of ['numbers/round','numbers/estimate','numbers/factors','numbers/multiple','numbers/divisible','numbers/orderOps','numbers/missingFactor','fractions/add','fractions/sub','fractions/amount','fractions/equivalent','fractions/simplify','fractions/multiplyWhole','fractions/compare','fractions/compareFractions','decimals/thousandths','decimals/compare','decimals/order','decimals/add','decimals/subtract','decimals/multiply','decimals/divide','decimals/fractionDecimal','decimals/decimalFraction','percentages/ofAmount','percentages/fraction','percentages/decimal','percentages/decimalToPercent','percentages/fractionToPercent','percentages/compare','ratio/simplify','ratio/partOfTotal','ratio/proportion','probability/bag','probability/coin','probability/die','probability/likely','shapes/area','shapes/squareArea','shapes/perimeter','shapes/compositeArea','shapes/volume','shapes/angle','shapes/convert','shapes/coordinate','shapes/duration']) if((grade5Kinds[kind]||0)<10)fail('g5/kind coverage',kind,{});
// "Mixed All Questions" (topic 'all'): every category the grade offers must appear, and nothing else.
for(const g of grades){
  const avail=new Set(Q.topicsFor('grade'+g).map(t=>t.value)); const k=`g${g}/all`; const seen={};
  for(let i=0;i<3000;i++){
    const q=Q.generateQuestion('grade'+g,'all'); total++; const x=q.question;
    checkPresentation('grade'+g,q,k);
    if(!(q.correct>=0&&q.correct<q.answers.length)||new Set(q.answers).size!==q.answers.length) fail(k,'bad question',q);
    if(g===1){ seen.g1=(seen.g1||0)+1; if(/^Compare/.test(x)) fail(k,'Grade 1 has no comparison questions',q); continue; }   // Grade 1 categories: curriculum.check.js
    let cat;
    if(g>=2&&['numbers','tables','fractions','decimals','percentages','ratio','probability','shapes','patterns','data','clock'].includes(q.topic)) cat=q.topic;
    else if(q.figure&&q.figure.type==='clock') cat='clock';
    else if(q.figure&&q.figure.type==='polygon') cat='shapes';
    else if(/^Compare: /.test(x)) cat='fractions';   // Grades 5-6: decimal versus fraction lives inside Fractions
    else if(/cents/.test(x)) cat='money';
    else if(/\d\/\d|half of/.test(x)) cat='fractions';
    else if(/cm|°|faces|edges|vertices|[Ss]ides/.test(x)) cat='shapes';
    else if(g===2) cat='arithmetic';
    else if(g===3) cat='arithmetic';
    else if(/^(?:\d+ [+−×÷] \d+ = \?|□ [ +×] \d+ = \d+|\d+ [ +−] □ = \d+|\d+ ÷ □ = \d+|\d+ [+−] \d+ = \d+, so \d+ [−+] \d+ = \?)$/.test(x)) cat='arithmetic';
    else { fail(k,'unrecognised mixed-all question',q); continue; }
    seen[cat]=(seen[cat]||0)+1;
    if(cat!=='arithmetic'&&!avail.has(cat)) fail(k,'category not offered at this grade: '+cat,q);
  }
    if(g===1) continue;
  (g===2?['arithmetic','tables','numbers','fractions','money','clock','shapes','patterns','data']:g===3?['arithmetic','numbers','patterns','data','tables','fractions','money','clock','shapes']:g===4?['arithmetic','tables','numbers','fractions','decimals','money','clock','shapes','patterns']:g===5?['arithmetic','numbers','fractions','decimals','percentages','ratio','probability','shapes']:['arithmetic','fractions','money','clock','shapes'].filter(c=>c==='arithmetic'||avail.has(c))).forEach(c=>{
    if((seen[c]||0)<150) fail(k,`category "${c}" too rare (${seen[c]||0}/3000)`,{});
  });
}
// The same choice-count and equation-format rules cover all age pools, not only grade topics.
for(const level of ['toddler','age4','age5','age6']){
  for(let i=0;i<N;i++){
    const q=Q.generateQuestion(level,'all'); total++;
    checkPresentation(level,q,level+'/all');
  }
}
// Comparing numbers is not offered at any grade; an old saved selection falls back to Mixed All Questions.
for(const g of grades){ if(Q.topicsFor('grade'+g).some(t=>t.value==='compare')) fail('g'+g+'/compare','compare topic must not be offered',{}); if(Q.normaliseTopic('grade'+g,'compare')!=='all') fail('g'+g+'/compare','old compare selection must normalise to all',{}); }
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
