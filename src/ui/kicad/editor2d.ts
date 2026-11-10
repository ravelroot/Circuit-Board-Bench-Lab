import type { Placa } from '../../dados/tipos';
import { projetoDe } from '../../pcb/gerador';
import type { Footprint, Pad, ProjetoPcb } from '../../pcb/modelo';
import { ui, type ChaveTexto } from '../../i18n/textos';
import { h, s, trocar } from '../dom';
import { icone } from '../icones';
import { corAcabamento, misturar, COR_COBRE } from './texturas';

export interface Editor2d {
  readonly el: HTMLElement;
  readonly acender: (parte: string | null) => void;
  readonly retangulo: (parte: string) => DOMRect | null;
  readonly aoMover: (fn: () => void) => void;
  readonly redimensionar: () => void;
  readonly destruir: () => void;
}

export interface OpcoesEditor {
  readonly aoEscolher: (parte: string | null) => void;
  readonly nomeParte: (id: string) => string;
}

type Camada = 'F.Cu' | 'B.Cu' | 'F.Silkscreen' | 'F.Courtyard' | 'F.Fab' | 'Edge.Cuts';
type Objeto = 'pads' | 'vias' | 'zonas' | 'referencias' | 'valores' | 'grade' | 'numeros';

const CAMADAS: readonly [Camada, string][] = [
  ['F.Cu', '#c83434'],
  ['B.Cu', '#4d7fc4'],
  ['F.Silkscreen', '#f2eda1'],
  ['F.Courtyard', '#ff26e2'],
  ['F.Fab', '#afafaf'],
  ['Edge.Cuts', '#d0d240'],
];

const OBJETOS: readonly [Objeto, ChaveTexto, string][] = [
  ['pads', 'objPads', '#e3b72e'],
  ['vias', 'objVias', '#ececec'],
  ['zonas', 'objZonas', '#c83434'],
  ['referencias', 'objReferencias', '#f2eda1'],
  ['valores', 'objValores', '#afafaf'],
  ['numeros', 'objNumeros', '#ffffff'],
  ['grade', 'objGrade', '#848484'],
];

const GRADES = [0.635, 1.27, 2.54, 5.08, 12.7, 25.4, 50.8];

const fmt = (v: number): string => v.toFixed(3);

const padSvg = (pad: Pad, classe: string, fp: number): SVGElement => {
  const comum = { class: classe, 'data-fp': fp };
  if (pad.forma === 'redondo') return s('ellipse', { ...comum, cx: fmt(pad.x), cy: fmt(pad.y), rx: fmt(pad.l / 2), ry: fmt(pad.a / 2) });
  const raio = pad.forma === 'oval' ? Math.min(pad.l, pad.a) / 2 : pad.forma === 'arredondado' ? Math.min(pad.l, pad.a) * 0.25 : 0;
  return s('rect', { ...comum, x: fmt(pad.x - pad.l / 2), y: fmt(pad.y - pad.a / 2), width: fmt(pad.l), height: fmt(pad.a), rx: fmt(raio) });
};

const polilinha = (pontos: readonly (readonly [number, number])[]): string => pontos.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ');

