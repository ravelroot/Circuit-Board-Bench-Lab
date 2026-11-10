import type { Previa } from '../../dados/tipos';
import { estilo, h, s, trocar } from '../dom';
import { deslizador, fmt, L, quadroSim, type Simulador } from './base';

const ondaQuadrada = (duty: number, periodos: number, largura: number, alto: number, baixo: number): string => {
  const p: string[] = [`M0 ${baixo}`];
  const w = largura / periodos;
  for (let i = 0; i < periodos; i++) {
    const x = i * w;
    const xa = x + w * duty;
    p.push(`L${x} ${baixo}`, `L${x} ${alto}`, `L${xa} ${alto}`, `L${xa} ${baixo}`, `L${x + w} ${baixo}`);
  }
  return p.join(' ');
};

export const simPwm = (p: Extract<Previa, { tipo: 'pwm' }>): Simulador => {
  let valor = 128;
  const svg = s('svg', { class: 'sinal-svg', viewBox: '0 0 520 120', preserveAspectRatio: 'none' });
  const led = h('span', { class: 'sim-led grande', 'data-modo': 'aceso' });
  const leitura = h('p', { class: 'sim-rodape mono' });
  const desenhar = (): void => {
    const duty = valor / 255;
    svg.replaceChildren(
      s('path', { class: 'sinal-traco', d: ondaQuadrada(duty, 5, 520, 18, 100) }),
      s('line', { class: 'sinal-media', x1: 0, x2: 520, y1: 100 - duty * 82, y2: 100 - duty * 82 }),
    );
    estilo(led, { '--led': '#ffcf3a', '--brilho': (0.08 + duty * 0.92).toFixed(2) });
    leitura.textContent = `analogWrite(9, ${valor}) · ${Math.round(duty * 100)}% · ${L('média', 'average')} ${fmt(p.tensao * duty, 2)} V · ${p.frequencia} Hz`;
  };
  const ctrl = deslizador(L('ciclo de trabalho', 'duty cycle'), 0, 255, 1, valor, (v) => { valor = v; ctrl.saida.textContent = String(v); desenhar(); });
  ctrl.saida.textContent = String(valor);
  desenhar();
  return { el: quadroSim(`PWM · ${p.frequencia} Hz`, h('div', { class: 'sinal-corpo' }, svg, led), ctrl.el, leitura), destruir: () => undefined };
};

export const simServo = (): Simulador => {
  let angulo = 90;
  const braco = s('g', { class: 'servo-braco' }, s('rect', { x: -6, y: -70, width: 12, height: 76, rx: 6 }), s('circle', { cx: 0, cy: 0, r: 10 }));
  const desenho = s('svg', { class: 'servo-svg', viewBox: '-110 -100 220 140' }, s('rect', { class: 'servo-corpo', x: -60, y: -20, width: 120, height: 56, rx: 6 }), s('path', { class: 'servo-arco', d: 'M-80 0 A80 80 0 0 1 80 0' }), braco);
  const pulso = s('svg', { class: 'sinal-svg', viewBox: '0 0 520 90', preserveAspectRatio: 'none' });
  const leitura = h('p', { class: 'sim-rodape mono' });
  const desenhar = (): void => {
    const us = Math.round(544 + (angulo * (2400 - 544)) / 180);
    braco.setAttribute('transform', `rotate(${angulo - 90})`);
    pulso.replaceChildren(s('path', { class: 'sinal-traco', d: ondaQuadrada(us / 20000, 3, 520, 14, 76) }));
    leitura.textContent = `servo.write(${angulo}) · ${L('pulso', 'pulse')} ${us} µs / 20 ms · A0 ≈ ${Math.round((angulo / 180) * 1023)}`;
  };
  const ctrl = deslizador(L('potenciômetro', 'potentiometer'), 0, 180, 1, angulo, (v) => { angulo = v; ctrl.saida.textContent = `${v}°`; desenhar(); });
  ctrl.saida.textContent = `${angulo}°`;
  desenhar();
  return { el: quadroSim('SG90 · 50 Hz', desenho, ctrl.el, pulso, leitura), destruir: () => undefined };
};

