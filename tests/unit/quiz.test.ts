import { describe, expect, it } from 'vitest';
import { gerarQuiz, pontuar, sorteio } from '../../src/app/quiz';
import { placaPorId, PLACAS } from '../../src/dados/placas';

describe('quiz', () => {
  it('gera perguntas únicas, com a resposta certa entre as opções', () => {
    const perguntas = gerarQuiz([], PLACAS, 10, sorteio(42));
    expect(perguntas).toHaveLength(10);
    expect(new Set(perguntas.map((q) => q.id)).size).toBe(10);
    for (const q of perguntas) {
      expect(q.opcoes.length).toBeGreaterThanOrEqual(2);
      expect(q.opcoes.length).toBeLessThanOrEqual(4);
      expect(q.certa).toBeGreaterThanOrEqual(0);
      expect(new Set(q.opcoes.map((o) => o.pt)).size).toBe(q.opcoes.length);
    }
  });

  it('é reproduzível com a mesma semente e foca numa placa', () => {
    const a = gerarQuiz([], PLACAS, 6, sorteio(7)).map((q) => q.id);
    const b = gerarQuiz([], PLACAS, 6, sorteio(7)).map((q) => q.id);
    expect(a).toEqual(b);
    const uno = placaPorId('uno-r3')!;
    expect(gerarQuiz([uno], PLACAS, 5, sorteio(3)).every((q) => q.placa === 'uno-r3')).toBe(true);
  });

  it('conta os acertos', () => {
    const perguntas = gerarQuiz([], PLACAS, 3, sorteio(9));
    expect(pontuar(perguntas, perguntas.map((q) => q.certa))).toBe(3);
    expect(pontuar(perguntas, [null, null, null])).toBe(0);
  });
});
