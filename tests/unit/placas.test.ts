import { describe, expect, it } from 'vitest';
import { PLACA_INICIAL, PLACAS, placaPorId } from '../../src/dados/placas';
import { ORDEM_CATEGORIAS } from '../../src/i18n/textos';
import type { Texto } from '../../src/dados/tipos';

const bilingue = (t: Texto | string): boolean => (typeof t === 'string' ? t.trim().length > 0 : t.pt.trim().length > 0 && t.en.trim().length > 0);

describe('catálogo de placas', () => {
  it('tem pelo menos 132 placas e circuitos com ids únicos', () => {
    expect(PLACAS.length).toBeGreaterThanOrEqual(132);
    expect(new Set(PLACAS.map((p) => p.id)).size).toBe(PLACAS.length);
  });

  it('cobre as sete categorias', () => {
    const categorias = new Set(PLACAS.map((p) => p.categoria));
    expect([...categorias].sort()).toEqual(['circuito', 'computador', 'energia', 'microcontrolador', 'modulo', 'pc', 'sensor']);
  });

  it('mostra no catálogo todas as categorias usadas, cada uma com pelo menos dez placas', () => {
    for (const cat of new Set(PLACAS.map((p) => p.categoria))) expect(ORDEM_CATEGORIAS).toContain(cat);
    for (const cat of ORDEM_CATEGORIAS) expect(PLACAS.filter((p) => p.categoria === cat).length, cat).toBeGreaterThanOrEqual(10);
  });

  it('começa pela ESP32-S3, que é a página inicial', () => {
    expect(PLACA_INICIAL).toBe('esp32-s3');
    expect(PLACAS[0]?.id).toBe(PLACA_INICIAL);
  });

  it('usa ids seguros para a rota', () => {
    for (const p of PLACAS) expect(p.id).toMatch(/^[a-z0-9-]{2,48}$/);
  });

  it('acha placas pelo id', () => {
    expect(placaPorId('esp32-s3')?.nome).toBe('ESP32-S3 DevKitC-1');
    expect(placaPorId('atx')?.categoria).toBe('pc');
    expect(placaPorId('inexistente')).toBeUndefined();
    expect(placaPorId(null)).toBeUndefined();
  });

  for (const placa of PLACAS) {
    describe(placa.nome, () => {
      it('tem textos nas duas línguas', () => {
        expect(bilingue(placa.resumo)).toBe(true);
        expect(bilingue(placa.usos)).toBe(true);
        expect(bilingue(placa.essenciais)).toBe(true);
        expect(placa.especificacoes.length).toBeGreaterThanOrEqual(4);
        for (const e of placa.especificacoes) expect(bilingue(e.rotulo) && bilingue(e.valor)).toBe(true);
      });

      it('identifica cada parte: o que é e para que serve', () => {
        expect(placa.partes.length).toBeGreaterThanOrEqual(4);
        expect(new Set(placa.partes.map((p) => p.id)).size).toBe(placa.partes.length);
        for (const p of placa.partes) {
          expect(bilingue(p.nome)).toBe(true);
          expect(bilingue(p.oque)).toBe(true);
          expect(bilingue(p.funcao)).toBe(true);
        }
      });

      it('desenha toda parte no modelo 3D e só partes conhecidas', () => {
        const ids = new Set(placa.partes.map((p) => p.id));
        const desenhadas = new Set(placa.desenho.componentes.flatMap((c) => (c.parte ? [c.parte] : [])));
        for (const d of desenhadas) expect(ids.has(d), `${placa.id}: ${d}`).toBe(true);
        for (const p of ids) expect(desenhadas.has(p), `${placa.id}: ${p} sem desenho`).toBe(true);
      });

      it('mantém os componentes perto da placa e com medidas válidas', () => {
        const { largura, altura, componentes } = placa.desenho;
        for (const c of componentes) {
          expect(c.l).toBeGreaterThan(0);
          expect(c.a).toBeGreaterThan(0);
          expect(c.z).toBeGreaterThanOrEqual(0);
          expect(c.x).toBeGreaterThanOrEqual(-largura * 0.1);
          expect(c.y).toBeGreaterThanOrEqual(-altura * 0.1);
          expect(c.x + c.l).toBeLessThanOrEqual(largura * 1.1);
          expect(c.y + c.a).toBeLessThanOrEqual(altura * 1.1);
        }
      });
    });
  }
});
