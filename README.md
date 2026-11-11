# Finanças 3.7 — Uso no iPhone

PWA estático para GitHub Pages. Os dados são armazenados localmente no IndexedDB.

## O que mudou
- Saldo estimado em destaque, com orçamento seguro para gastar abaixo. Nunca somar os dois.
- Removido o indicador Livre no mês da tela principal; composição mensal permanece em Planejamento.
- Orçamento semanal de consumo limitado pelo saldo estimado e pelas obrigações previstas até o próximo salário.
- Aporte mensal padrão realizado antes do dia 30 pode ser marcado em Ajustes → Investimento extra realizado. Só sai do saldo uma vez: na data real ou, sem confirmação, no dia 30.
- Investimentos extras são lançamentos distintos do aporte mensal.
- Gravação local IndexedDB: backups exportados incluem os itens detalhados, perfis e aportes antecipados.

## Backup fornecido separadamente
O JSON `financas-leno-v3-7-atualizado.json` é privado e **não deve ser enviado ao repositório GitHub público**. O arquivo preserva todos os itens do backup enviado, os R$ 4 extras já registrados e acrescenta o aporte mensal de R$ 792 realizado em 11/11/2026. Com saldo inicial R$ 4.862,20, o caixa após os aportes é R$ 4.066,20.

## Regras
- A data de abertura é interpretada como começo do dia, antes das movimentações registradas naquela data.
- Salário entra no dia 30 (último dia em fevereiro). Fatura e fixos saem no dia 5.
- Investimento mensal é subtraído no dia 30, a menos que tenha um registro de realização antecipada.
- O orçamento semanal é uma regra de consumo, não uma entrada no caixa; não se soma ao saldo estimado.
- Os pagamentos reais podem divergir de eventos presumidos. Backups periódicos continuam necessários.
- Atualizações antigas (formato interno 7) são migradas para formato 8, preservando um snapshot no IndexedDB.

## Publicação
Envie somente os oito arquivos do pacote ZIP para a raiz de `finances-pwa`, branch `main`. Exporte um backup antes da atualização e depois importe o JSON privado pelo app instalado.
