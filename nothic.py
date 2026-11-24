"""Nothic, a mesa online: servidor de sincronização, só com a biblioteca padrão do Python.

    py nothic.py            -> mostra os links do mestre e dos jogadores
    py nothic.py --lan      -> aceita outros PCs da rede
    py nothic.py --teste    -> autoteste

Modelo (igual ao Roll20): o estado é um dicionário de objetos {id: {type, ...}}.
O cliente envia POST /op {op: add|change|destroy, type, id, props} e recebe tudo
por long polling em GET /poll: a 1ª resposta traz um snapshot e o id da sessão (c);
as seguintes esperam até haver ops e devolvem todas de uma vez. (SSE seria mais
simples, mas o túnel rápido da Cloudflare segura o stream inteiro.)

Papéis: quem tem ?gm=<segredo> é o mestre e pode tudo. Quem tem ?p=<nome> é
jogador: só move tokens cujo `owner` tem o nome dele, e nunca recebe objetos
com layer 'gm' nem campos que começam com 'gm' (notas do mestre).

Chat (POST /chat): o servidor rola os dados, como o Roll20, então ninguém forja
resultado. Mensagens com `to` (sussurros, /gr) só chegam a quem está na lista.
Efeitos passageiros (POST /fx: ping, régua) vão para todos e não são salvos.
Fichas (character) e handouts só chegam ao jogador dono ou a quem está em `ver`;
@{atributo} no chat é trocado pelo número da ficha aqui no servidor.
"""
import json, os, queue, random, re, secrets, sys, threading, time, uuid
from collections import Counter
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlsplit

PASTA = os.path.dirname(os.path.abspath(__file__))
ARQUIVO = os.path.join(PASTA, 'campanha.json')
OPS = {'add', 'change', 'destroy'}
MAX_CORPO = 256 * 1024
MAX_IMAGEM = 25 * 1024 * 1024
ARQUIVOS = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif',
            'application/pdf': '.pdf'}   # mapas e anexos dos documentos
MESTRE = ('gm', 'Mestre')
MSGS_GUARDADAS, MSGS_NO_SNAPSHOT = 300, 100
CORES = ['#e0735a', '#5fa8e0', '#7fd18f', '#c98ae8', '#e8c46a', '#5fd1c4', '#f08fb0', '#a3b86c']

trava = threading.Lock()   # ponytail: uma trava global; com 6 pessoas não faz diferença
estado = {'seq': 0, 'objs': {}, 'gm': ''}
clientes = {}              # fila de cada sessão -> (papel, nome)
sessoes = {}               # id da sessão -> [fila, (papel, nome), último contato]
ESPERA, VALIDADE = 20, 45  # segundos que um /poll espera; sessão sem contato some (aba fechada)
conexoes = Counter()       # nome -> conexões abertas (a mesma pessoa em 2 abas)
sujo = False
dado = random.SystemRandom()


class Proibido(Exception):
    pass


def carregar():
    global estado, sujo
    if os.path.exists(ARQUIVO):
        with open(ARQUIVO, encoding='utf-8') as f:
            estado = json.load(f)
    if not estado.get('gm'):
        estado['gm'] = secrets.token_urlsafe(9)   # o link do mestre; fica no campanha.json
        sujo = True                               # grava já, senão reiniciar mudaria o link


def gravar_periodicamente():
    global sujo
    while True:
        time.sleep(2)
        limpar_sessoes()
        with trava:
            if not sujo:
                continue
            dados = json.dumps(estado, ensure_ascii=False)
            sujo = False
        tmp = ARQUIVO + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            f.write(dados)
        os.replace(tmp, ARQUIVO)   # troca atômica: não corrompe se cair no meio


# ---------------------------------------------------------------- dados

TERMO = re.compile(r'\s*([+-])?\s*(?:(\d*)d(\d+)(?:(kh|kl)(\d+))?|(\d+))\s*', re.I)


def rolar(expr):
    """'2d20kh1+5' -> (total, partes). Cada parte: {s, v} ou {s, v, dado, rolls, keep}."""
    pos, total, partes = 0, 0, []
    if not expr.strip():
        raise ValueError('rolar o quê? ex.: /r 1d20+5')
    while pos < len(expr):
        m = TERMO.match(expr, pos)
        if not m or m.end() == pos:
            raise ValueError(f'não entendi "{expr[pos:].strip()}"')
        sinal, n, faces, k, kn, const = m.groups()
        if partes and not sinal:
            raise ValueError(f'falta + ou - antes de "{m.group().strip()}"')
        s = -1 if sinal == '-' else 1
        if faces:
            n, f = int(n or 1), int(faces)
            if not (1 <= n <= 100 and 1 <= f <= 1000):
                raise ValueError('use até 100 dados de até 1000 faces')
            rolls = [dado.randint(1, f) for _ in range(n)]
            keep = [True] * n
            if k:
                kn = int(kn)
                ordem = sorted(range(n), key=lambda i: rolls[i], reverse=k.lower() == 'kh')
                keep = [i in ordem[:kn] for i in range(n)]
            v = sum(r for r, ok in zip(rolls, keep) if ok)
            partes.append({'s': s, 'v': v, 'dado': f'{n}d{f}' + (f'{k.lower()}{kn}' if k else ''),
                           'rolls': rolls, 'keep': keep})
        else:
            partes.append({'s': s, 'v': int(const)})
        total += s * partes[-1]['v']
        pos = m.end()
        if len(partes) > 20:
            raise ValueError('expressão grande demais')
    return total, partes


