import type { Categoria, Componente, CorPlaca, Placa } from '../dados/tipos';
import type { Acabamento, Antena, Footprint, Furo, MatrizPads, Modelo, Pad, ProjetoPcb, Retangulo, Segmento, TextoSerigrafia, Trilha, Via } from './modelo';

export const COR_MASCARA: Record<CorPlaca, string> = {
  verde: '#1d5a34',
  azul: '#12407e',
  preto: '#151617',
  vermelho: '#8a1d17',
  roxo: '#3e2066',
  branco: '#e6e4de',
  amarelo: '#b8941c',
  cinza: '#4b5058',
  marrom: '#7a5530',
};

const SERIGRAFIA_ESCURA: readonly CorPlaca[] = ['branco', 'amarelo'];
const HASL: readonly CorPlaca[] = ['azul', 'vermelho', 'marrom'];

export const semente = (texto: string): (() => number) => {
  let h = 2166136261;
  for (const ch of texto) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const arred = (v: number): number => Math.round(v * 1000) / 1000;

const rectSilk = (r: Retangulo, folga: number): Segmento[] => {
  const x1 = r.x - folga;
  const y1 = r.y - folga;
  const x2 = r.x + r.l + folga;
  const y2 = r.y + r.a + folga;
  return [
    { x1, y1, x2, y2: y1 },
    { x1: x2, y1, x2, y2 },
    { x1: x2, y1: y2, x2: x1, y2 },
    { x1, y1: y2, x2: x1, y2: y1 },
  ];
};

const MODULARES: ReadonlySet<Categoria> = new Set(['modulo', 'sensor', 'energia']);

export const classificar = (c: Componente, placa: Placa): Modelo => {
  const menor = Math.min(c.l, c.a);
  const maior = Math.max(c.l, c.a);
  const razao = maior / Math.max(menor, 0.01);
  switch (c.forma) {
    case 'chip':
      if (c.z >= 8) return 'caixa';
      if (c.z >= 3 && (razao >= 2.2 || (c.z >= 3.5 && menor <= 10))) return 'dip';
      if (maior <= 3.6) return 'sot';
      if (menor >= 5 && razao < 1.5) return c.z >= 1.3 ? 'qfp' : 'qfn';
      if (razao >= 1.5 && menor < 6) return 'soic';
      return menor >= 9 ? 'bga' : 'qfn';
    case 'metal':
      if (/^(GPU|BCM|RP3A0|RP1)/.test(c.rotulo ?? '')) return 'bga';
      return maior <= 16 && c.z <= 2.4 && !MODULARES.has(placa.categoria) && !c.rotulo?.includes('-') && !/WROOM|ESP|NEO|CAM|SD|CYW|MDBT/i.test(c.rotulo ?? '') ? 'bga' : 'blindagem';
    case 'conector':
      return 'conector';
    case 'botao':
      return 'botao';
    case 'led':
      return c.z >= 4 ? 'led-tht' : 'led-smd';
    case 'barra':
      return 'barra';
    case 'femea':
      return 'femea';
    case 'slot':
      return 'slot';
    case 'capacitor':
      return 'eletrolitico';
    case 'ceramico':
      return 'mlcc';
    case 'resistor':
      return c.z < 1 ? 'resistor-smd' : 'resistor-tht';
    case 'cristal':
      return 'cristal';
    case 'dissipador':
      return 'dissipador';
    case 'bateria':
      return 'bateria';
    case 'borne':
      return 'borne';
    case 'trimpot':
      return 'trimpot';
    case 'indutor':
      return 'indutor';
    case 'soquete':
      return 'soquete';
    case 'ventoinha':
      return 'ventoinha';
    case 'transformador':
      return 'transformador';
    case 'lente':
      return 'camera';
    case 'tela':
      return 'tela';
    case 'diodo':
      return c.z >= 2.5 && maior >= 6 ? 'diodo-tht' : 'diodo-smd';
    case 'chave':
      return 'chave';
    case 'sensor':
      return c.z > 0.5 ? 'transdutor' : 'pads';
    case 'pcb':
      return 'submodulo';
    case 'fita':
      return c.z >= 3 ? 'cabo' : 'fpc';
    case 'antena':
      return 'antena';
    case 'furos':
      return 'pads';
    case 'texto':
      return 'texto';
  }
};

const PREFIXO: Record<Modelo, string> = {
  qfn: 'U', qfp: 'U', soic: 'U', sot: 'U', dip: 'U', bga: 'U', blindagem: 'U', caixa: 'K', conector: 'J', botao: 'SW', 'led-smd': 'D', 'led-tht': 'D',
  barra: 'J', femea: 'J', slot: 'J', eletrolitico: 'C', mlcc: 'C', 'resistor-smd': 'R', 'resistor-tht': 'R', cristal: 'Y', dissipador: 'HS',
  bateria: 'BT', borne: 'J', trimpot: 'RV', indutor: 'L', soquete: 'U', ventoinha: 'FAN', transformador: 'T', camera: 'U', tela: 'DS',
  'diodo-smd': 'D', 'diodo-tht': 'D', chave: 'SW', transdutor: 'LS', submodulo: 'U', fpc: 'J', cabo: 'W', antena: 'AE', pads: 'J', texto: '',
};

const dim = (v: number): string => (Math.round(v * 10) / 10).toString();

const biblioteca = (m: Modelo, c: Componente, pads: number): string => {
  const d = `${dim(c.l)}x${dim(c.a)}mm`;
  switch (m) {
    case 'qfn': return `Package_DFN_QFN:QFN-${pads}-1EP_${d}_P0.4mm_EP`;
    case 'qfp': return `Package_QFP:LQFP-${pads}_${d}_P0.5mm`;
    case 'soic': return `Package_SO:SOIC-${pads}_${d}_P1.27mm`;
    case 'sot': return pads === 3 ? 'Package_TO_SOT_SMD:SOT-23' : 'Package_TO_SOT_SMD:SOT-23-5';
    case 'dip': return `Package_DIP:DIP-${pads}_W7.62mm_Socket`;
    case 'bga': return `Package_BGA:BGA_${d}_Lid`;
    case 'blindagem': return `RF_Shielding:Shield_${d}`;
    case 'caixa': return 'Relay_THT:Relay_SPDT_SANYOU_SRD_Series_Form_C';
    case 'conector': return `Connector:Receptacle_${c.rotulo?.replace(/[^A-Za-z0-9]/g, '') || 'Generic'}_${d}`;
    case 'botao': return 'Button_Switch_SMD:SW_SPST_TL3342';
    case 'led-smd': return 'LED_SMD:LED_0603_1608Metric';
    case 'led-tht': return 'LED_THT:LED_D5.0mm';
    case 'barra': return `Connector_PinHeader_2.54mm:PinHeader_${Math.max(1, Math.round(c.a / 2.54))}x${Math.max(1, Math.round(c.l / 2.54))}_P2.54mm_Vertical`;
    case 'femea': return `Connector_PinSocket_2.54mm:PinSocket_${Math.max(1, Math.round(c.a / 2.54))}x${Math.max(1, Math.round(c.l / 2.54))}_P2.54mm_Vertical`;
    case 'slot': return `Connector_PCBEdge:Slot_${d}_P1.0mm`;
    case 'eletrolitico': return `Capacitor_THT:CP_Radial_D${dim(Math.min(c.l, c.a))}mm_P${dim(Math.min(c.l, c.a) * 0.4)}mm`;
    case 'mlcc': return 'Capacitor_SMD:C_0805_2012Metric';
    case 'resistor-smd': return 'Resistor_SMD:R_0603_1608Metric';
    case 'resistor-tht': return 'Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm_Horizontal';
    case 'cristal': return c.z >= 2.5 ? 'Crystal:Crystal_HC49-U_Vertical' : 'Crystal:Crystal_SMD_3225-4Pin_3.2x2.5mm';
    case 'dissipador': return `Heatsink:Heatsink_${d}`;
    case 'bateria': return 'Battery:BatteryHolder_CR2032';
    case 'borne': return `TerminalBlock:TerminalBlock_bornier-${pads}_P5.08mm`;
    case 'trimpot': return 'Potentiometer_THT:Potentiometer_Bourns_3296W_Vertical';
    case 'indutor': return `Inductor_SMD:L_${d}`;
    case 'soquete': return 'Socket:LGA1718_AM5';
    case 'ventoinha': return 'Fan:Fan_40mm';
    case 'transformador': return `Transformer_THT:Transformer_${d}`;
    case 'camera': return 'Camera:OV2640_Module';
    case 'tela': return 'Display:OLED_128x64_0.96in';
    case 'diodo-smd': return 'Diode_SMD:D_SMA';
    case 'diodo-tht': return 'Diode_THT:D_DO-41_SOD81_P10.16mm_Horizontal';
    case 'chave': return 'Button_Switch_THT:SW_Slide_1P2T';
    case 'transdutor': return 'Buzzer_Beeper:Transducer_16mm';
    case 'submodulo': return `Module:Module_${d}_Castellated`;
    case 'fpc': return 'Connector_FFC-FPC:FPC_Flex';
    case 'cabo': return 'Wire:Cable_Bundle';
    case 'antena': return 'RF_Antenna:Antenna_PCB_Meander';
    case 'pads': return `Connector:Pads_${d}`;
    case 'texto': return '';
  }
};

const VALOR_PADRAO: Partial<Record<Modelo, string>> = {
  'led-smd': 'LED', 'led-tht': 'LED', mlcc: '100nF', 'resistor-smd': '10k', 'resistor-tht': '1k', eletrolitico: '100uF', cristal: 'Crystal', indutor: '10uH',
  'diodo-smd': 'SS34', 'diodo-tht': '1N4007', botao: 'SW_Push', trimpot: '10k', bateria: 'CR2032', borne: 'Screw_Terminal', barra: 'Conn_01', femea: 'Conn_01',
  dissipador: 'Heatsink', antena: 'Antenna', caixa: 'SRD-05VDC-SL-C', slot: 'Slot', conector: 'Conn', transformador: 'Transformer', chave: 'SW_Slide', transdutor: 'Transducer',
};

const filaPads = (x: number, y: number, n: number, passo: number, dx: number, dy: number, l: number, a: number, forma: Pad['forma'], furo: number, inicio = 1): Pad[] =>
  Array.from({ length: n }, (_, i) => ({ numero: String(inicio + i), x: arred(x + dx * passo * i), y: arred(y + dy * passo * i), l, a, forma, furo }));

const centrado = (comprimento: number, n: number, passo: number): number => (comprimento - (n - 1) * passo) / 2;

const gerarPads = (m: Modelo, c: Componente, placa: Placa): { pads: Pad[]; matrizes: MatrizPads[] } => {
  const { x, y, l, a } = c;
  const horizontal = l >= a;
  const maior = Math.max(l, a);
  const menor = Math.min(l, a);
  const matrizes: MatrizPads[] = [];
  const doisExtremos = (pl: number, pa: number, forma: Pad['forma'] = 'arredondado', furo = 0, fora = 0): Pad[] =>
    horizontal
      ? [{ numero: '1', x: x - fora + pl / 2, y: y + a / 2, l: pl, a: pa, forma, furo }, { numero: '2', x: x + l + fora - pl / 2, y: y + a / 2, l: pl, a: pa, forma, furo }]
      : [{ numero: '1', x: x + l / 2, y: y - fora + pl / 2, l: pa, a: pl, forma, furo }, { numero: '2', x: x + l / 2, y: y + a + fora - pl / 2, l: pa, a: pl, forma, furo }];
  switch (m) {
    case 'qfn':
    case 'qfp': {
      const passo = menor >= 7 ? 0.5 : 0.4;
      const fora = m === 'qfp' ? 0.7 : -0.25;
      const nx = Math.max(2, Math.floor((l - 1.2) / passo));
      const ny = Math.max(2, Math.floor((a - 1.2) / passo));
      const comp = m === 'qfp' ? 1.2 : 0.7;
      const larg = passo * 0.55;
      const pads = [
        ...filaPads(x + centrado(l, nx, passo), y - fora, nx, passo, 1, 0, larg, comp, 'arredondado', 0, 1),
        ...filaPads(x + l + fora, y + centrado(a, ny, passo), ny, passo, 0, 1, comp, larg, 'arredondado', 0, nx + 1),
        ...filaPads(x + l - centrado(l, nx, passo), y + a + fora, nx, passo, -1, 0, larg, comp, 'arredondado', 0, nx + ny + 1),
        ...filaPads(x - fora, y + a - centrado(a, ny, passo), ny, passo, 0, -1, comp, larg, 'arredondado', 0, 2 * nx + ny + 1),
      ];
      if (m === 'qfn') pads.push({ numero: 'EP', x: x + l / 2, y: y + a / 2, l: l * 0.55, a: a * 0.55, forma: 'retangulo', furo: 0 });
      return { pads, matrizes };
    }
    case 'soic': {
      const n = Math.max(2, Math.floor((maior - 0.6) / 1.27) + 1);
      const p = horizontal
        ? [...filaPads(x + centrado(l, n, 1.27), y + a + 0.5, n, 1.27, 1, 0, 0.6, 1.5, 'arredondado', 0, 1), ...filaPads(x + l - centrado(l, n, 1.27), y - 0.5, n, 1.27, -1, 0, 0.6, 1.5, 'arredondado', 0, n + 1)]
        : [...filaPads(x - 0.5, y + centrado(a, n, 1.27), n, 1.27, 0, 1, 1.5, 0.6, 'arredondado', 0, 1), ...filaPads(x + l + 0.5, y + a - centrado(a, n, 1.27), n, 1.27, 0, -1, 1.5, 0.6, 'arredondado', 0, n + 1)];
      return { pads: p, matrizes };
    }
    case 'sot': {
      const cinco = maior >= 3;
      const ps: Pad[] = [
        { numero: '1', x: x + l * 0.2, y: y + a + 0.45, l: 0.6, a: 1, forma: 'arredondado', furo: 0 },
        { numero: '2', x: x + l * 0.8, y: y + a + 0.45, l: 0.6, a: 1, forma: 'arredondado', furo: 0 },
        { numero: '3', x: x + l * 0.5, y: y - 0.45, l: 0.6, a: 1, forma: 'arredondado', furo: 0 },
      ];
      if (cinco) {
        ps.push({ numero: '4', x: x + l * 0.2, y: y - 0.45, l: 0.6, a: 1, forma: 'arredondado', furo: 0 }, { numero: '5', x: x + l * 0.8, y: y - 0.45, l: 0.6, a: 1, forma: 'arredondado', furo: 0 });
        ps[2] = { ...ps[2]!, numero: '3', x: x + l * 0.5, y: y + a + 0.45 };
      }
      return { pads: ps, matrizes };
    }
    case 'dip': {
      const n = Math.max(2, Math.round(maior / 2.54));
      const ps = horizontal
        ? [...filaPads(x + centrado(l, n, 2.54), y + a + 0.6, n, 2.54, 1, 0, 1.6, 2.4, 'oval', 0.8, 1), ...filaPads(x + l - centrado(l, n, 2.54), y - 0.6, n, 2.54, -1, 0, 1.6, 2.4, 'oval', 0.8, n + 1)]
        : [...filaPads(x - 0.6, y + centrado(a, n, 2.54), n, 2.54, 0, 1, 2.4, 1.6, 'oval', 0.8, 1), ...filaPads(x + l + 0.6, y + a - centrado(a, n, 2.54), n, 2.54, 0, -1, 2.4, 1.6, 'oval', 0.8, n + 1)];
      return { pads: [{ ...ps[0]!, forma: 'retangulo' }, ...ps.slice(1)], matrizes };
    }
    case 'bga':
      matrizes.push({ x: x + 0.6, y: y + 0.6, l: l - 1.2, a: a - 1.2, passo: Math.max(0.65, menor / 22) });
      return { pads: [], matrizes };
    case 'soquete':
      matrizes.push({ x: x + l * 0.12, y: y + a * 0.12, l: l * 0.76, a: a * 0.76, passo: 1.1 });
      return { pads: [], matrizes };
    case 'blindagem':
    case 'submodulo': {
      const passo = maior > 40 ? 2.54 : 1.27;
      const nx = Math.max(2, Math.floor((l - 2) / passo));
      const ny = Math.max(2, Math.floor((a - 2) / passo));
      return {
        pads: [
          ...filaPads(x + centrado(l, nx, passo), y + 0.4, nx, passo, 1, 0, passo * 0.5, 1.4, 'arredondado', 0, 1),
          ...filaPads(x + centrado(l, nx, passo), y + a - 0.4, nx, passo, 1, 0, passo * 0.5, 1.4, 'arredondado', 0, nx + 1),
          ...(m === 'submodulo' ? filaPads(x + 0.4, y + centrado(a, ny, passo), ny, passo, 0, 1, 1.4, passo * 0.5, 'arredondado', 0, 2 * nx + 1) : []),
        ],
        matrizes,
      };
    }
    case 'conector': {
      const n = Math.max(4, Math.min(24, Math.floor(menor / 0.5)));
      const passo = Math.min(0.5, (menor - 1) / n);
      const dentroX = x < 0 ? x + l - 0.8 : x + 0.8;
      const pads: Pad[] = horizontal
        ? filaPads(x + centrado(l, n, passo), y < 0 ? y + a - 0.6 : y + 0.6, n, passo, 1, 0, passo * 0.6, 1.2, 'arredondado', 0, 1)
        : filaPads(dentroX, y + centrado(a, n, passo), n, passo, 0, 1, 1.2, passo * 0.6, 'arredondado', 0, 1);
      pads.push(
        { numero: 'SH', x: x + l * 0.15, y: y + 0.4, l: 1.2, a: 2, forma: 'oval', furo: 0.7 },
        { numero: 'SH', x: x + l * 0.85, y: y + 0.4, l: 1.2, a: 2, forma: 'oval', furo: 0.7 },
        { numero: 'SH', x: x + l * 0.15, y: y + a - 0.4, l: 1.2, a: 2, forma: 'oval', furo: 0.7 },
        { numero: 'SH', x: x + l * 0.85, y: y + a - 0.4, l: 1.2, a: 2, forma: 'oval', furo: 0.7 },
      );
      return { pads, matrizes };
    }
    case 'botao':
      return {
        pads: [
          { numero: '1', x: x - 0.4, y: y + 0.5, l: 1, a: 0.8, forma: 'arredondado', furo: 0 },
          { numero: '2', x: x + l + 0.4, y: y + 0.5, l: 1, a: 0.8, forma: 'arredondado', furo: 0 },
          { numero: '3', x: x - 0.4, y: y + a - 0.5, l: 1, a: 0.8, forma: 'arredondado', furo: 0 },
          { numero: '4', x: x + l + 0.4, y: y + a - 0.5, l: 1, a: 0.8, forma: 'arredondado', furo: 0 },
        ],
        matrizes,
      };
    case 'led-smd':
    case 'mlcc':
    case 'resistor-smd':
    case 'indutor':
      return { pads: doisExtremos(Math.max(0.5, maior * 0.32), menor * 1.05, 'arredondado', 0, maior * 0.12), matrizes };
    case 'diodo-smd':
      return { pads: doisExtremos(Math.max(0.8, maior * 0.3), menor * 0.9, 'arredondado', 0, 0.4), matrizes };
    case 'led-tht':
    case 'eletrolitico': {
      const passo = Math.max(2, menor * 0.4);
      return {
        pads: [
          { numero: '1', x: x + l / 2 - passo / 2, y: y + a / 2, l: 1.6, a: 1.6, forma: 'retangulo', furo: 0.8 },
          { numero: '2', x: x + l / 2 + passo / 2, y: y + a / 2, l: 1.6, a: 1.6, forma: 'redondo', furo: 0.8 },
        ],
        matrizes,
      };
    }
    case 'resistor-tht':
    case 'diodo-tht':
      return { pads: doisExtremos(1.6, 1.6, 'redondo', 0.8, 1.6), matrizes };
    case 'cristal':
      return c.z >= 2.5 ? { pads: doisExtremos(1.5, 1.5, 'redondo', 0.8, -maior * 0.18), matrizes } : { pads: doisExtremos(maior * 0.3, menor, 'arredondado'), matrizes };
    case 'barra':
    case 'femea': {
      const cols = Math.max(1, Math.round(l / 2.54));
      const linhas = Math.max(1, Math.round(a / 2.54));
      const pads: Pad[] = [];
      for (let j = 0; j < linhas; j++)
        for (let i = 0; i < cols; i++)
          pads.push({ numero: String(j * cols + i + 1), x: arred(x + 1.27 + i * 2.54), y: arred(y + 1.27 + j * 2.54), l: 1.7, a: 1.7, forma: i === 0 && j === 0 ? 'retangulo' : 'redondo', furo: 1 });
      return { pads, matrizes };
    }
    case 'slot': {
      const n = Math.max(4, Math.floor((maior - 6) / (maior > 100 ? 2 : 1)));
      const passo = (maior - 6) / n;
      const pads = horizontal
        ? [...filaPads(x + 3, y + a * 0.3, n, passo, 1, 0, passo * 0.5, 0.9, 'redondo', 0.5, 1), ...filaPads(x + 3 + passo / 2, y + a * 0.7, n, passo, 1, 0, passo * 0.5, 0.9, 'redondo', 0.5, n + 1)]
        : [...filaPads(x + l * 0.3, y + 3, n, passo, 0, 1, 0.9, passo * 0.5, 'redondo', 0.5, 1), ...filaPads(x + l * 0.7, y + 3 + passo / 2, n, passo, 0, 1, 0.9, passo * 0.5, 'redondo', 0.5, n + 1)];
      return { pads, matrizes };
    }
    case 'borne': {
      const n = Math.max(2, Math.round(maior / 5.08));
      const passo = maior / n;
      return { pads: horizontal ? filaPads(x + passo / 2, y + a / 2, n, passo, 1, 0, 2.4, 2.4, 'redondo', 1.3) : filaPads(x + l / 2, y + passo / 2, n, passo, 0, 1, 2.4, 2.4, 'redondo', 1.3), matrizes };
    }
    case 'trimpot':
      return { pads: horizontal ? filaPads(x + l / 2 - 2.54, y + a / 2, 3, 2.54, 1, 0, 1.4, 1.4, 'redondo', 0.8) : filaPads(x + l / 2, y + a / 2 - 2.54, 3, 2.54, 0, 1, 1.4, 1.4, 'redondo', 0.8), matrizes };
    case 'bateria':
      return { pads: doisExtremos(2.5, menor * 0.4, 'retangulo', 0, 1.2), matrizes };
    case 'caixa':
      return {
        pads: [
          { numero: '1', x: x + 2, y: y + a / 2, l: 2.2, a: 2.2, forma: 'retangulo', furo: 1.2 },
          { numero: '2', x: x + l * 0.35, y: y + 2.2, l: 2.2, a: 2.2, forma: 'redondo', furo: 1.2 },
          { numero: '3', x: x + l * 0.35, y: y + a - 2.2, l: 2.2, a: 2.2, forma: 'redondo', furo: 1.2 },
          { numero: '4', x: x + l - 2.2, y: y + 2.2, l: 2.2, a: 2.2, forma: 'redondo', furo: 1.2 },
          { numero: '5', x: x + l - 2.2, y: y + a - 2.2, l: 2.2, a: 2.2, forma: 'redondo', furo: 1.2 },
        ],
        matrizes,
      };
    case 'transformador':
      return {
        pads: [
          { numero: '1', x: x + 2, y: y + 2, l: 2.2, a: 2.2, forma: 'retangulo', furo: 1.2 },
          { numero: '2', x: x + 2, y: y + a - 2, l: 2.2, a: 2.2, forma: 'redondo', furo: 1.2 },
          { numero: '3', x: x + l - 2, y: y + 2, l: 2.2, a: 2.2, forma: 'redondo', furo: 1.2 },
          { numero: '4', x: x + l - 2, y: y + a - 2, l: 2.2, a: 2.2, forma: 'redondo', furo: 1.2 },
        ],
        matrizes,
      };
    case 'chave':
      return { pads: horizontal ? filaPads(x + l / 2 - 2.54, y + a / 2, 3, 2.54, 1, 0, 1.5, 1.5, 'redondo', 0.9) : filaPads(x + l / 2, y + a / 2 - 2.54, 3, 2.54, 0, 1, 1.5, 1.5, 'redondo', 0.9), matrizes };
    case 'transdutor':
      return { pads: [{ numero: '1', x: x + l / 2 - 3, y: y + a / 2, l: 1.8, a: 1.8, forma: 'retangulo', furo: 0.9 }, { numero: '2', x: x + l / 2 + 3, y: y + a / 2, l: 1.8, a: 1.8, forma: 'redondo', furo: 0.9 }], matrizes };
    case 'pads':
      return { pads: gerarPadsBorda(c, placa), matrizes };
    case 'ventoinha':
      return { pads: filaPads(x + l / 2 - 2.54, y + a + 1.5, 3, 2.54, 1, 0, 1.4, 1.4, 'redondo', 0.8), matrizes };
    default:
      return { pads: [], matrizes };
  }
};

const gerarPadsBorda = (c: Componente, placa: Placa): Pad[] => {
  const { x, y, l, a } = c;
  const horizontal = l >= a;
  const maior = Math.max(l, a);
  const menor = Math.min(l, a);
  if (placa.categoria === 'pc' || placa.id === 'microbit') {
    const passo = placa.id === 'microbit' ? 2 : maior > 100 ? 1 : maior > 40 ? 0.85 : 0.5;
    const n = Math.floor((maior - 1) / passo);
    const larg = passo * 0.6;
    return horizontal ? filaPads(x + centrado(l, n, passo), y + a / 2, n, passo, 1, 0, larg, a * 0.9, 'retangulo', 0) : filaPads(x + l / 2, y + centrado(a, n, passo), n, passo, 0, 1, l * 0.9, larg, 'retangulo', 0);
  }
  if (maior / menor < 1.6) return [{ numero: '1', x: x + l / 2, y: y + a / 2, l: menor * 0.9, a: menor * 0.9, forma: 'arredondado', furo: menor * 0.35 }];
  if (menor <= 2.2) {
    const n = Math.max(2, Math.floor(maior / 2.54));
    return horizontal ? filaPads(x + centrado(l, n, 2.54), y + a / 2, n, 2.54, 1, 0, 1.6, a, 'oval', 1) : filaPads(x + l / 2, y + centrado(a, n, 2.54), n, 2.54, 0, 1, l, 1.6, 'oval', 1);
  }
  const cols = Math.max(1, Math.round(l / 2.54));
  const linhas = Math.max(1, Math.round(a / 2.54));
  const pads: Pad[] = [];
  for (let j = 0; j < linhas; j++) for (let i = 0; i < cols; i++) pads.push({ numero: String(j * cols + i + 1), x: arred(x + 1.27 + i * 2.54), y: arred(y + 1.27 + j * 2.54), l: 1.7, a: 1.7, forma: i === 0 && j === 0 ? 'retangulo' : 'redondo', furo: 1 });
  return pads;
};

const ehFuroMontagem = (c: Componente): boolean => c.forma === 'furos' && !c.parte && Math.max(c.l, c.a) / Math.min(c.l, c.a) < 1.6 && Math.max(c.l, c.a) <= 7;

const sobrepoe = (a: Retangulo, b: Retangulo, folga = 0): boolean => a.x - folga < b.x + b.l && b.x - folga < a.x + a.l && a.y - folga < b.y + b.a && b.y - folga < a.y + a.a;

const rotaOctilinear = (x1: number, y1: number, x2: number, y2: number, inverter: boolean): [number, number][] => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const diag = Math.min(adx, ady);
  if (diag < 1e-6 || Math.abs(adx - ady) < 1e-6) return [[x1, y1], [x2, y2]];
  if (adx > ady) {
    const reto = adx - diag;
    return inverter ? [[x1, y1], [x1 + sx * diag, y1 + sy * diag], [x2, y2]] : [[x1, y1], [x1 + sx * reto, y1], [x2, y2]];
  }
  const reto = ady - diag;
  return inverter ? [[x1, y1], [x1 + sx * diag, y1 + sy * diag], [x2, y2]] : [[x1, y1], [x1, y1 + sy * reto], [x2, y2]];
};

