# Plano: Nothic, a mesa online (um VTT pequeno, no estilo do Roll20)

Objetivo: uma mesa virtual para o mestre e uns 3 a 6 amigos, com mapa, tokens, névoa, luz dinâmica, dados, fichas, chat e iniciativa. Não é para escalar: um servidor, uma campanha de cada vez.

---

## 1. Como o Roll20 funciona por dentro

### O que foi confirmado (documentação pública da API de Mods e tipos TypeScript da comunidade)

**O Roll20 é um banco de objetos replicado.** Tudo que existe na mesa é um objeto com `_id`, `_type` e propriedades simples. Cada cliente reage a três eventos por tipo: `add:<tipo>`, `change:<tipo>[:<prop>]` e `destroy:<tipo>`, mais `chat:message`. O mapa, as fichas, a iniciativa e a jukebox são todos o mesmo mecanismo com tipos diferentes.

| Tipo | O que guarda (propriedades principais) |
|---|---|
| `campaign` | `playerpageid` (o mapa onde estão os jogadores), `turnorder` (iniciativa, em JSON numa string), `playerspecificpages` |
| `player` | `_displayname`, `_online`, `color`, `speakingas` |
| `page` | `width`, `height`, `grid_type` (square/hex), `diagonaltype` (`foure`, `threefive`, `pythagorean`, `manhattan`), `scale_number`/`scale_units`, `fog_opacity`, `showdarkness`, `lightenforcelos`, `lightrestrictmove`, `lightglobalillum` |
| `graphic` (token) | `_pageid`, `layer`, `left/top/width/height/rotation`, `imgsrc`, `represents` (ficha), `controlledby`, `bar1..3_value/max/link` (barras ligadas a atributos), `statusmarkers`, `gmnotes`, além dos campos de visão e luz (`has_night_vision`, `emits_bright_light`, `bright_light_distance`) |
| `path` | desenho ou parede; o formato fica em `path` (JSON no estilo SVG) |
| `text` | texto solto no mapa |
| `character` / `attribute` / `ability` | ficha = personagem + lista de atributos `{name, current, max}` + macros |
| `handout`, `macro`, `rollabletable`/`tableitem` | diário, atalhos de rolagem, tabelas aleatórias |

**Camadas:** todo objeto do mapa tem `layer`: `map` (o chão), `objects` (tokens), `gmlayer` (só o mestre vê) ou `walls`. **As paredes da luz dinâmica são linhas na camada `walls`.** A visão de cada token é calculada a partir dessas linhas.

**Luz dinâmica atual (UDL):** um token com *Vision* enxerga até onde há luz, a menos que uma parede bloqueie. O *Explorer Mode* deixa em cinza o que o jogador já viu, e sem ele o jogador só vê o que vê agora. Existem barreiras transparentes (bloqueiam o movimento, mas não a visão) e de mão única. A opção `lightrestrictmove` impede um token de atravessar paredes.

### O que o REA viu na sua mesa "Hereditário" (capturas `ev_d333930e…`, `ev_70cd0f21…`, 23/11/2026)

**A sincronização é o Firebase Realtime Database puro.** Um WebSocket só, `wss://s-gke-usc1-…firebaseio.com/.ws?v=5&ns=roll20-9993`, com o protocolo normal do SDK do Firebase (`sdk.js.10-12-2`). Não existe um servidor de jogo próprio no meio: o cliente lê e escreve direto na árvore JSON, e as regras de segurança do Firebase decidem o que é permitido. O token de login (JWT) leva `currentcampaign`, `is_gm` e `playerid`, e é com ele que as regras sabem quem é mestre.

Mensagens vistas: `q` (ouvir um caminho), `n` (parar de ouvir), `p` (gravar um valor), `m` (gravar só alguns campos), `o` (o que fazer quando cair a conexão) e, do servidor, `d`/`m` (dados novos). Respostas acima de 16 KB chegam em pedaços.

**A árvore de uma campanha** (`/campaign-<n>-<hash>/…`):

