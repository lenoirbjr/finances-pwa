# Finanças 3.5 — registro local de orçamento e caixa

PWA estático. IndexedDB; nenhuma transmissão financeira para servidores. Não coloque dados pessoais no GitHub.

## Migração

Estados versão 6 são migrados para 7 e copiados sob `state-before-v3.5`. O estado anterior e os itens permanecem intactos. Backup JSON v7 inclui abertura, entradas extras, confirmações de caixa, registros e detalhamento.

## Regras

- Abertura: saldo bancário acessível na data inicial, não receita.
- Extras: entrada positiva datada, aumenta o caixa estimado e o saldo acumulado semanal somente após a data; não altera salário recorrente.
- Gastos à vista e investimentos extras: diminuem caixa estimado e orçamento semanal uma vez.
- Salário/fatura/fixos/investimentos mensais: o orçamento mensal já os contempla; no caixa bancário só passam a valer após confirmação manual, pelo valor e data efetivos. NÃO os lançar também em gasto semanal.
- Parcelas novas: comprometem orçamento dos meses indicados, sem reduzir o caixa no ato da compra. Confirmar pagamento da fatura para refletir no caixa.
- Teto prudente: menor entre saldo bancário estimado (pelos registros) e saldo semanal; não é garantia de liquidez futura. Verifique obrigações pendentes antes de gastar.
- Datas de vencimento de despesas fixas não são conhecidas. O app não supõe que foram pagas por passagem do tempo.
- Entradas extras feitas antes da abertura não são somadas ao caixa, mas podem integrar controle semanal se dentro da semana inicial. Evite registros anteriores ao marco zero.

## Segurança e uso

Exportar backup ANTES de atualizar. Não remover PWA nem limpar o armazenamento. Service Worker v3.5 atualiza cache por versão; IndexedDB não é cópia de segurança permanente.
