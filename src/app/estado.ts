import type { Idioma } from '../dados/tipos';
import { ehPaleta, PALETA_PADRAO, temaDoSistema, type Paleta, type Tema } from './aparencia';

export type { Paleta, Tema } from './aparencia';

export interface Rota {
  readonly pagina: 'catalogo' | 'placa' | 'lab';
  readonly placa: string | null;
  readonly lab: string | null;
}

export interface Estado {
  readonly idioma: Idioma;
  readonly tema: Tema;
  readonly paleta: Paleta;
  readonly rota: Rota;
  readonly bancada: readonly string[];
  readonly passos: Readonly<Record<string, readonly number[]>>;
  readonly feitos: readonly string[];
  readonly busca: boolean;
  readonly ajuda: boolean;
}

type Ouvinte = (estado: Estado, anterior: Estado) => void;

export interface Validador {
  readonly peca: (id: string) => boolean;
  readonly lab: (id: string) => boolean;
  readonly passos: (lab: string) => number;
}

const CHAVE_PREFERENCIAS = 'rumo:preferencias';
const CHAVE_PROGRESSO = 'rumo:progresso';

const ler = (chave: string): Record<string, unknown> => {
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return {};
    const dados: unknown = JSON.parse(bruto);
    return dados && typeof dados === 'object' && !Array.isArray(dados) ? (dados as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const gravar = (chave: string, valor: unknown): void => {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    return;
  }
};

const listaDeTextos = (v: unknown, valido: (s: string) => boolean): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length < 64 && valido(x)))] : [];

export const lerProgresso = (bruto: Record<string, unknown>, validar: Validador): Pick<Estado, 'bancada' | 'passos' | 'feitos'> => {
  const passos: Record<string, number[]> = {};
  const origem = bruto.passos;
  if (origem && typeof origem === 'object' && !Array.isArray(origem)) {
    for (const [lab, marcados] of Object.entries(origem as Record<string, unknown>)) {
      if (!validar.lab(lab) || !Array.isArray(marcados)) continue;
      const total = validar.passos(lab);
      const validos = [...new Set(marcados.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < total))].sort((a, b) => a - b);
      if (validos.length) passos[lab] = validos;
    }
  }
  return {
    bancada: listaDeTextos(bruto.bancada, validar.peca),
    feitos: listaDeTextos(bruto.feitos, validar.lab),
    passos,
  };
};

const idiomaDoNavegador = (): Idioma => (navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en');

export const criarEstado = (rota: Rota, validar: Validador): Estado => {
  const pref = ler(CHAVE_PREFERENCIAS);
  return {
    idioma: pref.idioma === 'pt' || pref.idioma === 'en' ? pref.idioma : idiomaDoNavegador(),
    tema: pref.tema === 'claro' || pref.tema === 'escuro' ? pref.tema : temaDoSistema(),
    paleta: ehPaleta(pref.paleta) ? pref.paleta : PALETA_PADRAO,
    rota,
    busca: false,
    ajuda: false,
    ...lerProgresso(ler(CHAVE_PROGRESSO), validar),
  };
};

export class Loja {
  private estado: Estado;
  private readonly ouvintes = new Set<Ouvinte>();

  constructor(inicial: Estado) {
    this.estado = inicial;
  }

  get atual(): Estado {
    return this.estado;
  }

  alterar(parcial: Partial<Estado>): void {
    const anterior = this.estado;
    const proximo = { ...anterior, ...parcial };
    const mudou = (Object.keys(parcial) as (keyof Estado)[]).some((k) => anterior[k] !== proximo[k]);
    if (!mudou) return;
    this.estado = proximo;
    if (anterior.idioma !== proximo.idioma || anterior.tema !== proximo.tema || anterior.paleta !== proximo.paleta) {
      gravar(CHAVE_PREFERENCIAS, { idioma: proximo.idioma, tema: proximo.tema, paleta: proximo.paleta });
    }
    if (anterior.bancada !== proximo.bancada || anterior.passos !== proximo.passos || anterior.feitos !== proximo.feitos) {
      gravar(CHAVE_PROGRESSO, { bancada: proximo.bancada, passos: proximo.passos, feitos: proximo.feitos });
    }
    for (const ouvinte of this.ouvintes) ouvinte(proximo, anterior);
  }

  assinar(ouvinte: Ouvinte): () => void {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }
}
