import type { Componente, Especificacao, Forma, Ligacao, CorFio, Parte, Texto } from './tipos';

export const t = (pt: string, en: string): Texto => ({ pt, en });

export const c = (forma: Forma, x: number, y: number, l: number, a: number, z: number, parte?: string, rotulo?: string, cor?: string): Componente => ({
  forma,
  x,
  y,
  l,
  a,
  z,
  ...(parte ? { parte } : {}),
  ...(rotulo ? { rotulo } : {}),
  ...(cor ? { cor } : {}),
});

export const parte = (id: string, nome: Texto, oque: Texto, funcao: Texto): Parte => ({ id, nome, oque, funcao });

export const espec = (rotulo: Texto, valor: Texto | string): Especificacao => ({ rotulo, valor });

export const fio = (de: string, para: string, cor: CorFio, nota: Texto): Ligacao => ({ de, para, cor, nota });

export const ROTULOS = {
  processador: t('Processador', 'Processor'),
  memoria: t('Memória', 'Memory'),
  armazenamento: t('Armazenamento', 'Storage'),
  alimentacao: t('Alimentação', 'Power'),
  conexoes: t('Conexões', 'Connectivity'),
  tamanho: t('Tamanho', 'Size'),
  pinos: t('Pinos', 'Pins'),
  logica: t('Nível lógico', 'Logic level'),
  corrente: t('Corrente', 'Current'),
  tensao: t('Tensão', 'Voltage'),
  interface: t('Interface', 'Interface'),
  componente: t('Componente principal', 'Main part'),
} as const;
