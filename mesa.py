"""Mesa online: servidor de sincronização, só com a biblioteca padrão do Python.

    py mesa.py            -> mostra os links do mestre e dos jogadores
    py mesa.py --lan      -> aceita outros PCs da rede
    py mesa.py --teste    -> autoteste

Modelo (igual ao Roll20): o estado é um dicionário de objetos {id: {type, ...}}.
O cliente envia POST /op {op: add|change|destroy, type, id, props} e recebe tudo
por GET /stream (Server-Sent Events): primeiro um snapshot, depois cada op.

Papéis: quem tem ?gm=<segredo> é o mestre e pode tudo. Quem tem ?p=<nome> é
jogador: só move tokens cujo `owner` tem o nome dele, e nunca recebe objetos
com layer 'gm' nem campos que começam com 'gm' (notas do mestre).

Chat (POST /chat): o servidor rola os dados, como o Roll20, então ninguém forja
resultado. Mensagens com `to` (sussurros, /gr) só chegam a quem está na lista.
Efeitos passageiros (POST /fx: ping, régua) vão para todos e não são salvos.
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
IMAGENS = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp'}
MESTRE = ('gm', 'Mestre')
MSGS_GUARDADAS, MSGS_NO_SNAPSHOT = 300, 100
CORES = ['#e0735a', '#5fa8e0', '#7fd18f', '#c98ae8', '#e8c46a', '#5fd1c4', '#f08fb0', '#a3b86c']

trava = threading.Lock()   # ponytail: uma trava global; com 6 pessoas não faz diferença
estado = {'seq': 0, 'objs': {}, 'gm': ''}
clientes = {}              # fila da conexão SSE -> (papel, nome)
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
    if obj is None or (papel != 'gm' and obj.get('layer') == 'gm'):
        return False
    to = obj.get('to') if obj.get('type') == 'msg' else None
    return not to or nome in to or nome == obj.get('who')


def para(papel, props):
    """O que um papel pode ver de um objeto: jogadores não recebem campos gm*."""
    return props if papel == 'gm' else {k: v for k, v in props.items() if not k.startswith('gm')}


DO_JOGADOR = {'aoe', 'luz'}   # áreas e luzes de magia que o próprio jogador cria e apaga


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
    # no próprio token: posição e a luz que carrega (tocha, lanterna)
    if not props or set(props) - {'x', 'y', 'luz'}:
        raise Proibido('jogador só muda posição e luz do token')
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
    cmd, _, resto = texto.partition(' ')
    cmd, resto = cmd.lower(), resto.strip()
    if not texto.startswith('/'):
        return postar(quem, {'kind': 'say', 'text': texto})
    if cmd in ('/r', '/roll', '/gr'):
        roll, rotulo = rolar_com_rotulo(resto)
        extra = {'to': sorted({MESTRE[1], quem[1]})} if cmd == '/gr' else {}
        return postar(quem, {'kind': 'roll', 'roll': roll, 'text': rotulo, **extra})
    if cmd == '/em':
        if not resto:
            raise ValueError('/em o quê?')
        return postar(quem, {'kind': 'emote', 'text': resto})
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
    nums = {k: corpo[k] for k in ('x', 'y', 'x2', 'y2') if isinstance(corpo.get(k), (int, float))}
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
        if caminho == '/stream':
            return self.stream()
        partes = caminho.split('/')
        # não servir .git, campanha.json nem arquivos ocultos pelo túnel
        if any(p.startswith('.') for p in partes) or partes[-1].startswith('campanha'):
            return self.send_error(404)
        super().do_GET()

    def stream(self):
        quem = self.quem()
        if not quem:
            return self.responder(403, {'erro': 'link sem ?p=<nome> ou segredo do mestre errado'})
        papel, nome = quem
        q = queue.Queue()
        with trava:
            linha = json.dumps({'op': 'snapshot', 'seq': estado['seq'], 'objs': snapshot(quem),
                                'eu': {'papel': papel, 'nome': nome}}, ensure_ascii=False)
            clientes[q] = quem
        try:
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(f'data: {linha}\n\n'.encode())
            self.wfile.flush()
            presenca(nome, papel, +1)
            while True:
                try:
                    msg = q.get(timeout=15)
                    self.wfile.write(f'data: {json.dumps(msg, ensure_ascii=False)}\n\n'.encode())
                except queue.Empty:
                    self.wfile.write(b': ping\n\n')   # mantém o túnel/proxy aberto
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        finally:
            with trava:
                clientes.pop(q, None)
            presenca(nome, papel, -1)

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
        ext = IMAGENS.get((self.headers.get('Content-Type') or '').split(';')[0])
        if not ext:
            self.descartar(n)
            return self.responder(415, {'erro': 'só PNG, JPG ou WebP'})
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


def servidor(host, porta):
    srv = ThreadingHTTPServer((host, porta), Mesa)
    srv.daemon_threads = True
    return srv


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
    ARQUIVO = os.path.join(os.environ.get('TEMP', '/tmp'), 'mesa-teste.json')
    estado['gm'] = 's3gr3d0'
    srv = servidor('127.0.0.1', 0)
    porta = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    GM, ANA, BIA = '?gm=s3gr3d0', '?p=Ana', '?p=Bia'

    def conectar(q):
        s = http.client.HTTPConnection('127.0.0.1', porta, timeout=5)
        s.request('GET', '/stream' + q)
        return s.getresponse()

    def evento(r):   # próximo evento, pulando os de presença
        while True:
            l = r.fp.readline().decode()
            if l.startswith('data: '):
                e = json.loads(l[6:])
                if not (e.get('id') or '').startswith('pl-'):
                    return e

    def req(metodo, caminho, corpo=b'', tipo='application/json'):
        c = http.client.HTTPConnection('127.0.0.1', porta, timeout=5)
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
    for caminho in ('/.git/config', '/campanha.json'):
        assert req('GET', caminho)[0] == 404, caminho

    assert estado['objs']['pl-Ana']['online'] is True
    srv.shutdown()
    print('ok: autoteste passou')


if __name__ == '__main__':
    if '--teste' in sys.argv:
        teste(); sys.exit()
    carregar()
    threading.Thread(target=gravar_periodicamente, daemon=True).start()
    host = '0.0.0.0' if '--lan' in sys.argv else '127.0.0.1'
    base = 'http://localhost:8765'
    print('Mesa rodando (Ctrl+C para parar). Guarde o link do mestre só para você:')
    print(f'  Mestre (mesa):  {base}/mesa.html?gm={estado["gm"]}')
    print(f'  Mestre (MonTT): {base}/MonTT.html?gm={estado["gm"]}')
    print(f'  Jogadores:      {base}/mesa.html?p=SeuNome   (pelo túnel, troque o endereço)', flush=True)
    servidor(host, 8765).serve_forever()
