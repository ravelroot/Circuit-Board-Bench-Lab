import type { LigacaoMissao, Missao, ModuloBancada, PlacaBancada, Requisito, TipoModulo } from '../dados/bancada3d';
import { nomeBase } from './pinagem';

export type Familia = PlacaBancada['familia'];

export type Capacidade = 'gnd' | 'v5' | 'v33' | 'vin' | 'digital' | 'pwm' | 'analogico' | 'sda' | 'scl' | 'outro';

const numero = (nome: string, prefixo: RegExp): number | null => {
  const m = prefixo.exec(nome);
  return m?.[1] !== undefined ? Number(m[1]) : null;
};

const PWM_UNO = new Set([3, 5, 6, 9, 10, 11]);
const ADC_ESP32 = new Set([0, 2, 4, 12, 13, 14, 15, 25, 26, 27, 32, 33, 34, 35, 36, 39]);
const PWM_STM = new Set(['PA0', 'PA1', 'PA2', 'PA3', 'PA6', 'PA7', 'PA8', 'PA9', 'PA10', 'PB0', 'PB1', 'PB6', 'PB7', 'PB8', 'PB9']);

export const capacidades = (familia: Familia, nome: string): ReadonlySet<Capacidade> => {
  const c = new Set<Capacidade>();
  if (/^(A?GND)$/.test(nome)) c.add('gnd');
  else if (/^(5V|VBUS|VSYS)$/.test(nome)) c.add('v5');
  else if (/^3V3$/.test(nome)) c.add('v33');
  else if (nome === 'VIN') c.add('vin');
  if (c.size) return c;
  if (nome === 'SDA') c.add('sda');
  if (nome === 'SCL') c.add('scl');
  switch (familia) {
    case 'arduino': {
      const d = numero(nome, /^D(\d+)$/);
      const a = numero(nome, /^A(\d+)$/);
      if (d !== null) {
        c.add('digital');
        if (PWM_UNO.has(d) || (d >= 44 && d <= 46)) c.add('pwm');
        if (d === 20) c.add('sda');
        if (d === 21) c.add('scl');
      }
      if (a !== null) {
        c.add('analogico');
        if (a < 6) c.add('digital');
        if (a === 4) c.add('sda');
        if (a === 5) c.add('scl');
      }
      break;
    }
    case 'esp32': {
      const g = numero(nome, /^GPIO(\d+)$/);
      if (g !== null) {
        if (g < 34) c.add('digital').add('pwm');
        if (ADC_ESP32.has(g)) c.add('analogico');
        if (g === 21) c.add('sda');
        if (g === 22) c.add('scl');
      }
      if (nome === 'VP' || nome === 'VN') c.add('analogico');
      break;
    }
    case 'esp8266': {
      const d = numero(nome, /^D(\d+)$/);
      if (d !== null) {
        c.add('digital');
        if (d > 0) c.add('pwm');
        if (d === 2) c.add('sda');
        if (d === 1) c.add('scl');
      }
      if (nome === 'A0') c.add('analogico');
      break;
    }
    case 'rp2040': {
      const g = numero(nome, /^GP(\d+)$/);
      if (g !== null) {
        c.add('digital').add('pwm');
        if (g >= 26) c.add('analogico');
        if (g === 4) c.add('sda');
        if (g === 5) c.add('scl');
      }
      break;
    }
    case 'stm32': {
      if (/^P[ABC]\d+$/.test(nome)) {
        c.add('digital');
        if (PWM_STM.has(nome)) c.add('pwm');
        if (/^PA[0-7]$|^PB[01]$/.test(nome)) c.add('analogico');
        if (nome === 'PB7') c.add('sda');
        if (nome === 'PB6') c.add('scl');
      }
      break;
    }
    case 'pi': {
      const g = numero(nome, /^GPIO(\d+)$/);
      if (g !== null) {
        c.add('digital');
        if ([12, 13, 18, 19].includes(g)) c.add('pwm');
        if (g === 2) c.add('sda');
        if (g === 3) c.add('scl');
      }
      break;
    }
  }
  if (!c.size) c.add('outro');
  return c;
};

