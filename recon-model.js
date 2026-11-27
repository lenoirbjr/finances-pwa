'use strict';
/* diario-shell:4.0.37 */
// Conciliação local. Trabalha com centavos inteiros e nunca antecipa reembolso.
function reconInit(s){return s.reconciliation ||= {statements:[],bankRows:[],receipts:[],overrides:[],payments:[]}}
function reconValidate(r){
 if(r===undefined)return true;
 const arr=(x,n)=>Array.isArray(x)&&x.length<=n, str=(x,n=180)=>typeof x==='string'&&x.trim().length>0&&x.length<=n;
 const cent=x=>Number.isSafeInteger(x)&&Math.abs(x)<=1e12, pos=x=>cent(x)&&x>0;
 const parts=p=>arr(p,50)&&p.every(x=>x&&str(x.person,100)&&pos(x.cents)&&(x.expected===undefined||isDate(x.expected)))&&new Set(p.map(x=>reconPersonKey(x.person))).size===p.length;
 const unique=(a,fn)=>new Set(a.map(fn)).size===a.length;
 if(!r||!arr(r.statements,120)||!arr(r.bankRows,30000)||!arr(r.receipts,10000)||!arr(r.overrides,20000)||!arr(r.payments??[],120))return false;
 if(r.cardRefunds!==undefined&&(!arr(r.cardRefunds,5000)||!r.cardRefunds.every(x=>x&&str(x.id)&&str(x.name,120)&&isDate(x.date)&&isMonth(x.month)&&pos(x.cents)&&Number.isSafeInteger(x.enteredAt)&&x.enteredAt>0)||!unique(r.cardRefunds,x=>x.id)))return false;
 if(r.bankCreditEdits!==undefined&&(!arr(r.bankCreditEdits,5000)||!r.bankCreditEdits.every(x=>x&&isMonth(x.month)&&str(x.rowId)&&str(x.name,250)&&isDate(x.date)&&pos(x.cents))||!unique(r.bankCreditEdits,x=>x.month+'|'+x.rowId)))return false;
 if(r.excludedLines!==undefined&&(!arr(r.excludedLines,30000)||!r.excludedLines.every(x=>x&&isMonth(x.month)&&str(x.rowId))||!unique(r.excludedLines,x=>x.month+'|'+x.rowId)))return false;
 if(r.singleChargeEdits!==undefined&&(!arr(r.singleChargeEdits,10000)||!r.singleChargeEdits.every(x=>x&&isMonth(x.month)&&str(x.rowId)&&pos(x.cents))||!unique(r.singleChargeEdits,x=>x.month+'|'+x.rowId)))return false;
 if(r.creditTags!==undefined&&(!arr(r.creditTags,10000)||!r.creditTags.every(x=>x&&isMonth(x.month)&&str(x.rowId)&&str(x.tag,100))||!unique(r.creditTags,x=>x.month+'|'+x.rowId)))return false;
 if(r.installmentAdjustments!==undefined&&(!arr(r.installmentAdjustments,5000)||!r.installmentAdjustments.every(x=>x&&str(x.id)&&str(x.rowId)&&str(x.key,900)&&str(x.name,250)&&isMonth(x.month)&&cent(x.cents)&&x.cents>=0&&Number.isInteger(x.count)&&x.count>0&&x.count<=240)||!unique(r.installmentAdjustments,x=>x.id)))return false;
 if(r.baseline!==undefined){
  const b=r.baseline;
  if(!b||!isDate(b.date)||!arr(b.accounts,25)||!b.accounts.length||!b.accounts.every(a=>a&&str(a.id,80)&&str(a.name,100)&&cent(a.cents))||!unique(b.accounts,x=>x.id))return false;
 }
 const classification=(x,total)=>{const p=x.parts??[];if(!parts(p))return false;const n=p.reduce((a,z)=>a+z.cents,0);return x.label==='other'?n===total:x.label==='split'?n>0&&n<total:(!x.label||x.label==='mine')&&n===0};
 if(r.confirmedTotals!==undefined&&(!r.confirmedTotals||typeof r.confirmedTotals!=='object'||Array.isArray(r.confirmedTotals)||Object.entries(r.confirmedTotals).length>240||!Object.entries(r.confirmedTotals).every(([m,n])=>isMonth(m)&&cent(n)&&n>=0)))return false;
 if(!r.statements.every(st=>st&&isMonth(st.month)&&(st.closed===undefined||typeof st.closed==='boolean')&&(st.snapshotAt===undefined||(Number.isSafeInteger(st.snapshotAt)&&st.snapshotAt>0))&&arr(st.rows,5000)&&st.rows.every(x=>x&&str(x.id)&&str(x.name,250)&&isDate(x.date)&&cent(x.cents)&&(['charge','credit','prior-payment'].includes(x.kind))&&(x.kind==='charge'?x.cents>0:x.cents<0)&&classification(x,Math.abs(x.cents))&&(x.kind==='charge'||!x.label)&&(x.legacyIds===undefined||(arr(x.legacyIds,10)&&x.legacyIds.every(x=>str(x))))&&((x.number===undefined&&x.count===undefined)||(Number.isInteger(x.number)&&Number.isInteger(x.count)&&1<=x.number&&x.number<=x.count&&x.count<=240)))&&unique(st.rows,x=>x.id))||!unique(r.statements,x=>x.month))return false;
 if(!r.bankRows.every(x=>x&&str(x.id)&&str(x.name,300)&&isDate(x.date)&&typeof x.time==='string'&&/^\d{2}:\d{2}:\d{2}$/.test(x.time)&&cent(x.cents)&&cent(x.balanceCents))||!unique(r.bankRows,x=>x.id))return false;
 if(!r.overrides.every(x=>x&&isMonth(x.month)&&str(x.rowId)&&['one','future','all'].includes(x.scope)&&pos(x.basis)&&classification(x,x.basis)&&(x.name===undefined||str(x.name,250))&&(x.ownerName===undefined||str(x.ownerName,100))&&(x.seriesKey===undefined||str(x.seriesKey,500)))||!unique(r.overrides,x=>x.month+'|'+x.rowId+'|'+x.scope))return false;
 if(!(r.payments??[]).every(x=>x&&isMonth(x.month)&&isDate(x.date))||!unique(r.payments??[],x=>x.month))return false;
 return r.receipts.every(x=>x&&str(x.id)&&isDate(x.date)&&(x.accountId===undefined||str(x.accountId,80))&&str(x.person,100)&&pos(x.cents)&&typeof x.inBaseline==='boolean'&&arr(x.allocations,500)&&x.allocations.length>0&&x.allocations.every(a=>a&&str(a.rowId)&&isMonth(a.month)&&pos(a.cents))&&unique(x.allocations,a=>a.month+'|'+a.rowId)&&x.allocations.reduce((a,z)=>a+z.cents,0)===x.cents)&&unique(r.receipts,x=>x.id);
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
 return scaled.filter(x=>x.person&&x.cents>0).map(({person,cents,i})=>({person,cents,...(inputs[i].expected?{expected:inputs[i].expected}:{})}));
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
   const key=JSON.stringify([x.date,merchant,reconPersonKey(x.source?.Portador),x.count,x.cents,shiftMonth(st.month,1-x.number)]);
   const n=duplicates.get(key)??0;duplicates.set(key,n+1);
   seriesKey='csv:'+key+':'+n;
  }
  return {...x,seriesKey,source:'statement'};
 });
}
// Link rounded installments only when the statement history has one unambiguous
// purchase candidate (including the cardholder) and amounts differ by one cent.
function reconStatementLinks(statements,receipts){
 const buckets=new Map(), normalized=new Map(), groups=new Map(), ambiguous=new Set();
 for(const st of statements){
  const rows=reconStatementRows(st);
  normalized.set(st.month,rows);
  for(const x of rows){
   if(statements.length<2||!x.seriesKey)continue;
   const key=JSON.stringify([x.date,reconPersonKey(x.source?.Estabelecimento||x.name),
    reconPersonKey(x.source?.Portador),x.count,shiftMonth(st.month,1-x.number)]);
   if(!buckets.has(key))buckets.set(key,[]);
   buckets.get(key).push(x);
  }
 }
 if(!buckets.size)return {normalized,groups,ambiguous};
 const pins=new Map();
 for(const p of receipts)for(const a of p.allocations){
  if(!pins.has(a.rowId))pins.set(a.rowId,new Set());
  pins.get(a.rowId).add(a.month);
 }
 for(const rows of buckets.values()){
  if(rows.length<2)continue;
  const cents=rows.map(x=>x.cents);
  if(Math.max(...cents)-Math.min(...cents)!==1)continue;
  if(new Set(rows.map(x=>x.number)).size!==rows.length){for(const x of rows)ambiguous.add(x);continue;}
  const pinned=new Map();
  let conflict=false;
  for(const x of rows)for(const month of pins.get(x.id)??[]){
   if(pinned.has(month)&&pinned.get(month)!==x.id)conflict=true;
   pinned.set(month,x.id);
  }
  if(conflict){for(const x of rows)ambiguous.add(x);continue;}
  const aliases=[...new Set(rows.map(x=>x.seriesKey))].sort();
  const group={key:aliases[0],aliases,pinned,byId:new Map(rows.map(x=>[x.id,x]))};
  for(const x of rows)groups.set(x,group);
 }
 return {normalized,groups,ambiguous};
}
function reconLinkedSeries(row,key){return reconSeriesId(row)===key||row.seriesAliases?.includes(key)}
function reconRecurringCardRows(s,m,imported=[]){
 if(reconPayment(s,m))return [];
 const exactName=v=>String(v??'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g,'');
 const items=activeFixed(s,m).filter(x=>x.channel==='card'&&x.amount>0);
 const links=e=>imported.filter(r=>r.id==='recurring:'+e.id||r.legacyIds?.includes('recurring:'+e.id)||r.legacyIds?.includes(e.id));
 const linked=new Map(items.map(e=>[e.id,links(e)])),used=new Set([...linked.values()].flat());
 const claims=new Map();
 const key=(kind,cents,name)=>JSON.stringify([kind,cents,exactName(name)]);
 for(const row of imported){
  if(row.count>1||used.has(row))continue;
  const k=key(row.kind,row.cents,row.name);
  claims.set(k,(claims.get(k)??0)+1);
 }
 return items.flatMap(e=>{
  const id='recurring:'+e.id,kind=e.direction==='in'?'credit':'charge';
  const cents=Math.round(e.amount*100)*(kind==='credit'?-1:1);
  if(linked.get(e.id).length)return [];
  const k=key(kind,cents,e.name),available=claims.get(k)??0;
  if(available&&exactName(e.name)){claims.set(k,available-1);return [];}
  return [{id,name:e.name,date:fixedDate(s,e,m),cents,kind,source:'recurring-card',recurringTag:e.tag}];
 });
}
function reconUnadjustedRows(s,m){
 const statements=s.reconciliation?.statements??[];
 const {normalized,groups,ambiguous}=reconStatementLinks(statements,s.reconciliation?.receipts??[]);
 const rowWithSeries=x=>{const g=groups.get(x);return g?{...x,seriesKey:g.key,seriesAliases:g.aliases}:ambiguous.has(x)?{...x,forecastKey:x.seriesKey,seriesKey:undefined}:x};
 const exact=statements.find(x=>x.month===m);
 // A manually entered installment can predate its first CSV appearance.
 // Share the series for classification only when an explicit link is unambiguous.
 const manualSeries=new Map(),manualIds=new Set(s.parcels.map(p=>p.id));
 for(const rows of normalized.values())for(const raw of rows){
  if(raw.kind!=='charge'||raw.cents<=0)continue;
  const ids=[raw.id,...(raw.legacyIds??[])].filter(id=>manualIds.has(id));
  if(!ids.length)continue;
  const key=reconSeriesId(rowWithSeries(raw));
  for(const id of ids){
   if(!manualSeries.has(id))manualSeries.set(id,new Set());
   manualSeries.get(id).add(key);
  }
 }
 const refunds=(s.reconciliation?.cardRefunds??[]).filter(x=>x.month===m&&(!exact?.snapshotAt||x.enteredAt>exact.snapshotAt)).map(x=>({...x,cents:-x.cents,kind:'credit',source:'manual-refund'}));
 const manualRows=linked=>s.parcels.flatMap(e=>{
  if(e.payTo||(exact?.snapshotAt&&!(e.cardEnteredAt>exact.snapshotAt)))return [];
  const cents=Math.round(newPartAmount(e,m)*100),series=manualSeries.get(e.id);
  if(linked.has(e.id)||cents<=0)return [];
  const linkedSeries=series?.size===1?[...series][0]:null;
  return [{id:e.id,name:e.name,date:e.purchaseDate??eventDate(e.start,5),cents,kind:'charge',count:e.count,number:monthDiff(e.start,m)+1,source:'manual',...(linkedSeries?{seriesKey:linkedSeries,seriesAliases:['id:'+e.id]}:{})}];
 });
 if(exact){
  const imported=normalized.get(m).map(rowWithSeries);
  if(exact.closed===true)return imported;
  const linked=new Set(imported.flatMap(x=>[x.id,...(x.legacyIds??[])]));
  // A known CSV series can carry a local association from a different statement.
  // Do not guess from name or amount: different purchases may look identical.
  const keys=new Set(imported.filter(x=>x.seriesKey).map(reconSeriesId));
  if(keys.size)for(const rows of normalized.values())for(const raw of rows){
   const x=rowWithSeries(raw);
   if(x.seriesKey&&keys.has(reconSeriesId(x)))for(const id of x.legacyIds??[])linked.add(id);
  }
  return [...imported,...manualRows(linked),...refunds,...reconRecurringCardRows(s,m,imported)];
 }
 const prior=statements.filter(x=>x.month<m).sort((a,b)=>b.month.localeCompare(a.month));
 const covered=new Set(), projected=[], seen=new Set();
 for(const st of prior){
  const off=monthDiff(st.month,m);
  for(const raw of normalized.get(st.month)){
   const x=rowWithSeries(raw);
   if(x.kind!=='charge'||!x.count)continue;
   const aliases=[x.id,...(x.legacyIds??[])];
   const key=x.forecastKey??reconSeriesId(x);
   const group=groups.get(raw);
   for(const id of aliases)covered.add(id);
   if(seen.has(key))continue;
   seen.add(key);
   if(x.number+off<=x.count){
    const pinned=group?.byId.get(group.pinned.get(m));
    projected.push({...x,...(pinned&&{id:pinned.id,cents:pinned.cents,label:pinned.label,parts:pinned.parts}),number:x.number+off,source:'forecast'});
   }
  }
 }
 for(const e of oldParts(s,m))if(!covered.has(e.id))projected.push({id:e.id,name:e.name,date:eventDate(e.start,5),cents:Math.round(e.payment*100),kind:'charge',count:e.remaining,number:monthDiff(e.start,m)+1,source:'legacy'});
 return [...projected,...manualRows(covered),...refunds,...reconRecurringCardRows(s,m)];
}
// Ajustes locais só atuam em projeções e faturas ainda em aberto.
function reconCanAdjustMonth(s,m){
 return !s.reconciliation?.statements?.some(x=>x.month===m&&x.closed===true)&&!reconPayment(s,m);
}
function reconAdjustmentKey(r){return r.forecastKey?'id:'+r.id:reconSeriesId(r)}
function reconAdjustmentMatches(r,x){
 return r.id===x.rowId||(!r.forecastKey&&(reconSeriesId(r)===x.key||r.seriesAliases?.includes(x.key)));
}
function reconRawRows(s,m){
 const adjustments=s.reconciliation?.installmentAdjustments??[];
 const credits=new Map((s.reconciliation?.bankCreditEdits??[]).filter(x=>x.month===m).map(x=>[x.rowId,x]));
 const excluded=new Set((s.reconciliation?.excludedLines??[]).filter(x=>x.month===m).map(x=>x.rowId));
 const rows=reconUnadjustedRows(s,m).filter(x=>!excluded.has(x.id)).map(r=>{
  const x=credits.get(r.id);
  return x&&r.source==='statement'&&(r.kind==='credit'||r.kind==='prior-payment')?{...r,name:x.name,date:x.date,cents:-x.cents,bankEdited:true,originalCents:r.cents}:r;
 });
 const singles=new Map((s.reconciliation?.singleChargeEdits??[]).filter(x=>x.month===m).map(x=>[x.rowId,x.cents]));
 const applicable=reconCanAdjustMonth(s,m)?adjustments.filter(x=>x.month<=m):[];
 if(!applicable.length&&!singles.size)return rows;
 return rows.flatMap(r=>{
  if(r.kind!=='charge')return [r];
  const series=r.count&&r.number?applicable.filter(rule=>reconAdjustmentMatches(r,rule)):[];
  if(series.some(rule=>rule.cents===0))return [];
  const x=series.reduce((best,rule)=>!best||rule.month>=best.month?rule:best,null);
  const amount=singles.get(r.id)??x?.cents;
  if(amount===undefined)return [r];
  const parts=reconScale(r.parts,r.label,r.cents,amount);
  const label=parts.length?(parts.reduce((n,p)=>n+p.cents,0)===amount?'other':'split'):r.label==='mine'?'mine':undefined;
  return [{...r,cents:amount,label,parts,adjusted:true,singleEdited:singles.has(r.id),originalCents:r.cents}];
 });
}
function reconGuardAdjustment(s,change,field='installmentAdjustments'){
 const before=reconDebt(s).filter(x=>x.received>0),key=x=>JSON.stringify([x.month,x.rowId,reconPersonKey(x.person)]);
 const recon=reconInit(s),old=recon[field];
 recon[field]=change(old??[]);
 try{
  const after=new Map(reconDebt(s).filter(x=>x.received>0).map(x=>[key(x),x]));
  if(before.some(x=>{const z=after.get(key(x));return !z||z.received!==x.received||(z.cents<x.cents&&z.cents<x.received)}))throw Error('Há Pix vinculado a esta parcela. O ajuste não pode remover o vínculo nem deixar o valor devido abaixo do que já foi recebido.');
 }catch(err){if(old===undefined)delete recon[field];else recon[field]=old;throw err;}
}
function reconSetInstallmentAdjustment(s,m,id,amount){
 if(!isMonth(m)||!Number.isSafeInteger(amount)||amount<0||amount>1e12)throw Error('Informe um valor válido para a parcela.');
 if(!reconCanAdjustMonth(s,m))throw Error('Não é possível alterar uma fatura fechada ou paga.');
 const hits=reconUnadjustedRows(s,m).filter(x=>x.id===id&&x.kind==='charge'&&x.count&&x.number);
 if(hits.length!==1)throw Error('Não foi possível identificar uma única parcela para ajustar.');
 const row=hits[0],label=reconRows(s,m).find(x=>x.id===id)?.name??row.name;
 reconGuardAdjustment(s,a=>[...a.filter(x=>x.month!==m||!reconAdjustmentMatches(row,x)),{id:newId(),rowId:id,key:reconAdjustmentKey(row),name:label,month:m,cents:amount,count:row.count}]);
}
function reconUndoInstallmentAdjustment(s,id){
 if(!s.reconciliation?.installmentAdjustments?.some(x=>x.id===id))throw Error('Ajuste não encontrado.');
 reconGuardAdjustment(s,a=>a.filter(x=>x.id!==id));
}
function reconSetChargeAmount(s,m,id,cents){
 if(!isMonth(m)||!Number.isSafeInteger(cents)||cents<0||cents>1e12)throw Error('Informe um valor válido.');
 const row=reconUnadjustedRows(s,m).filter(x=>x.id===id&&x.kind==='charge');
 if(row.length!==1)throw Error('Lançamento não encontrado.');
 if(reconCanAdjustMonth(s,m)&&row[0].count>1)return reconSetInstallmentAdjustment(s,m,id,cents);
 if(cents<=0)throw Error('Informe um valor positivo.');
 reconGuardAdjustment(s,a=>[...a.filter(x=>x.month!==m||x.rowId!==id),...(cents===row[0].cents?[]:[{month:m,rowId:id,cents}])],'singleChargeEdits');
}
function reconExcludeInvoiceLine(s,m,id){
 const visible=reconRows(s,m).filter(x=>x.id===id);
 if(visible.length!==1)throw Error('Lançamento não encontrado.');
 const row=visible[0];
 if(row.kind==='charge'&&row.count>1&&row.number&&reconCanAdjustMonth(s,m))return reconSetInstallmentAdjustment(s,m,id,0);
 reconGuardAdjustment(s,a=>[...a,{month:m,rowId:id}],'excludedLines');
}
function reconRestoreChargeAmount(s,m,id){
 reconGuardAdjustment(s,a=>a.filter(x=>x.month!==m||x.rowId!==id),'singleChargeEdits');
}
function reconSetCreditTag(s,m,id,value){
 const hit=reconUnadjustedRows(s,m).find(x=>x.id===id&&(x.kind==='credit'||x.kind==='prior-payment'));
 if(!hit)throw Error('Lançamento não encontrado.');
 const tag=String(value??'').trim().normalize('NFC');
 if(tag.length>100)throw Error('Use até 100 caracteres na etiqueta.');
 const r=reconInit(s);
 r.creditTags=[...(r.creditTags??[]).filter(x=>x.month!==m||x.rowId!==id),...(tag?[{month:m,rowId:id,tag}]:[])];
}
function reconRows(s,m,includePreviousCredit=false){
 const overrides=s.reconciliation?.overrides??[];
 const rows=reconRawRows(s,m),creditTags=new Map((s.reconciliation?.creditTags??[]).filter(x=>x.month===m).map(x=>[x.rowId,x.tag]));
 return (includePreviousCredit?[...rows,...reconPreviousCreditRows(s,m)]:rows).map(row=>{
  if(row.kind!=='charge')return creditTags.has(row.id)?{...row,creditTag:creditTags.get(row.id)}:row;
  const exact=overrides.find(o=>o.rowId===row.id&&o.month===m&&o.scope==='one')??overrides.find(o=>o.rowId===row.id&&o.month===m&&o.scope==='future');
  const earlier=overrides.filter(o=>o.rowId===row.id&&o.scope==='future'&&o.month<m).sort((a,b)=>b.month.localeCompare(a.month))[0];
  const all=overrides.find(o=>o.scope==='all'&&(reconLinkedSeries(row,o.seriesKey)||o.rowId===row.id));
  const o=exact??all??earlier;
  if(!o)return row;
  const parts=reconScale(o.parts,o.label,o.basis,row.cents);
  const label=parts.length?(parts.reduce((a,p)=>a+p.cents,0)===row.cents?'other':'split'):o.label?'mine':undefined;
  const name=o.name??earlier?.name??row.name;
  return {...row,label,parts,name,ownerName:o.ownerName,originalName:name===row.name?undefined:row.name};
 });
}
// Pick an explicitly linked statement line over its local planning alias.
function reconParcelTarget(s,id,monthRows=new Map()){
 const rowsAt=month=>{
  if(!monthRows.has(month))monthRows.set(month,reconRows(s,month));
  return monthRows.get(month);
 };
 const item=s.parcels.find(e=>e.id===id&&!e.payTo);
 if(!item)return null;
 const statements=[...(s.reconciliation?.statements??[])].sort((a,b)=>a.month.localeCompare(b.month));
 const linked=[];
 for(const st of statements){
   if(!st.rows.some(x=>x.id===id||x.legacyIds?.includes(id)))continue;
   const candidates=rowsAt(st.month).filter(r=>r.kind==='charge'&&r.cents>0&&(r.id===id||r.legacyIds?.includes(id)));
   if(candidates.length>1)return null;
   if(candidates.length===1)linked.push({month:st.month,row:candidates[0]});
 }
 if(linked.length)return new Set(linked.map(x=>reconSeriesId(x.row))).size===1?linked[0]:null;
 for(let n=0;n<item.count;n++){
   const month=shiftMonth(item.start,n),row=rowsAt(month).find(r=>r.kind==='charge'&&r.cents>0&&r.id===id);
   if(row)return {month,row};
 }
 return null;
}
function reconMonths(s){
 const r=s.reconciliation;
 const cur=monthNow();
 const m=new Set([cur,shiftMonth(cur,1)]);
 for(const item of s.fixedItems){
  if(item.channel!=='card')continue;
  for(let i=0;i<12;i++){const month=shiftMonth(cur,i);if(item.start<=month&&(!item.end||item.end>=month))m.add(month);}
  m.add(item.start);if(item.end)m.add(item.end);
 }
 for(const x of r?.cardRefunds??[])m.add(x.month);
 for(const st of r?.statements??[]){m.add(st.month);for(const row of st.rows)if(row.count>row.number){for(let i=1;i<=row.count-row.number;i++)m.add(shiftMonth(st.month,i))}}
 for(const x of s.expenses)if(x.cardMonth)m.add(x.cardMonth);
 for(const o of r?.overrides??[])m.add(o.month);
 for(const p of r?.receipts??[])for(const a of p.allocations)m.add(a.month);
 for(const e of [...s.parcels,...s.baseParcels])for(let i=0;i<(e.count??e.remaining);i++){const a=shiftMonth(e.start,i);m.add(a)}
 return [...m].sort();
}
function reconNamedPix(item){
 return item.direction==='in'&&item.channel!=='card'&&Boolean(item.tag?.trim())&&item.amount>0;
}
function reconRecurringReceivables(s,asOf=today()){
 const current=asOf.slice(0,7),last=shiftMonth(current,2),opening=reconOpening(s)?.date??null;
 const fixedPayments=s.fixedPaid??[],allocations=(s.reconciliation?.receipts??[]).flatMap(r=>r.allocations);
 const startFloor=[opening?.slice(0,7)??current,shiftMonth(current,-23)].sort().at(-1);
 const rows=[];
 for(const item of s.fixedItems.filter(reconNamedPix)){
  const rowId='fixedpix:'+item.id, recorded=new Set(allocations.filter(a=>a.rowId===rowId).map(a=>a.month));
  const first=[startFloor,item.start].sort().at(-1),months=new Set(recorded);
  for(let month=first;month<=last&&(!item.end||month<=item.end);month=shiftMonth(month,1))months.add(month);
  for(const month of months){
   const date=fixedDate(s,item,month);
   if(!recorded.has(month)&&(opening&&date<=opening||!opening&&date<asOf))continue;
   if(fixedPayments.some(p=>p.id===item.id&&p.month===month))continue;
   rows.push({rowId,month,person:item.tag.trim(),cents:Math.round(item.amount*100),expected:date,
    name:item.name,fixedId:item.id,recurring:true});
  }
 }
 return rows;
}
function reconFixedCommitments(s,month){
 const pixIds=new Set(reconFixed(s,month).map(item=>item.id));
 return activeFixed(s,month).filter(item=>item.direction!=='in'&&item.amount>0&&(item.channel==='card'||pixIds.has(item.id)))
  .map(item=>({id:item.id,person:item.tag?.trim()??'',name:item.name,cents:Math.round(item.amount*100),
    channel:item.channel==='card'?'card':'pix',date:confirmedFixed(s,item.id,month)?.date??fixedDate(s,item,month)}))
  .sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name,'pt-BR'));
}
function reconDebt(s){
 const received=new Map();
 for(const p of s.reconciliation?.receipts??[])for(const a of p.allocations){
  const k=a.month+'|'+a.rowId+'|'+reconPersonKey(p.person);
  received.set(k,(received.get(k)??0)+a.cents);
 }
 const billed=reconMonths(s).flatMap(month=>reconRows(s,month,true).flatMap(row=>(row.parts??[]).map(part=>({
  rowId:row.id,month,person:part.person,cents:part.cents,expected:part.expected,name:row.name,number:row.number,count:row.count
 }))));
 return [...billed,...reconRecurringReceivables(s)].map(d=>{
  const n=received.get(d.month+'|'+d.rowId+'|'+reconPersonKey(d.person))??0;
  return {...d,received:n,remaining:Math.max(0,d.cents-n)};
 });
}
function reconSetLabel(s,month,rowId,label,parts,scope,name,ownerName){
 const row=reconRows(s,month,true).find(x=>x.id===rowId&&x.kind==='charge');if(!row)throw Error('Lançamento não encontrado.');
 const r=reconInit(s);
 let p=(parts??[]).map(x=>({person:x.person.trim().normalize('NFC'),cents:x.cents,...(x.expected?{expected:x.expected}:{})}));
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
  const target=[...reconRawRows(s,d.month),...reconPreviousCreditRows(s,d.month)].find(t=>t.id===d.rowId);
  if(!target||!touches(target,d.rowId,d.month))continue;
  const capacity=reconScale(p,label,row.cents,target.cents).find(x=>reconPersonKey(x.person)===reconPersonKey(d.person))?.cents;
  if((capacity??0)<d.received)throw Error('Já há um Pix vinculado. Mantenha o valor recebido no rateio ou ajuste o Pix antes.');
 }
 if(scope==='all')r.overrides=r.overrides.filter(x=>!related.has(x.rowId)&&!reconLinkedSeries(row,x.seriesKey));
 else if(scope==='future')r.overrides=r.overrides.filter(x=>x.rowId!==rowId||x.month<month);
 else r.overrides=r.overrides.filter(x=>x.rowId!==rowId||x.month!==month||x.scope!=='one');
 r.overrides.push({month,rowId,label:label||null,scope,basis:row.cents,parts:p,...(editedName?{name:editedName}:{}),...(editedOwner?{ownerName:editedOwner}:{}),...(scope==='all'?{seriesKey}:{})});
}
function reconAddReceipt(s,p){
 const r=reconInit(s);
 const person=String(p.person??'').trim();
 if((p.accountId!==undefined&&!reconAccounts(s).some(a=>a.id===p.accountId))||!person||!isDate(p.date)||p.date>today()||!Number.isSafeInteger(p.cents)||p.cents<=0||!Array.isArray(p.allocations)||!p.allocations.length)throw Error('Confira a pessoa, a data e o valor do Pix.');
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
 const recon=s.reconciliation,hasStatements=recon?.statements?.some(st=>st.month<=m);
 if(!hasStatements&&!activeFixed(s,m).some(x=>x.channel==='card'&&x.amount>0)&&!recon?.installmentAdjustments?.some(x=>x.month<=m)&&!recon?.cardRefunds?.some(x=>x.month===m)&&!recon?.singleChargeEdits?.some(x=>x.month===m)&&!recon?.excludedLines?.some(x=>x.month===m))return null;
 const useLegacy=!hasStatements&&s.mode==='legacy',legacy=useLegacy?Math.round((s.legacyInvoices[m]??0)*100):0;
 const rows=reconRawRows(s,m);
 const legacyDetail=useLegacy?reconUnadjustedRows(s,m).filter(x=>x.source==='legacy').reduce((n,x)=>n+x.cents,0):0;
 return Math.max(0,legacy-legacyDetail+rows.reduce((sum,x)=>sum+(x.kind==='prior-payment'?0:x.cents),0))/100;
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
 return activeFixed(s,m).filter(x=>x.channel!=='card'&&!links.has(x.id)&&(!reconNamedPix(x)||confirmedFixed(s,x.id,m)));
}

