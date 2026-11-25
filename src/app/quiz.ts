import { placaBancada } from '../dados/bancada3d';
import type { Categoria, Placa, Texto } from '../dados/tipos';

export interface Pergunta {
  readonly id: string;
  readonly placa: string;
  readonly enunciado: Texto;
  readonly opcoes: readonly Texto[];
  readonly certa: number;
  readonly explicacao: Texto;
}

export type Sorteio = () => number;

export const sorteio = (semente: number): Sorteio => {
  let s = semente >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
};

const embaralhar = <T>(lista: readonly T[], r: Sorteio): T[] => {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
  }
  return copia;
};

const t = (pt: string, en: string): Texto => ({ pt, en });

const NOMES_CATEGORIA: Record<Categoria, Texto> = {
  microcontrolador: t('Microcontrolador', 'Microcontroller'),
  computador: t('Computador de placa única', 'Single-board computer'),
  pc: t('Hardware de PC', 'PC hardware'),
  modulo: t('Módulo', 'Module'),
  sensor: t('Sensor', 'Sensor'),
  energia: t('Energia', 'Power'),
  circuito: t('Circuito de bancada', 'Bench circuit'),
};

const montar = (id: string, placa: string, enunciado: Texto, certa: Texto, erradas: readonly Texto[], explicacao: Texto, r: Sorteio): Pergunta | null => {
  const unicas = erradas.filter((e, i) => e.pt !== certa.pt && erradas.findIndex((x) => x.pt === e.pt) === i).slice(0, 3);
  if (unicas.length < 1) return null;
  const opcoes = embaralhar([certa, ...unicas], r);
  return { id, placa, enunciado, opcoes, certa: opcoes.findIndex((o) => o.pt === certa.pt), explicacao };
};

type Gerador = (p: Placa, todas: readonly Placa[], r: Sorteio) => Pergunta | null;

const outrasPartes = (p: Placa, todas: readonly Placa[], r: Sorteio): Placa['partes'][number][] =>
  embaralhar(todas.filter((x) => x.id !== p.id).flatMap((x) => x.partes), r).slice(0, 12);

const GERADORES: readonly Gerador[] = [
  (p, todas, r) => {
    const parte = embaralhar(p.partes, r)[0];
    if (!parte) return null;
    return montar(
      `funcao:${p.id}:${parte.id}`,
      p.id,
      t(`Para que serve a parte "${parte.nome.pt}" (${p.nome})?`, `What is the "${parte.nome.en}" for (${p.nome})?`),
      parte.funcao,
      outrasPartes(p, todas, r).map((x) => x.funcao),
      t(`${parte.nome.pt}: ${parte.oque.pt}`, `${parte.nome.en}: ${parte.oque.en}`),
      r,
    );
  },
  (p, todas, r) => {
    const parte = embaralhar(p.partes, r)[0];
    if (!parte) return null;
    return montar(
      `oque:${p.id}:${parte.id}`,
      p.id,
      t(`O que é a parte "${parte.nome.pt}" (${p.nome})?`, `What is the "${parte.nome.en}" (${p.nome})?`),
      parte.oque,
      outrasPartes(p, todas, r).map((x) => x.oque),
      parte.funcao,
      r,
    );
  },
  (p, _todas, r) => {
    const erradas = embaralhar((Object.keys(NOMES_CATEGORIA) as Categoria[]).filter((c) => c !== p.categoria), r).map((c) => NOMES_CATEGORIA[c]);
    return montar(
      `categoria:${p.id}`,
      p.id,
      t(`Em que categoria do Rumo está "${p.nome}"?`, `Which Rumo category is "${p.nome}" in?`),
      NOMES_CATEGORIA[p.categoria],
      erradas,
      p.resumo,
      r,
    );
  },
  (p, todas, r) => {
    const outras = embaralhar(todas.filter((x) => x.categoria !== p.categoria), r).slice(0, 3);
    return montar(
      `resumo:${p.id}`,
      p.id,
      t(`Qual placa combina com esta descrição? "${p.resumo.pt}"`, `Which board matches this description? "${p.resumo.en}"`),
      t(p.nome, p.nome),
      outras.map((x) => t(x.nome, x.nome)),
      p.usos,
      r,
    );
  },
  (p, _todas, r) => {
    const pb = placaBancada(p.id);
    if (!pb) return null;
    const certa = pb.logica === '5 V' ? t('5 V', '5 V') : t('3,3 V', '3.3 V');
    return montar(
      `logica:${p.id}`,
      p.id,
      t(`Qual é o nível lógico dos pinos de "${p.nome}"?`, `What logic level do the pins of "${p.nome}" use?`),
      certa,
      [t('5 V', '5 V'), t('3,3 V', '3.3 V'), t('12 V', '12 V'), t('1,8 V', '1.8 V')],
      pb.logica === '5 V' ? t('Ela trabalha com 5 V nos pinos: cuidado ao ligar módulos de 3,3 V.', 'It uses 5 V on its pins: take care with 3.3 V modules.') : t('Os pinos trabalham com 3,3 V: 5 V direto num pino pode queimar o chip.', 'Its pins run at 3.3 V: 5 V straight into a pin can damage the chip.'),
      r,
    );
  },
];

export const gerarQuiz = (placas: readonly Placa[], todas: readonly Placa[], n: number, r: Sorteio): Pergunta[] => {
  const perguntas: Pergunta[] = [];
  const usadas = new Set<string>();
  const fontes = placas.length ? placas : todas;
  let tentativas = 0;
  while (perguntas.length < n && tentativas < n * 20) {
    tentativas += 1;
    const placa = fontes[Math.floor(r() * fontes.length)];
    const gerador = GERADORES[Math.floor(r() * GERADORES.length)];
    if (!placa || !gerador) continue;
    const q = gerador(placa, todas, r);
    if (!q || usadas.has(q.id)) continue;
    usadas.add(q.id);
    perguntas.push(q);
  }
  return perguntas;
};

export const pontuar = (perguntas: readonly Pergunta[], respostas: readonly (number | null)[]): number => perguntas.reduce((s, q, i) => s + (respostas[i] === q.certa ? 1 : 0), 0);