const EXTRAS: Readonly<Record<string, string>> = {
  'arduino:D0': 'UART RX',
  'arduino:D1': 'UART TX',
  'arduino:D11': 'SPI MOSI',
  'arduino:D12': 'SPI MISO',
  'arduino:D13': 'SPI SCK · LED L',
  'esp32:GPIO2': 'LED',
  'esp32:GPIO23': 'SPI MOSI',
  'esp32:GPIO19': 'SPI MISO',
  'esp32:GPIO18': 'SPI SCK',
  'esp8266:D4': 'LED',
  'stm32:PC13': 'LED',
  'pi:GPIO14': 'UART TX',
  'pi:GPIO15': 'UART RX',
};

export const descricaoPino = (familia: Familia, nome: string, idioma: 'pt' | 'en'): string => {
  const c = capacidades(familia, nome);
  const pt = idioma === 'pt';
  const partes: string[] = [];
  if (c.has('gnd')) partes.push(pt ? 'terra (0 V)' : 'ground (0 V)');
  if (c.has('v5')) partes.push(pt ? 'alimentação de 5 V' : '5 V power');
  if (c.has('v33')) partes.push(pt ? 'alimentação de 3,3 V' : '3.3 V power');
  if (c.has('vin')) partes.push(pt ? 'entrada de 7 a 12 V' : '7 to 12 V input');
  if (c.has('digital')) partes.push(pt ? 'E/S digital' : 'digital I/O');
  if (c.has('pwm')) partes.push('PWM');
  if (c.has('analogico')) partes.push(pt ? 'entrada analógica' : 'analog in');
  if (c.has('sda')) partes.push('I²C SDA');
  if (c.has('scl')) partes.push('I²C SCL');
  const extra = EXTRAS[`${familia}:${nome}`];
  if (extra) partes.push(extra);
  if (!partes.length) partes.push(pt ? 'pino de serviço' : 'service pin');
  return partes.join(' · ');
};

export const atende = (requisito: Requisito, c: ReadonlySet<Capacidade>): boolean => {
  switch (requisito) {
    case 'gnd':
      return c.has('gnd');
    case 'vcc':
      return c.has('v5') || c.has('v33');
    case 'digital':
    case 'pwm':
      return c.has('digital');
    case 'analogico':
      return c.has('analogico');
    case 'sda':
      return c.has('sda');
    case 'scl':
      return c.has('scl');
  }
};

export const corAutomatica = (a: ReadonlySet<Capacidade>, b: ReadonlySet<Capacidade>, indice: number): string => {
  if (a.has('gnd') || b.has('gnd')) return 'preto';
  if (a.has('v5') || b.has('v5') || a.has('v33') || b.has('v33') || a.has('vin') || b.has('vin')) return 'vermelho';
  const sinais = ['amarelo', 'verde', 'azul', 'laranja', 'roxo', 'branco'];
  return sinais[indice % sinais.length] ?? 'amarelo';
};

export interface ItemBancada {
  readonly id: string;
  readonly tipo: 'placa' | 'modulo';
  readonly ref: string;
  readonly x: number;
  readonly y: number;
  readonly rot: number;
}

export interface Ponta {
  readonly item: string;
  readonly pino: string;
}

export interface FioBancada {
  readonly id: string;
  readonly a: Ponta;
  readonly b: Ponta;
  readonly cor: string;
}

export interface Bancada {
  readonly itens: readonly ItemBancada[];
  readonly fios: readonly FioBancada[];
}

export interface Catalogo3d {
  readonly placa: (id: string) => PlacaBancada | undefined;
  readonly modulo: (tipo: string) => ModuloBancada | undefined;
  readonly pinos: (item: ItemBancada) => readonly string[];
}

