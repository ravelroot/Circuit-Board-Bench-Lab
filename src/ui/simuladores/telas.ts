import type { Previa } from '../../dados/tipos';
import { h, trocar } from '../dom';
import { L, quadroSim, type Simulador } from './base';

export const simTela = (p: Extract<Previa, { tipo: 'tela' }>): Simulador => {
  let i = 0;
  const tela = h('button', { class: `tela-sim tela-${p.modelo}`, type: 'button', 'aria-label': L('próxima tela', 'next screen') });
  const indicador = h('span', { class: 'mono sim-rodape' });
  const desenhar = (): void => {
    const linhas = p.telas[i] ?? [];
    if (p.modelo === 'lcd1602') {
      trocar(tela, ...[0, 1].map((n) => h('span', { class: 'lcd-linha' }, ...[...(linhas[n] ?? '').padEnd(16, ' ').slice(0, 16)].map((ch) => h('i', {}, ch)))));
    } else {
      trocar(tela, ...linhas.map((l, n) => h('span', { class: n === 0 ? 'tela-titulo' : 'tela-linha' }, l)));
    }
    indicador.textContent = `${i + 1}/${p.telas.length}`;
  };
  const proxima = (): void => {
    i = (i + 1) % p.telas.length;
    desenhar();
  };
  tela.addEventListener('click', proxima);
  desenhar();
  const el = quadroSim(
    p.modelo === 'lcd1602' ? 'LCD 16×2 · I²C 0x27' : 'ST7789 · 170×320 · SPI',
    h('div', { class: 'tela-moldura' }, tela),
    h('div', { class: 'sim-chips' }, h('button', { class: 'chip', type: 'button', onclick: proxima }, p.modelo === 'lcd1602' ? L('avançar', 'next') : 'BOOT'), indicador),
  );
  return { el, destruir: () => undefined };
};

type Funcao = '3v3' | '5v' | 'gnd' | 'gpio' | 'i2c' | 'spi' | 'uart' | 'pwm' | 'id';

const PINOS: readonly (readonly [number, string, Funcao, string])[] = [
  [1, '3V3', '3v3', ''], [2, '5V', '5v', ''], [3, 'GPIO2', 'i2c', 'SDA1'], [4, '5V', '5v', ''], [5, 'GPIO3', 'i2c', 'SCL1'], [6, 'GND', 'gnd', ''],
  [7, 'GPIO4', 'gpio', 'GPCLK0'], [8, 'GPIO14', 'uart', 'TXD0'], [9, 'GND', 'gnd', ''], [10, 'GPIO15', 'uart', 'RXD0'], [11, 'GPIO17', 'gpio', ''], [12, 'GPIO18', 'pwm', 'PWM0 · PCM_CLK'],
  [13, 'GPIO27', 'gpio', ''], [14, 'GND', 'gnd', ''], [15, 'GPIO22', 'gpio', ''], [16, 'GPIO23', 'gpio', ''], [17, '3V3', '3v3', ''], [18, 'GPIO24', 'gpio', ''],
  [19, 'GPIO10', 'spi', 'MOSI0'], [20, 'GND', 'gnd', ''], [21, 'GPIO9', 'spi', 'MISO0'], [22, 'GPIO25', 'gpio', ''], [23, 'GPIO11', 'spi', 'SCLK0'], [24, 'GPIO8', 'spi', 'CE0'],
  [25, 'GND', 'gnd', ''], [26, 'GPIO7', 'spi', 'CE1'], [27, 'GPIO0', 'id', 'ID_SD (EEPROM do HAT)'], [28, 'GPIO1', 'id', 'ID_SC (EEPROM do HAT)'], [29, 'GPIO5', 'gpio', ''], [30, 'GND', 'gnd', ''],
  [31, 'GPIO6', 'gpio', ''], [32, 'GPIO12', 'pwm', 'PWM0'], [33, 'GPIO13', 'pwm', 'PWM1'], [34, 'GND', 'gnd', ''], [35, 'GPIO19', 'pwm', 'PWM1 · PCM_FS'], [36, 'GPIO16', 'gpio', ''],
  [37, 'GPIO26', 'gpio', ''], [38, 'GPIO20', 'gpio', 'PCM_DIN'], [39, 'GND', 'gnd', ''], [40, 'GPIO21', 'gpio', 'PCM_DOUT'],
];

export const simPinagem = (): Simulador => {
  let filtro: Funcao | 'todos' = 'todos';
  let escolhido = 11;
  const grade = h('div', { class: 'pinagem' });
  const detalhe = h('div', { class: 'pinagem-detalhe' });
  const nomes: Record<Funcao | 'todos', string> = { todos: L('todos', 'all'), '3v3': '3,3 V', '5v': '5 V', gnd: 'GND', gpio: 'GPIO', i2c: 'I²C', spi: 'SPI', uart: 'UART', pwm: 'PWM', id: 'ID EEPROM' };
  const desenhar = (): void => {
    trocar(
      grade,
      ...PINOS.map(([n, nome, f]) =>
        h('button', { class: `pino f-${f}${filtro !== 'todos' && filtro !== f ? ' apagado' : ''}${n === escolhido ? ' ativo' : ''}`, type: 'button', title: `${n} · ${nome}`, onclick: () => { escolhido = n; desenhar(); } }, h('span', { class: 'mono' }, String(n))),
      ),
    );
    const p = PINOS.find((x) => x[0] === escolhido);
    if (!p) return;
    const [n, nome, f, extra] = p;
    trocar(
      detalhe,
      h('strong', { class: 'mono' }, `${L('pino', 'pin')} ${n}`),
      h('span', { class: `etiqueta f-${f}` }, nomes[f]),
      h('p', {}, nome.startsWith('GPIO') ? `BCM ${nome.slice(4)} · ${L('3,3 V, até 16 mA', '3.3 V, up to 16 mA')}` : nome),
      extra ? h('p', { class: 'mono' }, extra) : null,
      h('p', { class: 'sim-nota' }, L('Ímpares do lado de dentro, pares na borda. O pino 1 tem ilha quadrada.', 'Odd numbers on the inside, even on the edge. Pin 1 has a square pad.')),
    );
  };
  const filtros = h('div', { class: 'sim-chips' }, ...(Object.keys(nomes) as (Funcao | 'todos')[]).map((f) => h('button', { class: `chip f-${f}`, type: 'button', 'aria-pressed': String(f === filtro), onclick: (ev: Event) => { filtro = f; for (const b of filtros.children) b.setAttribute('aria-pressed', String(b === ev.currentTarget)); desenhar(); } }, nomes[f])));
  desenhar();
  return { el: quadroSim('pinout · 40 pin header', filtros, h('div', { class: 'pinagem-corpo' }, grade, detalhe)), destruir: () => undefined };
};
