# Caduceus

**Caduceus** é um gerenciador desktop de biblioteca para **PlayStation
2**, construído com **Electron + React + TypeScript**, voltado a
organizar o catálogo, instalar jogos na estrutura usada pelo OPL e
simplificar a conexão do console com o computador.

> O Caduceus não instala o Open PS2 Loader no console e não inclui
> arquivos de jogos. O usuário é responsável pelos arquivos adicionados
> à biblioteca.

## Principais recursos

-   Biblioteca local de jogos de PS2.
-   Catálogo em SQLite.
-   Capas e metadados.
-   Cadastro e edição de jogos.
-   Importação de ISOs existentes no computador.
-   Downloads quando o registro possui URL configurada.
-   Estado global dos downloads, independente da página atual.
-   Área de jogos instalados.
-   Estrutura `PS2/DVD`, `PS2/CD`, `PS2/ART`, `PS2/CFG` e `PS2/VMC`.
-   Servidor OPL iniciado junto com o aplicativo.
-   Configuração de conexão com o PS2.
-   Backup e importação do catálogo.
-   Tutorial integrado de primeiros passos.
-   Build e instalador para Windows.

## Stack

-   Electron
-   React
-   TypeScript
-   Vite
-   SQLite
-   Lucide React
-   UI inspirada em shadcn/ui
-   OPLServer integrado

## Catálogo e SQLite

O Caduceus usa **SQLite em runtime**, tanto em desenvolvimento quanto no
aplicativo instalado.

O MongoDB é apenas uma origem legada para a migração inicial:

``` text
MongoDB local
     |
     | npm run migrate:mongo
     v
database/catalog.sqlite3
     |
     +--> npm run dev
     |
     +--> npm run dist
```

Configuração histórica padrão da migração:

``` text
URI:        mongodb://localhost:27017
Database:   romsfun
Collection: jogos
```

Para migrar:

``` bash
npm run migrate:mongo
```

Para validar:

``` bash
npm run catalog:check
```

Depois da migração, o Caduceus não depende do MongoDB. Quando
disponível, o documento original migrado também é preservado em
`raw_json`.

## Regras da Biblioteca

A Biblioteca deve exibir os registros do SQLite independentemente de
possuírem capa, URL de download, arquivo instalado ou Game ID.

Um jogo sem URL continua visível, mas seu botão de download fica
desabilitado.

Os jogos podem ser editados para alterar título, capa, URLs, Game ID e
demais metadados suportados.

## Arquivos de jogos

A estrutura utilizada pelo servidor OPL inclui:

``` text
PS2/
├── DVD/
├── CD/
├── ART/
├── CFG/
└── VMC/
```

Downloads iniciados pelo catálogo usam o destino controlado pelo
Caduceus. O usuário não escolhe arbitrariamente o diretório final.

Na **Importação de ISO**, o usuário escolhe apenas o arquivo de origem.
O Caduceus copia a ISO para a estrutura correta do OPL.

A área **Instalados** representa os jogos encontrados fisicamente nessa
estrutura.

## Downloads

Os downloads devem ser controlados pelo processo Electron, e não pelo
componente React da página atual.

Assim, um download continua normalmente quando o usuário muda de página,
troca de aba ou abre outra seção do Caduceus. A interface apenas observa
o estado global.

## Servidor OPL

O servidor é iniciado junto com o Caduceus. Não é necessário um botão
manual de inicialização.

A tela de conexão pode apresentar:

``` text
Servidor OPL
Servidor SMB compatível com OPL ativo
IP: <IP acessível pelo PS2>
Porta: <porta configurada>
Share: PS2
```

O estado deve ser validado em tempo real. O IP exibido deve corresponder
à interface de rede alcançável pelo console, e não simplesmente
`127.0.0.1`.

## Primeiros passos

Na primeira execução, o Caduceus apresenta um tutorial guiado. A
conclusão é salva no `localStorage` com:

``` text
ps2-library-tutorial-v1
```

O guia possui seis etapas.

### 1. Preparação

Explica que o Caduceus roda no computador e que o console precisa do
**Open PS2 Loader (OPL)** para abrir jogos pela rede.

O tutorial cita métodos de homebrew compatíveis, como Free McBoot nos
modelos suportados, e aponta para o projeto oficial do OPL:

https://github.com/ps2homebrew/Open-PS2-Loader/releases

O Caduceus não instala o OPL no PS2.

### 2. Conexão

Orienta a conectar PS2 e computador à mesma rede, preferencialmente
através do roteador.

Também informa que:

-   PS2 Fat precisa de adaptador de rede com Ethernet;
-   conexão direta PC ↔ PS2 sem DHCP exige IPs estáticos diferentes na
    mesma sub-rede;
