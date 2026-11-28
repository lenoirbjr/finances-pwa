'use strict';
/* diario-shell:4.0.60 */
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

// One timeline for the Home spending limits. Future Pix are projections, not cash.
function budgetExpectedReceipts(s,asOf,through,selected,debts=reconDebt(s)){
 const statements=new Map((s.reconciliation?.statements??[]).map(st=>[st.month,st]));
 const totals=new Map(), dates=new Map();
 const tomorrow=addDays(asOf,1);
 for(const debt of debts){
  if(debt.remaining<=0||(selected&&!selected.has(reconPersonKey(debt.person))))continue;
  if(!dates.has(debt.month)){
   const due=pixScenarioDue(statements.get(debt.month),debt.month);
   // Overdue amounts may still be expected, but never counted as cash today.
   dates.set(debt.month,due<tomorrow?tomorrow:due);
  }
  const date=debt.expected?(debt.expected<tomorrow?tomorrow:debt.expected):dates.get(debt.month);
  if(date<=through)totals.set(date,(totals.get(date)??0)+debt.remaining);
 }
 return [...totals].sort(([a],[b])=>a.localeCompare(b)).map(([date,cents])=>({date,cents}));
}
// Find the next three unpaid billing dates, even when a modeled bill is zero.
function upcomingBudgetBills(s,asOf){
 const month=asOf.slice(0,7);
 const statements=new Map((s.reconciliation?.statements??[]).map(st=>[st.month,st]));
 const paid=new Set((s.reconciliation?.payments??[]).map(p=>p.month));
 const dates=[];
 let foundAt=null;
 // Imported due dates can move up to 42 days from the modeled fifth.
 for(let n=-2;foundAt===null||n<=foundAt+2;n++){
  const m=shiftMonth(month,n),date=pixScenarioDue(statements.get(m),m);
  if(date>=asOf&&!paid.has(m)){
   dates.push({month:m,date});
   if(dates.length===3)foundAt=n;
  }
 }
 return dates.sort((a,b)=>a.date.localeCompare(b.date)||a.month.localeCompare(b.month)).slice(0,3);
}
function budgetDebts(s,asOf,bills=upcomingBudgetBills(s,asOf)){
 return reconDebt(s,null,{asOf,through:bills.at(-1)?.date});
}
// Allocate projected cash in priority order, restoring just the deductions
// being presented in this cycle. Earlier cycles stay deducted.
function commitmentWaterfall(s,asOf,month,projection,cutoff=null,cycleStart=null){
 if(!projection.ready)return null;
 const totals=reconCommitmentTotals(s,month),opening=reconOpening(s).date;
 const st=s.reconciliation?.statements?.find(x=>x.month===month);
 const modeled=eventDate(month,5),due=pixScenarioDue(st,month),onward=d=>d<asOf?asOf:d;
 const card=totals.cardOpen>0?[{cents:totals.cardOpen,date:onward(due),deduction:modeled>opening?(due>opening?due:modeled):null}]:[];
 const outside=[];
 const from=cycleStart?.slice(0,7)??month, until=cutoff&&cycleStart?cutoff.slice(0,7):month;
 for(let m=from;m<=until;m=shiftMonth(m,1)){
  const byFixed=new Map(activeFixed(s,m).map(x=>[x.id,x]));
  for(const x of [...reconPayableRows(s,m),...reconRecurringPayables(s,m)]){
   if(x.remaining<=0||(cycleStart&&x.due<=cycleStart))continue;
   const item=byFixed.get(x.fixedId),scheduled=item?reconScheduledFixed(s,item,m):null;
   outside.push({cents:x.remaining,date:onward(x.due),deduction:scheduled?(scheduled.date>opening?scheduled.date:null):x.due});
  }
 }
 outside.sort((a,b)=>a.date.localeCompare(b.date));
 const last=cutoff??[asOf,...card.map(x=>x.date),...outside.map(x=>x.date)].sort().at(-1);
 const investment=skipped(s,month)?0:Math.max(0,Math.round((investmentAmount(s,month)-(settled(s,month)?.amount??0))*100));
 const investDay=eventDate(month,30), investDate=onward(investDay<last?investDay:last);
 const invest=investment?[{cents:investment,date:investDate,deduction:investDay>opening?(investDay<=asOf&&!settled(s,month)?asOf:investDay):null}]:[];
 const margin=Math.round(profile(s,month).margin*100);
 const byDue=new Map();
 for(const row of outside)if(row.date<=last)byDue.set(row.date,(byDue.get(row.date)??0)+row.cents);
 const byDay=[...byDue].map(([date,cents])=>({date,cents}));
 const groups=[['Fatura',card.filter(x=>x.date<=last)],['A Pagar e Receber',byDay],['Investimento',invest],['Margem',margin?[{cents:margin,date:last}]:[]]];
 const toRestore=[...card,...outside.filter(x=>x.date<=last),...invest];
 const cashFor=date=>{
  const p=projection.days.find(x=>x.date===date)??projection.days.filter(x=>x.date<=date).at(-1);
  if(!p)return 0;
  return p.room+p.margin+toRestore.reduce((n,x)=>n+(x.deduction&&x.deduction<=p.date?x.cents:0),0);
 };
 const reserved=[];
 const reserveThrough=date=>reserved.reduce((n,x)=>n+(x.date<=date?x.cents:0),0);
 const rows=groups.map(([label,items])=>{
  let target=0,covered=0;
  for(const item of items){
   target+=item.cents;
   const dates=[item.date,...reserved.filter(x=>x.date>item.date).map(x=>x.date)];
   const headroom=Math.min(...dates.map(date=>cashFor(date)-reserveThrough(date)));
   covered+=Math.min(item.cents,Math.max(0,headroom));
   reserved.push(item);
  }
  return {label,target,covered};
 });
 const free=rows.some(x=>x.covered<x.target)?0:Math.max(0,cashFor(last)-reserveThrough(last));
 let salaries=0;
 for(let m=asOf.slice(0,7);m<=last.slice(0,7);m=shiftMonth(m,1)){
  for(const e of salaryEvents(s,m))if(e.date>asOf&&e.date<=last)salaries+=Math.round(e.amount*100);
 }
 return {month,last,rows,free,salaries,reimbursements:projection.days.filter(x=>x.date<=last).at(-1)?.credit??0};
}
function commitmentPeriods(s,asOf,projection){
 const bills=projection.bills??upcomingBudgetBills(s,asOf);
 return bills.map(({month,date},i)=>({
  label:'Até a fatura',month,date,details:commitmentWaterfall(s,asOf,month,projection,date,bills[i-1]?.date??addDays(asOf,-1))
 }));
}
function spendingTimeline(s,asOf,current,selected,debts,bills=upcomingBudgetBills(s,asOf)){
 const sunday=nextSunday(asOf),payday=nextPayday(s,asOf),beforePayday=addDays(payday,-1);
 const bill=pixScenarioInvoice(s,asOf),first=nextMonthEndPayday(asOf);
 const horizon=[sunday,payday,bill?.date??asOf,bills.at(-1)?.date??asOf,eventDate(shiftMonth(first.slice(0,7),2),30)].sort().at(-1);
 if(current===null||!reconOpening(s)||reconOpening(s).date>asOf)return {ready:false,sunday,payday,bill,bills,horizon};
 const opening=reconOpening(s).date;
 const points=new Set([asOf,sunday,beforePayday,horizon]);
 const events=(date)=>{if(isDate(date)&&date>=asOf&&date<=horizon)points.add(date);};
 if(bill)events(bill.date);
 for(const entry of bills)events(entry.date);
 const start=asOf.slice(0,7),end=horizon.slice(0,7),relocations=[],extraGoals=[];
 const statementByMonth=new Map((s.reconciliation?.statements??[]).map(st=>[st.month,st]));
 const reserve=Math.round(overdueReserved(s,asOf)*100);
 for(let m=start;m<=end;m=shiftMonth(m,1)){
  const modeled=eventDate(m,5),due=pixScenarioDue(statementByMonth.get(m),m),investDay=eventDate(m,30);
  events(eventDate(m,1));events(modeled);events(due);events(investDay);
  for(const salary of salaryEvents(s,m))events(salary.date);
  for(const fixed of reconFixed(s,m))events(reconScheduledFixed(s,fixed,m).date);
  const contribution=settled(s,m);
  if(contribution){
   events(contribution.date);
   const remaining=Math.round((investmentAmount(s,m)-contribution.amount)*100);
   if(!skipped(s,m)&&investDay>opening){
    if(remaining>0)extraGoals.push({date:investDay,cents:remaining});
    // If a contribution is registered for later, reserve its part at the target date first.
    if(contribution.date>investDay){
     const target=Math.round(investmentAmount(s,m)*100),paid=Math.round(contribution.amount*100);
     const bridge=Math.min(target,paid);
     if(bridge>0)extraGoals.push({date:investDay,cents:bridge},{date:contribution.date,cents:-bridge});
    }
   }
  }
 }
 for(const [m,st] of statementByMonth){
  const modeled=eventDate(m,5),due=pixScenarioDue(st,m);
  if(modeled===due||reconPayment(s,m)||modeled<=opening||due<=opening||modeled>horizon&&due>horizon)continue;
  events(modeled);events(due);
  relocations.push({modeled,due,cents:Math.round((invoiceAmount(s,m)+reconPreviousCredit(s,m))*100)});
 }
 for(const list of [s.expenses,s.extraIncome,s.extraInvestments,s.monthlyPaid,s.reconciliation?.receipts,s.reconciliation?.payments]){
  for(const x of list??[])events(x.date);
 }
 for(const p of reconPayableEvents(s))events(p.date);
 const expected=budgetExpectedReceipts(s,asOf,horizon,selected,debts??budgetDebts(s,asOf,bills));
 for(const p of expected)events(p.date);
 const days=[...points].sort().map(date=>{
  const currentForecast=Math.round(cashForecast(s,date,asOf)*100);
  const credit=expected.reduce((sum,p)=>sum+(p.date<=date?p.cents:0),0);
  const correct=relocations.reduce((sum,p)=>sum+(date>=p.modeled?p.cents:0)-(date>=p.due?p.cents:0),0);
  const goal=extraGoals.reduce((sum,p)=>sum+(p.date<=date?p.cents:0),reserve);
  const margin=Math.round(profile(s,date.slice(0,7)).margin*100);
  return {date,credit,margin,room:currentForecast+credit+correct-goal-margin};
 });
 const weakest=days.reduce((a,b)=>b.room<a.room?b:a);
 const limit=date=>{
  if(days.some(p=>p.date<date&&p.room<0))return 0;
  let room=Math.max(0,Math.min(...days.filter(p=>p.date>=date).map(p=>p.room)));
  // The opening-day ceiling must also fit cash available now, never a future Pix.
  if(date===asOf)room=Math.min(room,Math.max(0,Math.round((current-profile(s,start).margin)*100)));
  return room;
 };
 return {ready:true,horizon,bill,bills,sunday,payday,todayLimit:limit(asOf),sundayLimit:limit(sunday),paydayLimit:limit(beforePayday),billLimit:bill?limit(bill.date):null,
  expectedToBill:bill?expected.reduce((n,p)=>n+(p.date<=bill.date?p.cents:0),0):0,
  shortage:weakest.room<0?{date:weakest.date,cents:-weakest.room}:null,days};
}
