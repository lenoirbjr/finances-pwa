# Finanças 3.12.3 — Proteção da próxima fatura

Atualização pontual do motor de orçamento, sem alteração do formato de backup (versão 8) ou IndexedDB.

- A próxima fatura considera as parcelas antigas e novas do mês, os fixos pendentes desse mês, o investimento planejado e a margem protegida.
- O próximo salário somente é usado na cobertura se ainda não tiver sido creditado na data da consulta.
- Se os compromissos ultrapassarem essa renda, a diferença é reservada do saldo atual para os limites de consumo.
- O **saldo estimado** permanece o caixa efetivo projetado, sem tratar a reserva como despesa paga.
- O limite até o próximo salário, a referência diária e o orçamento até domingo obedecem ao novo teto.
- A proteção de caixa por data e as demais regras da 3.12.2 permanecem como verificações adicionais.

Exemplo do backup de 12/11/2026: fatura 12/2026 = R$ 3.550,28; despesas fixas = R$ 842,00; aporte planejado = R$ 792,00; margem = R$ 264,00; salário 30/11 = R$ 5.274,46; reserva adicional = R$ 173,82.

Para atualizar: exporte backup no aplicativo, substitua os oito arquivos no GitHub Pages, aguarde a publicação e abra com internet para carregar o novo Service Worker. Não limpe os dados locais.