function defaultCardMonth(d=today()){
 const m=d.slice(0,7);
 return Number(d.slice(-2))<5?m:shiftMonth(m,1);
}
function reconHasAllocated(s,id){
 return (s.reconciliation?.receipts??[]).some(r=>r.allocations.some(a=>a.rowId===id));
}

// Compras no cartão de outra pessoa não entram na nossa fatura. A parcela
// prevista e sua baixa são o mesmo compromisso, não dois lançamentos.
function reconPayableValid(p){
 if(p.payTo===undefined)return p.payStart===undefined&&p.payments===undefined;
 if(typeof p.payTo!=='string'||!p.payTo.trim()||p.payTo.length>100||!isDate(p.payStart)||p.payStart.slice(0,7)!==p.start)return false;
 const payments=p.payments??[];
 return Array.isArray(payments)&&payments.length<=p.count&&new Set(payments.map(x=>x?.month)).size===payments.length&&payments.every(x=>x&&isMonth(x.month)&&monthDiff(p.start,x.month)>=0&&monthDiff(p.start,x.month)<p.count&&(x.parts===undefined?isDate(x.date):Array.isArray(x.parts)&&x.parts.length>0
  &&new Set(x.parts.map(a=>a?.batch)).size===x.parts.length
  &&x.parts.every(a=>a&&typeof a.batch==='string'&&a.batch.length>0&&a.batch.length<=100&&isDate(a.date)&&Number.isSafeInteger(a.cents)&&a.cents>0)
  &&x.parts.reduce((n,a)=>n+a.cents,0)<=Math.round(newPartAmount(p,x.month)*100)));
}
function reconParcelLinked(s,id){
 return (s.reconciliation?.statements??[]).some(st=>st.rows.some(x=>x.kind==='charge'&&(x.id===id||x.legacyIds?.includes(id))));
}
function reconPayableRows(s,month=null){
 const result=[];
 for(const p of s.parcels){
  if(!p.payTo)continue;
  const offset=month===null?0:monthDiff(p.start,month);
  if(offset<0||offset>=p.count)continue;
  for(let i=offset;i<(month===null?p.count:offset+1);i++){
   const m=shiftMonth(p.start,i),cents=Math.round(newPartAmount(p,m)*100);
   if(cents<=0)continue;
   const due=eventDate(m,Number(p.payStart.slice(-2))),entry=p.payments?.find(x=>x.month===m);
   const postings=entry?.parts??(entry?[{date:entry.date,cents}]:[]);
   const paid=postings.reduce((n,x)=>n+x.cents,0),remaining=cents-paid;
   const latest=postings.at(-1),paidDate=remaining===0?postings.map(x=>x.date).sort().at(-1):null;
   result.push({id:p.id,person:p.payTo,name:p.name,month:m,due,date:paidDate??due,cents,paidDate,paid,remaining,postings,latest,number:i+1,count:p.count});
  }
 }
 return result.sort((a,b)=>a.due.localeCompare(b.due)||a.person.localeCompare(b.person,'pt-BR'));
}
function reconSetPayable(s,id,month,date){
 const p=s.parcels.find(x=>x.id===id&&x.payTo);
 if(!p||!isMonth(month)||newPartAmount(p,month)<=0)throw Error('Parcela não encontrada.');
 if(date!==null&&(!isDate(date)||date>today()))throw Error('Informe a data em que o Pix foi pago, até hoje.');
 const prev=p.payments?.find(x=>x.month===month);
 if(prev?.parts)throw Error('Desfaça pelo registro de pagamento.');
 if(date!==null&&prev)throw Error('Esta parcela já está paga.');
 p.payments=(p.payments??[]).filter(x=>x.month!==month);
 if(date!==null)p.payments.push({month,date});
}