| Caminho | O que tem |
|---|---|
| `campaign` | `playerpageid`, `turnorder` (string JSON), `initiativepage`, `snapping_increment`, `token_markers`, `release: "jumpgate"` |
| `players/<id>` | `displayname`, `color`, `online`, `lastActive`, `lastpage`. O `online` usa `o` (onDisconnect), então cai sozinho quando a aba fecha |
| `pages/<id>` | `name`, `width`, `height` (em quadrados), `grid_opacity`, `showdarkness`, `zorder` (lista de ids em string) |
| `graphics/page/<pageId>/<id>` | tokens e imagens: `left`, `top`, `width`, `height`, `layer` (`map`/`objects`…), `imgsrc`, `name`, `represents`, `controlledby` |
| `paths/page/<pageId>/<id>` | desenhos: `shape`, `points` (JSON), `x`, `y`, `stroke`, `fill`, `layer` |
| `texts/…`, `pins/…` | também separados por página |
| `dynamic_fog/masks/page/<id>/manual` e `/player` | névoa como **máscara de bitmap** (`size: 2048`, `pageSize`), mais `dynamic_fog/realtime/latest` |
| `characters/<id>` | resumo da ficha (`name`, `controlledby`, `inplayerjournals`, `custom_meta1` com PV/CA em JSON) |
| `char-attribs/char/<id>` | a ficha inteira (`hitpoints.currentHP`, …), carregada só quando abre |
| `char-blobs/<id>/defaulttoken` | token padrão do personagem |
| `chat` | as últimas 100 mensagens: `who`, `type`, `content`, `rolls{expression, results, signature}`, `secret`, `timestamp` |
| `broadcast`, `shout` | eventos passageiros: ping no mapa (`{type:"ping", position, page, player}`) e "mostrar ficha para todos" |
| `handouts`, `macros/player/<id>`, `decks`, `hands`, `rollabletables`, `jukeboxplaylist`, `custfxs` | o resto |

**Coisas que valem copiar:**
- **Tudo é separado por página** (`graphics/page/<pageId>`). O cliente só ouve o mapa em que está.
- **A ficha vem em duas partes:** um resumo leve sempre carregado e a ficha completa só quando alguém abre.
- **As rolagens vêm com `signature`.** Quem rola é o servidor do Roll20, que assina o resultado, e o chat só exibe. Por isso ninguém consegue forjar.
- **Pings e "mostrar para todos" passam por um canal passageiro** (`broadcast`), separado do estado salvo.

### O que eu deduzo, mas não vi acontecer
- **Mover um token** deve ser um `m` em `graphics/page/<p>/<id>` com `{left, top}`. Nas duas capturas, nenhuma escrita sua chegou a aparecer: só vi o carregamento.
- **A luz dinâmica é calculada no navegador.** Não aparece nenhum caminho de "visão" vindo do servidor, só as máscaras de névoa.

### O que ficou em aberto
- O algoritmo exato da luz e o motor do canvas, porque não analisei o código (`startjs`, 386 KB). Para nós não importa, porque o MonTT já desenha o mapa.

