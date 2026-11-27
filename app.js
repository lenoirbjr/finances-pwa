'use strict';
/* diario-shell:4.0.56 */
/* Diário Financeiro 4.0.56: Débitos, Fatura e acertos. */
const DB='finances-pwa-local', STORE='app', RECORD='state', ARCHIVE='legacy-two-wallets-v2', PREVIOUS='state-before-v3.2', BEFORE33='state-before-v3.3', BEFORE34='state-before-v3.4', BEFORE35='state-before-v3.5', OLD_KEY='financas-pwa-piloto-v1';
const $=id=>document.getElementById(id), round=n=>Math.round((n+Number.EPSILON)*100)/100;
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const monthTitle=m=>m.slice(5)+'/'+m.slice(0,4);
const shortMonthTitle=monthTitle;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0'), dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>dateKey(new Date()), monthNow=()=>today().slice(0,7);
const monday=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);x.setDate(x.getDate()-(x.getDay()+6)%7);return dateKey(x)};
const weekShift=(s,n)=>{const [y,m,d]=s.split('-').map(Number);return dateKey(new Date(y,m-1,d+7*n,12))};
const weekDiff=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/604800000);
const shiftMonth=(s,n)=>{const [y,m]=s.split('-').map(Number),d=new Date(y,m-1+n,1,12);return `${d.getFullYear()}-${pad(d.getMonth()+1)}`};
const monthDiff=(a,b)=>{const [y,m]=a.split('-').map(Number),[y2,m2]=b.split('-').map(Number);return (y2-y)*12+m2-m};
const isDate=s=>/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(s)&&dateKey(new Date(s+'T12:00:00'))===s;
const isMonth=s=>/^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const amount=id=>{const raw=$(id).value.trim().replace(',','.');return raw===''?NaN:Number(raw)};
const newId=()=>crypto.randomUUID();
const empty=()=>({version:8,fixedPaid:[],monthlyPaid:[],investmentSkipped:[],opening:null,extraIncome:[],cashEntries:[],mode:'items',income:0,legacyFixed:0,legacyInvoices:{},fixedItems:[],baseParcels:[],investments:0,investmentOverrides:{},investmentLowerLegacy:{},extraInvestments:[],profiles:[{from:'2000-01',income:0,investments:0,margin:0}],expenses:[],parcels:[],started:monday(new Date())});
function validLegacyShape(s){return !!(s&&s.version===5&&s.mode==='items'&&Number.isFinite(s.income)&&s.income>=0&&Number.isFinite(s.legacyFixed)&&s.legacyFixed>=0&&isDate(s.started)&&Number.isFinite(s.investments)&&s.investments>=0&&s.legacyInvoices&&typeof s.legacyInvoices==='object'&&!Array.isArray(s.legacyInvoices)&&Object.entries(s.legacyInvoices).every(([m,v])=>isMonth(m)&&Number.isFinite(v)&&v>=0)&&s.investmentOverrides&&Object.entries(s.investmentOverrides).every(([m,v])=>isMonth(m)&&Number.isFinite(v)&&v>=0)&&Array.isArray(s.fixedItems)&&s.fixedItems.every(e=>typeof e.id==='string'&&typeof e.name==='string'&&e.name.length<=120&&Number.isFinite(e.amount)&&e.amount>=0&&isMonth(e.start)&&(!e.end||isMonth(e.end)))&&Array.isArray(s.baseParcels)&&s.baseParcels.every(e=>typeof e.id==='string'&&typeof e.name==='string'&&e.name.length<=120&&Number.isFinite(e.payment)&&e.payment>0&&isMonth(e.start)&&Number.isInteger(e.remaining)&&e.remaining>0&&e.remaining<=240)&&Array.isArray(s.expenses)&&s.expenses.every(e=>typeof e.id==='string'&&typeof e.name==='string'&&e.name.length<=120&&Number.isFinite(e.amount)&&e.amount>0&&isDate(e.date))&&Array.isArray(s.parcels)&&s.parcels.every(e=>typeof e.id==='string'&&typeof e.name==='string'&&e.name.length<=120&&isMonth(e.start)&&Number.isInteger(e.count)&&e.count>0&&e.count<=120&&Number.isFinite(e.total)&&e.total>0&&Number.isFinite(e.payment)&&e.payment>=0));}

function valid(s){
 if(!s||s.version!==8||!Array.isArray(s.profiles)||!s.profiles.length||!Array.isArray(s.extraInvestments)||!Array.isArray(s.monthlyPaid))return false;
 const base={...s,version:5};if(!validLegacyShape(base)||!reconValidate(s.reconciliation))return false;
 if(s.expenses.some(e=>e.cardMonth!==undefined&&!isMonth(e.cardMonth))||s.parcels.some(p=>(p.cardEnteredAt!==undefined&&(!Number.isSafeInteger(p.cardEnteredAt)||p.cardEnteredAt<=0))||(p.cardAdded!==undefined&&p.cardAdded!==true)||(p.purchaseDate!==undefined&&!isDate(p.purchaseDate))))return false;
 if(!s.parcels.every(p=>reconPayableValid(p,s)))return false;
 if(!s.profiles.every(p=>p&&isMonth(p.from)&&[p.income,p.investments,p.margin].every(v=>Number.isFinite(v)&&v>=0)&&validSalary(p)))return false;
 if(new Set(s.profiles.map(p=>p.from)).size!==s.profiles.length)return false;
 if(s.opening!==null&&(!s.opening||!isDate(s.opening.date)||!Number.isFinite(s.opening.amount)||s.opening.amount<0))return false;
 if(!Array.isArray(s.extraIncome)||!s.extraIncome.every(e=>typeof e.id==='string'&&typeof e.name==='string'&&e.name.length<=120&&isDate(e.date)&&Number.isFinite(e.amount)&&e.amount>0))return false;
 if(!Array.isArray(s.cashEntries)||!s.cashEntries.every(e=>typeof e.id==='string'&&['salary','invoice','fixed','investment','adjustment-in','adjustment-out'].includes(e.type)&&isDate(e.date)&&isMonth(e.month)&&Number.isFinite(e.amount)&&e.amount>0))return false;
 if(s.investmentSkipped!==undefined&&(!Array.isArray(s.investmentSkipped)||!s.investmentSkipped.every(m=>isMonth(m))||new Set(s.investmentSkipped).size!==s.investmentSkipped.length))return false;
 if(s.fixedPaid!==undefined&&(!Array.isArray(s.fixedPaid)||!s.fixedPaid.every(e=>typeof e.id==='string'&&isMonth(e.month)&&isDate(e.date)&&Number.isFinite(e.amount)&&e.amount>=0&&(e.batch===undefined||typeof e.batch==='string'&&e.batch.length>0&&e.batch.length<=100&&Number.isSafeInteger(Math.round(e.amount*100))&&Math.round(e.amount*100)>0))))return false;
 if(!s.fixedItems.every(e=>(e.day===undefined||(Number.isInteger(e.day)&&e.day>=1&&e.day<=31))&&(e.direction===undefined||['in','out'].includes(e.direction))&&(e.channel===undefined||['pix','card'].includes(e.channel))&&(e.tag===undefined||(typeof e.tag==='string'&&e.tag.length<=100))&&(!e.end||e.end>=e.start)))return false;
 const fixedTotals=new Map(),fixedIds=new Set();
 for(const e of s.fixedPaid??[])if(e.batch){
  const item=s.fixedItems.find(x=>x.id===e.id&&x.channel!=='card'&&x.direction!=='in'&&x.start<=e.month&&(!x.end||x.end>=e.month));
  const key=JSON.stringify([e.id,e.month]),identity=JSON.stringify([e.id,e.month,e.batch]);
  if(!item||fixedIds.has(identity)||confirmedFixed(s,e.id,e.month))return false;
  const amount=(fixedTotals.get(key)??0)+Math.round(e.amount*100);
  if(amount>reconFixedGrossCents(s,item,e.month))return false;
  fixedIds.add(identity);fixedTotals.set(key,amount);
 }
 return s.extraInvestments.every(x=>typeof x.id==='string'&&typeof x.name==='string'&&x.name.length<=120&&isDate(x.date)&&Number.isFinite(x.amount)&&x.amount>0)&&s.monthlyPaid.every(x=>isMonth(x.month)&&isDate(x.date)&&x.date.slice(0,7)===x.month&&Number.isFinite(x.amount)&&x.amount>=0)&&new Set(s.monthlyPaid.map(x=>x.month)).size===s.monthlyPaid.length;
}
function toV6(v){
 if(v.version===6)return v;
 const x=v.version===5?structuredClone(v):toV5(v);
 x.version=6;
 x.profiles=[{from:'2000-01',income:x.income,investments:x.investments,margin:0}];
 x.extraInvestments=[];
 return x;
}

