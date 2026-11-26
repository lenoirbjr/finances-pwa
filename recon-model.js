'use strict';
// Conciliação local. Trabalha com centavos inteiros e nunca antecipa reembolso.
function reconInit(s){return s.reconciliation ||= {statements:[],bankRows:[],receipts:[],overrides:[],payments:[]}}
function reconValidate(r){
 if(r===undefined)return true;
 const arr=(x,n)=>Array.isArray(x)&&x.length<=n, str=(x,n=180)=>typeof x==='string'&&x.trim().length>0&&x.length<=n;
 const cent=x=>Number.isSafeInteger(x)&&Math.abs(x)<=1e12, pos=x=>cent(x)&&x>0;
 const parts=p=>arr(p,50)&&p.every(x=>x&&str(x.person,100)&&pos(x.cents))&&new Set(p.map(x=>reconPersonKey(x.person))).size===p.length;
 const unique=(a,fn)=>new Set(a.map(fn)).size===a.length;
 if(!r||!arr(r.statements,120)||!arr(r.bankRows,30000)||!arr(r.receipts,10000)||!arr(r.overrides,20000)||!arr(r.payments??[],120))return false;
 if(r.baseline!==undefined){
  const b=r.baseline;
  if(!b||!isDate(b.date)||!arr(b.accounts,25)||!b.accounts.length||!b.accounts.every(a=>a&&str(a.id,80)&&str(a.name,100)&&cent(a.cents))||!unique(b.accounts,x=>x.id))return false;
 }
 const classification=(x,total)=>{const p=x.parts??[];if(!parts(p))return false;const n=p.reduce((a,z)=>a+z.cents,0);return x.label==='other'?n===total:x.label==='split'?n>0&&n<total:(!x.label||x.label==='mine')&&n===0};
 if(!r.statements.every(st=>st&&isMonth(st.month)&&arr(st.rows,5000)&&st.rows.every(x=>x&&str(x.id)&&str(x.name,250)&&isDate(x.date)&&cent(x.cents)&&(['charge','credit','prior-payment'].includes(x.kind))&&(x.kind==='charge'?x.cents>0:x.cents<0)&&classification(x,Math.abs(x.cents))&&(x.kind==='charge'||!x.label)&&(x.legacyIds===undefined||(arr(x.legacyIds,10)&&x.legacyIds.every(x=>str(x))))&&((x.number===undefined&&x.count===undefined)||(Number.isInteger(x.number)&&Number.isInteger(x.count)&&1<=x.number&&x.number<=x.count&&x.count<=240)))&&unique(st.rows,x=>x.id))||!unique(r.statements,x=>x.month))return false;
 if(!r.bankRows.every(x=>x&&str(x.id)&&str(x.name,300)&&isDate(x.date)&&typeof x.time==='string'&&/^\d{2}:\d{2}:\d{2}$/.test(x.time)&&cent(x.cents)&&cent(x.balanceCents))||!unique(r.bankRows,x=>x.id))return false;
 if(!r.overrides.every(x=>x&&isMonth(x.month)&&str(x.rowId)&&['one','future','all'].includes(x.scope)&&pos(x.basis)&&classification(x,x.basis)&&(x.name===undefined||str(x.name,250))&&(x.ownerName===undefined||str(x.ownerName,100))&&(x.seriesKey===undefined||str(x.seriesKey,500)))||!unique(r.overrides,x=>x.month+'|'+x.rowId+'|'+x.scope))return false;
 if(!(r.payments??[]).every(x=>x&&isMonth(x.month)&&isDate(x.date))||!unique(r.payments??[],x=>x.month))return false;
 return r.receipts.every(x=>x&&str(x.id)&&isDate(x.date)&&str(x.accountId,80)&&str(x.person,100)&&pos(x.cents)&&typeof x.inBaseline==='boolean'&&arr(x.allocations,500)&&x.allocations.length>0&&x.allocations.every(a=>a&&str(a.rowId)&&isMonth(a.month)&&pos(a.cents))&&unique(x.allocations,a=>a.month+'|'+a.rowId)&&x.allocations.reduce((a,z)=>a+z.cents,0)===x.cents)&&unique(r.receipts,x=>x.id);
}
function reconPersonKey(x){return String(x??'').trim().normalize('NFC').toLocaleLowerCase('pt-BR')}
function reconAccounts(s){return s.reconciliation?.baseline?.accounts??[{id:'digital',name:'Conta digital'},{id:'inter',name:'Inter'},{id:'other',name:'Outra conta'}]}
function reconScale(parts,label,basis,to){
 if(!label||label==='mine'||!parts?.length)return [];
 if(basis===to)return parts.map(p=>({...p}));
 if(!Number.isSafeInteger(to)||to<=0)return [];
 const extra=label==='split'?basis-parts.reduce((n,p)=>n+p.cents,0):0;
 const inputs=extra>0?[...parts,{person:'',cents:extra}]:parts;
 const scaled=inputs.map((p,i)=>{const numerator=BigInt(p.cents)*BigInt(to);return {person:p.person,cents:Number(numerator/BigInt(basis)),r:Number(numerator%BigInt(basis)),i}});
 let left=to-scaled.reduce((n,p)=>n+p.cents,0);
 for(const p of [...scaled].sort((a,b)=>b.r-a.r||a.i-b.i)){if(left<=0)break;p.cents++;left--}
 return scaled.filter(x=>x.person&&x.cents>0).map(({person,cents})=>({person,cents}));
}
// Preserva o caixa e os Pix vinculados a movimentos em crédito da 4.0.1,
 // sem voltar a mostrá-los como compras da fatura.
