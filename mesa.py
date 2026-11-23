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
"""
import json, os, queue, secrets, sys, threading, time, uuid
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

trava = threading.Lock()   # ponytail: uma trava global; com 6 pessoas não faz diferença
estado = {'seq': 0, 'objs': {}, 'gm': ''}
clientes = {}              # fila da conexão SSE -> (papel, nome)
conexoes = Counter()       # nome -> conexões abertas (a mesma pessoa em 2 abas)
sujo = False


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


def visivel(obj, papel):
    return obj is not None and (papel == 'gm' or obj.get('layer') != 'gm')


def para(papel, props):
    """O que um papel pode ver de um objeto: jogadores não recebem campos gm*."""
    return props if papel == 'gm' else {k: v for k, v in props.items() if not k.startswith('gm')}


def permitir(msg, quem, obj):
    """Regras do jogador. O mestre pode tudo."""
    papel, nome = quem
    if papel == 'gm':
        return
    props = msg.get('props') or {}
    if (msg['op'] != 'change' or not obj or obj.get('type') != 'token'
            or nome not in (obj.get('owner') or [])):
        raise Proibido('jogador só move os próprios tokens')
    if not props or set(props) - {'x', 'y'} or not all(isinstance(v, (int, float)) for v in props.values()):
        raise Proibido('jogador só muda x e y')


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
            objs[oid] = {**props, 'type': msg['type']}
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
        for q, (papel, _) in list(clientes.items()):
            via, vdepois = visivel(antes, papel), visivel(depois, papel)
            base = {'id': oid, 'seq': estado['seq']}
            if vdepois and (msg['op'] == 'add' or not via):
                q.put({**base, 'op': 'add', 'type': depois['type'], 'props': para(papel, depois)})
            elif via and not vdepois:
                q.put({**base, 'op': 'destroy'})
            elif via and vdepois:
                q.put({**base, 'op': 'change', 'props': para(papel, props)})
        return estado['seq']


def presenca(nome, papel, delta):
    """Marca o jogador online na 1ª conexão e offline quando a última cai."""
    with trava:
        conexoes[nome] += delta
        n = conexoes[nome]
        existe = ('pl-' + nome) in estado['objs']
    if delta > 0 and n == 1:
        aplicar({'op': 'change' if existe else 'add', 'type': 'player', 'id': 'pl-' + nome,
                 'props': {'name': nome, 'gm': papel == 'gm', 'online': True}})
    elif delta < 0 and n == 0 and existe:
        aplicar({'op': 'change', 'id': 'pl-' + nome, 'props': {'online': False}})


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
        if 0 < len(nome) <= 24 and nome.isprintable() and nome != MESTRE[1]:
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
            objs = {k: para(papel, o) for k, o in estado['objs'].items() if visivel(o, papel)}
            linha = json.dumps({'op': 'snapshot', 'seq': estado['seq'], 'objs': objs,
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
        if caminho not in ('/op', '/upload'):
            return self.send_error(404)
        if not quem:
            return self.responder(403, {'erro': 'sem identificação'})
        if caminho == '/upload':
            return self.upload(n, quem)
        if not 0 < n <= MAX_CORPO:
            return self.send_error(413)
        try:
            self.responder(200, {'seq': aplicar(json.loads(self.rfile.read(n)), quem)})
        except Proibido as e:
            self.responder(403, {'erro': str(e)})
        except (ValueError, json.JSONDecodeError) as e:
            self.responder(400, {'erro': str(e)})

    def upload(self, n, quem):
        if quem[0] != 'gm':
            return self.responder(403, {'erro': 'só o mestre envia imagens'})
        ext = IMAGENS.get((self.headers.get('Content-Type') or '').split(';')[0])
        if not ext:
            return self.responder(415, {'erro': 'só PNG, JPG ou WebP'})
        if not 0 < n <= MAX_IMAGEM:
            return self.send_error(413)
        os.makedirs(os.path.join(PASTA, 'uploads'), exist_ok=True)
        nome = uuid.uuid4().hex + ext   # nome gerado aqui: o cliente não escolhe caminho
        with open(os.path.join(PASTA, 'uploads', nome), 'wb') as f:
            f.write(self.rfile.read(n))
        self.responder(200, {'url': '/uploads/' + nome})

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


def teste():
    import http.client
    global ARQUIVO
    ARQUIVO = os.path.join(os.environ.get('TEMP', '/tmp'), 'mesa-teste.json')
    estado['gm'] = 's3gr3d0'
    srv = servidor('127.0.0.1', 0)
    porta = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    GM, ANA = '?gm=s3gr3d0', '?p=Ana'

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

    assert conectar('').status == 403 and conectar('?gm=errado').status == 403
    mestre, ana = conectar(GM), conectar(ANA)
    s = evento(mestre); assert s['op'] == 'snapshot' and s['eu'] == {'papel': 'gm', 'nome': 'Mestre'}
    s = evento(ana); assert s['eu'] == {'papel': 'player', 'nome': 'Ana'}

    # mestre cria tokens; a Ana é dona só do t1
    assert post({'op': 'add', 'type': 'token', 'id': 't1', 'props': {'x': 1, 'y': 2, 'owner': ['Ana'], 'gmnote': 'segredo'}}) == 200
    e = evento(mestre); assert e['props']['gmnote'] == 'segredo'
    e = evento(ana); assert e['op'] == 'add' and 'gmnote' not in e['props'], e
    assert post({'op': 'add', 'type': 'token', 'id': 't2', 'props': {'x': 5, 'y': 5}}) == 200
    evento(mestre); evento(ana)

    # permissões da Ana
    assert post({'op': 'change', 'id': 't1', 'props': {'x': 3}}, ANA) == 200
    assert evento(ana)['props'] == {'x': 3}; evento(mestre)
    assert post({'op': 'change', 'id': 't2', 'props': {'x': 9}}, ANA) == 403, 'token dos outros'
    assert post({'op': 'change', 'id': 't1', 'props': {'owner': ['Ana', 'Bia']}}, ANA) == 403, 'só x/y'
    assert post({'op': 'add', 'type': 'token', 'id': 't9', 'props': {}}, ANA) == 403
    assert post({'op': 'destroy', 'id': 't1'}, ANA) == 403
    assert req('POST', '/upload' + ANA, b'PNG', 'image/png')[0] == 403

    # esconder: o jogador recebe destroy; mostrar de novo: recebe add com tudo
    assert post({'op': 'change', 'id': 't2', 'props': {'layer': 'gm'}}) == 200
    assert evento(mestre)['op'] == 'change' and evento(ana)['op'] == 'destroy'
    assert post({'op': 'change', 'id': 't2', 'props': {'x': 7}}) == 200
    assert evento(mestre)['props'] == {'x': 7}
    assert post({'op': 'change', 'id': 't2', 'props': {'layer': 'objects'}}) == 200
    evento(mestre); e = evento(ana); assert e['op'] == 'add' and e['props']['x'] == 7, e
    assert 't2' in evento(conectar(ANA))['objs']

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
