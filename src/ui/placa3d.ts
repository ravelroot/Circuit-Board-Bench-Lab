import type { Componente, Placa } from '../dados/tipos';
import { ui } from '../i18n/textos';
import { estilo, h, s } from './dom';
import { icone } from './icones';

export interface Pose {
  x: number;
  y: number;
  z: number;
  zoom: number;
}

export const POSE_INICIAL: Readonly<Pose> = { x: 56, y: 0, z: -24, zoom: 1 };

export interface Visor {
  readonly el: HTMLElement;
  readonly acender: (parte: string | null) => void;
  readonly retangulo: (parte: string) => DOMRect | null;
  readonly aoMover: (fn: () => void) => void;
  readonly pose: () => Readonly<Pose>;
  readonly definirPose: (pose: Partial<Pose>) => void;
  readonly alternarGiro: (ligar?: boolean) => void;
  readonly alternarExplosao: (ligar?: boolean) => void;
  readonly destruir: () => void;
}

export interface OpcoesVisor {
  readonly nomeParte: (id: string) => string;
  readonly aoEscolher: (parte: string | null) => void;
}

const limitar = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

const normalizarAngulo = (v: number): number => {
  const r = ((v + 180) % 360 + 360) % 360 - 180;
  return Math.round(r * 10) / 10;
};

const ANTENA = 'M0 8h3V1h3v7h3V1h3v7h3V1h3v7h3V1h3v7';

