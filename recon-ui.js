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
 const personHue=name=>{let h=2166136261;for(const c of norm(name)){h=Math.imul(h^c.codePointAt(0),16777619);}return (h>>>0)%48;};
 const chip=name=>`<span class="recon-person-chip" data-person-color="${personHue(name)}">${escape(name)}</span>`;
 function classificationButton(r,i){
   const parts=(r.parts||[]).filter(x=>partName(x));
   const names=r.label==='mine'?['Eu']:r.label==='split'?['Eu',...parts.map(partName)]:r.label==='other'?parts.map(partName):[];
   return `<button type="button" class="recon-classification ${names.length?'has-people':'is-unclassified'}" data-recon-edit="${i}" aria-label="${names.length?'Editar classificação':'Classificar'}: ${escape(r.name)}${names.length?' ('+escape(names.join(', '))+')':''}">${names.length?names.map(chip).join(''):'Classificar'}</button>`;
 }
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
 let api,root,tab='bill',period='',editing=null,formKind='',personFilter='',busy=false,displayed=[],debts=[],openHistory=false;
 function months(){
   const obj=api.state?.reconciliation?.statements||{};
   return [...new Set([...(api.months||[]),...(Array.isArray(obj)?obj.map(x=>x.month):Object.keys(obj)),api.today.slice(0,7),period].filter(safeMonth))].sort().reverse();
 }
 function close(){editing=null;formKind='';personFilter='';paint();}
 function error(t){const el=$('[data-recon-form-message]',root)||$('[data-recon-message]',root);if(el)el.textContent=t;}
 function header(){
   return `<div class="section-heading recon-heading"><div><p class="recon-kicker">ORGANIZAÇÃO DO CARTÃO</p><h1>${tab==='bill'?'Fatura':'A receber'}</h1>${tab==='debt'?'<p>Acompanhe o que cada pessoa deve e registre o Pix quando cair.</p>':''}</div></div>
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
   <div class="recon-period"><label for="reconMonth">Mês da fatura</label>
    <div class="recon-month-controls">
     <button type="button" data-recon-shift="-1" aria-label="Mês anterior">‹</button>
     <select id="reconMonth" aria-label="Mês da fatura">${months().map(m=>`<option value="${m}" ${m===period?'selected':''}>${monthTitle(m)}</option>`).join('')}</select>
     <button type="button" data-recon-shift="1" aria-label="Mês seguinte">›</button>
    </div></div>
   <dl class="recon-totals"><div><dt>Total da fatura</dt><dd>${brl(total)}</dd></div><div><dt>Minha parte</dt><dd>${brl(mine)}</dd></div><div><dt>De outras pessoas</dt><dd>${brl(assigned)}</dd></div><div><dt>Sem etiqueta</dt><dd>${brl(unassigned)}</dd></div></dl>
   <p class="recon-due">Vencimento: <strong>${when(safeDate(due)?due:period+'-05')}</strong></p>
   <div class="recon-rows">${all.length?all.map((r,i)=>{
    const name=escape(r.name),part=r.number&&r.count?` · Parcela ${r.number}/${r.count}`:'';
    return `<article class="recon-row recon-card-line"><div><strong>${name}</strong><small>${when(r.date)}${part}</small>${r.kind==='prior-payment'?'<small>Pagamento anterior · sem impacto</small>':r.kind==='credit'?'<small>Crédito ou estorno</small>':''}</div><div class="recon-row-amount"><strong>${brl(r.cents)}</strong>${charge(r)?classificationButton(r,i):''}</div></article>${editing===r.id&&formKind==='label'?editor(r):''}`;
   }).join(''):'<p class="empty">Nenhuma linha nesta fatura.</p>'}</div></div>`;
 }
 function personRow(person='',c=0,showValue=true,disabled=false,unit='amount'){
   return `<div class="recon-share"><input name="person" aria-label="Nome da pessoa" placeholder="Nome da pessoa" maxlength="100" value="${escape(person)}" required ${disabled?'disabled':''}>${showValue?`<input name="partCents" aria-label="${unit==='percent'?'Percentual desta pessoa':'Valor desta pessoa (R$)'}" type="text" inputmode="decimal" placeholder="${unit==='percent'?'0,00%':'0,00'}" value="${c?coin(c):''}" required ${disabled?'disabled':''}>`:''}<button type="button" data-recon-remove aria-label="Remover pessoa">×</button></div>`;
 }
 function editor(r){
   const label=knownLabel(r.label), rows=(r.parts||[]).filter(p=>partName(p)).filter(p=>!p.mine);
   const shared=label==='split'||(label==='other'&&rows.length>1);
   const owner=label==='mine'?'Eu':(!shared&&rows.length?partName(rows[0]):'');
   return `<form class="recon-edit" data-recon-form="label" aria-label="Classificação do lançamento">
      <label for="reconLineName">Nome do lançamento</label><input id="reconLineName" name="lineName" maxlength="250" value="${escape(r.name)}" required>
      <fieldset class="recon-divided"><legend>Dividi?</legend><label><input type="radio" name="divided" value="no" ${!shared?'checked':''}> Não</label><label><input type="radio" name="divided" value="yes" ${shared?'checked':''}> Sim</label></fieldset>
      <div class="recon-owner" ${shared?'hidden':''}><label for="reconOwner">De quem é o gasto?</label><div class="recon-owner-control"><input id="reconOwner" name="owner" maxlength="100" placeholder="Seu nome ou de outra pessoa" value="${escape(owner)}"><button type="button" class="secondary" data-recon-own>Eu</button></div><p class="recon-note">Em branco, o lançamento fica sem classificação.</p></div>
      <div class="recon-shares" ${shared?'':'hidden'}><label for="reconUnit">Dividir por</label><select id="reconUnit" name="unit" data-previous-unit="amount"><option value="amount">Valor em reais (R$)</option><option value="percent">Percentual (%)</option></select><p class="recon-note">Informe a parte de cada outra pessoa. O restante é a sua parte.</p><div data-recon-people>${rows.length?rows.map(p=>personRow(partName(p),partValue(p),true,!shared)).join(''):personRow('',0,true,!shared)}</div><button type="button" class="secondary" data-recon-add>+ Pessoa</button><p class="recon-note" data-recon-left></p></div>
      ${r.count>1?`<label for="reconScope">Aplicar a</label><select id="reconScope" name="scope"><option value="one">Só esta parcela</option><option value="future">Esta e as próximas</option></select>`:''}
      <p class="recon-message" data-recon-form-message role="status"></p><div class="recon-actions"><button type="submit" class="primary">Salvar</button><button type="button" class="secondary" data-recon-cancel>Cancelar</button>${label?'<button type="button" class="secondary" data-recon-clear>Limpar classificação</button>':''}</div>
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
   ${list.length&&formKind!=='receipt'?'<button class="primary recon-pix" type="button" data-recon-pix>Registrar Pix</button>':''}
   ${formKind==='receipt'?receiptForm(list,accounts):''}
   <div class="recon-rows">${filtered.length?filtered.map(group=>`<section class="recon-person-group"><h2>${escape(group[0].person)}</h2>${group.map(d=>`<article class="recon-row"><div><strong>${escape(d.name)}</strong><small>${escape(monthTitle(d.month))}${d.number&&d.count?` · Parcela ${d.number}/${d.count}`:''}${!statement(d.month)&&d.month>=api.today.slice(0,7)?' · Prevista':''}</small></div><div class="recon-row-amount"><strong>${brl(d.remaining)}</strong><small>${d.remaining===0?'Quitado':d.received?brl(d.received)+' já recebido':'Pendente'}</small></div></article>`).join('')}</section>`).join(''):'<p class="empty">Nenhum valor a receber. Classifique uma linha da fatura para começar.</p>'}</div>
   <details class="recon-history" data-recon-history ${openHistory?'open':''}><summary>Histórico de Pix ${receipts.length?(`(${receipts.length})`):''}</summary>${receipts.length?receipts.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<article class="recon-row"><div><strong>${escape(r.person)}</strong><small>${when(r.date)} · ${escape(accounts.find(a=>a.id===r.accountId)?.name||'Conta não identificada')}${r.inBaseline?' · Já no saldo inicial':''}</small><small>${(r.allocations||[]).map(a=>`${escape(debts.find(d=>d.rowId===a.rowId&&d.month===a.month&&norm(d.person)===norm(r.person))?.name||'Linha da fatura')}: ${brl(a.cents)}`).join(' · ')}</small></div><div class="recon-row-amount"><strong>${brl(r.cents)}</strong>${api.deleteReceipt?`<button type="button" class="secondary" data-recon-delete-pix="${escape(r.id)}">Desfazer</button>`:''}</div></article>`).join(''):'<p class="empty">Nenhum Pix registrado.</p>'}</details></div>`;
 }
 function receiptForm(list,accounts){
   return `<form class="recon-edit recon-receipt-form" data-recon-form="receipt" aria-label="Registrar Pix recebido"><h2>Registrar Pix recebido</h2><label for="reconPerson">De quem veio</label><select id="reconPerson" name="person" required><option value="">Selecione</option>${list.map(p=>`<option ${norm(p)===norm(personFilter)?'selected':''}>${escape(p)}</option>`).join('')}</select>
   <div class="recon-pix-fields"><div><label for="reconPixDate">Data do recebimento</label><input id="reconPixDate" name="date" type="date" value="${api.today}" max="${api.today}" required></div><div><label for="reconPixAmount">Valor recebido (R$)</label><input id="reconPixAmount" name="amount" inputmode="decimal" type="text" required placeholder="0,00"></div></div>
   <label for="reconAccount">Conta onde caiu</label><select id="reconAccount" name="accountId" required><option value="">Selecione a conta</option>${accounts.map(a=>`<option value="${escape(a.id)}">${escape(a.name)}</option>`).join('')}</select>
   <label class="recon-check"><input name="inBaseline" type="checkbox"> Este Pix já está incluído no saldo inicial.</label>
   <fieldset class="recon-allocations"><legend>Distribuir entre dívidas</legend><div data-recon-allocations></div><p class="recon-allocation-summary" data-recon-unallocated aria-live="polite">Informe o valor do Pix.</p></fieldset>
   <p class="recon-message" data-recon-form-message role="status"></p><div class="recon-actions"><button type="submit" class="primary" ${accounts.length?'':'disabled'}>Registrar recebimento</button><button type="button" class="secondary" data-recon-cancel>Cancelar</button></div>
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
     $('[data-recon-unallocated]',form).textContent=Number.isFinite(t)?(t<used?`Distribuído: ${brl(used)} de ${brl(t)} · excede em ${brl(used-t)}.`:`Distribuído: ${brl(used)} de ${brl(t)} · falta ${brl(t-used)}.`):'Informe o valor do Pix.';
   }else if(form?.dataset.reconForm==='label'){
     const r=displayed.find(x=>x.id===editing);
     if(!r||form.elements.divided.value!=='yes')return;
     const unit=form.elements.unit?.value||'amount',raw=[...form.querySelectorAll('[name=partCents]')].map(x=>cents(x.value)||0),entered=raw.reduce((n,x)=>n+x,0);
     const parts=roundedParts(raw,r.cents,unit),used=parts?.reduce((n,x)=>n+x,0);
     const text=used===undefined||used>r.cents?'A divisão passa do total da linha.':`Sua parte: ${brl(r.cents-used)}.`;
     $('[data-recon-left]',form).textContent=unit==='percent'?`${coin(entered).replace('.',',')}% distribuídos. ${text}`:text;
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
     const item=displayed[Number(b.dataset.reconEdit)];if(!item)return;editing=item.id;formKind='label';paint();$('#reconLineName',root)?.focus();return;
   }
   if(b.hasAttribute('data-recon-delete-pix')){if(api.deleteReceipt&&window.confirm('Desfazer este Pix no diário? As dívidas vinculadas voltarão a ficar em aberto.'))apply(()=>api.deleteReceipt(b.dataset.reconDeletePix),'Registro do Pix removido.');return;}
   
   if(b.hasAttribute('data-recon-pix')){formKind='receipt';paint();$('#reconPerson',root)?.focus();return;}
   if(b.hasAttribute('data-recon-cancel')){close();return;}
   if(b.hasAttribute('data-recon-own')){b.form.elements.owner.value='Eu';b.form.elements.owner.focus();return;}
   if(b.hasAttribute('data-recon-clear')){
     const r=displayed.find(x=>x.id===editing),name=b.form.elements.lineName.value.trim()||r?.name;
     if(r)apply(()=>api.label(period,r.id,null,[],b.form.elements.scope?.value||'one',name),'Classificação limpa.');
     return;
   }
   if(b.hasAttribute('data-recon-add')){
     const people=b.form.querySelector('[data-recon-people]');if(people.children.length>=50)return;
     people.insertAdjacentHTML('beforeend',personRow('',0,true,false,b.form.elements.unit.value));
     b.form.querySelector('.recon-share:last-child input').focus();return;
   }
   if(b.hasAttribute('data-recon-remove')){
     const f=b.form, container=$('[data-recon-people]',f);if(container.children.length>1)b.closest('.recon-share').remove();else for(const x of b.closest('.recon-share').querySelectorAll('input'))x.value='';preview(f);
   }
  });
  dom.addEventListener('change',e=>{
    const el=e.target;
    if(el.id==='reconMonth'&&safeMonth(el.value)){period=el.value;close();return;}
    if(el.name==='divided'){
      const f=el.form,show=f.elements.divided.value==='yes',shares=$('.recon-shares',f);
      shares.hidden=!show;$('.recon-owner',f).hidden=show;
      for(const x of shares.querySelectorAll('input'))x.disabled=!show;
      if(show&&!$('[name=person]',shares)?.value&&f.elements.owner.value.trim()&&norm(f.elements.owner.value)!=='eu')$('[name=person]',shares).value=f.elements.owner.value.trim();
      preview(f);return;
    }
    if(el.id==='reconUnit'){
      const f=el.form,r=displayed.find(x=>x.id===editing),fields=[...f.querySelectorAll('[name=partCents]')], values=fields.map(x=>cents(x.value)||0);
      const base=el.dataset.previousUnit==='percent'?10000:r?.cents||0,total=el.value==='percent'?10000:r?.cents||0,used=values.reduce((n,x)=>n+x,0);
      const next=used<=base?spread([...values,base-used],total,base):[];
      fields.forEach((x,i)=>{x.value=next[i]?coin(next[i]):'';x.placeholder=el.value==='percent'?'0,00%':'0,00';x.setAttribute('aria-label',el.value==='percent'?'Percentual desta pessoa':'Valor desta pessoa (R$)');});
      el.dataset.previousUnit=el.value;preview(f);return;
    }
    if(el.id==='reconPerson'){personFilter=el.value;allocations(el.form);}
  });
  dom.addEventListener('input',e=>{const f=e.target.form;if(f)preview(f);});
  dom.addEventListener('toggle',e=>{if(e.target.hasAttribute?.('data-recon-history'))openHistory=e.target.open;},true);
  dom.addEventListener('submit',e=>{
    const f=e.target;if(!f.dataset.reconForm)return;e.preventDefault();error('');
    if(f.dataset.reconForm==='label'){
      const r=displayed.find(x=>x.id===editing);if(!r)return;
      const shared=f.elements.divided.value==='yes',scope=f.elements.scope?.value||'one',unit=f.elements.unit?.value||'amount',name=f.elements.lineName?.value.trim();
      if(!name||name.length>250){error('Informe o nome do lançamento.');return;}
      let parts=[],label=null;
      if(!shared){
        const owner=f.elements.owner.value.trim();
        if(norm(owner)==='eu')label='mine';
        else if(owner){label='other';parts=[{person:owner,cents:r.cents}];}
      }else{
        const shares=[...f.querySelectorAll('.recon-share')].map(x=>({person:$('[name=person]',x).value.trim(),raw:cents($('[name=partCents]',x)?.value)}));
        if(!shares.length||shares.some(x=>!x.person||norm(x.person)==='eu'||!Number.isSafeInteger(x.raw)||x.raw<=0)||new Set(shares.map(x=>norm(x.person))).size!==shares.length){error('Informe nomes distintos e um valor positivo para cada pessoa. Sua parte é calculada pelo restante.');return;}
        const raw=shares.map(x=>x.raw),converted=roundedParts(raw,r.cents,unit);
        if(!converted){error('Os percentuais não podem passar de 100%.');return;}
        parts=converted.map((c,i)=>({person:shares[i].person,cents:c}));
        const used=parts.reduce((n,x)=>n+x.cents,0);
        if(used>r.cents||parts.some(x=>x.cents<=0)){error('A divisão não pode ultrapassar o total e deve ter pelo menos R$ 0,01 para cada pessoa.');return;}
        label=used===r.cents?'other':'split';
      }
      apply(()=>api.label(period,r.id,label||null,parts,scope,name),'Lançamento atualizado.');
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
