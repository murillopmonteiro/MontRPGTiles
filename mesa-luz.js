/* Geometria da mesa: paredes do MonTT viram segmentos, a visão é um polígono por raios,
   e as áreas de magia dizem quais quadrados atingem. Tudo em "quadrados" (1 = 5 ft).
   Teste: node mesa-luz.js */
(function (exp) {
  const EPS = 1e-9;

  // hw[y*W+x] = aresta horizontal na linha y; vw[y*(W+1)+x] = vertical na coluna x. 1 = parede, 2 = porta.
  // Paredes seguidas viram um segmento só (menos segmentos = menos contas por raio).
  function segmentos(pg, abertas = {}) {
    const W = pg.w, H = pg.h, segs = [];
    const h = (x, y) => { const v = pg.hw ? pg.hw[y * W + x] : 0; return v === 1 || (v === 2 && !abertas[`h:${x}:${y}`]); };
    const v = (x, y) => { const k = pg.vw ? pg.vw[y * (W + 1) + x] : 0; return k === 1 || (k === 2 && !abertas[`v:${x}:${y}`]); };
    for (let y = 0; y <= H; y++) for (let x = 0; x < W;) {
      if (!h(x, y)) { x++; continue; }
      let x1 = x; while (x1 < W && h(x1, y)) x1++;
      segs.push([x, y, x1, y]); x = x1;
    }
    for (let x = 0; x <= W; x++) for (let y = 0; y < H;) {
      if (!v(x, y)) { y++; continue; }
      let y1 = y; while (y1 < H && v(x, y1)) y1++;
      segs.push([x, y, x, y1]); y = y1;
    }
    segs.push([0, 0, W, 0], [W, 0, W, H], [W, H, 0, H], [0, H, 0, 0]);   // a borda do mapa
    return segs;
  }

  // distância até a primeira parede na direção (dx, dy), ou Infinity
  function raio(ox, oy, dx, dy, segs) {
    let melhor = Infinity;
    for (const [x1, y1, x2, y2] of segs) {
      const sx = x2 - x1, sy = y2 - y1, den = dx * sy - dy * sx;
      if (Math.abs(den) < EPS) continue;
      const t = ((x1 - ox) * sy - (y1 - oy) * sx) / den;
      const u = ((x1 - ox) * dy - (y1 - oy) * dx) / den;
      if (t > EPS && u >= -EPS && u <= 1 + EPS && t < melhor) melhor = t;
    }
    return melhor;
  }

  // polígono do que se vê de (ox, oy): um raio para cada ponta de parede, e um de cada lado dela
  function visao(ox, oy, segs) {
    ox += 1e-4; oy += 1.3e-4;   // nunca exatamente em cima de uma linha da grade
    const angs = [];
    for (const s of segs) for (const [px, py] of [[s[0], s[1]], [s[2], s[3]]]) {
      const a = Math.atan2(py - oy, px - ox);
      angs.push(a - 1e-4, a, a + 1e-4);
    }
    angs.sort((a, b) => a - b);
    const pts = [];
    for (const a of angs) {
      const dx = Math.cos(a), dy = Math.sin(a), t = raio(ox, oy, dx, dy, segs);
      if (t < Infinity) pts.push([ox + dx * t, oy + dy * t]);
    }
    return pts;
  }

  // o segmento a→b atravessa alguma parede? (bloqueio de movimento)
  function cruzaParede(ax, ay, bx, by, segs) {
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
    if (d < EPS) return false;
    return raio(ax + 1e-4, ay + 1.3e-4, dx / d, dy / d, segs) < d - 1e-3;
  }

  // áreas de magia (regras do 5e): o quadrado conta se o centro dele estiver dentro
  // a = {shape: circulo|cone|cubo|linha, x, y, angle, size (ft), width (ft, linha)}
  function dentroArea(a, px, py) {
    const L = a.size / 5, dx = px - a.x, dy = py - a.y;
    if (a.shape === 'circulo') return Math.hypot(dx, dy) <= L + EPS;
    const c = Math.cos(a.angle || 0), s = Math.sin(a.angle || 0);
    const along = dx * c + dy * s, across = -dx * s + dy * c;
    if (along < -EPS || along > L + EPS) return false;
    if (a.shape === 'cone') return Math.abs(across) <= along / 2 + EPS;   // largura = distância
    if (a.shape === 'linha') return Math.abs(across) <= (a.width || 5) / 10 + EPS;
    if (a.shape === 'cubo') return Math.abs(across) <= L / 2 + EPS;
    return false;
  }
  function quadradosAtingidos(a, W, H) {
    const out = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (dentroArea(a, x + .5, y + .5)) out.push([x, y]);
    return out;
  }
  // contorno da área para desenhar (em quadrados)
  function contorno(a) {
    const L = a.size / 5, c = Math.cos(a.angle || 0), s = Math.sin(a.angle || 0);
    const P = (al, ac) => [a.x + al * c - ac * s, a.y + al * s + ac * c];
    if (a.shape === 'cone') return [P(0, 0), P(L, -L / 2), P(L, L / 2)];
    const w = a.shape === 'linha' ? (a.width || 5) / 10 : L / 2;
    return [P(0, -w), P(L, -w), P(L, w), P(0, w)];
  }

  Object.assign(exp, { segmentos, raio, visao, cruzaParede, dentroArea, quadradosAtingidos, contorno });

  // ---- autoteste (node mesa-luz.js) ----
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    const assert = require('assert');
    // mapa 6x4 com uma parede vertical em x=3 (linhas 0..3) e uma porta na linha 1
    const W = 6, H = 4, vw = new Array((W + 1) * H).fill(0), hw = new Array(W * (H + 1)).fill(0);
    for (let y = 0; y < H; y++) vw[y * (W + 1) + 3] = 1;
    vw[1 * (W + 1) + 3] = 2;
    const pg = { w: W, h: H, hw, vw };
    const dentro = (poly, px, py) => {   // ponto no polígono (par-ímpar)
      let d = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) d = !d;
      }
      return d;
    };
    const fechada = segmentos(pg), aberta = segmentos(pg, { 'v:3:1': true });
    assert.strictEqual(fechada.filter(s => s[0] === 3 && s[2] === 3).length, 1, 'parede + porta fechada viram um segmento');
    let v = visao(1.5, 1.5, fechada);
    assert(dentro(v, 0.5, 3.5) && dentro(v, 2.5, 0.5), 'vê o próprio lado');
    assert(!dentro(v, 4.5, 1.5), 'não vê através da porta fechada');
    v = visao(1.5, 1.5, aberta);
    assert(dentro(v, 4.5, 1.5), 'vê pela porta aberta');
    assert(!dentro(v, 5.5, 3.5), 'mas não o canto escondido atrás da parede');
    assert(cruzaParede(1.5, 1.5, 4.5, 1.5, fechada) && !cruzaParede(1.5, 1.5, 4.5, 1.5, aberta));
    assert(!cruzaParede(0.5, 0.5, 2.5, 3.5, fechada), 'andar do mesmo lado');

    // áreas: bola de fogo (raio 20 ft) no ponto (5,5) atinge 4 quadrados para cada lado
    const n = quadradosAtingidos({ shape: 'circulo', x: 5, y: 5, size: 20 }, 20, 20).length;
    assert(n > 40 && n < 60, 'esfera de 20 ft ~ 50 quadrados: ' + n);
    const cone = { shape: 'cone', x: 0, y: 2, angle: 0, size: 15 };   // cone de 15 ft para a direita
    assert(dentroArea(cone, 2.5, 2) && dentroArea(cone, 2.5, 3.1) && !dentroArea(cone, 0.5, 3.5) && !dentroArea(cone, 3.5, 2));
    const linha = { shape: 'linha', x: 0, y: 0.5, angle: 0, size: 30, width: 5 };
    assert.strictEqual(quadradosAtingidos(linha, 10, 3).length, 6, 'linha de 30 ft = 6 quadrados');
    assert.strictEqual(quadradosAtingidos({ shape: 'cubo', x: 0, y: 1.5, angle: 0, size: 15 }, 10, 6).length, 9, 'cubo de 15 ft = 3x3');
    console.log('ok: geometria passou');
  }
})(typeof module !== 'undefined' ? module.exports : (window.Luz = {}));
