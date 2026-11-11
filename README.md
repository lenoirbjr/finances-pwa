# Finanças 3.6.1

PWA local-first hospedado no GitHub Pages. O IndexedDB armazena os registros no dispositivo. O repositório público não recebe dados financeiros.

## Uso
- **Semana:** gastos à vista, entradas extraordinárias e limite de consumo acumulado.
- **Parcelas:** novas compras parceladas.
- **Planejamento:** composição por mês e próximos 12 meses.
- **Ajustes:** saldo inicial, renda por vigência, investimento mensal e extra, margem, despesas fixas e parcelas-base, backup.

## Saldo estimado
A partir do saldo de abertura, a projeção adiciona o salário todo dia 30 (ou último dia do mês, se não houver dia 30), deduz o investimento mensal no mesmo dia, e deduz fatura e despesas fixas no dia 5. Entradas extraordinárias, gastos à vista e aportes extras são aplicados nas respectivas datas. Eventos na data exata da abertura não são repetidos. O saldo é uma estimativa, não uma reconciliação com o banco. As datas dos fixos são uma convenção de projeção, não seus vencimentos efetivos.

Ao atualizar o saldo de abertura, o app redefine o marco do saldo estimado. A opção separada **Início do controle semanal** continua sendo o marco das cotas. Não há lançamento manual de recebimento/pagamento de salário ou fatura.

## Dados existentes
O formato de armazenamento da versão 3.5 (versão interna 7) foi mantido para preservar atualizações e backups. Registros manuais de caixa feitos na 3.5 permanecem dentro do backup, mas não são incorporados ao cálculo automático para evitar duplicidade. Exportar backup antes de atualizar.

## Limitações
A equivalência semanal utiliza 12/52 do orçamento mensal; trata-se de orçamento, não de extrato. Os cálculos automáticos pressupõem que os recebimentos e pagamentos ocorram nas datas previstas. Se não acontecerem, o saldo estimado diverge do real. Faça backup periódico.

## Interface de Ajustes
Todas as sete seções agora são recolhíveis. Datas de vigência das configurações e início do controle semanal continuam independentes. Nenhum dado ou fórmula foi alterado.