def rolar_com_rotulo(texto):
    """'1d20+5 ataque com espada' -> a maior expressão válida no começo + o resto como rótulo."""
    palavras = texto.split()
    for i in range(len(palavras), 0, -1):
        expr = ' '.join(palavras[:i])
        try:
            total, partes = rolar(expr)
        except ValueError:
            continue
        return {'expr': expr.replace(' ', ''), 'total': total, 'partes': partes}, ' '.join(palavras[i:])
    rolar(texto)   # nenhuma serviu: levanta o erro da expressão inteira
    raise ValueError('não entendi a rolagem')


# ---------------------------------------------------------------- objetos

def visivel(obj, quem):
    papel, nome = quem
    if obj is None or (papel != 'gm' and (obj.get('layer') == 'gm' or obj.get('type') == 'modelo')):
        return False   # modelos de token são a biblioteca do mestre
    if obj.get('type') == 'msg':
        to = obj.get('to')
        return not to or nome in to or nome == obj.get('who')
    if obj.get('type') in ('character', 'handout') and papel != 'gm':
        # fichas e handouts: o jogador vê se é dono ou se o mestre mostrou ('*' = todos)
        ver = obj.get('ver') if isinstance(obj.get('ver'), list) else []
        return '*' in ver or nome in ver or nome in (obj.get('owner') or [])
    return True


def para(papel, props):
    """O que um papel pode ver de um objeto: jogadores não recebem campos gm*."""
    return props if papel == 'gm' else {k: v for k, v in props.items() if not k.startswith('gm')}


DO_JOGADOR = {'aoe', 'luz', 'character'}   # áreas, luzes de magia e fichas: o próprio jogador cria, muda e apaga


def luz_valida(v):
    return v is None or (isinstance(v, list) and len(v) == 2
                         and all(isinstance(n, (int, float)) and 0 <= n <= 300 for n in v))


def permitir(msg, quem, obj):
    """Regras do jogador. O mestre pode tudo."""
    papel, nome = quem
    if papel == 'gm':
        return
    op, props = msg['op'], msg.get('props') or {}
    meu = obj is not None and nome in (obj.get('owner') or [])
    if op == 'add' and msg.get('type') in DO_JOGADOR and obj is None:
        if props.get('owner') != [nome]:
            raise Proibido('a área ou luz tem que ser sua')
        return
    if obj and obj.get('type') in DO_JOGADOR and meu and op in ('change', 'destroy'):
        if op == 'change' and ({'owner', 'type'} & set(props)):
            raise Proibido('não dá para mudar o dono')
        return
    if op != 'change' or not obj or obj.get('type') != 'token' or not meu:
        raise Proibido('jogador só move os próprios tokens')
    # no próprio token: posição, a luz que carrega (tocha, lanterna) e as condições
    if not props or set(props) - {'x', 'y', 'luz', 'cond'}:
        raise Proibido('jogador só muda posição, luz e condições do token')
    c = props.get('cond', [])
    if not (isinstance(c, list) and len(c) <= 20 and all(isinstance(x, str) and len(x) <= 30 for x in c)):
        raise Proibido('condições inválidas')
    if not all(isinstance(props[k], (int, float)) for k in ('x', 'y') if k in props) or not luz_valida(props.get('luz')):
        raise Proibido('valores inválidos')


def aplicar(msg, quem=MESTRE):
    """Valida, checa permissão e aplica uma op. Devolve o novo seq."""
    global sujo
    if not isinstance(msg, dict) or msg.get('op') not in OPS:
        raise ValueError('op inválida')
    oid, props = msg.get('id'), msg.get('props') or {}
    if not isinstance(oid, str) or not 0 < len(oid) <= 64 or not isinstance(props, dict):
        raise ValueError('id ou props inválidos')
    if not isinstance(props.get('attrs', {}), dict) or not isinstance(props.get('ver', []), list):
        raise ValueError('attrs ou ver inválidos')
    with trava:
        objs = estado['objs']
        antes = objs.get(oid)
        permitir(msg, quem, antes)
        if msg['op'] == 'add':
            if not isinstance(msg.get('type'), str):
                raise ValueError('add precisa de type')
            if msg.get('keep') and antes:   # reenviar o mapa não reposiciona tokens já na mesa
                return estado['seq']
            # merge: reenviar o mapa troca imagem e paredes, mas mantém portas abertas e luz
            objs[oid] = {**(antes if msg.get('merge') and antes else {}), **props, 'type': msg['type']}
        elif antes is None:
            raise ValueError('objeto não existe')
        elif msg['op'] == 'change':
            props.pop('type', None)
            if 'attrs' in props and isinstance(antes.get('attrs'), dict):   # cada um manda só o campo da ficha que mudou
                props['attrs'] = {**antes['attrs'], **props['attrs']}
            objs[oid] = {**antes, **props}
        else:
            del objs[oid]
        depois = objs.get(oid)
        estado['seq'] += 1
        sujo = True
        # cada conexão recebe a op do ponto de vista dela: um token que passa para
        # a camada gm "some" (destroy) para os jogadores, e "aparece" (add) ao voltar
        for q, dono in list(clientes.items()):
            via, vdepois = visivel(antes, dono), visivel(depois, dono)
            base = {'id': oid, 'seq': estado['seq']}
            if vdepois and (msg['op'] == 'add' or not via):
                q.put({**base, 'op': 'add', 'type': depois['type'], 'props': para(dono[0], depois)})
            elif via and not vdepois:
                q.put({**base, 'op': 'destroy'})
            elif via and vdepois:
                q.put({**base, 'op': 'change', 'props': para(dono[0], props)})
        if depois and depois['type'] == 'msg':   # o chat não cresce para sempre
            ids = sorted(k for k, o in objs.items() if o['type'] == 'msg')
            for velho in ids[:-MSGS_GUARDADAS]:
                del objs[velho]   # os clientes já cortam o histórico deles sozinhos
        return estado['seq']


