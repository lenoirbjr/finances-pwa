# Finanças 3.4 — controle financeiro local

PWA pessoal de carteira única, IndexedDB, publicação estática no GitHub Pages. Nenhuma conexão bancária, sincronização ou envio de lançamentos para servidores.

## Modelo de orçamento

- Histórico de configurações com mês de vigência: renda líquida, investimentos mínimos mensais e margem protegida. Alterações com vigência futura preservam períodos anteriores.
- Despesas fixas e parcelas detalhadas continuam com datas próprias.
- Cota semanal de referência = (renda − fixos − parcelas antigas − novas parcelas − investimento mínimo − margem − extras antigos planejados) × 12/52, baseada no mês da segunda-feira.
- Saldo acumulado semanal = soma das cotas desde o início do controle − gastos à vista realizados até hoje − investimentos extras efetivamente realizados até hoje. Não antecipa cotas de semanas futuras.
- Livre no mês = renda − fixos − parcelas − investimento mínimo − margem − investimentos extras realizados no mês − extras antigos planejados. Não é saldo bancário ou previsão precisa de liquidez.

## Compatibilidade

- Migra dados v3.3 para v3.4 sem apagar movimentos; guarda uma cópia v3.3 no IndexedDB para recuperação.
- Os antigos investimentos extras por mês eram valores planejados. Permanecem como previsões, sem que o aplicativo finja que foram efetivamente realizados. Aporte novo datado é registrado separadamente. Para evitar dupla contagem, revise os extras antigos antes de cadastrar um realizado referente ao mesmo valor.
- Dados do período anterior à instalação podem ser recalculados se o usuário editar itens históricos. Não é um livro-caixa fechado.

## Segurança e backup

- Os arquivos públicos não incluem salários, lançamentos ou dados de cartão.
- Faça backup JSON antes de atualizar e verifique se o arquivo foi salvo. Não desinstale o PWA para atualizar. IndexedDB não substitui cópia de recuperação.
- Mantenha o mesmo endereço e escopo do GitHub Pages para preservar a base local.
