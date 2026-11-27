'use strict';
function createReconUI(){
 const $=(sel,within=document)=>within.querySelector(sel), escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
 const brl=c=>money.format((c||0)/100);
 const monthTitle=m=>safeMonth(m)?m.slice(5)+'/'+m.slice(0,4):'';
 const coin=c=>((c||0)/100).toFixed(2);
 const cents=v=>{const s=String(v??'').trim().replace(',','.');return /^\d{1,12}(\.\d{1,2})?$/.test(s)?Math.round(Number(s)*100):NaN;};
 const safeDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 const safeMonth=m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m);
 const when=d=>escape((d||'').split('-').reverse().join('/'));
 const labels={mine:'Minha',other:'De outra pessoa',split:'Dividida'};
 const partName=p=>p.person??p.name??'';
 const partValue=p=>p.cents??0;
 const norm=x=>String(x||'').trim().normalize('NFC').toLocaleLowerCase('pt-BR');
 const ownerKey=x=>norm(x).normalize('NFD').replace(/\p{M}/gu,'').replace(/\s+/g,' ');
 const isOwner=x=>(api.owner?.aliases||['eu']).some(a=>ownerKey(a)===ownerKey(x));
 const knownLabel=x=>Object.hasOwn(labels,x)?x:'';
 const personHue=name=>{let h=2166136261;for(const c of norm(name)){h=Math.imul(h^c.codePointAt(0),16777619);}return (h>>>0)%48;};
 const chip=name=>`<span class="recon-person-chip" data-person-color="${personHue(name)}">${escape(name)}</span>`;
 function classificationNames(r,owner=api?.owner){
   const parts=(r.parts||[]).filter(x=>partName(x));
   const mine=r.ownerName||owner?.name||'Minha parte';
   return r.label==='mine'?[mine]:r.label==='split'?[mine,...parts.map(partName)]:r.label==='other'?parts.map(partName):[];
 }
 function classificationChips(r){
   const names=classificationNames(r);
   return names.length?`<span class="recon-passive-chips" aria-label="Etiquetas">${names.map(chip).join('')}</span>`:'<span class="recon-empty-chip">Sem etiqueta</span>';
 }
 function bankCredit(r){return r.source==='statement'&&(r.kind==='credit'||r.kind==='prior-payment');}
 function canEditCredit(r){return Boolean(r&&(bankCredit(r)?api.editBankCredit:r.source==='manual-refund'&&api.canAdjust?.(period)&&api.editRefund));}
 const statement=m=>{const obj=api.state?.reconciliation?.statements||{};return Array.isArray(obj)?obj.find(x=>x.month===m):obj[m];};
 const initialPeriod=()=>{const now=api.today.slice(0,7);return months().filter(m=>m>=now&&statement(m)).sort()[0]||now;};
 const charge=r=>r.kind==='charge'&&r.cents>0;
 function spread(values,total,base){
   if(!values.length||!Number.isSafeInteger(total)||total<0||!Number.isSafeInteger(base)||base<=0)return [];
   const bits=values.map((v,i)=>{const n=BigInt(v)*BigInt(total), b=BigInt(base);return {i,value:Number(n/b),rest:n%b};});
   let left=total-bits.reduce((n,x)=>n+x.value,0);
   for(const x of [...bits].sort((a,b)=>a.rest===b.rest?a.i-b.i:a.rest>b.rest?-1:1)){if(left<=0)break;x.value++;left--;}
   return bits.map(x=>x.value);
 }
 function roundedParts(raw,total,unit){
   if(unit!=='percent')return raw;
   const used=raw.reduce((n,x)=>n+x,0);
   if(raw.some(x=>!Number.isSafeInteger(x)||x<0)||used>10000)return null;
   return spread([...raw,10000-used],total,10000).slice(0,raw.length);
 }
 let api,root,tab='bill',period='',editing=null,formKind='',personFilter='',billFilter='all',busy=false,displayed=[],debts=[];
 const openGroups=new Set();
 const billSortOptions=[['original','Ordem original'],['amount-up','Valor: menor para maior'],['amount-down','Valor: maior para menor'],['label-up','Etiqueta: A a Z'],['label-down','Etiqueta: Z a A'],['date-down','Data: mais recentes'],['date-up','Data: mais antigas'],['name-up','Descrição: A a Z']];
 const isBillSort=value=>billSortOptions.some(([key])=>key===value);
 const billCollator=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});
 const billSortKey='diario-financeiro-bill-order';
 let billSort='original';
 try{const saved=localStorage.getItem(billSortKey);if(isBillSort(saved))billSort=saved;}catch{}
 let moneyTab='payable';
 const payablePersonKey=person=>JSON.stringify(['payable-person',norm(person)]);
 const payableMonthKey=(person,month)=>JSON.stringify(['payable-month',norm(person),month]);
 function months(){
   const obj=api.state?.reconciliation?.statements||{};
   return [...new Set([...(api.months||[]),...(Array.isArray(obj)?obj.map(x=>x.month):Object.keys(obj)),api.today.slice(0,7),period].filter(safeMonth))].sort().reverse();
 }
 function reset(){editing=null;formKind='';personFilter='';billFilter='all';}
 function close(){editing=null;formKind='';personFilter='';if(api.parcel){api.closeParcel?.();return;}paint();}
 function error(t,kind='error'){const form=$(`[data-recon-form="${formKind}"] [data-recon-form-message]`,root);if(form){form.textContent=t;return;}if(api.notify){if(t)api.notify(t,kind);return;}const el=$('[data-recon-message]',root);if(el)el.textContent=t;}
 function billList(all){
   const options=new Map([['all','Todos'],['unlabeled','Sem etiqueta']]);
   const names=new Map();
   const withNames=all.map(row=>{
     const keys=charge(row)?classificationNames(row).map(name=>{
       const value='name:'+norm(name);
       if(!names.has(value))names.set(value,name);
       return value;
     }):[];
     return {row,keys,labelSort:keys.slice().sort((a,b)=>billCollator.compare(names.get(a),names.get(b)))[0]};
   });
   for(const [value,label] of [...names].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')))options.set(value,label);
   if(!options.has(billFilter))billFilter='all';
   const list=withNames.filter(({row,keys})=>billFilter==='all'||(billFilter==='unlabeled'?charge(row)&&keys.length===0:keys.includes(billFilter)));
   if(billSort!=='original')list.sort((a,b)=>{
     if(billSort.startsWith('amount'))return (a.row.cents-b.row.cents)*(billSort==='amount-up'?1:-1);
     if(billSort.startsWith('date'))return String(a.row.date??'').localeCompare(String(b.row.date??''))*(billSort==='date-up'?1:-1);
     if(billSort==='name-up')return billCollator.compare(a.row.name,b.row.name);
     if(!a.labelSort||!b.labelSort)return Number(!a.labelSort)-Number(!b.labelSort);
     return billCollator.compare(names.get(a.labelSort),names.get(b.labelSort))*(billSort==='label-up'?1:-1);
   });
   displayed=list.map(x=>x.row);
   return options;
 }
 function payableRows(){
   return (api.payables?.()??api.payable?.()??[]).filter(x=>x.cents>0);
 }
 let currentPayables=[];
 function payableSection(items){
   const byPerson=new Map();
   const pending=rows=>rows.reduce((n,r)=>n+(r.paidDate?0:r.cents),0);
   const paid=rows=>rows.reduce((n,r)=>n+(r.paidDate?r.cents:0),0);
   for(const [i,item] of items.entries()){
     const key=norm(item.person);
     if(!byPerson.has(key))byPerson.set(key,{name:item.person,rows:[]});
     byPerson.get(key).rows.push({...item,index:i});
   }
   const groups=[...byPerson.values()].sort((a,b)=>pending(b.rows)-pending(a.rows)||a.name.localeCompare(b.name,'pt-BR'));
   return `<section class="surface recon-screen recon-payable" aria-labelledby="reconPayablesTitle">
   <div class="recon-money-heading"><h2 id="reconPayablesTitle">A Pagar</h2><p>Todos os meses</p></div>
   <dl class="recon-totals"><div><dt>Em Aberto</dt><dd>${brl(pending(items))}</dd></div><div><dt>Já Pago</dt><dd>${brl(paid(items))}</dd></div></dl>
   ${formKind==='payable-start'?payableForm(groups):`<button class="primary recon-pix" type="button" data-recon-payable-start ${pending(items)?'':'disabled'}>Registrar Pagamento</button>`}
   <div class="recon-rows recon-debt-list">${groups.length?groups.map(g=>{
     const personKey=payablePersonKey(g.name);
     return `<details class="recon-person-group" data-recon-group="${escape(personKey)}" ${openGroups.has(personKey)?'open':''}><summary><span>${escape(g.name)}${paid(g.rows)?`<small>${brl(paid(g.rows))} pago</small>`:''}</span><strong>${pending(g.rows)?brl(pending(g.rows)):'Quitado'}</strong></summary>
       <div class="recon-debt-months">${groupByMonth(g.rows).map(([month,rows])=>{
         const monthKey=payableMonthKey(g.name,month);
         const total=pending(rows);
         return `<details class="recon-debt-month" data-recon-group="${escape(monthKey)}" ${openGroups.has(monthKey)?'open':''}><summary><span>${monthTitle(month)}</span><strong>${total?brl(total):'Quitado'}</strong></summary>
         <div class="recon-payable-lines">${[...rows].sort((a,b)=>Number(Boolean(a.paidDate))-Number(Boolean(b.paidDate))||String(a.due||a.date).localeCompare(String(b.due||b.date))).map(r=>{
           const i=r.index;
           return `<article class="recon-row"><div><strong>${escape(r.name)}</strong><small>${r.paidDate?'Pix registrado em '+when(r.paidDate):'Vence '+when(r.due||r.date)}</small></div><div class="recon-row-amount"><strong>${brl(r.cents)}</strong>${r.paidDate?`<button type="button" class="secondary" data-recon-undo-payable="${i}" aria-label="Desfazer pagamento: ${escape(r.name)}">Desfazer</button>`:''}</div></article>`;
         }).join('')}</div></details>`;
       }).join('')}</div></details>`;
   }).join(''):'<p class="empty">Nenhuma compra para pagar a outras pessoas.</p>'}</div></section>`;
 }
 function paymentDateField(id,label){
   return `<label for="${id}">${label}</label><div class="calendar-field recon-receipt-date"><span class="calendar-label" data-recon-date-label aria-hidden="true">${when(api.today)}</span><span class="calendar-icon" aria-hidden="true">▦</span><input id="${id}" name="date" type="date" value="${escape(api.today)}" max="${escape(api.today)}" required></div>`;
 }
 function payableForm(groups){
   return `<form class="recon-edit recon-receipt-form recon-payable-form" data-recon-form="payable-start" aria-label="Registrar pagamento efetuado">
    <h2>Registrar Pagamento</h2><label for="reconPayableChoice">Dívida a pagar</label><select id="reconPayableChoice" name="payableIndex" required><option value="">Selecione</option>${groups.map(g=>{const rows=g.rows.filter(r=>!r.paidDate);return rows.length?`<optgroup label="${escape(g.name)}">${rows.map(r=>`<option value="${r.index}">${escape(r.name)} · ${monthTitle(r.month)} · ${brl(r.cents)}</option>`).join('')}</optgroup>`:''}).join('')}</select>
    ${paymentDateField('reconPayableDate','Data do pagamento')}
    <p class="assistive">Só registre depois de pagar. O app não faz a transferência.</p><div class="recon-actions"><button type="submit" class="primary">Registrar Pagamento</button><button type="button" class="secondary" data-recon-cancel>Cancelar</button></div><p class="recon-message" data-recon-form-message role="status"></p></form>`;
 }
 function moneyViews(){
   return `<div class="recon-money-views"><div class="subtabs recon-money-tabs" role="group" aria-label="Pagamentos e recebimentos">
     ${[['payable','A Pagar'],['receivable','A Receber']].map(([key,label])=>`<button type="button" class="${moneyTab===key?'active':''}" aria-pressed="${moneyTab===key}" data-recon-money="${key}">${label}</button>`).join('')}</div>
     ${moneyTab==='payable'?payableSection(currentPayables):debt()}</div>`;
 }
 function selectMoney(view){
   if(!['payable','receivable'].includes(view)||moneyTab===view)return;
   moneyTab=view;editing=null;formKind='';personFilter='';
 }
 function bill(){
   const options=billList(api.rows(period)||[]);
   const due=statement(period)?.dueDate??statement(period)?.due;
   return `<div class="surface recon-screen recon-invoice">
   <p class="recon-due">Vencimento: <strong>${when(safeDate(due)?due:period+'-05')}</strong></p>
   <div class="recon-label-filter"><select id="reconBillFilter" aria-label="Filtrar por etiqueta">${[...options].map(([value,label])=>`<option value="${escape(value)}" ${value===billFilter?'selected':''}>${escape(label)}</option>`).join('')}</select>
   <label class="recon-sort-control" data-sorted="${billSort!=='original'}" title="Ordenar lançamentos">
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 6h16M4 12h11M4 18h6"/></svg>
    <select id="reconBillSort" aria-label="Ordenar lançamentos">${billSortOptions.map(([key,label])=>`<option value="${key}" ${billSort===key?'selected':''}>${label}</option>`).join('')}</select>
   </label></div>
   <div class="recon-rows" id="reconBillRows">${billRows()}</div></div>`;
 }
 function billRows(){
   return `${displayed.length?displayed.map((r,i)=>{
    const editableRefund=canEditCredit(r),name=escape(r.name),part=r.number&&r.count?` · Parcela ${r.number}/${r.count}`:'';
    return `<article class="recon-row recon-card-line"><div>${charge(r)?`<button type="button" class="recon-entry-name" data-recon-edit="${i}" aria-label="Editar lançamento: ${name}">${name}</button>`:`<strong>${name}</strong>`}<small>${when(r.date)}${part}</small>${r.adjusted||r.bankEdited?`<small>Ajuste manual · Antes: ${brl(r.originalCents)}</small>`:''}${r.kind==='prior-payment'?'<small>Pagamento anterior · sem impacto</small>':r.kind==='credit'?'<small>Crédito ou estorno</small>':''}</div><div class="recon-row-amount"><strong>${brl(r.cents)}</strong>${charge(r)?classificationChips(r):editableRefund?`<button type="button" class="recon-edit-chip" data-recon-edit-refund="${i}" aria-label="Editar: ${name}">Editar</button>`:''}</div></article>${editing===r.id?(formKind==='refund'?refundEditor(r):['label','adjust-installment'].includes(formKind)?billEditor(r):''):''}`;
   }).join(''):`<p class="empty">${billFilter==='all'?'Nenhuma linha nesta fatura.':'Nenhum lançamento com esse filtro.'}</p>`}`;
 }
 function refundEditor(r){
   const bank=bankCredit(r),payment=r.kind==='prior-payment';
   const subject=payment?'pagamento anterior':'estorno';
   return `<form class="recon-edit" data-recon-form="refund" aria-label="Editar ${subject}">
   ${bank?`<p class="recon-note">${payment?'Este pagamento anterior não entra no total da fatura.':'O ajuste muda o total no Diário.'} O registro original do banco é preservado.</p>`:''}
   <label for="reconRefundName">Descrição</label><input id="reconRefundName" name="description" value="${escape(r.name)}" maxlength="${bank?250:120}" required>
   <label for="reconRefundDate">Data do ${subject}</label><input id="reconRefundDate" name="date" type="date" value="${escape(r.date)}" max="${escape(api.today)}" required>
   <label for="reconRefundValue">Valor do ${subject} (R$)</label><input id="reconRefundValue" name="amount" inputmode="decimal" value="${coin(-r.cents)}" required>
   <p class="recon-message" data-recon-form-message role="status"></p><div class="recon-actions recon-label-actions recon-refund-actions"><button type="submit" class="primary">Salvar</button><button type="button" class="secondary" data-recon-cancel>Cancelar</button>${bank?(r.bankEdited?'<button type="button" class="secondary" data-recon-reset-bank-credit>Restaurar</button>':''):'<button type="button" class="secondary" data-recon-delete-refund>Excluir</button>'}</div></form>`;
 }
 function billEditor(r){
   if(!r.number||!r.count)return editor(r);
   const value=formKind==='adjust-installment',canAdjust=api.canAdjust?.(period);
   return `<section class="recon-line-editor" aria-label="Editar lançamento">
     <div class="subtabs recon-editor-tabs" role="group" aria-label="Opções do lançamento">
      <button type="button" data-recon-edit-tab="label" aria-controls="reconLineLabelPanel" aria-pressed="${!value}" class="${!value?'active':''}">Etiqueta</button>
      <button type="button" data-recon-edit-tab="adjust-installment" aria-controls="reconLineValuePanel" aria-pressed="${value}" class="${value?'active':''}">Valor</button>
     </div>
     <div id="reconLineLabelPanel"${value?' hidden':''}>${editor(r)}</div>
     <div id="reconLineValuePanel"${value?'':' hidden'}>${canAdjust?installmentEditor(r):'<div class="recon-edit"><p class="recon-note">O valor de uma fatura fechada ou paga não pode ser alterado.</p></div>'}</div>
   </section>`;
 }
 function installmentEditor(r){
   return `<form class="recon-edit recon-installment-form" data-recon-form="adjust-installment" aria-label="Ajustar valor da parcela"><h3>${escape(r.name)}</h3><p class="recon-note">Válido de ${monthTitle(period)} em diante.</p><label for="reconInstallmentAmount">Valor por parcela (R$)</label><input id="reconInstallmentAmount" name="value" inputmode="decimal" value="${coin(r.cents)}" required><p class="recon-message" data-recon-form-message role="status"></p><div class="recon-actions recon-label-actions"><button type="submit" class="primary">Salvar</button><button type="button" class="secondary" data-recon-cancel>Cancelar</button><button type="button" class="secondary recon-exclude-installment" data-recon-exclude>Excluir</button></div></form>`;
 }
 function personRow(person='',c=0,showValue=true,disabled=false,unit='amount'){
   return `<div class="recon-share"><input name="person" aria-label="Nome da pessoa" placeholder="Nome da pessoa" maxlength="100" value="${escape(person)}" required ${disabled?'disabled':''}>${showValue?`<input name="partCents" aria-label="${unit==='percent'?'Percentual desta pessoa':'Valor desta pessoa (R$)'}" type="text" inputmode="decimal" placeholder="${unit==='percent'?'0,00%':'0,00'}" value="${c?coin(c):''}" required ${disabled?'disabled':''}>`:''}<button type="button" data-recon-remove aria-label="Remover pessoa">×</button></div>`;
 }
 function editor(r){
   const label=knownLabel(r.label), rows=(r.parts||[]).filter(p=>partName(p)).filter(p=>!p.mine);
   const shared=label==='split'||(label==='other'&&rows.length>1);
   const owner=label==='mine'?(r.ownerName||api.owner?.name||''):(!shared&&rows.length?partName(rows[0]):'');
   return `<form class="recon-edit" data-recon-form="label" aria-label="Classificação do lançamento">
      ${api.parcel?`<input type="hidden" name="lineName" value="${escape(r.name)}">`:`<label for="reconLineName">Nome do lançamento</label><input id="reconLineName" name="lineName" maxlength="250" value="${escape(r.name)}" required>`}
      <fieldset class="recon-divided"><legend>Dividida?</legend><label><input type="radio" name="divided" value="no" ${!shared?'checked':''}> Não</label><label><input type="radio" name="divided" value="yes" ${shared?'checked':''}> Sim</label></fieldset>
      <div class="recon-owner" ${shared?'hidden':''}><label for="reconOwner">De quem é o gasto?</label><div><input id="reconOwner" name="owner" maxlength="100" placeholder="Seu nome ou de outra pessoa" value="${escape(owner)}"></div><p class="recon-note">Em branco, o lançamento fica sem classificação.</p></div>
      <div class="recon-shares" ${shared?'':'hidden'}><label for="reconUnit">Dividir por</label><select id="reconUnit" name="unit" data-previous-unit="amount"><option value="amount">Valor em reais (R$)</option><option value="percent">Percentual (%)</option></select><p class="recon-note">Informe a parte de cada outra pessoa. O restante é a sua parte.</p><div data-recon-people>${rows.length?rows.map(p=>personRow(partName(p),partValue(p),true,!shared)).join(''):personRow('',0,true,!shared)}</div><button type="button" class="secondary" data-recon-add>+ Pessoa</button><p class="recon-note" data-recon-left></p></div>
      <p class="recon-message" data-recon-form-message role="status"></p><div class="recon-actions recon-label-actions"><button type="submit" class="primary">Salvar</button><button type="button" class="secondary" data-recon-cancel>Cancelar</button><button type="button" class="secondary" data-recon-clear>Limpar</button></div>
    </form>`;
 }
 function debt(){
   debts=api.debt()||[];
   const list=[...new Map(debts.filter(x=>x.remaining>0).map(x=>[norm(x.person),x.person])).values()];
   const byPerson=new Map();
   for(const d of debts){const p=norm(d.person);if(!byPerson.has(p))byPerson.set(p,[]);byPerson.get(p).push(d);}
   const people=[...byPerson.entries()].map(([key,items])=>({key,items,pending:items.reduce((n,d)=>n+d.remaining,0)}))
     .sort((a,b)=>b.pending-a.pending||a.items[0].person.localeCompare(b.items[0].person,'pt-BR'));
   const receiptsByPerson=new Map();
   for(const receipt of api.state?.reconciliation?.receipts??[]){const k=norm(receipt.person);if(!receiptsByPerson.has(k))receiptsByPerson.set(k,[]);receiptsByPerson.get(k).push(receipt);}
   const groups=people.map(({key,items,pending})=>{
    const received=items.reduce((n,d)=>n+d.received,0);
    const months=groupByMonth(items).map(([month,rows])=>{
     const open=rows.reduce((n,d)=>n+d.remaining,0), recv=rows.reduce((n,d)=>n+d.received,0);
     const groupKey=JSON.stringify(['month',key,month]);
     return `<details class="recon-debt-month" data-recon-group="${escape(groupKey)}" ${openGroups.has(groupKey)?'open':''}>
       <summary><span>${monthTitle(month)}<small>${rows.length} ${rows.length===1?'dívida':'dívidas'}${recv?' · '+brl(recv)+' recebido':''}</small></span><strong>${open?brl(open):'Quitado'}</strong></summary>
       <div class="recon-month-debts">${[...rows].sort((a,b)=>b.remaining-a.remaining).map(d=>`<article class="recon-row"><div><strong>${escape(d.name)}</strong>${d.number&&d.count?`<small>Parcela ${d.number}/${d.count}</small>`:''}${!statement(d.month)&&d.month>=api.today.slice(0,7)?'<small>Prevista</small>':''}</div><div class="recon-row-amount"><strong>${brl(d.remaining)}</strong><small>${d.remaining===0?'Quitado':d.received?brl(d.received)+' já recebido':'Pendente'}</small></div></article>`).join('')}</div></details>`;
    }).join('');
    const receipts=receiptsByPerson.get(key)||[], receiptKey='receipts:'+key;
    const receivedRows=receipts.length?`<details class="recon-debt-month" data-recon-group="${escape(receiptKey)}" ${openGroups.has(receiptKey)?'open':''}><summary><span>Pix registrados</span><strong>${receipts.length}</strong></summary><div class="recon-month-debts">${receipts.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<article class="recon-row"><div><strong>${brl(r.cents)}</strong><small>${when(r.date)}${r.inBaseline?' · Já no saldo inicial':''}</small></div><div class="recon-row-amount">${api.deleteReceipt?`<button type="button" class="secondary" data-recon-delete-pix="${escape(r.id)}">Desfazer</button>`:''}</div></article>`).join('')}</div></details>`:'';
    return `<details class="recon-person-group" data-recon-group="${escape('person:'+key)}" ${openGroups.has('person:'+key)?'open':''}><summary><span>${escape(items[0].person)}${received?`<small>${brl(received)} recebido</small>`:''}</span><strong>${pending?brl(pending):'Quitado'}</strong></summary><div class="recon-debt-months">${months}${receivedRows}</div></details>`;
   }).join('');
   return `<section class="surface recon-screen recon-receivables" aria-labelledby="reconReceivablesTitle"><div class="recon-money-heading"><h2 id="reconReceivablesTitle">A receber</h2><p>Todas as faturas</p></div><dl class="recon-totals"><div><dt>Em Aberto</dt><dd>${brl(debts.reduce((n,d)=>n+d.remaining,0))}</dd></div><div><dt>Já Recebido</dt><dd>${brl(debts.reduce((n,d)=>n+d.received,0))}</dd></div></dl>
   ${formKind!=='receipt'?`<button class="primary recon-pix" type="button" data-recon-pix ${list.length?'':'disabled'}>Registrar Pagamento</button>`:''}
   ${formKind==='receipt'?receiptForm(list):''}
   <div class="recon-rows recon-debt-list">${groups||'<p class="empty">Nenhum valor a receber. Classifique uma linha da fatura para começar.</p>'}</div></section>`;
 }
 function groupByMonth(items){
   const result=new Map();
   for(const x of items){if(!result.has(x.month))result.set(x.month,[]);result.get(x.month).push(x);}
   return [...result.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
 }
 function receiptForm(list){
   return `<form class="recon-edit recon-receipt-form" data-recon-form="receipt" aria-label="Registrar Pagamento Recebido"><h2>Registrar Pagamento Recebido</h2><label for="reconPerson">De quem veio</label><select id="reconPerson" name="person" required><option value="">Selecione</option>${list.map(p=>`<option ${norm(p)===norm(personFilter)?'selected':''}>${escape(p)}</option>`).join('')}</select>
   <div class="recon-pix-fields"><div>${paymentDateField('reconPixDate','Data do recebimento')}</div><div><label for="reconPixAmount">Valor recebido (R$)</label><div class="recon-quick-amount"><input id="reconPixAmount" name="amount" inputmode="decimal" type="text" required placeholder="0,00"><button type="button" class="secondary" data-recon-fill-total aria-label="Preencher o total em aberto desta pessoa" disabled>Total</button></div></div></div>
   <label class="recon-check"><input name="inBaseline" type="checkbox"> Este Pix já está incluído no saldo inicial.</label>
   <fieldset class="recon-allocations"><legend>Distribuir entre dívidas</legend><div data-recon-allocations></div><p class="recon-allocation-summary" data-recon-unallocated aria-live="polite"></p></fieldset>
   <p class="recon-message" data-recon-form-message role="status"></p><div class="recon-actions"><button type="submit" class="primary">Registrar Pagamento</button><button type="button" class="secondary" data-recon-cancel>Cancelar</button></div>
   </form>`;
 }
 function allocations(form){
   const p=form.elements.person.value;
   const items=debts.map((d,index)=>({...d,index})).filter(d=>d.remaining>0&&norm(d.person)===norm(p));
   const totalButton=$('[data-recon-fill-total]',form);
   if(totalButton)totalButton.disabled=!items.length;
   $('[data-recon-allocations]',form).innerHTML=items.length?groupByMonth(items).map(([month,rows])=>`<details class="recon-debt-month recon-allocation-month"><summary><span>${monthTitle(month)}<small data-recon-assigned-month="${month}" hidden></small></span><strong>${brl(rows.reduce((n,d)=>n+d.remaining,0))} <small>em aberto</small></strong></summary><div class="recon-allocation-lines">${rows.map(d=>`<div class="recon-allocation"><label for="reconDebt-${d.index}">${escape(d.name)}<small>${brl(d.remaining)} em aberto${d.number&&d.count?' · '+d.number+'/'+d.count:''}${!statement(d.month)&&d.month>=api.today.slice(0,7)?' · Prevista':''}</small></label><div class="recon-quick-amount"><input id="reconDebt-${d.index}" type="text" inputmode="decimal" aria-label="Valor para ${escape(d.name)} em ${monthTitle(d.month)}" data-recon-debt="${d.index}" placeholder="0,00"><button type="button" class="secondary" data-recon-fill-debt="${d.index}" aria-label="Preencher total de ${escape(d.name)} em ${monthTitle(month)}">Total</button></div></div>`).join('')}</div></details>`).join(''):'<p class="recon-note">Selecione a pessoa para ver as dívidas.</p>';
   preview(form);
 }
 function autofill(form,only){
   if(form?.dataset.reconForm!=='receipt'||!form.elements.person.value)return;
   let total=0;
   for(const field of form.querySelectorAll('[data-recon-debt]')){
     const i=Number(field.dataset.reconDebt), d=debts[i];
     if(!d||d.remaining<=0||norm(d.person)!==norm(form.elements.person.value)||(only!==undefined&&i!==only))continue;
     total+=d.remaining;field.value=coin(d.remaining).replace('.',',');
   }
   if(only===undefined&&total>0)form.elements.amount.value=coin(total).replace('.',',');
   preview(form);
 }
 function preview(form){
   if(form?.dataset.reconForm==='receipt'){
     const t=cents(form.elements.amount.value);
     const byMonth=new Map();
     const used=[...form.querySelectorAll('[data-recon-debt]')].reduce((n,x)=>{
       const c=cents(x.value)||0,month=debts[Number(x.dataset.reconDebt)]?.month;
       if(month)byMonth.set(month,(byMonth.get(month)||0)+c);
       return n+c;
     },0);
     for(const summary of form.querySelectorAll('[data-recon-assigned-month]')){
       const amount=byMonth.get(summary.dataset.reconAssignedMonth)||0;
       summary.hidden=!amount;summary.textContent=amount?`Distribuído: ${brl(amount)}`:'';
     }
     $('[data-recon-unallocated]',form).textContent=t>0?(t<used?`Distribuído: ${brl(used)} de ${brl(t)} · excede em ${brl(used-t)}.`:t===used?`Total distribuído: ${brl(t)}.`:`Distribuído: ${brl(used)} de ${brl(t)} · falta ${brl(t-used)}.`):'';
   }else if(form?.dataset.reconForm==='label'){
     const r=displayed.find(x=>x.id===editing);
     if(!r||form.elements.divided.value!=='yes')return;
     const unit=form.elements.unit?.value||'amount',raw=[...form.querySelectorAll('[name=partCents]')].map(x=>cents(x.value)||0),entered=raw.reduce((n,x)=>n+x,0);
     const parts=roundedParts(raw,r.cents,unit),used=parts?.reduce((n,x)=>n+x,0);
     const text=used===undefined||used>r.cents?'A divisão passa do total da linha.':`Sua parte: ${brl(r.cents-used)}.`;
     $('[data-recon-left]',form).textContent=unit==='percent'?`${coin(entered).replace('.',',')}% distribuídos. ${text}`:text;
   }
 }
 let preservingPosition=false;
 function keepPosition(work){
   if(!api?.keepPosition||preservingPosition)return work();
   return api.keepPosition(()=>{
     preservingPosition=true;
     try{return work();}
     finally{preservingPosition=false;}
   });
 }
 function paint(){return keepPosition(paintWork);}
 function paintWork(){
   if(!root)return;
   if(api.parcel){
     const {row,month}=api.parcel;period=month;displayed=[row];editing=row.id;formKind='label';
     root.innerHTML=`<h2>Classificar compra</h2><p class="assistive">Use o valor de uma parcela (${brl(row.cents)}, fatura de ${monthTitle(month)}). A classificação vale para todas as parcelas da compra.</p>${editor(row)}`;
     preview($('[data-recon-form="label"]',root));return;
   }
   period=period||initialPeriod();
   currentPayables=tab==='debt'&&moneyTab==='payable'?payableRows():[];
   root.innerHTML='<p class="recon-message" data-recon-message role="status"></p>'+(tab==='bill'?bill():moneyViews());
   const pix=$('[data-recon-form="receipt"]',root);if(pix)allocations(pix);
   const edit=$('[data-recon-form="label"]',root);if(edit)preview(edit);
 }
 async function apply(fn,confirmed){
   if(busy)return;
   busy=true;
   let result;
   try{result=await fn();}catch(e){result={ok:false,error:e.message};}
   busy=false;
   if(result===true||result?.ok){if(api.parcel){api.closeParcel?.(confirmed);return;}close();error(confirmed,'ok');}
   else error(result?.error||'Não foi possível salvar. Confira os dados e tente novamente.');
 }
 function syncPixDate(input){
   const label=$('[data-recon-date-label]',input.form);
   if(label)label.textContent=safeDate(input.value)?when(input.value):'Selecionar data';
 }
 function bind(dom){
  dom.addEventListener('click',e=>{
   const b=e.target.closest('button');if(!b||busy)return;
   if(b.hasAttribute('data-recon-money')){if(b.dataset.reconMoney!==moneyTab){selectMoney(b.dataset.reconMoney);paint();}return;}
   if(b.hasAttribute('data-recon-edit-tab'))return keepPosition(()=>{
     const panel=b.dataset.reconEditTab,label=$('#reconLineLabelPanel',root),value=$('#reconLineValuePanel',root);
     if(!label||!value||!['label','adjust-installment'].includes(panel))return;
     formKind=panel;
     label.hidden=panel!=='label';value.hidden=panel!=='adjust-installment';
     for(const button of root.querySelectorAll('[data-recon-edit-tab]')){
       const active=button.dataset.reconEditTab===panel;
       button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
     }
     error('');
   });
   if(b.hasAttribute('data-recon-edit-refund')){
     const row=displayed[Number(b.dataset.reconEditRefund)];
     if(!canEditCredit(row))return;
     editing=row.id;formKind='refund';paint();return;
   }
   if(b.hasAttribute('data-recon-reset-bank-credit')){
     const r=displayed.find(x=>x.id===editing);
     if(formKind==='refund'&&r&&bankCredit(r)&&api.editBankCredit)apply(()=>api.editBankCredit(period,r.id,null),'Valor original restaurado.');
     return;
   }
   if(b.hasAttribute('data-recon-delete-refund')){
     if(formKind==='refund'&&api.editRefund&&window.confirm('Excluir este estorno da fatura?'))apply(()=>api.editRefund(period,editing,null),'Estorno excluído.');
     return;
   }
   if(b.hasAttribute('data-recon-exclude')){
     const item=displayed.find(x=>x.id===editing);if(formKind!=='adjust-installment'||!item||!api.canAdjust?.(period))return;
     if(window.confirm('Excluir esta parcela e as próximas em aberto a partir de '+monthTitle(period)+'? Esta exclusão não tem opção de desfazer na fatura.'))apply(()=>api.adjustInstallment(period,item.id,0),'Parcelas excluídas a partir de '+monthTitle(period)+'.');
     return;
   }
   if(b.hasAttribute('data-recon-edit')){
     const item=displayed[Number(b.dataset.reconEdit)];if(!item)return;editing=item.id;formKind='label';paint();return;
   }
   if(b.hasAttribute('data-recon-payable-start')){
     if(moneyTab!=='payable'||!currentPayables.some(x=>!x.paidDate))return;
     editing=null;formKind='payable-start';paint();return;
   }
   if(b.hasAttribute('data-recon-undo-payable')){
     const row=currentPayables[Number(b.dataset.reconUndoPayable)];
     if(!row?.paidDate||!api.setPayable)return;
     if(window.confirm('Desfazer o registro deste Pix? O pagamento voltará a ficar em aberto.'))apply(()=>api.setPayable(row.id,row.month,null),'Registro do Pix desfeito.');
     return;
   }
   if(b.hasAttribute('data-recon-delete-pix')){if(api.deleteReceipt&&window.confirm('Desfazer este Pix no diário? As dívidas vinculadas voltarão a ficar em aberto.'))apply(()=>api.deleteReceipt(b.dataset.reconDeletePix),'Registro do Pix removido.');return;}
   if(b.hasAttribute('data-recon-fill-total')){autofill(b.form);return;}
   if(b.hasAttribute('data-recon-fill-debt')){autofill(b.form,Number(b.dataset.reconFillDebt));return;}
   
   if(b.hasAttribute('data-recon-pix')){editing=null;formKind='receipt';paint();return;}
   if(b.hasAttribute('data-recon-cancel')){close();return;}
   if(b.hasAttribute('data-recon-clear')){
     const r=displayed.find(x=>x.id===editing),name=r?.name;
     if(r)apply(()=>api.label(period,r.id,null,[],'all',name),'Classificação limpa.');
     return;
   }
   if(b.hasAttribute('data-recon-add'))return keepPosition(()=>{
     const people=b.form.querySelector('[data-recon-people]');if(people.children.length>=50)return;
     people.insertAdjacentHTML('beforeend',personRow('',0,true,false,b.form.elements.unit.value));
     preview(b.form);
   });
   if(b.hasAttribute('data-recon-remove'))return keepPosition(()=>{
     const f=b.form, container=$('[data-recon-people]',f);if(container.children.length>1)b.closest('.recon-share').remove();else for(const x of b.closest('.recon-share').querySelectorAll('input'))x.value='';preview(f);
   });
  });
  dom.addEventListener('change',e=>{
    const el=e.target;
    if(el.id==='reconBillFilter'||el.id==='reconBillSort')return keepPosition(()=>{
      if(el.id==='reconBillSort'){
        if(!isBillSort(el.value))return;
        billSort=el.value;const control=el.closest('.recon-sort-control');
        if(control)control.dataset.sorted=String(billSort!=='original');
        try{localStorage.setItem(billSortKey,billSort);}catch{}
      }else billFilter=el.value;
      editing=null;formKind='';
      billList(api.rows(period)||[]);
      const list=$('#reconBillRows',root);
      if(list)list.innerHTML=billRows();
    });
    if(el.name==='divided')return keepPosition(()=>{
      const f=el.form,show=f.elements.divided.value==='yes',shares=$('.recon-shares',f);
      shares.hidden=!show;$('.recon-owner',f).hidden=show;
      for(const x of shares.querySelectorAll('input'))x.disabled=!show;
      if(show&&!$('[name=person]',shares)?.value&&f.elements.owner.value.trim()&&!isOwner(f.elements.owner.value))$('[name=person]',shares).value=f.elements.owner.value.trim();
      preview(f);
    });
    if(el.id==='reconUnit'){
      const f=el.form,r=displayed.find(x=>x.id===editing),fields=[...f.querySelectorAll('[name=partCents]')], values=fields.map(x=>cents(x.value)||0);
      const base=el.dataset.previousUnit==='percent'?10000:r?.cents||0,total=el.value==='percent'?10000:r?.cents||0,used=values.reduce((n,x)=>n+x,0);
      const next=used<=base?spread([...values,base-used],total,base):[];
      fields.forEach((x,i)=>{x.value=next[i]?coin(next[i]):'';x.placeholder=el.value==='percent'?'0,00%':'0,00';x.setAttribute('aria-label',el.value==='percent'?'Percentual desta pessoa':'Valor desta pessoa (R$)');});
      el.dataset.previousUnit=el.value;preview(f);return;
    }
    if(el.id==='reconPerson')return keepPosition(()=>{personFilter=el.value;el.form.elements.amount.value='';allocations(el.form);});
    if(el.id==='reconPixDate'||el.id==='reconPayableDate')syncPixDate(el);
  });
  dom.addEventListener('input',e=>{const f=e.target.form;if(e.target.id==='reconPixDate'||e.target.id==='reconPayableDate')syncPixDate(e.target);if(f)preview(f);});
  dom.addEventListener('toggle',e=>{const k=e.target.dataset?.reconGroup;if(k===undefined||!e.target.isConnected)return;if(e.target.open)openGroups.add(k);else openGroups.delete(k);},true);
  dom.addEventListener('submit',e=>{
    const f=e.target;if(!f.dataset.reconForm)return;e.preventDefault();error('');
    if(f.dataset.reconForm==='refund'){
      const r=displayed.find(x=>x.id===editing);
      if(formKind!=='refund'||!canEditCredit(r))return;
      const bank=bankCredit(r),edit=bank?api.editBankCredit:api.editRefund;
      const name=f.elements.description.value.trim(),date=f.elements.date.value,value=cents(f.elements.amount.value);
      if(!name||name.length>(bank?250:120)||!safeDate(date)||date>api.today||!Number.isSafeInteger(value)||value<=0||value>1e12){error('Confira a descrição, a data e o valor.');return;}
      apply(()=>edit(period,r.id,{name,date,cents:value}),'Lançamento atualizado.');return;
    }
    if(f.dataset.reconForm==='adjust-installment'){
      const r=displayed.find(x=>x.id===editing),value=cents(f.elements.value.value);
      if(formKind!=='adjust-installment'||!r||!api.canAdjust?.(period)||!Number.isSafeInteger(value)||value<=0||value>1e12){error('Informe um valor positivo para a parcela.');return;}
      apply(()=>api.adjustInstallment(period,r.id,value),'Parcela ajustada a partir de '+monthTitle(period)+'.');return;
    }
    if(f.dataset.reconForm==='payable-start'){
      if(formKind!=='payable-start')return;
      const selected=f.elements.payableIndex?.value;
      const r=/^\d+$/.test(selected??'')?currentPayables[Number(selected)]:null;
      const d=f.elements.date.value;
      if(!r||r.paidDate){error('Selecione uma dívida em aberto.');return;}
      if(!safeDate(d)||d>api.today){error('Informe a data do pagamento, até hoje.');return;}
      apply(()=>api.setPayable(r.id,r.month,d),'Pagamento registrado.');return;
    }
    if(f.dataset.reconForm==='label'){
      const r=displayed.find(x=>x.id===editing);if(!r)return;
      const shared=f.elements.divided.value==='yes',scope='all',unit=f.elements.unit?.value||'amount',name=f.elements.lineName?.value.trim();
      if(!name||name.length>250){error('Informe o nome do lançamento.');return;}
      let parts=[],label=null,ownerName;
      if(!shared){
        const owner=f.elements.owner.value.trim();
        if(owner&&isOwner(owner)){label='mine';ownerName=owner;}
        else if(owner){label='other';parts=[{person:owner,cents:r.cents}];}
      }else{
        const shares=[...f.querySelectorAll('.recon-share')].map(x=>({person:$('[name=person]',x).value.trim(),raw:cents($('[name=partCents]',x)?.value)}));
        if(!shares.length||shares.some(x=>!x.person||isOwner(x.person)||!Number.isSafeInteger(x.raw)||x.raw<=0)||new Set(shares.map(x=>norm(x.person))).size!==shares.length){error('Informe nomes distintos e um valor positivo para cada pessoa. Sua parte é calculada pelo restante.');return;}
        const raw=shares.map(x=>x.raw),converted=roundedParts(raw,r.cents,unit);
        if(!converted){error('Os percentuais não podem passar de 100%.');return;}
        parts=converted.map((c,i)=>({person:shares[i].person,cents:c}));
        const used=parts.reduce((n,x)=>n+x.cents,0);
        if(used>r.cents||parts.some(x=>x.cents<=0)){error('A divisão não pode ultrapassar o total e deve ter pelo menos R$ 0,01 para cada pessoa.');return;}
        label=used===r.cents?'other':'split';
      }
      apply(()=>api.label(period,r.id,label||null,parts,scope,name,ownerName),'Lançamento atualizado.');
    }else {
      const {person,date,amount,inBaseline}=f.elements;
      const total=cents(amount.value);
      if(!safeDate(date.value)||date.value>api.today||!(total>0)||!person.value){error('Confira a pessoa, a data e o valor do Pix.');return;}
      const allocations=[];
      for(const el of f.querySelectorAll('[data-recon-debt]')){
        if(!el.value.trim())continue;
        const c=cents(el.value),d=debts[Number(el.dataset.reconDebt)];
        if(!d||!(c>0)||c>d.remaining||norm(d.person)!==norm(person.value)){error('Confira os valores destinados às dívidas.');return;}
        allocations.push({rowId:d.rowId,month:d.month,cents:c});
      }
      if(allocations.reduce((n,a)=>n+a.cents,0)!==total){error('Distribua o valor inteiro do Pix nas dívidas escolhidas.');return;}
      apply(()=>api.receipt({id:crypto.randomUUID(),date:date.value,person:person.value,cents:total,inBaseline:inBaseline.checked,allocations}),'Pix registrado.');
    }
  });
 }
 return {parcelLabels(row,owner){return classificationNames(row,owner).map(chip).join('');},reset,selectMoney,selectBill(month){if(!safeMonth(month))return;period=month;tab='bill';reset();},render(options){
   const dom=$(options.parcel?'#parcelReconUI':'#reconUI');if(!dom)return;
   api=options;
   if(!api.parcel){
     const view=api.view==='debt'?'debt':'bill';
     const month=safeMonth(api.month)?api.month:period||initialPeriod();
     if(view!==tab||month!==period){reset();tab=view;period=month;}
   }
   if(root!==dom){root=dom;bind(dom);}paint();
 }};
}
window.ReconUI=createReconUI();
window.ParcelReconUI=createReconUI();