def snapshot(quem):
    papel, _ = quem
    objs = {k: para(papel, o) for k, o in estado['objs'].items() if visivel(o, quem)}
    msgs = sorted(k for k, o in objs.items() if o['type'] == 'msg')
    for k in msgs[:-MSGS_NO_SNAPSHOT]:
        del objs[k]
    return objs


def presenca(nome, papel, delta):
    """Marca o jogador online na 1ª conexão e offline quando a última cai."""
    with trava:
        conexoes[nome] += delta
        n = conexoes[nome]
        existe = ('pl-' + nome) in estado['objs']
    if delta > 0 and n == 1:
        cor = '#d4a24c' if papel == 'gm' else CORES[sum(map(ord, nome)) % len(CORES)]
        aplicar({'op': 'change' if existe else 'add', 'type': 'player', 'id': 'pl-' + nome,
                 'props': {'name': nome, 'gm': papel == 'gm', 'online': True, 'color': cor}})
    elif delta < 0 and n == 0 and existe:
        aplicar({'op': 'change', 'id': 'pl-' + nome, 'props': {'online': False}})


# ---------------------------------------------------------------- fichas

ATRIBUTOS = ('for', 'des', 'con', 'int', 'sab', 'car')
REF = re.compile(r'@\{(?:([^|{}]{1,40})\|)?(\w{1,40})\}')   # @{des_mod} ou @{Brannoc|des_mod}


def valor(ch, k):
    """Um número da ficha. <atributo>_mod e prof são calculados como no 5e."""
    a = ch.get('attrs') or {}
    try:
        if k.endswith('_mod') and k[:-4] in ATRIBUTOS:
            return (int(a.get(k[:-4]) or 10) - 10) // 2
        if k == 'prof' and 'prof' not in a:
            return 2 + (max(1, int(a.get('nivel') or 1)) - 1) // 4
        return int(a[k])
    except (KeyError, ValueError, TypeError):
        raise ValueError(f'a ficha de {ch.get("name") or "?"} não tem um número em "{k}"')


def substituir(texto, quem, ficha):
    """Troca @{...} pelos números da ficha. Devolve (texto, ficha usada ou None)."""
    with trava:
        objs = estado['objs']
        fichas = [o for o in objs.values() if o['type'] == 'character' and visivel(o, quem)]
        padrao = objs.get(ficha) if isinstance(ficha, str) else None
    if not padrao or padrao['type'] != 'character' or not visivel(padrao, quem):
        padrao = None

    def troca(m):
        nome, k = m.groups()
        ch = next((o for o in fichas if (o.get('name') or '').lower() == nome.strip().lower()), None) if nome else padrao
        if not ch:
            raise ValueError(f'ficha "{nome}" não encontrada' if nome else 'abra uma ficha para usar @{...}')
        return str(valor(ch, k))

    novo = REF.sub(troca, texto)
    if novo != texto:   # 1d20+@{for_mod} com for 8 vira 1d20+-1: arruma o sinal
        novo = re.sub(r'([+-])\s*([+-])', lambda m: '-' if m[1] != m[2] else '+', novo)
    return novo, padrao


# ---------------------------------------------------------------- chat

AJUDA = ('Comandos: /r 1d20+5 ataque · /gr 1d20 (só o mestre vê) · /w Nome texto (sussurro) · '
         '/em sorri (ação) · 2d20kh1 = vantagem, 2d20kl1 = desvantagem')


def postar(quem, props):
    with trava:
        mid = 'm-%09d-%s' % (estado['seq'] + 1, secrets.token_hex(2))   # o sufixo evita colisão entre duas falas ao mesmo tempo
    aplicar({'op': 'add', 'type': 'msg', 'id': mid, 'props': {'who': quem[1], 'ts': int(time.time() * 1000), **props}})


def chat(quem, corpo):
    """Interpreta uma linha do chat e posta a mensagem. Levanta ValueError/Proibido."""
    texto = str(corpo.get('text') or '').strip()
    if not texto or len(texto) > 500:
        raise ValueError('mensagem vazia ou longa demais')
    texto, ficha = substituir(texto, quem, corpo.get('ficha'))
    como = {'como': ficha.get('name') or '?'} if ficha else {}   # "Ana (Brannoc)" no chat
    cmd, _, resto = texto.partition(' ')
    cmd, resto = cmd.lower(), resto.strip()
    if not texto.startswith('/'):
        return postar(quem, {'kind': 'say', 'text': texto, **como})
    if cmd in ('/r', '/roll', '/gr'):
        roll, rotulo = rolar_com_rotulo(resto)
        extra = {'to': sorted({MESTRE[1], quem[1]})} if cmd == '/gr' else {}
        return postar(quem, {'kind': 'roll', 'roll': roll, 'text': rotulo, **extra, **como})
    if cmd == '/em':
        if not resto:
            raise ValueError('/em o quê?')
        return postar(quem, {'kind': 'emote', 'text': resto, **como})
    if cmd == '/w':
        if resto.startswith('"'):
            alvo, _, msg = resto[1:].partition('"')
        else:
            alvo, _, msg = resto.partition(' ')
        alvo, msg = alvo.strip(), msg.strip()
        with trava:
            nomes = {o['name'] for o in estado['objs'].values() if o['type'] == 'player'}
        if alvo.lower() in ('mestre', 'gm'):
            alvo = MESTRE[1]
        if alvo not in nomes:
            raise ValueError(f'ninguém chamado "{alvo}" na mesa' if alvo else 'use /w Nome mensagem')
        if not msg:
            raise ValueError('sussurrar o quê?')
        return postar(quem, {'kind': 'whisper', 'text': msg, 'to': sorted({alvo, quem[1]})})
    if cmd == '/init':
        return iniciativa(quem, corpo.get('token'), resto)
    raise ValueError(AJUDA)


