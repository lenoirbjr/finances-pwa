# Finanças 3.8 — GitHub Pages / PWA

Aplicativo local (IndexedDB), sem backend. Importação dos backups da 3.7 preservada (formato `version: 8`). Não publique backups pessoais no repositório público.

## Motor financeiro

- Saldo de abertura = dinheiro já existente na data informada; nada antes dessa data é reconstruído.
- Salário programado dia 30, ou último dia do mês; entrada extra na data lançada.
- Fatura e fixos programados dia 05; gastos à vista na data lançada; novas parcelas entram na fatura sem lançamento duplicado.
- Aporte mensal programado dia 30, exceto se registrado como realizado antecipadamente. Aporte extra é saída adicional.
- Margem é piso de caixa, não retirada da conta.
- Disponível para o ciclo = parte não negativa do caixa atual que mantém o piso de margem em todos os pontos de fluxo projetado até o terceiro crédito salarial futuro. Os salários futuros são utilizados apenas para testar se cobrem futuras obrigações; não são creditados ao saldo atual.
- Referência diária = valor disponível / dias corridos até o próximo salário (contando hoje, excluindo o dia do crédito).
- Até domingo = referência diária × dias restantes até domingo, incluindo hoje, limitado pelo prazo do próximo salário e pelo disponível do ciclo.
- Valores são estimativas baseadas na hipótese de recebimento e pagamento pontuais. Não substituem conciliação bancária ou fundo de emergência.

## Atualização

Substituir os oito arquivos na raiz do repositório. Não remover o PWA, não limpar armazenamento e exportar um backup antes. Versão do cache: 3.8.0.

## Testes indicados

1. Checar o saldo de abertura e os aportes já lançados.
2. Entrada extra no meio do ciclo deve elevar saldo e orçamento.
3. Compra à vista reduz o saldo, a referência diária e até domingo.
4. Fatura de 05/12 não deve reduzir saldo antes da data. No dia 30 o salário deve ser somado e o aporte padrão abatido uma única vez.
5. Exportar/importar e testar offline antes de usar dados definitivos.