-   o computador deve permanecer ligado e sem suspensão enquanto o
    console estiver usando o servidor.

### 3. No computador

O usuário acessa:

``` text
Configurações → Conexão com o PS2
```

O tutorial mostra dinamicamente:

-   IP do computador;
-   porta;
-   compartilhamento.

Esses valores vêm do `OplStatus` atual.

### 4. No PlayStation 2

No OPL, o usuário abre a configuração de rede e preenche o servidor SMB
com os dados mostrados pelo Caduceus.

Para o servidor integrado atualmente, o guia informa:

``` text
Usuário: Guest
Senha:   vazia
Share:   PS2
```

A porta utilizada é a porta exibida pelo Caduceus, não necessariamente a
porta SMB padrão encontrada em outros tutoriais.

### 5. Sua biblioteca

Existem duas formas principais de instalar um jogo:

1.  **Baixar jogo**, quando o registro possui link disponível.
2.  Editar o jogo e usar **Importar ISO**, quando a ISO já existe no
    computador.

Importar SQLite/JSON ou restaurar um catálogo não transfere as ISOs.

### 6. Pronto para jogar

O guia orienta a habilitar o dispositivo ETH/Network no OPL, salvar as
configurações e abrir a lista de jogos de rede.

Se a lista estiver vazia, verificar:

-   cabo e rede;
-   servidor online;
-   IP;
-   porta;
-   compartilhamento;
-   conclusão da instalação da ISO.

O guia pode ser reaberto em:

``` text
Configurações → Primeiros passos
```

## Desenvolvimento

Instale as dependências:

``` bash
npm install
```

Execute:

``` bash
npm run dev
```

Valide o TypeScript do processo Electron:

``` bash
npx tsc -p tsconfig.electron.json --noEmit
```

## Build e instalador

Antes de gerar uma versão:

``` bash
npm run catalog:check
```

Depois:

``` bash
npm run dist
```

O `electron-builder` gera o instalador do Windows. Para distribuição
manual, o objetivo é que seja suficiente enviar:

``` text
Caduceus Setup <versão>.exe
```

O computador do usuário final não deve precisar de MongoDB ou Python
para executar o Caduceus.

## Backup

O backup do catálogo contém **metadados**, não os arquivos dos jogos:

``` text
Backup SQLite/JSON != backup das ISOs
```

## Regras importantes para futuras alterações

1.  O aplicativo usa SQLite em runtime.
2.  MongoDB é somente uma ferramenta legada de migração.
3.  A Biblioteca não pode esconder jogos por falta de capa ou download.
4.  Jogos sem URL continuam visíveis com download desabilitado.
5.  Downloads continuam ativos ao navegar entre páginas.
6.  Downloads do catálogo usam o diretório controlado pelo Caduceus.
7.  Importar ISO permite escolher o arquivo de origem, mas a instalação
    vai para a estrutura OPL.
8.  O servidor OPL inicia junto com o aplicativo.
9.  O status do servidor é acompanhado em tempo real.
10. Mudanças de UI não devem interferir em `games:list` nem no
    carregamento do SQLite.
11. O instalador deve ser autocontido para o usuário final.
12. Catálogo e ISOs são independentes; importar catálogo não copia
    jogos.
13. Jogos encontrados fisicamente devem ser associados a um registro
    persistente antes de operações que exigem um ID do SQLite.

## Estrutura conceitual

``` text
Caduceus
│
├── Electron
│   ├── SQLite
│   ├── downloads
│   ├── filesystem
│   ├── importação de ISO
│   └── servidor OPL
│
├── React
│   ├── Biblioteca
│   ├── Instalados
│   ├── Downloads
│   ├── Cadastro / edição
│   ├── Configurações
│   └── Primeiros passos
│
├── database/
│   └── catalog.sqlite3
│
└── PS2/
    ├── DVD/
    ├── CD/
    ├── ART/
    ├── CFG/
    └── VMC/
```

## Status atual

O projeto possui catálogo SQLite, migração do MongoDB legado, biblioteca
paginada, capas, cadastro/edição, importação de ISO, jogos instalados,
downloads persistentes durante a navegação, integração com OPLServer,
configuração de conexão, tutorial de primeiros passos e instalador para
Windows.

## Conteúdo e direitos

O Caduceus é um gerenciador de biblioteca. Arquivos de jogos, capas,
metadados e links externos podem estar sujeitos a direitos autorais,
licenças e termos próprios. O projeto não pressupõe que um arquivo
disponível na internet esteja automaticamente autorizado para
redistribuição.

------------------------------------------------------------------------

**Caduceus --- PS2 Library Manager**
