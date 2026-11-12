# Finanças 3.9 — Atualização do PWA

Mantém o banco IndexedDB e o formato `version: 8`, com campos opcionais `fixedItems[].day` e `fixedPaid[]`; backups anteriores continuam importáveis.

## O que mudou
- Planejamento: meses acima da composição, escolha pelo cartão, título estático, categorias expansíveis e valores em ordem decrescente.
- Despesas fixas: `day` (dia de débito; padrão 5 para registros anteriores).
- Pagamentos realizados: confirmação individual de despesas fixas e do investimento mensal. O planejamento desconta as obrigações independentemente da confirmação; o caixa só cai quando o pagamento é marcado. Fatura e salário continuam automáticos, como acordado.
- O limite de consumo protege obrigações vencidas e ainda não marcadas, e compromissos futuros.

## Cuidados
- Uma marcação hoje registra a saída hoje; não marque novamente despesas já refletidas no saldo de abertura.
- Aporte antecipado já registrado em `monthlyPaid` aparece como pago, sem desconto duplicado.
- Antes de publicar, exporte backup. Substitua os oito arquivos na raiz do GitHub Pages. Não publique o JSON com dados pessoais.
- O saldo permanece estimado, sem integração bancária. Para pagamentos passados antes do saldo de abertura, considere-os incluídos no saldo inicial.