function toV7(v){
 if(v.version===7)return v;
 const x=toV6(v);x.version=7;x.opening=null;x.extraIncome=[];x.cashEntries=[];
 return x;
}
function toV8(v){
 if(v.version===8)return {...v,investmentSkipped:Array.isArray(v.investmentSkipped)?v.investmentSkipped:[]};
 const x=toV7(v);x.version=8;x.monthlyPaid=[];x.fixedPaid=[];x.investmentSkipped=[];return x;
}
function settled(s,m){return (s.monthlyPaid||[]).find(x=>x.month===m)||null;}
function skipped(s,m){return (s.investmentSkipped||[]).includes(m)}
// Projeção local a partir de um saldo de abertura. Não significa conciliação bancária.
// Fevereiro usa o último dia do mês como equivalente ao pagamento do dia 30.
function eventDate(m,day){const [y,mo]=m.split('-').map(Number),last=new Date(y,mo,0).getDate();return `${m}-${pad(Math.min(day,last))}`}
// New profiles store each payday in exact cents. Older profiles keep their original split.
function validSalary(p){
 const first=p.salaryDay15Cents,last=p.salaryDay30Cents,percent=p.salaryMidMonthPercent;
 if(first===undefined&&last===undefined)return percent===undefined||(Number.isInteger(percent)&&percent>=0&&percent<100);
 return percent===undefined&&Number.isSafeInteger(first)&&first>=0&&Number.isSafeInteger(last)&&last>=0&&
   Number.isSafeInteger(first+last)&&p.income===(first+last)/100;
}
function salaryCents(p){
 if(p.salaryDay15Cents!==undefined)return [p.salaryDay15Cents,p.salaryDay30Cents];
 const sum=Math.round(p.income*100),first=Math.round(sum*(p.salaryMidMonthPercent??0)/100);
 return [first,sum-first];
}
function salaryEvents(s,m){
 const [first,last]=salaryCents(profile(s,m));
 const middle={date:eventDate(m,15),amount:first/100},late={date:eventDate(m,30),amount:last/100};
 return first&&last?[middle,late]:first?[middle]:[late];
}
function nextMonthEndPayday(date){
 const m=date.slice(0,7),pay=eventDate(m,30);
 return pay>date?pay:eventDate(shiftMonth(m,1),30);
}
function fixedDate(s,item,m){return eventDate(m,item.day||5)}
function confirmedFixed(s,id,m){return (s.fixedPaid||[]).find(x=>x.id===id&&x.month===m&&!x.batch)||null}
function cashAt(s,end){
 const opened=reconOpening(s);
 if(!opened)return null;
 const start=opened.date;
 const included=d=>(opened.closing?d>start:d>=start)&&d<=end;
 if(end<start)return round(opened.amount);
 let projected=opened.amount;
 for(let m=start.slice(0,7);m<=end.slice(0,7);m=shiftMonth(m,1)){
   const confirmed=reconPayment(s,m),invoiceDay=eventDate(m,5),paid=settled(s,m);
   for(const credit of salaryEvents(s,m))if(credit.date>start&&credit.date<=end)projected+=credit.amount;
   if(paid&&included(paid.date))projected-=paid.amount;
   if(!confirmed&&invoiceDay>start&&invoiceDay<=end)projected-=reconCardDueCents(s,m)/100;
 }
 // A fatura confirmada é lançada uma vez na data real, inclusive se o
 // pagamento ocorreu em mês diferente da competência.
 for(const entry of s.reconciliation?.payments??[]){
   if(entry.date>start&&entry.date<=end)projected-=(entry.cents??reconCardDueCents(s,entry.month))/100;
 }
 // Fixos são debitados automaticamente no dia configurado. Pagamentos históricos já confirmados prevalecem.
 for(let m=start.slice(0,7);m<=end.slice(0,7);m=shiftMonth(m,1)){
   for(const item of reconFixed(s,m)){
     const {date,amount}=reconScheduledFixed(s,item,m);
     if(date>start&&date<=end)projected+=(item.direction==='in'?1:-1)*amount;
   }
 }
 projected-=(s.fixedPaid??[]).filter(e=>e.batch&&included(e.date)).reduce((v,e)=>v+Math.round(e.amount*100),0)/100;
 projected+=s.extraIncome.filter(e=>included(e.date)).reduce((v,e)=>v+e.amount,0);
 projected-=s.expenses.filter(e=>!e.cardMonth&&included(e.date)).reduce((v,e)=>v+e.amount,0);
 projected-=s.extraInvestments.filter(e=>included(e.date)).reduce((v,e)=>v+e.amount,0);
 projected+=reconCashReceipts(s,opened.closing?addDays(start,1):start,end);
 projected-=reconPayableEvents(s).filter(e=>e.paidDate&&included(e.paidDate)).reduce((n,e)=>n+e.cents,0)/100;
 return round(projected);
}
// Previsão separada: futuros pagamentos são assumidos, mas nunca debitados do caixa atual
// antes de serem marcados como realizados. Pendências vencidas continuam protegidas.
function cashForecast(s,end,asOf=today()){
 let projected=cashAt(s,end);
 if(projected===null)return null;
 const start=reconOpening(s).date;
 for(let m=start.slice(0,7);m<=end.slice(0,7);m=shiftMonth(m,1)){
   const payDay=eventDate(m,30);
   if(!settled(s,m)&&!skipped(s,m)&&payDay>asOf&&payDay<=end&&payDay>start)projected-=investmentAmount(s,m);

 }
 if(end>=asOf)projected-=reconPayableEvents(s).filter(e=>!e.paidDate&&e.due<=end).reduce((n,e)=>n+e.cents,0)/100;
 return round(projected);
}
function overdueReserved(s,asOf=today()){
 if(!reconOpening(s))return 0;
 let total=0;
 const start=reconOpening(s).date;
 for(let m=start.slice(0,7);m<=asOf.slice(0,7);m=shiftMonth(m,1)){
   const day=eventDate(m,30);
   if(day>start&&day<=asOf&&!settled(s,m)&&!skipped(s,m))total+=investmentAmount(s,m);
 }
 return round(total);
}
function cashToday(s){return cashAt(s,today())}
// Os limites nunca contam salário futuro como dinheiro disponível hoje.
// Eventos futuros só ajudam a verificar se pagamentos posteriores caberão.
function addDays(date,n){const [y,m,d]=date.split('-').map(Number);return dateKey(new Date(y,m-1,d+n,12))}
function daysBetween(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000)}
function nextPayday(s,date){const m=date.slice(0,7);return salaryEvents(s,m).find(e=>e.date>date)?.date??salaryEvents(s,shiftMonth(m,1))[0].date}
function nextSunday(date){const d=new Date(date+'T12:00:00');return addDays(date,(7-d.getDay())%7)}
// Reserva adicional para o fechamento mais próximo: não confundir superávit futuro
// com dinheiro que já existe. Uma fatura que exceda o salário líquido do ciclo,
// considerando fixos, aporte planejado e margem, consome parte do saldo atual.
// A reserva não é saída de caixa: limita apenas os KPIs de consumo.
function nextInvoiceCoverage(s,asOf){
 const m=asOf.slice(0,7),thisDue=eventDate(m,5);
 const invoiceMonth=thisDue>asOf?m:shiftMonth(m,1);
 const invoiceDate=reconPayment(s,invoiceMonth)?.date??eventDate(invoiceMonth,5);
 const credits=[];
 for(let month=asOf.slice(0,7);month<=invoiceDate.slice(0,7);month=shiftMonth(month,1)){
   for(const credit of salaryEvents(s,month))if(credit.date>asOf&&credit.date<=invoiceDate)credits.push(credit);
 }
 const incomingSalary=round(credits.reduce((n,e)=>n+e.amount,0));
 const salaryDate=credits.at(-1)?.date??null;
 const invoice=invoiceDate>asOf?invoiceAmount(s,invoiceMonth):0;
 const fixed=round(reconFixed(s,invoiceMonth).filter(x=>x.direction!=='in').reduce((sum,item)=>{
   const {date,amount}=reconScheduledFixed(s,item,invoiceMonth);
   return sum+(date>asOf?amount:0);
 },0));
 const paid=settled(s,invoiceMonth);
 const investment=(skipped(s,invoiceMonth)||(paid&&paid.date<=asOf))?0:paid?paid.amount:investmentAmount(s,invoiceMonth);
 const margin=profile(s,invoiceMonth).margin;
 const obligations=round(invoice+fixed+investment+margin+(invoiceDate>asOf?reconPreviousCredit(s,invoiceMonth):0));
 return {invoiceMonth,invoiceDate,salaryDate,incomingSalary,invoice,fixed,investment,margin,obligations,shortfall:round(Math.max(0,obligations-incomingSalary))};
}
// Avalia os compromissos até o terceiro próximo crédito mensal.
// A margem é um piso de caixa, e não uma saída bancária nem um valor somado todos os meses.
function cycleBudget(s,asOf=today()){
 const next=nextPayday(s,asOf), days=Math.max(1,daysBetween(asOf,next));
 const current=reconOpening(s)&&reconOpening(s).date<=asOf?cashAt(s,asOf):null;
 if(current===null)return {ready:false,reason:'Configure um saldo de abertura com data igual ou anterior a hoje.'};
 const firstMonthEnd=nextMonthEndPayday(asOf),horizon=eventDate(shiftMonth(firstMonthEnd.slice(0,7),2),30);
 const checkpoints=new Set([asOf,next,horizon]);
 for(let month=asOf.slice(0,7);month<=horizon.slice(0,7);month=shiftMonth(month,1)){
   for(const t of [eventDate(month,5),...salaryEvents(s,month).map(e=>e.date)])if(t>asOf&&t<=horizon)checkpoints.add(t);
   for(const item of activeFixed(s,month)){const due=fixedDate(s,item,month);if(due>asOf&&due<=horizon)checkpoints.add(due)}
 }
 for(const group of [s.monthlyPaid||[],s.extraIncome||[],s.extraInvestments||[],s.expenses||[],s.reconciliation?.receipts||[],s.reconciliation?.payments||[]]){
   for(const item of group){if(item.date>asOf&&item.date<=horizon)checkpoints.add(item.date)}
 }
 for(const e of reconPayableEvents(s)){if(e.date>asOf&&e.date<=horizon)checkpoints.add(e.date);}
 const reserve=overdueReserved(s,asOf);
 let minimum=current-profile(s,asOf.slice(0,7)).margin-reserve;
 let lowestDate=asOf;
 for(const d of [...checkpoints].sort()){
   if(d<asOf)continue;
   const value=cashForecast(s,d,asOf)-profile(s,d.slice(0,7)).margin-reserve;
   if(value<minimum){minimum=value;lowestDate=d}
 }
 // O teste da liquidez por data não mede sozinho o déficit do orçamento
 // seguinte: o salário do dia 30 pode pagar a fatura do dia 5 e ainda assim
 // faltar dinheiro para o aporte e a margem do mês. Protegemos essa diferença.
 const coverage=nextInvoiceCoverage(s,asOf);
 const cashAfterProtected=round(current-profile(s,asOf.slice(0,7)).margin-reserve-coverage.shortfall);
 const available=round(Math.max(0,Math.min(current,minimum,cashAfterProtected)));
 const daily=round(available/days);
 const sunday=nextSunday(asOf);
 const remaining=Math.min(days,daysBetween(asOf,sunday)+1);
 const week=round(Math.min(available,available/days*remaining)), sundayBalance=cashForecast(s,sunday,asOf);
 return {ready:true,current,next,days,sunday,sundayBalance,remaining,available,daily,week,minimum:round(minimum),lowestDate,horizon,margin:profile(s,asOf.slice(0,7)).margin,coverage};
}

function profile(s,m){return s.profiles.filter(p=>p.from<=m).sort((a,b)=>b.from.localeCompare(a.from))[0]||s.profiles.slice().sort((a,b)=>a.from.localeCompare(b.from))[0]}
function plannedLegacyExtra(s,m){return s.investmentOverrides[m]||0}
function extraInvested(s,m){return round(s.extraInvestments.filter(x=>x.date.slice(0,7)===m).reduce((a,x)=>a+x.amount,0))}

