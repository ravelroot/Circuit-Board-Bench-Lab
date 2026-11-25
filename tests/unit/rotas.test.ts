import { describe, expect, it } from 'vitest';
import { caminho, lerRota, mesmaRota } from '../../src/app/rotas';

const catalogo = {
  placa: (id: string) => ['esp32-s3', 'uno-r3'].includes(id),
  lab: (placa: string, lab: string) => placa === 'uno-r3' && lab === 'uno-blink',
  missao: (id: string) => id === 'ola-led',
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

  it('lê a bancada, o quiz, a comparação e a montagem', () => {
    expect(lerRota('#/bancada', catalogo)).toEqual({ pagina: 'bancada', placa: null, lab: null, extra: null });
    expect(lerRota('#/bancada/ola-led', catalogo)).toEqual({ pagina: 'bancada', placa: null, lab: null, extra: 'ola-led' });
    expect(lerRota('#/bancada/xyz', catalogo).extra).toBeNull();
    expect(lerRota('#/quiz/uno-r3', catalogo)).toEqual({ pagina: 'quiz', placa: 'uno-r3', lab: null });
    expect(lerRota('#/comparar/uno-r3/esp32-s3', catalogo)).toEqual({ pagina: 'comparar', placa: 'uno-r3', lab: null, extra: 'esp32-s3' });
    expect(lerRota('#/uno-r3/montar', catalogo)).toEqual({ pagina: 'montagem', placa: 'uno-r3', lab: null });
  });

  it('gera caminhos estáveis para as páginas novas', () => {
    for (const hash of ['#/bancada', '#/bancada/ola-led', '#/quiz', '#/quiz/uno-r3', '#/comparar/uno-r3/esp32-s3', '#/uno-r3/montar']) {
      expect(caminho(lerRota(hash, catalogo))).toBe(hash);
    }
    expect(mesmaRota({ pagina: 'bancada', placa: null, lab: null, extra: 'a' }, { pagina: 'bancada', placa: null, lab: null, extra: null })).toBe(false);
  });
});
