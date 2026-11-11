import { describe, expect, it } from 'vitest';
import { caminho, lerRota, mesmaRota } from '../../src/app/rotas';

const catalogo = {
  placa: (id: string) => ['esp32-s3', 'uno-r3'].includes(id),
  lab: (placa: string, lab: string) => placa === 'uno-r3' && lab === 'uno-blink',
  inicial: 'esp32-s3',
};

describe('rotas', () => {
  it('sem hash abre a página inicial', () => {
    expect(lerRota('', catalogo)).toEqual({ pagina: 'placa', placa: 'esp32-s3', lab: null });
    expect(lerRota('#/', catalogo)).toEqual({ pagina: 'placa', placa: 'esp32-s3', lab: null });
  });

  it('a página inicial tem um caminho estável', () => {
    expect(caminho({ pagina: 'placa', placa: 'esp32-s3', lab: null })).toBe('#/esp32-s3');
  });

  it('lê catálogo, placa e laboratório', () => {
    expect(lerRota('#/placas', catalogo).pagina).toBe('catalogo');
    expect(lerRota('#/uno-r3', catalogo)).toEqual({ pagina: 'placa', placa: 'uno-r3', lab: null });
    expect(lerRota('#/uno-r3/uno-blink', catalogo)).toEqual({ pagina: 'lab', placa: 'uno-r3', lab: 'uno-blink' });
  });

  it('ignora entradas estranhas e volta ao catálogo', () => {
    expect(lerRota('#/<script>', catalogo).pagina).toBe('catalogo');
    expect(lerRota('#/nao-existe', catalogo).pagina).toBe('catalogo');
    expect(lerRota('#/uno-r3/xyz', catalogo)).toEqual({ pagina: 'placa', placa: 'uno-r3', lab: null });
  });

  it('compara rotas pelo conteúdo', () => {
    expect(mesmaRota({ pagina: 'placa', placa: 'a', lab: null }, { pagina: 'placa', placa: 'a', lab: null })).toBe(true);
    expect(mesmaRota({ pagina: 'placa', placa: 'a', lab: null }, { pagina: 'catalogo', placa: null, lab: null })).toBe(false);
  });
});
