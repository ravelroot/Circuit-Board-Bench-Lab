import { describe, expect, it } from 'vitest';
import { lerProgresso } from '../../src/app/estado';
import { alternar, faltando, pecasUsadas, resumirBancada, situacao } from '../../src/app/progresso';
import { caminho, lerRota } from '../../src/app/rotas';
import { labPorId, labsDaPlaca } from '../../src/dados/laboratorios';

const labs = labsDaPlaca('esp32-s3');
const rfid = labPorId('rfid-rc522');
const catalogo = { placa: (id: string) => ['esp32-s3', 'atx'].includes(id), lab: (p: string, l: string) => labPorId(l)?.placa === p, inicial: 'esp32-s3' };

describe('bancada', () => {
  it('classifica um lab pelo que falta', () => {
    if (!rfid) throw new Error('lab rfid ausente');
    expect(situacao(rfid, new Set(), new Set())).toBe('mais');
    expect(situacao(rfid, new Set(['rc522']), new Set())).toBe('uma');
    expect(situacao(rfid, new Set(['rc522', 'protoboard']), new Set())).toBe('pronto');
    expect(situacao(rfid, new Set(), new Set(['rfid-rc522']))).toBe('feito');
    expect(faltando(rfid, new Set(['protoboard']))).toEqual(['rc522']);
  });

  it('resume prontos, a uma peça e o resto', () => {
    const vazia = resumirBancada(labs, new Set(), new Set());
    expect(vazia.prontos.map((l) => l.id)).toEqual(['ola', 'led-rgb', 'botao-boot']);
    expect(vazia.umaPeca.map((x) => x.lab.id).sort()).toEqual(['radar-ble', 'wifi-scan']);
    expect(vazia.mais).toBe(4);
    const cheia = resumirBancada(labs, new Set(pecasUsadas(labs).map((u) => u.id)), new Set(['ola']));
    expect(cheia.prontos).toHaveLength(9);
    expect(cheia.feitos).toBe(1);
  });

  it('conta em quantos labs cada peça aparece', () => {
    const usos = pecasUsadas(labs);
    expect(usos[0]).toEqual({ id: 'protoboard', labs: 4 });
    expect(usos.every((u) => u.labs >= 1)).toBe(true);
  });

  it('alterna itens sem mutar a lista', () => {
    const base = ['a'];
    expect(alternar(base, 'b')).toEqual(['a', 'b']);
    expect(alternar(base, 'a')).toEqual([]);
    expect(base).toEqual(['a']);
  });
});

describe('progresso salvo', () => {
  const validar = { peca: (id: string) => id === 'rc522', lab: (id: string) => id === 'ola', passos: () => 4 };

  it('descarta ids desconhecidos, duplicados e passos fora do intervalo', () => {
    const lido = lerProgresso({ bancada: ['rc522', 'rc522', 'x', 3], feitos: ['ola', '<script>'], passos: { ola: [3, 1, 1, 9, -1, 'a'], intruso: [0] } }, validar);
    expect(lido.bancada).toEqual(['rc522']);
    expect(lido.feitos).toEqual(['ola']);
    expect(lido.passos).toEqual({ ola: [1, 3] });
  });

  it('aguenta lixo sem quebrar', () => {
    expect(lerProgresso({ bancada: 'x', passos: [1, 2] }, validar)).toEqual({ bancada: [], feitos: [], passos: {} });
  });
});

describe('rotas', () => {
  it('lê e escreve endereços', () => {
    expect(lerRota('', catalogo)).toEqual({ pagina: 'placa', placa: 'esp32-s3', lab: null });
    expect(lerRota('#/placas', catalogo).pagina).toBe('catalogo');
    expect(lerRota('#/atx', catalogo)).toEqual({ pagina: 'placa', placa: 'atx', lab: null });
    expect(lerRota('#/esp32-s3/rfid-rc522', catalogo)).toEqual({ pagina: 'lab', placa: 'esp32-s3', lab: 'rfid-rc522' });
    expect(lerRota('#/atx/rfid-rc522', catalogo)).toEqual({ pagina: 'placa', placa: 'atx', lab: null });
    expect(lerRota('#/nada', catalogo).pagina).toBe('catalogo');
    expect(lerRota('#/ESP32-S3/<img>', catalogo).placa).toBe('esp32-s3');
    expect(caminho({ pagina: 'lab', placa: 'esp32-s3', lab: 'ola' })).toBe('#/esp32-s3/ola');
    expect(caminho({ pagina: 'catalogo', placa: null, lab: null })).toBe('#/placas');
  });
});
