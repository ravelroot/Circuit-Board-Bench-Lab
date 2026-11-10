import type { Placa } from '../../dados/tipos';
import { ui } from '../../i18n/textos';
import { h } from '../dom';
import { montarEditor2d, type Editor2d } from './editor2d';
import { montarVisor3d, type Visor3d } from './visor3d';

export type Aba = '3d' | 'pcb';

export interface Janela {
  readonly el: HTMLElement;
  readonly acender: (parte: string | null) => void;
  readonly retangulo: (parte: string) => DOMRect | null;
  readonly aoMover: (fn: () => void) => void;
  readonly destruir: () => void;
}

export interface OpcoesJanela {
  readonly nomeParte: (id: string) => string;
  readonly aoEscolher: (parte: string | null) => void;
}

let abaPreferida: Aba = '3d';

export const montarJanela = (placa: Placa, opcoes: OpcoesJanela): Janela => {
  const visor3d: Visor3d | null = montarVisor3d(placa, { aoEscolher: opcoes.aoEscolher });
  const editor: Editor2d = montarEditor2d(placa, opcoes);
  let aba: Aba = visor3d ? abaPreferida : 'pcb';
  const ouvintes = new Set<() => void>();
  const avisar = (): void => {
    for (const fn of ouvintes) fn();
  };
  visor3d?.aoMover(() => {
    if (aba === '3d') avisar();
  });
  editor.aoMover(() => {
    if (aba === 'pcb') avisar();
  });

  const botoes = (['3d', 'pcb'] as const).map((valor) =>
    h(
      'button',
      { class: 'janela-aba', type: 'button', role: 'tab', 'data-aba': valor, disabled: valor === '3d' && !visor3d },
      h('span', { class: `janela-icone icone-${valor}`, 'aria-hidden': 'true' }),
      valor === '3d' ? ui('abaVisor3d') : ui('abaEditor'),
    ),
  );
  const corpo3d = h('div', { class: 'janela-painel', role: 'tabpanel', 'data-aba': '3d' }, visor3d ? visor3d.el : h('p', { class: 'aviso-sem-labs' }, ui('semWebgl')));
  const corpoPcb = h('div', { class: 'janela-painel', role: 'tabpanel', 'data-aba': 'pcb' }, editor.el);
  const el = h(
    'div',
    { class: 'janela', 'data-aba': aba },
    h('div', { class: 'janela-topo', role: 'tablist' }, h('span', { class: 'janela-luzes', 'aria-hidden': 'true' }, h('i', {}), h('i', {}), h('i', {})), ...botoes, h('span', { class: 'janela-titulo mono' }, `${placa.id}.kicad_pcb — KiCad`)),
    corpo3d,
    corpoPcb,
  );

  const mostrar = (nova: Aba): void => {
    aba = nova;
    if (visor3d) abaPreferida = nova;
    el.dataset.aba = nova;
    for (const b of botoes) {
      b.setAttribute('aria-selected', String(b.dataset.aba === nova));
      b.classList.toggle('atual', b.dataset.aba === nova);
    }
    corpo3d.hidden = nova !== '3d';
    corpoPcb.hidden = nova !== 'pcb';
    requestAnimationFrame(() => {
      if (nova === '3d') visor3d?.redimensionar();
      else editor.redimensionar();
      avisar();
    });
  };
  for (const b of botoes) b.addEventListener('click', () => mostrar(b.dataset.aba as Aba));
  mostrar(aba);

  return {
    el,
    acender: (parte) => {
      visor3d?.acender(parte);
      editor.acender(parte);
      if (parte) el.dataset.acesa = parte;
      else delete el.dataset.acesa;
    },
    retangulo: (parte) => (aba === '3d' ? visor3d?.retangulo(parte) ?? null : editor.retangulo(parte)),
    aoMover: (fn) => {
      ouvintes.add(fn);
    },
    destruir: () => {
      visor3d?.destruir();
      editor.destruir();
      ouvintes.clear();
    },
  };
};