export const simDistancia = (): Simulador => {
  let cm = 60;
  const cena = s('svg', { class: 'dist-svg', viewBox: '0 0 520 120' });
  const tempos = s('svg', { class: 'sinal-svg', viewBox: '0 0 520 90', preserveAspectRatio: 'none' });
  const leitura = h('p', { class: 'sim-rodape mono' });
  const desenhar = (): void => {
    const x = 70 + (cm / 400) * 420;
    const us = Math.round(cm * 58);
    cena.replaceChildren(
      s('rect', { class: 'dist-sensor', x: 10, y: 38, width: 46, height: 44, rx: 4 }),
      s('circle', { class: 'dist-olho', cx: 22, cy: 60, r: 9 }),
      s('circle', { class: 'dist-olho', cx: 44, cy: 60, r: 9 }),
      s('path', { class: 'dist-onda', d: `M60 60 Q${(60 + x) / 2} 30 ${x} 60` }),
      s('path', { class: 'dist-onda volta', d: `M${x} 60 Q${(60 + x) / 2} 90 60 60` }),
      s('rect', { class: 'dist-objeto', x, y: 14, width: 14, height: 92 }),
      s('text', { class: 'eixo-texto', x: (60 + x) / 2, y: 112, 'text-anchor': 'middle' }, `${cm} cm`),
    );
    const larg = Math.min(440, 20 + us / 60);
    tempos.replaceChildren(
      s('text', { class: 'eixo-texto', x: 0, y: 16 }, 'TRIG'),
      s('path', { class: 'sinal-traco', d: 'M50 36 L60 36 L60 14 L66 14 L66 36 L520 36' }),
      s('text', { class: 'eixo-texto', x: 0, y: 64 }, 'ECHO'),
      s('path', { class: 'sinal-traco eco', d: `M50 84 L74 84 L74 60 L${74 + larg} 60 L${74 + larg} 84 L520 84` }),
    );
    leitura.textContent = `pulseIn = ${us} µs · ${us} / 58 = ${fmt(us / 58, 1)} cm`;
  };
  const ctrl = deslizador(L('distância do objeto', 'object distance'), 2, 400, 1, cm, (v) => { cm = v; ctrl.saida.textContent = `${v} cm`; desenhar(); });
  ctrl.saida.textContent = `${cm} cm`;
  desenhar();
  return { el: quadroSim('HC-SR04 · 40 kHz', cena, ctrl.el, tempos, leitura), destruir: () => undefined };
};

const R_VALORES = [1000, 4700, 10000, 22000, 47000, 100000, 220000];
const C_VALORES = [1e-6, 4.7e-6, 10e-6, 47e-6, 100e-6];
const fmtR = (r: number): string => (r >= 1000 ? `${fmt(r / 1000, r % 1000 ? 1 : 0)} kΩ` : `${r} Ω`);
const fmtC = (c: number): string => `${fmt(c * 1e6, c * 1e6 % 1 ? 1 : 0)} µF`;

export const simTimer555 = (): Simulador => {
  let r1 = 1000;
  let r2 = 47000;
  let c = 10e-6;
  const svg = s('svg', { class: 'sinal-svg alto', viewBox: '0 0 520 180', preserveAspectRatio: 'none' });
  const led = h('span', { class: 'sim-led grande', 'data-modo': 'pisca555' });
  const leitura = h('p', { class: 'sim-rodape mono' });
  const seletor = (rotulo: string, valores: readonly number[], atual: number, formato: (v: number) => string, aoMudar: (v: number) => void): HTMLElement => {
    const sel = h('select', { class: 'campo', 'aria-label': rotulo }, ...valores.map((v) => h('option', { value: v, selected: v === atual }, formato(v))));
    sel.addEventListener('change', () => aoMudar(Number(sel.value)));
    return h('label', { class: 'sim-seletor' }, h('span', { class: 'rotulo' }, rotulo), sel);
  };
  const desenhar = (): void => {
    const th = 0.693 * (r1 + r2) * c;
    const tl = 0.693 * r2 * c;
    const periodo = th + tl;
    const f = 1 / periodo;
    const duty = th / periodo;
    const pontosC: string[] = [];
    const pontosS: string[] = [];
    const ciclos = 3;
    const escalaX = 520 / (ciclos * periodo);
    for (let k = 0; k < ciclos; k++) {
      const x0 = k * periodo;
      for (let i = 0; i <= 20; i++) {
        const tt = (i / 20) * th;
        const v = 1 - (2 / 3) * Math.exp(-tt / ((r1 + r2) * c));
        pontosC.push(`${((x0 + tt) * escalaX).toFixed(1)},${(110 - v * 90).toFixed(1)}`);
      }
      for (let i = 0; i <= 20; i++) {
        const tt = (i / 20) * tl;
        const v = (2 / 3) * Math.exp(-tt / (r2 * c));
        pontosC.push(`${((x0 + th + tt) * escalaX).toFixed(1)},${(110 - v * 90).toFixed(1)}`);
      }
      const xa = x0 * escalaX;
      const xb = (x0 + th) * escalaX;
      const xc = (x0 + periodo) * escalaX;
      pontosS.push(`${xa},176 ${xa},132 ${xb},132 ${xb},176 ${xc},176`);
    }
    svg.replaceChildren(
      s('line', { class: 'sinal-media', x1: 0, x2: 520, y1: 110 - (2 / 3) * 90, y2: 110 - (2 / 3) * 90 }),
      s('line', { class: 'sinal-media', x1: 0, x2: 520, y1: 110 - (1 / 3) * 90, y2: 110 - (1 / 3) * 90 }),
      s('text', { class: 'eixo-texto', x: 4, y: 46 }, '2/3 VCC'),
      s('text', { class: 'eixo-texto', x: 4, y: 76 }, '1/3 VCC'),
      s('polyline', { class: 'sinal-traco cap', points: pontosC.join(' ') }),
      s('polyline', { class: 'sinal-traco', points: pontosS.join(' ') }),
    );
    estilo(led, { '--led': '#ff3b30', '--periodo': `${Math.max(0.04, periodo).toFixed(3)}s`, '--duty': `${Math.round(duty * 100)}%` });
    led.dataset.modo = f > 25 ? 'aceso' : 'pisca555';
    leitura.textContent = `f = ${fmt(f, 2)} Hz · ${L('alto', 'high')} ${fmt(th * 1000, 0)} ms · ${L('baixo', 'low')} ${fmt(tl * 1000, 0)} ms · duty ${Math.round(duty * 100)}%`;
  };
  desenhar();
  return {
    el: quadroSim(
      'NE555 · astable',
      h('div', { class: 'sim-seletores' }, seletor('R1', R_VALORES, r1, fmtR, (v) => { r1 = v; desenhar(); }), seletor('R2', R_VALORES, r2, fmtR, (v) => { r2 = v; desenhar(); }), seletor('C', C_VALORES, c, fmtC, (v) => { c = v; desenhar(); }), led),
      svg,
      leitura,
    ),
    destruir: () => undefined,
  };
};

