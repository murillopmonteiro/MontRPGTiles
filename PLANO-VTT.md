# Plano: a mesa online (um VTT pequeno, no estilo do Roll20)

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
 └──────────────────────────┘  SSE /stream  │ salva campanha.json          │
                                            └──────────────────────────────┘
```

- **Servidor: um arquivo `mesa.py` com `http.server` + `ThreadingHTTPServer`, sem dependências.** Envia com **Server-Sent Events** (`EventSource`, nativo no navegador) e recebe por `fetch` POST. Não precisa de WebSocket: na mesa, as mudanças são poucas por segundo. Você já roda `py -m http.server`, então é o mesmo jeito de usar.
  - `ponytail:` SSE + POST, com uma thread por conexão. Aguenta umas dezenas de pessoas. Se um dia tiver um grupo grande, troca por WebSocket (`websockets` ou Node `ws`).
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

### Fase 0: prova de conceito (1 noite)
- `mesa.py`: `GET /stream` (SSE), `POST /op`, serve os arquivos estáticos.
- Uma página com 3 círculos arrastáveis.
- **Pronto quando:** ao arrastar em uma aba, o token se move na outra (testar também em outro PC pelo túnel).

### Fase 1: MonTT online
- Adicionar um "modo mesa" ao `MonTT.html`: se a URL tiver `?mesa`, ele conecta, carrega a `page` vinda do servidor e envia `change` ao soltar um token (e, durante o arraste, no máximo a cada ~100 ms).
- O mestre pode publicar o mapa atual como `page` e escolher o `playerPage`.
- Mestre e jogador separados pelo link, com o filtro de `gmlayer` no servidor.
- **Pronto quando:** o mestre monta o mapa, os jogadores veem e movem só os próprios tokens, e a névoa manual do mestre chega para todos.

### Fase 2: chat, dados e iniciativa
- Painel de chat: `/r 2d6+3`, `/gr` (rolagem que só o mestre vê), `/w nome` (sussurro), `/em` (ação). Usa o `rollExpr` do `lightscreen-core.js`.
  - `ponytail:` no começo, o dado é rolado no navegador de quem rola (os amigos são de confiança). Se precisar, a rolagem passa para o servidor, com um parser pequeno em Python.
- Iniciativa: lista no `campaign.turnorder`, com botão "próximo" e o token da vez destacado no mapa.
- Ping no mapa (segurar o clique) e régua compartilhada (régua aparece para todos).

### Fase 3: luz dinâmica e névoa automática
- Calcular a **área visível** de cada token com visão: lançar raios até as pontas de cada segmento de parede dentro do raio e montar o polígono (o algoritmo clássico de "visibility polygon"). As paredes do MonTT ficam nas linhas da grade, então são poucos segmentos e o cálculo é rápido.
- O jogador vê: a união das áreas dos tokens dele ∩ as áreas iluminadas (ou tudo, se `lightglobalillum`).
- **Explorer Mode:** um canvas fora da tela por jogador acumula o que já foi visto e é desenhado em cinza. É salvo por página e por jogador.
- `restrictMove`: o token não atravessa uma aresta com parede (verificar ao soltar).
- Isso é cálculo no navegador. `ponytail:` o jogador recebe o mapa inteiro, então quem abrir o DevTools vê tudo. Com amigos isso tudo bem. Para impedir, o servidor teria de recortar o mapa por jogador, o que é muito mais trabalho.

### Fase 4: fichas e diário
- `character` com uma ficha HTML simples (começar por D&D 5e: atributos, CA, PV, perícias, ataques). Os campos são `attrs`, e o botão de rolar envia `/r 1d20+@{des}` com a substituição feita a partir da ficha.
- A barra do token ligada a um atributo (`bars[i].attr`): mudou o PV na ficha, mudou a barra, e vice-versa.
- Arrastar a ficha para o mapa cria um token já ligado.
- Handouts: texto e imagem, com "mostrar para todos" ou para alguns.

### Fase 5: imagens
- `POST /upload` grava imagens (tokens, mapas, handouts) em `uploads/`.

### Fora do plano (de propósito)
- **Áudio, música e vídeo:** usar o Discord.
- **API de scripts (Mods), loja, baralhos, dados 3D, grade hexagonal:** só se fizerem falta de verdade.

---

## 4. Ordem dos arquivos

| Arquivo | O que muda |
|---|---|
| `mesa.py` (novo) | servidor SSE + POST + estado + permissões + gravação, com um autoteste em `__main__` |
| `MonTT.html` | modo mesa (conexão, envio de ops, papéis, chat, iniciativa, luz) |
| `lightscreen-core.js` | sem mudança; o chat usa o `rollExpr` |
| `campanha.json` (gerado) | o estado salvo; entra no `.gitignore` |

Primeiro passo concreto: **Fase 0**, um `mesa.py` de ~120 linhas e uma página de teste.