Fontes: [Mod:Objects (wiki)](https://wiki.roll20.net/Mod:Objects), [Path](https://wiki.roll20.net/Mod:Objects/Path), [Layer](https://wiki.roll20.net/Layer), [types-roll20 index.d.ts](https://app.unpkg.com/types-roll20@2.1.8/files/index.d.ts), [Updated Dynamic Lighting](https://wiki.roll20.net/DL), [A New Light (blog)](https://bloghub.roll20.net/posts/a-new-light/), [What's New With Dynamic Lighting](https://help.roll20.net/hc/articles/4403860932375).

---

## 2. A nossa versão: o mesmo modelo, bem menor

### O que já temos (e é mais da metade do trabalho)

O `MonTT.html` já tem grade, chão, **paredes como arestas da grade** (`hw`/`vw`), portas, props, tokens com tamanho e lado, régua com 3 regras de diagonal, névoa por célula com visão de mestre e de jogador, salvamento em JSON e várias camadas (`levels`). O `lightscreen-core.js` já tem o rolador de dados (`rollExpr`) e as tabelas.

**Falta só a parte "online":** sincronizar, separar quem é mestre de quem é jogador, chat, fichas e a luz dinâmica.

### Arquitetura

```
 navegador (MonTT em modo mesa)          mesa.py (Python, só biblioteca padrão)
 ┌──────────────────────────┐   POST /op    ┌──────────────────────────────┐
 │ estado local = cópia     │ ────────────► │ valida permissão             │
 │ render (drawScene)       │               │ aplica no estado             │
 │ reage a add/change/destroy│ ◄──────────── │ envia a todos (filtrado)     │
 └──────────────────────────┘   GET /poll   │ salva campanha.json          │
                                            └──────────────────────────────┘
```

- **Servidor: um arquivo `mesa.py` com `http.server` + `ThreadingHTTPServer`, sem dependências.** Envia por **long polling** (`GET /poll` fica esperando até ter novidade, até 20 s) e recebe por `fetch` POST. Começou com Server-Sent Events, mas o túnel rápido da Cloudflare segura o stream inteiro, e o long polling passa por qualquer túnel ou proxy. Não precisa de WebSocket: na mesa, as mudanças são poucas por segundo. Você já roda `py -m http.server`, então é o mesmo jeito de usar.
  - `ponytail:` long polling + POST, com uma thread por requisição. Uma aba fechada sai da mesa depois de 45 s sem perguntar. Aguenta umas dezenas de pessoas. Se um dia tiver um grupo grande, troca por WebSocket (`websockets` ou Node `ws`).
- **Mensagem única, igual aos eventos do Roll20:** `{op: "add"|"change"|"destroy", type, id, props}`. O servidor coloca um número de sequência, aplica, retransmite e grava. Quem entra recebe a "foto" do estado inteiro e depois só as mudanças.
- **Conflito:** a última escrita vence, propriedade por propriedade. Com 5 pessoas isso basta.
- **Persistência:** `campanha.json` gravado alguns segundos depois de cada mudança, mais uma cópia de backup por sessão.
- **Mestre e jogador:** o link do mestre leva `?gm=<segredo>`, o dos jogadores leva `?p=<nome>`. O servidor:
  - não envia aos jogadores os objetos da `gmlayer`, as `gmnotes` nem as marcas de mestre do gerador de masmorras;
  - só aceita que um jogador mexa em tokens cujo `controlledby` tenha o nome dele.
- **Hospedagem:** o mestre roda `py mesa.py` no PC e cria um túnel com `cloudflared tunnel --url http://localhost:8765` (gera uma URL pública grátis) ou usa o Tailscale. Não precisa de servidor pago.

### Modelo de dados (os tipos do Roll20, só os que vamos usar)

```js
campaign  { playerPage, turnorder:[{id, pr, custom}], round }
player    { name, color, online }
page      { mapa do MonTT: w,h,terrain,hw,vw,doors,props,fog,..., grid, diag, darkness, explorer }
token     { page, layer:'objects'|'gm', x,y,size,img,side, owner:[nomes], char, bars:[{v,max,attr}], vision:{on,radius,dark}, light:{bright,dim} }
character { name, avatar, owner:[nomes], attrs:{nome:{cur,max}}, macros:{nome:'/r 1d20+@{for}'} }
handout   { title, text, img, visibleTo:[nomes]|'all' }
msg       { from, text, roll?, whisper? }        // chat: só cresce, não muda
```

O que vem do Roll20 observado:
- **Presença:** o servidor marca `player.online=false` sozinho quando a conexão SSE cai, como o `onDisconnect` do Firebase.
- **Eventos passageiros** (ping, "mostrar para todos", régua ao vivo) passam por um canal `broadcast` que não é salvo.
- **Chat:** o cliente recebe só as últimas 100 mensagens ao entrar.
- **Por página:** o cliente só recebe tokens e desenhos do mapa em que está.

As paredes **não precisam de um tipo `path`**, porque o MonTT já guarda as paredes como arestas (`hw`/`vw`). Para a luz, cada aresta ativa vira um segmento, e portas abertas não bloqueiam.

---

## 3. Fases (cada uma termina com algo jogável)

### Fase 0: prova de conceito + envio do MonTT ✅ feita (commit `21964b5`)
- `mesa.py`: `GET /stream` (SSE; hoje `GET /poll`), `POST /op` (add/change/destroy), `POST /upload` (PNG/JPG/WebP, nome gerado pelo servidor), serve os arquivos da pasta sem expor `.git` nem `campanha.json`. Grava `campanha.json` a cada 2 s, com troca atômica.
- `mesa.html`: mostra o mapa atual, com tokens arrastáveis que se encaixam na grade, zoom, criação de token e duplo clique para apagar.
- MonTT ganhou **Enviar à mesa** (hoje "Enviar ao Nothic"): o andar atual vai como imagem na visão de jogador (névoa opaca, sem marcas de mestre, sem tokens) e cada token vira uma peça. Reenviar troca só a imagem (`keep`), e os tokens ficam onde estavam.
- **Testado:** envio do mapa de exemplo, arraste sincronizado entre duas abas, reenvio sem perder posições, recarregar a página mantém o estado, autoteste `py mesa.py --teste`.
- **Falta testar:** outro PC (`--lan`) e o túnel `cloudflared`.

### Fase 1: mestre e jogadores ✅ feita
- **Links:** o `py mesa.py` gera um segredo na primeira vez (fica no `campanha.json`) e mostra os links: mestre na mesa (`mesa.html?gm=…`), mestre no MonTT (`MonTT.html?gm=…`) e jogadores (`mesa.html?p=Nome`). Se o link vier sem nome, a mesa pergunta.
- **No servidor:** o jogador só manda `change` de `x`/`y` em tokens cujo `owner` tem o nome dele. Criar, apagar, enviar imagem ou mudar mapa e névoa é só do mestre. O resto volta `403`.
- **Filtro por pessoa:** tokens com `layer:'gm'` e campos `gm*` nunca chegam aos jogadores. Esconder um token manda `destroy` só para eles, e mostrar de novo manda `add`.
- **Presença:** cada pessoa aparece online na primeira conexão e offline quando fecha a última aba (como o `onDisconnect` do Roll20).
- **Mesa do mestre:** botão direito no token abre o menu (quem pode mover, esconder/mostrar, apagar). Seletor do mapa dos jogadores, "+ Token", tokens escondidos aparecem translúcidos.
- **Névoa ao vivo:** a imagem vai sem névoa e a névoa vai como array. Pintar ou limpar névoa no MonTT chega à mesa na hora: opaca para os jogadores, translúcida para o mestre. O token do próprio jogador fica visível mesmo na névoa.
- **Testado no navegador:** o MonTT do mestre enviou o mapa; o mestre deu o Brannoc à Ana e escondeu o Goblin 2; a Ana viu 8 tokens, só conseguiu mover o Brannoc, e o mestre recebeu o movimento; a tentativa dela de mover a Ilse levou `403`; "Fog whole map" e "Clear all fog" no MonTT chegaram à mesa. O autoteste cobre permissões, filtro e presença.
- **Túnel testado:** o `cloudflared` rápido não deixa passar SSE (os cabeçalhos chegam, os dados nunca), então a mesa passou a usar long polling. Pelo endereço `trycloudflare.com`, um jogador de fora entrou, rolou dados (a rolagem volta em ~95 ms), viu o mestre mexer um token em ~40 ms e arrastou o próprio token. Falta só uma sessão com amigos de verdade.
- `ponytail:` o segredo vai na URL. Basta para amigos, mas quem vê o link do mestre vira mestre: não compartilhe a tela com ele aberto.

### Fase 2: chat, dados e iniciativa ✅ feita
- **Painel ao lado do mapa:** iniciativa em cima, chat embaixo. No celular, o painel desce para baixo do mapa.
- **Comandos:** `/r 1d20+5 ataque` (o que vier depois da conta vira rótulo), `/gr` (rolagem secreta: só quem rolou e o mestre veem), `/w Nome texto` (sussurro; `/w "Nome Composto"` também funciona), `/em sorri` (ação). Sintaxe dos dados: `NdM`, `+`/`−`, `kh`/`kl` (`2d20kh1` = vantagem). Botões rápidos de d4 a d100, vantagem e desvantagem. ↑/↓ repete mensagens.
- **Dados rolados no servidor** (`random.SystemRandom`), como o Roll20: o navegador só manda o texto e recebe o resultado com cada dado. Os dados descartados aparecem riscados, e no d20 o 20 natural aparece em verde e o 1 em vermelho.
- **Privacidade:** mensagens com `to` só chegam a quem está na lista. O mestre não lê sussurros entre jogadores (como no Roll20).
- **Iniciativa:** botão direito no token → "Rolar iniciativa" (1d20 + modificador, no servidor; o jogador só para os próprios tokens). A lista fica ordenada; o mestre tem ◀ ▶, "Limpar" e × por linha; o token da vez brilha no mapa. Quem entra no meio da rodada não rouba a vez de quem está jogando.
- **Canal passageiro** (`/fx`, não é salvo): duplo clique faz um ping na cor do jogador; Shift + arrastar mostra uma régua para todos, com a distância em pés pela regra de diagonal do MonTT (que agora vai junto com o mapa).
- **Chat limitado:** o servidor guarda as últimas 300 mensagens e quem entra recebe as últimas 100.
- **Testado no navegador:** fala, rolagem, vantagem, sussurro ao mestre, ação, `/r abc` com erro; a Ana não vê o `/gr` do mestre nem os controles de turno; a iniciativa de goblin e ogro com ▶ passando a vez; a Ana recusada em token que não é dela e aceita depois de ganhar o Brannoc; ping e régua chegando à outra tela. O autoteste cobre dados, chat, sussurros, iniciativa e efeitos.
- **Corrigido no teste:** o campo do chat só limpava depois da resposta do servidor (quem digitava rápido grudava mensagens); a vez pulava quando alguém entrava na iniciativa; recusas de upload derrubavam a conexão no Windows.

### Fase 3: luz dinâmica e efeitos de magia ✅ feita
- **Paredes e portas do MonTT** vão com o mapa (`hw`/`vw`) e seguem ao vivo, como a névoa. Reenviar o mapa usa `merge`, então as portas abertas e a configuração de luz continuam.
- **Geometria em `mesa-luz.js`** (testável com `node mesa-luz.js`): paredes seguidas viram um segmento só; a visão é o polígono de raios até as pontas das paredes; `cruzaParede` para o movimento; as quatro áreas do 5e (o quadrado conta se o centro estiver dentro).
- **Luz dinâmica por mapa** (o mestre escolhe no topo: desligada, dia, noite):
  - O jogador enxerga pelos próprios tokens (o mestre pode desligar "Enxerga" num token). De dia, tudo que está à vista; de noite, só o que alguma luz alcança, ou o raio de visão no escuro do token, que conta como penumbra.
  - Cada luz ilumina só o que ela própria "vê": a luz de uma tocha não atravessa parede.
  - Luz forte e penumbra (`luz: [forte, penumbra]` em ft): vela 5/5, tocha 20/20, lanterna 30/30, magia Luz 20/20. O dono do token escolhe a luz que carrega; a visão no escuro é o mestre quem dá.
  - Tokens dos outros só aparecem onde o jogador enxerga agora.
  - **Explorer Mode** (liga e desliga por mapa): o que o jogador já viu fica escurecido em vez de preto. A memória fica no navegador de cada um (`localStorage`).
  - O mestre vê tudo, ou escolhe **"Ver como: jogador"** para conferir o que cada um vê.
- **Portas:** com a luz ligada, o mestre vê marcadores nas portas (vermelho fechada, verde aberta) e abre ou fecha com um clique. Portas duplas abrem juntas.
- **Movimento:** com a luz ligada, o jogador não atravessa parede nem porta fechada (o token volta e aparece um aviso). `ponytail:` conferido só no navegador; durante o arraste, as posições intermediárias passam pela parede para os outros.
- **Magia** (botão ✨ Magia ou `/fx` no chat; todos podem, e apagam só as próprias):
  - **Áreas** que ficam no mapa: esfera, cone, cubo e linha, com tamanho em ft. Arrastar dá a direção (o cubo encaixa de 90 em 90°). Mostra os quadrados atingidos, destaca os tokens atingidos e diz quantos foram. O botão direito na área apaga.
  - **Animações** para todos (não ficam salvas): bola de fogo, raio de fogo (de A até B), relâmpago (de A até B), cura, nuvem, gelo.
  - **Luzes de magia:** Luz (20/20 no ponto), Luzes dançantes (penumbra de 10 ft), Escuridão (bolha de 15 ft que apaga luz e visão no escuro).
- **Testado no navegador:** à noite, a tocha do Brannoc iluminou até a parede do castelo e os goblins lá dentro ficaram escondidos; o mestre abriu a porta e, com o Brannoc na frente dela, a luz entrou e a Ana viu os dois goblins; o cone de 15 ft da Ana marcou 2 atingidos; bola de fogo e relâmpago apareceram nas duas telas; a Escuridão escondeu os goblins mesmo com a tocha, e a Ana a apagou pelo botão direito; com a porta fechada, a Ana não conseguiu passar; o "Ver como: Ana" do mestre bateu com a tela dela; no modo dia, o lado de fora ficou todo visível. O autoteste do servidor cobre as permissões novas; o `node mesa-luz.js` cobre a geometria.
- **Ainda não:** luz presa a um token que se move (a magia Luz fica no ponto onde foi lançada); barreiras transparentes ou de mão única; a imagem do mapa continua inteira no navegador do jogador (quem abrir o DevTools vê tudo).

### Fase 4: fichas e diário ✅ feita
- **Diário** ao lado do chat: fichas e handouts que você pode ver. "+ Ficha" para todos (o jogador vira dono da ficha que cria), "+ Texto" só para o mestre.
- **Ficha 5e** (`character` com `attrs`): classe, nível, raça, CA, PV, deslocamento, os seis atributos, resistências e as 18 perícias com proficiência, ataques (acerto e dano) e um campo para magias, equipamento e notas. Modificador e bônus de proficiência são calculados (o bônus sai do nível).
  - Cada campo salva sozinho ao sair dele. O cliente manda só o campo que mudou e o servidor junta com o resto (`attrs` faz merge), então o mestre mexendo no PV e o jogador escrevendo notas não se atropelam.
  - Botões de rolar em tudo: Teste, Resist., perícias, Iniciativa (entra na ordem de turno se a ficha tem token no mapa), Acerto e Dano.
- **`@{atributo}` no chat**, trocado pelo servidor: `/r 1d20+@{des_mod}+@{prof}` usa a ficha aberta, e `@{Brannoc|des_mod}` usa a ficha pelo nome (de qualquer ficha que você possa ver). `<atributo>_mod` e `prof` são calculados. A mensagem aparece como "Brannoc (Ana)".
- **Quem vê** (como o "journal" do Roll20): o mestre vê tudo; o jogador vê o que é dele (`owner`) ou o que foi mostrado (`ver`: nomes ou `*` para todos). O mestre escolhe os donos; o dono pode marcar "Todos veem".
- **Barra de PV no token:** um token ligado a uma ficha (`ficha: <id>`) mostra o PV dela; mudar pela ficha ou pelo botão direito no token (PV… aceita `12`, `-7`, `+5` ou `12/20`) é a mesma coisa, porque o PV só existe na ficha. Token sem ficha (monstro) guarda o próprio PV e a barra só o mestre vê.
- **Arrastar a ficha do diário para o mapa** (mestre) cria um token já ligado, com os mesmos donos.
- **Handouts:** título, imagem (o mesmo upload do mapa), texto e notas do mestre (`gmnota`, nunca chegam aos jogadores). O mestre marca para quem mostrar, e o handout abre sozinho na tela de quem passou a vê-lo.
- **Testado no navegador:** o mestre criou a ficha do Brannoc digitando Destreza 16 e nível 5, marcou Furtividade e rolou: `1d20+3+3` como "Brannoc (Mestre)"; deu a ficha à Ana e a arrastou para o mapa (token ligado, dono Ana); a Ana tirou 7 PV pelo menu do token e a barra caiu para 30% (amarela) nas duas telas; ela rolou `/r 1d20+@{des_mod} ataque furtivo` no chat com a ficha aberta; o mestre criou a "Carta do barão" com uma nota secreta, mostrou só para a Ana e a carta abriu sozinha na tela dela, sem a nota; o PV de um goblin sem ficha ficou sem barra para a Ana. O autoteste cobre permissões, merge, `@{}` (com sinal negativo) e handouts.
- `ponytail:` a ficha inteira vai para quem pode vê-la (o Roll20 manda um resumo e carrega o resto ao abrir; com 6 pessoas não pesa). Mudar os donos da ficha não muda os donos dos tokens já no mapa (use o menu do token). O PV de monstro não aparece na tela do jogador, mas chega no navegador dele (DevTools), como a imagem do mapa.

### Fora do plano (de propósito)
- **Áudio, música e vídeo:** usar o Discord.
- **API de scripts (Mods), loja, baralhos, dados 3D, grade hexagonal:** só se fizerem falta de verdade.

---

## 4. Onde está cada coisa

| Arquivo | O que é |
|---|---|
| `mesa.py` | servidor: SSE + ops + upload + gravação; `py mesa.py --teste` roda o autoteste |
| `mesa.html` | a mesa (o que os jogadores abrem) |
| `mesa-luz.js` | geometria da visão, do movimento e das áreas de magia; `node mesa-luz.js` testa |
| `MonTT.html` | o editor de mapas; função `sendToTable` = botão "Enviar ao Nothic" |
| `lightscreen-core.js` | rolador de dados e tabelas (o chat vai reaproveitar a sintaxe) |
| `campanha.json`, `uploads/` | gerados pelo servidor, fora do git |

As fases 0 a 4 estão feitas. Próximo passo: jogar uma sessão de verdade pelo túnel e corrigir o que aparecer.
