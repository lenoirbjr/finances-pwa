'use strict';
window.ReconUI=(()=>{
 const $=(sel,within=document)=>within.querySelector(sel), escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
 const brl=c=>money.format((c||0)/100);
 const monthTitle=m=>new Date(m+'-01T12:00:00Z').toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});
 const coin=c=>((c||0)/100).toFixed(2);
 const cents=v=>{const s=String(v??'').trim().replace(',','.');return /^\d{1,12}(\.\d{1,2})?$/.test(s)?Math.round(Number(s)*100):NaN;};
 const safeDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 const safeMonth=m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m);
 const when=d=>escape((d||'').split('-').reverse().join('/'));
 const labels={mine:'Minha',other:'De outra pessoa',split:'Dividida'};
 const partName=p=>p.person??p.name??'';
 const partValue=p=>p.cents??0;
 const norm=x=>String(x||'').trim().normalize('NFC').toLocaleLowerCase('pt-BR');
 const knownLabel=x=>Object.hasOwn(labels,x)?x:'';
 const sourceNames={statement:'Extrato do cartão',forecast:'Previsão',legacy:'Planejamento anterior'};
 const statement=m=>{const obj=api.state?.reconciliation?.statements||{};return Array.isArray(obj)?obj.find(x=>x.month===m):obj[m];};
 const initialPeriod=()=>{const now=api.today.slice(0,7);return months().filter(m=>m>=now&&statement(m)).sort()[0]||now;};
 const charge=r=>r.kind==='charge'&&r.cents>0;
 let api,root,tab='bill',period='',editing=null,formKind='',personFilter='',busy=false,displayed=[],debts=[],openHistory=false;
 function months(){
   const obj=api.state?.reconciliation?.statements||{};
   return [...new Set([...(api.months||[]),...(Array.isArray(obj)?obj.map(x=>x.month):Object.keys(obj)),api.today.slice(0,7),period].filter(safeMonth))].sort().reverse();
 }
 function close(){editing=null;formKind='';personFilter='';paint();}
 function error(t){const el=$('[data-recon-message]',root);if(el)el.textContent=t;}
 function header(){
   return `<div class="section-heading recon-heading"><div><p class="recon-kicker">ORGANIZAÇÃO DO CARTÃO</p><h1>${tab==='bill'?'Fatura':'A receber'}</h1><p>${tab==='bill'?'Classifique linha por linha, sem tirar valores da fatura.':'Acompanhe o que cada pessoa deve e registre o Pix quando cair.'}</p></div></div>
   <nav class="subtabs recon-tabs" aria-label="Fatura e recebimentos"><button data-recon-tab="bill" aria-pressed="${tab==='bill'}" type="button">Fatura</button><button data-recon-tab="debt" aria-pressed="${tab==='debt'}" type="button">A receber</button></nav><p class="recon-message" data-recon-message role="status"></p>`;
 }
 function bill(){
   const all=api.rows(period)||[];displayed=all;
   const total=all.reduce((v,r)=>v+(r.kind==='prior-payment'?0:r.cents),0);
   const parts=all.filter(charge);
   const due=statement(period)?.dueDate??statement(period)?.due??(statement(period)?period+'-05':'');
   const mine=parts.reduce((v,r)=>v+(r.label==='mine'?r.cents:(!r.label?0:r.cents-(r.parts||[]).filter(p=>partName(p)).reduce((n,p)=>n+partValue(p),0))),0);
   const assigned=parts.reduce((v,r)=>v+(r.label==='other'||r.label==='split'?(r.parts||[]).filter(p=>partName(p)).reduce((n,p)=>n+partValue(p),0):0),0);
   const unassigned=parts.reduce((v,r)=>v+(r.label?0:r.cents),0);
   return `<div class="surface recon-screen">
   <div class="recon-period"><label for="reconMonth">Mês da fatura</label><div class="recon-month-controls"><button type="button" data-recon-shift="-1" aria-label="Mês anterior">‹</button><input id="reconMonth" type="month" value="${period}" list="reconMonths"><button type="button" data-recon-shift="1" aria-label="Mês seguinte">›</button></div><datalist id="reconMonths">${months().map(m=>`<option value="${m}">${monthTitle(m)}</option>`).join('')}</datalist></div>
   <dl class="recon-totals"><div><dt>Total da fatura</dt><dd>${brl(total)}</dd></div><div><dt>Minha parte</dt><dd>${brl(mine)}</dd></div><div><dt>De outras pessoas</dt><dd>${brl(assigned)}</dd></div><div><dt>Sem etiqueta</dt><dd>${brl(unassigned)}</dd></div></dl>
   <p class="recon-note">${safeDate(due)?`<strong>Vencimento: ${when(due)}.</strong> `:statement(period)?'':'<strong>Previsão, sem fatura importada para este mês.</strong> '}As etiquetas informam de quem é cada gasto. O valor a pagar ao cartão continua integral.</p>
   ${statement(period)&&api.markPaid?payment():''}
   <div class="recon-rows">${all.length?all.map((r,i)=>{
    const name=escape(r.name),label=knownLabel(r.label),part=r.number&&r.count?` · Parcela ${r.number}/${r.count}`:'';
    return `<article class="recon-row"><div><strong>${name}</strong><small>${when(r.date)}${part}${sourceNames[r.source]?' · '+sourceNames[r.source]:''}</small><span class="recon-tag" data-label="${label}">${r.kind==='prior-payment'?'Pagamento anterior · sem impacto':r.kind==='credit'?'Crédito ou estorno':labels[label]||'Sem etiqueta'}</span></div><div class="recon-row-amount"><strong>${brl(r.cents)}</strong>${charge(r)?`<button type="button" class="secondary" data-recon-edit="${i}" aria-label="Classificar ${name}">${label?'Alterar':'Classificar'}</button>`:''}</div></article>${editing===r.id&&formKind==='label'?editor(r):''}`;
   }).join(''):'<p class="empty">Nenhuma linha nesta fatura.</p>'}</div>
   </div>`;
 }
 function payment(){
   const p=api.paid?.(period),date=typeof p==='string'?p:p?.date;
   if(date)return `<div class="recon-paid"><strong>Fatura paga em ${when(date)}</strong><button type="button" class="secondary" data-recon-unpay>Desfazer</button></div>`;
   return `<form class="recon-paid" data-recon-form="pay"><label for="reconPayDate">Data do pagamento</label><input id="reconPayDate" type="date" name="date" value="${api.today}" max="${api.today}" required><button type="submit" class="secondary">Marcar como paga</button></form>`;
 }
 function personRow(person='',c=0,showValue=true,disabled=false){
   return `<div class="recon-share"><input name="person" aria-label="Nome da pessoa" placeholder="Nome da pessoa" maxlength="100" value="${escape(person)}" required ${disabled?'disabled':''}>${showValue?`<input name="partCents" aria-label="Valor desta pessoa" type="text" inputmode="decimal" placeholder="0,00" value="${c?coin(c):''}" required>`:''}<button type="button" data-recon-remove aria-label="Remover pessoa">×</button></div>`;
 }
 function editor(r){
   const label=knownLabel(r.label)||'mine';
   const rows=(r.parts||[]).filter(p=>partName(p)).filter(p=>!p.mine);
   return `<form class="recon-edit" data-recon-form="label" aria-label="Classificação do lançamento">
      <label for="reconLabel">Responsabilidade</label><select id="reconLabel" name="label"><option value="">Sem etiqueta</option>${Object.entries(labels).map(([id,name])=>`<option value="${id}" ${id===label?'selected':''}>${name}</option>`).join('')}</select>
      <div class="recon-shares" ${label==='other'||label==='split'?'':'hidden'}><p class="recon-note">Informe o valor de cada outra pessoa. Se dividida, o restante é a sua parte.</p><div data-recon-people>${rows.length?rows.map(p=>personRow(partName(p),partValue(p),['other','split'].includes(label))).join(''):personRow('',label==='other'?r.cents:0,['other','split'].includes(label),label!=='other'&&label!=='split')}</div><button type="button" class="secondary" data-recon-add ${['other','split'].includes(label)?'':'hidden'}>+ Pessoa</button><p class="recon-note" data-recon-left></p></div>
      ${r.count>1?`<label for="reconScope">Aplicar a</label><select id="reconScope" name="scope"><option value="one">Só esta parcela</option><option value="future">Esta e as próximas</option></select>`:''}
      <div class="recon-actions"><button type="submit" class="primary">Salvar classificação</button><button type="button" class="secondary" data-recon-cancel>Cancelar</button></div>
    </form>`;
 }
 function debt(){
   debts=api.debt()||[];
   const accounts=api.accounts||api.state?.reconciliation?.baseline?.accounts||[{id:'digital',name:'Conta digital'},{id:'inter',name:'Inter'},{id:'other',name:'Outra conta'}];
   const list=[...new Map(debts.filter(x=>x.remaining>0).map(x=>[norm(x.person),x.person])).values()];
   const byPerson=new Map();
   for(const d of debts){const p=norm(d.person);if(!byPerson.has(p))byPerson.set(p,[]);byPerson.get(p).push(d);}
   const filtered=[...byPerson.values()];
   const receipts=api.state?.reconciliation?.receipts||[];
   return `<div class="surface recon-screen"><dl class="recon-totals"><div><dt>Em aberto</dt><dd>${brl(debts.reduce((n,d)=>n+d.remaining,0))}</dd></div><div><dt>Já recebido</dt><dd>${brl(debts.reduce((n,d)=>n+d.received,0))}</dd></div></dl><p class="recon-note">O valor só entra no caixa quando você registra o Pix. Um Pix que já estava no saldo informado quita a dívida, sem aumentar o caixa pela segunda vez.</p>
   ${list.length?'<button class="primary recon-pix" type="button" data-recon-pix>Registrar Pix</button>':''}
   ${formKind==='receipt'?receiptForm(list,accounts):''}
   <div class="recon-rows">${filtered.length?filtered.map(group=>`<section class="recon-person-group"><h2>${escape(group[0].person)}</h2>${group.map(d=>`<article class="recon-row"><div><strong>${escape(d.name)}</strong><small>${escape(monthTitle(d.month))}${d.number&&d.count?` · Parcela ${d.number}/${d.count}`:''}${!statement(d.month)&&d.month>=api.today.slice(0,7)?' · Prevista':''}</small></div><div class="recon-row-amount"><strong>${brl(d.remaining)}</strong><small>${d.remaining===0?'Quitado':d.received?brl(d.received)+' já recebido':'Pendente'}</small></div></article>`).join('')}</section>`).join(''):'<p class="empty">Nenhum valor a receber. Classifique uma linha da fatura para começar.</p>'}</div>
   <details class="recon-history" data-recon-history ${openHistory?'open':''}><summary>Histórico de Pix ${receipts.length?(`(${receipts.length})`):''}</summary>${receipts.length?receipts.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<article class="recon-row"><div><strong>${escape(r.person)}</strong><small>${when(r.date)} · ${escape(accounts.find(a=>a.id===r.accountId)?.name||'Conta não identificada')}${r.inBaseline?' · Já no saldo inicial':''}</small><small>${(r.allocations||[]).map(a=>`${escape(debts.find(d=>d.rowId===a.rowId&&d.month===a.month&&norm(d.person)===norm(r.person))?.name||'Linha da fatura')}: ${brl(a.cents)}`).join(' · ')}</small></div><div class="recon-row-amount"><strong>${brl(r.cents)}</strong>${api.deleteReceipt?`<button type="button" class="secondary" data-recon-delete-pix="${escape(r.id)}">Desfazer</button>`:''}</div></article>`).join(''):'<p class="empty">Nenhum Pix registrado.</p>'}</details></div>`;
 }
 function receiptForm(list,accounts){
   return `<form class="recon-edit" data-recon-form="receipt" aria-label="Registrar Pix recebido"><label for="reconPerson">De quem veio</label><select id="reconPerson" name="person" required><option value="">Selecione</option>${list.map(p=>`<option ${norm(p)===norm(personFilter)?'selected':''}>${escape(p)}</option>`).join('')}</select>
   <div class="recon-fields"><div><label for="reconPixDate">Data recebida</label><input id="reconPixDate" name="date" type="date" value="${api.today}" max="${api.today}" required></div><div><label for="reconPixAmount">Valor do Pix (R$)</label><input id="reconPixAmount" name="amount" inputmode="decimal" type="text" required placeholder="0,00"></div></div>
   <label for="reconAccount">Conta onde caiu</label><select id="reconAccount" name="accountId" required><option value="">Selecione a conta</option>${accounts.map(a=>`<option value="${escape(a.id)}">${escape(a.name)}</option>`).join('')}</select>
   <label class="recon-check"><input name="inBaseline" type="checkbox"> Este Pix já está incluído no saldo inicial.</label>
   <fieldset class="recon-allocations"><legend>Quanto deste Pix vai para cada dívida?</legend><div data-recon-allocations></div><p class="recon-note" data-recon-unallocated></p></fieldset>
   <div class="recon-actions"><button type="submit" class="primary" ${accounts.length?'':'disabled'}>Registrar recebimento</button><button type="button" class="secondary" data-recon-cancel>Cancelar</button></div>
   ${accounts.length?'':'<p class="recon-note">Cadastre ou importe uma conta no saldo inicial antes de registrar o Pix.</p>'}</form>`;
 }
 function allocations(form){
   const p=form.elements.person.value;
   const items=debts.map((d,index)=>({...d,index})).filter(d=>d.remaining>0&&norm(d.person)===norm(p));
   $('[data-recon-allocations]',form).innerHTML=items.length?items.map(d=>`<label class="recon-allocation"><span>${escape(d.name)}<small>${escape(monthTitle(d.month))}: ${brl(d.remaining)} em aberto</small></span><input type="text" inputmode="decimal" aria-label="Valor para ${escape(d.name)} em ${escape(monthTitle(d.month))}" data-recon-debt="${d.index}" placeholder="0,00"></label>`).join(''):'<p class="recon-note">Selecione a pessoa para ver as dívidas.</p>';
   preview(form);
 }
 function preview(form){
   if(form?.dataset.reconForm==='receipt'){
     const t=cents(form.elements.amount.value);
     const used=[...form.querySelectorAll('[data-recon-debt]')].reduce((n,x)=>n+(cents(x.value)||0),0);
     $('[data-recon-unallocated]',form).textContent=Number.isFinite(t)?`Distribuído: ${brl(used)} de ${brl(t)}.`:'';
   }else if(form?.dataset.reconForm==='label'){
     const r=displayed.find(x=>x.id===editing), l=form.elements.label.value;
     if(!r||!['other','split'].includes(l))return;
     const used=[...form.querySelectorAll('[name=partCents]')].reduce((n,x)=>n+(cents(x.value)||0),0);
     $('[data-recon-left]',form).textContent=used>r.cents?'Os valores passam do total da linha.':l==='other'?`Distribuído: ${brl(used)} de ${brl(r.cents)}.`:`Sua parte: ${brl(r.cents-used)}.`;
   }
 }
 function paint(){
   if(!root)return;
   period=period||initialPeriod();
   root.innerHTML=header()+(tab==='bill'?bill():debt());
   const pix=$('[data-recon-form="receipt"]',root);if(pix)allocations(pix);
   const edit=$('[data-recon-form="label"]',root);if(edit)preview(edit);
 }
 async function apply(fn,confirmed){
   if(busy)return;
   busy=true;
   let result;
   try{result=await fn();}catch(e){result={ok:false,error:e.message};}
   busy=false;
   if(result===true||result?.ok){close();error(confirmed);}
   else error(result?.error||'Não foi possível salvar. Confira os dados e tente novamente.');
 }
 function bind(dom){
  dom.addEventListener('click',e=>{
   const b=e.target.closest('button');if(!b||busy)return;
   if(b.dataset.reconShift){const [y,m]=period.split('-').map(Number),d=new Date(Date.UTC(y,m-1+Number(b.dataset.reconShift),1));period=d.toISOString().slice(0,7);close();return;}
   if(b.dataset.reconTab){tab=b.dataset.reconTab;editing=null;formKind='';personFilter='';paint();return;}
   if(b.hasAttribute('data-recon-edit')){
     const item=displayed[Number(b.dataset.reconEdit)];if(!item)return;editing=item.id;formKind='label';paint();$('#reconLabel',root)?.focus();return;
   }
   if(b.hasAttribute('data-recon-delete-pix')){if(api.deleteReceipt&&window.confirm('Desfazer este Pix no diário? As dívidas vinculadas voltarão a ficar em aberto.'))apply(()=>api.deleteReceipt(b.dataset.reconDeletePix),'Registro do Pix removido.');return;}
   if(b.hasAttribute('data-recon-unpay')){if(window.confirm('Desfazer a marcação de pagamento desta fatura?'))apply(()=>api.markPaid(period,null),'Marcação removida.');return;}
   if(b.hasAttribute('data-recon-pix')){formKind='receipt';paint();$('#reconPerson',root)?.focus();return;}
   if(b.hasAttribute('data-recon-cancel')){close();return;}
   if(b.hasAttribute('data-recon-add')){
     const people=b.form.querySelector('[data-recon-people]');if(people.children.length>=50)return;
     people.insertAdjacentHTML('beforeend',personRow());
     b.form.querySelector('.recon-share:last-child input').focus();return;
   }
   if(b.hasAttribute('data-recon-remove')){
     const f=b.form, container=$('[data-recon-people]',f);if(container.children.length>1)b.closest('.recon-share').remove();else for(const x of b.closest('.recon-share').querySelectorAll('input'))x.value='';preview(f);
   }
  });
  dom.addEventListener('change',e=>{
    const el=e.target;
    if(el.id==='reconMonth'&&safeMonth(el.value)){period=el.value;close();return;}
    if(el.id==='reconLabel'){
      const f=el.form, shares=$('.recon-shares',f), people=$('[data-recon-people]',f), show=['other','split'].includes(el.value),r=displayed.find(x=>x.id===editing);
      const kept=[...people.querySelectorAll('.recon-share')].map(r=>[$('[name=person]',r).value,cents($('[name=partCents]',r)?.value)||0]);
      shares.hidden=!['other','split'].includes(el.value);
      people.innerHTML=(show?kept:kept.slice(0,1)).map(([p,c],i)=>personRow(p,el.value==='other'&&kept.length===1&&!c&&i===0?r?.cents||0:c,show)).join('');
      for(const input of people.querySelectorAll('input'))input.disabled=shares.hidden;
      $('[data-recon-add]',f).hidden=!show;preview(f);return;
    }
    if(el.id==='reconPerson'){personFilter=el.value;allocations(el.form);}
  });
  dom.addEventListener('input',e=>{const f=e.target.form;if(f)preview(f);});
  dom.addEventListener('toggle',e=>{if(e.target.hasAttribute?.('data-recon-history'))openHistory=e.target.open;},true);
  dom.addEventListener('submit',e=>{
    const f=e.target;if(!f.dataset.reconForm)return;e.preventDefault();error('');
    if(f.dataset.reconForm==='pay'){
      const date=f.elements.date.value;if(!safeDate(date)||date>api.today){error('Confira a data de pagamento.');return;}
      apply(()=>api.markPaid(period,date),'Pagamento da fatura registrado.');return;
    }
    if(f.dataset.reconForm==='label'){
      const r=displayed.find(x=>x.id===editing);if(!r)return;
      const label=f.elements.label.value, scope=f.elements.scope?.value||'one';
      const shares=[...f.querySelectorAll('.recon-share')].map(x=>({person:$('[name=person]',x).value.trim(),cents:cents($('[name=partCents]',x)?.value)}));
      const parts=['other','split'].includes(label)?shares:[];
      if(label==='other'&&parts.length===1&&!Number.isFinite(parts[0].cents))parts[0].cents=r.cents;
      if(label==='other'&&parts.reduce((n,x)=>n+x.cents,0)!==r.cents){error('Distribua o valor inteiro da linha entre as pessoas.');return;}
      if(parts.some(x=>!x.person||!(x.cents>0))||new Set(parts.map(x=>norm(x.person))).size!==parts.length||parts.reduce((n,x)=>n+x.cents,0)>r.cents||(label==='split'&&parts.reduce((n,x)=>n+x.cents,0)>=r.cents)){error('Confira os nomes e valores. A divisão não pode ultrapassar o total.');return;}
      apply(()=>api.label(period,r.id,label||null,parts,scope),'Classificação salva.');
    }else {
      const {person,date,amount,accountId,inBaseline}=f.elements;
      const total=cents(amount.value);
      if(!safeDate(date.value)||date.value>api.today||!(total>0)||!person.value||!accountId.value){error('Confira a pessoa, a data, a conta e o valor do Pix.');return;}
      const allocations=[];
      for(const el of f.querySelectorAll('[data-recon-debt]')){
        if(!el.value.trim())continue;
        const c=cents(el.value),d=debts[Number(el.dataset.reconDebt)];
        if(!d||!(c>0)||c>d.remaining||norm(d.person)!==norm(person.value)){error('Confira os valores destinados às dívidas.');return;}
        allocations.push({rowId:d.rowId,month:d.month,cents:c});
      }
      if(allocations.reduce((n,a)=>n+a.cents,0)!==total){error('Distribua o valor inteiro do Pix nas dívidas escolhidas.');return;}
      apply(()=>api.receipt({id:crypto.randomUUID(),date:date.value,accountId:accountId.value,person:person.value,cents:total,inBaseline:inBaseline.checked,allocations}),'Pix registrado.');
    }
  });
 }
 return {render(options){
   const dom=$('#reconUI');if(!dom)return;api=options;if(root!==dom){root=dom;bind(dom);}paint();
 }};
})();
