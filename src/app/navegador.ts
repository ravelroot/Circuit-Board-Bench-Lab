import type { Categoria, Placa } from '../dados/tipos';

export interface GrupoPlacas {
  readonly categoria: Categoria;
  readonly placas: readonly Placa[];
}

export interface Vizinhas<T> {
  readonly anterior: T | undefined;
  readonly proxima: T | undefined;
}

export const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const agruparPlacas = (placas: readonly Placa[], ordem: readonly Categoria[], termo = ''): GrupoPlacas[] => {
  const alvo = normalizar(termo);
  const passa = (p: Placa): boolean => alvo === '' || normalizar(`${p.nome} ${p.sigla} ${p.id}`).includes(alvo);
  return ordem
    .map((categoria) => ({ categoria, placas: placas.filter((p) => p.categoria === categoria && passa(p)) }))
    .filter((g) => g.placas.length > 0 || alvo === '');
};

export const vizinhas = <T extends { readonly id: string }>(lista: readonly T[], id: string | null | undefined): Vizinhas<T> => {
  const i = lista.findIndex((x) => x.id === id);
  if (i < 0 || lista.length < 2) return { anterior: undefined, proxima: undefined };
  return { anterior: lista[(i - 1 + lista.length) % lista.length], proxima: lista[(i + 1) % lista.length] };
};

export const secaoAtiva = (topos: readonly number[], limite: number, noFim = false): number => {
  if (topos.length === 0) return -1;
  if (noFim) return topos.length - 1;
  let ativa = 0;
  topos.forEach((topo, i) => {
    if (topo <= limite) ativa = i;
  });
  return ativa;
};
