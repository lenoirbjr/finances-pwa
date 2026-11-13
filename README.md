## Atualização 3.12.1

O seletor de quantidade de parcelas agora oferece todas as opções de 1x a 12x, removendo 18x e 24x da criação de novas compras. Compras antigas com outras quantidades permanecem preservadas e editáveis.

# Finanças 3.12 — Histórico e temas

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


## Correção 3.12
Corrigida recursão involuntária em `monthTitle` que causava `Maximum call stack size exceeded` ao carregar ou importar backups. Nenhum dado local é apagado ou migrado. Cache de arquivos atualizado para v3.12.