function migrateV3(v){return {version:4,mode:'legacy',income:v.income,legacyFixed:v.fixed,legacyInvoices:{...v.invoices},fixedItems:[],baseParcels:[],investments:0,investmentOverrides:{},expenses:structuredClone(v.expenses),parcels:structuredClone(v.parcels),started:v.started};}
function isOldV2(v){return !!(v&&v.version===2&&Array.isArray(v.people)&&v.people.length===2&&Number.isInteger(v.selected))}
function migrateOld(v){const p=v.people[v.selected];return migrateV3({income:p.income,fixed:p.fixed,invoices:p.invoices,expenses:p.expenses,parcels:p.parcels,started:p.started})}
function migratePilot(v){if(!v||!Array.isArray(v.people)||v.people.length!==2)throw Error('Piloto inválido');const p=v.people[v.selected===1?1:0];return migrateV3({income:p.income,fixed:p.fixed,invoices:{[monthNow()]:p.invoice},expenses:(p.expenses||[]).map(e=>({...e,date:e.date||today(),id:String(e.id)})),parcels:(p.parcels||[]).map(e=>({...e,id:String(e.id),total:e.total??round(e.payment*e.count)})),started:isDate(v.started)?v.started:monday(new Date())})}
// Converte totais históricos sem detalhamento em itens identificados, sem fingir conhecer os nomes originais.
function toV5(v){
 const x=structuredClone(v);
 if(x.version===5)return x;
 if(x.version!==4)throw Error('Versão de dados desconhecida');
 if(x.mode==='legacy'){
   if(!x.fixedItems.length && x.legacyFixed>0)x.fixedItems.push({id:newId(),name:'Despesas fixas anteriores (total a detalhar)',amount:x.legacyFixed,start:'2000-01',end:null});
   if(!x.baseParcels.length){for(const [m,n] of Object.entries(x.legacyInvoices))if(n>0)x.baseParcels.push({id:newId(),name:'Fatura-base anterior '+m+' (total a detalhar)',payment:n,remaining:1,start:m});}
 }
 // Na versão 3.2 o valor de exceção substituía o padrão. Em 3.3 passa a ser extra positivo.
 // Para exceções menores que o padrão, preserva o valor via compatibilidade por mês.
 x.investmentLowerLegacy={};
 for(const [m,val] of Object.entries(x.investmentOverrides)){
   if(val>=x.investments)x.investmentOverrides[m]=round(val-x.investments);
   else {x.investmentLowerLegacy[m]=val;delete x.investmentOverrides[m];}
 }
 x.mode='items';x.version=5;return x;
}
let db,state,openPlanMonths=new Set(),closedInvestmentMonths=new Set(),openExpenseDays=new Set(),screen='home',writing=false,archived=false,editingBase=null,editingNew=null,viewMonth=monthNow();
function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('Feche as outras abas com o aplicativo aberto.'))})}
function read(key){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),q=tx.objectStore(STORE).get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}
function write(key,val){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(val,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error('Falha ao gravar'));tx.onabort=()=>reject(tx.error||Error('Gravação cancelada'))})}
let noticeTimer;
function clearNotice(){clearTimeout(noticeTimer);$('notice').className='notice hidden'}
function notice(msg,kind='ok'){
 clearTimeout(noticeTimer);
 const box=$('notice');box.textContent=msg;box.className='notice'+(kind==='ok'?'':' '+kind);
 noticeTimer=setTimeout(clearNotice,kind==='ok'?4500:8500);
}
const isCardScreen=()=>['recon','installments','acertos'].includes(screen);
const holdsScroll=()=>isCardScreen()||screen==='week'||screen==='investments';
let cardScrollReserve=0,scrollGuardDepth=0,scrollGuardRevision=0;
function setCardScrollReserve(top){
 const body=document.body,scroller=document.scrollingElement;
 if(!body||!scroller)return;
 cardScrollReserve=top;
 // A minimum document height does not affect longer lists or add space to them.
 // It only makes the current offset reachable if a filter or closed panel shortens the page.
 body.style.minHeight=top>0?(scroller.clientHeight+Math.ceil(top))+'px':'';
}
function restoreCardScroll(x,y){
 const scroller=document.scrollingElement;
 if(holdsScroll())setCardScrollReserve(y);
 else if(cardScrollReserve)setCardScrollReserve(0);
 const limit=scroller?Math.max(0,scroller.scrollHeight-scroller.clientHeight):y;
 const top=Math.min(y,limit);
 if(Math.abs(window.scrollY-top)>1||Math.abs((window.scrollX||0)-x)>1)window.scrollTo({left:x,top,behavior:'instant'});
}
function keepScrollPosition(work){
 if(scrollGuardDepth||typeof window==='undefined'||typeof window.scrollY!=='number')return work();
 const x=window.scrollX||0,y=Math.max(0,window.scrollY),rev=++scrollGuardRevision;
 scrollGuardDepth++;
 try{return work()}finally{
  scrollGuardDepth--;
  restoreCardScroll(x,y);
  // Safari can adjust the page after layout when a focused control was replaced.
  if(y>0&&holdsScroll()&&typeof window.requestAnimationFrame==='function'){
   const verify=()=>{if(rev===scrollGuardRevision&&holdsScroll())restoreCardScroll(x,y);};
   window.requestAnimationFrame(()=>{verify();window.requestAnimationFrame(verify);});
  }
 }
}
function releaseCardScrollTail(){
 if(cardScrollReserve&&holdsScroll()&&window.scrollY<cardScrollReserve) {
  // A scroll event may have been queued by the browser's temporary layout clamp.
  const revision=scrollGuardRevision;
  window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{
   if(revision===scrollGuardRevision&&holdsScroll()&&window.scrollY<cardScrollReserve)setCardScrollReserve(Math.max(0,window.scrollY));
  }));
 }
}
async function update(fn){if(writing)return false;writing=true;try{const next=structuredClone(state);fn(next);if(!valid(next))throw Error('Dados inválidos. Confira os campos.');await write(RECORD,next);state=next;render();clearNotice();return true}catch(e){notice('Não foi possível salvar: '+e.message,'error');return false}finally{writing=false}}
function activeFixed(s,m){return s.fixedItems.filter(e=>e.start<=m&&(!e.end||e.end>=m))}
function fixedAmount(s,m){return s.mode==='legacy'?s.legacyFixed:round(reconFixed(s,m).filter(e=>e.direction!=='in').reduce((a,e)=>a+reconFixedGrossCents(s,e,m)/100,0))}
function fixedIncomePlan(s,m){
 const direct=reconFixed(s,m).filter(e=>e.direction==='in'),seen=new Set(direct.map(e=>e.id));
 return [...direct,...activeFixed(s,m).filter(e=>reconNamedPix(e)&&!seen.has(e.id))];
}
function oldParts(s,m){return s.baseParcels.filter(e=>{const d=monthDiff(e.start,m);return d>=0&&d<e.remaining})}
function baseAmount(s,m){return s.mode==='legacy'?(s.legacyInvoices[m]??0):round(oldParts(s,m).reduce((a,e)=>a+e.payment,0))}
const newBaseAmount=baseAmount;
function newPartAmount(e,m){const off=monthDiff(e.start,m);if(off<0||off>=e.count)return 0;const cents=Math.round(e.total*100),unit=Math.round(e.payment*100);return (off===e.count-1?cents-unit*(e.count-1):unit)/100}
function newAmount(s,m){return round(s.parcels.reduce((a,e)=>a+(e.payTo?0:newPartAmount(e,m)),0))}
function invoiceAmount(s,m){return reconInvoice(s,m)??Math.max(0,round(baseAmount(s,m)+newAmount(s,m)-(s.reconciliation?.cardRefunds??[]).filter(x=>x.month===m).reduce((n,x)=>n+x.cents,0)/100))}
function investmentAmount(s,m){return Object.prototype.hasOwnProperty.call(s.investmentLowerLegacy||{},m)?s.investmentLowerLegacy[m]:round(profile(s,m).investments+plannedLegacyExtra(s,m))}
function monthly(s,m){const people=reconPayableEvents(s).filter(e=>e.date.slice(0,7)===m).reduce((n,e)=>n+e.cents,0)/100;const p=profile(s,m),known=s.mode==='items'||Object.prototype.hasOwnProperty.call(s.legacyInvoices,m),fixed=fixedAmount(s,m),fixedIncome=round(fixedIncomePlan(s,m).reduce((sum,e)=>sum+e.amount,0)),priorCredit=reconPreviousCredit(s,m),base=reconInvoice(s,m)??newBaseAmount(s,m),extra=reconInvoice(s,m)===null?newAmount(s,m):0,investment=investmentAmount(s,m),invested=extraInvested(s,m),actual=settled(s,m),applied=actual?actual.amount:(skipped(s,m)?0:investment);return {known,income:p.income,fixed,fixedIncome,base,extra,investment,margin:p.margin,invested,applied,people,available:round(p.income+fixedIncome-fixed-priorCredit-base-extra-applied-p.margin-invested-people),quotaBase:round(p.income+fixedIncome-fixed-priorCredit-base-extra-applied-p.margin-people)}}
function weeklyBudget(s,m){const x=monthly(s,m);return x.known?round(x.quotaBase*12/52):null}
function weekly(s){const start=s.started,cur=monday(new Date()),n=weekDiff(start,cur);if(n<0)return {known:false,balance:0,detail:'O controle ainda não começou.'};if(n>520)return {known:false,balance:0,detail:'Revise a data inicial do controle.'};let total=0,missing=0;for(let i=0;i<=n;i++){const b=weeklyBudget(s,weekShift(start,i).slice(0,7));if(b===null)missing++;else total+=b}const opened=s.opening&&s.opening.date>start?s.opening.date:start;const spent=s.expenses.filter(e=>!e.cardMonth&&e.date>=opened&&e.date<=today()).reduce((a,e)=>a+e.amount,0);const extras=s.extraIncome.filter(e=>e.date>=opened&&e.date<=today()).reduce((a,e)=>a+e.amount,0);const invested=s.extraInvestments.filter(e=>e.date>=opened&&e.date<=today()).reduce((a,e)=>a+e.amount,0);return missing?{known:false,balance:0,detail:`Faltam faturas-base em ${missing} semana(s) do período.`}:{known:true,balance:round(total-spent-invested+extras),detail:`Acumulado desde ${start.split('-').reverse().join('/')} · após gastos, aportes extras e entradas adicionais`}}
function calendarLabels(){for(const el of document.querySelectorAll('.calendar-field input')){const lab=document.querySelector(`[data-for="${el.id}"]`);if(!lab)continue;if(!el.value){lab.textContent=el.type==='month'?'Selecionar mês':'Selecionar data';continue}if(el.type==='month'){lab.textContent=shortMonthTitle(el.value)}else{lab.textContent=el.value.split('-').reverse().join('/')}}}
const THEME_KEY='finances-pwa-theme-v3.12';
const HEADER_ICONS={
  palette:'<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor"/>',
  moon:'<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" class="settings-knob"/><circle cx="15" cy="12" r="2" class="settings-knob"/><circle cx="10" cy="18" r="2" class="settings-knob"/>',
  back:'<path d="M20 12H4m8-8-8 8 8 8"/>'
};
function setHeaderIcon(button,icon,label){
 if(button.dataset.icon!==icon){button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${HEADER_ICONS[icon]}</svg>`;button.dataset.icon=icon;}
 button.setAttribute('aria-label',label);
 button.title=label;
}
function refreshHeaderButtons(){
 const pink=document.documentElement.dataset.theme==='pink';
 setHeaderIcon($('themeToggle'),'palette',pink?'Usar tema Azul marinho':'Usar tema Rosa noturno');
 setHeaderIcon($('quickSettings'),screen==='settings'?'back':'settings',screen==='settings'?'Voltar ao aplicativo':'Abrir ajustes');
 setHeaderIcon($('quickInfo'),screen==='info'?'back':'info',screen==='info'?'Voltar ao aplicativo':'Abrir informações');
}
function setTheme(theme){
 const next=theme==='pink'?'pink':'ocean';document.documentElement.dataset.theme=next;
 const meta=$('appThemeColor');if(meta)meta.content=next==='pink'?'#1c121e':'#0a1323';
 refreshHeaderButtons();
 for(const button of document.querySelectorAll('[data-theme-choice]'))button.setAttribute('aria-pressed',String(button.dataset.themeChoice===next));
 try{localStorage.setItem(THEME_KEY,next)}catch{}
}
function showScreen(name){screen=name;showScreenNoScroll()}
function parcelClassifyButton(id,monthRows){
 const t=reconParcelTarget(state,id,monthRows);
 if(!t)return '';
 const chips=window.ParcelReconUI?.parcelLabels(t.row,reconOwner(state))||'';
 return `<button type="button" class="small-action parcel-label-button" data-classify-parcel="${esc(id)}" aria-label="${chips?'Editar classificação':'Classificar'}: ${esc(t.row.name)}">${chips||'Classificar'}</button>`;
}
function rows(items,type,monthRows){if(!items.length)return '<p class="empty">Nenhum item cadastrado.</p>';return items.map(e=>{let extra='';if(type==='fixed')extra=`${money(e.amount)} por mês · débito dia ${e.day||5} · ${e.start}${e.end?' até '+e.end:''}`;if(type==='base')extra=`${e.remaining} parcela(s) de ${money(e.payment)} · desde ${e.start}`;if(type==='new')extra=`${e.count}x · ${money(e.total)} · ${e.payTo?'A pagar a '+e.payTo:'Meu cartão'} · desde ${e.start}`;return `<div class="entry${type==='new'?' parcel-history-entry':''}"><div class="entry-main"><div class="entry-title">${esc(e.name)}</div><div class="entry-description">${esc(extra)}</div></div><div class="entry-right">${type==='new'?parcelClassifyButton(e.id,monthRows):''}<button type="button" class="small-action" data-edit-${type}="${esc(e.id)}">Editar</button><button type="button" class="entry-remove" data-delete-${type}="${esc(e.id)}" aria-label="Excluir ${esc(e.name)}">×</button></div></div>`}).join('')}
function pct(amount,income){return income>0?`${(100*amount/income).toLocaleString('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1})}%`:'—'}
function breakdown(s,m){
 const z=monthly(s,m),income=z.income;
 const line=(name,value,meta='',sign='−')=>`<div class="detail-line detail-percent"><span>${esc(name)}${meta?`<small>${esc(meta)}</small>`:''}</span><div class="line-amount"><strong>${sign} ${money(value)}</strong><small>${pct(value,income)} da renda</small></div></div>`;
 const group=(label,items,sign='−')=>{
   const total=round(items.reduce((v,e)=>v+e.amount,0));
   const content=items.slice().sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount)||a.name.localeCompare(b.name,'pt-BR')).map(e=>line(e.name,Math.abs(e.amount),e.meta||'',e.sign||(e.amount<0?(sign==='−'?'+':'−'):sign))).join('');
   return `<details class="breakdown-group"><summary><span>${esc(label)} <small>${items.length} itens</small></span><span class="group-money"><strong>${total<0?(sign==='−'?'+':'−'):sign} ${money(Math.abs(total))}</strong><small>${pct(Math.abs(total),income)} da renda</small></span></summary><div class="breakdown-rows">${content||'<p class="empty">Nenhum item neste mês.</p>'}</div></details>`;
 };
 const fixed=s.mode==='legacy'?[{name:'Total antigo de fixos',amount:z.fixed}]:reconFixed(s,m).filter(e=>e.direction!=='in').map(e=>({name:e.name,amount:e.amount,meta:`Dia ${e.day||5}`}));
 const fixedIncome=fixedIncomePlan(s,m).map(e=>({name:e.name,amount:e.amount,meta:`Dia ${e.day||5}`}));
 const reconciled=reconInvoice(s,m);
 const base=reconciled!==null?reconRows(s,m).filter(x=>x.kind!=='prior-payment').map(x=>({name:x.name,amount:x.cents/100})):s.mode==='legacy'?[{name:'Total antigo da fatura',amount:z.base}]:oldParts(s,m).map(e=>({name:e.name,amount:e.payment}));
 const newer=reconciled!==null?[]:s.parcels.filter(e=>!e.payTo).map(e=>({name:e.name,amount:newPartAmount(e,m)})).filter(e=>e.amount>0);
 const payables=reconPayableEvents(s).filter(e=>e.date.slice(0,7)===m).map(e=>({name:e.name,amount:e.cents/100,meta:e.person+' · '+(e.paidDate?'Pago em ':'Previsto para ')+readableDate(e.date)}));
 const previousCredit=reconPreviousCreditRows(s,m).map(e=>({name:e.name,amount:e.cents/100}));
 const confirmed=settled(s,m),extra=extraInvested(s,m),investmentItems=[];
 if(confirmed)investmentItems.push({name:'Aporte principal realizado',amount:confirmed.amount,meta:confirmed.date.split('-').reverse().join('/')});
 else if(skipped(s,m))investmentItems.push({name:'Aporte mensal não realizado',amount:0,meta:`Meta: ${money(z.investment)}`});
 else investmentItems.push({name:'Meta de investimento mensal',amount:z.investment,meta:'Pendente'});
 investmentItems.push(...s.extraInvestments.filter(e=>e.date.slice(0,7)===m).map(e=>({name:e.name,amount:e.amount,meta:e.date.split('-').reverse().join('/')})));
 const extras=s.extraIncome.filter(e=>e.date.slice(0,7)===m).map(e=>({name:e.name,amount:e.amount}));
 const extraTotal=round(extras.reduce((sum,e)=>sum+e.amount,0));
 return `<div class="detail-line detail-percent"><span>Renda líquida</span><div class="line-amount"><strong>${money(income)}</strong><small>100% da renda</small></div></div>`+
 group('Saídas fixas por Pix',fixed)+(fixedIncome.length?group('Entradas fixas por Pix',fixedIncome,'+'):'')+group(reconciled===null?'Parcelas anteriores':'Fatura do cartão',base)+(payables.length?group('A pagar a pessoas',payables):'')+(reconciled===null?group('Compras parceladas novas',newer):'')+(previousCredit.length?group('Movimentações de crédito anteriores',previousCredit):'')+group('Investimentos',investmentItems)+group('Entradas extras',extras,'+')+
 line('Margem protegida',z.margin)+
 `<div class="detail-line detail-total detail-percent"><span>Livre no mês (planejado)</span><div class="line-amount"><strong>${z.known?money(round(z.available+extraTotal)):'—'}</strong><small>${z.known?pct(round(z.available+extraTotal),income):'—'} da renda</small></div></div>`;
}
function investmentsStatus(s,m){const paid=settled(s,m),extra=extraInvested(s,m),plan=investmentAmount(s,m);return {paid,extra,plan,total:round((paid?paid.amount:0)+extra),status:paid?'done':skipped(s,m)?'skipped':'pending'};}
function renderInvestmentMonth(m){
 const el=$('investmentFocusMonth'),now=monthNow();
 const recorded=[...state.monthlyPaid.map(x=>x.month),...(state.investmentSkipped??[]),...state.extraInvestments.map(x=>x.date.slice(0,7))];
 const months=new Set([m,now,shiftMonth(m,-1),shiftMonth(m,1),...recorded]);
 for(let i=-11;i<=2;i++)months.add(shiftMonth(now,i));
 const list=[...months].filter(isMonth).sort().reverse(),signature=list.join(',');
 if(el.dataset.months!==signature){el.innerHTML=list.map(x=>`<option value="${x}">${monthTitle(x)}</option>`).join('');el.dataset.months=signature;}
 if(el.value!==m)el.value=m;
 const x=investmentsStatus(state,m);
 $('homeInvestmentMonth').textContent=shortMonthTitle(m);
 for(const [id,value] of [['InvestmentMonthTotal',x.total],['InvestmentMonthPrincipal',x.paid?.amount??0],['InvestmentMonthExtra',x.extra]]){
  $(id[0].toLowerCase()+id.slice(1)).textContent=money(value);
  $('home'+id).textContent=money(value);
 }
}
function setInvestmentMonth(m,syncExtra=true){
 if(!isMonth(m)||!state)return;
 renderInvestmentMonth(m);
 updateInvestmentForm();
 renderInvestmentHistory(m);
 if(syncExtra&&$('extraDate').value.slice(0,7)!==m){$('extraDate').value=m===monthNow()?today():m+'-01';calendarLabels();}
}
function showInvestmentPanel(history){
 for(const [tab,panel,selected] of [['investmentContributionsTab','investmentContributionsPanel',!history],['investmentHistoryTab','investmentHistoryPanel',history]]){
  $(tab).classList.toggle('active',selected);$(tab).setAttribute('aria-pressed',String(selected));
  $(panel).classList.toggle('hidden',!selected);
 }
}
function updateInvestmentForm(){if(!state)return;const m=$('investmentFocusMonth').value||monthNow(),x=investmentsStatus(state,m);
 renderInvestmentMonth(m);
 $('investmentTarget').textContent=money(x.plan);$('investmentDone').checked=x.status==='done';
 $('investmentStatusNote').textContent=x.status==='done'?'Registrado':x.status==='skipped'?'Não feito neste mês':'Pendente';
 $('skipFirstContribution').textContent=x.status==='skipped'?'Voltar para pendente':'Marcar como não feito';
 $('investmentConfirmAmount').value=x.status==='done'&&x.paid?x.paid.amount.toFixed(2):x.plan.toFixed(2);
 $('investmentConfirmDate').value=x.paid?.date||eventDate(m,Math.min(Number(today().slice(-2)),30));
 const date=$('investmentConfirmDate').value;
 if(!date.startsWith(m))$('investmentConfirmDate').value=m+'-01';
 showInvestmentFields();
}
function showInvestmentFields(){
 const done=$('investmentDone').checked;
 const wasDone=investmentsStatus(state,$('investmentFocusMonth').value||monthNow()).status==='done';
 $('investmentDoneFields').classList.toggle('hidden',!done);
 $('investmentConfirmAmount').required=done;$('investmentConfirmDate').required=done;
 $('saveFirstContribution').classList.toggle('hidden',!done&&!wasDone);
 $('saveFirstContribution').textContent=done?'Salvar primeiro aporte':'Voltar para pendente';
 $('skipFirstContribution').classList.toggle('hidden',done);
 calendarLabels();
}
function renderInvestmentPanels(){
 const m=$('investmentFocusMonth').value||monthNow();
 renderInvestmentMonth(m);
 renderInvestmentHistory(m);
}
function renderInvestmentHistory(month){
 const info=investmentsStatus(state,month),difference=round(info.total-info.plan);
 const principal=info.paid?`Feito: ${money(info.paid.amount)}`:info.status==='skipped'?'Não feito':'Pendente';
 const differenceLabel=difference>0?'Acima da meta':difference<0?'Abaixo da meta':'Na meta';
 const extraRows=state.extraInvestments.filter(item=>item.date.slice(0,7)===month).sort((a,b)=>b.date.localeCompare(a.date)).map(item=>
       `<div class="entry monthly-extra-row"><div class="entry-main"><div class="entry-title">${esc(item.name)}</div><time class="entry-description" datetime="${item.date}">${shortDate(item.date)}</time></div><div class="entry-right"><strong class="entry-price">${money(item.amount)}</strong><button class="entry-remove" type="button" data-delete-extra="${esc(item.id)}" aria-label="Excluir aporte extra: ${esc(item.name)}">×</button></div></div>`).join('');
 const summary=`<details class="investment-history-month investment-month-fold" data-history-month="${month}" open><summary><span class="investment-history-month-name">${shortMonthTitle(month)}</span><strong class="month-big-total">${money(info.total)}</strong></summary><div class="investment-month-content"><div class="investment-month-values"><div><small>Meta ${money(info.plan)}</small><strong>${principal}</strong></div><div><small>Aportes extras</small><strong>${money(info.extra)}</strong></div><div><small>${differenceLabel}</small><strong class="${difference<0?'negative':difference>0?'investment-above':''}">${difference>0?'+':''}${money(difference)}</strong></div></div><button type="button" class="small-action investment-month-edit" data-edit-investment="${month}" aria-label="Editar primeiro aporte de ${monthTitle(month)}">Editar primeiro aporte</button>${extraRows?`<div class="monthly-extras" aria-label="Aportes extras deste mês">${extraRows}</div>`:''}</div></details>`;
 const root=$('investmentHistory');
 if(root.dataset.content!==summary){
  root.innerHTML=summary;root.dataset.content=summary;
  const fold=root.firstElementChild;
  if(fold&&closedInvestmentMonths.has(month))fold.open=false;
 }
}
const dayAndMonth=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit'});
const shortDate=date=>dayAndMonth.format(new Date(date+'T12:00:00')).replace(' de ',' ').replace('.','');
function renderDashboard(asOf,calc,m){
 const since=monday(new Date(asOf+'T12:00:00')),sunday=nextSunday(asOf);
 $('weekRange').textContent=since.slice(0,7)===sunday.slice(0,7)?`${since.slice(-2)}–${shortDate(sunday)}`:`${shortDate(since)} – ${shortDate(sunday)}`;
 $('cashBalance').textContent=calc.ready?money(calc.current):'—';
 $('cashBalance').classList.toggle('negative',calc.ready&&calc.current<0);
 renderAvailability(asOf,calc);
 renderCommitmentTotals(state,cardMonth??defaultCardMonth(asOf));
 $('currentMargin').textContent=money(profile(state,m).margin);
}
const budgetSelected=new Set();
let budgetData=null;
function renderAvailability(asOf,calc){
 if(budgetData?.state!==state||budgetData.asOf!==asOf){
  const bills=upcomingBudgetBills(state,asOf),debts=budgetDebts(state,asOf,bills),people=new Map();
  for(const d of debts)if(d.remaining>0){
   const key=reconPersonKey(d.person);
   if(!people.has(key))people.set(key,d.person);
  }
  for(const key of budgetSelected)if(!people.has(key))budgetSelected.delete(key);
  budgetData={state,asOf,debts,bills,people,calc,limits:new Map()};
  const buttons=[...people].sort(([,a],[,b])=>a.localeCompare(b,'pt-BR')).map(([key,name])=>
   `<button type="button" data-budget-person="${esc(key)}" aria-pressed="${budgetSelected.has(key)}"><span aria-hidden="true">✓ </span>${esc(name)}</button>`
  ).join('');
  $('budgetPeople').innerHTML=buttons||'<span>Ninguém em aberto</span>';
 }
 renderTodayLimit();
}
function renderTodayLimit(){
 const {asOf,debts,bills,calc,limits}=budgetData;
 const current=calc.ready?calc.current:null;
 const key=JSON.stringify([...budgetSelected].sort());
 if(!limits.has(key)){
  if(limits.size>=24)limits.clear();
  const projection=spendingTimeline(state,asOf,current,budgetSelected,debts,bills);
  projection.coverage=commitmentPeriods(state,asOf,projection);
  limits.set(key,projection);
 }
 const p=limits.get(key);
 const first=p.coverage[0],el=$('todayAvailable'),text=first?.details?money(first.details.free/100):'—';
 if(el.textContent!==text)el.textContent=text;
 const due=$('availableThrough'),date=first?.date??'';
 due.hidden=!date;
 if(date){due.dateTime=date;due.textContent=`Até ${shortDate(date)}`;}
 renderCommitmentScenario(p.coverage);
}
function renderCommitmentScenario(periods){
 const root=$('budgetCoverage');
 const opened=new Set([...root.querySelectorAll?.('details[open]')??[]].map(x=>x.dataset.budgetPeriod));
 const next=periods.map(({label,date,month,details:c})=>`<details class="budget-period" data-budget-period="${month}" ${opened.has(month)?'open':''}>
  <summary><span>${label} <time datetime="${date}">${shortDate(date)}</time></span><strong>${c?money(c.free/100):'—'}</strong></summary>
  ${c?`<div class="budget-period-body"><p>Pix previstos: ${money(c.reimbursements/100)} · Salários previstos: ${money(c.salaries/100)}</p>
   <dl>${c.rows.map(r=>`<div><dt>${r.label}</dt><dd>${money(r.covered/100)}${r.covered<r.target?`<small>Faltam ${money((r.target-r.covered)/100)}</small>`:''}</dd></div>`).join('')}
   <div class="coverage-free"><dt>Livre no período</dt><dd>${money(c.free/100)}</dd></div></dl></div>`:'<p class="budget-period-body">Sem projeção para esta data.</p>'}</details>`).join('');
 if(root.dataset.coverage!==next){root.innerHTML=next;root.dataset.coverage=next;}
}
function toggleBudgetPerson(event){
 const button=event.target.closest('button[data-budget-person]');
 if(!button||!budgetData?.people.has(button.dataset.budgetPerson))return;
 const key=button.dataset.budgetPerson;
 const selected=!budgetSelected.delete(key);
 if(selected)budgetSelected.add(key);
 button.setAttribute('aria-pressed',String(selected));
 renderTodayLimit();
}

const calendarDate=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
const readableDate=date=>calendarDate.format(new Date(date+'T12:00:00'));
let movementMode='expense',editingMovement=null,movementMonth=monthNow();
function movementEntries(s,month=null){
 return [...s.expenses.filter(e=>!e.cardMonth).map(e=>({...e,direction:'out'})),
  ...s.extraIncome.map(e=>({...e,direction:'in'}))].filter(e=>!month||e.date.slice(0,7)===month);
}
function renderMovementOverview(){
 const select=$('movementMonth'),m=movementMonth;
 const records=movementEntries(state);
 const months=[...new Set([m,monthNow(),shiftMonth(m,-1),shiftMonth(m,1),...state.expenses.map(e=>e.date.slice(0,7)),...records.map(e=>e.date.slice(0,7))])].sort().reverse();
 const signature=months.join(',');
 if(select.dataset.months!==signature){
  select.innerHTML=months.map(month=>`<option value="${month}">${monthTitle(month)}</option>`).join('');
  select.dataset.months=signature;
 }
 if(select.value!==m)select.value=m;
 let incoming=0,outgoing=0;
 const entries=records.filter(e=>e.date.slice(0,7)===m);
 for(const e of entries){const cents=Math.round(e.amount*100);if(e.direction==='in')incoming+=cents;else outgoing+=cents;}
 if($('homeMovementMonth'))$('homeMovementMonth').textContent=shortMonthTitle(m);
 for(const [id,value] of [['movementInTotal',incoming],['movementOutTotal',outgoing]]){
  $(id).textContent=money(value/100);
  const home=$('home'+id[0].toUpperCase()+id.slice(1));if(home)home.textContent=money(value/100);
 }
 return entries;
}
function setMovementMonth(month){
 if(!isMonth(month)||month===movementMonth)return;
 return keepScrollPosition(()=>{movementMonth=month;editingMovement=null;renderExpenseHistory();});
}
function movementKey(direction,id){return JSON.stringify([direction,id]);}
function movementEditor(entry,key){
 return `<form class="recon-edit recon-value-form movement-value-form" data-movement-editor="${key}" aria-label="Editar lançamento">
 <label for="movementEditName">Descrição</label><input id="movementEditName" name="description" type="text" value="${esc(entry.name)}" placeholder="E.x. ${entry.direction==='in'?'Bônus':'Jantar'}" maxlength="120" required>
 <label for="movementEditAmount">Valor (R$)</label><input id="movementEditAmount" name="amount" inputmode="decimal" placeholder="0,00" value="${entry.amount.toFixed(2).replace('.',',')}" required>
 <div class="recon-actions recon-label-actions"><button type="submit" class="primary">Salvar</button><button type="button" class="secondary" data-movement-cancel>Cancelar</button><button type="button" class="secondary recon-exclude-installment" data-movement-delete>Excluir</button></div></form>`;
}
function renderExpenseHistory(){
 const entries=renderMovementOverview();
 if(movementMode!=='statement')return;
 const groups=new Map();
 for(const entry of entries){
  if(!groups.has(entry.date))groups.set(entry.date,[]);
  groups.get(entry.date).push(entry);
 }
 const row=entry=>{
   const incoming=entry.direction==='in',key=movementKey(entry.direction,entry.id),open=editingMovement===key;
   const renamed=entry.cardMonth?reconRows(state,entry.cardMonth,true).find(x=>x.id==='cashcard:'+entry.id)?.name:undefined;
   return `<article class="recon-row recon-card-line recon-invoice-line movement-statement-line">
     <button type="button" class="recon-entry-name recon-invoice-name" data-movement-edit="${esc(key)}" aria-expanded="${open}">${esc(renamed??entry.name)}</button>
     <strong class="recon-invoice-amount${incoming?' entry-credit':''}">${incoming?'+':'−'} ${money(entry.amount)}</strong>
     <div class="recon-invoice-meta"><small class="recon-invoice-date"><time datetime="${entry.date}">${readableDate(entry.date)}</time>${entry.cardMonth?' · Cartão ' + monthTitle(entry.cardMonth):''}</small></div>
   </article>${open?movementEditor({...entry,name:renamed??entry.name},esc(key)):''}`;
 };
 const direct=[...groups].sort(([a],[b])=>b.localeCompare(a)).map(([day,items])=>{
  const cents=items.reduce((sum,e)=>sum+(e.direction==='in'?1:-1)*Math.round(e.amount*100),0);
  const signed=cents<0?'− ':cents>0?'+ ':'';
  return `<details class="history-month-fold statement-day-fold" data-expense-day="${day}" ${openExpenseDays.has(day)?'open':''}><summary><span>${readableDate(day)}</span><strong class="statement-month-total${cents>0?' entry-credit':''}" aria-label="Total líquido: ${signed}${money(Math.abs(cents)/100)}">${signed}${money(Math.abs(cents)/100)}</strong></summary><div class="history-month-content">${items.map(row).join('')}</div></details>`;
 }).join('');
 const legacy=state.expenses.filter(e=>e.cardMonth&&e.date.slice(0,7)===movementMonth)
   .sort((a,b)=>b.date.localeCompare(a.date)).map(e=>({...e,direction:'out'}));
 const legacyKey='legacy:'+movementMonth;
 const historical=legacy.length?`<details class="history-month-fold statement-day-fold" data-expense-day="${legacyKey}" ${openExpenseDays.has(legacyKey)?'open':''}><summary><span>Créditos antigos</span></summary><div class="history-month-content">${legacy.map(row).join('')}</div></details>`:'';
 $('expenses').innerHTML=(direct+historical)||'<p class="empty">Nenhum lançamento neste mês.</p>';
}
function closeMovementEditor(){
 return keepScrollPosition(()=>{editingMovement=null;renderExpenseHistory();});
}
function changeMovement(s,key,cents,description){
 const [direction,id]=JSON.parse(key);
 const field=direction==='in'?'extraIncome':direction==='out'?'expenses':null;
 const entry=field&&s[field].find(x=>x.id===id);
 if(!entry)throw Error('Lançamento não encontrado.');
 if(cents!==null&&(!Number.isSafeInteger(cents)||cents<=0||cents>1e12))throw Error('Informe um valor positivo.');
 if(direction==='out'&&reconHasAllocated(s,'cashcard:'+id)&&(cents===null||cents!==Math.round(entry.amount*100)))throw Error('Há um Pix vinculado a este lançamento. Desfaça o recebimento antes de alterá-lo.');
 if(cents===null){s[field]=s[field].filter(x=>x!==entry);return;}
 if(description!==undefined){
  const name=String(description).trim();
  if(!name||name.length>120)throw Error('Informe uma descrição com até 120 caracteres.');
  entry.name=name;
  // A classificação de um crédito antigo pode ter substituído o nome mostrado.
  if(entry.cardMonth)for(const edit of s.reconciliation?.overrides??[]){
   if(edit.rowId==='cashcard:'+entry.id&&edit.name!==undefined)edit.name=name;
  }
 }
 entry.amount=cents/100;
}
let fixedDirection='out',fixedSelection=null,fixedEditTab='tag';
const fixedMethod=e=>e.channel==='card'?'Fatura do cartão':'Pix recorrente';
const fixedFieldMonth=(id,caption,value,required=false)=>`<label for="${id}">${caption}</label><div class="calendar-field"><span class="calendar-label" data-fixed-date-label aria-hidden="true">${value?shortMonthTitle(value):'Sem término'}</span><span class="calendar-icon" aria-hidden="true">▦</span><input id="${id}" name="${id}" type="month" value="${esc(value||'')}" ${required?'required':''}></div>`;
function fixedEditor(e,adding){
 const hasTag=adding||fixedEditTab==='tag',hasValue=adding||fixedEditTab==='value',card=e.channel==='card';
 return `<div class="recon-line-editor">
 ${adding?'':`<div class="subtabs recon-editor-tabs" role="group" aria-label="Editar valor fixo">${[['tag','Etiqueta'],['value','Valor']].map(([k,l])=>`<button type="button" data-fixed-edit-tab="${k}" class="${fixedEditTab===k?'active':''}" aria-pressed="${fixedEditTab===k}">${l}</button>`).join('')}</div>`}
 <form class="recon-edit recon-value-form fixed-editor" data-fixed-form="${adding?'add':fixedEditTab}">
 ${hasTag?`<label for="repeatName">Descrição</label><input id="repeatName" name="description" value="${esc(e.name)}" placeholder="E.x. ${fixedDirection==='in'?'Reembolso mensal':'Internet'}" maxlength="120" required>
 <label for="repeatTag">Pessoa / etiqueta</label><input id="repeatTag" name="tag" value="${esc(e.tag)}" placeholder="E.x. Nome da pessoa" maxlength="100">`:''}
 ${hasValue?`<label for="repeatAmount">Valor (R$)</label><input id="repeatAmount" name="amount" inputmode="decimal" value="${adding?'':Number(e.amount).toFixed(2).replace('.',',')}" placeholder="0,00" required>
 <label for="repeatChannel">Forma</label><select id="repeatChannel" name="channel"><option value="pix" ${card?'':'selected'}>Pix recorrente</option><option value="card" ${card?'selected':''}>Fatura do cartão</option></select>
 <label for="repeatDay" data-fixed-day-label>${card?'Dia do lançamento na fatura':fixedDirection==='in'?'Dia do recebimento':'Dia do pagamento'}</label><input id="repeatDay" name="day" type="number" inputmode="numeric" min="1" max="31" step="1" value="${e.day||5}" required>
 <div class="two-cols"><div>${fixedFieldMonth('repeatStart','Início',e.start,true)}</div><div>${fixedFieldMonth('repeatEnd','Fim',e.end)}</div></div>`:''}
 <div class="recon-actions recon-label-actions${adding?' recon-two-actions':''}"><button type="submit" class="primary">Salvar</button><button type="button" class="secondary" data-fixed-cancel>Cancelar</button>${adding?'':`<button type="button" class="secondary recon-exclude-installment" data-fixed-delete>Excluir</button>`}</div>
 </form></div>`;
}
function renderFixedValues(){
 const root=$('fixedValues');if(!root)return;
 const items=state.fixedItems.filter(e=>(e.direction??'out')===fixedDirection).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const adding=fixedSelection==='new';
 const line=e=>{
  const open=fixedSelection===e.id;
  const span=shortMonthTitle(e.start)+' · '+(e.end?shortMonthTitle(e.end):'Sem término');
  return `<article class="recon-row recon-card-line recon-invoice-line movement-statement-line">
  <button type="button" class="recon-entry-name recon-invoice-name" data-fixed-title="${esc(e.id)}" aria-expanded="${open}">${esc(e.name)}</button>
  <strong class="recon-invoice-amount${fixedDirection==='in'?' entry-credit':''}">${money(e.amount)}</strong>
  <div class="recon-invoice-meta"><small class="recon-invoice-date">${fixedMethod(e)} · ${span}</small></div>
  ${e.tag?`<div class="recon-invoice-tags"><span class="recon-empty-chip">${esc(e.tag)}</span></div>`:''}</article>${open?fixedEditor(e,false):''}`;
 };
 root.innerHTML=`<div class="subtabs fixed-values-tabs" role="group" aria-label="Valores fixos">${[['in','Entradas'],['out','Saídas']].map(([key,label])=>`<button type="button" data-fixed-direction="${key}" class="${fixedDirection===key?'active':''}" aria-pressed="${fixedDirection===key}">${label}</button>`).join('')}</div>
 ${adding?fixedEditor({name:'',tag:'',day:5,start:monthNow()},true):`<button type="button" class="secondary fixed-values-add" data-fixed-add>${fixedDirection==='in'?'Adicionar Entrada':'Adicionar Saída'}</button>`}
 <div class="recon-rows">${items.map(line).join('')||`<p class="empty">Nenhuma ${fixedDirection==='in'?'entrada fixa':'saída fixa'} cadastrada.</p>`}</div>`;
}
function changeFixedValue(s,id,fields){
 const old=id?s.fixedItems.find(e=>e.id===id):null;
 if(id&&!old)throw Error('Valor fixo não encontrado.');
 const pixLinked=old&&reconHasAllocated(s,'fixedpix:'+id);
 const linked=old&&(reconHasAllocated(s,'recurring:'+id)||pixLinked||(s.fixedPaid??[]).some(p=>p.id===id));
 if(fields===null){
  if(linked)throw Error('Remova primeiro os pagamentos vinculados.');
  s.fixedItems=s.fixedItems.filter(e=>e.id!==id);return;
 }
 const next={...old,...fields,id:id??newId()};
 if(!next.name||next.name.length>120||(next.tag??'').length>100||!Number.isFinite(next.amount)||next.amount<0||next.amount>1e10||!isMonth(next.start)||(next.end&&(!isMonth(next.end)||next.end<next.start))||
  next.day!==undefined&&(!Number.isInteger(next.day)||next.day<1||next.day>31))throw Error('Confira a descrição, o valor e o período.');
 if(!old&&next.amount<=0)throw Error('Informe um valor positivo.');
 const protectedMonths=[...(s.fixedPaid??[]).filter(p=>p.id===id).map(p=>p.month),...(s.reconciliation?.receipts??[]).flatMap(p=>p.allocations.filter(a=>a.rowId==='fixedpix:'+id||a.rowId==='recurring:'+id).map(a=>a.month))];
 const dropsPayment=next.end&&protectedMonths.some(m=>m>next.end);
 if((pixLinked&&reconPersonKey(next.tag)!==reconPersonKey(old.tag))||(linked&&(['amount','day','start','channel','direction'].some(k=>next[k]!==old[k])||dropsPayment)))throw Error('Remova primeiro os pagamentos vinculados para alterar a recorrência.');
 if(old)s.fixedItems=s.fixedItems.map(e=>e.id===id?next:e);else s.fixedItems.push(next);
}
function openFixedSetting(id){
 const item=state.fixedItems.find(e=>e.id===id);if(!item)return;
 fixedDirection=item.direction??'out';fixedSelection=item.id;fixedEditTab='tag';
 renderFixedValues();showScreen('settings');$('fixedValuesSection').open=true;
}
function fixedClick(e){
 const b=e.target.closest?.('button');if(!b||writing)return;
 const redraw=fn=>keepScrollPosition(()=>{fn();renderFixedValues();});
 if(b.dataset.fixedDirection){if(fixedDirection!==b.dataset.fixedDirection)redraw(()=>{fixedDirection=b.dataset.fixedDirection;fixedSelection=null;});return;}
 if(b.hasAttribute('data-fixed-add'))return redraw(()=>{fixedSelection='new';});
 if(b.hasAttribute('data-fixed-title'))return redraw(()=>{fixedSelection=fixedSelection===b.dataset.fixedTitle?null:b.dataset.fixedTitle;fixedEditTab='tag';});
 if(b.dataset.fixedEditTab){if(fixedEditTab!==b.dataset.fixedEditTab)redraw(()=>{fixedEditTab=b.dataset.fixedEditTab;});return;}
 if(b.hasAttribute('data-fixed-cancel'))return redraw(()=>{fixedSelection=null;});
 if(b.hasAttribute('data-fixed-delete')&&fixedSelection&&fixedSelection!=='new'&&confirm('Excluir este valor fixo do Diário? As faturas importadas não serão alteradas.')){
   const id=fixedSelection;update(s=>changeFixedValue(s,id,null)).then(ok=>{if(ok)redraw(()=>{fixedSelection=null;});});
 }
}
function fixedChange(e){
 const el=e.target;
 if(el.name==='channel'){
  const label=el.form.querySelector('[data-fixed-day-label]');
  if(label)label.textContent=el.value==='card'?'Dia do lançamento na fatura':fixedDirection==='in'?'Dia do recebimento':'Dia do pagamento';
 }else if(el.type==='month'){
  const label=el.closest('.calendar-field')?.querySelector('[data-fixed-date-label]');
  if(label)label.textContent=el.value?shortMonthTitle(el.value):el.required?'Selecionar mês':'Sem término';
 }
}
async function fixedSubmit(e){
 const f=e.target,k=f.dataset.fixedForm;
 if(!k||!fixedSelection)return;
 e.preventDefault();
 const fields={},els=f.elements;
 if(k!=='value'){fields.name=els.description.value.trim();fields.tag=els.tag.value.trim();}
 if(k!=='tag'){
  const amount=els.amount.value.trim().replace(',','.');
  if(!/^\d{1,10}(\.\d{1,2})?$/.test(amount)||Number(amount)<=0)return notice('Informe um valor positivo.','warning');
  Object.assign(fields,{amount:round(Number(amount)),channel:els.channel.value,day:Number(els.day.value),start:els.repeatStart.value,end:els.repeatEnd.value||null});
 }
 if(k==='add')fields.direction=fixedDirection;
 const id=k==='add'?null:fixedSelection;
 if(await update(s=>changeFixedValue(s,id,fields)))keepScrollPosition(()=>{fixedSelection=null;renderFixedValues();});
}
function render(){return keepScrollPosition(renderContents)}
function renderContents(){const asOf=today(),m=asOf.slice(0,7),x=monthly(state,m);
const opening=reconOpening(state),current=opening&&opening.date<=asOf?cashAt(state,asOf):null;
const calc={ready:current!==null,current,reason:'Configure um saldo de abertura com data igual ou anterior a hoje.'};$('monthCaption').textContent=monthTitle(m);renderDashboard(asOf,calc,m);
renderExpenseHistory();
renderFixedValues();$('baseList').innerHTML=rows(state.baseParcels,'base');$('baseSubtotal').textContent=x.known?money(x.base):'—';
$('forecast').innerHTML=Array.from({length:12},(_,i)=>{
 const month=shiftMonth(m,i),z=monthly(state,month),extras=round(state.extraIncome.filter(e=>e.date.slice(0,7)===month).reduce((a,e)=>a+e.amount,0)),net=round(z.available+extras);
 const label=monthTitle(month);
 return `<details class="plan-month" data-plan-month="${month}"><summary><span class="plan-month-name">${label}</span><span class="plan-month-total"><strong class="${net<0?'negative':''}">${z.known?money(net):'—'}</strong><small>${z.known?pct(net,z.income):'—'} da renda livre</small></span></summary><div class="plan-month-body">${breakdown(state,month)}</div></details>`;
 }).join('');
 if(openPlanMonths.size){for(const el of $('forecast').querySelectorAll('[data-plan-month]'))if(openPlanMonths.has(el.dataset.planMonth))el.open=true;}
 renderInvestmentPanels();
$('started').value=state.started;const editingMonth=$('effectiveMonth').value||m;$('effectiveMonth').value=editingMonth;fillProfileInputs();
$('exportLegacy').classList.toggle('hidden',!archived);
previewParcel();renderImportedBank();calendarLabels();showScreenNoScroll()}
let cardMonth=null;
function renderCardHub(){
 const select=$('cardMonth'),m=cardMonth??defaultCardMonth();
 cardMonth=m;
 const months=[...new Set([m,...reconMonths(state),shiftMonth(m,-1),shiftMonth(m,1)])].sort().reverse();
 const signature=months.join(',');
 if(select.dataset.months!==signature){
  select.innerHTML=months.map(month=>`<option value="${month}">${monthTitle(month)}</option>`).join('');
  select.dataset.months=signature;
 }
 if(select.value!==m)select.value=m;
 renderCommitmentTotals(state,m);
}
function renderCommitmentTotals(s,m){
 const {card,outside,total,open,cardPaid,cardOpen,outsidePaid,outsideOpen}=reconCommitmentTotals(s,m);
 const targets=id=>[$(id),$('home'+id[0].toUpperCase()+id.slice(1))].filter(Boolean);
 const monthLabel=$('homeCardMonth');if(monthLabel)monthLabel.textContent=shortMonthTitle(m);
 const amounts={cardCommitments:total,cardOwnTotal:card,cardPeopleTotal:outside,
  cardOwnPaid:cardPaid,cardOwnOpen:cardOpen,cardPeoplePaid:outsidePaid,cardPeopleOpen:outsideOpen};
 for(const [id,cents] of Object.entries(amounts))for(const el of targets(id)){
  const text=money(cents/100);if(el.textContent!==text)el.textContent=text;
 }
 for(const [id,base,remaining] of [['cardOwnOpen',card,cardOpen],['cardPeopleOpen',outside,outsideOpen]]){
  const text=base>0&&remaining===0?'Quitado':'Em Aberto';
  for(const el of targets(id)){const label=el.previousElementSibling;if(label&&label.textContent!==text)label.textContent=text;}
 }
 const text=total>0&&open===0?'Quitado':`Em aberto: ${money(open/100)}`;
 for(const status of targets('cardOpenStatus'))if(status.textContent!==text)status.textContent=text;
}
function showScreenNoScroll(){return keepScrollPosition(paintScreen)}
function paintScreen(){
 const auxiliary=screen==='settings'||screen==='info',card=isCardScreen();
 document.body.classList.toggle('settings-view',auxiliary);
 $('quickSettings').classList.toggle('hidden',screen==='info');
 $('quickInfo').classList.toggle('hidden',screen==='settings');
 $('card-hub').classList.toggle('hidden',!card);
 refreshHeaderButtons();
 for(const name of ['home','week','installments','investments','settings','info','recon']){
   $('screen-'+name).classList.toggle('hidden',name!==screen&&!(name==='recon'&&screen==='acertos'));
 }
 if(card)renderCardHub();
 if(screen==='recon'||screen==='acertos')window.ReconUI?.render({view:screen==='acertos'?'debt':'bill',month:cardMonth,state,today:today(),months:reconMonths(state),owner:reconOwner(state),rows:m=>reconRows(state,m),canAdjust:m=>reconCanAdjustMonth(state,m),adjustInstallment:(m,id,cents)=>update(s=>reconSetChargeAmount(s,m,id,cents)),excludeLine:(m,id)=>update(s=>reconExcludeInvoiceLine(s,m,id)),restoreCharge:(m,id)=>update(s=>reconRestoreChargeAmount(s,m,id)),creditTag:(m,id,value)=>update(s=>reconSetCreditTag(s,m,id,value)),editRefund:(m,id,fields)=>update(s=>editCardRefund(s,m,id,fields)),editBankCredit:(m,id,fields)=>update(s=>editBankCredit(s,m,id,fields)),keepPosition:keepScrollPosition,notify:notice,payable:m=>reconPayableRows(state,m),payables:()=>reconPayableRows(state),setPayable:(id,m,date)=>update(s=>reconSetPayable(s,id,m,date)),payablePayment:p=>update(s=>reconAddPayablePayment(s,p)),editPayable:(m,id,fields)=>update(s=>reconEditPayableOccurrence(s,m,id,fields)),undoPayablePayment:batch=>update(s=>reconUndoPayablePayment(s,batch)),recurringPayables:m=>reconRecurringPayables(state,m),openFixedSetting,settlements:m=>reconOpenDebtEntries(state,m),editSettlement:(key,fields)=>update(s=>reconEditOpenDebt(s,key,fields)),debt:m=>reconDebt(state,m),label:(m,id,l,p,scope,name,ownerName)=>update(s=>reconSetLabel(s,m,id,l,p,scope,name,ownerName)),receipt:p=>update(s=>reconAddReceipt(s,p)),deleteReceipt:id=>update(s=>reconDeleteReceipt(s,id)),paid:m=>reconPayment(state,m),cardDue:m=>reconCardDueCents(state,m),markPaid:(m,d)=>update(s=>reconMarkPaid(s,m,d))});
 else window.ReconUI?.reset();
 const area=card?'recon':screen;
 for(const button of document.querySelectorAll('.bottom-nav button, .subtabs button[data-screen]')){
   const active=button.dataset.area?button.dataset.area===area:button.dataset.screen===screen;
   button.classList.toggle('active',active);
   if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
 }
}
function syncParcelOrigin(){
 const personal=$('parcelOrigin').value==='person';
 $('parcelPayeeFields').classList.toggle('hidden',!personal);
 $('parcelOwnDate').classList.toggle('hidden',personal);
 $('parcelForm').querySelector('.two-cols').classList.toggle('parcel-single-column',personal);
 $('parcelStart').required=!personal;
 $('parcelPayStart').required=personal;
 $('parcelPayee').required=personal;
 $('parcelImpactLabel').textContent=personal?'Parcela mensal que você deve':'Parcela mensal adicionada à fatura';
 if(personal&&!$('parcelPayStart').value)$('parcelPayStart').value=eventDate($('parcelStart').value||defaultCardMonth(),5);
 calendarLabels();
}
function clearParcelOrigin(){
 $('parcelOrigin').value='own';$('parcelPayee').value='';$('parcelPayStart').value='';
 syncParcelOrigin();
}
function previewParcel(){const total=amount('parcelTotal'),count=Number($('parcelCount').value)||1,unit=Number.isFinite(total)&&total>0?Math.floor(Math.round(total*100)/count)/100:0;$('parcelPreview').textContent=money(unit);$('weeklyImpact').textContent=money(unit)}
function showMovementForm(mode){return keepScrollPosition(()=>paintMovementForm(mode))}
function paintMovementForm(mode){
 if(mode!==movementMode)editingMovement=null;
 movementMode=mode;
 for(const [type,title] of [['expense','Expense'],['extra','Income'],['statement','Statement']]){
  const on=type===mode,button=$('movement'+title+'Tab');
  $('movement'+title+'Panel').classList.toggle('hidden',!on);
  button.classList.toggle('active',on);
  button.setAttribute('aria-pressed',String(on));
 }
 renderExpenseHistory();
}
async function saveExpense(e){
 e.preventDefault();
 const name=$('expenseName').value.trim(),value=round(amount('expenseAmount')),date=$('expenseDate').value;
 if(!name||!(value>0)||!isDate(date))return notice('Informe data, descrição e valor positivo.','warning');
 if(await update(s=>s.expenses.push({id:newId(),name,amount:value,date}))){
  $('expenseName').value='';$('expenseAmount').value='';
 }
}
async function saveNew(e){
 e.preventDefault();
 const personal=$('parcelOrigin').value==='person',payTo=personal?$('parcelPayee').value.trim():null,payStart=personal?$('parcelPayStart').value:null;
 const name=$('parcelName').value.trim(),total=round(amount('parcelTotal')),count=Number($('parcelCount').value),start=personal?payStart.slice(0,7):$('parcelStart').value;
 if(personal&&(!payTo||payTo.length>100||!isDate(payStart)))return notice('Informe a pessoa e a data prevista do primeiro Pix.','warning');
 if(!name||!(total>0)||!isMonth(start)||!Number.isInteger(count)||count<1||count>120||Math.round(total*100)<count)return notice('Confira os campos da compra. Cada parcela deve ter ao menos um centavo.','warning');
 const id=editingNew||newId();
 if(await update(s=>{
  const old=editingNew?s.parcels.find(p=>p.id===editingNew):null;
  if(!personal&&(!old||old.start!==start||old.payTo)&&s.reconciliation?.statements?.some(x=>x.month===start&&x.closed===true))throw Error('Esta fatura já está fechada. Escolha um mês em aberto para a compra.');
  const touchesSchedule=old&&(old.total!==total||old.count!==count||old.start!==start||old.payTo!==(payTo??undefined)||old.payStart!==(payStart??undefined));
  if(personal&&old&&reconParcelLinked(s,id))throw Error('A compra está vinculada a uma cobrança do seu cartão. Não é possível movê-la para outra pessoa por aqui.');
  if(old?.payments?.length&&touchesSchedule)throw Error('Desfaça os pagamentos registrados antes de mudar os dados das parcelas.');
  const payment=old&&old.total===total&&old.count===count?old.payment:Math.floor(Math.round(total*100)/count)/100;
  if(old&&reconHasAllocated(s,old.id)&&touchesSchedule)throw Error('Há um Pix vinculado a esta compra. Desfaça o recebimento antes de mudar as parcelas.');
  const item={...old,id,name,total,payment,count,start,...(!old?{cardAdded:true,purchaseDate:today(),cardEnteredAt:Date.now()}:{})};
  if(personal){item.payTo=payTo;item.payStart=payStart;}
  else {delete item.payTo;delete item.payStart;delete item.payments;}
  if(old)s.parcels=s.parcels.map(p=>p.id===old.id?item:p);
  else s.parcels.push(item);
 })){
  editingNew=null;$('parcelName').value='';$('parcelTotal').value='';$('parcelSubmit').textContent='Adicionar Compra';$('parcelCancel').classList.add('hidden');
  clearParcelOrigin();
  $('parcelOpenBill').dataset.month=start;$('parcelOpenBill').dataset.target=personal?'acertos':'recon';$('parcelOpenBill').textContent=personal?'Ver em A pagar':'Ver na fatura de '+monthTitle(start);$('parcelOpenBill').classList.remove('hidden');
 }
}
function fillProfileInputs(){
 if(!state)return;
 const p=profile(state,$('effectiveMonth').value||monthNow()),[first,last]=salaryCents(p);
 $('salaryDay15').value=(first/100).toFixed(2);$('salaryDay30').value=(last/100).toFixed(2);
 $('investment').value=p.investments;$('margin').value=p.margin;
}
function salaryInputCents(id){return salaryInputCentsValue($(id).value);}
function salaryInputCentsValue(rawValue){
 const raw=String(rawValue).trim().replace(',','.');
 if(!/^\d+(?:\.\d{1,2})?$/.test(raw))return NaN;
 const [whole,decimal='']=raw.split('.');
 const value=Number(whole)*100+Number(decimal.padEnd(2,'0'));
 return Number.isSafeInteger(value)?value:NaN;
}
async function saveBaseline(e){
 e.preventDefault();
 const first=salaryInputCents('salaryDay15'),last=salaryInputCents('salaryDay30'),investment=amount('investment'),margin=amount('margin'),date=$('started').value,from=$('effectiveMonth').value;
 if(!Number.isSafeInteger(first+last)||![investment,margin].every(v=>Number.isFinite(v)&&v>=0)||!isDate(date)||!isMonth(from))return notice('Confira os valores e as datas.','warning');
 await update(s=>{
   const p={from,income:(first+last)/100,investments:round(investment),margin:round(margin),salaryDay15Cents:first,salaryDay30Cents:last};
   s.profiles=s.profiles.filter(x=>x.from!==from);s.profiles.push(p);s.profiles.sort((a,b)=>a.from.localeCompare(b.from));s.started=monday(new Date(date+'T12:00:00'));
 });
}
async function saveBase(e){e.preventDefault();const name=$('baseName').value.trim(),payment=amount('basePayment'),remaining=Number($('baseRemaining').value),start=$('baseStart').value;if(!name||!(payment>0)||!Number.isInteger(remaining)||remaining<1||remaining>240||!isMonth(start))return notice('Confira a parcela antiga.','warning');if(await update(s=>{const item={id:editingBase||newId(),name,payment:round(payment),remaining,start};if(editingBase)s.baseParcels=s.baseParcels.map(p=>p.id===editingBase?item:p);else s.baseParcels.push(item)})){editingBase=null;$('baseForm').reset();$('baseStart').value=monthNow();$('baseSubmit').textContent='Adicionar parcela antiga';$('baseCancel').classList.add('hidden');calendarLabels()}}
async function saveExtraInvestment(e){e.preventDefault();const date=$('extraDate').value,name=$('extraName').value.trim()||'Aporte extra',v=amount('extraAmount');if(!isDate(date)||!Number.isFinite(v)||v<=0)return notice('Informe data e valor positivo.','warning');if(await update(s=>s.extraInvestments.push({id:newId(),date,name,amount:round(v)}))){$('extraAmount').value='';$('extraName').value=''}}


async function saveInvestmentConfirmation(e){
 e.preventDefault();
 return saveMonthlyContribution($('investmentDone').checked?'done':'pending');
}
async function saveMonthlyContribution(status){
 const m=$('investmentFocusMonth').value;
 if(!isMonth(m))return notice('Escolha um mês válido.','warning');
 const date=$('investmentConfirmDate').value,principal=amount('investmentConfirmAmount');
 if(status==='done'&&(!isDate(date)||date.slice(0,7)!==m||!Number.isFinite(principal)||principal<=0))return notice('Informe a data e o valor do primeiro aporte do mês.','warning');
 if(status!=='done'&&settled(state,m)&&!confirm('Remover o primeiro aporte registrado deste mês?'))return;
 if(await update(s=>{
   s.monthlyPaid=s.monthlyPaid.filter(x=>x.month!==m);
   s.investmentSkipped=(s.investmentSkipped||[]).filter(x=>x!==m);
   if(status==='done')s.monthlyPaid.push({month:m,date,amount:round(principal)});
   if(status==='skipped')s.investmentSkipped.push(m);
 })){updateInvestmentForm();}
}

function renderImportedBank(){
 const r=state.reconciliation,b=r?.baseline, byBank=$('reconOpeningAccounts'), rows=r?.bankRows??[];
 $('reconOpeningNote').classList.toggle('hidden',!b);byBank.classList.toggle('hidden',!b);
 $('originalOpeningAmount').classList.toggle('hidden',!!b);$('openingAmount').disabled=!!b;
 if(b){
  $('openingDate').value=b.date;
  $('reconOpeningNote').textContent='O saldo é o fechamento do dia. Os lançamentos daquele dia não são somados novamente.';
  byBank.innerHTML=b.accounts.map((a,i)=>`<label for="reconAccount${i}">${esc(a.name)} (R$)</label><input id="reconAccount${i}" type="number" step="0.01" inputmode="decimal" required value="${(a.cents/100).toFixed(2)}">`).join('');
 }else byBank.replaceChildren();
 $('importedBank').classList.toggle('hidden',!rows.length);
 $('bankRows').innerHTML=rows.map(x=>`<div class="entry"><div class="entry-main"><div class="entry-title">${esc(x.name)}</div><div class="entry-description">${esc(readableDate(x.date))} · ${esc(x.time)}</div></div><div class="entry-right"><div><strong>${money(x.cents/100)}</strong><div class="entry-description">Saldo ${money(x.balanceCents/100)}</div></div></div></div>`).join('');
}
async function saveOpening(e){
 e.preventDefault();const date=$('openingDate').value,b=state.reconciliation?.baseline;
 if(!isDate(date)||date>today())return notice('Informe uma data de referência até hoje.','warning');
 if(b){
   const cents=b.accounts.map((a,i)=>Math.round(100*amount('reconAccount'+i)));
   if(cents.some(n=>!Number.isSafeInteger(n)))return notice('Confira os saldos por conta.','warning');
   if(!confirm('Usar o fechamento desse dia como novo saldo de partida? Os movimentos até essa data passam a estar refletidos no saldo.'))return;
   return update(s=>{s.reconciliation.baseline={date,accounts:b.accounts.map((a,i)=>({...a,cents:cents[i]}))}});
 }
 const v=amount('openingAmount');
 if(!Number.isFinite(v)||v<0)return notice('Informe um saldo de abertura válido.','warning');
 if(state.opening&&!confirm('Alterar o saldo de abertura recalculará o caixa. Deseja continuar?'))return;
 await update(s=>{s.opening={date,amount:round(v)}});
}
async function saveExtraIncome(e){e.preventDefault();const date=$('incomeExtraDate').value,name=$('incomeExtraName').value.trim()||'Entrada extra',v=round(amount('incomeExtraAmount'));if(!isDate(date)||!Number.isFinite(v)||v<=0)return notice('Confira a data e o valor da entrada extra.','warning');if(await update(s=>s.extraIncome.push({id:newId(),date,name,amount:v}))){$('incomeExtraName').value='';$('incomeExtraAmount').value=''}}

function resetForms(){editingBase=editingNew=null;fixedSelection=null;clearParcelOrigin();for(const [a,b] of [['baseSubmit','Adicionar parcela antiga'],['parcelSubmit','Adicionar Compra']])$(a).textContent=b;for(const id of ['baseCancel','parcelCancel'])$(id).classList.add('hidden')}
function editItem(kind,id){const items=kind==='base'?state.baseParcels:state.parcels;const v=items.find(e=>e.id===id);if(!v)return;if(kind==='base'){editingBase=id;$('baseName').value=v.name;$('basePayment').value=v.payment;$('baseRemaining').value=v.remaining;$('baseStart').value=v.start;$('baseSubmit').textContent='Salvar parcela antiga';$('baseCancel').classList.remove('hidden');showScreen('settings');$('baseForm').closest('details')?.setAttribute('open','')}if(kind==='new'){editingNew=id;$('parcelOrigin').value=v.payTo?'person':'own';$('parcelPayee').value=v.payTo??'';$('parcelPayStart').value=v.payStart??'';$('parcelName').value=v.name;$('parcelTotal').value=v.total;$('parcelCount').value=String(v.count);if(!$('parcelCount').value){$('parcelCount').insertAdjacentHTML('beforeend',`<option value="${v.count}">${v.count}x</option>`);$('parcelCount').value=String(v.count)}$('parcelStart').value=v.start;syncParcelOrigin();$('parcelSubmit').textContent='Salvar compra';$('parcelCancel').classList.remove('hidden');showCardEntry('purchase');showScreen('installments')}calendarLabels()}
function downloadFile(contents,name){const blob=new Blob([contents],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function exportBackup(){downloadFile(JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),`financas-${today()}.json`);notice('Backup preparado. Confirme se ele foi salvo no aplicativo Arquivos.','warning')}
async function restoreBackup(e){const file=e.target.files?.[0];if(!file)return;try{const raw=JSON.parse(await file.text());const normalized=raw.version===8?raw:raw.version===7?raw:raw.version===6?raw:raw.version===5?raw:raw.version===4?raw:raw.version===3?migrateV3(raw):isOldV2(raw)?migrateOld(raw):migratePilot(raw);const incoming=toV8(normalized);if(!valid(incoming))throw Error('Formato incompatível');if(!confirm('Substituir todos os registros deste aparelho pelo backup?'))return;await write('state-before-last-import',state);await write(RECORD,incoming);state=incoming;resetForms();updateInvestmentForm();render();notice('Backup restaurado.')}catch(err){notice('Falha na importação: '+err.message,'error')}finally{e.target.value=''}}
async function init(){try{
 db=await openDb();let v=await read(RECORD);archived=!!(await read(ARCHIVE));
 if(v){
   if(v.version===8){if(!valid(v))throw Error('Dados existentes precisam de recuperação. Não apague o aplicativo.');state=toV8(v)}
   else {
     const older=v.version===7||v.version===6||v.version===5||v.version===4?v:v.version===3?migrateV3(v):isOldV2(v)?migrateOld(v):null;
     if(!older)throw Error('Formato anterior não reconhecido.');
     const next=toV8(older);if(!valid(next))throw Error('Dados anteriores incompatíveis.');
     await write('state-before-v3.7',v);if(isOldV2(v)){await write(ARCHIVE,v);archived=true}
     await write(RECORD,next);state=next;
   }
 }else{
   let legacy=null;try{const x=localStorage.getItem(OLD_KEY);if(x)legacy=JSON.parse(x)}catch{}
   if(legacy){state=toV8(migratePilot(legacy));if(!valid(state))throw Error('Dados anteriores incompatíveis.');await write(ARCHIVE,legacy);archived=true}
   else state=empty();await write(RECORD,state);
 }
 $('app').hidden=false;$('expenseDate').value=today();
 for(const id of ['parcelStart','baseStart','effectiveMonth'])$(id).value=monthNow();$('extraDate').value=today();$('incomeExtraDate').value=today();$('openingDate').value=today();$('investmentConfirmDate').value=today();$('investmentFocusMonth').value=monthNow();
 try{setTheme(localStorage.getItem(THEME_KEY)||'ocean')}catch{setTheme('ocean')}
 $('parcelStart').value=defaultCardMonth();$('cardImportMonth').value=defaultCardMonth();$('cardRefundMonth').value=defaultCardMonth();$('cardRefundDate').value=today();$('cardRefundDate').max=today();showMovementForm('expense');updateInvestmentForm();render();$('loading').hidden=true;document.dispatchEvent(new Event('diario-ready'));navigator.storage?.persist?.().catch(()=>{});
 }catch(e){$('app').hidden=true;const m=$('bootMessage');if(m){m.textContent='Não foi possível abrir o diário. '+e.message;$('bootRetry').hidden=false;}else notice('Não foi possível carregar seus dados: '+e.message,'error');document.dispatchEvent(new Event('diario-ready'));}
}
// As seções de Ajustes já são recolhíveis no HTML, com títulos próprios.
document.querySelectorAll('.calendar-field input').forEach(el=>{el.addEventListener('input',calendarLabels);el.addEventListener('change',calendarLabels)});
$('fixedValues').addEventListener('click',fixedClick);
$('fixedValues').addEventListener('change',fixedChange);
$('fixedValues').addEventListener('input',fixedChange);
$('fixedValues').addEventListener('submit',fixedSubmit);
$('budgetPeople').addEventListener('click',toggleBudgetPerson);
window.addEventListener('scroll',releaseCardScrollTail,{passive:true});
for(const event of ['pointerdown','touchmove','wheel','keydown'])window.addEventListener(event,()=>{scrollGuardRevision++;},{capture:true,passive:true});
document.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',()=>{
 showScreen(b.dataset.screen);
 if(b.id==='homeInvestments'){
   showInvestmentPanel(false);
 }
}));
$('quickSettings').addEventListener('click',()=>showScreen(screen==='settings'?'home':'settings'));
$('quickInfo').addEventListener('click',()=>showScreen(screen==='info'?'home':'info'));
$('parcelOpenBill').addEventListener('click',()=>{const b=$('parcelOpenBill'),m=b.dataset.month;if(isMonth(m)){cardMonth=m;if(b.dataset.target==='acertos')window.ReconUI?.selectMoney?.('payable');showScreen(b.dataset.target==='acertos'?'acertos':'recon');}});
function setCardMonth(m){
 if(!isMonth(m))return;
 cardMonth=m;
 if(!editingNew&&!$('parcelTotal').value){$('parcelStart').value=m;if($('parcelOrigin').value==='person'&&!$('parcelPayStart').value)$('parcelPayStart').value=eventDate(m,5);calendarLabels();}
 showScreenNoScroll();
}
$('cardMonth').addEventListener('change',e=>setCardMonth(e.target.value));
$('cardMonthPrev').addEventListener('click',()=>setCardMonth(shiftMonth(cardMonth??defaultCardMonth(),-1)));
$('cardMonthNext').addEventListener('click',()=>setCardMonth(shiftMonth(cardMonth??defaultCardMonth(),1)));
$('cardImportForm').addEventListener('submit',importClosedCard);
$('cardPurchaseTab').addEventListener('click',()=>showCardEntry('purchase'));
$('cardRefundTab').addEventListener('click',()=>showCardEntry('refund'));
$('cardRefundForm').addEventListener('submit',saveCardRefund);
for(const [id,fn] of [['expenseForm',saveExpense],['parcelForm',saveNew],['baselineForm',saveBaseline],['baseForm',saveBase],['extraForm',saveExtraInvestment],['openingForm',saveOpening],['incomeExtraForm',saveExtraIncome],['investmentConfirmForm',saveInvestmentConfirmation]])$(id).addEventListener('submit',fn);
$('movementExpenseTab').addEventListener('click',()=>showMovementForm('expense'));
$('movementIncomeTab').addEventListener('click',()=>showMovementForm('extra'));
$('movementStatementTab').addEventListener('click',()=>showMovementForm('statement'));
$('movementMonth').addEventListener('change',e=>setMovementMonth(e.target.value));
$('movementMonthPrev').addEventListener('click',()=>setMovementMonth(shiftMonth(movementMonth,-1)));
$('movementMonthNext').addEventListener('click',()=>setMovementMonth(shiftMonth(movementMonth,1)));
$('expenses').addEventListener('click',async e=>{
 const hit=e.target.closest('[data-movement-edit]');
 if(hit)return keepScrollPosition(()=>{editingMovement=editingMovement===hit.dataset.movementEdit?null:hit.dataset.movementEdit;renderExpenseHistory();});
 if(e.target.closest('[data-movement-cancel]'))return closeMovementEditor();
 const remove=e.target.closest('[data-movement-delete]');
 const key=remove?.form?.dataset.movementEditor;
 if(key&&key===editingMovement){
  if(confirm('Excluir este lançamento do Extrato?')&&await update(s=>changeMovement(s,key,null))&&editingMovement===key){
    closeMovementEditor();notice('Lançamento excluído.');
  }
  return;
 }
 const summary=e.target.closest('summary'),detail=summary?.parentElement;
 if(detail?.dataset.expenseDay){
  e.preventDefault();
  keepScrollPosition(()=>{
   detail.open=!detail.open;
   if(detail.open)openExpenseDays.add(detail.dataset.expenseDay);
   else openExpenseDays.delete(detail.dataset.expenseDay);
  });
 }
});
$('expenses').addEventListener('submit',async e=>{
 const f=e.target,key=f.dataset.movementEditor;
 if(!key)return;
 e.preventDefault();
 if(key!==editingMovement)return;
 const cents=salaryInputCentsValue(f.elements.amount.value);
 if(!Number.isSafeInteger(cents)||cents<=0||cents>1e12){notice('Informe um valor positivo com até duas casas decimais.','warning');return;}
 const name=f.elements.description.value.trim();
 if(!name||name.length>120){notice('Informe uma descrição com até 120 caracteres.','warning');return;}
 if(await update(s=>changeMovement(s,key,cents,name))){
  if(editingMovement===key)closeMovementEditor();
  notice('Lançamento atualizado.');
 }
});
$('parcelOrigin').addEventListener('change',()=>keepScrollPosition(()=>{syncParcelOrigin();previewParcel()}));
$('parcelTotal').addEventListener('input',previewParcel);$('parcelCount').addEventListener('change',previewParcel);
$('effectiveMonth').addEventListener('change',fillProfileInputs);


