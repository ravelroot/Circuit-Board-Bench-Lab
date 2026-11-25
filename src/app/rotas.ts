import type { Rota } from './estado';

export interface Catalogo {
  readonly placa: (id: string) => boolean;
  readonly lab: (placa: string, lab: string) => boolean;
  readonly missao?: (id: string) => boolean;
  readonly inicial: string;
}

const limpar = (parte: string | undefined): string => (parte ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48);

export const lerRota = (hash: string, catalogo: Catalogo): Rota => {
  const partes = decodeURIComponent(hash.replace(/^#\/?/, '')).split('/').map(limpar).filter(Boolean);
  const [primeira, segunda, terceira] = partes;
  if (!primeira) return { pagina: 'placa', placa: catalogo.inicial, lab: null };
  if (primeira === 'placas') return { pagina: 'catalogo', placa: null, lab: null };
  if (primeira === 'bancada') return { pagina: 'bancada', placa: null, lab: null, extra: segunda && catalogo.missao?.(segunda) ? segunda : null };
  if (primeira === 'quiz') return { pagina: 'quiz', placa: segunda && catalogo.placa(segunda) ? segunda : null, lab: null };
  if (primeira === 'comparar') {
    return { pagina: 'comparar', placa: segunda && catalogo.placa(segunda) ? segunda : null, lab: null, extra: terceira && catalogo.placa(terceira) ? terceira : null };
  }
  if (!catalogo.placa(primeira)) return { pagina: 'catalogo', placa: null, lab: null };
  if (segunda === 'montar') return { pagina: 'montagem', placa: primeira, lab: null };
  if (segunda && catalogo.lab(primeira, segunda)) return { pagina: 'lab', placa: primeira, lab: segunda };
  return { pagina: 'placa', placa: primeira, lab: null };
};

export const caminho = (rota: Rota): string => {
  switch (rota.pagina) {
    case 'bancada':
      return rota.extra ? `#/bancada/${rota.extra}` : '#/bancada';
    case 'quiz':
      return rota.placa ? `#/quiz/${rota.placa}` : '#/quiz';
    case 'comparar':
      return rota.placa && rota.extra ? `#/comparar/${rota.placa}/${rota.extra}` : rota.placa ? `#/comparar/${rota.placa}` : '#/comparar';
    case 'montagem':
      return rota.placa ? `#/${rota.placa}/montar` : '#/placas';
    case 'lab':
      return rota.placa && rota.lab ? `#/${rota.placa}/${rota.lab}` : rota.placa ? `#/${rota.placa}` : '#/placas';
    case 'placa':
      return rota.placa ? `#/${rota.placa}` : '#/placas';
    default:
      return '#/placas';
  }
};

export const mesmaRota = (a: Rota, b: Rota): boolean => a.pagina === b.pagina && a.placa === b.placa && a.lab === b.lab && (a.extra ?? null) === (b.extra ?? null);
