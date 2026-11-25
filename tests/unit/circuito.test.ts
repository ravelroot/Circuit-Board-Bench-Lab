import { describe, expect, it } from 'vitest';
import { capacidades, corAutomatica, descricaoPino, estadoModulo, lerBancada, posicaoLivre, programaDe, PROGRAMAS, verificarMissao, type Bancada, type Catalogo3d } from '../../src/app/circuito';
import { nomeBase, pinosDaPlaca, pinosDoModulo } from '../../src/app/pinagem';
import { MISSOES, moduloPorTipo, MODULOS, placaBancada, PLACAS_BANCADA } from '../../src/dados/bancada3d';
import { placaPorId } from '../../src/dados/placas';
import { projetoDe } from '../../src/pcb/gerador';

const catalogo: Catalogo3d = {
  placa: (id) => placaBancada(id),
  modulo: (tipo) => moduloPorTipo(tipo),
  pinos: (item) => (item.tipo === 'placa' ? pinosDaPlaca(placaBancada(item.ref)!).map((p) => p.chave) : pinosDoModulo(moduloPorTipo(item.ref)!)),
};

describe('pinagem das placas da bancada', () => {
  it('cada cabeçalho nomeado tem o mesmo número de pinos do PCB', () => {
    for (const pb of PLACAS_BANCADA) {
      const placa = placaPorId(pb.id);
      expect(placa, pb.id).toBeDefined();
      const cabecalhos = projetoDe(placa!).footprints.filter((f) => f.modelo === 'barra' || f.modelo === 'femea' || (f.modelo === 'pads' && f.parte === 'pinos'));
      expect(cabecalhos.length, pb.id).toBe(pb.cabecalhos.length);
      pb.cabecalhos.forEach((nomes, i) => {
        if (nomes) expect(nomes.length, `${pb.id}#${i}`).toBe(cabecalhos[i]!.pads.length);
      });
      const chaves = pinosDaPlaca(pb).map((p) => p.chave);
      expect(new Set(chaves).size).toBe(chaves.length);
      expect(chaves.some((c) => nomeBase(c) === 'GND')).toBe(true);
    }
  });

  it('reconhece terra, alimentação, PWM, analógicos e I²C', () => {
    expect([...capacidades('arduino', 'GND')]).toEqual(['gnd']);
    expect(capacidades('arduino', 'D9').has('pwm')).toBe(true);
    expect(capacidades('arduino', 'D8').has('pwm')).toBe(false);
    expect(capacidades('arduino', 'A4').has('sda')).toBe(true);
    expect(capacidades('esp32', 'GPIO34').has('digital')).toBe(false);
    expect(capacidades('pi', 'GPIO2').has('sda')).toBe(true);
    expect(descricaoPino('arduino', 'D13', 'pt')).toContain('LED L');
    expect(descricaoPino('arduino', 'GND', 'en')).toContain('ground');
  });

  it('pinta os fios pela função do pino', () => {
    expect(corAutomatica(new Set(['gnd']), new Set(['digital']), 0)).toBe('preto');
    expect(corAutomatica(new Set(['v5']), new Set(['digital']), 0)).toBe('vermelho');
    expect(corAutomatica(new Set(['digital']), new Set(['digital']), 1)).toBe('verde');
  });
});

