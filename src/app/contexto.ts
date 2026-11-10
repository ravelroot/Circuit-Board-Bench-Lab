import type { Estado, Loja, Rota } from './estado';

export interface Contexto {
  readonly loja: Loja;
  readonly navegar: (rota: Rota) => void;
}

export interface Pagina {
  readonly el: HTMLElement;
  readonly destruir: () => void;
}

export const conjuntos = (e: Estado): { bancada: ReadonlySet<string>; feitos: ReadonlySet<string> } => ({
  bancada: new Set(e.bancada),
  feitos: new Set(e.feitos),
});

export const vigiar = (loja: Loja, el: Element, fn: (e: Estado, a: Estado) => void): void => {
  const desligar = loja.assinar((e, a) => {
    if (!el.isConnected) {
      desligar();
      return;
    }
    fn(e, a);
  });
};
