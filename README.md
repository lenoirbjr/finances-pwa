# Finanças 3.10 — Planejamento e Investimentos

PWA local no IndexedDB, para GitHub Pages. Não publicar backups financeiros no repositório.

## Mudanças
- Meses expansíveis; cada mês possui grupos expansíveis com totais e lançamentos em ordem decrescente. Percentuais calculados sobre a renda líquida vigente do mês.
- Nova aba Investimentos: meta, confirmação de valor/data realizada, opção não realizado e pendente, histórico mensal e aporte extra.
- Removidos Pagamentos realizados e Resumo do Baseline dos Ajustes.
- Despesas fixas estimadas automaticamente no dia configurado; os registros de pagamentos antigos continuam suportados na compatibilidade.
- Investimentos sem confirmação permanecem provisionados no orçamento, mas não são debitados do saldo bancário estimado até serem registrados.
- Backups antigos da v3.8/3.9 permanecem aceitos. Não apague o PWA durante a atualização.

## Limitações
- Saldo bancário é estimado, não conectado ao banco.
- Um aporte extra já registrado deve ser incluído no total mensal da confirmação, sem cadastrá-lo novamente.
- Renda e despesas fixas são previsões vinculadas às datas de configuração.