describe('missões', () => {
  it('cada ligação aponta para um pino que existe no Uno e para um módulo do catálogo', () => {
    const uno = pinosDaPlaca(placaBancada('uno-r3')!).map((p) => p.nome);
    for (const m of MISSOES) {
      expect(programaDe(m.id), m.id).toBe(PROGRAMAS[m.id]);
      for (const l of m.ligacoes) {
        expect(uno.includes(l.alvo), `${m.id}:${l.alvo}`).toBe(true);
        expect(moduloPorTipo(l.modulo)?.pinos.some((p) => p.nome === l.pino), `${m.id}:${l.modulo}.${l.pino}`).toBe(true);
      }
    }
  });

  it('confere as ligações do Olá, LED, aceitando qualquer GND', () => {
    const missao = MISSOES.find((m) => m.id === 'ola-led')!;
    const base: Bancada = {
      itens: [
        { id: 'u', tipo: 'placa', ref: 'uno-r3', x: 0, y: 0, rot: 0 },
        { id: 'l', tipo: 'modulo', ref: 'led', x: 50, y: -50, rot: 0 },
      ],
      fios: [{ id: 'f1', a: { item: 'l', pino: 'SIG' }, b: { item: 'u', pino: 'D13' }, cor: 'amarelo' }],
    };
    expect(verificarMissao(missao, base, catalogo)).toMatchObject({ ok: false, faltam: 1 });
    const completa: Bancada = { ...base, fios: [...base.fios, { id: 'f2', a: { item: 'u', pino: 'GND·2' }, b: { item: 'l', pino: 'GND' }, cor: 'preto' }] };
    expect(verificarMissao(missao, completa, catalogo)).toMatchObject({ ok: true, faltam: 0 });
    expect(estadoModulo(completa, completa.itens[1]!, catalogo)).toEqual({ ligado: true, faltam: [] });
  });

  it('roda os programas com saídas e linhas de Serial', () => {
    const e = { botao: true, pot: 1023, luz: 100, distancia: 30, temperatura: 25, umidade: 50 };
    expect(PROGRAMAS['ola-led']!.passo(0, e, new Set(), {})).toMatchObject({ saidas: { led: 1, placaLed: true }, serial: 'D13 HIGH - LED aceso' });
    expect(PROGRAMAS.dimmer!.passo(0, e, new Set(), {}).saidas.led).toBe(1);
    expect(PROGRAMAS['luz-noturna']!.passo(0, e, new Set(), {}).saidas.led).toBe(1);
    const mem = {};
    expect(PROGRAMAS['botao-led']!.passo(0, e, new Set(), mem).serial).toBe('apertado');
    expect(PROGRAMAS['botao-led']!.passo(1, e, new Set(), mem).serial).toBeNull();
    const servo = [0, 45, 90, 135].map((i) => PROGRAMAS.servo!.passo(i, e, new Set(), {}).saidas.servo!);
    for (const a of servo) expect(a).toBeGreaterThanOrEqual(0);
    for (const a of servo) expect(a).toBeLessThanOrEqual(180);
    expect(PROGRAMAS.livre!.passo(0, e, new Set(['pot']), {}).serial).toContain('pot=1023');
  });
});

describe('estado salvo da bancada', () => {
  it('descarta itens, pinos e cores inválidos', () => {
    const lido = lerBancada(
      {
        itens: [
          { id: 'u', tipo: 'placa', ref: 'uno-r3', x: 9999, y: 0, rot: 1 },
          { id: 'x', tipo: 'placa', ref: 'nao-existe', x: 0, y: 0, rot: 0 },
          { id: '<b>', tipo: 'modulo', ref: 'led', x: 0, y: 0, rot: 0 },
          { id: 'l', tipo: 'modulo', ref: 'led', x: 10, y: 10, rot: 7 },
        ],
        fios: [
          { id: 'f1', a: { item: 'l', pino: 'SIG' }, b: { item: 'u', pino: 'D13' }, cor: 'url(javascript:1)' },
          { id: 'f2', a: { item: 'l', pino: 'XYZ' }, b: { item: 'u', pino: 'D13' }, cor: 'preto' },
          { id: 'f3', a: { item: 'u', pino: 'D13' }, b: { item: 'u', pino: 'D13' }, cor: 'preto' },
        ],
      },
      catalogo,
    );
    expect(lido.itens.map((i) => i.id)).toEqual(['u', 'l']);
    expect(lido.itens[0]!.x).toBe(250);
    expect(lido.itens[1]!.rot).toBe(0);
    expect(lido.fios).toEqual([{ id: 'f1', a: { item: 'l', pino: 'SIG' }, b: { item: 'u', pino: 'D13' }, cor: 'amarelo' }]);
    expect(lerBancada('lixo', catalogo)).toEqual({ itens: [], fios: [] });
  });

  it('acha um lugar livre na bancada', () => {
    const p = posicaoLivre([{ x: 0, y: 0 }]);
    expect(Math.hypot(p.x, p.y)).toBeGreaterThan(40);
    expect(MODULOS.length).toBe(11);
  });
});