function reconPayableEvents(s){
 return reconPayableRows(s).flatMap(row=>[
  ...row.postings.map(p=>({...row,cents:p.cents,date:p.date,paidDate:p.date})),
  ...(row.remaining?[{...row,cents:row.remaining,date:row.due,paidDate:null}]:[])
 ]);
}
function reconAddPayablePayment(s,p,existingBatch){
 const person=String(p.person??'').trim();
 if(!person||!isDate(p.date)||p.date>today()||!Number.isSafeInteger(p.cents)||p.cents<=0||!Array.isArray(p.allocations)||!p.allocations.length)throw Error('Confira a pessoa, a data e o valor do pagamento.');
 const key=(id,month)=>JSON.stringify([id,month]);
 const eligible=new Map(reconPayableRows(s).filter(x=>x.remaining>0&&reconPersonKey(x.person)===reconPersonKey(person)).map(x=>[key(x.id,x.month),x]));
 const entries=[];
 for(const a of p.allocations){
  const k=key(a.rowId,a.month), row=eligible.get(k);
  if(!row||!Number.isSafeInteger(a.cents)||a.cents<=0||a.cents>row.remaining)throw Error('Confira os valores distribuídos. Eles não podem exceder as dívidas.');
  eligible.delete(k);entries.push(a);
 }
 if(entries.reduce((n,a)=>n+a.cents,0)!==p.cents)throw Error('Distribua todo o valor do pagamento antes de salvar.');
 const batch=existingBatch??newId();
 for(const a of entries){
  const parcel=s.parcels.find(x=>x.id===a.rowId);
  parcel.payments??=[];
  let entry=parcel.payments.find(x=>x.month===a.month);
  if(!entry){entry={month:a.month,parts:[]};parcel.payments.push(entry);}
  entry.parts.push({batch,date:p.date,cents:a.cents});
 }
}
function reconUndoPayablePayment(s,batch){
 let found=false;
 for(const parcel of s.parcels){
  if(!parcel.payments?.some(e=>e.parts?.some(x=>x.batch===batch)))continue;
  found=true;
  for(const e of parcel.payments)if(e.parts)e.parts=e.parts.filter(x=>x.batch!==batch);
  parcel.payments=parcel.payments.filter(e=>!e.parts||e.parts.length);
 }
 if(!found)throw Error('Pagamento não encontrado.');
}

