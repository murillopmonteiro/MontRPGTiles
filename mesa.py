"""Mesa online: servidor de sincronização, só com a biblioteca padrão do Python.

    py mesa.py            -> http://localhost:8765/mesa.html
    py mesa.py --lan      -> aceita outros PCs da rede
    py mesa.py --teste    -> autoteste

Modelo (igual ao Roll20): o estado é um dicionário de objetos {id: {type, ...}}.
O cliente envia POST /op {op: add|change|destroy, type, id, props} e recebe tudo
por GET /stream (Server-Sent Events): primeiro um snapshot, depois cada op.
"""
import json, os, queue, sys, threading, time, uuid
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PASTA = os.path.dirname(os.path.abspath(__file__))
ARQUIVO = os.path.join(PASTA, 'campanha.json')
OPS = {'add', 'change', 'destroy'}
MAX_CORPO = 256 * 1024
MAX_IMAGEM = 25 * 1024 * 1024
IMAGENS = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp'}

trava = threading.Lock()   # ponytail: uma trava global; com 6 pessoas não faz diferença
estado = {'seq': 0, 'objs': {}}
clientes = set()           # uma fila por conexão SSE
sujo = False


def carregar():
    global estado
    if os.path.exists(ARQUIVO):
        with open(ARQUIVO, encoding='utf-8') as f:
            estado = json.load(f)


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


def aplicar(msg):
    """Valida e aplica uma op. Devolve a op com seq, ou levanta ValueError."""
    global sujo
    if not isinstance(msg, dict) or msg.get('op') not in OPS:
        raise ValueError('op inválida')
    oid, props = msg.get('id'), msg.get('props') or {}
    if not isinstance(oid, str) or not 0 < len(oid) <= 64 or not isinstance(props, dict):
        raise ValueError('id ou props inválidos')
    with trava:
        objs = estado['objs']
        if msg['op'] == 'add':
            if not isinstance(msg.get('type'), str):
                raise ValueError('add precisa de type')
            if msg.get('keep') and oid in objs:   # reenviar o mapa não reposiciona tokens já na mesa
                return {'op': 'noop', 'seq': estado['seq']}
            objs[oid] = {**props, 'type': msg['type']}
        elif oid not in objs:
            raise ValueError('objeto não existe')
        elif msg['op'] == 'change':
            props.pop('type', None)
            objs[oid].update(props)
        else:
            del objs[oid]
        estado['seq'] += 1
        out = {'op': msg['op'], 'id': oid, 'type': objs.get(oid, {}).get('type', msg.get('type')),
               'props': props, 'seq': estado['seq']}
        sujo = True
        for q in list(clientes):
            q.put(out)
    return out


class Mesa(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=PASTA, **kw)

    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.split('?')[0] == '/stream':
            return self.stream()
        partes = self.path.split('?')[0].split('/')
        # não servir .git, campanha.json nem arquivos ocultos pelo túnel
        if any(p.startswith('.') for p in partes) or partes[-1].startswith('campanha'):
            return self.send_error(404)
        super().do_GET()

    def stream(self):
        q = queue.Queue()
        with trava:
            snap = {'op': 'snapshot', 'seq': estado['seq'], 'objs': estado['objs']}
            linha = json.dumps(snap, ensure_ascii=False)
            clientes.add(q)
        try:
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(f'data: {linha}\n\n'.encode())
            self.wfile.flush()
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
                clientes.discard(q)

    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        if self.path == '/upload':
            return self.upload(n)
        if self.path != '/op':
            return self.send_error(404)
        if not 0 < n <= MAX_CORPO:
            return self.send_error(413)
        try:
            out = aplicar(json.loads(self.rfile.read(n)))
            self.responder(200, {'seq': out['seq']})
        except (ValueError, json.JSONDecodeError) as e:
            self.responder(400, {'erro': str(e)})

    def upload(self, n):
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
    srv = servidor('127.0.0.1', 0)
    porta = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    s = http.client.HTTPConnection('127.0.0.1', porta, timeout=5)
    s.request('GET', '/stream')
    r = s.getresponse()
    def evento():
        while True:
            l = r.fp.readline().decode()
            if l.startswith('data: '):
                return json.loads(l[6:])
    assert evento()['op'] == 'snapshot'

    def post(m):
        c = http.client.HTTPConnection('127.0.0.1', porta, timeout=5)
        c.request('POST', '/op', json.dumps(m), {'Content-Type': 'application/json'})
        return c.getresponse().status
    assert post({'op': 'add', 'type': 'token', 'id': 't1', 'props': {'x': 1, 'y': 2}}) == 200
    e = evento(); assert e['op'] == 'add' and e['props']['x'] == 1, e
    assert post({'op': 'change', 'id': 't1', 'props': {'x': 5}}) == 200
    e = evento(); assert e['op'] == 'change' and estado['objs']['t1'] == {'x': 5, 'y': 2, 'type': 'token'}, e
    assert post({'op': 'change', 'id': 'nao-existe', 'props': {}}) == 400
    assert post({'op': 'hack', 'id': 't1'}) == 400
    assert post({'op': 'add', 'type': 'token', 'id': 't1', 'props': {'x': 9}, 'keep': True}) == 200
    assert estado['objs']['t1']['x'] == 5, 'keep não pode sobrescrever'
    c = http.client.HTTPConnection('127.0.0.1', porta, timeout=5)
    c.request('POST', '/upload', b'PNG fake', {'Content-Type': 'image/png'})
    url = json.loads(c.getresponse().read())['url']
    c = http.client.HTTPConnection('127.0.0.1', porta, timeout=5)
    c.request('GET', url); assert c.getresponse().read() == b'PNG fake'
    os.remove(os.path.join(PASTA, url.lstrip('/')))
    c = http.client.HTTPConnection('127.0.0.1', porta, timeout=5)
    c.request('POST', '/upload', b'<script>', {'Content-Type': 'text/html'}); assert c.getresponse().status == 415
    assert post({'op': 'destroy', 'id': 't1'}) == 200
    assert evento()['op'] == 'destroy' and 't1' not in estado['objs']
    for caminho in ('/.git/config', '/campanha.json'):
        c = http.client.HTTPConnection('127.0.0.1', porta, timeout=5)
        c.request('GET', caminho); assert c.getresponse().status == 404, caminho
    srv.shutdown()
    print('ok: autoteste passou')


if __name__ == '__main__':
    if '--teste' in sys.argv:
        teste(); sys.exit()
    carregar()
    threading.Thread(target=gravar_periodicamente, daemon=True).start()
    host = '0.0.0.0' if '--lan' in sys.argv else '127.0.0.1'
    print(f'Mesa rodando em http://localhost:8765/mesa.html  (Ctrl+C para parar)')
    servidor(host, 8765).serve_forever()