export const LIMITE_X = 250;
export const LIMITE_Y = 160;
const MAX_ITENS = 24;
const MAX_FIOS = 80;
const COR_VALIDA = /^(vermelho|preto|amarelo|verde|azul|laranja|branco|roxo)$/;

const texto = (v: unknown, max = 48): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max && /^[\w.-]+$/.test(v) ? v : null);
const coord = (v: unknown, limite: number): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-limite, Math.min(limite, v)) : null);

export const lerBancada = (bruto: unknown, cat: Catalogo3d): Bancada => {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return { itens: [], fios: [] };
  const obj = bruto as Record<string, unknown>;
  const itens: ItemBancada[] = [];
  const ids = new Set<string>();
  for (const v of Array.isArray(obj.itens) ? obj.itens.slice(0, MAX_ITENS) : []) {
    if (!v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    const id = texto(r.id, 24);
    const ref = texto(r.ref);
    const tipo = r.tipo === 'placa' || r.tipo === 'modulo' ? r.tipo : null;
    const x = coord(r.x, LIMITE_X);
    const y = coord(r.y, LIMITE_Y);
    const rot = typeof r.rot === 'number' && [0, 1, 2, 3].includes(r.rot) ? r.rot : 0;
    if (!id || !ref || !tipo || x === null || y === null || ids.has(id)) continue;
    if (tipo === 'placa' ? !cat.placa(ref) : !cat.modulo(ref)) continue;
    ids.add(id);
    itens.push({ id, tipo, ref, x, y, rot });
  }
  const porId = new Map(itens.map((i) => [i.id, i]));
  const pontaValida = (v: unknown): Ponta | null => {
    if (!v || typeof v !== 'object') return null;
    const r = v as Record<string, unknown>;
    const item = texto(r.item, 24);
    const pino = typeof r.pino === 'string' && r.pino.length <= 16 ? r.pino : null;
    const alvo = item ? porId.get(item) : undefined;
    if (!alvo || !pino || !cat.pinos(alvo).includes(pino)) return null;
    return { item: alvo.id, pino };
  };
  const fios: FioBancada[] = [];
  for (const v of Array.isArray(obj.fios) ? obj.fios.slice(0, MAX_FIOS) : []) {
    if (!v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    const id = texto(r.id, 24);
    const a = pontaValida(r.a);
    const b = pontaValida(r.b);
    const cor = typeof r.cor === 'string' && COR_VALIDA.test(r.cor) ? r.cor : 'amarelo';
    if (!id || !a || !b || (a.item === b.item && a.pino === b.pino)) continue;
    fios.push({ id, a, b, cor });
  }
  return { itens, fios };
};

export const mesmaPonta = (a: Ponta, b: Ponta): boolean => a.item === b.item && a.pino === b.pino;

export const ligadosA = (b: Bancada, ponta: Ponta): Ponta[] =>
  b.fios.flatMap((f) => (mesmaPonta(f.a, ponta) ? [f.b] : mesmaPonta(f.b, ponta) ? [f.a] : []));

export const existeFio = (b: Bancada, x: Ponta, y: Ponta): boolean => b.fios.some((f) => (mesmaPonta(f.a, x) && mesmaPonta(f.b, y)) || (mesmaPonta(f.a, y) && mesmaPonta(f.b, x)));

const alvoBate = (alvo: string, familia: Familia, pino: string): boolean => {
  if (alvo === 'GND') return capacidades(familia, pino).has('gnd');
  if (alvo === '5V') return capacidades(familia, pino).has('v5');
  return alvo === pino;
};

export const ligacaoFeita = (lig: LigacaoMissao, b: Bancada, cat: Catalogo3d): boolean => {
  const modulos = b.itens.filter((i) => i.tipo === 'modulo' && i.ref === lig.modulo);
  return modulos.some((m) =>
    ligadosA(b, { item: m.id, pino: lig.pino }).some((outra) => {
      const item = b.itens.find((i) => i.id === outra.item);
      const placa = item?.tipo === 'placa' ? cat.placa(item.ref) : undefined;
      return !!placa && placa.familia === 'arduino' && alvoBate(lig.alvo, placa.familia, nomeBase(outra.pino));
    }),
  );
};

export interface Verificacao {
  readonly feitas: readonly boolean[];
  readonly ok: boolean;
  readonly faltam: number;
}

export const verificarMissao = (m: Missao, b: Bancada, cat: Catalogo3d): Verificacao => {
  const feitas = m.ligacoes.map((l) => ligacaoFeita(l, b, cat));
  const faltam = feitas.filter((f) => !f).length;
  return { feitas, ok: faltam === 0, faltam };
};

export interface EstadoModulo {
  readonly ligado: boolean;
  readonly faltam: readonly string[];
}

export const estadoModulo = (b: Bancada, item: ItemBancada, cat: Catalogo3d): EstadoModulo => {
  const modulo = cat.modulo(item.ref);
  if (!modulo) return { ligado: false, faltam: [] };
  const faltam = modulo.pinos
    .filter((pino) =>
      !ligadosA(b, { item: item.id, pino: pino.nome }).some((outra) => {
        const alvo = b.itens.find((i) => i.id === outra.item);
        const placa = alvo?.tipo === 'placa' ? cat.placa(alvo.ref) : undefined;
        return !!placa && atende(pino.precisa, capacidades(placa.familia, nomeBase(outra.pino)));
      }),
    )
    .map((p) => p.nome);
  return { ligado: faltam.length === 0, faltam };
};

export interface Entradas {
  botao: boolean;
  pot: number;
  luz: number;
  distancia: number;
  temperatura: number;
  umidade: number;
}

export interface Saidas {
  readonly led?: number;
  readonly rgb?: readonly [number, number, number];
  readonly buzzer?: number;
  readonly servo?: number;
  readonly motor?: boolean;
  readonly oled?: readonly string[];
  readonly placaLed?: boolean;
}

export interface Tique {
  readonly saidas: Saidas;
  readonly serial: string | null;
}

export type Memoria = Record<string, number | boolean>;

export interface Programa {
  readonly periodo: number;
  readonly passo: (i: number, e: Readonly<Entradas>, presentes: ReadonlySet<TipoModulo>, mem: Memoria) => Tique;
}

const ESCALA = [262, 294, 330, 349, 392, 440, 494, 523];

const hsv = (h: number): [number, number, number] => {
  const f = (n: number): number => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [f(5), f(3), f(1)];
};

const triangulo = (i: number, passo: number): number => {
  const v = (i * passo) % 360;
  return v <= 180 ? v : 360 - v;
};

export const distanciaEco = (cm: number): number => Math.round(cm * 2 / 0.0343);

export const PROGRAMAS: Readonly<Record<string, Programa>> = {
  'ola-led': {
    periodo: 500,
    passo: (i) => {
      const aceso = i % 2 === 0;
      return { saidas: { led: aceso ? 1 : 0, placaLed: aceso }, serial: aceso ? 'D13 HIGH - LED aceso' : 'D13 LOW - LED apagado' };
    },
  },
  'botao-led': {
    periodo: 50,
    passo: (_i, e, _p, mem) => {
      const mudou = mem.botao !== e.botao;
      mem.botao = e.botao;
      return { saidas: { led: e.botao ? 1 : 0, placaLed: e.botao }, serial: mudou ? (e.botao ? 'apertado' : 'solto') : null };
    },
  },
  dimmer: {
    periodo: 100,
    passo: (i, e) => {
      const pwm = Math.round((e.pot / 1023) * 255);
      return { saidas: { led: pwm / 255 }, serial: i % 5 === 0 ? `A0 = ${Math.round(e.pot)} -> PWM ${pwm}` : null };
    },
  },
  melodia: {
    periodo: 250,
    passo: (i) => {
      const j = i % 11;
      const nota = j < 8 ? (ESCALA[j] ?? 0) : 0;
      return { saidas: { buzzer: nota }, serial: nota ? String(nota) : null };
    },
  },
  servo: {
    periodo: 30,
    passo: (i) => {
      const angulo = triangulo(i, 2);
      return { saidas: { servo: angulo }, serial: i > 0 && i % 180 === 0 ? 'varredura completa' : null };
    },
  },
  regua: {
    periodo: 200,
    passo: (_i, e) => ({ saidas: {}, serial: `Distancia: ${e.distancia.toFixed(2)} cm` }),
  },
  termometro: {
    periodo: 1000,
    passo: (_i, e) => ({ saidas: {}, serial: `Temperatura: ${e.temperatura.toFixed(2)} C  Umidade: ${e.umidade.toFixed(2)} %` }),
  },
  'luz-noturna': {
    periodo: 200,
    passo: (_i, e) => {
      const escuro = e.luz < 300;
      return { saidas: { led: escuro ? 1 : 0, placaLed: escuro }, serial: `Luz: ${Math.round(e.luz)}` };
    },
  },
  'arco-iris': {
    periodo: 40,
    passo: (i) => ({ saidas: { rgb: hsv((i * 4) % 360) }, serial: i > 0 && i % 90 === 0 ? 'volta completa' : null }),
  },
  'ola-oled': {
    periodo: 1000,
    passo: (i) => ({ saidas: { oled: ['Rumo', 'Ola, OLED!', `t = ${i} s`] }, serial: 'tela atualizada' }),
  },
  livre: {
    periodo: 250,
    passo: (i, e, presentes) => {
      const aceso = i % 4 < 2;
      const partes: string[] = [];
      if (presentes.has('botao')) partes.push(`botao=${e.botao ? 1 : 0}`);
      if (presentes.has('pot')) partes.push(`pot=${Math.round(e.pot)}`);
      if (presentes.has('ldr')) partes.push(`luz=${Math.round(e.luz)}`);
      if (presentes.has('hcsr04')) partes.push(`dist=${e.distancia.toFixed(1)}cm`);
      if (presentes.has('dht11')) partes.push(`temp=${e.temperatura.toFixed(1)}C umid=${Math.round(e.umidade)}%`);
      return {
        saidas: {
          led: presentes.has('botao') ? (e.botao ? 1 : 0) : aceso ? 1 : 0,
          placaLed: aceso,
          buzzer: i % 8 === 0 ? 880 : 0,
          servo: triangulo(i, 12),
          rgb: hsv((i * 15) % 360),
          motor: Math.floor(i / 8) % 2 === 0,
          oled: ['Rumo', 'Bancada livre', `t = ${Math.floor(i / 4)} s`],
        },
        serial: i % 4 === 0 ? (partes.length ? partes.join('  ') : `t = ${Math.floor(i / 4)} s`) : null,
      };
    },
  },
};

export const programaDe = (missao: string | null): Programa => PROGRAMAS[missao ?? 'livre'] ?? (PROGRAMAS.livre as Programa);

export const posicaoLivre = (itens: readonly { x: number; y: number }[], raio = 40): { x: number; y: number } => {
  for (let anel = 0; anel < 8; anel++) {
    const passos = Math.max(1, anel * 6);
    for (let k = 0; k < passos; k++) {
      const ang = (k / passos) * Math.PI * 2;
      const x = Math.round(Math.cos(ang) * anel * 55);
      const y = Math.round(Math.sin(ang) * anel * 45);
      if (Math.abs(x) > LIMITE_X - 30 || Math.abs(y) > LIMITE_Y - 25) continue;
      if (itens.every((i) => Math.hypot(i.x - x, i.y - y) > raio)) return { x, y };
    }
  }
  return { x: 0, y: 0 };
};