function reconSettlementKey(kind,...parts){return JSON.stringify([kind,...parts]);}
function reconSettlementEntries(s){
 const rows=reconPayableRows(s),groups=new Map(),names=new Map();
 const receiptRows=s.reconciliation?.receipts??[];
 const months=new Set(receiptRows.flatMap(r=>r.allocations.map(a=>a.month)));
 for(const month of months){
  for(const row of reconRows(s,month,true))names.set(JSON.stringify([month,row.id]),row.name);
 }
 const receipts=receiptRows.map(r=>({...r,kind:'in',key:reconSettlementKey('in',r.id),
  allocations:r.allocations.map(a=>({...a,name:names.get(JSON.stringify([a.month,a.rowId]))??'Lançamento da fatura'}))}));
 for(const row of rows)for(const p of row.postings){
  const key=p.batch?reconSettlementKey('out',p.batch):reconSettlementKey('legacy',row.id,row.month);
  const r=groups.get(key)??{kind:'out',key,person:row.person,date:p.date,batch:p.batch,cents:0,allocations:[]};
  r.cents+=p.cents;r.allocations.push({rowId:row.id,month:row.month,name:row.name,cents:p.cents});groups.set(key,r);
 }
 const purchases=s.parcels.filter(p=>p.payTo).map(p=>({kind:'purchase',key:reconSettlementKey('purchase',p.id),id:p.id,date:p.payStart,
  person:p.payTo,name:p.name,cents:Math.round(p.total*100),count:p.count,hasPayments:!!p.payments?.length}));
 return [...receipts,...groups.values(),...purchases].sort((a,b)=>b.date.localeCompare(a.date)||a.person.localeCompare(b.person,'pt-BR'));
}
function reconEditSettlement(s,key,fields){
 const entry=reconSettlementEntries(s).find(r=>r.key===key);
 if(!entry)throw Error('Lançamento não encontrado.');
 if(entry.kind==='purchase'){
  const p=s.parcels.find(e=>e.id===entry.id&&e.payTo);
  if(fields===null){
   if(entry.hasPayments)throw Error('Exclua os pagamentos vinculados antes de excluir esta compra.');
   if(reconParcelLinked(s,p.id)||reconHasAllocated(s,p.id))throw Error('Esta compra tem vínculos com a fatura. Remova os vínculos antes de excluir.');
   s.parcels=s.parcels.filter(x=>x!==p);return;
  }
  const {name,person,date,cents,count}=fields;
  if(!name||name.length>120||!person||person.length>100||!isDate(date)||!Number.isSafeInteger(cents)||cents>1e12||!Number.isInteger(count)||count<1||count>120||cents<count)throw Error('Confira a descrição, a pessoa, a data e o valor. Cada parcela deve ter ao menos um centavo.');
  const schedule=person!==p.payTo||date!==p.payStart||cents!==entry.cents||count!==p.count;
  if(schedule&&entry.hasPayments)throw Error('Desfaça os pagamentos vinculados antes de alterar as parcelas.');
  if(schedule&&(reconParcelLinked(s,p.id)||reconHasAllocated(s,p.id)))throw Error('Esta compra tem vínculos com a fatura.');
  Object.assign(p,{name,payTo:person,payStart:date,start:date.slice(0,7),total:cents/100,count,
   payment:cents===entry.cents&&count===p.count?p.payment:Math.floor(cents/count)/100});
  return;
 }
 // Recalculate on a copy so an invalid value cannot lose any existing allocations.
 const next=structuredClone(s);
 if(entry.kind==='in')reconDeleteReceipt(next,entry.id);
 else if(entry.batch)reconUndoPayablePayment(next,entry.batch);
 else reconSetPayable(next,entry.allocations[0].rowId,entry.allocations[0].month,null);
 if(fields!==null){
  if(!Array.isArray(fields.values)||fields.values.length!==entry.allocations.length||
   fields.values.some(v=>!Number.isSafeInteger(v)||v<0||v>1e12))throw Error('Confira o valor informado.');
  const allocations=entry.allocations.map(({rowId,month},i)=>({rowId,month,cents:fields.values[i]})).filter(a=>a.cents>0);
  const total=allocations.reduce((n,a)=>n+a.cents,0);
  if(!Number.isSafeInteger(total)||total<=0||total>1e12)throw Error('Informe um valor positivo ou exclua o lançamento.');
  const payment={person:entry.person,date:fields.date,cents:total,allocations};
  if(entry.kind==='in')reconAddReceipt(next,{...payment,id:entry.id,inBaseline:entry.inBaseline,...(entry.accountId!==undefined?{accountId:entry.accountId}:{})});
  else reconAddPayablePayment(next,payment,entry.batch);
 }
 s.parcels=next.parcels;s.reconciliation=next.reconciliation;
}