function reconPreviousCreditRows(s,m){
 return s.expenses.filter(e=>e.cardMonth===m).map(e=>({id:'cashcard:'+e.id,name:e.name,date:e.date,cents:Math.round(e.amount*100),kind:'charge',source:'movement'}));
}
function reconPreviousCredit(s,m){
 return reconPreviousCreditRows(s,m).reduce((n,x)=>n+x.cents,0)/100;
}
function reconOwner(s){
 const names=(s.reconciliation?.statements??[]).flatMap(st=>st.rows.map(x=>x.source?.Portador)).filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim().replace(/\s+/g,' '));
 const first=names[0]?.split(' ')[0];
 const key=x=>reconPersonKey(x).normalize('NFD').replace(/\p{M}/gu,'');
 if(!first||names.some(n=>key(n.split(' ')[0])!==key(first)))return {name:'',aliases:['eu']};
 const name=first.charAt(0).toLocaleUpperCase('pt-BR')+first.slice(1).toLocaleLowerCase('pt-BR');
 return {name,aliases:['eu',first,...new Set(names)]};
}
function reconSeriesId(row){return row.seriesKey??'id:'+row.id}
function reconStatementRows(st){
 const duplicates=new Map();
 return st.rows.map(x=>{
  let seriesKey;
  if(x.kind==='charge'&&x.count>1){
   const merchant=reconPersonKey(x.source?.Estabelecimento||x.name);
   const key=JSON.stringify([x.date,merchant,x.count,x.cents,shiftMonth(st.month,1-x.number)]);
   const n=duplicates.get(key)??0;duplicates.set(key,n+1);
   seriesKey='csv:'+key+':'+n;
  }
  return {...x,seriesKey,source:'statement'};
 });
}
function reconRawRows(s,m){
 const statements=s.reconciliation?.statements??[];
 const exact=statements.find(x=>x.month===m);
 if(exact){
  const manual=[];
  const linked=new Set(exact.rows.flatMap(x=>x.legacyIds??[]));
  for(const e of s.parcels){
   const cents=Math.round(newPartAmount(e,m)*100);
   if(e.cardAdded&&!linked.has(e.id)&&cents>0)manual.push({id:e.id,name:e.name,date:e.purchaseDate??eventDate(e.start,5),cents,kind:'charge',count:e.count,number:monthDiff(e.start,m)+1,source:'manual'});
  }
  return [...reconStatementRows(exact),...manual];
 }
 const prior=statements.filter(x=>x.month<m).sort((a,b)=>b.month.localeCompare(a.month));
 const covered=new Set(), projected=[], seen=new Set();
 for(const st of prior){
  const off=monthDiff(st.month,m);
  for(const x of reconStatementRows(st)){
   if(x.kind!=='charge'||!x.count)continue;
   const aliases=x.legacyIds??[];
   const key=reconSeriesId(x);
   if(seen.has(key))continue;
   seen.add(key);
   for(const id of aliases)covered.add(id);
   if(x.number+off<=x.count)projected.push({...x,number:x.number+off,source:'forecast'});
  }
 }
 for(const e of oldParts(s,m))if(!covered.has(e.id))projected.push({id:e.id,name:e.name,date:eventDate(e.start,5),cents:Math.round(e.payment*100),kind:'charge',count:e.remaining,number:monthDiff(e.start,m)+1,source:'legacy'});
 for(const e of s.parcels){
  const cents=Math.round(newPartAmount(e,m)*100);
  if(!covered.has(e.id)&&cents>0)projected.push({id:e.id,name:e.name,date:e.purchaseDate??eventDate(e.start,5),cents,kind:'charge',count:e.count,number:monthDiff(e.start,m)+1,source:e.cardAdded?'manual':'legacy'});
 }
 return projected;
}
function reconRows(s,m,includePreviousCredit=false){
 const overrides=s.reconciliation?.overrides??[];
 const rows=reconRawRows(s,m);
 return (includePreviousCredit?[...rows,...reconPreviousCreditRows(s,m)]:rows).map(row=>{
  const exact=overrides.find(o=>o.rowId===row.id&&o.month===m&&o.scope==='one')??overrides.find(o=>o.rowId===row.id&&o.month===m&&o.scope==='future');
  const earlier=overrides.filter(o=>o.rowId===row.id&&o.scope==='future'&&o.month<m).sort((a,b)=>b.month.localeCompare(a.month))[0];
  const all=overrides.find(o=>o.scope==='all'&&(o.seriesKey===reconSeriesId(row)||o.rowId===row.id));
  const o=all??exact??earlier;
  if(!o)return row;
  const parts=reconScale(o.parts,o.label,o.basis,row.cents);
  const label=parts.length?(parts.reduce((a,p)=>a+p.cents,0)===row.cents?'other':'split'):o.label?'mine':undefined;
  const name=o.name??earlier?.name??row.name;
  return {...row,label,parts,name,ownerName:o.ownerName,originalName:name===row.name?undefined:row.name};
 });
}
function reconMonths(s){
 const r=s.reconciliation;
 const cur=monthNow();
 const m=new Set([cur,shiftMonth(cur,1)]);
 for(const st of r?.statements??[]){m.add(st.month);for(const row of st.rows)if(row.count>row.number){for(let i=1;i<=row.count-row.number;i++)m.add(shiftMonth(st.month,i))}}
 for(const x of s.expenses)if(x.cardMonth)m.add(x.cardMonth);
 for(const o of r?.overrides??[])m.add(o.month);
 for(const p of r?.receipts??[])for(const a of p.allocations)m.add(a.month);
 for(const e of [...s.parcels,...s.baseParcels])for(let i=0;i<(e.count??e.remaining);i++){const a=shiftMonth(e.start,i);m.add(a)}
 return [...m].sort();
}
function reconDebt(s){
 const received=new Map();
 for(const p of s.reconciliation?.receipts??[])for(const a of p.allocations){
  const k=a.month+'|'+a.rowId+'|'+reconPersonKey(p.person);
  received.set(k,(received.get(k)??0)+a.cents);
 }
 return reconMonths(s).flatMap(month=>reconRows(s,month,true).flatMap(row=>(row.parts??[]).map(part=>{
  const n=received.get(month+'|'+row.id+'|'+reconPersonKey(part.person))??0;
  return {rowId:row.id,month,person:part.person,cents:part.cents,received:n,remaining:Math.max(0,part.cents-n),name:row.name,number:row.number,count:row.count};
 })));
}
function reconSetLabel(s,month,rowId,label,parts,scope,name,ownerName){
 const row=reconRows(s,month).find(x=>x.id===rowId&&x.kind==='charge');if(!row)throw Error('Lançamento não encontrado.');
 const r=reconInit(s);
 let p=(parts??[]).map(x=>({person:x.person.trim().normalize('NFC'),cents:x.cents}));
 if(!label||label==='mine')p=[];
 if(!['one','future','all'].includes(scope))throw Error('Não foi possível identificar as parcelas.');
 const editedName=name===undefined?undefined:String(name).trim();
 const editedOwner=label==='mine'&&ownerName?String(ownerName).trim().normalize('NFC'):undefined;
 if(editedName!==undefined&&(!editedName||editedName.length>250))throw Error('Informe um nome com até 250 caracteres.');
 if(editedOwner&&editedOwner.length>100)throw Error('Informe um nome com até 100 caracteres.');
 const seriesKey=reconSeriesId(row),related=new Set([rowId]);
 const touches=(other,id,m)=> scope==='all'?(id===rowId||reconSeriesId(other)===seriesKey):(id===rowId&&(m===month||(scope==='future'&&m>month)));
 if(scope==='all')for(const m of reconMonths(s))for(const item of reconRawRows(s,m))if(reconSeriesId(item)===seriesKey)related.add(item.id);
 for(const d of reconDebt(s))if(d.received>0&&(related.has(d.rowId)||d.rowId===rowId)){
  const target=reconRawRows(s,d.month).find(t=>t.id===d.rowId);
  if(!target||!touches(target,d.rowId,d.month))continue;
  const capacity=reconScale(p,label,row.cents,target.cents).find(x=>reconPersonKey(x.person)===reconPersonKey(d.person))?.cents;
  if((capacity??0)<d.received)throw Error('Já há um Pix vinculado. Mantenha o valor recebido no rateio ou ajuste o Pix antes.');
 }
 if(scope==='all')r.overrides=r.overrides.filter(x=>!related.has(x.rowId)&&x.seriesKey!==seriesKey);
 else if(scope==='future')r.overrides=r.overrides.filter(x=>x.rowId!==rowId||x.month<month);
 else r.overrides=r.overrides.filter(x=>x.rowId!==rowId||x.month!==month||x.scope!=='one');
 r.overrides.push({month,rowId,label:label||null,scope,basis:row.cents,parts:p,...(editedName?{name:editedName}:{}),...(editedOwner?{ownerName:editedOwner}:{}),...(scope==='all'?{seriesKey}:{})});
}
function reconAddReceipt(s,p){
 const r=reconInit(s);
 const account=reconAccounts(s).find(x=>x.id===p.accountId);
 const person=String(p.person??'').trim();
 if(!account||!person||!isDate(p.date)||p.date>today()||!Number.isSafeInteger(p.cents)||p.cents<=0||!Array.isArray(p.allocations)||!p.allocations.length)throw Error('Confira pessoa, data, conta e valor do Pix.');
 if(!p.inBaseline&&r.baseline&&p.date<=r.baseline.date)throw Error('Este Pix é anterior ao saldo de partida ou do mesmo dia. Marque que ele já estava no saldo.');
 if(r.receipts.some(x=>x.id===p.id))throw Error('Este recebimento já está registrado.');
 const debts=reconDebt(s).filter(d=>reconPersonKey(d.person)===reconPersonKey(person));
 const keys=new Set();
 let total=0;
 for(const a of p.allocations){
  const k=a.month+'|'+a.rowId;
  const d=debts.find(x=>x.month===a.month&&x.rowId===a.rowId);
  if(keys.has(k)||!d||!Number.isSafeInteger(a.cents)||a.cents<=0||a.cents>d.remaining)throw Error('Confira os valores distribuídos. Eles não podem exceder a dívida.');
  keys.add(k);total+=a.cents;
 }
 if(total!==p.cents)throw Error('Distribua todo o valor do Pix antes de salvar.');
 r.receipts.push({...p,id:p.id||newId(),person,inBaseline:!!p.inBaseline});
}
function reconDeleteReceipt(s,id){
 const r=s.reconciliation;
 if(!r?.receipts?.some(p=>p.id===id))throw Error('Recebimento não encontrado.');
 r.receipts=r.receipts.filter(p=>p.id!==id);
}
function reconPayment(s,m){return s.reconciliation?.payments?.find(x=>x.month===m)??null}
function reconMarkPaid(s,m,date){
 if(!s.reconciliation?.statements?.some(st=>st.month===m))throw Error('Importe a fatura antes de confirmar o pagamento.');
 if(date!==null&&(!isDate(date)||date>today()))throw Error('Informe uma data de pagamento até hoje.');
 const r=s.reconciliation;
 r.payments=(r.payments??[]).filter(x=>x.month!==m);
 if(date!==null)r.payments.push({month:m,date});
}
function reconInvoice(s,m){
 if(!s.reconciliation?.statements?.some(st=>st.month<=m))return null;
 return Math.max(0,reconRawRows(s,m).reduce((sum,x)=>sum+(x.kind==='prior-payment'?0:x.cents),0))/100;
}
function reconOpening(s){
 const b=s.reconciliation?.baseline;
 return b?{date:b.date,amount:b.accounts.reduce((z,a)=>z+a.cents,0)/100,closing:true}:s.opening;
}
function reconCashReceipts(s,start,end){
 return (s.reconciliation?.receipts??[]).filter(r=>!r.inBaseline&&r.date>=start&&r.date<=end).reduce((z,r)=>z+r.cents,0)/100;
}
function reconFixed(s,m){
 const st=s.reconciliation?.statements?.find(x=>x.month===m);
 const links=new Set(st?.rows.flatMap(x=>x.legacyIds??[])??[]);
 return activeFixed(s,m).filter(x=>!links.has(x.id));
}

function defaultCardMonth(d=today()){
 const m=d.slice(0,7);
 return Number(d.slice(-2))<5?m:shiftMonth(m,1);
}
function reconHasAllocated(s,id){
 return (s.reconciliation?.receipts??[]).some(r=>r.allocations.some(a=>a.rowId===id));
}