$('exportBackup').addEventListener('click',exportBackup);$('restoreFile').addEventListener('change',restoreBackup);$('exportLegacy').addEventListener('click',async()=>{const old=await read(ARCHIVE);if(old)downloadFile(JSON.stringify(old,null,2),`financas-arquivo-anterior-${today()}.json`)});
$('exportPrevious').addEventListener('click',async()=>{const old=await read('state-before-last-import')||await read('state-before-v3.7')||await read(BEFORE35)||await read(BEFORE34)||await read(BEFORE33)||await read(PREVIOUS);if(old)downloadFile(JSON.stringify(old,null,2),`financas-versao-anterior-${today()}.json`);else notice('Arquivo da versão anterior indisponível.','warning')});
for(const id of ['baseCancel','parcelCancel'])$(id).addEventListener('click',()=>{resetForms();render()});
$('investmentFocusMonth').addEventListener('change',e=>setInvestmentMonth(e.target.value));
$('investmentMonthPrev').addEventListener('click',()=>setInvestmentMonth(shiftMonth($('investmentFocusMonth').value||monthNow(),-1)));
$('investmentMonthNext').addEventListener('click',()=>setInvestmentMonth(shiftMonth($('investmentFocusMonth').value||monthNow(),1)));
$('investmentContributionsTab').addEventListener('click',()=>keepScrollPosition(()=>showInvestmentPanel(false)));
$('investmentHistoryTab').addEventListener('click',()=>keepScrollPosition(()=>showInvestmentPanel(true)));
$('investmentDone').addEventListener('change',showInvestmentFields);
$('skipFirstContribution').addEventListener('click',()=>{
 const month=$('investmentFocusMonth').value;
 if(isMonth(month))saveMonthlyContribution(skipped(state,month)?'pending':'skipped');
});
$('themeToggle').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='pink'?'ocean':'pink'));
for(const button of document.querySelectorAll('[data-theme-choice]'))button.addEventListener('click',()=>setTheme(button.dataset.themeChoice));
function rememberAccordion(container,key,opened){
 $(container).addEventListener('toggle',e=>{
   const el=e.target;
   if(!(el instanceof HTMLDetailsElement)||!el.dataset[key])return;
   if(el.open)opened.add(el.dataset[key]);else opened.delete(el.dataset[key]);
 },true);
}
rememberAccordion('expenses','expenseDay',openExpenseDays);
$('investmentHistory').addEventListener('toggle',e=>{
 const fold=e.target,month=fold.dataset?.historyMonth;
 if(!month||fold!==$('investmentHistory').firstElementChild)return;
 if(fold.open)closedInvestmentMonths.delete(month);else closedInvestmentMonths.add(month);
},true);
$('forecast').addEventListener('toggle',e=>{const el=e.target;if(el instanceof HTMLDetailsElement&&el.dataset.planMonth){if(el.open)openPlanMonths.add(el.dataset.planMonth);else openPlanMonths.delete(el.dataset.planMonth)}},true);
document.addEventListener('click',e=>{const target=e.target;if(!(target instanceof Element))return;for(const kind of ['base','new']){const edit=target.closest(`[data-edit-${kind}]`),del=target.closest(`[data-delete-${kind}]`);if(edit){editItem(kind,edit.getAttribute(`data-edit-${kind}`));return}if(del){if(!confirm('Excluir este item do planejamento?'))return;const id=del.getAttribute(`data-delete-${kind}`),field=kind==='base'?'baseParcels':'parcels';update(s=>{if(reconHasAllocated(s,id))throw Error('Há um Pix vinculado a este item. Desfaça o recebimento antes de excluir.');if(kind==='new'&&s.parcels.find(p=>p.id===id)?.payments?.length)throw Error('Desfaça os pagamentos registrados antes de excluir a compra.');s[field]=s[field].filter(x=>x.id!==id);});return}}const paid=target.closest('[data-delete-paid]');if(paid){if(confirm('Remover a data antecipada? O aporte mensal voltará a ser estimado no dia 30.'))update(s=>s.monthlyPaid=s.monthlyPaid.filter(x=>x.month!==paid.dataset.deletePaid));return}const exInv=target.closest('[data-delete-extra]');if(exInv){if(confirm('Excluir este aporte extra?'))update(s=>s.extraInvestments=s.extraInvestments.filter(x=>x.id!==exInv.dataset.deleteExtra));return}const editInv=target.closest('[data-edit-investment]');if(editInv){showScreen('investments');showInvestmentPanel(false);setInvestmentMonth(editInv.dataset.editInvestment);return}});
init();