const construirConteudo = (p: ProjetoPcb, id: string): SVGGElement => {
  const raiz = s('g', { class: 'pcb' });
  const folga = 0.3 * p.escala;
  const defs = s('defs', {});
  for (const camada of ['F', 'B'] as const) {
    const mascara = s('mask', { id: `zona-${camada}-${id}`, maskUnits: 'userSpaceOnUse', x: -5, y: -5, width: p.largura + 10, height: p.altura + 10 });
    mascara.append(s('rect', { x: 0, y: 0, width: fmt(p.largura), height: fmt(p.altura), fill: '#fff' }));
    const recortes = s('g', { fill: '#000', stroke: '#000', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    for (const t of p.trilhas) if (t.camada === `${camada}.Cu`) recortes.append(s('polyline', { points: polilinha(t.pontos), fill: 'none', 'stroke-width': fmt(t.largura + folga * 2) }));
    for (const f of p.footprints) {
      for (const pad of f.pads) if (camada === 'F' || pad.furo > 0) recortes.append(s('rect', { x: fmt(pad.x - pad.l / 2 - folga), y: fmt(pad.y - pad.a / 2 - folga), width: fmt(pad.l + folga * 2), height: fmt(pad.a + folga * 2) }));
      if (camada === 'F') for (const m of f.matrizes) recortes.append(s('rect', { x: fmt(m.x - folga), y: fmt(m.y - folga), width: fmt(m.l + folga * 2), height: fmt(m.a + folga * 2) }));
    }
    for (const v of p.vias) recortes.append(s('circle', { cx: fmt(v.x), cy: fmt(v.y), r: fmt(v.d / 2 + folga) }));
    for (const h2 of p.furos) recortes.append(s('circle', { cx: fmt(h2.x), cy: fmt(h2.y), r: fmt(h2.anel / 2 + folga * 2) }));
    mascara.append(recortes);
    defs.append(mascara);
  }
  const padraoMatriz = s('pattern', { id: `bga-${id}`, patternUnits: 'userSpaceOnUse', width: 1, height: 1 });
  padraoMatriz.append(s('circle', { cx: 0.5, cy: 0.5, r: 0.3, class: 'k-pad-smd' }));
  defs.append(padraoMatriz);
  raiz.append(defs);

  const camada = (nome: Camada, ...filhos: SVGElement[]): SVGGElement => {
    const g = s('g', { 'data-camada': nome });
    for (const f of filhos) g.append(f);
    return g;
  };
  const objeto = (nome: Objeto, ...filhos: SVGElement[]): SVGGElement => {
    const g = s('g', { 'data-objeto': nome });
    for (const f of filhos) g.append(f);
    return g;
  };
  const trilhasDe = (c: 'F.Cu' | 'B.Cu', classe: string): SVGElement[] =>
    p.trilhas.filter((t) => t.camada === c).map((t) => s('polyline', { class: classe, points: polilinha(t.pontos), 'stroke-width': fmt(t.largura) }));

  const zonaB = s('rect', { class: 'k-zona-b', x: 0.5, y: 0.5, width: fmt(p.largura - 1), height: fmt(p.altura - 1), mask: `url(#zona-B-${id})` });
  const zonaF = s('rect', { class: 'k-zona-f', x: 0.5, y: 0.5, width: fmt(p.largura - 1), height: fmt(p.altura - 1), mask: `url(#zona-F-${id})` });

  const padsSmd: SVGElement[] = [];
  const padsTht: SVGElement[] = [];
  const numeros: SVGElement[] = [];
  const matrizes: SVGElement[] = [];
  for (const f of p.footprints) {
    for (const pad of f.pads) {
      if (pad.furo > 0) {
        padsTht.push(padSvg(pad, 'k-pad-tht', f.indice), s('circle', { class: 'k-furo', cx: fmt(pad.x), cy: fmt(pad.y), r: fmt(pad.furo / 2), 'data-fp': f.indice }));
      } else {
        padsSmd.push(padSvg(pad, 'k-pad-smd', f.indice));
      }
      const tamanho = Math.min(pad.l, pad.a) * 0.55;
      if (tamanho > 0.25) numeros.push(s('text', { class: 'k-numero', x: fmt(pad.x), y: fmt(pad.y + tamanho * 0.35), 'font-size': fmt(tamanho) }, pad.numero));
    }
    for (const m of f.matrizes) {
      const g = s('rect', { class: 'k-matriz', x: fmt(m.x), y: fmt(m.y), width: fmt(m.l), height: fmt(m.a), fill: `url(#bga-${id})`, 'data-fp': f.indice });
      matrizes.push(g);
    }
  }
  const antenas = p.antenas.map((a) => s('polyline', { class: 'k-trilha-f', points: polilinha(a.pontos), 'stroke-width': fmt(a.largura) }));
  const vias = p.vias.flatMap((v) => [s('circle', { class: 'k-via', cx: fmt(v.x), cy: fmt(v.y), r: fmt(v.d / 2) }), s('circle', { class: 'k-furo', cx: fmt(v.x), cy: fmt(v.y), r: fmt(v.furo / 2) })]);
  const furos = p.furos.flatMap((f) => [s('circle', { class: 'k-pad-tht', cx: fmt(f.x), cy: fmt(f.y), r: fmt(f.anel / 2) }), s('circle', { class: 'k-furo', cx: fmt(f.x), cy: fmt(f.y), r: fmt(f.d / 2) })]);

  const tamanhoRef = Math.min(3, Math.max(0.9, Math.max(p.largura, p.altura) / 80));
  const silk: SVGElement[] = [];
  const refs: SVGElement[] = [];
  const fab: SVGElement[] = [];
  const valores: SVGElement[] = [];
  const patios: SVGElement[] = [];
  for (const f of p.footprints) {
    if (f.silk.length) silk.push(s('path', { class: 'k-silk', 'data-fp': f.indice, d: f.silk.map((g) => `M${fmt(g.x1)} ${fmt(g.y1)}L${fmt(g.x2)} ${fmt(g.y2)}`).join('') }));
    for (const c of f.silkCirculos) silk.push(s('circle', { class: c.r < 0.5 ? 'k-silk-ponto' : 'k-silk', 'data-fp': f.indice, cx: fmt(c.x), cy: fmt(c.y), r: fmt(c.r) }));
    if (f.modelo !== 'antena' && f.modelo !== 'pads' && f.modelo !== 'cabo') refs.push(s('text', { class: 'k-ref', 'data-fp': f.indice, x: fmt(f.refPos.x), y: fmt(f.refPos.y + tamanhoRef * 0.35), 'font-size': fmt(tamanhoRef) }, f.ref));
    fab.push(s('rect', { class: 'k-fab', 'data-fp': f.indice, x: fmt(f.corpo.x), y: fmt(f.corpo.y), width: fmt(f.corpo.l), height: fmt(f.corpo.a) }));
    const tamValor = Math.min(tamanhoRef, f.corpo.a * 0.35, (f.corpo.l / Math.max(3, f.valor.length)) * 1.6);
    const centroY = f.corpo.y + f.corpo.a / 2;
    const yValor = Math.abs(f.refPos.y - centroY) < 0.01 ? centroY + tamanhoRef * 1.1 : centroY;
    if (tamValor > 0.3) valores.push(s('text', { class: 'k-valor', 'data-fp': f.indice, x: fmt(f.corpo.x + f.corpo.l / 2), y: fmt(yValor + tamValor * 0.35), 'font-size': fmt(tamValor) }, f.valor));
    patios.push(s('rect', { class: 'k-patio', 'data-fp': f.indice, x: fmt(f.patio.x), y: fmt(f.patio.y), width: fmt(f.patio.l), height: fmt(f.patio.a) }));
  }
  for (const t of p.textos) refs.push(s('text', { class: 'k-ref k-texto', x: fmt(t.x), y: fmt(t.y + t.tamanho * 0.35), 'font-size': fmt(t.tamanho) }, t.texto));

  raiz.append(
    camada('B.Cu', objeto('zonas', zonaB), ...trilhasDe('B.Cu', 'k-trilha-b')),
    camada('F.Cu', objeto('zonas', zonaF), ...trilhasDe('F.Cu', 'k-trilha-f'), ...antenas, objeto('pads', ...padsSmd, ...matrizes)),
    objeto('pads', ...padsTht),
    objeto('vias', ...vias),
    s('g', { class: 'k-furos' }, ...furos),
    camada('F.Fab', ...fab, objeto('valores', ...valores)),
    camada('F.Courtyard', ...patios),
    camada('F.Silkscreen', ...silk, objeto('referencias', ...refs)),
    camada('Edge.Cuts', s('rect', { class: 'k-borda', x: 0, y: 0, width: fmt(p.largura), height: fmt(p.altura), rx: fmt(p.raio) })),
    objeto('numeros', ...numeros),
  );
  return raiz;
};

let contador = 0;

export const montarEditor2d = (placa: Placa, opcoes: OpcoesEditor): Editor2d => {
  const p = projetoDe(placa);
  const id = `e${++contador}`;
  const vb = { x: 0, y: 0, w: p.largura, h: p.altura };
  const visiveis = new Set<string>([...CAMADAS.map(([c]) => c), ...OBJETOS.map(([o]) => o).filter((o) => o !== 'numeros')]);
  let grade = 1.27;
  let selecionado: Footprint | null = null;
  let parteAcesa: string | null = null;
  const ouvintes = new Set<() => void>();
  const avisar = (): void => {
    for (const fn of ouvintes) fn();
  };

  const padraoGrade = s('pattern', { id: `grade-${id}`, patternUnits: 'userSpaceOnUse', width: grade, height: grade });
  const pontoGrade = s('circle', { cx: 0, cy: 0, r: 0.05, class: 'k-grade-ponto' });
  padraoGrade.append(pontoGrade);
  const fundoGrade = s('rect', { class: 'k-grade', x: -2000, y: -2000, width: 5000, height: 5000, fill: `url(#grade-${id})`, 'data-objeto': 'grade' });
  const selecao = s('g', { class: 'k-selecao' });
  const cruzH = s('line', { class: 'k-cursor', x1: -5000, x2: 5000, y1: 0, y2: 0 });
  const cruzV = s('line', { class: 'k-cursor', y1: -5000, y2: 5000, x1: 0, x2: 0 });
  const alvos = s('g', { class: 'k-alvos' });
  for (const f of p.footprints) {
    if (f.modelo === 'texto') continue;
    alvos.append(s('rect', { class: 'k-alvo', 'data-fp': f.indice, 'data-parte': f.parte ?? null, x: fmt(f.patio.x), y: fmt(f.patio.y), width: fmt(f.patio.l), height: fmt(f.patio.a) }));
  }
  const svg = s('svg', { class: 'editor-svg', role: 'img', 'aria-label': `${placa.id}.kicad_pcb`, preserveAspectRatio: 'xMidYMid meet' }, s('defs', {}, padraoGrade), fundoGrade, construirConteudo(p, id), alvos, selecao, cruzH, cruzV);

  const linhasCamadas = CAMADAS.map(([nome, cor]) => {
    const caixa = h('input', { type: 'checkbox', checked: true, 'aria-label': nome });
    caixa.addEventListener('change', () => alternarVisivel(nome, caixa.checked));
    const amostra = h('span', { class: 'k-amostra' });
    amostra.style.setProperty('--k', cor);
    return h('label', { class: 'k-linha' }, caixa, amostra, h('span', { class: 'mono' }, nome));
  });
  const linhasObjetos = OBJETOS.map(([nome, chave, cor]) => {
    const caixa = h('input', { type: 'checkbox', checked: visiveis.has(nome), 'aria-label': ui(chave) });
    caixa.addEventListener('change', () => alternarVisivel(nome, caixa.checked));
    const amostra = h('span', { class: 'k-amostra' });
    amostra.style.setProperty('--k', cor);
    return h('label', { class: 'k-linha' }, caixa, amostra, h('span', {}, ui(chave)));
  });
  const propriedades = h('dl', { class: 'k-props' });
  const status = h('div', { class: 'editor-status mono' });
  const area = h('div', { class: 'editor-area' }, svg);
  const painel = h(
    'aside',
    { class: 'editor-painel' },
    h('h3', { class: 'k-titulo' }, ui('aparencia')),
    h('p', { class: 'k-sub' }, ui('camadas')),
    ...linhasCamadas,
    h('p', { class: 'k-sub' }, ui('objetos')),
    ...linhasObjetos,
    h('h3', { class: 'k-titulo' }, ui('propriedades')),
    propriedades,
  );
  const botao = (rotulo: string, nome: Parameters<typeof icone>[0], acao: () => void): HTMLButtonElement => h('button', { class: 'kicad-botao', type: 'button', title: rotulo, 'aria-label': rotulo, onclick: acao }, icone(nome, 'icone mini'));
  const seletorGrade = h('select', { class: 'kicad-select mono', 'aria-label': ui('grade') }, ...GRADES.map((g) => h('option', { value: g, selected: g === grade }, `${g} mm`)));
  seletorGrade.addEventListener('change', () => {
    grade = Number(seletorGrade.value);
    atualizarGrade(true);
  });
  const barra = h(
    'div',
    { class: 'kicad-barra' },
    h('div', { class: 'kicad-grupo' }, botao(ui('ajustarTela'), 'centralizar', () => ajustar()), botao(ui('afastar'), 'menos', () => zoomEm(1.25)), botao(ui('aproximar'), 'mais', () => zoomEm(0.8))),
    h('span', { class: 'kicad-separador' }),
    h('label', { class: 'kicad-campo' }, h('span', {}, ui('grade')), seletorGrade),
    h('span', { class: 'espaco' }),
    h('span', { class: 'kicad-arquivo mono' }, `${placa.id}.kicad_pcb`),
  );
  const el = h('div', { class: 'editor', tabindex: 0 }, barra, h('div', { class: 'editor-corpo' }, area, painel), status, h('p', { class: 'visor-dica' }, ui('dicaEditor')));

  const alternarVisivel = (nome: string, ligar: boolean): void => {
    if (ligar) visiveis.add(nome);
    else visiveis.delete(nome);
    for (const g of svg.querySelectorAll<SVGGElement>(`[data-camada="${nome}"], [data-objeto="${nome}"]`)) g.style.display = ligar ? '' : 'none';
    avisar();
  };
  for (const [o] of OBJETOS) if (!visiveis.has(o)) alternarVisivel(o, false);

  const pxmm = (): number => (area.clientWidth || 600) / vb.w;

  const atualizarGrade = (forcar = false): void => {
    const escala = pxmm();
    let g = grade;
    if (!forcar) {
      g = GRADES.find((x) => x * escala >= 9) ?? GRADES[GRADES.length - 1] ?? 25.4;
      g = Math.max(g, grade);
    }
    padraoGrade.setAttribute('width', String(g));
    padraoGrade.setAttribute('height', String(g));
    pontoGrade.setAttribute('r', fmt(Math.max(0.03, 0.9 / escala)));
    svg.classList.toggle('mostra-numeros', escala > 14);
    svg.classList.toggle('longe', escala < 3.5);
  };

  const aplicar = (): void => {
    svg.setAttribute('viewBox', `${fmt(vb.x)} ${fmt(vb.y)} ${fmt(vb.w)} ${fmt(vb.h)}`);
    atualizarGrade();
    desenharSelecao();
    avisar();
  };

  const ajustar = (): void => {
    const largura = area.clientWidth || 600;
    const altura = area.clientHeight || 400;
    const margem = Math.max(p.largura, p.altura) * 0.06;
    const w = p.largura + margem * 2;
    const hh = p.altura + margem * 2;
    const proporcao = largura / altura;
    if (w / hh > proporcao) {
      vb.w = w;
      vb.h = w / proporcao;
    } else {
      vb.h = hh;
      vb.w = hh * proporcao;
    }
    vb.x = p.largura / 2 - vb.w / 2;
    vb.y = p.altura / 2 - vb.h / 2;
    aplicar();
  };

  const paraSvg = (cx: number, cy: number): [number, number] => {
    const r = svg.getBoundingClientRect();
    return [vb.x + ((cx - r.left) / r.width) * vb.w, vb.y + ((cy - r.top) / r.height) * vb.h];
  };

  const zoomEm = (fator: number, cx?: number, cy?: number): void => {
    const r = svg.getBoundingClientRect();
    const [px, py] = paraSvg(cx ?? r.left + r.width / 2, cy ?? r.top + r.height / 2);
    const max = Math.max(p.largura, p.altura) * 4;
    const novoW = Math.min(max, Math.max(1.5, vb.w * fator));
    const f = novoW / vb.w;
    vb.x = px - (px - vb.x) * f;
    vb.y = py - (py - vb.y) * f;
    vb.w *= f;
    vb.h *= f;
    aplicar();
  };

  const desenharSelecao = (): void => {
    selecao.replaceChildren();
    const marcar = (f: Footprint, classe: string): void => {
      selecao.append(s('rect', { class: classe, x: fmt(f.patio.x - 0.3), y: fmt(f.patio.y - 0.3), width: fmt(f.patio.l + 0.6), height: fmt(f.patio.a + 0.6) }));
    };
    if (parteAcesa) for (const f of p.footprints) if (f.parte === parteAcesa) marcar(f, 'k-sel-parte');
    if (selecionado) marcar(selecionado, 'k-sel');
  };

  const realcar = (): void => {
    for (const e of svg.querySelectorAll('.sel')) e.classList.remove('sel');
    const indices = new Set<number>();
    if (selecionado) indices.add(selecionado.indice);
    if (parteAcesa) for (const f of p.footprints) if (f.parte === parteAcesa) indices.add(f.indice);
    for (const i of indices) for (const e of svg.querySelectorAll(`[data-fp="${i}"]`)) e.classList.add('sel');
  };

  const mostrarPropriedades = (): void => {
    const f = selecionado;
    if (!f) {
      trocar(propriedades, h('dd', { class: 'k-vazio' }, ui('nadaSelecionado')));
      return;
    }
    const pads = f.pads.length + f.matrizes.reduce((t, m) => t + Math.floor(m.l / m.passo) * Math.floor(m.a / m.passo), 0);
    const linhas: [ChaveTexto, string][] = [
      ['propReferencia', f.ref],
      ['propValor', f.valor],
      ['propFootprint', f.biblioteca],
      ['propCamada', 'F.Cu'],
      ['propPosicao', `X ${(f.corpo.x + f.corpo.l / 2).toFixed(2)}  Y ${(f.corpo.y + f.corpo.a / 2).toFixed(2)} mm · 0°`],
      ['propTamanho', `${f.corpo.l.toFixed(2)} × ${f.corpo.a.toFixed(2)} × ${f.comp.z.toFixed(2)} mm`],
      ['propPads', String(pads)],
      ['propTecnologia', f.tht ? 'THT' : f.pads.length || f.matrizes.length ? 'SMD' : '—'],
    ];
    if (f.parte) linhas.push(['propParte', opcoes.nomeParte(f.parte)]);
    trocar(propriedades, ...linhas.flatMap(([k, v]) => [h('dt', {}, ui(k)), h('dd', { class: k === 'propFootprint' ? 'mono quebra' : 'mono' }, v)]));
  };

  const escolher = (f: Footprint | null): void => {
    selecionado = f;
    realcar();
    desenharSelecao();
    mostrarPropriedades();
  };

  const ponteiros = new Map<number, { x: number; y: number }>();
  let arrastou = false;
  let pinca = 0;
  svg.addEventListener('pointerdown', (ev) => {
    ponteiros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    svg.setPointerCapture(ev.pointerId);
    arrastou = false;
    if (ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()];
      if (a && b) pinca = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  svg.addEventListener('pointermove', (ev) => {
    const [x, y] = paraSvg(ev.clientX, ev.clientY);
    const gx = Math.round(x / grade) * grade;
    const gy = Math.round(y / grade) * grade;
    cruzH.setAttribute('y1', fmt(gy));
    cruzH.setAttribute('y2', fmt(gy));
    cruzV.setAttribute('x1', fmt(gx));
    cruzV.setAttribute('x2', fmt(gx));
    status.textContent = `X ${gx.toFixed(4)}  Y ${gy.toFixed(4)}  |  Z ${(pxmm() / ((area.clientWidth || 600) / p.largura)).toFixed(2)}  |  ${ui('grade')} ${grade} mm  |  mm`;
    const antes = ponteiros.get(ev.pointerId);
    if (!antes) {
      const alvo = (ev.target as Element).closest?.('.k-alvo');
      svg.classList.toggle('sobre-fp', !!alvo);
      return;
    }
    const dx = ev.clientX - antes.x;
    const dy = ev.clientY - antes.y;
    ponteiros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (Math.abs(dx) + Math.abs(dy) > 2) arrastou = true;
    if (!arrastou) return;
    if (ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()];
      if (a && b) {
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinca > 0) zoomEm(pinca / dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinca = dist;
      }
      return;
    }
    const r = svg.getBoundingClientRect();
    vb.x -= (dx / r.width) * vb.w;
    vb.y -= (dy / r.height) * vb.h;
    aplicar();
  });
  svg.addEventListener('pointerup', (ev) => {
    const clique = !arrastou && ponteiros.size === 1;
    ponteiros.delete(ev.pointerId);
    if (ponteiros.size < 2) pinca = 0;
    if (!clique) return;
    const alvo = document.elementsFromPoint(ev.clientX, ev.clientY).filter((e) => e.classList.contains('k-alvo'));
    const fps = alvo.map((e) => p.footprints.find((f) => f.indice === Number((e as SVGElement).dataset.fp))).filter((f): f is Footprint => !!f);
    fps.sort((a, b) => a.corpo.l * a.corpo.a - b.corpo.l * b.corpo.a);
    const f = fps[0] ?? null;
    escolher(f);
    opcoes.aoEscolher(f?.parte ?? null);
  });
  svg.addEventListener('pointercancel', (ev) => ponteiros.delete(ev.pointerId));
  svg.addEventListener(
    'wheel',
    (ev) => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      zoomEm(ev.deltaY > 0 ? 1.12 : 0.89, ev.clientX, ev.clientY);
    },
    { passive: false },
  );
  el.addEventListener('keydown', (ev) => {
    if (ev.target !== el) return;
    const passo = vb.w * 0.08;
    const acoes: Record<string, () => void> = {
      ArrowLeft: () => { vb.x -= passo; aplicar(); },
      ArrowRight: () => { vb.x += passo; aplicar(); },
      ArrowUp: () => { vb.y -= passo; aplicar(); },
      ArrowDown: () => { vb.y += passo; aplicar(); },
      '+': () => zoomEm(0.8),
      '=': () => zoomEm(0.8),
      '-': () => zoomEm(1.25),
      Home: () => ajustar(),
      '0': () => ajustar(),
    };
    const acao = acoes[ev.key];
    if (!acao) return;
    ev.preventDefault();
    ev.stopPropagation();
    acao();
  });

  let primeiro = true;
  const redimensionar = (): void => {
    if (!area.clientWidth) return;
    if (primeiro) {
      primeiro = false;
      ajustar();
      return;
    }
    const proporcao = area.clientWidth / Math.max(1, area.clientHeight);
    const cx = vb.x + vb.w / 2;
    vb.w = vb.h * proporcao;
    vb.x = cx - vb.w / 2;
    aplicar();
  };
  const observador = new ResizeObserver(() => redimensionar());
  observador.observe(area);
  mostrarPropriedades();
  status.textContent = `${p.footprints.length} footprints · ${p.trilhas.length} tracks · ${p.vias.length} vias`;

  return {
    el,
    acender: (parte) => {
      parteAcesa = parte;
      if (parte) el.dataset.acesa = parte;
      else delete el.dataset.acesa;
      const primeiroDaParte = parte ? p.footprints.find((f) => f.parte === parte) ?? null : null;
      selecionado = primeiroDaParte;
      realcar();
      desenharSelecao();
      mostrarPropriedades();
    },
    retangulo: (parte) => {
      let caixa: { l: number; t: number; r: number; b: number } | null = null;
      const area2 = area.getBoundingClientRect();
      for (const e of alvos.querySelectorAll<SVGRectElement>(`[data-parte="${CSS.escape(parte)}"]`)) {
        const q = e.getBoundingClientRect();
        const l = Math.max(q.left, area2.left);
        const t = Math.max(q.top, area2.top);
        const r = Math.min(q.right, area2.right);
        const b = Math.min(q.bottom, area2.bottom);
        if (r <= l || b <= t) continue;
        caixa = caixa ? { l: Math.min(caixa.l, l), t: Math.min(caixa.t, t), r: Math.max(caixa.r, r), b: Math.max(caixa.b, b) } : { l, t, r, b };
      }
      const final = caixa as { l: number; t: number; r: number; b: number } | null;
      return final ? new DOMRect(final.l, final.t, final.r - final.l, final.b - final.t) : null;
    },
    aoMover: (fn) => {
      ouvintes.add(fn);
    },
    redimensionar,
    destruir: () => {
      observador.disconnect();
      ouvintes.clear();
    },
  };
};

export const vistaEstatica = (placa: Placa): SVGSVGElement => {
  const p = projetoDe(placa);
  const metal = corAcabamento(p);
  const base = misturar(p.corMascara, '#000000', 0.28);
  const trilha = misturar(p.corMascara, COR_COBRE, 0.3);
  const svg = s('svg', { class: 'vista-estatica', viewBox: `-2 -2 ${p.largura + 4} ${p.altura + 4}`, 'aria-hidden': 'true' });
  svg.append(s('rect', { x: 0, y: 0, width: fmt(p.largura), height: fmt(p.altura), rx: fmt(p.raio), fill: base }));
  for (const t of p.trilhas) if (t.camada === 'F.Cu') svg.append(s('polyline', { points: polilinha(t.pontos), fill: 'none', stroke: trilha, 'stroke-width': fmt(t.largura), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  for (const f of p.footprints) {
    for (const pad of f.pads) {
      const e = padSvg(pad, '', f.indice);
      e.setAttribute('fill', metal);
      svg.append(e);
    }
    if (['antena', 'pads', 'texto', 'submodulo'].includes(f.modelo)) continue;
    svg.append(s('rect', { x: fmt(f.corpo.x), y: fmt(f.corpo.y), width: fmt(f.corpo.l), height: fmt(f.corpo.a), fill: f.modelo === 'blindagem' || f.modelo === 'bga' || f.modelo === 'conector' ? '#c9ccd1' : f.comp.cor ?? '#1a1a1c', rx: 0.3 }));
  }
  return svg;
};