def iniciativa(quem, tid, mod):
    """Rola 1d20+mod para um token e coloca na ordem de turno (campaign 'mesa')."""
    with trava:
        t = estado['objs'].get(tid) if isinstance(tid, str) else None
        mesa = dict(estado['objs'].get('mesa') or {})
    if not t or t.get('type') != 'token':
        raise ValueError('escolha um token para a iniciativa')
    if quem[0] != 'gm' and quem[1] not in (t.get('owner') or []):
        raise Proibido('só rola iniciativa dos próprios tokens')
    if not re.fullmatch(r'[+-]?\s*\d{0,2}', mod or ''):
        raise ValueError('use /init +2')
    roll, _ = rolar_com_rotulo('1d20' + (('+' + mod.lstrip('+')) if mod and mod[0] != '-' else mod or ''))
    antiga, turn = mesa.get('turnorder') or [], mesa.get('turn', 0)
    davez = antiga[turn % len(antiga)]['id'] if antiga else None
    ordem = [e for e in antiga if e['id'] != tid]
    ordem.append({'id': tid, 'name': t.get('name') or '?', 'pr': roll['total']})
    ordem.sort(key=lambda e: -e['pr'])   # ponytail: empate fica na ordem de chegada
    # quem entra no meio da rodada não rouba a vez de quem está jogando
    turn = next((i for i, e in enumerate(ordem) if e['id'] == davez), 0) if davez != tid else turn % len(ordem)
    aplicar({'op': 'change' if 'type' in mesa else 'add', 'type': 'campaign', 'id': 'mesa',
             'props': {'turnorder': ordem, 'turn': turn, 'round': mesa.get('round', 1)}})
    postar(quem, {'kind': 'roll', 'roll': roll, 'text': f'iniciativa de {t.get("name") or "?"}',
                  **({'to': [MESTRE[1]]} if t.get('layer') == 'gm' else {})})


MAGIAS = {'fogo', 'raio', 'relampago', 'cura', 'nuvem', 'gelo', 'brilho'}


def efeito(quem, corpo):
    """Ping, régua e animações de magia: vão para todos na hora e não são salvos (o 'broadcast' do Roll20)."""
    kind = corpo.get('kind')
    if kind == 'mostrar':   # o "Show to Players" do Roll20: abre o documento na tela de quem pode vê-lo
        if quem[0] != 'gm':
            raise Proibido('só o mestre mostra documentos')
        with trava:
            h = estado['objs'].get(corpo.get('id'))
            if not h or h.get('type') != 'handout':
                raise ValueError('documento não existe')
            for q, dono in clientes.items():
                if visivel(h, dono):
                    q.put({'op': 'fx', 'kind': 'mostrar', 'id': corpo['id']})
        return
    nums = {k: corpo[k] for k in ('x', 'y', 'x2', 'y2', 'max') if isinstance(corpo.get(k), (int, float))}
    if kind not in ('ping', 'regua', 'magia') or 'x' not in nums or not isinstance(corpo.get('page'), str):
        raise ValueError('efeito inválido')
    if kind == 'magia' and corpo.get('efeito') not in MAGIAS:
        raise ValueError('efeito de magia desconhecido')
    with trava:
        cor = (estado['objs'].get('pl-' + quem[1]) or {}).get('color', '#fff')
        out = {'op': 'fx', 'kind': kind, 'page': corpo['page'], 'who': quem[1], 'color': cor,
               'fim': bool(corpo.get('fim')), **nums}
        if kind == 'magia':
            out['efeito'] = corpo['efeito']
        for q in clientes:
            q.put(out)


# ---------------------------------------------------------------- HTTP

