# Finanças 3.11 — Histórico e temas

PWA local no IndexedDB, para GitHub Pages. Não publicar backups financeiros no repositório.

## Alterações
- A aba Investimentos segue a ordem: Primeiro aporte do mês, Adicionar investimento extra, Histórico mensal.
- Histórico agrupado por ano, com meses expansíveis e lançamentos individuais (aporte principal e extras). A expansão é visual e não altera os registros.
- Datas de títulos usam "Novembro de 2026" (sem capitalizar a preposição).
- Ícone alternador de tema ao lado de Informações: azul e rosa. Preferência de cor salva somente no dispositivo, sem alterar backups nem dados financeiros.
- Estado do banco permanece na versão 8, compatível com a 3.10.

## Notas
- Confirmar aporte do mês informa o **total** investido, incluindo aportes extras. O aplicativo deduz os extras previamente registrados ao armazenar a parte principal.
- Antes de atualizar, exporte um backup. Não remova o PWA para forçar atualização.
