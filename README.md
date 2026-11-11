# Finanças 3.3 — PWA pessoal

Aplicativo local-first para uma carteira financeira por instalação, com IndexedDB e uso offline. GitHub Pages hospeda somente arquivos estáticos. Nenhum dado financeiro é incluído no repositório.

## Modelo de dados

- Renda mensal e aporte de investimento padrão.
- Investimento extra em um mês **soma** ao aporte padrão; o campo guarda apenas o adicional.
- Despesas fixas detalhadas (nome, valor, início, fim opcional).
- Parcelas antigas detalhadas (descrição, valor unitário, restantes, primeira fatura).
- Novas parcelas por compra e gastos à vista registrados.
- Orçamento mensal = renda − fixos − parcelas antigas − parcelas novas − aporte padrão − investimento extra.
- A cota semanal é uma equivalência 12/52 do orçamento mensal. O acumulado começa na segunda-feira definida em Ajustes. Não é uma conciliação bancária.

## Backup

A exportação JSON inclui integralmente `fixedItems`, `baseParcels`, `parcels`, `expenses`, `investmentOverrides`, investimentos padrão, renda e demais configurações. A importação restaura os itens individualizados.

**Importante:** backups de versões antigas com apenas totais agregados não permitem reconstruir as descrições individuais. Ao atualizar de um estado legado, o app cria itens identificados como `total a detalhar` preservando os valores antigos conhecidos, que podem ser substituídos por lançamentos reais sem contá-los duas vezes. Um snapshot do estado anterior é mantido no IndexedDB como `state-before-v3.3`, exportável na área Ajustes.

Exceções de investimentos de versões anteriores eram valores absolutos. A conversão preserva o valor total do mês (inclusive se menor que o padrão). Exceções novas passam a ser valores positivos adicionais; ao editá-las, passam a usar a semântica nova.

O IndexedDB é armazenamento local, não um backup externo. A exportação requer que o usuário confirme o salvamento do arquivo em local seguro. A instalação do PWA no outro aparelho usa um banco independente.

## Publicação

Atualize os oito arquivos na raiz do mesmo GitHub Pages, mantendo URL e escopo. Faça backup antes. Não desinstale o PWA ou limpe o armazenamento para atualizar. O service worker prioriza rede quando disponível e o cache ao operar offline.