export const simRegulador = (): Simulador => {
  let vin = 12;
  let carga = 0.5;
  let dissipador = false;
  const painel = h('div', { class: 'regulador-painel' });
  const medidor = h('div', { class: 'medidor termico' }, h('span', { class: 'medidor-barra' }));
  const desenhar = (): void => {
    const vout = Math.min(5, Math.max(0, vin - 2));
    const regulando = vin >= 7;
    const p = Math.max(0, (vin - vout) * carga);
    const theta = dissipador ? 20 : 65;
    const tj = 25 + p * theta;
    const corta = tj > 125;
    const eficiencia = vin > 0 ? (vout * carga) / (vin * carga || 1) : 0;
    medidor.style.setProperty('--pct', `${Math.min(100, (tj / 150) * 100)}%`);
    medidor.classList.toggle('alerta', tj > 100);
    trocar(
      painel,
      h('div', {}, h('span', { class: 'rotulo' }, L('saída', 'output')), h('strong', { class: 'mono' }, corta ? '0 V' : `${fmt(vout, 2)} V`)),
      h('div', {}, h('span', { class: 'rotulo' }, L('calor', 'heat')), h('strong', { class: 'mono' }, `${fmt(p, 2)} W`)),
      h('div', {}, h('span', { class: 'rotulo' }, L('chip', 'die')), h('strong', { class: 'mono' }, `${fmt(Math.min(tj, 150), 0)} °C`)),
      h('div', {}, h('span', { class: 'rotulo' }, L('eficiência', 'efficiency')), h('strong', { class: 'mono' }, `${Math.round(eficiencia * 100)}%`)),
      h('p', { class: `regulador-estado${corta ? ' erro' : !regulando ? ' aviso' : ''}` }, corta ? L('Proteção térmica: o 7805 desligou.', 'Thermal shutdown: the 7805 turned off.') : !regulando ? L('Abaixo de 7 V o 7805 não regula: a saída cai junto.', 'Below 7 V the 7805 cannot regulate: the output sags.') : tj > 100 ? L('Muito quente: use dissipador ou um buck.', 'Very hot: add a heatsink or use a buck.') : L('Regulando bem.', 'Regulating fine.')),
    );
  };
  const a = deslizador(L('entrada', 'input'), 5, 24, 0.5, vin, (v) => { vin = v; a.saida.textContent = `${fmt(v, 1)} V`; desenhar(); });
  a.saida.textContent = `${fmt(vin, 1)} V`;
  const b = deslizador(L('carga', 'load'), 0, 1.5, 0.05, carga, (v) => { carga = v; b.saida.textContent = `${fmt(v, 2)} A`; desenhar(); });
  b.saida.textContent = `${fmt(carga, 2)} A`;
  const caixa = h('input', { type: 'checkbox' });
  caixa.addEventListener('change', () => { dissipador = caixa.checked; desenhar(); });
  desenhar();
  return { el: quadroSim('LM7805 · TO-220', a.el, b.el, h('label', { class: 'sim-caixa' }, caixa, L('com dissipador (20 °C/W)', 'with heatsink (20 °C/W)')), medidor, painel), destruir: () => undefined };
};

