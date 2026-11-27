'use strict';
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
function mergeClosedCard(s,m,parsed){
 const recon=reconInit(s),old=recon.statements.find(x=>x.month===m);
 const previous=new Map();
 for(const row of old?.rows??[]){
  const key=cardCsvKey(row.source??{});
  if(key===null)throw Error('O mês já tem linhas sem referência ao CSV original. O app não substituiu nada.');
  if(!previous.has(key))previous.set(key,[]);
  previous.get(key).push(row);
 }
 const updated=parsed.map(({key,row})=>previous.get(key)?.shift()??{...row,id:newId()});
 if([...previous.values()].some(list=>list.length))throw Error('O CSV não contém todas as linhas anteriores deste mês. O app não substituiu nada.');
 const ids=new Set(updated.map(x=>x.id));
 const localReceipts=recon.receipts.filter(p=>p.allocations.some(a=>a.month===m&&!ids.has(a.rowId)&&!a.rowId.startsWith('cashcard:')));
 if(localReceipts.length)throw Error('Há Pix ligado a uma compra manual que não aparece no CSV. Revise esse vínculo antes de fechar o mês.');
 const statement={...old,month:m,closed:true,rows:updated};
 recon.statements=[...recon.statements.filter(x=>x.month!==m),statement].sort((a,b)=>a.month.localeCompare(b.month));
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
  if(!confirm(`Usar o CSV na fatura de ${monthTitle(month)}? Total das linhas, sem o pagamento anterior: ${money(total/100)}.`))return;
  if(await update(s=>mergeClosedCard(s,month,parsed))){
   field.value='';cardMonth=month;showScreen('recon');notice('Fatura fechada atualizada.');
  }
 }catch(e){notice(e.message,'error');}
}