class Mesa(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=PASTA, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')   # sempre confere a versão nova da mesa (304 se não mudou)
        super().end_headers()

    def log_message(self, *a):
        pass

    def quem(self):
        """('gm', 'Mestre'), ('player', nome) ou None."""
        q = parse_qs(urlsplit(self.path).query)
        if 'gm' in q:
            return MESTRE if secrets.compare_digest(q['gm'][0], estado['gm']) else None
        nome = (q.get('p') or [''])[0].strip()
        if 0 < len(nome) <= 24 and nome.isprintable() and '"' not in nome and nome.lower() not in ('mestre', 'gm'):
            return ('player', nome)
        return None

    def do_GET(self):
        caminho = urlsplit(self.path).path
        if caminho == '/poll':
            return self.poll()
        partes = caminho.split('/')
        # não servir .git, campanha.json nem arquivos ocultos pelo túnel
        if any(p.startswith('.') for p in partes) or partes[-1].startswith('campanha'):
            return self.send_error(404)
        super().do_GET()

    def poll(self):
        quem = self.quem()
        if not quem:
            return self.responder(403, {'erro': 'link sem ?p=<nome> ou segredo do mestre errado'})
        sid = (parse_qs(urlsplit(self.path).query).get('c') or [''])[0]
        with trava:
            s = sessoes.get(sid)
            if s and s[1] == quem:
                s[2] = time.time()
            else:   # sessão nova (ou o servidor reiniciou): começa com um snapshot
                fila, sid = queue.Queue(), secrets.token_urlsafe(9)
                snap = {'op': 'snapshot', 'seq': estado['seq'], 'objs': snapshot(quem),
                        'eu': {'papel': quem[0], 'nome': quem[1]}}
                clientes[fila] = quem
                sessoes[sid] = [fila, quem, time.time()]
                s = None
        if not s:
            presenca(quem[1], quem[0], +1)
            return self.responder(200, {'c': sid, 'msgs': [snap]})
        msgs = []
        try:
            msgs.append(s[0].get(timeout=ESPERA))
            while True:
                msgs.append(s[0].get_nowait())
        except queue.Empty:
            pass
        s[2] = time.time()
        try:
            self.responder(200, {'c': sid, 'msgs': msgs})
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass   # ponytail: o que estava nessa resposta se perde; a próxima op corrige

    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        caminho, quem = urlsplit(self.path).path, self.quem()
        if caminho not in ('/op', '/upload', '/chat', '/fx'):
            return self.send_error(404)
        if not quem:
            self.descartar(n)
            return self.responder(403, {'erro': 'sem identificação'})
        if caminho == '/upload':
            return self.upload(n, quem)
        if not 0 < n <= MAX_CORPO:
            return self.send_error(413)
        try:
            corpo = json.loads(self.rfile.read(n))
            if not isinstance(corpo, dict):
                raise ValueError('JSON inválido')
            if caminho == '/op':
                return self.responder(200, {'seq': aplicar(corpo, quem)})
            (chat if caminho == '/chat' else efeito)(quem, corpo)
            self.responder(200, {'ok': True})
        except Proibido as e:
            self.responder(403, {'erro': str(e)})
        except (ValueError, json.JSONDecodeError) as e:
            self.responder(400, {'erro': str(e)})

    def upload(self, n, quem):
        if quem[0] != 'gm':
            self.descartar(n)
            return self.responder(403, {'erro': 'só o mestre envia imagens'})
        ext = ARQUIVOS.get((self.headers.get('Content-Type') or '').split(';')[0])
        if not ext:
            self.descartar(n)
            return self.responder(415, {'erro': 'só PNG, JPG, WebP, GIF ou PDF'})
        if not 0 < n <= MAX_IMAGEM:
            return self.send_error(413)
        os.makedirs(os.path.join(PASTA, 'uploads'), exist_ok=True)
        nome = uuid.uuid4().hex + ext   # nome gerado aqui: o cliente não escolhe caminho
        with open(os.path.join(PASTA, 'uploads', nome), 'wb') as f:
            f.write(self.rfile.read(n))
        self.responder(200, {'url': '/uploads/' + nome})

    def descartar(self, n):
        """Lê o corpo antes de recusar: no Windows, fechar com dados não lidos derruba a resposta."""
        if 0 < n <= MAX_IMAGEM:
            self.rfile.read(n)

    def responder(self, cod, obj):
        corpo = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(cod)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)


def limpar_sessoes():
    """Quem parou de perguntar (aba fechada, sem internet) sai da mesa."""
    agora, saiu = time.time(), []
    with trava:
        for sid, (fila, quem, visto) in list(sessoes.items()):
            if agora - visto > VALIDADE:
                del sessoes[sid]
                clientes.pop(fila, None)
                saiu.append(quem)
    for papel, nome in saiu:
        presenca(nome, papel, -1)


class Servidor(ThreadingHTTPServer):
    # no Windows, SO_REUSEADDR deixa dois nothic.py ouvirem a mesma porta, cada um com a sua mesa
    # (o mapa vai para um e a página lê do outro); sem ele, o segundo falha ao abrir
    allow_reuse_address = os.name != 'nt'
    daemon_threads = True


def servidor(host, porta):
    return Servidor((host, porta), Mesa)


# ---------------------------------------------------------------- autoteste

def teste_dados():
    for _ in range(300):
        t, p = rolar('2d20kh1+5')
        assert 6 <= t <= 25 and p[0]['keep'].count(True) == 1 and p[0]['v'] == max(p[0]['rolls'])
        t, p = rolar('4d6kl3 - 2')
        assert t == sum(sorted(p[0]['rolls'])[:3]) - 2
        assert 1 <= rolar('d20')[0] <= 20
    assert rolar('3+4')[0] == 7 and rolar('10-1d1')[0] == 9
    for ruim in ('', 'abc', '1d20 5', '1d1001', '200d6', '1d20+', 'd'):
        try:
            rolar(ruim); raise AssertionError(ruim)
        except ValueError:
            pass
    r, rot = rolar_com_rotulo('1d8 + 3 de dano cortante')
    assert r['expr'] == '1d8+3' and rot == 'de dano cortante', (r, rot)


