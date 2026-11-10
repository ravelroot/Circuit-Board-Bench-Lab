import type { Laboratorio } from '../dados/tipos';

export type Situacao = 'feito' | 'pronto' | 'uma' | 'mais';

export const faltando = (lab: Laboratorio, bancada: ReadonlySet<string>): string[] => lab.pecas.filter((p) => !bancada.has(p));

export const situacao = (lab: Laboratorio, bancada: ReadonlySet<string>, feitos: ReadonlySet<string>): Situacao => {
  if (feitos.has(lab.id)) return 'feito';
  const n = faltando(lab, bancada).length;
  if (n === 0) return 'pronto';
  return n === 1 ? 'uma' : 'mais';
};

export interface UsoPeca {
  readonly id: string;
  readonly labs: number;
}

export const pecasUsadas = (labs: readonly Laboratorio[]): UsoPeca[] => {
  const contagem = new Map<string, number>();
  for (const lab of labs) for (const p of lab.pecas) contagem.set(p, (contagem.get(p) ?? 0) + 1);
  return [...contagem.entries()].map(([id, n]) => ({ id, labs: n })).sort((a, b) => b.labs - a.labs || a.id.localeCompare(b.id));
};

export interface ResumoBancada {
  readonly prontos: readonly Laboratorio[];
  readonly umaPeca: readonly { readonly lab: Laboratorio; readonly peca: string }[];
  readonly mais: number;
  readonly feitos: number;
  readonly total: number;
}

export const resumirBancada = (labs: readonly Laboratorio[], bancada: ReadonlySet<string>, feitos: ReadonlySet<string>): ResumoBancada => {
  const prontos: Laboratorio[] = [];
  const umaPeca: { lab: Laboratorio; peca: string }[] = [];
  let mais = 0;
  let concluidos = 0;
  for (const lab of labs) {
    if (feitos.has(lab.id)) concluidos++;
    const falta = faltando(lab, bancada);
    if (falta.length === 0) prontos.push(lab);
    else if (falta.length === 1 && falta[0]) umaPeca.push({ lab, peca: falta[0] });
    else mais++;
  }
  return { prontos, umaPeca, mais, feitos: concluidos, total: labs.length };
};

export const alternar = <T>(lista: readonly T[], item: T): T[] => (lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item]);
