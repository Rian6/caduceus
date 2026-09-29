<p align="center">
  <img src="assets/caduceus-icon.png" alt="Caduceus" width="88">
</p>

# Caduceus

Aplicativo para Windows que organiza seus jogos e integra o servidor necessário para **jogar PS2 pela rede com o OPL**. Inclui biblioteca local, conquistas RetroAchievements e atividade no Discord.

**[Baixar para Windows x64 — v1.1.0](https://github.com/Rian6/caduceus/releases/download/v1.1.0/Caduceus-Setup-1.1.0-x64.exe)** · [Notas da versão e SHA-256](https://github.com/Rian6/caduceus/releases/tag/v1.1.0)

O instalador começa com a biblioteca vazia, sem contas conectadas ou ISOs. Não é necessário instalar Node.js, Python ou MongoDB para usar o aplicativo. O executável ainda não possui assinatura digital de editor.

![Biblioteca do Caduceus](docs/images/biblioteca.png)

[Começar a jogar](#começar-a-jogar) · [Conquistas](#conquistas-retroachievements) · [Discord](#discord) · [Configurações](#configurações-e-backup) · [Desenvolvimento](#desenvolvimento)

## O que o aplicativo faz

| Recurso | No Caduceus |
| --- | --- |
| Biblioteca | Pesquisa por título, capas, detalhes e edição dos jogos. |
| Jogos instalados | Lista as imagens disponíveis na pasta do servidor. |
| Importação e downloads | Importa ISOs do computador e acompanha downloads dos links cadastrados. |
| Servidor OPL | Exibe IP, porta e compartilhamento; permite alterar a porta e o armazenamento. |
| Jogo em execução | Mostra o jogo detectado e sua capa na interface. |
| RetroAchievements | Consulta o progresso da conta, verifica ISOs compatíveis e recebe conquistas ao vivo com OPL-RA. |
| Discord | Compartilha o jogo, a capa disponível e a última conquista da sessão. |
| Personalização | Temas claro e escuro, tutorial inicial e controle do som de conquistas. |

O catálogo guarda os dados dos jogos em SQLite. Cadastrar ou importar uma base não baixa as ISOs: elas precisam ser importadas ou obtidas pelos links adicionados à biblioteca.

## Começar a jogar

Você precisa de um **PS2 com OPL instalado**, conexão Ethernet e um computador Windows na mesma rede do console.

1. Instale e abra o Caduceus. O tutorial inicial apresenta a configuração básica.
2. Conecte o PS2 à rede por cabo. Mantenha o computador na mesma rede, preferencialmente também por cabo.
3. Adicione um jogo à biblioteca e importe sua ISO, ou use uma opção de download cadastrada. Confira o resultado em **Instalados**.
4. Abra **Configurações → Conexão com o PS2** e confira o estado do servidor, o IP e a porta.
5. No OPL do console, configure o servidor SMB com esses dados e o compartilhamento **`PS2`**.
6. Atualize a lista de jogos por rede no OPL e inicie o jogo. Mantenha o Caduceus e o computador ligados durante a partida.

A porta padrão é **1024**. Se você a alterar no aplicativo, atualize também o OPL. O Caduceus não instala o OPL no console; consulte o projeto [Open PS2 Loader](https://github.com/ps2homebrew/Open-PS2-Loader).

![Jogo em execução no Caduceus](docs/images/jogando.png)

## Conquistas RetroAchievements

A aba **Conquistas** reúne a biblioteca da conta, os detalhes de cada conquista e o estado da conexão com o PS2. Há filtros para conquistas bloqueadas, desbloqueadas e hardcore. O histórico consultado pode incluir jogos de outras plataformas.

### Conectar a conta

Informe seu usuário, senha e **Web API Key** na aba Conquistas. A chave fica nas [configurações da conta RetroAchievements](https://retroachievements.org/settings).

A senha é usada na autenticação e não é salva. O token e a chave ficam protegidos pelo Windows para restaurar o acesso nas próximas execuções. Use **Desconectar** para remover o acesso salvo.

### Receber conquistas do PS2

O aplicativo incorpora um adaptador do **xeRAbora** e o executável **OPL-RA.ELF**. O componente de conquistas roda em segundo plano; o OPLServer continua responsável por servir os jogos pela rede.

1. Entre na conta pelo Caduceus.
2. Em **Conquistas → Som e configuração do PS2**, clique em **Salvar OPL-RA.ELF**.
3. Transfira o ELF para o PS2 e execute essa versão do OPL pelo método de inicialização usado no seu console.
4. Mantenha console e computador na mesma sub-rede, com a porta **UDP 18194** liberada para a comunicação.
5. No OPL-RA, execute **RA: test PC connection** e **RA: check game support** antes de iniciar o jogo.

Os novos desbloqueios aparecem como notificações no Caduceus, inclusive em outras abas. Na mesma seção, você pode ajustar o volume, testar o som e pausar ou retomar a conexão ao vivo. Reabra o guia pelo botão **Como funciona**.

**A integração ao vivo é experimental e funciona apenas em softcore.** O fork OPL-RA tem uma limitação conhecida que pode interromper o carregamento de jogos com conquistas via SMB. Para testar conquistas, use USB ou disco compatível. Para o uso habitual pela rede sem conquistas, use o OPL normal.

### Identificar ISOs compatíveis

Depois de conectar a conta, use **Configurações → Biblioteca → Verificar compatibilidade**. O aplicativo verifica o hash do executável da ISO contra o catálogo do RetroAchievements e exibe um selo com a quantidade de conquistas ativas encontradas.

O filtro **Com conquistas**, ao lado da busca, mostra as imagens reconhecidas. A identificação também aparece nos detalhes e na importação de ISOs.

A verificação depende do conteúdo da imagem, não apenas do título ou da região. Atualmente, esse recurso verifica **ISO**; BIN e ZSO não são validados. Uma ISO reconhecida não elimina as limitações do OPL-RA.

## Discord

Em **Configurações → Discord**, clique em **Conectar Discord** e autorize o acesso no navegador. Mantenha **Mostrar atividade no Discord** ativado e o Discord desktop aberto na mesma conta.

A atividade usa o nome do jogo, a capa cadastrada quando disponível e a descrição **Caduceus · PlayStation 2**. O subtítulo mostra a última conquista recebida na sessão; antes do primeiro desbloqueio, aparece **Nenhuma conquista nesta sessão**.

O compartilhamento também precisa estar permitido nas configurações de privacidade de atividade do Discord. A integração é opcional e pode ser desativada ou desconectada pelo Caduceus.

## Configurações e backup

| Seção | Opções disponíveis |
| --- | --- |
| Conexão com o PS2 | Consultar IP e compartilhamento, atualizar endereços e alterar a porta. |
| Armazenamento do OPL Server | Escolher outro local e migrar a pasta inteira ou criar uma nova. |
| Biblioteca | Reparar capas do OPL e atualizar a compatibilidade RetroAchievements. |
| Discord | Conectar a conta e ativar ou desativar a atividade. |
| Base de jogos | Importar JSON/SQLite e salvar um backup SQLite. |
| Aparência | Escolher o tema claro ou escuro. |
| Primeiros passos | Reabrir o tutorial de configuração. |

### Importar ou salvar a base

A importação aceita uma base SQLite com tabela `games`, uma lista JSON ou um objeto JSON com a propriedade `games`. Registros existentes são preservados, e uma importação válida cria um backup antes de gravar as alterações.

Você pode testar com [jogos-teste.json](examples/jogos-teste.json), que contém dados fictícios, sem ISOs ou links de download.

**Salvar backup da base** exporta o catálogo em SQLite. Esse arquivo não inclui ISOs, cartões de memória virtuais, credenciais ou configurações. Ao reimportá-lo, registros ausentes são adicionados; os existentes não são substituídos.

### Mudar a pasta dos jogos

O local padrão é **`Documentos/Caduceus/oplserver`**. Os arquivos ficam dentro da pasta `PS2`, em subpastas como `DVD`, `CD`, `ART`, `CFG` e `VMC`.

Escolha **Migrar a pasta inteira** para transferir jogos, capas, configurações e cartões de memória virtuais. A alternativa **Excluir a pasta antiga e criar uma nova** apaga o conteúdo antigo após confirmação, incluindo saves em VMCs. Encerre jogos e transferências antes de alterar o armazenamento.

<details>
<summary>Mais imagens da interface</summary>

As capturas são ilustrativas e usam dados de demonstração; contas e conquistas mostradas são simuladas.

![Configurações no tema claro](docs/images/configuracoes-claro.png)

![Tutorial de conexão com o PS2](docs/images/tutorial.png)

![Consulta de conquistas](docs/images/conquistas.png)

</details>

## Problemas comuns

| Situação | O que conferir |
| --- | --- |
| A lista do OPL está vazia | Servidor online, jogos em **Instalados**, IP e porta corretos no console e compartilhamento `PS2`. |
| Conquistas ao vivo não chegam | Conta conectada, OPL-RA em execução, suporte à ISO e teste de conexão do console com o PC. |
| O jogo não aparece no Discord | Jogo detectado pelo Caduceus, mesma conta no Discord desktop e compartilhamento de atividade permitido. |
| O servidor foi reiniciado durante a partida | O jogo só volta a ser detectado quando a conexão ou a telemetria for restabelecida. Pode ser necessário reiniciar o jogo no PS2. |

## Desenvolvimento

**Electron · React · TypeScript · Vite · SQLite**

Use Windows, Git e **Node.js 22.12 ou superior**, com npm.

```powershell
git clone https://github.com/Rian6/caduceus.git
cd caduceus
npm ci
npm run dev
```

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Iniciar Vite e Electron em desenvolvimento. |
| `npm run build` | Compilar a interface e o processo principal. |
| `npm start` | Abrir o aplicativo já compilado. |
| `npm run dist` | Gerar o instalador Windows x64 em `release/`, sem publicar. |
| `node scripts/check-release.cjs` | Auditar o pacote gerado contra a inclusão de dados pessoais. |

O catálogo de desenvolvimento fica em `database/catalog.sqlite3`; na instalação, ele fica na pasta de dados do usuário do Electron. MongoDB não é necessário para o aplicativo: os scripts `import:mongo` e `migrate:mongo` são ferramentas opcionais de migração. O segundo recria a base local.

Os testes estão em `scripts/test-*.cjs`. A interface é testada com Electron e dados fictícios, sem depender de contas, ISOs ou banco pessoal. Os testes automatizados não substituem a validação com um PS2 físico.

<details>
<summary>Configuração do Discord para mantenedores</summary>

O Application ID está em `electron/discord-config.ts`. No Discord Developer Portal, habilite **Public Client** e cadastre o redirect `http://127.0.0.1:53682/discord/callback`.

A autenticação usa OAuth2 com PKCE e escopo `identify`. Não inclua Client Secret ou token de bot no aplicativo. A atividade é enviada pela conexão RPC com o Discord desktop.

</details>

## Componentes e créditos

- **OPLServer:** servidor SMB integrado para disponibilizar os jogos ao console.
- **[Open PS2 Loader](https://github.com/ps2homebrew/Open-PS2-Loader):** carregador de jogos usado no PS2.
- **[OPL-RA](https://github.com/hacan359/Open-PS2-Loader/tree/ra)** e **[xeRAbora](https://github.com/hacan359/xerabora):** integração experimental de conquistas no console.
- **[RetroAchievements](https://retroachievements.org/)** e **[rcheevos](https://github.com/RetroAchievements/rcheevos):** serviço e componentes de conquistas.

As versões incorporadas, adaptações e licenças estão documentadas em [vendor/xerabora](vendor/xerabora/README.md). O som de conquista é sintetizado pelo Caduceus. Jogos e capas não acompanham o instalador; os componentes de terceiros mantêm suas próprias licenças.
