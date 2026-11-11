import { c } from '../base';
import type { Componente } from '../tipos';

export const PASSO = 2.54;

type Fila = 'barra' | 'femea' | 'furos';

const ALTURA: Record<Fila, number> = { barra: 2.6, femea: 8.5, furos: 0.1 };

export const fila = (forma: Fila, x: number, y: number, n: number, parteId: string, vertical = false, linhas = 1): Componente =>
  c(forma, x, y, vertical ? linhas * PASSO : n * PASSO, vertical ? n * PASSO : linhas * PASSO, ALTURA[forma], parteId);

export const furo = (x: number, y: number, d = 3): Componente => c('furos', x, y, d, d, 0.1);

export const repetir = (n: number, criar: (i: number) => Componente): Componente[] => Array.from({ length: n }, (_, i) => criar(i));
