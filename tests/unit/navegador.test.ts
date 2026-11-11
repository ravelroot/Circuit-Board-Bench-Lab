import { describe, expect, it } from 'vitest';
import { agruparPlacas, normalizar, secaoAtiva, vizinhas } from '../../src/app/navegador';
import { PLACAS } from '../../src/dados/placas';
import { ORDEM_CATEGORIAS } from '../../src/i18n/textos';

describe('navegador de placas', () => {
  it('normaliza acentos, caixa e espaços', () => {
    expect(normalizar('  Sensor  Ultrassônico ')).toBe('sensor ultrassonico');
    expect(normalizar('MÓDULO')).toBe('modulo');
  });

  it('sem filtro, agrupa todas as placas nas sete categorias, na ordem do catálogo', () => {
    const grupos = agruparPlacas(PLACAS, ORDEM_CATEGORIAS);
    expect(grupos.map((g) => g.categoria)).toEqual([...ORDEM_CATEGORIAS]);
    expect(grupos.reduce((soma, g) => soma + g.placas.length, 0)).toBe(PLACAS.length);
    expect(grupos[0]?.placas[0]?.id).toBe('esp32-s3');
  });

  it('filtra por nome, sigla ou id, sem ligar para acentos, e esconde grupos vazios', () => {
    const jetson = agruparPlacas(PLACAS, ORDEM_CATEGORIAS, 'JETSON');
    expect(jetson).toHaveLength(1);
    expect(jetson[0]?.categoria).toBe('computador');
    expect(jetson[0]?.placas.map((p) => p.id)).toEqual(['jetson-nano']);
    expect(agruparPlacas(PLACAS, ORDEM_CATEGORIAS, 'ultrassonico')[0]?.placas.map((p) => p.id)).toContain('hcsr04');
    expect(agruparPlacas(PLACAS, ORDEM_CATEGORIAS, 'nada-disso-existe')).toEqual([]);
  });

  it('acha as vizinhas dando a volta na lista', () => {
    const lista = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(vizinhas(lista, 'b')).toEqual({ anterior: { id: 'a' }, proxima: { id: 'c' } });
    expect(vizinhas(lista, 'a').anterior).toEqual({ id: 'c' });
    expect(vizinhas(lista, 'c').proxima).toEqual({ id: 'a' });
    expect(vizinhas(lista, 'x')).toEqual({ anterior: undefined, proxima: undefined });
    expect(vizinhas([{ id: 'a' }], 'a')).toEqual({ anterior: undefined, proxima: undefined });
  });

  it('marca a última seção que já passou do limite, ou a última no fim da página', () => {
    expect(secaoAtiva([60, 500, 1200], 180)).toBe(0);
    expect(secaoAtiva([-400, 120, 900], 180)).toBe(1);
    expect(secaoAtiva([-900, -300, 400], 180, true)).toBe(2);
    expect(secaoAtiva([], 180)).toBe(-1);
  });
});
