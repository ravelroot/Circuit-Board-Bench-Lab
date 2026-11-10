import { h } from '../dom';

export interface Simulador {
  readonly el: HTMLElement;
  readonly destruir: () => void;
}

export class Relogio {
  private readonly intervalos = new Set<number>();
  private readonly tempos = new Set<number>();
  private quadro = 0;
  private ativo = true;

  intervalo(fn: () => void, ms: number): void {
    this.intervalos.add(window.setInterval(fn, ms));
  }

  depois(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      this.tempos.delete(id);
      if (this.ativo) fn();
    }, ms);
    this.tempos.add(id);
  }

  animar(fn: (agora: number) => void): void {
    const passo = (agora: number): void => {
      if (!this.ativo) return;
      fn(agora);
      this.quadro = requestAnimationFrame(passo);
    };
    this.quadro = requestAnimationFrame(passo);
  }

  limparTempos(): void {
    for (const id of this.tempos) window.clearTimeout(id);
    this.tempos.clear();
  }

  parar(): void {
    this.ativo = false;
    for (const id of this.intervalos) window.clearInterval(id);
    this.limparTempos();
    cancelAnimationFrame(this.quadro);
  }
}

export const abas = <T extends string>(opcoes: readonly (readonly [T, string])[], inicial: T, aoMudar: (v: T) => void): HTMLElement => {
  const botoes = opcoes.map(([valor, rotulo], i) =>
    h('button', { class: 'sim-aba', type: 'button', 'aria-pressed': String(valor === inicial), 'data-valor': valor }, h('span', { class: 'mono' }, `${i + 1}`), rotulo),
  );
  const grupo = h('div', { class: 'sim-abas', role: 'group' }, ...botoes);
  grupo.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('.sim-aba');
    if (!b?.dataset.valor) return;
    for (const x of botoes) x.setAttribute('aria-pressed', String(x === b));
    aoMudar(b.dataset.valor as T);
  });
  return grupo;
};

export const deslizador = (rotulo: string, min: number, max: number, passo: number, valor: number, aoMudar: (v: number) => void): { el: HTMLElement; saida: HTMLOutputElement; campo: HTMLInputElement } => {
  const campo = h('input', { type: 'range', min, max, step: passo, value: valor, 'aria-label': rotulo });
  const saida = h('output', { class: 'mono' });
  campo.addEventListener('input', () => aoMudar(Number(campo.value)));
  return { el: h('label', { class: 'sim-deslizador' }, h('span', { class: 'rotulo' }, rotulo), campo, saida), saida, campo };
};

export const quadroSim = (titulo: string, ...filhos: (Node | null)[]): HTMLElement =>
  h('div', { class: 'simulador', tabindex: -1 }, h('div', { class: 'sim-titulo' }, h('span', { class: 'sim-pontos', 'aria-hidden': 'true' }, h('i', {}), h('i', {}), h('i', {})), h('span', { class: 'mono' }, titulo)), ...filhos);

export const fmt = (v: number, casas = 1): string => v.toLocaleString(document.documentElement.lang || 'pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export const EN = (): boolean => document.documentElement.lang === 'en';
export const L = (pt: string, en: string): string => (EN() ? en : pt);
