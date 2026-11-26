'use strict';
// Read-only cash scenarios. Inputs use integer cents and ISO local dates.
function pixScenarioReceipts(people,mode,at,inclusive=true,cutoff=at){
 const eligible=people.filter(p=>p.date<=cutoff&&(inclusive?p.date<=at:p.date<at)&&(mode!=='custom'||p.selected));
 if(mode==='none')return 0;
 const totals=eligible.map(p=>p.cents).sort((a,b)=>b-a);
 const late=mode==='late1'?1:mode==='late2'?2:0;
 return totals.slice(late).reduce((a,v)=>a+v,0);
}
function pixScenarioDue(st,month){
 const modeled=eventDate(month,5),raw=st?.dueDate??st?.due;
 return typeof raw==='string'&&isDate(raw)&&Math.abs(daysBetween(modeled,raw))<=42?raw:modeled;
}
function pixScenarioInvoice(s,asOf){
 const month=asOf.slice(0,7);
 return [-1,0,1,2].map(i=>{
  const m=shiftMonth(month,i),st=s.reconciliation?.statements?.find(x=>x.month===m);
  const date=pixScenarioDue(st,m);
  return {month:m,date,modeled:!!st,amount:invoiceAmount(s,m)+reconPreviousCredit(s,m)};
 }).filter(x=>x.date>=asOf&&!reconPayment(s,x.month)&&x.amount>0)
   .sort((a,b)=>a.date.localeCompare(b.date))[0]??null;
}
function pixScenarioPeople(s,month,asOf){
 // Ignore already received Pix and exclude credit-only movements that are not in the visible bill.
 const outstanding=new Map();
 const received=new Map();
 for(const receipt of s.reconciliation?.receipts??[]){
  if(receipt.date>asOf)continue;
  for(const a of receipt.allocations){
   if(a.month!==month)continue;
   const key=JSON.stringify([a.rowId,reconPersonKey(receipt.person)]);
   received.set(key,(received.get(key)??0)+a.cents);
  }
 }
 for(const row of reconRows(s,month)){
  if(row.kind!=='charge'||row.cents<=0)continue;
  for(const part of row.parts??[]){
   const key=reconPersonKey(part.person), paid=received.get(JSON.stringify([row.id,key]))??0;
   if(part.cents<=paid)continue;
   const group=outstanding.get(key)??{key,name:part.person,cents:0};
   group.cents+=part.cents-paid;outstanding.set(key,group);
  }
 }
 return [...outstanding.values()].sort((a,b)=>b.cents-a.cents||a.name.localeCompare(b.name,'pt-BR'));
}
function pixScenarioSnapshot(s,asOf,calc){
 if(!calc.ready)return null;
 const bill=pixScenarioInvoice(s,asOf);
 if(!bill)return null;
 const sunday=nextSunday(asOf),end=sunday>bill.date?sunday:bill.date;
 // Include every day: native dates, actual receipts, bills and fixed payments
 // may not share a date. Follow imported due dates within this private preview
 // without altering the existing ledger or Home KPI.
 const days=[],opening=reconOpening(s).date,reserve=overdueReserved(s,asOf);
 const relocations=(s.reconciliation?.statements??[]).flatMap(st=>{
  const date=pixScenarioDue(st,st.month), original=eventDate(st.month,5);
  if(date===original||reconPayment(s,st.month)||original<=opening||date<=opening)return [];
  return [{date,original,cents:Math.round((invoiceAmount(s,st.month)+reconPreviousCredit(s,st.month))*100)}];
 });
 let billDay;
 for(let d=asOf;d<=end;d=addDays(d,1)){
  const adjusted=relocations.reduce((sum,x)=>sum+(d>=x.original?x.cents:0)-(d>=x.date?x.cents:0),0);
  const cash=Math.round(cashForecast(s,d,asOf)*100)+adjusted;
  const margin=Math.round((profile(s,d.slice(0,7)).margin+reserve)*100);
  const entry={date:d,cash,headroom:cash-margin};days.push(entry);
  if(d===bill.date)billDay=entry;
 }
 const last=addDays(bill.date,-1);
 return {bill,sunday,asOf,last,week:Math.round(calc.week*100),days,billDay,people:pixScenarioPeople(s,bill.month,asOf)};
}
function pixScenarioEvaluate(snapshot,people,mode){
 const {bill,sunday,week,days,billDay,last}=snapshot;
 const include=(day,inclusive,cutoff)=>pixScenarioReceipts(people,mode,day,inclusive,cutoff);
 const simulatedAtBill=include(bill.date,true,last);
 const billCash=billDay.cash+simulatedAtBill;
 const dueMargin=billDay.headroom+simulatedAtBill;
 let earlierDeficit=0;
 for(const d of days){
  if(d.date>=bill.date)break;
  earlierDeficit=Math.max(earlierDeficit,-d.cash-include(d.date,false,last));
 }
 const due=earlierDeficit>0?0:Math.max(0,dueMargin);
 const lastForSunday=sunday<last?sunday:last;
 // Extra Sunday spending is counted only once conditional Pix has arrived.
 // After Sunday, check the remaining payment commitments without assuming
 // any additional Pix not already available by Sunday.
 let baseMin=Infinity,scenarioMin=Infinity;
 for(const d of days){
  if(d.date<sunday)continue;
  baseMin=Math.min(baseMin,d.headroom);
  scenarioMin=Math.min(scenarioMin,d.headroom+include(d.date,true,lastForSunday));
 }
 const sundayPayments=include(sunday,true,lastForSunday);
 const unresolvedBySunday=days.some(d=>d.date<sunday&&d.cash+include(d.date,false,lastForSunday)<0);
 const extra=unresolvedBySunday?0:Math.max(0,scenarioMin-Math.max(week,baseMin,0));
 return {sunday:week+extra,due,simulatedAtBill,sundayPayments,billGap:Math.max(0,-billCash),
   marginGap:billCash>=0?Math.max(0,-dueMargin):0,earlierDeficit};
}
