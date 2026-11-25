import { describe, expect, it } from 'vitest';
import { arrumarBandeja, avancar, colocar, dentro, iniciarMontagem, passoAtual, pecasDoKit, pegar, relogio, soldadas, soldar } from '../../src/app/montagem';
import { PLACAS, placaPorId } from '../../src/dados/placas';
import { projetoDe } from '../../src/pcb/gerador';

const projeto = (id: string) => {
  const placa = placaPorId(id);
  if (!placa) throw new Error(id);
  return projetoDe(placa);
};

describe('montagem com solda', () => {
  it('todas as placas viram um kit com peças nomeadas, das mais baixas para as mais altas', () => {
    for (const placa of PLACAS) {
      const pecas = pecasDoKit(projetoDe(placa));
      expect(pecas.length, placa.id).toBeGreaterThan(0);
      for (let i = 1; i < pecas.length; i++) expect(pecas[i]!.altura).toBeGreaterThanOrEqual(pecas[i - 1]!.altura);
      for (const p of pecas) expect(placa.partes.some((x) => x.id === p.parte), `${placa.id}:${p.parte}`).toBe(true);
    }
  });

  it('segue pegar, colocar e soldar, na ordem, até a placa ficar pronta', () => {
    const pecas = pecasDoKit(projeto('pi4'));
    let m = iniciarMontagem(pecas);
    expect(passoAtual(m)).toMatchObject({ tipo: 'pegar', numero: 1, total: pecas.length });
    const segunda = pecas[1]!.parte;
    expect(pegar(m, segunda, 0)).toEqual({ ok: false, motivo: 'ordem' });
    const primeira = pecas[0]!.parte;
    const r1 = pegar(m, primeira, 10);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    m = r1.montagem;
    expect(m.inicio).toBe(10);
    expect(pegar(m, segunda, 11)).toEqual({ ok: false, motivo: 'ocupado' });
    expect(soldar(m, primeira, 12).ok).toBe(false);
    const r2 = colocar(m, primeira, 13);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(passoAtual(r2.montagem).tipo).toBe('soldar');
    const r3 = soldar(r2.montagem, primeira, 14);
    expect(r3.ok && soldadas(r3.montagem)).toBe(1);
  });

  it('no desafio aceita qualquer ordem e o avanço automático termina a placa', () => {
    const pecas = pecasDoKit(projeto('nodemcu'));
    const desafio = iniciarMontagem(pecas, true);
    expect(pegar(desafio, pecas[pecas.length - 1]!.parte, 0).ok).toBe(true);
    let m = iniciarMontagem(pecas);
    for (let i = 0; i < pecas.length * 3; i++) m = avancar(m, i + 1);
    expect(passoAtual(m).tipo).toBe('fim');
    expect(m.fim).toBe(pecas.length * 3);
    expect(avancar(m, 999)).toBe(m);
  });

  it('a bandeja não sobrepõe peças e o acerto respeita a folga', () => {
    const pecas = pecasDoKit(projeto('uno-r3'));
    const { vagas, largura, altura } = arrumarBandeja(pecas, 80);
    expect(vagas).toHaveLength(pecas.length);
    const caixas = vagas.map((v) => {
      const p = pecas.find((x) => x.parte === v.parte)!;
      return { x1: v.x - p.caixa.l / 2, x2: v.x + p.caixa.l / 2, y1: v.y - p.caixa.a / 2, y2: v.y + p.caixa.a / 2 };
    });
    for (const [i, a] of caixas.entries()) {
      expect(a.x1).toBeGreaterThanOrEqual(0);
      expect(a.x2).toBeLessThanOrEqual(largura);
      expect(a.y2).toBeLessThanOrEqual(altura);
      for (const b of caixas.slice(i + 1)) expect(a.x2 <= b.x1 || b.x2 <= a.x1 || a.y2 <= b.y1 || b.y2 <= a.y1).toBe(true);
    }
    const p = pecas[0]!;
    expect(dentro(p, p.caixa.x + p.caixa.l / 2, p.caixa.y + p.caixa.a / 2)).toBe(true);
    expect(dentro(p, p.caixa.x - 10, p.caixa.y)).toBe(false);
  });

  it('formata o cronômetro', () => {
    expect(relogio(0)).toBe('0:00');
    expect(relogio(65_400)).toBe('1:05');
  });
});
