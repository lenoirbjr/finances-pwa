'use strict';
/* Finanças 3.8: orçamento baseado no saldo existente e nos compromissos por data. */
const DB='finances-pwa-local', STORE='app', RECORD='state', ARCHIVE='legacy-two-wallets-v2', PREVIOUS='state-before-v3.2', BEFORE33='state-before-v3.3', BEFORE34='state-before-v3.4', BEFORE35='state-before-v3.5', OLD_KEY='financas-pwa-piloto-v1';
const $=id=>document.getElementById(id), round=n=>Math.round((n+Number.EPSILON)*100)/100;
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
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
const empty=()=>({version:8,fixedPaid:[],monthlyPaid:[],opening:null,extraIncome:[],cashEntries:[],mode:'items',income:0,legacyFixed:0,legacyInvoices:{},fixedItems:[],baseParcels:[],investments:0,investmentOverrides:{},investmentLowerLegacy:{},extraInvestments:[],profiles:[{from:'2000-01',income:0,investments:0,margin:0}],expenses:[],parcels:[],started:monday(new Date())});
function validLegacyShape(s){return !!(s&&s.version===5&&s.mode==='items'&&Number.isFinite(s.income)&&s.income>=0&&Number.isFinite(s.legacyFixed)&&s.legacyFixed>=0&&isDate(s.started)&&Number.isFinite(s.investments)&&s.investments>=0&&s.legacyInvoices&&typeof s.legacyInvoices==='object'&&!Array.isArray(s.legacyInvoices)&&Object.entries(s.legacyInvoices).every(([m,v])=>isMonth(m)&&Number.isFinite(v)&&v>=0)&&s.investmentOverrides&&Object.entries(s.investmentOverrides).every(([m,v])=>isMonth(m)&&Number.isFinite(v)&&v>=0)&&Array.isArray(s.fixedItems)&&s.fixedItems.every(e=>typeof e.id==='string'&&typeof e.name==='string'&&e.name.length<=120&&Number.isFinite(e.amount)&&e.amount>=0&&isMonth(e.start)&&(!e.end||isMonth(e.end)))&&Array.isArray(s.baseParcels)&&s.baseParcels.every(e=>typeof e.id==='string'&&typeof e.name==='string'&&e.name.length<=120&&Number.isFinite(e.payment)&&e.payment>0&&isMonth(e.start)&&Number.isInteger(e.remaining)&&e.remaining>0&&e.remaining<=240)&&Array.isArray(s.expenses)&&s.expenses.every(e=>typeof e.id==='string'&&typeof e.name==='string'&&e.name.length<=120&&Number.isFinite(e.amount)&&e.amount>0&&isDate(e.date))&&Array.isArray(s.parcels)&&s.parcels.every(e=>typeof e.id==='string'&&typeof e.name==='string'&&e.name.length<=120&&isMonth(e.start)&&Number.isInteger(e.count)&&e.count>0&&e.count<=120&&Number.isFinite(e.total)&&e.total>0&&Number.isFinite(e.payment)&&e.payment>=0));}

