// Age 2-3 (toddler): exactly two question types, counting and "Which group has more?" (tap a group).
const path=require('path');
const Q=require(path.join(__dirname,'..','public','questions.js'));
let bad=0; const fail=(m,q)=>{ if(bad++<10) console.log('FAIL',m,JSON.stringify(q)); };
const count=s=>[...s.replace(/\uFE0F/g,'')].length;   // emoji are single code points here
const seen={count:0,compare:0}; const pos={0:0,1:0};
const N=3000;
for(let i=0;i<N;i++){
  const q=Q.generateQuestion('toddler');
  if(!q.simple) fail('not simple',q);
  if(/fewer|less|same|more or|[+−×÷=]|shape|left|right|heavier|lighter|pattern/i.test(q.question.replace('Which group has more?',''))) fail('excluded wording',q);
  const m=q.question.match(/^How many (.+)\?$/);
  if(m){
    seen.count++;
    const n=count(q.visual.join(''));
    if(q.groups) fail('count flagged as groups',q);
    if(n<1||n>5||!q.visual.every(e=>e===q.visual[0])) fail('count range/mixed objects',q);
    if(q.answers.length!==3||new Set(q.answers).size!==3) fail('need 3 distinct choices',q);
    if(Number(q.answers[q.correct])!==n) fail('wrong count answer',q);
    if(q.answers.some(a=>!/^[1-5]$/.test(a))||q.answers.map(Number).some((v,j,a)=>j&&v<=a[j-1])) fail('choices out of range/order',q);
  } else {
    seen.compare++;
    if(q.question!=='Which group has more?') fail('compare must always ask for more',q);
    if(!q.groups||q.visual) fail('compare must use tappable groups, no separate visual',q);
    if(q.answers.length!==2||q.answerLabels.length!==2) fail('need exactly two groups',q);
    const g=q.answers.map(a=>[...a].filter(c=>c!=='\uFE0F'));
    const kinds=g.map(a=>new Set(a));
    if(kinds.some(k=>k.size!==1)||[...kinds[0]][0]===[...kinds[1]][0]) fail('groups must be single, different object kinds',q);
    const n=g.map(a=>a.length);
    if(n.some(v=>v<1||v>5)||n[0]===n[1]) fail('counts out of range or equal',q);
    if(Math.abs(n[0]-n[1])<2) fail('difference too small',q);
    if(q.correct!==(n[0]>n[1]?0:1)) fail('correct is not the larger group',q);
    if(q.answers.some(a=>/^\d+$/.test(a))) fail('written/numeric choices not allowed',q);
    pos[q.correct]++;
  }
}
if(seen.count<N*0.4||seen.compare<N*0.4) fail('both types must be generated',seen);
if(pos[0]<seen.compare*0.35||pos[1]<seen.compare*0.35) fail('correct group position not random',pos);
// Bank (used by the game) works and contains both types.
const bank=Q.buildQuestionBank('toddler');
if(bank.length<20||!bank.some(q=>q.groups)||!bank.some(q=>!q.groups)) fail('bank missing a type',{n:bank.length});
console.log('toddler questions checked:',N,seen,'positions',pos);
process.exit(bad?1:0);
