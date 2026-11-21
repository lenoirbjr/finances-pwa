'use strict';
/* UI local de rateios e recebimentos. O modelo financeiro grava cada operação. */
(function(){
 const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
 const dateFormat=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'});
 const monthFormat=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});
 const esc=value=>String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const cents=value=>Math.round(value*100);
 const brl=c=>money.format(c/100);
 const day=d=>dateFormat.format(new Date(d+'T12:00:00Z'));
 const month=m=>{const x=monthFormat.format(new Date(m+'-01T12:00:00Z'));return x[0].toUpperCase()+x.slice(1)};
 const kinds={expense:'Lançamento',fixed:'Despesa fixa',new:'Parcela',base:'Parcela anterior'};
 const filters=[['all','Todos'],['pending','Em aberto'],['scheduled','Agendados'],['paid','Quitados'],['direct','Pagamento separado']];
 let model=null, visibleRows=[], root=null, selectedMonth='all', selectedStatus='all', editor=null, editingPayment=null, busy=false, pendingFocus=null;
 const opened=new Map();
 const describe=(row,now)=>{
   const payments=(row.payments||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
   const received=payments.reduce((sum,p)=>sum+(p.date<=now?cents(p.amount):0),0);
   const due=cents(row.other),remaining=row.fronted?Math.max(0,due-received):0;
   const available=row.fronted?Math.max(0,due-payments.reduce((sum,p)=>sum+cents(p.amount),0)):0;
   const future=row.date>now;
   const status=!row.fronted?'direct':remaining===0?'paid':future?'scheduled':'pending';
   const label=!row.fronted?'Cada um paga sua parte':remaining===0?'Quitado':future?(received?'Agendado · parcial':'Agendado'):(received?'Parcial':'Em aberto');
   return {...row,payments,received,remaining,available,future,status,label};
 };
 const toggleMonths=()=>{
   for(const el of root.querySelectorAll('details[data-shared-month]')) opened.set(el.dataset.sharedMonth,el.open);
   for(const el of root.querySelectorAll('details[data-shared-ledger]')) opened.set('ledger:'+el.dataset.sharedLedger,el.open);
 };
 function rowHtml(row,i){
   const title=esc(row.name);
   const caption=esc(row.detail||kinds[row.kind]||'Gasto');
   const receiptLedger=row.payments.length?`<details class="shared-ledger" data-shared-ledger="${esc(row.key)}" ${(opened.get('ledger:'+row.key)||editor===row.key)?'open':''}><summary>Recebimentos (${row.payments.length})</summary>
     ${row.payments.map((p,j)=>`<div class="shared-receipt"><time datetime="${esc(p.date)}">${day(p.date)}</time><strong>${brl(cents(p.amount))}</strong>${model.editPayment?`<button class="text-button shared-action" type="button" data-shared-action="correct" data-shared-row="${i}" data-shared-payment="${j}" aria-label="Corrigir recebimento de ${day(p.date)} para ${title}">Corrigir</button>`:''}<button class="text-button shared-action" type="button" data-shared-action="remove" data-shared-row="${i}" data-shared-payment="${j}" aria-label="Excluir recebimento de ${day(p.date)} para ${title}">Excluir</button></div>`).join('')}</details>`:'';
   const selected=editor===row.key;
   const payment=selected?row.payments.find(p=>p.id===editingPayment):null;
   const max=payment?row.available+cents(payment.amount):row.available;
   const form=selected?`<form class="shared-payment-form" data-shared-row="${i}">
     <div class="shared-payment-fields">
      <div><label for="sharedPaymentDate">Data em que recebeu</label><input id="sharedPaymentDate" type="date" name="date" value="${esc(payment?.date||model.today)}" max="${esc(model.today)}" required></div>
      <div><label for="sharedPaymentAmount">Valor recebido (R$)</label><input id="sharedPaymentAmount" type="number" name="amount" min="0.01" max="${(max/100).toFixed(2)}" step="0.01" inputmode="decimal" value="${((payment?cents(payment.amount):max)/100).toFixed(2)}" required></div>
     </div>
     <p class="shared-small">Use a data em que o valor entrou na sua conta.</p>
     <div class="shared-form-actions"><button class="primary" type="submit" ${busy?'disabled':''}>${payment?'Salvar correção':'Confirmar recebimento'}</button><button type="button" class="text-button shared-action" data-shared-action="cancel" data-shared-row="${i}" ${busy?'disabled':''}>Cancelar</button></div>
   </form>`:'';
   return `<article class="shared-row"><div class="shared-row-title"><div><h3>${title}</h3><p>${caption} · <time datetime="${esc(row.date)}">${day(row.date)}</time></p></div><span class="shared-badge" data-status="${row.status}">${row.label}</span></div>
     <dl class="shared-row-metrics"><div><dt>Total</dt><dd>${brl(cents(row.gross))}</dd></div><div><dt>Sua parte</dt><dd>${brl(cents(row.own))}</dd></div><div><dt>Outra parte</dt><dd>${brl(cents(row.other))}</dd></div>${row.fronted?`<div><dt>Recebido</dt><dd>${brl(row.received)}</dd></div><div><dt>${row.future?'Previsto a receber':'Falta receber'}</dt><dd>${brl(row.remaining)}</dd></div>`:''}</dl>
     ${receiptLedger}
     ${row.fronted&&row.available&&!selected?`<button class="secondary shared-action" type="button" data-shared-action="add" data-shared-row="${i}" aria-label="Registrar recebimento de ${title}">Registrar recebimento</button>`:''}
     ${row.payments.some(p=>p.date>model.today)?'<p class="shared-small">Recebimentos com data futura ainda não entram no saldo. Confira as datas em Recebimentos.</p>':''}
     ${form}</article>`;
 }
 function paint(scroll=true){
   if(!root||!model)return;
   toggleMonths();
   const now=model.today;
   const all=model.rows.map(row=>describe(row,now)).sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name,'pt-BR'));
   const months=[...new Set(all.map(row=>row.date.slice(0,7)))].sort().reverse();
   if(selectedMonth!=='all'&&!months.includes(selectedMonth))selectedMonth='all';
   const scope=all.filter(row=>selectedMonth==='all'||row.date.startsWith(selectedMonth));
   const totals=scope.reduce((t,row)=>{
      t.received+=row.received;
      if(row.future)t.scheduled+=row.remaining;else t.pending+=row.remaining;
      return t;
   },{received:0,scheduled:0,pending:0});
   const rows=scope.filter(row=>selectedStatus==='all'||row.status===selectedStatus);
   visibleRows=rows;
   const groups=new Map();
   rows.forEach((r,i)=>{const m=r.date.slice(0,7);if(!groups.has(m))groups.set(m,[]);groups.get(m).push([r,i]);});
   const cur=now.slice(0,7);
   const ordered=[...groups.keys()].sort((a,b)=>(a<=cur&&b<=cur)?b.localeCompare(a):(a<=cur?-1:b<=cur?1:a.localeCompare(b)));
   root.innerHTML=`<div class="section-heading"><h1>Gastos conjuntos</h1><p>Veja sua parte e acompanhe os reembolsos, parcela por parcela.</p></div>
   <div class="surface shared-screen">
    <div class="shared-tools">
      <div><label for="sharedFilterMonth">Mês do gasto ou da fatura</label><select id="sharedFilterMonth"><option value="all">Todos os meses</option>${months.map(m=>`<option value="${m}" ${m===selectedMonth?'selected':''}>${month(m)}</option>`).join('')}</select></div>
      <div><label for="sharedFilterStatus">Situação</label><select id="sharedFilterStatus">${filters.map(([value,label])=>`<option value="${value}" ${value===selectedStatus?'selected':''}>${label}</option>`).join('')}</select></div>
    </div>
    <dl class="shared-totals"><div><dt>Em aberto</dt><dd>${brl(totals.pending)}</dd></div><div><dt>Já recebido</dt><dd>${brl(totals.received)}</dd></div><div><dt>Previsto a receber</dt><dd>${brl(totals.scheduled)}</dd></div></dl>
    <p class="assistive shared-help">Os totais seguem o mês do gasto ou da fatura. Se você adiantar o total, o app reserva a despesa inteira. O reembolso entra no saldo só após ser registrado, na data recebida. Não registre o mesmo valor também como entrada extra.</p>
    <p class="shared-feedback" role="status"></p>
    ${ordered.length?ordered.map((m,i)=>`<details class="shared-month" data-shared-month="${m}" ${(opened.get(m)??(m===cur||i===0||selectedMonth!=='all'))?'open':''}><summary><strong>${month(m)}</strong><span>${groups.get(m).length} ${groups.get(m).length===1?'item':'itens'}</span></summary>${groups.get(m).map(([r,j])=>rowHtml(r,j)).join('')}</details>`).join(''):`<p class="empty">${all.length?'Nenhum gasto com esses filtros.':'Nenhum gasto dividido ainda. Para começar, informe a sua porcentagem ao lançar uma despesa.'}</p>`}
   </div>`;
   if(scroll&&pendingFocus){
      const el=root.querySelector(pendingFocus); pendingFocus=null;
      if(el)el.focus({preventScroll:false});
   }
 }
 function feedback(text){const el=root.querySelector('.shared-feedback');if(el)el.textContent=text;}
 async function saveOperation(operation,ok){
   let succeeded=false,error='';
   try{const result=await operation();succeeded=result===true||result?.ok===true;error=typeof result?.error==='string'?result.error:'';}
   catch{}
   busy=false;
   if(succeeded){editor=null;editingPayment=null;paint();feedback(ok);}
   else {const submit=root.querySelector('.shared-payment-form button[type=submit]');if(submit)submit.disabled=false;feedback(error||'Não foi possível salvar. Confira o valor e a data e tente de novo.');}
 }
 function bind(node){
   node.addEventListener('change',event=>{
      if(!['sharedFilterMonth','sharedFilterStatus'].includes(event.target.id))return;
      if(event.target.id==='sharedFilterMonth')selectedMonth=event.target.value;
      else selectedStatus=event.target.value;
      editor=null;editingPayment=null;pendingFocus='#'+event.target.id;paint();
   });
   node.addEventListener('click',async event=>{
     const button=event.target.closest?.('[data-shared-action]');
     if(!button||busy)return;
     const row=visibleRows[Number(button.dataset.sharedRow)];
     if(!row)return;
     const action=button.dataset.sharedAction;
     if(action==='cancel'){
        editor=null;editingPayment=null;pendingFocus=`[data-shared-row="${button.dataset.sharedRow}"][data-shared-action="add"]`;paint();return;
     }
     if(action==='add'){
       editor=row.key;editingPayment=null;pendingFocus='#sharedPaymentAmount';paint();return;
     }
     const p=row.payments[Number(button.dataset.sharedPayment)];
     if(!p)return;
     if(action==='correct'&&model.editPayment){
       editor=row.key;editingPayment=p.id;pendingFocus='#sharedPaymentAmount';paint();return;
     }
     if(action==='remove'&&window.confirm('Excluir este recebimento? O valor voltará a ficar em aberto e sairá do saldo na data registrada.')){
       busy=true;
       await saveOperation(()=>model.removePayment(row.key,p.id),'Recebimento excluído.');
     }
   });
   node.addEventListener('submit',async event=>{
     const form=event.target.closest?.('.shared-payment-form');
     if(!form)return;
     event.preventDefault();
     if(busy||!form.reportValidity())return;
     const row=visibleRows[Number(form.dataset.sharedRow)];
     if(!row||row.key!==editor)return;
     const date=form.elements.namedItem('date').value;
     const amount=Number(form.elements.namedItem('amount').value.replace(',','.'));
     if(!date||date>model.today||!Number.isFinite(amount)||amount<=0)return;
     const id=editingPayment;
     busy=true;form.querySelector('button[type=submit]').disabled=true;
     await saveOperation(()=>id?model.editPayment(row.key,id,date,amount):model.addPayment(row.key,date,amount),id?'Recebimento corrigido.':'Recebimento registrado.');
   });
 }
 window.SharedExpenses={render(options){
    const el=document.getElementById('sharedExpenses');
    if(!el)return;
    if(root!==el){root=el;bind(el);}
    model=options;
    paint(!busy);
 }};
})();
