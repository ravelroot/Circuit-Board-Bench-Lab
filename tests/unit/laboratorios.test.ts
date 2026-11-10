import { describe, expect, it } from 'vitest';
import { LABORATORIOS, labPorId, labsDaPlaca } from '../../src/dados/laboratorios';
import { PECAS, pecaPorId } from '../../src/dados/pecas';
import { placaPorId } from '../../src/dados/placas';

describe('laboratórios', () => {
  it('têm ids únicos e números únicos por placa', () => {
    expect(new Set(LABORATORIOS.map((l) => l.id)).size).toBe(LABORATORIOS.length);
    const chaves = LABORATORIOS.map((l) => `${l.placa}:${l.numero}`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it('a ESP32-S3 tem os nove labs do vídeo, em sete temas', () => {
    const labs = labsDaPlaca('esp32-s3');
    expect(labs).toHaveLength(9);
    expect(new Set(labs.map((l) => l.tema)).size).toBe(7);
    expect(labs.map((l) => l.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('usa todas as peças do catálogo da bancada', () => {
    const usadas = new Set(LABORATORIOS.flatMap((l) => l.pecas));
    for (const p of PECAS) expect(usadas.has(p.id), p.id).toBe(true);
  });

  for (const lab of LABORATORIOS) {
    it(`${lab.placa}/${lab.id} aponta para placa, tema, partes e peças que existem`, () => {
      const placa = placaPorId(lab.placa);
      expect(placa).toBeDefined();
      if (!placa) return;
      expect(placa.temas.some((t) => t.id === lab.tema)).toBe(true);
      for (const p of lab.partes) expect(placa.partes.some((x) => x.id === p), p).toBe(true);
      for (const p of lab.pecas) expect(pecaPorId(p), p).toBeDefined();
      expect(lab.como.length).toBeGreaterThanOrEqual(2);
      expect(lab.passos.length).toBeGreaterThanOrEqual(3);
      expect(lab.titulo.pt && lab.titulo.en).toBeTruthy();
      expect(labPorId(lab.id)).toBe(lab);
      if (lab.fiacao) {
        expect(lab.fiacao.ligacoes.length).toBeGreaterThan(0);
        for (const f of lab.fiacao.ligacoes) expect(f.de && f.para && f.nota.pt && f.nota.en).toBeTruthy();
      }
      if (lab.previa.tipo === 'serial') {
        expect(lab.previa.inicio.length).toBeGreaterThan(0);
        expect(new Set(lab.previa.comandos.map((c) => c.nome)).size).toBe(lab.previa.comandos.length);
      }
      if (lab.codigo) {
        expect(lab.codigo.texto).not.toMatch(/\/\/|\/\*|^\s*#(?!include)/m);
      }
    });
  }

  it('toda placa com tema tem pelo menos um lab nele', () => {
    for (const lab of LABORATORIOS) {
      const placa = placaPorId(lab.placa);
      for (const tema of placa?.temas ?? []) expect(LABORATORIOS.some((l) => l.placa === lab.placa && l.tema === tema.id), `${lab.placa}:${tema.id}`).toBe(true);
    }
  });
});
