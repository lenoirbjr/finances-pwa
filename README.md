# Finanças PWA — versão 3.0

Aplicativo estático de planejamento pessoal para iPhone, hospedado em GitHub Pages.

## Instalação / atualização

Publique os arquivos `index.html`, `app.js`, `style.css`, `manifest.webmanifest`, `sw.js`, `icon-192.png` e `icon-512.png` na raiz da branch `main`. Mantenha a mesma URL do GitHub Pages para preservar o acesso aos dados locais.

Antes de atualizar, exporte um backup pelo aplicativo anterior. No GitHub, editar um arquivo já existente ou substituí-lo pelo upload pode exigir abrir o arquivo e usar o editor. O `README.md` é apenas documentação e não contém dados financeiros.

## Privacidade e persistência

- IndexedDB `finances-pwa-local`, object store `app`, chave `state`.
- O código não executa chamadas de rede com dados financeiros, não utiliza analytics e não carrega scripts de terceiros.
- Dados financeiros são armazenados por origem e por contexto de aplicativo do navegador, no próprio dispositivo. Não embutir Baselines reais no repositório público.
- Um navegador com acesso à mesma origem pode acessar o IndexedDB. Proteger as credenciais e as permissões de publicação no GitHub.
- O IndexedDB NÃO substitui um backup: exportar periodicamente para local privado; backups JSON são texto não criptografado.
- Para migrar de v2.1, a carteira anteriormente selecionada torna-se a carteira única. O estado com ambas as carteiras é retido na chave `legacy-two-wallets-v2`, recuperável em Ajustes → Exportar arquivo anterior.
- Instalações novas começam sem dados financeiros fictícios.

## Convenções dos cálculos

- Fatura-base: valor total de compromissos antigos inserido manualmente em cada mês.
- Parcelamentos cadastrados: somados automaticamente ao mês da primeira cobrança e aos meses subsequentes; não duplicar na fatura-base.
- Saldo livre mensal = renda líquida - despesas fixas - fatura-base - parcelas novas.
- Cota semanal equivalente = saldo livre mensal × 12/52.
- Saldo acumulado = soma das cotas desde a segunda-feira inicial − gastos à vista lançados no período, até hoje.
- Sem fatura-base de algum mês, o saldo acumulado é indicado como incompleto, sem assumir valor zero.
- Não é conciliação bancária nem projeção por dia de recebimento/vencimento. Não considera gastos adicionais não registrados.

## Publicação segura

Manter apenas arquivos estáticos no GitHub, HTTPS habilitado, autenticação multifator e permissões restritas ao repositório. Testar atualização do cache e funcionamento em modo avião após cada release.


## Atualização v3.1
- Corrigidos inputs nativos de data/mês no iOS usando camada visual dimensionada no formulário. O seletor do iOS continua acessível ao tocar.
- Atualizado Service Worker para buscar HTML online antes de usar a cópia offline; arquivos estáticos passam para cache versionado v3.1.
- O app verifica novas versões ao abrir online e após recuperar conexão.
- Não é necessário remover o ícone do iPhone nem apagar dados para atualizar. Faça backup antes de alterações.