const enfeite = (comp: Componente): Node | null => {
  if (comp.forma === 'antena') {
    const svg = s('svg', { class: 'antena-svg', viewBox: '0 0 24 9', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    svg.append(s('path', { d: ANTENA, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.1 }));
    return svg;
  }
  if (comp.rotulo) return h('span', { class: 'peca-rotulo' }, comp.rotulo);
  return null;
};

const montarPeca = (comp: Componente, base: number, nomeParte: (id: string) => string): HTMLElement => {
  const plana = comp.z <= 0.25;
  const topo = h('div', { class: `f f-topo forma-${comp.forma}` }, enfeite(comp));
  const peca = h('div', { class: `peca forma-${comp.forma}${plana ? ' plana' : ''}`, 'data-parte': comp.parte ?? null }, topo);
  if (!plana) peca.append(h('div', { class: 'f f-s' }), h('div', { class: 'f f-n' }), h('div', { class: 'f f-l' }), h('div', { class: 'f f-o' }));
  estilo(peca, { '--x': comp.x, '--y': comp.y, '--l': comp.l, '--a': comp.a, '--z': Math.max(comp.z, 0.05), '--b': base });
  if (comp.cor) estilo(peca, { '--cor': comp.cor });
  if (comp.parte) topo.title = nomeParte(comp.parte);
  return peca;
};

const montarBase = (placa: Placa): HTMLElement => {
  const d = placa.desenho;
  const esp = d.espessura ?? 1.6;
  const pcb = h(
    'div',
    { class: `peca pcb pcb-${d.cor}` },
    h('div', { class: 'f f-topo' }),
    h('div', { class: 'f f-base' }),
    h('div', { class: 'f f-s' }),
    h('div', { class: 'f f-n' }),
    h('div', { class: 'f f-l' }),
    h('div', { class: 'f f-o' }),
  );
  estilo(pcb, { '--x': 0, '--y': 0, '--l': d.largura, '--a': d.altura, '--z': esp, '--b': 0 });
  return pcb;
};

export const escalaPara = (placa: Placa, largura: number, altura: number): number => {
  const d = placa.desenho;
  return Math.max(0.6, Math.min(largura / d.largura, altura / d.altura));
};

export const montarVisor = (placa: Placa, opcoes: OpcoesVisor): Visor => {
  const d = placa.desenho;
  const esp = d.espessura ?? 1.6;
  const pose: Pose = { ...POSE_INICIAL };
  let girando = false;
  let explodido = false;
  let quadro = 0;
  let anterior = 0;
  const ouvintes = new Set<() => void>();

  const plano = h('div', { class: 'visor-plano' }, montarBase(placa), ...d.componentes.map((comp) => montarPeca(comp, esp, opcoes.nomeParte)));
  estilo(plano, { '--lp': d.largura, '--ap': d.altura });
  const cena = h('div', { class: 'visor-cena' }, plano);
  const deslizadores = (['x', 'y', 'z'] as const).map((eixo) => {
    const campo = h('input', { type: 'range', min: -180, max: 180, step: 1, value: pose[eixo], 'aria-label': ui('eixo', { e: eixo.toUpperCase() }) });
    const valor = h('output', { class: 'eixo-valor' });
    campo.addEventListener('input', () => {
      pararGiro();
      pose[eixo] = Number(campo.value);
      aplicar(false);
    });
    return { eixo, campo, valor, el: h('label', { class: 'eixo' }, h('span', { class: 'eixo-nome' }, eixo.toUpperCase()), campo, valor) };
  });
  const botaoGiro = h('button', { class: 'botao-visor', type: 'button', 'aria-pressed': 'false', onclick: () => alternarGiro() }, icone('girar'), h('span', {}, ui('girar')));
  const botaoExplodir = h('button', { class: 'botao-visor botao-explodir', type: 'button', 'aria-pressed': 'false', onclick: () => alternarExplosao() }, icone('explodir'), h('span', {}, ui('explodir')));
  const botaoCentro = h('button', { class: 'botao-icone pequeno', type: 'button', title: ui('centralizar'), 'aria-label': ui('centralizar'), onclick: () => { pararGiro(); Object.assign(pose, POSE_INICIAL); aplicar(true); } }, icone('centralizar'));
  const botaoMenos = h('button', { class: 'botao-icone pequeno', type: 'button', title: ui('afastar'), 'aria-label': ui('afastar'), onclick: () => zoom(-0.15) }, icone('menos'));
  const botaoMais = h('button', { class: 'botao-icone pequeno', type: 'button', title: ui('aproximar'), 'aria-label': ui('aproximar'), onclick: () => zoom(0.15) }, icone('mais'));
  const controles = h(
    'div',
    { class: 'visor-controles' },
    h('div', { class: 'visor-botoes' }, botaoGiro, botaoExplodir, h('span', { class: 'espaco' }), botaoMenos, botaoMais, botaoCentro),
    h('div', { class: 'visor-eixos' }, ...deslizadores.map((d2) => d2.el)),
  );
  const el = h(
    'div',
    { class: 'visor', tabindex: 0, role: 'application', 'aria-label': `${placa.nome} 3D`, 'data-explodido': 'false' },
    cena,
    controles,
    h('p', { class: 'visor-dica' }, ui('dicaGiro')),
  );

  const avisar = (): void => {
    for (const fn of ouvintes) fn();
  };

  const aplicar = (suave: boolean): void => {
    plano.classList.toggle('suave', suave);
    estilo(plano, { transform: `rotateX(${pose.x}deg) rotateY(${pose.y}deg) rotateZ(${pose.z}deg) scale3d(${pose.zoom}, ${pose.zoom}, ${pose.zoom})` });
    for (const d2 of deslizadores) {
      const v = normalizarAngulo(pose[d2.eixo]);
      d2.campo.value = String(Math.round(v));
      d2.valor.textContent = `${Math.round(v)}°`;
    }
    if (suave) {
      const fim = performance.now() + 700;
      const seguir = (): void => {
        avisar();
        if (performance.now() < fim) requestAnimationFrame(seguir);
      };
      requestAnimationFrame(seguir);
    } else {
      avisar();
    }
  };

  const ajustarEscala = (): void => {
    const largura = cena.clientWidth * 0.78;
    const altura = Math.max(220, cena.clientHeight * 0.72);
    if (largura <= 0) return;
    estilo(plano, { '--e': escalaPara(placa, largura, altura).toFixed(3) });
    avisar();
  };

  const zoom = (delta: number): void => {
    pose.zoom = limitar(pose.zoom + delta, 0.5, 2.4);
    aplicar(true);
  };

  const passoGiro = (agora: number): void => {
    if (!girando) return;
    const dt = anterior ? Math.min(64, agora - anterior) : 16;
    anterior = agora;
    pose.z = normalizarAngulo(pose.z + dt * 0.03);
    aplicar(false);
    quadro = requestAnimationFrame(passoGiro);
  };

  const pararGiro = (): void => {
    if (girando) alternarGiro(false);
  };

  const alternarGiro = (ligar = !girando): void => {
    girando = ligar;
    botaoGiro.setAttribute('aria-pressed', String(girando));
    cancelAnimationFrame(quadro);
    anterior = 0;
    if (girando) quadro = requestAnimationFrame(passoGiro);
  };

  const alternarExplosao = (ligar = !explodido): void => {
    explodido = ligar;
    el.dataset.explodido = String(explodido);
    botaoExplodir.setAttribute('aria-pressed', String(explodido));
    const fim = performance.now() + 800;
    const seguir = (): void => {
      avisar();
      if (performance.now() < fim) requestAnimationFrame(seguir);
    };
    requestAnimationFrame(seguir);
  };

  const ponteiros = new Map<number, { x: number; y: number }>();
  let arrastou = false;
  let distanciaPinca = 0;

  cena.addEventListener('pointerdown', (ev) => {
    ponteiros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    cena.setPointerCapture(ev.pointerId);
    arrastou = false;
    if (ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()];
      if (a && b) distanciaPinca = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  cena.addEventListener('pointermove', (ev) => {
    const antes = ponteiros.get(ev.pointerId);
    if (!antes) return;
    const dx = ev.clientX - antes.x;
    const dy = ev.clientY - antes.y;
    ponteiros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (Math.abs(dx) + Math.abs(dy) > 1) arrastou = true;
    if (!arrastou) return;
    pararGiro();
    if (ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()];
      if (a && b) {
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (distanciaPinca > 0) pose.zoom = limitar(pose.zoom * (dist / distanciaPinca), 0.5, 2.4);
        distanciaPinca = dist;
      }
    } else if (ev.shiftKey) {
      pose.y = normalizarAngulo(pose.y + dx * 0.45);
      pose.x = normalizarAngulo(pose.x - dy * 0.45);
    } else {
      pose.z = normalizarAngulo(pose.z + dx * 0.45);
      pose.x = normalizarAngulo(pose.x - dy * 0.45);
    }
    aplicar(false);
  });
  const soltar = (ev: PointerEvent): void => {
    const clique = !arrastou && ponteiros.size === 1;
    ponteiros.delete(ev.pointerId);
    if (ponteiros.size < 2) distanciaPinca = 0;
    if (!clique) return;
    const alvo = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('.peca[data-parte]');
    opcoes.aoEscolher(alvo?.dataset.parte ?? null);
  };
  cena.addEventListener('pointerup', soltar);
  cena.addEventListener('pointercancel', (ev) => {
    ponteiros.delete(ev.pointerId);
  });
  cena.addEventListener(
    'wheel',
    (ev) => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      pose.zoom = limitar(pose.zoom * (ev.deltaY > 0 ? 0.92 : 1.08), 0.5, 2.4);
      aplicar(false);
    },
    { passive: false },
  );
  el.addEventListener('keydown', (ev) => {
    if (ev.target !== el) return;
    const passo = ev.shiftKey ? 2 : 10;
    const acoes: Record<string, () => void> = {
      ArrowLeft: () => { pose.z -= passo; },
      ArrowRight: () => { pose.z += passo; },
      ArrowUp: () => { pose.x -= passo; },
      ArrowDown: () => { pose.x += passo; },
      PageUp: () => { pose.y -= passo; },
      PageDown: () => { pose.y += passo; },
      '+': () => { pose.zoom = limitar(pose.zoom + 0.1, 0.5, 2.4); },
      '=': () => { pose.zoom = limitar(pose.zoom + 0.1, 0.5, 2.4); },
      '-': () => { pose.zoom = limitar(pose.zoom - 0.1, 0.5, 2.4); },
      '0': () => { Object.assign(pose, POSE_INICIAL); },
    };
    const acao = acoes[ev.key];
    if (acao) {
      ev.preventDefault();
      ev.stopPropagation();
      pararGiro();
      acao();
      pose.x = normalizarAngulo(pose.x);
      pose.y = normalizarAngulo(pose.y);
      pose.z = normalizarAngulo(pose.z);
      aplicar(true);
      return;
    }
    if (ev.key.toLowerCase() === 'e' && !ev.ctrlKey && !ev.metaKey) {
      ev.preventDefault();
      ev.stopPropagation();
      alternarExplosao();
    } else if (ev.key.toLowerCase() === 'g' && !ev.ctrlKey && !ev.metaKey) {
      ev.preventDefault();
      ev.stopPropagation();
      alternarGiro();
    }
  });

  const observador = new ResizeObserver(() => ajustarEscala());
  observador.observe(cena);

  const pecas = [...plano.querySelectorAll<HTMLElement>('.peca[data-parte]')];

  estilo(plano, { '--e': '3', transform: 'rotateX(0deg) rotateY(0deg) rotateZ(0deg)' });
  requestAnimationFrame(() => {
    ajustarEscala();
    requestAnimationFrame(() => aplicar(true));
  });

  return {
    el,
    acender: (parte) => {
      if (parte) el.dataset.acesa = parte;
      else delete el.dataset.acesa;
      for (const p of pecas) p.classList.toggle('acesa', p.dataset.parte === parte);
    },
    retangulo: (parte) => {
      let r: { l: number; t: number; r: number; b: number } | null = null;
      for (const p of pecas) {
        if (p.dataset.parte !== parte) continue;
        const topo = p.firstElementChild;
        if (!topo) continue;
        const q = topo.getBoundingClientRect();
        r = r ? { l: Math.min(r.l, q.left), t: Math.min(r.t, q.top), r: Math.max(r.r, q.right), b: Math.max(r.b, q.bottom) } : { l: q.left, t: q.top, r: q.right, b: q.bottom };
      }
      return r ? new DOMRect(r.l, r.t, r.r - r.l, r.b - r.t) : null;
    },
    aoMover: (fn) => {
      ouvintes.add(fn);
    },
    pose: () => ({ ...pose }),
    definirPose: (nova) => {
      Object.assign(pose, nova);
      aplicar(true);
    },
    alternarGiro,
    alternarExplosao,
    destruir: () => {
      alternarGiro(false);
      observador.disconnect();
      ouvintes.clear();
    },
  };
};

export const miniatura = (placa: Placa): HTMLElement => {
  const d = placa.desenho;
  const plano = h('div', { class: 'miniatura-plano' }, montarBase(placa), ...d.componentes.map((comp) => montarPeca({ ...comp, z: 0 }, 0, () => '')));
  estilo(plano, { '--e': (Math.min(200 / d.largura, 112 / d.altura)).toFixed(3), '--lp': d.largura, '--ap': d.altura });
  return h('div', { class: 'miniatura', 'aria-hidden': 'true' }, plano);
};
