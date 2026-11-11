# Finanças 3.2

Aplicativo PWA local-first, uma carteira por instalação. GitHub Pages entrega apenas os arquivos estáticos; o aplicativo salva lançamentos em IndexedDB, no dispositivo. Não inclui APIs de banco, sincronização, ferramentas de análise de uso ou fontes externas.

## Estrutura de cálculo

- Renda líquida: valor mensal cadastrado.
- Fixos detalhados: soma dos itens válidos no mês (início/fim inclusivos).
- Parcelas anteriores: valor unitário × quantidade de meses restantes, com início na primeira fatura pendente.
- Parcelas novas: valor total dividido entre meses, com ajuste de centavos na última prestação.
- Investimentos: aporte mensal planejado ou exceção cadastrada para um mês.
- Saldo mensal projetado: renda − fixos − parcelas anteriores − parcelas novas − investimentos.
- Cota semanal equivalente: saldo mensal × 12 / 52. A conta semanal acumula cotas desde a segunda-feira de início do controle e subtrai apenas os gastos à vista lançados separadamente.

O saldo é um **orçamento**, não uma conciliação bancária. Investimentos representam previsão de aporte, não acompanhamento patrimonial. Compras à vista não devem ser registradas também como parcelas. No modo detalhado, meses sem parcelas antigas cadastradas são interpretados como zero.

## Migração da v3.1

Ao abrir, um estado versão 3 é copiado para a chave `state-before-v3.2` e convertido para versão 4 em `mode:legacy`. Nesse modo os totais antigos continuam valendo; os novos itens detalhados não são descontados até a ativação explícita do controle por itens. A conversão é irreversível na interface, mas os totais anteriores permanecem no banco e o backup antigo pode ser exportado em Ajustes. Fazer backup **antes** de atualizar e **antes** de trocar o modo.

O armazenamento local pode ser apagado pelo iOS/usuário. A funcionalidade Exportar backup gera JSON legível, que deve ser guardado privadamente no app Arquivos. A geração de arquivo não confirma que o usuário o salvou. Não coloque dados financeiros reais no repositório público.

## Publicação

Carregue os oito arquivos na raiz da branch publicada pelo GitHub Pages. Não apague o PWA instalado nem limpe dados do Safari durante atualizações. `sw.js` gerencia cache de arquivos estáticos e prioriza a rede enquanto disponível.