def teste():
    import http.client
    global ARQUIVO
    teste_dados()
    ARQUIVO = os.path.join(os.environ.get('TEMP', '/tmp'), 'nothic-teste.json')
    estado['gm'] = 's3gr3d0'
    srv = servidor('127.0.0.1', 0)
    porta = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    GM, ANA, BIA = '?gm=s3gr3d0', '?p=Ana', '?p=Bia'

    class conectar:   # um navegador fazendo long polling
        def __init__(self, q):
            self.q, self.c, self.fila = q, '', []
            st, d = req('GET', '/poll' + q)
            self.status = st
            if st == 200:
                d = json.loads(d); self.c = d['c']; self.fila = d['msgs']

        def proximo(self):
            while not self.fila:
                st, d = req('GET', f'/poll{self.q}&c={self.c}')
                assert st == 200, st
                self.fila = json.loads(d)['msgs']
            return self.fila.pop(0)

    def evento(r):   # próximo evento, pulando os de presença
        while True:
            e = r.proximo()
            if not (e.get('id') or '').startswith('pl-'):
                return e

    def req(metodo, caminho, corpo=b'', tipo='application/json'):
        c = http.client.HTTPConnection('127.0.0.1', porta, timeout=ESPERA + 5)
        c.request(metodo, caminho, corpo, {'Content-Type': tipo})
        r = c.getresponse()
        dados = r.read(); c.close()
        return r.status, dados

    post = lambda m, q=GM: req('POST', '/op' + q, json.dumps(m))[0]
    falar = lambda texto, q, **kw: req('POST', '/chat' + q, json.dumps({'text': texto, **kw}))

    assert conectar('').status == 403 and conectar('?gm=errado').status == 403 and conectar('?p=Mestre').status == 403
    mestre, ana, bia = conectar(GM), conectar(ANA), conectar(BIA)
    s = evento(mestre); assert s['op'] == 'snapshot' and s['eu'] == {'papel': 'gm', 'nome': 'Mestre'}
    s = evento(ana); assert s['eu'] == {'papel': 'player', 'nome': 'Ana'}
    evento(bia)

    # mestre cria tokens; a Ana é dona só do t1
    assert post({'op': 'add', 'type': 'token', 'id': 't1', 'props': {'x': 1, 'y': 2, 'owner': ['Ana'], 'gmnote': 'segredo', 'name': 'Brannoc'}}) == 200
    e = evento(mestre); assert e['props']['gmnote'] == 'segredo'
    e = evento(ana); assert e['op'] == 'add' and 'gmnote' not in e['props'], e
    evento(bia)
    assert post({'op': 'add', 'type': 'token', 'id': 't2', 'props': {'x': 5, 'y': 5, 'name': 'Goblin'}}) == 200
    evento(mestre); evento(ana); evento(bia)

    # permissões da Ana
    assert post({'op': 'change', 'id': 't1', 'props': {'x': 3}}, ANA) == 200
    assert evento(ana)['props'] == {'x': 3}; evento(mestre); evento(bia)
    assert post({'op': 'change', 'id': 't2', 'props': {'x': 9}}, ANA) == 403, 'token dos outros'
    assert post({'op': 'change', 'id': 't1', 'props': {'owner': ['Ana', 'Bia']}}, ANA) == 403, 'só x/y'
    assert post({'op': 'add', 'type': 'token', 'id': 't9', 'props': {}}, ANA) == 403
    assert post({'op': 'destroy', 'id': 't1'}, ANA) == 403
    assert req('POST', '/upload' + ANA, b'PNG', 'image/png')[0] == 403

    # modelos de token: só o mestre cria e edita, e os jogadores nem recebem
    assert post({'op': 'add', 'type': 'modelo', 'id': 'm1', 'props': {'name': 'Orc', 'img': '/uploads/x.png', 'n': 1}}, ANA) == 403
    assert post({'op': 'add', 'type': 'modelo', 'id': 'm1', 'props': {'name': 'Orc', 'img': '/uploads/x.png', 'n': 1}}) == 200
    assert evento(mestre)['type'] == 'modelo'
    assert post({'op': 'change', 'id': 'm1', 'props': {'n': 2}}, ANA) == 403
    assert 'm1' not in snapshot(('player', 'Ana')) and 'm1' in snapshot(MESTRE)

    # esconder: o jogador recebe destroy; mostrar de novo: recebe add com tudo
    assert post({'op': 'change', 'id': 't2', 'props': {'layer': 'gm'}}) == 200
    assert evento(mestre)['op'] == 'change' and evento(ana)['op'] == 'destroy'; evento(bia)
    assert post({'op': 'change', 'id': 't2', 'props': {'x': 7}}) == 200
    assert evento(mestre)['props'] == {'x': 7}
    assert post({'op': 'change', 'id': 't2', 'props': {'layer': 'objects'}}) == 200
    evento(mestre); e = evento(ana); assert e['op'] == 'add' and e['props']['x'] == 7, e; evento(bia)

    # chat: fala, rolagem no servidor, sussurro e rolagem secreta
    assert falar('oi gente', ANA)[0] == 200
    e = evento(bia); assert e['props']['kind'] == 'say' and e['props']['who'] == 'Ana'; evento(ana); evento(mestre)
    assert falar('/r 1d20+5 ataque', ANA)[0] == 200
    e = evento(mestre)['props']; assert e['kind'] == 'roll' and 6 <= e['roll']['total'] <= 25 and e['text'] == 'ataque'
    evento(ana); evento(bia)
    assert falar('/w Bia segredo', ANA)[0] == 200
    assert evento(bia)['props']['text'] == 'segredo' and evento(ana)['props']['kind'] == 'whisper'
    assert falar('/gr 1d4', BIA)[0] == 200
    assert evento(mestre)['props']['kind'] == 'roll' and evento(bia)['props']['to'] == ['Bia', 'Mestre']
    assert falar('/em sorri', ANA)[0] == 200
    e = evento(ana); assert e['props']['kind'] == 'emote', e   # a Ana não recebeu o sussurro nem o /gr
    assert evento(mestre)['props']['kind'] == 'emote', 'o mestre não vê sussurro entre jogadores'
    evento(bia)
    assert falar('/w Ninguem oi', ANA)[0] == 400 and falar('/r abc', ANA)[0] == 400 and falar('/xyz', ANA)[0] == 400
    snap = evento(conectar(ANA))['objs']
    assert [o['kind'] for o in snap.values() if o['type'] == 'msg'] == ['say', 'roll', 'whisper', 'emote']

    # iniciativa: a Ana rola para o próprio token, não para o goblin
    assert falar('/init +2', ANA, token='t1')[0] == 200
    assert falar('/init', ANA, token='t2')[0] == 403
    assert falar('/init -1', GM, token='t2')[0] == 200
    ordem = estado['objs']['mesa']['turnorder']
    assert {e['id'] for e in ordem} == {'t1', 't2'} and ordem[0]['pr'] >= ordem[1]['pr']
    assert post({'op': 'change', 'id': 'mesa', 'props': {'turn': 1}}, ANA) == 403
    # alguém entra no meio da rodada: a vez continua com quem estava jogando
    vez = [e['id'] for e in ordem].index('t2')
    assert post({'op': 'change', 'id': 'mesa', 'props': {'turn': vez}}) == 200
    for i in range(3):
        assert post({'op': 'add', 'type': 'token', 'id': f'n{i}', 'props': {'name': f'Novo {i}'}}) == 200
        assert falar('/init +20', GM, token=f'n{i}')[0] == 200
        m = estado['objs']['mesa']
        assert m['turnorder'][m['turn']]['id'] == 't2', m

    # efeitos passageiros: chegam a todos e não ficam salvos
    seq = estado['seq']
    assert req('POST', '/fx' + ANA, json.dumps({'kind': 'ping', 'page': 'p', 'x': 2, 'y': 3}))[0] == 200
    assert req('POST', '/fx' + ANA, json.dumps({'kind': 'hack', 'page': 'p', 'x': 2}))[0] == 400
    assert estado['seq'] == seq

    # Fase 3: luz no próprio token, áreas e luzes de magia do jogador, merge do mapa
    assert post({'op': 'change', 'id': 't1', 'props': {'luz': [20, 20]}}, ANA) == 200
    assert post({'op': 'change', 'id': 't1', 'props': {'luz': [20, 9999]}}, ANA) == 403
    assert post({'op': 'change', 'id': 't1', 'props': {'cond': ['Caído', 'Cego']}}, ANA) == 200
    assert post({'op': 'change', 'id': 't1', 'props': {'cond': 'Caído'}}, ANA) == 403
    assert post({'op': 'change', 'id': 't2', 'props': {'cond': ['Caído']}}, ANA) == 403, 'condição no token dos outros'
    assert post({'op': 'change', 'id': 't1', 'props': {'dv': 120}}, ANA) == 403, 'visão no escuro é do mestre'
    area = {'shape': 'cone', 'x': 1, 'y': 1, 'angle': 0, 'size': 15, 'owner': ['Ana']}
    assert post({'op': 'add', 'type': 'aoe', 'id': 'a1', 'props': area}, ANA) == 200
    assert post({'op': 'add', 'type': 'aoe', 'id': 'a2', 'props': {**area, 'owner': ['Bia']}}, ANA) == 403
    assert post({'op': 'change', 'id': 'a1', 'props': {'angle': 1}}, BIA) == 403, 'área dos outros'
    assert post({'op': 'change', 'id': 'a1', 'props': {'owner': ['Bia']}}, ANA) == 403
    assert post({'op': 'add', 'type': 'aoe', 'id': 'a1', 'props': area}, ANA) == 403, 'add por cima de existente'
    assert post({'op': 'destroy', 'id': 'a1'}, ANA) == 200
    assert post({'op': 'add', 'type': 'luz', 'id': 'l1', 'props': {'x': 2, 'y': 2, 'luz': [20, 20], 'owner': ['Ana']}}, ANA) == 200
    assert post({'op': 'add', 'type': 'token', 'id': 't8', 'props': {'owner': ['Ana']}}, ANA) == 403
    assert post({'op': 'add', 'type': 'page', 'id': 'pg', 'props': {'w': 3, 'portas': {'h:0:0': True}}}) == 200
    assert post({'op': 'add', 'type': 'page', 'id': 'pg', 'props': {'w': 4}, 'merge': True}) == 200
    assert estado['objs']['pg'] == {'w': 4, 'portas': {'h:0:0': True}, 'type': 'page'}
    fx = lambda c: req('POST', '/fx' + ANA, json.dumps({'kind': 'magia', 'page': 'p', 'x': 1, 'y': 1, **c}))[0]
    assert fx({'efeito': 'fogo'}) == 200 and fx({'efeito': 'meteoro'}) == 400

    # keep, upload e arquivos protegidos
    assert post({'op': 'add', 'type': 'token', 'id': 't1', 'props': {'x': 0}, 'keep': True}) == 200
    assert estado['objs']['t1']['x'] == 3, 'keep não pode sobrescrever'
    cod, corpo = req('POST', '/upload' + GM, b'PNG fake', 'image/png')
    url = json.loads(corpo)['url']
    assert req('GET', url)[1] == b'PNG fake'
    for _ in range(20):   # no Windows o servidor pode ainda estar fechando o arquivo
        try:
            os.remove(os.path.join(PASTA, url.lstrip('/'))); break
        except PermissionError:
            time.sleep(.05)
    assert req('POST', '/upload' + GM, b'<script>', 'text/html')[0] == 415
    cod, corpo = req('POST', '/upload' + GM, b'%PDF-1.4 fake', 'application/pdf')
    pdf = json.loads(corpo)['url']; assert cod == 200 and pdf.endswith('.pdf')
    for _ in range(20):
        try:
            os.remove(os.path.join(PASTA, pdf.lstrip('/'))); break
        except PermissionError:
            time.sleep(.05)
    for caminho in ('/.git/config', '/campanha.json'):
        assert req('GET', caminho)[0] == 404, caminho

    # Fase 4: fichas (com merge dos campos), @{atributo} no chat e handouts
    ultima = lambda: estado['objs'][max(k for k, o in estado['objs'].items() if o['type'] == 'msg')]
    ANA_, BIA_ = ('player', 'Ana'), ('player', 'Bia')
    ficha = {'name': 'Brannoc', 'owner': ['Ana'], 'attrs': {'des': 16, 'nivel': 5, 'pv': 30}}
    assert post({'op': 'add', 'type': 'character', 'id': 'c1', 'props': ficha}) == 200
    assert 'c1' in snapshot(ANA_) and 'c1' not in snapshot(BIA_)
    assert post({'op': 'change', 'id': 'c1', 'props': {'attrs': {'pv': 22, 'for': 8}}}, ANA) == 200
    assert estado['objs']['c1']['attrs'] == {'des': 16, 'nivel': 5, 'pv': 22, 'for': 8}, 'só o campo que mudou'
    assert post({'op': 'change', 'id': 'c1', 'props': {'attrs': {'pv': 1}}}, BIA) == 403
    assert post({'op': 'change', 'id': 'c1', 'props': {'attrs': 'x'}}) == 400
    assert post({'op': 'change', 'id': 'c1', 'props': {'owner': ['Bia']}}, ANA) == 403
    assert falar('/r 1d20+@{des_mod}+@{prof} furtividade', ANA, ficha='c1')[0] == 200
    m = ultima(); assert m['roll']['expr'] == '1d20+3+3' and m['como'] == 'Brannoc' and m['text'] == 'furtividade', m
    assert falar('/r 1d20+@{for_mod}', ANA, ficha='c1')[0] == 200 and ultima()['roll']['expr'] == '1d20-1'
    assert falar('/r 1d20+@{sorte}', ANA, ficha='c1')[0] == 400
    assert falar('/r 1d20+@{Brannoc|des_mod}', BIA)[0] == 400, 'a Bia não vê a ficha'
    assert falar('/r 1d20+@{des_mod}', BIA, ficha='c1')[0] == 400
    assert post({'op': 'change', 'id': 'c1', 'props': {'ver': ['*']}}, ANA) == 200
    assert falar('/r 1d20+@{brannoc|des_mod}', BIA)[0] == 200 and ultima()['roll']['expr'] == '1d20+3'
    assert falar('/init @{des_mod}', ANA, token='t1', ficha='c1')[0] == 200
    assert post({'op': 'add', 'type': 'character', 'id': 'c2', 'props': {'name': 'Mago', 'owner': ['Bia']}}, BIA) == 200
    assert post({'op': 'add', 'type': 'character', 'id': 'c3', 'props': {'owner': ['Ana']}}, BIA) == 403
    assert post({'op': 'add', 'type': 'handout', 'id': 'h1', 'props': {'name': 'Carta', 'text': 'oi', 'gmnota': 'x', 'ver': []}}) == 200
    assert 'h1' not in snapshot(ANA_)
    assert post({'op': 'change', 'id': 'h1', 'props': {'ver': ['Ana']}}) == 200
    h = snapshot(ANA_).get('h1'); assert h and 'gmnota' not in h and 'h1' not in snapshot(BIA_)
    assert post({'op': 'change', 'id': 'h1', 'props': {'text': 'hack'}}, ANA) == 403
    assert post({'op': 'change', 'id': 'h1', 'props': {'ver': 'Ana'}}) == 400
    mostrar = lambda q, hid='h1': req('POST', '/fx' + q, json.dumps({'kind': 'mostrar', 'id': hid}))[0]
    assert mostrar(ANA) == 403 and mostrar(GM, 'c1') == 400 and mostrar(GM) == 200
    assert any(ana.proximo().get('kind') == 'mostrar' for _ in range(500)), 'a Ana vê o h1, então recebe'

    assert estado['objs']['pl-Ana']['online'] is True
    # sessão que parou de perguntar sai da mesa; link de outra pessoa não reaproveita a sessão
    assert req('GET', f'/poll{BIA}&c={ana.c}')[0] == 200 and len(sessoes) == 5
    for s in sessoes.values():
        s[2] -= VALIDADE + 1
    limpar_sessoes()
    assert not sessoes and estado['objs']['pl-Ana']['online'] is False
    srv.shutdown()
    print('ok: autoteste passou')


if __name__ == '__main__':
    if '--teste' in sys.argv:
        teste(); sys.exit()
    host = '0.0.0.0' if '--lan' in sys.argv else '127.0.0.1'
    try:                                  # abre a porta antes de tudo: um segundo Nothic não chega a mexer no campanha.json
        srv = servidor(host, 8765)
    except OSError:
        sys.exit('Já tem um Nothic rodando na porta 8765. Feche o outro (Ctrl+C na janela dele) e tente de novo.')
    carregar()
    threading.Thread(target=gravar_periodicamente, daemon=True).start()
    base = 'http://localhost:8765'
    print('Nothic rodando (Ctrl+C para parar). Guarde o link do mestre só para você:')
    print(f'  Mestre (mesa):  {base}/nothic.html?gm={estado["gm"]}')
    print(f'  Mestre (MonTT): {base}/MonTT.html?gm={estado["gm"]}')
    print(f'  Jogadores:      {base}/nothic.html?p=SeuNome   (pelo túnel, troque o endereço)', flush=True)
    srv.serve_forever()