function reconOpenDebtEntries(s){
 const pending=new Map();
 for(const item of reconPayableRows(s))if(item.remaining>0){
  const group=pending.get(item.id)??{remaining:0,nextDue:item.due};
  group.remaining+=item.remaining;pending.set(item.id,group);
 }
 const outgoing=s.parcels.filter(p=>p.payTo&&pending.has(p.id)).map(p=>({
  ...pending.get(p.id),kind:'purchase',key:reconSettlementKey('purchase',p.id),id:p.id,
  date:p.payStart,person:p.payTo,name:p.name,cents:Math.round(p.total*100),count:p.count,hasPayments:!!p.payments?.length
 }));
 const statements=new Map((s.reconciliation?.statements??[]).map(st=>[st.month,st]));
 const incoming=reconDebt(s).filter(d=>d.remaining>0).map(d=>({
  ...d,kind:'receivable',key:reconSettlementKey('receivable',d.month,d.rowId,reconPersonKey(d.person)),
  date:d.expected??addDays(pixScenarioDue(statements.get(d.month),d.month),-1)
 }));
 return [...outgoing,...incoming].sort((a,b)=>(a.nextDue??a.date).localeCompare(b.nextDue??b.date)||a.person.localeCompare(b.person,'pt-BR')||a.name.localeCompare(b.name,'pt-BR'));
}
function reconEditOpenDebt(s,key,fields){
 const entry=reconOpenDebtEntries(s).find(e=>e.key===key);
 if(!entry)throw Error('Dívida não encontrada.');
 if(entry.kind==='purchase')return reconEditSettlement(s,key,fields);
 if(entry.fixedId)throw Error('Edite este Pix em Valores Fixos.');
 const {month,rowId}=entry,row=reconRows(s,month,true).find(r=>r.kind==='charge'&&r.id===rowId);
 if(!row)throw Error('Lançamento da fatura não encontrado.');
 const personKey=reconPersonKey(entry.person);
 const parts=(row.parts??[]).filter(p=>reconPersonKey(p.person)!==personKey);
 const name=fields?.name??row.name;
 if(fields!==null){
  const person=String(fields.person??'').trim().normalize('NFC'),who=reconPersonKey(person);
  const {date,cents}=fields;
  if(!person||person.length>100||!isDate(date)||!Number.isSafeInteger(cents)||cents<=0||cents>row.cents||!name||name.length>250)throw Error('Confira a pessoa, a descrição, o vencimento e o valor.');
  if(reconOwner(s).aliases.some(owner=>reconPersonKey(owner)===who))throw Error('Informe quem vai te pagar, não o titular da fatura.');
  if(parts.some(p=>reconPersonKey(p.person)===who))throw Error('Essa pessoa já está no rateio desta linha.');
  if(entry.received>0&&(who!==personKey||cents<entry.received))throw Error('Desfaça o recebimento vinculado antes de trocar a pessoa ou reduzir abaixo do valor já recebido.');
  parts.push({person,cents,...(date!==entry.date||entry.expected?{expected:date}:{})});
 }else if(entry.received>0)throw Error('Desfaça o recebimento vinculado antes de excluir a dívida.');
 const total=parts.reduce((sum,p)=>sum+p.cents,0);
 if(total>row.cents)throw Error('O rateio não pode ultrapassar o valor da fatura nesta linha.');
 reconSetLabel(s,month,rowId,parts.length?(total===row.cents?'other':'split'):null,parts,'one',name);
}