function valid(s){
 if(!s||s.version!==8||!Array.isArray(s.profiles)||!s.profiles.length||!Array.isArray(s.extraInvestments)||!Array.isArray(s.monthlyPaid))return false;
 const base={...s,version:5};if(!validLegacyShape(base))return false;
 if(!s.profiles.every(p=>isMonth(p.from)&&[p.income,p.investments,p.margin].every(v=>Number.isFinite(v)&&v>=0)))return false;
 if(new Set(s.profiles.map(p=>p.from)).size!==s.profiles.length)return false;
 if(s.opening!==null&&(!s.opening||!isDate(s.opening.date)||!Number.isFinite(s.opening.amount)||s.opening.amount<0))return false;
 if(!Array.isArray(s.extraIncome)||!s.extraIncome.every(e=>typeof e.id==='string'&&typeof e.name==='string'&&e.name.length<=120&&isDate(e.date)&&Number.isFinite(e.amount)&&e.amount>0))return false;
 if(!Array.isArray(s.cashEntries)||!s.cashEntries.every(e=>typeof e.id==='string'&&['salary','invoice','fixed','investment','adjustment-in','adjustment-out'].includes(e.type)&&isDate(e.date)&&isMonth(e.month)&&Number.isFinite(e.amount)&&e.amount>0))return false;
 if(s.fixedPaid!==undefined&&(!Array.isArray(s.fixedPaid)||!s.fixedPaid.every(e=>typeof e.id==='string'&&isMonth(e.month)&&isDate(e.date)&&Number.isFinite(e.amount)&&e.amount>=0)))return false;
 if(!s.fixedItems.every(e=>e.day===undefined||(Number.isInteger(e.day)&&e.day>=1&&e.day<=31)))return false;
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
 if(v.version===8)return v;
 const x=toV7(v);x.version=8;x.monthlyPaid=[];x.fixedPaid=[];return x;
}
function settled(s,m){return (s.monthlyPaid||[]).find(x=>x.month===m)||null;}
// Projeção local a partir de um saldo de abertura. Não significa conciliação bancária.
// Fevereiro usa o último dia do mês como equivalente ao pagamento do dia 30.
function eventDate(m,day){const [y,mo]=m.split('-').map(Number),last=new Date(y,mo,0).getDate();return `${m}-${pad(Math.min(day,last))}`}
function fixedDate(s,item,m){return eventDate(m,item.day||5)}
function confirmedFixed(s,id,m){return (s.fixedPaid||[]).find(x=>x.id===id&&x.month===m)||null}
function cashAt(s,end){
 if(!s.opening)return null;
 const start=s.opening.date;
 if(end<start)return round(s.opening.amount);
 let projected=s.opening.amount;
 for(let m=start.slice(0,7);m<=end.slice(0,7);m=shiftMonth(m,1)){
   const p=profile(s,m),salaryDay=eventDate(m,30),invoiceDay=eventDate(m,5),paid=settled(s,m);
   if(salaryDay>start&&salaryDay<=end)projected+=p.income;
   if(paid&&paid.date>=start&&paid.date<=end)projected-=paid.amount;
   if(invoiceDay>start&&invoiceDay<=end)projected-=baseAmount(s,m)+newAmount(s,m);
 }
 for(const e of s.fixedPaid||[]){if(e.date>=start&&e.date<=end)projected-=e.amount}
 projected+=s.extraIncome.filter(e=>e.date>=start&&e.date<=end).reduce((v,e)=>v+e.amount,0);
 projected-=s.expenses.filter(e=>e.date>=start&&e.date<=end).reduce((v,e)=>v+e.amount,0);
 projected-=s.extraInvestments.filter(e=>e.date>=start&&e.date<=end).reduce((v,e)=>v+e.amount,0);
 return round(projected);
}
// Previsão separada: futuros pagamentos são assumidos, mas nunca debitados do caixa atual
// antes de serem marcados como realizados. Pendências vencidas continuam protegidas.
function cashForecast(s,end,asOf=today()){
 let projected=cashAt(s,end);
 if(projected===null)return null;
 const start=s.opening.date;
 for(let m=start.slice(0,7);m<=end.slice(0,7);m=shiftMonth(m,1)){
   const payDay=eventDate(m,30);
   if(!settled(s,m)&&payDay>asOf&&payDay<=end&&payDay>start)projected-=investmentAmount(s,m);
   for(const item of activeFixed(s,m)){
     const due=fixedDate(s,item,m);
     if(!confirmedFixed(s,item.id,m)&&due>asOf&&due<=end&&due>=start)projected-=item.amount;
   }
 }
 return round(projected);
}
function overdueReserved(s,asOf=today()){
 if(!s.opening)return 0;
 let total=0;
 const start=s.opening.date;
 for(let m=start.slice(0,7);m<=asOf.slice(0,7);m=shiftMonth(m,1)){
   for(const item of activeFixed(s,m)){
     const due=fixedDate(s,item,m);
     if(due>=start&&due<=asOf&&!confirmedFixed(s,item.id,m))total+=item.amount;
   }
   const day=eventDate(m,30);
   if(day>start&&day<=asOf&&!settled(s,m))total+=investmentAmount(s,m);
 }
 return round(total);
}
function cashToday(s){return cashAt(s,today())}
// Os limites nunca contam salário futuro como dinheiro disponível hoje.
// Eventos futuros só ajudam a verificar se pagamentos posteriores caberão.
function addDays(date,n){const [y,m,d]=date.split('-').map(Number);return dateKey(new Date(y,m-1,d+n,12))}
function daysBetween(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000)}
function nextPayday(date){const m=date.slice(0,7),pay=eventDate(m,30);return pay>date?pay:eventDate(shiftMonth(m,1),30)}
function nextSunday(date){const d=new Date(date+'T12:00:00');return addDays(date,(7-d.getDay())%7)}
// Avalia os compromissos até o terceiro próximo crédito mensal.
// A margem é um piso de caixa, e não uma saída bancária nem um valor somado todos os meses.
function cycleBudget(s,asOf=today()){
 const next=nextPayday(asOf), days=Math.max(1,daysBetween(asOf,next));
 const current=s.opening&&s.opening.date<=asOf?cashAt(s,asOf):null;
 if(current===null)return {ready:false,reason:'Configure um saldo de abertura com data igual ou anterior a hoje.'};
 const horizon=nextPayday(nextPayday(next));
 const checkpoints=new Set([asOf,next,horizon]);
 for(let month=asOf.slice(0,7);month<=horizon.slice(0,7);month=shiftMonth(month,1)){
   for(const day of [5,30]){const t=eventDate(month,day);if(t>asOf&&t<=horizon)checkpoints.add(t)}
   for(const item of activeFixed(s,month)){const due=fixedDate(s,item,month);if(due>asOf&&due<=horizon)checkpoints.add(due)}
 }
 for(const group of [s.monthlyPaid||[],s.extraIncome||[],s.extraInvestments||[],s.expenses||[]]){
   for(const item of group){if(item.date>asOf&&item.date<=horizon)checkpoints.add(item.date)}
 }
 const reserve=overdueReserved(s,asOf);
 let minimum=current-profile(s,asOf.slice(0,7)).margin-reserve;
 let lowestDate=asOf;
 for(const d of [...checkpoints].sort()){
   if(d<asOf)continue;
   const value=cashForecast(s,d,asOf)-profile(s,d.slice(0,7)).margin-reserve;
   if(value<minimum){minimum=value;lowestDate=d}
 }
 const available=round(Math.max(0,Math.min(current,minimum)));
 const daily=round(available/days);
 const sunday=nextSunday(asOf);
 const remaining=Math.min(days,daysBetween(asOf,sunday)+1);
 const week=round(Math.min(available,available/days*remaining));
 return {ready:true,current,next,days,sunday,remaining,available,daily,week,minimum:round(minimum),lowestDate,horizon,margin:profile(s,asOf.slice(0,7)).margin};
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
let db,state,paidViewMonth=monthNow(),screen='week',writing=false,archived=false,editingFixed=null,editingBase=null,editingNew=null,viewMonth=monthNow();
function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('Feche as outras abas com o aplicativo aberto.'))})}
function read(key){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),q=tx.objectStore(STORE).get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}
function write(key,val){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(val,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error('Falha ao gravar'));tx.onabort=()=>reject(tx.error||Error('Gravação cancelada'))})}
function notice(msg,kind='ok'){$('notice').textContent=msg;$('notice').className='notice'+(kind==='ok'?'':' '+kind);window.scrollTo({top:0,behavior:'instant'})}
async function update(fn){if(writing)return false;writing=true;try{const next=structuredClone(state);fn(next);if(!valid(next))throw Error('Dados inválidos. Confira os campos.');await write(RECORD,next);state=next;render();$('notice').className='notice hidden';return true}catch(e){notice('Não foi possível salvar: '+e.message,'error');return false}finally{writing=false}}
function activeFixed(s,m){return s.fixedItems.filter(e=>e.start<=m&&(!e.end||e.end>=m))}
function fixedAmount(s,m){return s.mode==='legacy'?s.legacyFixed:round(activeFixed(s,m).reduce((a,e)=>a+e.amount,0))}
function oldParts(s,m){return s.baseParcels.filter(e=>{const d=monthDiff(e.start,m);return d>=0&&d<e.remaining})}
function baseAmount(s,m){return s.mode==='legacy'?(s.legacyInvoices[m]??0):round(oldParts(s,m).reduce((a,e)=>a+e.payment,0))}
const newBaseAmount=baseAmount;
function newPartAmount(e,m){const off=monthDiff(e.start,m);if(off<0||off>=e.count)return 0;const cents=Math.round(e.total*100),unit=Math.round(e.payment*100);return (off===e.count-1?cents-unit*(e.count-1):unit)/100}
function newAmount(s,m){return round(s.parcels.reduce((a,e)=>a+newPartAmount(e,m),0))}
function investmentAmount(s,m){return Object.prototype.hasOwnProperty.call(s.investmentLowerLegacy||{},m)?s.investmentLowerLegacy[m]:round(profile(s,m).investments+plannedLegacyExtra(s,m))}
function monthly(s,m){const p=profile(s,m),known=s.mode==='items'||Object.prototype.hasOwnProperty.call(s.legacyInvoices,m),fixed=fixedAmount(s,m),base=newBaseAmount(s,m),extra=newAmount(s,m),investment=investmentAmount(s,m),invested=extraInvested(s,m);return {known,income:p.income,fixed,base,extra,investment,margin:p.margin,invested,available:round(p.income-fixed-base-extra-investment-p.margin-invested),quotaBase:round(p.income-fixed-base-extra-investment-p.margin)}}
function weeklyBudget(s,m){const x=monthly(s,m);return x.known?round(x.quotaBase*12/52):null}
function weekly(s){const start=s.started,cur=monday(new Date()),n=weekDiff(start,cur);if(n<0)return {known:false,balance:0,detail:'O controle ainda não começou.'};if(n>520)return {known:false,balance:0,detail:'Revise a data inicial do controle.'};let total=0,missing=0;for(let i=0;i<=n;i++){const b=weeklyBudget(s,weekShift(start,i).slice(0,7));if(b===null)missing++;else total+=b}const opened=s.opening&&s.opening.date>start?s.opening.date:start;const spent=s.expenses.filter(e=>e.date>=opened&&e.date<=today()).reduce((a,e)=>a+e.amount,0);const extras=s.extraIncome.filter(e=>e.date>=opened&&e.date<=today()).reduce((a,e)=>a+e.amount,0);const invested=s.extraInvestments.filter(e=>e.date>=opened&&e.date<=today()).reduce((a,e)=>a+e.amount,0);return missing?{known:false,balance:0,detail:`Faltam faturas-base em ${missing} semana(s) do período.`}:{known:true,balance:round(total-spent-invested+extras),detail:`Acumulado desde ${start.split('-').reverse().join('/')} · após gastos, aportes extras e entradas adicionais`}}
function calendarLabels(){for(const el of document.querySelectorAll('.calendar-field input')){const lab=document.querySelector(`[data-for="${el.id}"]`);if(!lab)continue;if(!el.value){lab.textContent=el.type==='month'?'Selecionar mês':'Selecionar data';continue}if(el.type==='month'){const [y,m]=el.value.split('-').map(Number);lab.textContent=new Date(y,m-1,1,12).toLocaleDateString('pt-BR',{month:'short',year:'numeric'})}else{const [y,m,d]=el.value.split('-').map(Number);lab.textContent=new Date(y,m-1,d,12).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}}}
function showScreen(name){screen=name;showScreenNoScroll();window.scrollTo({top:0,behavior:'instant'})}
function rows(items,type){if(!items.length)return '<p class="empty">Nenhum item cadastrado.</p>';return items.map(e=>{let extra='';if(type==='fixed')extra=`${money(e.amount)} por mês · débito dia ${e.day||5} · ${e.start}${e.end?' até '+e.end:''}`;if(type==='base')extra=`${e.remaining} parcela(s) de ${money(e.payment)} · desde ${e.start}`;if(type==='new')extra=`${e.count}x · ${money(e.total)} · desde ${e.start}`;return `<div class="entry"><div class="entry-main"><div class="entry-title">${esc(e.name)}</div><div class="entry-description">${esc(extra)}</div></div><div class="entry-right"><button type="button" class="small-action" data-edit-${type}="${esc(e.id)}">Editar</button><button type="button" class="entry-remove" data-delete-${type}="${esc(e.id)}" aria-label="Excluir ${esc(e.name)}">×</button></div></div>`}).join('')}
function breakdown(s,m){
 const z=monthly(s,m),mExtra=round(s.extraIncome.filter(e=>e.date.slice(0,7)===m).reduce((v,e)=>v+e.amount,0));
 const group=(label,items,defaultOpen=false)=>{
   const total=round(items.reduce((v,e)=>v+e.amount,0));
   const lines=items.slice().sort((a,b)=>b.amount-a.amount||a.name.localeCompare(b.name,'pt-BR')).map(e=>`<div class="detail-line"><span>${esc(e.name)}${e.meta?`<small>${esc(e.meta)}</small>`:''}</span><strong>${e.sign==='+'?'+ ':'− '}${money(e.amount)}</strong></div>`).join('');
   return `<details class="breakdown-group" ${defaultOpen?'open':''}><summary><span>${esc(label)} <small>${items.length} item(ns)</small></span><strong>${money(total)}</strong></summary><div class="breakdown-rows">${lines||'<p class="empty">Nenhum lançamento neste mês.</p>'}</div></details>`;
 };
 const fixed=s.mode==='legacy'?[{name:'Total antigo de fixos',amount:z.fixed}]:activeFixed(s,m).map(e=>({name:e.name,amount:e.amount,meta:`Dia ${e.day||5} · ${confirmedFixed(s,e.id,m)?'pago':'previsto'}`}));
 const base=s.mode==='legacy'?[{name:'Total antigo da fatura',amount:z.base}]:oldParts(s,m).map(e=>({name:e.name,amount:e.payment}));
 const novas=s.parcels.map(e=>({name:e.name,amount:newPartAmount(e,m)})).filter(e=>e.amount>0);
 const invests=[{name:'Investimento mensal',amount:z.investment,meta:settled(s,m)?'Realizado':'Planejado'},...s.extraInvestments.filter(e=>e.date.slice(0,7)===m).map(e=>({name:e.name,amount:e.amount,meta:e.date.split('-').reverse().join('/')}))];
 const extras=s.extraIncome.filter(e=>e.date.slice(0,7)===m).map(e=>({name:e.name,amount:e.amount,sign:'+'}));
 return `<div class="detail-line"><span>Renda líquida</span><strong>${money(z.income)}</strong></div>`+
 group('Despesas fixas',fixed)+group('Parcelas anteriores',base)+group('Compras parceladas novas',novas)+group('Investimentos',invests)+group('Entradas extras',extras)+
 `<div class="detail-line"><span>Margem protegida</span><strong>− ${money(z.margin)}</strong></div><div class="detail-line detail-total"><span>Livre no mês (planejado)</span><strong>${z.known?money(round(z.available+mExtra)):'—'}</strong></div>`;
}
function paymentChecklist(s,m){
 const fmt=m=>new Date(m+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
 $('paidMonthLabel').textContent=fmt(m);
 const fixed=activeFixed(s,m).slice().sort((a,b)=>(a.day||5)-(b.day||5)||a.name.localeCompare(b.name));
 const rows=fixed.map(e=>{const paid=confirmedFixed(s,e.id,m);return `<label class="pay-row"><input type="checkbox" data-toggle-fixed="${esc(e.id)}" data-month="${m}" ${paid?'checked':''} ${m!==monthNow()?'disabled':''}><span class="pay-text"><strong>${esc(e.name)}</strong><small>Dia ${e.day||5} · ${paid?'Pago em '+paid.date.split('-').reverse().join('/'): 'Pendente'}</small></span><b>${money(e.amount)}</b></label>`}).join('');
 const invested=settled(s,m),invest=investmentAmount(s,m);
 const investmentLine=invest>0?`<label class="pay-row"><input type="checkbox" data-toggle-invest="${m}" ${invested?'checked':''} ${m!==monthNow()?'disabled':''}><span class="pay-text"><strong>Investimento mensal</strong><small>${invested?'Realizado em '+invested.date.split('-').reverse().join('/'): 'Pendente'}</small></span><b>${money(invest)}</b></label>`:'';
 return `${rows||'<p class="empty">Sem despesas fixas para este período.</p>'}${investmentLine}`;
}
function render(){const m=monthNow(),x=monthly(state,m),calc=cycleBudget(state);$('monthCaption').textContent=new Date(m+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
$('cashBalance').textContent=calc.ready?money(calc.current):'—';
$('cashBalance').classList.toggle('negative',calc.ready&&calc.current<0);
$('cycleAvailable').textContent=calc.ready?money(calc.available):'—';
$('dayReference').textContent=calc.ready?money(calc.daily):'—';
$('sundayReference').textContent=calc.ready?money(calc.week):'—';
$('paydayCaption').textContent=calc.ready?calc.next.split('-').reverse().join('/'):'—';
$('daysCaption').textContent=calc.ready?`${calc.days} dia(s) até o salário`:'—';
$('sundayCaption').textContent=calc.ready?`Até ${calc.sunday.split('-').reverse().join('/')} · ${calc.remaining} dia(s)`:'—';
$('cycleDetail').textContent=!calc.ready?calc.reason:calc.minimum<0?'Atenção: os compromissos projetados ultrapassam o caixa protegido. Confira o planejamento.':'Após a margem e os pagamentos previstos, sem antecipar salários futuros.';
$('currentMargin').textContent=money(profile(state,m).margin);
$('currentInvestment').textContent=money(investmentAmount(state,m));
$('paidMonthlyList').innerHTML=(state.monthlyPaid||[]).slice().sort((a,b)=>b.month.localeCompare(a.month)).map(e=>`<div class="entry"><div class="entry-main"><div class="entry-title">${esc(e.month)} · aporte do mês</div><div class="entry-description">Realizado em ${esc(e.date.split('-').reverse().join('/'))}</div></div><div class="entry-right"><span class="entry-price">${money(e.amount)}</span><button type="button" class="entry-remove" data-delete-paid="${esc(e.month)}" aria-label="Desfazer registro de aporte">×</button></div></div>`).join('');


const ex=state.expenses.slice().sort((a,b)=>b.date.localeCompare(a.date));$('expenseCount').textContent=String(ex.length);$('expenses').innerHTML=ex.length?ex.map(e=>`<div class="entry"><div class="entry-main"><div class="entry-title">${esc(e.name)}</div><div class="entry-description">${e.date.split('-').reverse().join('/')}</div></div><div class="entry-right"><span class="entry-price">${money(e.amount)}</span><button class="entry-remove" type="button" data-delete-expense="${esc(e.id)}" aria-label="Excluir ${esc(e.name)}">×</button></div></div>`).join(''):'<p class="empty">Nenhum gasto registrado.</p>';
$('parcels').innerHTML=rows(state.parcels,'new');$('parcelCountBadge').textContent=String(state.parcels.length);$('fixedList').innerHTML=rows(state.fixedItems,'fixed');$('baseList').innerHTML=rows(state.baseParcels,'base');$('fixedSubtotal').textContent=money(x.fixed);$('fixedSubtotalSummary').textContent=money(x.fixed);$('baseSubtotal').textContent= x.known?money(x.base):'—';$('baseSubtotalSummary').textContent=x.known?money(x.base):'—';$('investmentSubtotal').textContent=money(x.investment+x.invested);$('extraInvestmentList').innerHTML=state.extraInvestments.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<div class="entry"><div class="entry-main"><div class="entry-title">${esc(e.name)}</div><div class="entry-description">${esc(e.date.split('-').reverse().join('/'))}</div></div><div class="entry-right"><span class="entry-price">${money(e.amount)}</span><button class="entry-remove" data-delete-extra="${esc(e.id)}" aria-label="Excluir investimento">×</button></div></div>`).join('')||'<p class="empty">Nenhum investimento extra realizado.</p>';
$('forecast').innerHTML=Array.from({length:12},(_,i)=>{const month=shiftMonth(m,i),z=monthly(state,month);return `<button class="forecast-row ${month===viewMonth?'selected':''}" aria-pressed="${month===viewMonth}" type="button" data-view-month="${month}"><span><strong>${new Date(month+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'short',year:'numeric'})}</strong><small>Fixos ${money(z.fixed)} · fatura ${z.known?money(z.base+z.extra):'—'} · investir ${money(z.investment+z.invested)} · margem ${money(z.margin)}</small></span><strong class="${z.known&&z.available<0?'negative':''}">${z.known?money(round(z.available+state.extraIncome.filter(e=>e.date.slice(0,7)===month).reduce((a,e)=>a+e.amount,0))):'—'}</strong></button>`}).join('');
$('paymentChecklist').innerHTML=paymentChecklist(state,paidViewMonth);
$('started').value=state.started;const editingMonth=$('effectiveMonth').value||m;$('effectiveMonth').value=editingMonth;fillProfileInputs();
$('exportLegacy').classList.toggle('hidden',!archived);
$('selectedMonthLabel').textContent=new Date(viewMonth+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});$('monthBreakdown').innerHTML=breakdown(state,viewMonth);previewParcel();calendarLabels();showScreenNoScroll()}
function showScreenNoScroll(){const auxiliary=screen==='settings'||screen==='info';document.body.classList.toggle('settings-view',auxiliary);$('quickSettings').textContent=screen==='settings'?'←':'⚙';$('quickSettings').setAttribute('aria-label',screen==='settings'?'Voltar ao aplicativo':'Abrir ajustes');$('quickInfo').textContent=screen==='info'?'←':'ⓘ';$('quickInfo').setAttribute('aria-label',screen==='info'?'Voltar ao aplicativo':'Abrir informações');$('quickSettings').classList.toggle('hidden',screen==='info');$('quickInfo').classList.toggle('hidden',screen==='settings');for(const n of ['week','installments','planning','settings','info']){$('screen-'+n).classList.toggle('hidden',n!==screen);const button=document.querySelector(`[data-screen="${n}"]`);if(button)button.classList.toggle('active',n===screen)}}
function previewParcel(){const total=amount('parcelTotal'),count=Number($('parcelCount').value)||1,unit=Number.isFinite(total)&&total>0?round(total/count):0;$('parcelPreview').textContent=money(unit);$('weeklyImpact').textContent=money(unit)}
async function saveExpense(e){e.preventDefault();const name=$('expenseName').value.trim(),value=amount('expenseAmount'),date=$('expenseDate').value;if(!name||!(value>0)||!isDate(date))return notice('Informe data, descrição e valor positivo.','warning');if(await update(s=>s.expenses.push({id:newId(),name,amount:round(value),date}))){$('expenseName').value='';$('expenseAmount').value=''}}
async function saveNew(e){e.preventDefault();const name=$('parcelName').value.trim(),total=amount('parcelTotal'),count=Number($('parcelCount').value),start=$('parcelStart').value;if(!name||!(total>0)||!isMonth(start)||!Number.isInteger(count)||count<1||count>120)return notice('Confira os campos da compra.','warning');if(await update(s=>{const item={id:editingNew||newId(),name,total:round(total),payment:round(total/count),count,start};if(editingNew)s.parcels=s.parcels.map(p=>p.id===editingNew?item:p);else s.parcels.push(item)})){editingNew=null;$('parcelName').value='';$('parcelTotal').value='';$('parcelSubmit').textContent='Adicionar parcelamento';$('parcelCancel').classList.add('hidden')}}
function fillProfileInputs(){if(!state)return;const p=profile(state,$('effectiveMonth').value||monthNow());$('income').value=p.income;$('investment').value=p.investments;$('margin').value=p.margin}
async function saveBaseline(e){e.preventDefault();const income=amount('income'),investment=amount('investment'),margin=amount('margin'),date=$('started').value,from=$('effectiveMonth').value;if(![income,investment,margin].every(v=>Number.isFinite(v)&&v>=0)||!isDate(date)||!isMonth(from))return notice('Confira os valores e as datas.','warning');await update(s=>{const p={from,income:round(income),investments:round(investment),margin:round(margin)};s.profiles=s.profiles.filter(x=>x.from!==from);s.profiles.push(p);s.profiles.sort((a,b)=>a.from.localeCompare(b.from));s.started=monday(new Date(date+'T12:00:00'))})}
async function saveFixed(e){e.preventDefault();const name=$('fixedName').value.trim(),value=amount('fixedAmount'),start=$('fixedStart').value,end=$('fixedEnd').value;if(!name||!Number.isFinite(value)||value<0||!Number.isInteger(Number($('fixedDay').value))||Number($('fixedDay').value)<1||Number($('fixedDay').value)>31||!isMonth(start)||(end&&!isMonth(end))||(end&&end<start))return notice('Confira os dados da despesa fixa.','warning');if(await update(s=>{const item={id:editingFixed||newId(),name,amount:round(value),day:Number($('fixedDay').value),start,end:end||null};if(editingFixed)s.fixedItems=s.fixedItems.map(p=>p.id===editingFixed?item:p);else s.fixedItems.push(item)})){editingFixed=null;$('fixedForm').reset();$('fixedStart').value=monthNow();$('fixedDay').value='5';$('fixedSubmit').textContent='Adicionar despesa fixa';$('fixedCancel').classList.add('hidden');calendarLabels()}}
async function saveBase(e){e.preventDefault();const name=$('baseName').value.trim(),payment=amount('basePayment'),remaining=Number($('baseRemaining').value),start=$('baseStart').value;if(!name||!(payment>0)||!Number.isInteger(remaining)||remaining<1||remaining>240||!isMonth(start))return notice('Confira a parcela antiga.','warning');if(await update(s=>{const item={id:editingBase||newId(),name,payment:round(payment),remaining,start};if(editingBase)s.baseParcels=s.baseParcels.map(p=>p.id===editingBase?item:p);else s.baseParcels.push(item)})){editingBase=null;$('baseForm').reset();$('baseStart').value=monthNow();$('baseSubmit').textContent='Adicionar parcela antiga';$('baseCancel').classList.add('hidden');calendarLabels()}}
async function saveExtraInvestment(e){e.preventDefault();const date=$('extraDate').value,name=$('extraName').value.trim()||'Investimento extra',v=amount('extraAmount');if(!isDate(date)||!Number.isFinite(v)||v<=0)return notice('Informe data e valor positivo.','warning');if(await update(s=>s.extraInvestments.push({id:newId(),date,name,amount:round(v)}))){$('extraAmount').value='';$('extraName').value=''}}


async function saveMonthlyPaid(e){
 e.preventDefault();const date=$('monthlyPaidDate').value,month=$('monthlyPaidMonth').value;
 if(!isDate(date)||!isMonth(month)||date.slice(0,7)!==month)return notice('A data precisa pertencer ao mês do aporte.','warning');
 const value=investmentAmount(state,month);
 if(!(value>0))return notice('Não há investimento mensal configurado para este mês.','warning');
 if(settled(state,month)&&!confirm('Substituir a data anterior deste aporte mensal?'))return;
 await update(s=>{s.monthlyPaid=s.monthlyPaid.filter(x=>x.month!==month);s.monthlyPaid.push({month,date,amount:value})});
}

async function saveOpening(e){e.preventDefault();const date=$('openingDate').value,v=amount('openingAmount');if(!isDate(date)||!Number.isFinite(v)||v<0)return notice('Informe data e saldo de abertura válidos.','warning');if(state.opening&&!confirm('Alterar o saldo de abertura recalculará o caixa. Deseja continuar?'))return;await update(s=>{s.opening={date,amount:round(v)}})}
async function saveExtraIncome(e){e.preventDefault();const date=$('incomeExtraDate').value,name=$('incomeExtraName').value.trim()||'Entrada extra',v=amount('incomeExtraAmount');if(!isDate(date)||!(v>0))return notice('Confira a data e o valor da entrada extra.','warning');if(await update(s=>s.extraIncome.push({id:newId(),date,name,amount:round(v)}))){$('incomeExtraName').value='';$('incomeExtraAmount').value=''}}

function resetForms(){editingFixed=editingBase=editingNew=null;for(const [a,b] of [['fixedSubmit','Adicionar despesa fixa'],['baseSubmit','Adicionar parcela antiga'],['parcelSubmit','Adicionar parcelamento']])$(a).textContent=b;for(const id of ['fixedCancel','baseCancel','parcelCancel'])$(id).classList.add('hidden')}
function editItem(kind,id){const items=kind==='fixed'?state.fixedItems:kind==='base'?state.baseParcels:state.parcels;const v=items.find(e=>e.id===id);if(!v)return;if(kind==='fixed'){editingFixed=id;$('fixedName').value=v.name;$('fixedAmount').value=v.amount;$('fixedDay').value=v.day||5;$('fixedStart').value=v.start;$('fixedEnd').value=v.end||'';$('fixedSubmit').textContent='Salvar despesa fixa';$('fixedCancel').classList.remove('hidden');showScreen('settings');$('fixedForm').closest('details')?.setAttribute('open','');$('fixedForm').scrollIntoView({behavior:'smooth'})}if(kind==='base'){editingBase=id;$('baseName').value=v.name;$('basePayment').value=v.payment;$('baseRemaining').value=v.remaining;$('baseStart').value=v.start;$('baseSubmit').textContent='Salvar parcela antiga';$('baseCancel').classList.remove('hidden');showScreen('settings');$('baseForm').closest('details')?.setAttribute('open','');$('baseForm').scrollIntoView({behavior:'smooth'})}if(kind==='new'){editingNew=id;$('parcelName').value=v.name;$('parcelTotal').value=v.total;$('parcelCount').value=String(v.count);if(!$('parcelCount').value){$('parcelCount').insertAdjacentHTML('beforeend',`<option value="${v.count}">${v.count}x</option>`);$('parcelCount').value=String(v.count)}$('parcelStart').value=v.start;$('parcelSubmit').textContent='Salvar compra';$('parcelCancel').classList.remove('hidden');showScreen('installments');$('parcelForm').scrollIntoView({behavior:'smooth'})}calendarLabels()}
function downloadFile(contents,name){const blob=new Blob([contents],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function exportBackup(){downloadFile(JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),`financas-${today()}.json`);notice('Backup preparado. Confirme se ele foi salvo no aplicativo Arquivos.','warning')}
async function restoreBackup(e){const file=e.target.files?.[0];if(!file)return;try{const raw=JSON.parse(await file.text());const normalized=raw.version===8?raw:raw.version===7?raw:raw.version===6?raw:raw.version===5?raw:raw.version===4?raw:raw.version===3?migrateV3(raw):isOldV2(raw)?migrateOld(raw):migratePilot(raw);const incoming=toV8(normalized);if(!valid(incoming))throw Error('Formato incompatível');if(!confirm('Substituir todos os registros deste aparelho pelo backup?'))return;await write(RECORD,incoming);state=incoming;resetForms();render();notice('Backup restaurado.')}catch(err){notice('Falha na importação: '+err.message,'error')}finally{e.target.value=''}}
async function init(){try{
 db=await openDb();let v=await read(RECORD);archived=!!(await read(ARCHIVE));
 if(v){
   if(v.version===8){if(!valid(v))throw Error('Dados existentes precisam de recuperação. Não apague o aplicativo.');state=v}
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
 $('app').hidden=false;$('loading').hidden=true;$('expenseDate').value=today();
 for(const id of ['parcelStart','fixedStart','baseStart','effectiveMonth'])$(id).value=monthNow();$('extraDate').value=today();$('incomeExtraDate').value=today();$('openingDate').value=today();$('monthlyPaidDate').value=today();$('monthlyPaidMonth').value=monthNow();
 render();navigator.storage?.persist?.().catch(()=>{});
 }catch(e){$('loading').hidden=true;notice('Não foi possível carregar seus dados: '+e.message,'error')}
}
// As seções de Ajustes já são recolhíveis no HTML, com títulos próprios.
document.querySelectorAll('.calendar-field input').forEach(el=>{el.addEventListener('input',calendarLabels);el.addEventListener('change',calendarLabels)});
document.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.screen)));
$('quickSettings').addEventListener('click',()=>showScreen(screen==='settings'?'week':'settings'));
$('quickInfo').addEventListener('click',()=>showScreen(screen==='info'?'week':'info'));
for(const [id,fn] of [['expenseForm',saveExpense],['parcelForm',saveNew],['baselineForm',saveBaseline],['fixedForm',saveFixed],['baseForm',saveBase],['extraForm',saveExtraInvestment],['openingForm',saveOpening],['incomeExtraForm',saveExtraIncome],['monthlyPaidForm',saveMonthlyPaid]])$(id).addEventListener('submit',fn);
$('parcelTotal').addEventListener('input',previewParcel);$('parcelCount').addEventListener('change',previewParcel);
$('effectiveMonth').addEventListener('change',fillProfileInputs);


$('exportBackup').addEventListener('click',exportBackup);$('restoreFile').addEventListener('change',restoreBackup);$('exportLegacy').addEventListener('click',async()=>{const old=await read(ARCHIVE);if(old)downloadFile(JSON.stringify(old,null,2),`financas-arquivo-anterior-${today()}.json`)});
$('exportPrevious').addEventListener('click',async()=>{const old=await read('state-before-v3.7')||await read(BEFORE35)||await read(BEFORE34)||await read(BEFORE33)||await read(PREVIOUS);if(old)downloadFile(JSON.stringify(old,null,2),`financas-versao-anterior-${today()}.json`);else notice('Arquivo da versão anterior indisponível.','warning')});
for(const id of ['fixedCancel','baseCancel','parcelCancel'])$(id).addEventListener('click',()=>{resetForms();render()});
$('paidPrev').addEventListener('click',()=>{paidViewMonth=shiftMonth(paidViewMonth,-1);render()});
$('paidNext').addEventListener('click',()=>{paidViewMonth=shiftMonth(paidViewMonth,1);render()});
$('paymentChecklist').addEventListener('change',async e=>{
 const el=e.target;if(!(el instanceof HTMLInputElement))return;
 if(el.dataset.toggleFixed){const id=el.dataset.toggleFixed,month=el.dataset.month,item=state.fixedItems.find(x=>x.id===id);if(!item)return;
   if(el.checked){await update(s=>{s.fixedPaid=s.fixedPaid||[];s.fixedPaid.push({id,month,date:today(),amount:item.amount})})}
   else await update(s=>{s.fixedPaid=(s.fixedPaid||[]).filter(x=>!(x.id===id&&x.month===month))});
 }else if(el.dataset.toggleInvest){const month=el.dataset.toggleInvest;
   if(el.checked)await update(s=>{s.monthlyPaid=s.monthlyPaid.filter(x=>x.month!==month);s.monthlyPaid.push({month,date:today(),amount:investmentAmount(s,month)})});
   else await update(s=>{s.monthlyPaid=s.monthlyPaid.filter(x=>x.month!==month)});
 }
});
document.addEventListener('click',e=>{const target=e.target;if(!(target instanceof Element))return;for(const kind of ['fixed','base','new']){const edit=target.closest(`[data-edit-${kind}]`),del=target.closest(`[data-delete-${kind}]`);if(edit){editItem(kind,edit.getAttribute(`data-edit-${kind}`));return}if(del){if(!confirm('Excluir este item do planejamento?'))return;const id=del.getAttribute(`data-delete-${kind}`),field=kind==='fixed'?'fixedItems':kind==='base'?'baseParcels':'parcels';update(s=>s[field]=s[field].filter(x=>x.id!==id));return}}const exp=target.closest('[data-delete-expense]');if(exp){if(confirm('Excluir este gasto?'))update(s=>s.expenses=s.expenses.filter(x=>x.id!==exp.dataset.deleteExpense));return}const paid=target.closest('[data-delete-paid]');if(paid){if(confirm('Remover a data antecipada? O aporte mensal voltará a ser estimado no dia 30.'))update(s=>s.monthlyPaid=s.monthlyPaid.filter(x=>x.month!==paid.dataset.deletePaid));return}const exInv=target.closest('[data-delete-extra]');if(exInv){if(confirm('Excluir este investimento extra?'))update(s=>s.extraInvestments=s.extraInvestments.filter(x=>x.id!==exInv.dataset.deleteExtra));return}const mv=target.closest('[data-view-month]');if(mv){viewMonth=mv.dataset.viewMonth;$('selectedMonthLabel').textContent=new Date(viewMonth+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});$('monthBreakdown').innerHTML=breakdown(state,viewMonth);$('detailCard').scrollIntoView({behavior:'smooth'})}});
init();
if('serviceWorker' in navigator){let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload()});window.addEventListener('load',async()=>{try{const reg=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});reg.update().catch(()=>{})}catch{}})}