const cache = new Map<string, ProjetoPcb>();

export const projetoDe = (placa: Placa): ProjetoPcb => {
  const pronto = cache.get(placa.id);
  if (pronto) return pronto;
  const d = placa.desenho;
  const L = d.largura;
  const A = d.altura;
  const s = Math.min(3, Math.max(1, Math.max(L, A) / 75));
  const aleatorio = semente(placa.id);
  const contagem = new Map<string, number>();
  const footprints: Footprint[] = [];
  const furos: Furo[] = [];
  const textos: TextoSerigrafia[] = [];
  const antenas: Antena[] = [];
  const tamanhoTexto = Math.min(3, Math.max(0.9, Math.max(L, A) / 80));

  d.componentes.forEach((c, indice) => {
    if (ehFuroMontagem(c)) {
      furos.push({ x: c.x + c.l / 2, y: c.y + c.a / 2, d: Math.min(c.l, c.a) * 0.55, anel: Math.min(c.l, c.a) * 0.95 });
      return;
    }
    const modelo = classificar(c, placa);
    if (modelo === 'texto') {
      textos.push({ x: c.x + c.l / 2, y: c.y + c.a / 2, texto: c.rotulo ?? '', tamanho: Math.min(c.a * 0.8, tamanhoTexto * 2.2) });
      return;
    }
    if (modelo === 'antena') {
      const horizontal = c.l > c.a * 1.6;
      const quadrada = !horizontal && c.a < c.l * 1.6;
      const pontos: [number, number][] = [];
      if (quadrada && c.l > 20) {
        const voltas = 4;
        for (let v = 0; v < voltas; v++) {
          const m = 1 + v * 1.6;
          pontos.push([c.x + m, c.y + m], [c.x + c.l - m, c.y + m], [c.x + c.l - m, c.y + c.a - m], [c.x + m + 1.6, c.y + c.a - m], [c.x + m + 1.6, c.y + m + 1.6]);
        }
      } else if (horizontal || quadrada) {
        const n = Math.max(3, Math.floor(c.l / 2.2));
        const passo = c.l / n;
        for (let i = 0; i <= n; i++) {
          const xx = c.x + i * passo;
          pontos.push(i % 2 ? [xx, c.y + c.a * 0.85] : [xx, c.y + c.a * 0.15]);
          if (i < n) pontos.push(i % 2 ? [xx + passo, c.y + c.a * 0.85] : [xx + passo, c.y + c.a * 0.15]);
        }
      } else {
        const n = Math.max(3, Math.floor(c.a / 2.2));
        const passo = c.a / n;
        for (let i = 0; i <= n; i++) {
          const yy = c.y + i * passo;
          pontos.push(i % 2 ? [c.x + c.l * 0.85, yy] : [c.x + c.l * 0.15, yy]);
          if (i < n) pontos.push(i % 2 ? [c.x + c.l * 0.85, yy + passo] : [c.x + c.l * 0.15, yy + passo]);
        }
      }
      antenas.push({ pontos, largura: Math.max(0.4, Math.min(c.l, c.a) * 0.06), area: { x: c.x, y: c.y, l: c.l, a: c.a }, elevada: c.z > 0.3 ? c.z : 0 });
    }
    const prefixo = PREFIXO[modelo];
    const n = (contagem.get(prefixo) ?? 0) + 1;
    contagem.set(prefixo, n);
    const brutos = gerarPads(modelo, c, placa);
    const pads = brutos.pads.filter((q) => q.x >= 0 && q.y >= 0 && q.x <= L && q.y <= A);
    const matrizes = brutos.matrizes;
    const corpo = { x: c.x, y: c.y, l: c.l, a: c.a };
    const silk: Segmento[] = modelo === 'antena' || modelo === 'submodulo' || modelo === 'cabo' || modelo === 'fpc' || modelo === 'pads' ? [] : rectSilk(corpo, 0.25 * Math.min(s, 1.6));
    const silkCirculos: { x: number; y: number; r: number }[] = [];
    if (['qfn', 'qfp', 'soic', 'dip', 'sot'].includes(modelo)) silkCirculos.push({ x: c.x - 0.6, y: c.y - 0.6, r: 0.25 });
    if (modelo === 'eletrolitico' || modelo === 'led-tht' || modelo === 'transdutor') silkCirculos.push({ x: c.x + c.l / 2, y: c.y + c.a / 2, r: Math.min(c.l, c.a) / 2 + 0.25 });
    const acima = c.y - tamanhoTexto * 0.9 - 0.4;
    const abaixo = c.y + c.a + tamanhoTexto * 0.9 + 0.4;
    const refPos = acima > tamanhoTexto ? { x: c.x + c.l / 2, y: acima } : abaixo < A - 0.5 ? { x: c.x + c.l / 2, y: abaixo } : { x: c.x + c.l / 2, y: c.y + c.a / 2 };
    const contagemPads = pads.filter((p) => p.numero !== 'SH').length + matrizes.reduce((t, m) => t + Math.floor(m.l / m.passo) * Math.floor(m.a / m.passo), 0);
    footprints.push({
      indice,
      ref: `${prefixo}${n}`,
      valor: c.rotulo ?? VALOR_PADRAO[modelo] ?? modelo.toUpperCase(),
      biblioteca: biblioteca(modelo, c, contagemPads),
      modelo,
      comp: c,
      parte: c.parte ?? null,
      corpo,
      pads,
      matrizes,
      silk,
      silkCirculos,
      patio: { x: c.x - 0.5, y: c.y - 0.5, l: c.l + 1, a: c.a + 1 },
      refPos,
      tht: pads.some((p) => p.furo > 0),
    });
  });

  const comPads = footprints.filter((f) => f.pads.length > 0 && f.modelo !== 'antena');
  const centro = (f: Footprint): [number, number] => [f.corpo.x + f.corpo.l / 2, f.corpo.y + f.corpo.a / 2];
  const dentro = (px: number, py: number): boolean => px > 0.6 && py > 0.6 && px < L - 0.6 && py < A - 0.6;
  const trilhas: Trilha[] = [];
  const vias: Via[] = [];
  const largSinal = 0.25 * s;
  const largForca = 0.6 * s;
  const viaD = 0.8 * s;
  const viaFuro = 0.4 * s;
  const usados = new Set<string>();
  const limite = Math.min(140, comPads.length * 3);
  for (const f of comPads) {
    if (trilhas.length >= limite) break;
    const [cx, cy] = centro(f);
    const vizinhos = comPads
      .filter((g) => g !== f)
      .map((g) => ({ g, dist: Math.hypot(centro(g)[0] - cx, centro(g)[1] - cy) }))
      .sort((p, q) => p.dist - q.dist)
      .slice(0, 3);
    const quantas = Math.min(f.pads.length, 1 + Math.floor(aleatorio() * 3));
    for (let k = 0; k < quantas && vizinhos.length; k++) {
      const alvo = vizinhos[Math.floor(aleatorio() * vizinhos.length)]?.g;
      const pa = f.pads[Math.floor(aleatorio() * f.pads.length)];
      const pb = alvo?.pads[Math.floor(aleatorio() * alvo.pads.length)];
      if (!alvo || !pa || !pb || !dentro(pa.x, pa.y) || !dentro(pb.x, pb.y)) continue;
      const chave = [pa.x, pa.y, pb.x, pb.y].map((v) => v.toFixed(2)).join(':');
      if (usados.has(chave)) continue;
      usados.add(chave);
      const forca = ['energia', 'regulador', 'alimentacao', 'usb', 'atx24', 'eps', 'vrm'].includes(f.parte ?? '') && aleatorio() < 0.6;
      const largura = forca ? largForca : largSinal;
      const inverter = aleatorio() < 0.5;
      if (aleatorio() < 0.72) {
        trilhas.push({ pontos: rotaOctilinear(pa.x, pa.y, pb.x, pb.y, inverter), largura, camada: 'F.Cu' });
      } else {
        const oitavo = Math.round(Math.atan2(pb.y - pa.y, pb.x - pa.x) / (Math.PI / 4));
        const passoX = Math.round(Math.cos((oitavo * Math.PI) / 4));
        const passoY = Math.round(Math.sin((oitavo * Math.PI) / 4));
        const desloc = arred((1.4 * s) / (passoX && passoY ? Math.SQRT2 : 1));
        const v1: [number, number] = [pa.x + passoX * desloc, pa.y + passoY * desloc];
        const v2: [number, number] = [pb.x - passoX * desloc, pb.y - passoY * desloc];
        if (!dentro(v1[0], v1[1]) || !dentro(v2[0], v2[1])) continue;
        trilhas.push({ pontos: [[pa.x, pa.y], v1], largura, camada: 'F.Cu' });
        trilhas.push({ pontos: rotaOctilinear(v1[0], v1[1], v2[0], v2[1], inverter), largura, camada: 'B.Cu' });
        trilhas.push({ pontos: [v2, [pb.x, pb.y]], largura, camada: 'F.Cu' });
        vias.push({ x: v1[0], y: v1[1], d: viaD, furo: viaFuro }, { x: v2[0], y: v2[1], d: viaD, furo: viaFuro });
      }
    }
  }

  const passoCostura = 6 * s;
  const margem = 1.8 * s;
  const ocupado = (px: number, py: number): boolean => footprints.some((f) => sobrepoe(f.patio, { x: px - viaD, y: py - viaD, l: viaD * 2, a: viaD * 2 })) || furos.some((h) => Math.hypot(h.x - px, h.y - py) < h.anel / 2 + viaD);
  for (let px = margem; px <= L - margem; px += passoCostura) {
    for (const py of [margem, A - margem]) if (!ocupado(px, py)) vias.push({ x: arred(px), y: arred(py), d: viaD, furo: viaFuro });
  }
  for (let py = margem + passoCostura; py <= A - margem - passoCostura / 2; py += passoCostura) {
    for (const px of [margem, L - margem]) if (!ocupado(px, py)) vias.push({ x: arred(px), y: arred(py), d: viaD, furo: viaFuro });
  }

  const acabamento: Acabamento = HASL.includes(d.cor) ? 'hasl' : 'enig';
  const projeto: ProjetoPcb = {
    placa,
    largura: L,
    altura: A,
    espessura: d.espessura ?? 1.6,
    escala: s,
    raio: Math.min(3, Math.max(0.5, Math.min(L, A) * 0.03)),
    corMascara: COR_MASCARA[d.cor],
    corSerigrafia: SERIGRAFIA_ESCURA.includes(d.cor) ? '#111111' : '#f2f2ee',
    acabamento,
    footprints,
    trilhas,
    vias,
    furos,
    textos,
    antenas,
  };
  cache.set(placa.id, projeto);
  return projeto;
};

export const nomeArquivo = (placa: Placa): string => `${placa.id}.kicad_pcb`;
