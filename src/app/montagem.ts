import type { Footprint, Modelo, ProjetoPcb, Retangulo } from '../pcb/modelo';

export type EstadoPeca = 'bandeja' | 'mao' | 'ponteada' | 'soldada';

export interface PecaKit {
  readonly parte: string;
  readonly indices: readonly number[];
  readonly altura: number;
  readonly caixa: Retangulo;
}

export interface Montagem {
  readonly pecas: readonly PecaKit[];
  readonly estados: Readonly<Record<string, EstadoPeca>>;
  readonly desafio: boolean;
  readonly dicas: number;
  readonly inicio: number | null;
  readonly fim: number | null;
}

export type Passo =
  | { readonly tipo: 'pegar' | 'colocar' | 'soldar'; readonly peca: PecaKit; readonly numero: number; readonly total: number }
  | { readonly tipo: 'fim'; readonly numero: number; readonly total: number };

export type Recusa = 'ordem' | 'ocupado' | 'estado';

export type Resultado = { readonly ok: true; readonly montagem: Montagem } | { readonly ok: false; readonly motivo: Recusa };

const FIXOS: ReadonlySet<Modelo> = new Set(['pads', 'texto', 'antena']);

const unir = (fps: readonly Footprint[]): Retangulo => {
  const x1 = Math.min(...fps.map((f) => f.corpo.x));
  const y1 = Math.min(...fps.map((f) => f.corpo.y));
  const x2 = Math.max(...fps.map((f) => f.corpo.x + f.corpo.l));
  const y2 = Math.max(...fps.map((f) => f.corpo.y + f.corpo.a));
  return { x: x1, y: y1, l: x2 - x1, a: y2 - y1 };
};

export const pecasDoKit = (projeto: ProjetoPcb): PecaKit[] => {
  const grupos = new Map<string, Footprint[]>();
  for (const f of projeto.footprints) {
    if (!f.parte || FIXOS.has(f.modelo)) continue;
    const lista = grupos.get(f.parte) ?? [];
    lista.push(f);
    grupos.set(f.parte, lista);
  }
  const ordem = projeto.placa.partes.map((p) => p.id);
  return [...grupos.entries()]
    .map(([parte, fps]) => ({ parte, indices: fps.map((f) => f.indice), altura: Math.max(...fps.map((f) => f.comp.z)), caixa: unir(fps) }))
    .sort((a, b) => a.altura - b.altura || a.caixa.l * a.caixa.a - b.caixa.l * b.caixa.a || ordem.indexOf(a.parte) - ordem.indexOf(b.parte));
};

export const iniciarMontagem = (pecas: readonly PecaKit[], desafio = false): Montagem => ({
  pecas,
  estados: Object.fromEntries(pecas.map((p) => [p.parte, 'bandeja' as EstadoPeca])),
  desafio,
  dicas: 0,
  inicio: null,
  fim: null,
});

export const soldadas = (m: Montagem): number => m.pecas.filter((p) => m.estados[p.parte] === 'soldada').length;

export const emAndamento = (m: Montagem): PecaKit | undefined => m.pecas.find((p) => m.estados[p.parte] === 'mao' || m.estados[p.parte] === 'ponteada');

export const proximaDaBandeja = (m: Montagem): PecaKit | undefined => m.pecas.find((p) => m.estados[p.parte] === 'bandeja');

export const passoAtual = (m: Montagem): Passo => {
  const total = m.pecas.length;
  const feitas = soldadas(m);
  const atual = emAndamento(m);
  if (atual) return { tipo: m.estados[atual.parte] === 'mao' ? 'colocar' : 'soldar', peca: atual, numero: feitas + 1, total };
  const proxima = proximaDaBandeja(m);
  return proxima ? { tipo: 'pegar', peca: proxima, numero: feitas + 1, total } : { tipo: 'fim', numero: total, total };
};

const mudar = (m: Montagem, parte: string, estado: EstadoPeca, agora: number): Montagem => {
  const estados = { ...m.estados, [parte]: estado };
  const completa = m.pecas.every((p) => estados[p.parte] === 'soldada');
  return { ...m, estados, inicio: m.inicio ?? agora, fim: completa ? agora : null };
};

export const pegar = (m: Montagem, parte: string, agora: number): Resultado => {
  if (m.estados[parte] !== 'bandeja') return { ok: false, motivo: 'estado' };
  if (emAndamento(m)) return { ok: false, motivo: 'ocupado' };
  if (!m.desafio && proximaDaBandeja(m)?.parte !== parte) return { ok: false, motivo: 'ordem' };
  return { ok: true, montagem: mudar(m, parte, 'mao', agora) };
};

export const colocar = (m: Montagem, parte: string, agora: number): Resultado =>
  m.estados[parte] === 'mao' ? { ok: true, montagem: mudar(m, parte, 'ponteada', agora) } : { ok: false, motivo: 'estado' };

export const soldar = (m: Montagem, parte: string, agora: number): Resultado =>
  m.estados[parte] === 'ponteada' ? { ok: true, montagem: mudar(m, parte, 'soldada', agora) } : { ok: false, motivo: 'estado' };

export const avancar = (m: Montagem, agora: number): Montagem => {
  const passo = passoAtual(m);
  if (passo.tipo === 'fim') return m;
  const acao = passo.tipo === 'pegar' ? pegar : passo.tipo === 'colocar' ? colocar : soldar;
  const r = acao({ ...m, desafio: true }, passo.peca.parte, agora);
  return r.ok ? { ...r.montagem, desafio: m.desafio } : m;
};

export const dentro = (peca: PecaKit, x: number, y: number, folga = 2.5): boolean =>
  x >= peca.caixa.x - folga && x <= peca.caixa.x + peca.caixa.l + folga && y >= peca.caixa.y - folga && y <= peca.caixa.y + peca.caixa.a + folga;

export const relogio = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export interface Vaga {
  readonly parte: string;
  readonly x: number;
  readonly y: number;
}

export const arrumarBandeja = (pecas: readonly PecaKit[], largura: number, folga = 5): { vagas: Vaga[]; largura: number; altura: number } => {
  const vagas: Vaga[] = [];
  const maior = Math.max(largura, ...pecas.map((p) => p.caixa.l + folga * 2));
  let x = folga;
  let y = folga;
  let linha = 0;
  for (const p of [...pecas].sort((a, b) => b.caixa.a - a.caixa.a)) {
    if (x + p.caixa.l + folga > maior && x > folga) {
      x = folga;
      y += linha + folga;
      linha = 0;
    }
    vagas.push({ parte: p.parte, x: x + p.caixa.l / 2, y: y + p.caixa.a / 2 });
    x += p.caixa.l + folga;
    linha = Math.max(linha, p.caixa.a);
  }
  return { vagas, largura: maior, altura: y + linha + folga };
};