export const simPonteH = (): Simulador => {
  let in1 = true;
  let in2 = false;
  let pwm = 180;
  const svg = s('svg', { class: 'ponteh-svg', viewBox: '0 0 320 220' });
  const tabela = h('table', { class: 'tabela pequena' });
  const leitura = h('p', { class: 'sim-rodape mono' });
  const desenhar = (): void => {
    const ativo = pwm > 0;
    const frente = in1 && !in2 && ativo;
    const tras = in2 && !in1 && ativo;
    const freio = in1 === in2 && ativo;
    const chave = (x: number, y: number, rotulo: string, ligada: boolean): SVGGElement => s('g', { class: `ponteh-chave${ligada ? ' ligada' : ''}` }, s('rect', { x, y, width: 44, height: 34, rx: 6 }), s('text', { x: x + 22, y: y + 22, 'text-anchor': 'middle' }, rotulo));
    const velocidade = Math.max(0.4, 3 - (pwm / 255) * 2.6);
    const rotor = s('g', { class: `ponteh-rotor${frente ? ' frente' : tras ? ' tras' : ''}` }, s('circle', { cx: 160, cy: 110, r: 30 }), s('path', { d: 'M160 84 L168 98 L152 98 Z' }));
    rotor.style.setProperty('--vel', `${velocidade.toFixed(2)}s`);
    svg.replaceChildren(
      s('path', { class: 'ponteh-trilho', d: 'M40 20 H280 M40 200 H280 M62 20 V200 M258 20 V200 M62 110 H130 M190 110 H258' }),
      s('path', { class: `ponteh-corrente${frente ? ' ativa' : ''}`, d: 'M62 20 V110 H130 M190 110 H258 V200' }),
      s('path', { class: `ponteh-corrente${tras ? ' ativa' : ''}`, d: 'M258 20 V110 H190 M130 110 H62 V200' }),
      chave(40, 42, 'Q1', frente || (freio && in1)),
      chave(236, 42, 'Q2', tras || (freio && in1)),
      chave(40, 146, 'Q3', tras || (freio && !in1)),
      chave(236, 146, 'Q4', frente || (freio && !in1)),
      s('text', { class: 'eixo-texto', x: 160, y: 14, 'text-anchor': 'middle' }, '+12 V'),
      s('text', { class: 'eixo-texto', x: 160, y: 216, 'text-anchor': 'middle' }, 'GND'),
      rotor,
    );
    const linhas: readonly (readonly [string, string, string, boolean])[] = [
      ['1', '0', L('frente', 'forward'), frente],
      ['0', '1', L('ré', 'reverse'), tras],
      ['1', '1', L('freio', 'brake'), freio && in1],
      ['0', '0', L('freio', 'brake'), freio && !in1],
      ['x', 'x', L('ENA = 0: livre', 'ENA = 0: coast'), !ativo],
    ];
    trocar(tabela, h('thead', {}, h('tr', {}, h('th', {}, 'IN1'), h('th', {}, 'IN2'), h('th', {}, L('motor', 'motor')))), h('tbody', {}, ...linhas.map(([a, b, c, on]) => h('tr', { class: on ? 'ativa' : '' }, h('td', { class: 'mono' }, a), h('td', { class: 'mono' }, b), h('td', {}, c)))));
    leitura.textContent = `IN1=${in1 ? 1 : 0} IN2=${in2 ? 1 : 0} ENA=${pwm} (${Math.round((pwm / 255) * 100)}%)`;
    b1.setAttribute('aria-pressed', String(in1));
    b2.setAttribute('aria-pressed', String(in2));
  };
  const b1 = h('button', { class: 'chip mono', type: 'button', onclick: () => { in1 = !in1; desenhar(); } }, 'IN1');
  const b2 = h('button', { class: 'chip mono', type: 'button', onclick: () => { in2 = !in2; desenhar(); } }, 'IN2');
  const ctrl = deslizador('ENA (PWM)', 0, 255, 1, pwm, (v) => { pwm = v; ctrl.saida.textContent = String(v); desenhar(); });
  ctrl.saida.textContent = String(pwm);
  desenhar();
  return { el: quadroSim('L298N · H-bridge A', h('div', { class: 'sim-chips' }, b1, b2), ctrl.el, h('div', { class: 'ponteh-corpo' }, svg, tabela), leitura), destruir: () => undefined };
};
