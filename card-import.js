'use strict';
/* diario-shell:4.0.55 */
// Importa o CSV localmente; mantém a identidade das linhas que já existiam.
function cardCsvFields(input){
 const out=[];let row=[],field='',quoted=false,afterQuote=false;
 const value=String(input).replace(/^\uFEFF/,'');
 const endField=()=>{row.push(field.trim());field='';afterQuote=false;};
 const endRow=()=>{endField();if(row.some(Boolean))out.push(row);row=[];};
 for(let i=0;i<value.length;i++){
  const c=value[i];
  if(quoted){
   if(c==='"'){if(value[i+1]==='"'){field+='"';i++;}else{quoted=false;afterQuote=true;}}
   else field+=c;
  }else if(c===';')endField();
  else if(c==='\n'||c==='\r'){endRow();if(c==='\r'&&value[i+1]==='\n')i++;}
  else if(c==='"'&&!field&&!afterQuote)quoted=true;
  else if(afterQuote){if(!/\s/.test(c))throw Error('CSV inválido após um campo entre aspas.');}
  else field+=c;
 }
 if(quoted)throw Error('O CSV tem um campo entre aspas sem fechamento.');
 if(field||row.length)endRow();
 return out;
}
function cardCsvKey(source){
 const date=String(source.Data??'').trim(),name=String(source.Estabelecimento??'').trim(),owner=String(source.Portador??'').trim();
 const cash=String(source.Valor??'').trim().replace(/^R\$\s*/,'').trim();
 if(!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{2}$/.test(cash))return null;
 const cents=Number(cash.replace(/[.,]/g,''));
 const part=String(source.Parcela??'').trim().replace(/\s+/g,' ');
 return JSON.stringify([date,name,owner,cents,part||'-']);
}
function parseClosedCardCsv(input){
 const [headers,...rows]=cardCsvFields(input), required=['Data','Estabelecimento','Portador','Valor','Parcela'];
 if(!headers||required.some(x=>headers.filter(k=>k===x).length!==1)||!rows.length||rows.length>5000)throw Error('Escolha o CSV da fatura com Data, Estabelecimento, Portador, Valor e Parcela.');
 const positions=required.map(k=>headers.indexOf(k));
 return rows.map((fields,i)=>{
  if(fields.length!==headers.length)throw Error('Confira as colunas na linha '+(i+2)+' do CSV.');
  const source={index:String(i),...Object.fromEntries(required.map((k,j)=>[k,fields[positions[j]]]))};
  const key=cardCsvKey(source);
  const date=source.Data.split('/').reverse().join('-'),name=source.Estabelecimento;
  const cents=key?JSON.parse(key)[3]:null;
  const part=source.Parcela.match(/^(\d+)\s+de\s+(\d+)$/i);
  if(!/^\d{2}\/\d{2}\/\d{4}$/.test(source.Data)||!isDate(date)||!name||name.length>250||!Number.isSafeInteger(cents)||!cents||Math.abs(cents)>1e12||(!part&&source.Parcela&&!['-','—'].includes(source.Parcela)&&!/^de\s+1$/i.test(source.Parcela))||(part&&(+part[1]<1||+part[1]>+part[2]||+part[2]>240)))throw Error('Confira data, valor e parcela na linha '+(i+2)+' do CSV.');
  const normalized=name.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  return {key,row:{name,date,cents,kind:cents>0?'charge':normalized==='pagamentos validos normais'?'prior-payment':'credit',source,...(part&&cents>0?{number:+part[1],count:+part[2]}:{})}};
 });
}
function cardForecastIdentity(x){
 return x.kind==='charge'&&x.count>1&&x.source?.Estabelecimento&&x.source?.Portador?JSON.stringify([x.date,reconPersonKey(x.source.Estabelecimento),reconPersonKey(x.source.Portador),x.number,x.count]):null;
}
function mergeClosedCard(s,m,parsed,closed=true,now=Date.now()){

 const recon=reconInit(s),old=recon.statements.find(x=>x.month===m);
 if(!closed&&old?.closed===true)throw Error('Esta fatura já foi fechada e não pode voltar a ser uma prévia.');
 const tiedBefore=reconDebt(s).filter(x=>x.received>0);
 const prior=reconUnadjustedRows(s,m), future=new Map(), seen=new Map();
 for(const {row} of parsed){const key=cardForecastIdentity(row);if(key)seen.set(key,(seen.get(key)??0)+1);}
 const originalRows=new Map();
 for(const st of recon.statements.filter(st=>st.month<m).sort((a,b)=>a.month.localeCompare(b.month)))for(const row of st.rows)originalRows.set(row.id,row);
 for(const row of prior){
  if(row.source!=='forecast')continue;
  const key=cardForecastIdentity({...row,source:originalRows.get(row.id)?.source});
  if(key){if(!future.has(key))future.set(key,[]);future.get(key).push(row);}
 }
 const previous=new Map();
 for(const row of old?.rows??[]){
  const key=cardCsvKey(row.source??{});
  if(key===null)throw Error('O mês já tem linhas sem referência ao CSV original. O app não substituiu nada.');
  if(!previous.has(key))previous.set(key,[]);
  previous.get(key).push(row);
 }
 const occupied=new Set((old?.rows??[]).map(x=>x.id));
 const updated=parsed.map(({key,row})=>{
  const exact=previous.get(key)?.shift();if(exact)return exact;
  const identity=cardForecastIdentity(row), options=future.get(identity)??[];
  const before=seen.get(identity)===1&&options.length===1&&Math.abs(options[0].cents-row.cents)<=5&&!occupied.has(options[0].id)?options[0]:null;
  if(!before)return {...row,id:newId()};
  occupied.add(before.id);
  const parts=reconScale(before.parts,before.label,before.cents,row.cents);
  const label=parts.length?(parts.reduce((sum,x)=>sum+x.cents,0)===row.cents?'other':'split'):before.label?'mine':undefined;
  return {...row,id:before.id,legacyIds:before.legacyIds,label,parts};
 });
 if([...previous.values()].some(list=>list.length))throw Error('O CSV não contém todas as linhas anteriores deste mês. O app não substituiu nada.');
 const ids=new Set(updated.map(x=>x.id));
 const localReceipts=recon.receipts.filter(p=>p.allocations.some(a=>a.month===m&&!ids.has(a.rowId)&&!a.rowId.startsWith('cashcard:')));
 if(localReceipts.length)throw Error('Há Pix ligado a uma compra manual que não aparece no CSV. Revise esse vínculo antes de atualizar o mês.');
 const statement={...old,month:m,closed,snapshotAt:now,rows:updated};
 recon.statements=[...recon.statements.filter(x=>x.month!==m),statement].sort((a,b)=>a.month.localeCompare(b.month));
 const debtKey=x=>JSON.stringify([x.month,x.rowId,reconPersonKey(x.person)]);
 const tiedAfter=new Map(reconDebt(s).filter(x=>x.received>0).map(x=>[debtKey(x),x.received]));
 if(tiedBefore.some(x=>tiedAfter.get(debtKey(x))!==x.received))throw Error('A importação mudaria um vínculo de Pix existente. O app não substituiu nada.');
 if(recon.confirmedTotals)delete recon.confirmedTotals[m];
}
async function importClosedCard(event){
 event.preventDefault();
 const month=$('cardImportMonth').value,field=$('cardImportFile'),file=field.files?.[0];
 if(!isMonth(month)||!file||file.size>2000000)return notice('Escolha o mês e um arquivo CSV de até 2 MB.','warning');
 const named=file.name.match(/fatura(\d{4}-\d{2})-\d{2}/i);
 if(named&&named[1]!==month)return notice('O mês escolhido é diferente do mês no nome do arquivo.','warning');
 try{
  const parsed=parseClosedCardCsv(await file.text());
  const total=parsed.reduce((n,x)=>n+(x.row.kind==='prior-payment'?0:x.row.cents),0);
  const closed=$('cardImportStatus').value==='closed';
  if(!confirm(`Usar o CSV na fatura de ${monthTitle(month)}? Total das linhas, sem o pagamento anterior: ${money(total/100)}.`))return;
  if(await update(s=>mergeClosedCard(s,month,parsed,closed))){
   field.value='';cardMonth=month;showScreen('recon');notice(closed?'Fatura fechada atualizada.':'Prévia da fatura atualizada.');
  }
 }catch(e){notice(e.message,'error');}
}
function showCardEntry(mode){return keepScrollPosition(()=>paintCardEntry(mode))}
function paintCardEntry(mode){
 const refund=mode==='refund';
 $('cardPurchasePanel').classList.toggle('hidden',refund);
 $('cardRefundPanel').classList.toggle('hidden',!refund);
 for(const [id,on] of [['cardPurchaseTab',!refund],['cardRefundTab',refund]]){
  const b=$(id);b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));
 }
}
function addCardRefund(s,item){
 const r=reconInit(s),statement=r.statements.find(x=>x.month===item.month);
 if(statement?.closed===true)throw Error('Esta fatura já está fechada. Escolha um mês em aberto.');
 if(statement?.rows.some(x=>x.kind==='credit'&&x.date===item.date&&x.cents===-item.cents))throw Error('Já existe um estorno desse valor e data no CSV.');
 r.cardRefunds??=[];
 if(r.cardRefunds.some(x=>x.month===item.month&&x.date===item.date&&x.cents===item.cents&&reconPersonKey(x.name)===reconPersonKey(item.name)))throw Error('Este estorno já foi registrado.');
 r.cardRefunds.push(item);
}
async function saveCardRefund(event){
 event.preventDefault();
 const name=$('cardRefundName').value.trim(),month=$('cardRefundMonth').value,date=$('cardRefundDate').value,cents=Math.round(amount('cardRefundAmount')*100);
 if(!name||!isMonth(month)||!isDate(date)||date>today()||!Number.isSafeInteger(cents)||cents<=0||cents>1e12)return notice('Confira mês, data e valor do estorno.','warning');
 if(await update(s=>addCardRefund(s,{id:newId(),name,month,date,cents,enteredAt:Date.now()}))){
  $('cardRefundName').value='';$('cardRefundAmount').value='';notice('Estorno registrado.');
 }
}
function editCardRefund(s,m,id,fields){
 const r=s.reconciliation,old=r?.cardRefunds,record=old?.find(x=>x.id===id&&x.month===m);
 if(!record||!reconRawRows(s,m).some(x=>x.id===id&&x.source==='manual-refund'))throw Error('Este estorno não está na fatura em aberto.');
 const rest=old.filter(x=>x!==record);
 if(fields===null){r.cardRefunds=rest;return;}
 const name=String(fields.name??'').trim(),date=fields.date,cents=fields.cents;
 if(!name||name.length>120||!isDate(date)||date>today()||!Number.isSafeInteger(cents)||cents<=0||cents>1e12)throw Error('Confira a descrição, a data e o valor do estorno.');
 r.cardRefunds=rest;
 try{addCardRefund(s,{...record,name,date,cents});}
 catch(err){r.cardRefunds=old;throw err;}
}

function editBankCredit(s,m,id,fields){
 const r=s.reconciliation,statement=r?.statements?.find(x=>x.month===m),record=statement?.rows.find(x=>x.id===id);
 if(!record||!['credit','prior-payment'].includes(record.kind))throw Error('Crédito ou pagamento anterior não encontrado na fatura.');
 const rest=(r.bankCreditEdits??[]).filter(x=>x.month!==m||x.rowId!==id);
 if(fields===null){r.bankCreditEdits=rest;return;}
 const name=String(fields.name??'').trim(),date=fields.date,cents=fields.cents;
 if(!name||name.length>250||!isDate(date)||date>today()||!Number.isSafeInteger(cents)||cents<=0||cents>1e12)throw Error('Confira a descrição, a data e o valor.');
 r.bankCreditEdits=name===record.name&&date===record.date&&cents===-record.cents?rest:[...rest,{month:m,rowId:id,name,date,cents}];
}
