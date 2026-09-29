<p align="center">
  <img src="assets/caduceus-icon.png" alt="Símbolo do Caduceus" width="90">
</p>

# Caduceus

Gerenciador de jogos **PlayStation 2 para Windows**, com biblioteca local, downloads, importação de ISOs e servidor integrado para jogar pela rede usando o **Open PS2 Loader (OPL)**.

**Electron · React · TypeScript · Vite · SQLite**

## Download para Windows

**[Baixar Caduceus v1.1.0 — instalador Windows x64 (.exe)](https://github.com/Rian6/caduceus/releases/download/v1.1.0/Caduceus-Setup-1.1.0-x64.exe)**

[Notas da versão e arquivos de verificação](https://github.com/Rian6/caduceus/releases/tag/v1.1.0)

O instalador inicia com um catálogo vazio, sem contas conectadas, caches pessoais ou ISOs. Após instalar, adicione seus jogos ou importe sua base em Configurações. Esta versão não possui assinatura digital de um certificado de editor.

![Biblioteca do Caduceus no tema escuro](docs/images/biblioteca.png)

[Recursos](#recursos) · [Primeiros passos](#primeiros-passos) · [Desenvolvimento](#desenvolvimento) · [Conquistas](#conquistas) · [Backup](#catálogo-importação-e-backup)

## Recursos

| Área | O que você pode fazer |
| --- | --- |
| Biblioteca | Buscar jogos, visualizar capas e editar títulos, metadados e opções de download. |
| Instalados | Consultar os arquivos disponíveis no servidor e reparar capas do OPL. |
| Downloads | Acompanhar transferências enquanto navega pelas outras telas. |
| Importação de ISO | Copiar um arquivo do computador para a estrutura do servidor. |
| Servidor | Consultar IP e porta, alterar a porta e escolher onde armazenar os jogos. |
| Armazenamento | Migrar a pasta inteira do OPL Server ou recriá-la em outro local. |
| Catálogo | Importar bases SQLite/JSON e salvar um backup SQLite. |
| Conquistas | Consultar progresso, receber conquistas ao vivo com OPL-RA e verificar a compatibilidade das ISOs. |
| Discord | Compartilhar jogo, capa e a última conquista da sessão no perfil. |
| Aparência | Alternar entre temas claro e escuro, com a preferência salva. |
| Tutorial | Seguir o guia da primeira abertura ou revê-lo nas configurações. |

Jogos sem capa ou URL continuam na biblioteca. O download fica disponível quando há um link cadastrado.

### Atividade no Discord

Em **Configurações → Discord**, clique em **Conectar Discord** e autorize sua conta no navegador. A atividade é ativada após a autorização. O usuário não precisa criar aplicações ou informar IDs e tokens. A sessão OAuth2 com PKCE é salva com proteção do Windows e restaurada ao abrir o app.

Configuração única para o mantenedor: na aplicação `1554196376756293712` do [Discord Developer Portal](https://discord.com/developers/applications), habilite **Public Client** em OAuth2 e registre exatamente `http://127.0.0.1:53682/discord/callback` em Redirects. O cliente usa o escopo `identify`, sem Client Secret no executável. O nome exibido na atividade vem da aplicação cadastrada. Sem essas configurações no portal, o login será recusado pelo Discord.

Com o Discord desktop aberto e o compartilhamento de atividades permitido, o jogo detectado aparece com **Caduceus · PlayStation 2**, com a capa cadastrada quando disponível. O subtítulo mostra a última conquista desbloqueada na sessão, até trocar ou encerrar o jogo. A atividade é removida ao terminar a sessão, desativar a integração ou fechar o Caduceus. A conexão usa [RPC local do Discord](https://docs.discord.com/developers/topics/rpc), com reconexão automática; conquistas históricas não são publicadas como atividade ao vivo.

### Compatibilidade de ISOs com RetroAchievements

Em **Configurações → Biblioteca**, use **Verificar compatibilidade** após conectar a conta RA. O selo com troféu mostra quantas conquistas ativas existem para o hash da imagem instalada. O filtro **Com conquistas**, ao lado da busca, considera toda a coleção, antes da paginação. A identificação também aparece nos detalhes, na importação de ISO, no jogo atual e nos downloads concluídos.

A validação lê `SYSTEM.CNF` e calcula o MD5 do nome e conteúdo do executável `BOOT2`, conforme o [algoritmo oficial de PS2](https://docs.retroachievements.org/developer-docs/game-identification.html). Não usa o MD5 da ISO inteira, nem presume compatibilidade pelo título ou serial. O [catálogo de hashes da API](https://api-docs.retroachievements.org/v1/get-game-list.html) é consultado com `i=21&h=1&f=1` e armazenado por 24 horas no cache local, sem credenciais. Offline, o último catálogo disponível continua utilizável.

Arquivos ainda não baixados ficam como **ISO não verificada**. BIN, ZSO e outros formatos não são validados nesta implementação. Falhas de leitura ou de conexão não são apresentadas como incompatibilidade. Substituir uma ISO invalida seu hash em memória. Um hash reconhecido confirma o conjunto de conquistas, mas não elimina as limitações experimentais de telemetria, softcore e SMB do OPL-RA.

## Interface

As capturas abaixo mostram a interface com **dados de demonstração**. A conta e as conquistas exibidas no exemplo do RetroAchievements são simuladas.

### Jogo em execução

O destaque da biblioteca acompanha o jogo detectado no servidor, com sua capa e identificação.

![Destaque do jogo em execução](docs/images/jogando.png)

### Configurações e tema claro

IP, porta e compartilhamento ficam reunidos para facilitar a configuração do console.

![Configurações de rede e armazenamento no tema claro](docs/images/configuracoes-claro.png)

<details>
<summary><strong>Ver o tutorial de primeira abertura</strong></summary>

![Tutorial ilustrado de conexão e configuração do PS2](docs/images/tutorial.png)

</details>

<details>
<summary><strong>Ver a aba Conquistas em uma janela compacta</strong></summary>

<img src="docs/images/conquistas.png" alt="Consulta de conquistas do RetroAchievements com filtro de bloqueadas" width="650">

</details>

## Primeiros passos

Para jogar pela rede, você precisa do Caduceus no computador, do **OPL instalado e funcionando no PS2** e de uma conexão Ethernet entre o console e a rede do computador.

1. Abra o Caduceus e siga o tutorial inicial.
2. Conecte o PS2 e o computador à mesma rede, preferencialmente por cabo ao roteador.
3. Em **Configurações → Conexão com o PS2**, confira se o servidor está online e anote IP, porta e compartilhamento.
4. No OPL, preencha os dados do servidor SMB com os valores exibidos no aplicativo.
5. Importe uma ISO pela edição do jogo ou baixe um arquivo por uma opção cadastrada. Aguarde a conclusão e confira a aba **Instalados**.
6. Abra a lista de jogos por rede no OPL. Mantenha o computador ligado e o Caduceus aberto durante a partida.

O compartilhamento do servidor integrado é `PS2`. Use a porta exibida pelo Caduceus, inclusive se você a tiver alterado. O guia completo pode ser reaberto em **Configurações → Primeiros passos**.

O Caduceus não instala o OPL no console nem inclui ISOs. Consulte o [projeto oficial do OPL](https://github.com/ps2homebrew/Open-PS2-Loader) para os arquivos e orientações do console.

## Desenvolvimento

### Requisitos

- Windows, para executar o servidor e os auxiliares nativos incluídos.
- Node.js compatível com as dependências do projeto e com `node:sqlite` para os scripts de catálogo.
- npm e Git.

Na pasta do projeto:

```powershell
npm ci
npm run dev
```

O comando inicia o Vite, compila o processo Electron e abre o aplicativo. O catálogo local é criado na primeira execução quando necessário; **MongoDB não é obrigatório**.

### Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Executar em desenvolvimento. |
| `npm run build` | Compilar a interface e o processo Electron. |
| `npm start` | Abrir o aplicativo usando os arquivos já compilados. |
| `npm run catalog:check` | Validar a presença e consultar os totais do catálogo local. |
| `npm run dist` | Compilar e gerar o instalador Windows x64 em `release/`, sem publicar automaticamente. |
| `npm run import:mongo` | Importar registros de MongoDB para uma base local existente. |
| `npm run migrate:mongo` | Recriar a base local a partir de MongoDB para uma migração inicial. |

### Instalador

```powershell
npm run dist
```

O instalador não inclui `database/catalog.sqlite3`, caches de autenticação ou o conteúdo de `oplserver/PS2`. A base vazia é criada na primeira execução. A lista explícita de recursos do servidor evita distribuir ISOs ou saves locais. O computador que recebe o aplicativo instalado não precisa de Node.js, MongoDB ou Python.

## Catálogo, importação e backup

O aplicativo usa **SQLite**. O catálogo guarda títulos, capas, links e outros metadados; as ISOs ficam separadas na pasta do servidor.

| Operação em Configurações → Base de jogos | Comportamento |
| --- | --- |
| Escolher base e importar | Aceita SQLite com tabela `games`, uma lista JSON ou um objeto JSON com a propriedade `games`. |
| Jogos já cadastrados | São ignorados pela importação, preservando os registros locais. |
| Backup automático | É criado antes de gravar uma importação válida. |
| Salvar backup da base | Permite escolher o nome e a pasta de uma cópia SQLite da base atual. |

Para experimentar, use a base de exemplo:

- [jogos-teste.json](examples/jogos-teste.json)

O arquivo contém jogos fictícios, sem ISOs ou links de download. Você também pode gerar uma base SQLite pela opção de backup do aplicativo. Importar um catálogo não instala os jogos. O backup SQLite não inclui ISOs, VMCs ou configurações do aplicativo. Reimportar o backup adiciona registros ausentes; não substitui os registros já existentes.

### Onde os dados ficam

- **Desenvolvimento:** `database/catalog.sqlite3`.
- **Aplicativo instalado:** `catalog.sqlite3` na pasta de dados do usuário gerenciada pelo Electron.
- **Arquivos do servidor:** por padrão, em `Documentos/PS2 Library/oplserver`, com destino alterável nas configurações. O nome histórico da pasta foi mantido.

```text
oplserver/
├── OPLServer.exe
└── PS2/
    ├── DVD/   # Imagens de jogos
    ├── CD/
    ├── ART/   # Capas e arte
    ├── CFG/   # Configurações dos jogos
    └── VMC/   # Cartões de memória virtuais
```

Ao mudar o armazenamento, a opção de migração transfere a pasta inteira. A opção de recriação **exclui o conteúdo antigo após confirmação**, incluindo saves armazenados em VMCs.

### MongoDB opcional

Os scripts de importação usam, por padrão, `mongodb://localhost:27017`, banco `romsfun` e coleção `jogos`. Você pode configurar `MONGO_URI`, `MONGO_DATABASE` e `MONGO_COLLECTION` no ambiente.

Prefira `npm run import:mongo` para incorporar dados a uma base existente. `npm run migrate:mongo` recria o catálogo local. O aplicativo não consulta MongoDB durante o uso normal.

## Conquistas

A aba **Conquistas** usa a API do RetroAchievements para consultar o progresso da conta em todas as plataformas:

- Lista paginada de jogos e progresso normal/hardcore.
- Detalhes, descrições e pontos de cada conquista.
- Filtros de conquistas bloqueadas, desbloqueadas e hardcore.
- Cache de consultas por um minuto.

Entre uma vez na própria aba, informando **usuário, senha e Web API Key**. A senha autentica os desbloqueios e não é salva. A chave permite consultar a biblioteca. Token e chave são protegidos pela criptografia do Windows na pasta de dados do aplicativo e restaurados nas próximas visitas. **Desconectar** encerra as duas conexões e remove os dados salvos. Contas antigas conectadas apenas por chave precisam completar esse novo formulário uma vez.

A consulta via Web API é somente de leitura. A integração local experimental abaixo pode registrar conquistas usando o componente xeRAbora.

### Conquistas ao vivo — integração local experimental

O Caduceus incorpora **xeRAbora v0.1.0-alpha.12** e `OPL-RA.ELF`. O OPLServer continua independente e permanece responsável por servir os jogos pela rede.

O Caduceus possui sua própria interface unificada: conta, estado do console, jogo atual e biblioteca na mesma tela. O componente adaptado inicia em segundo plano, sem abrir navegador. Em **Som e configuração do PS2**, ajuste o áudio, pause ou retome a conexão e salve o ELF para transferir ao console. No OPL-RA, execute `RA: test PC connection` e `RA: check game support` antes de jogar.

Eventos recebidos geram notificações no Caduceus e um som original, com volume e opção de silenciar. O componente usa UDP 18194 para o console e TCP 18195 para a interface local. Fechar o aplicativo encerra o processo iniciado por ele; parar o componente não apaga o login gerenciado pelo xeRAbora.

**Limitação conhecida do fork:** jogos com conquistas carregados por SMB podem parar de carregar. Esta integração não corrige esse problema no PS2. Para testes de conquistas, use USB ou disco compatível; para jogar pela rede, o OPL normal continua funcionando como antes. Apenas softcore. Validação de ponta a ponta exige um console físico.

Código, versão fixa, hashes e licenças: [componentes de terceiros](vendor/xerabora/README.md). Créditos: [hacan359/xeRAbora](https://github.com/hacan359/xerabora), [OPL-RA](https://github.com/hacan359/Open-PS2-Loader/tree/ra) e [rcheevos](https://github.com/RetroAchievements/rcheevos).

## Organização do projeto

```text
electron/       Processo principal, SQLite, servidor, IPC e integrações
electron/native/ Auxiliares Windows para detectar atividade do OPL
src/            Interface React, componentes e estilos
oplserver/      Componentes do servidor integrado
scripts/        Migração, validação e testes
examples/       Catálogos de demonstração
assets/         Recursos visuais do aplicativo
docs/images/    Capturas usadas neste README
```

### Verificações

```powershell
npx tsc -p tsconfig.json --noEmit
npm run build
```

Há verificações específicas em `scripts/test-*.cjs` para catálogo, backups, armazenamento, rede, RetroAchievements e interface. Os testes de interface usam Electron; os testes de integração com APIs utilizam dados simulados. Não precisam da sua chave RetroAchievements.

## Conteúdo e componentes de terceiros

O Caduceus gerencia os arquivos e metadados adicionados pelo usuário. Jogos, capas e componentes integrados permanecem sujeitos aos direitos e licenças dos respectivos autores. OPL e RetroAchievements são projetos independentes.
