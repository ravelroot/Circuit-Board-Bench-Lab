import type { Rota } from './estado';

export interface Catalogo {
  readonly placa: (id: string) => boolean;
  readonly lab: (placa: string, lab: string) => boolean;
  readonly inicial: string;
}

const limpar = (parte: string | undefined): string => (parte ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48);

export const lerRota = (hash: string, catalogo: Catalogo): Rota => {
  const partes = decodeURIComponent(hash.replace(/^#\/?/, '')).split('/').map(limpar).filter(Boolean);
  const [primeira, segunda] = partes;
  if (!primeira) return { pagina: 'placa', placa: catalogo.inicial, lab: null };
  if (primeira === 'placas') return { pagina: 'catalogo', placa: null, lab: null };
  if (!catalogo.placa(primeira)) return { pagina: 'catalogo', placa: null, lab: null };
  if (segunda && catalogo.lab(primeira, segunda)) return { pagina: 'lab', placa: primeira, lab: segunda };
  return { pagina: 'placa', placa: primeira, lab: null };
};

export const caminho = (rota: Rota): string => {
  if (rota.pagina === 'catalogo' || !rota.placa) return '#/placas';
  if (rota.pagina === 'lab' && rota.lab) return `#/${rota.placa}/${rota.lab}`;
  return `#/${rota.placa}`;
};

export const mesmaRota = (a: Rota, b: Rota): boolean => a.pagina === b.pagina && a.placa === b.placa && a.lab === b.lab;
