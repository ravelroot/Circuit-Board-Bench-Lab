import { describe, expect, it } from 'vitest';
import { PLACAS, placaPorId } from '../../src/dados/placas';
import { COR_MASCARA, nomeArquivo, projetoDe, semente } from '../../src/pcb/gerador';

const FOLGA = 1;

describe('gerador de projetos de PCB', () => {
  it('a semente é determinística por texto', () => {
    const a = semente('esp32-s3');
    const b = semente('esp32-s3');
    const c = semente('atx');
    const sa = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(sa);
    expect([c(), c(), c()]).not.toEqual(sa);
    for (const v of sa) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('gera o mesmo projeto para a mesma placa', () => {
    const placa = placaPorId('uno-r3');
    expect(placa).toBeDefined();
    if (!placa) return;
    expect(projetoDe(placa)).toBe(projetoDe(placa));
    expect(nomeArquivo(placa)).toBe('uno-r3.kicad_pcb');
  });

  for (const placa of PLACAS) {
    describe(placa.id, () => {
      const p = projetoDe(placa);
      const dentro = (x: number, y: number): boolean => x >= -FOLGA && y >= -FOLGA && x <= p.largura + FOLGA && y <= p.altura + FOLGA;

      it('usa a cor de máscara da placa e dimensões positivas', () => {
        expect(p.corMascara).toBe(COR_MASCARA[placa.desenho.cor]);
        expect(p.largura).toBeGreaterThan(0);
        expect(p.altura).toBeGreaterThan(0);
        expect(p.espessura).toBeGreaterThan(0);
      });

      it('tem referências únicas no padrão KiCad', () => {
        const refs = p.footprints.map((f) => f.ref);
        expect(new Set(refs).size).toBe(refs.length);
        for (const r of refs) expect(r).toMatch(/^[A-Z]+\d+$/);
        for (const f of p.footprints) expect(f.biblioteca).toMatch(/^[A-Za-z0-9_.-]+:[^\s:]+$/);
      });

      it('cada parte tem pelo menos um footprint', () => {
        const comFootprint = new Set(p.footprints.map((f) => f.parte).filter(Boolean));
        for (const parte of placa.partes) expect(comFootprint.has(parte.id), parte.id).toBe(true);
      });

      it('pads, matrizes, trilhas, vias e furos ficam dentro da placa', () => {
        for (const f of p.footprints) {
          for (const pad of f.pads) {
            expect(dentro(pad.x, pad.y), `${f.ref} pad ${pad.numero}`).toBe(true);
            expect(pad.l).toBeGreaterThan(0);
            expect(pad.a).toBeGreaterThan(0);
          }
          for (const m of f.matrizes) expect(dentro(m.x, m.y) && dentro(m.x + m.l, m.y + m.a), `${f.ref} matriz`).toBe(true);
        }
        for (const t of p.trilhas) {
          expect(t.pontos.length).toBeGreaterThanOrEqual(2);
          for (const [x, y] of t.pontos) expect(dentro(x, y)).toBe(true);
        }
        for (const v of p.vias) {
          expect(dentro(v.x, v.y)).toBe(true);
          expect(v.furo).toBeLessThan(v.d);
        }
        for (const f of p.furos) expect(dentro(f.x, f.y)).toBe(true);
      });

      it('trilhas seguem 0°, 45° ou 90°', () => {
        for (const t of p.trilhas) {
          t.pontos.slice(1).forEach(([x2, y2], i) => {
            const [x1, y1] = t.pontos[i] ?? [x2, y2];
            const dx = Math.abs(x2 - x1);
            const dy = Math.abs(y2 - y1);
            expect(dx < 1e-6 || dy < 1e-6 || Math.abs(dx - dy) < 1e-3).toBe(true);
          });
        }
      });
    });
  }
});
