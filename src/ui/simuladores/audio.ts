import { h, s } from '../dom';
import { abas, deslizador, fmt, L, quadroSim, Relogio, type Simulador } from './base';

type Onda = 'sine' | 'square' | 'triangle' | 'sawtooth';

const NOTAS: readonly (readonly [string, number, boolean, string])[] = [
  ['C4', 261.63, false, 'a'], ['C#4', 277.18, true, 'w'], ['D4', 293.66, false, 's'], ['D#4', 311.13, true, 'e'], ['E4', 329.63, false, 'd'],
  ['F4', 349.23, false, 'f'], ['F#4', 369.99, true, 't'], ['G4', 392.0, false, 'g'], ['G#4', 415.3, true, 'y'], ['A4', 440.0, false, 'h'],
  ['A#4', 466.16, true, 'u'], ['B4', 493.88, false, 'j'], ['C5', 523.25, false, 'k'],
];

const amostra = (onda: Onda, fase: number): number => {
  const x = fase - Math.floor(fase);
  if (onda === 'sine') return Math.sin(2 * Math.PI * x);
  if (onda === 'square') return x < 0.5 ? 1 : -1;
  if (onda === 'triangle') return x < 0.5 ? 4 * x - 1 : 3 - 4 * x;
  return 2 * x - 1;
};

const harmonicos = (onda: Onda): number[] =>
  Array.from({ length: 8 }, (_, i) => {
    const n = i + 1;
    if (onda === 'sine') return n === 1 ? 1 : 0;
    if (onda === 'square') return n % 2 ? 1 / n : 0;
    if (onda === 'triangle') return n % 2 ? 1 / (n * n) : 0;
    return 1 / n;
  });

export const simSintetizador = (): Simulador => {
  let onda: Onda = 'sine';
  let volume = 0.5;
  let freq = 440;
  let contexto: AudioContext | null = null;
  const vozes = new Map<string, { osc: OscillatorNode; ganho: GainNode }>();
  const tela = s('svg', { class: 'synth-escopo', viewBox: '0 0 520 120', preserveAspectRatio: 'none' });
  const espectro = s('svg', { class: 'synth-espectro', viewBox: '0 0 520 60', preserveAspectRatio: 'none' });
  const leitura = h('p', { class: 'sim-rodape mono' });

  const desenhar = (): void => {
    const pontos: string[] = [];
    const periodos = Math.max(1, Math.min(6, freq / 110));
    for (let i = 0; i <= 260; i++) pontos.push(`${(i * 2).toFixed(0)},${(60 - amostra(onda, (i / 260) * periodos) * 46 * volume * 1.6).toFixed(1)}`);
    tela.replaceChildren(s('line', { class: 'escopo-zero', x1: 0, y1: 60, x2: 520, y2: 60 }), s('polyline', { class: 'escopo-traco', points: pontos.join(' ') }));
    espectro.replaceChildren(...harmonicos(onda).map((a, i) => s('rect', { class: 'espectro-barra', x: 8 + i * 64, y: 58 - a * 54, width: 48, height: a * 54 })));
    leitura.textContent = `${onda} · ${fmt(freq, 2)} Hz · vol ${Math.round(volume * 100)}% · 16 kHz I²S`;
  };

  const ligar = (nome: string, f: number): void => {
    freq = f;
    desenhar();
    for (const t of teclas) t.classList.toggle('tocando', t.dataset.nota === nome || t.classList.contains('tocando'));
    try {
      contexto ??= new AudioContext();
      if (vozes.has(nome)) return;
      const osc = contexto.createOscillator();
      const ganho = contexto.createGain();
      osc.type = onda;
      osc.frequency.value = f;
      ganho.gain.setValueAtTime(0, contexto.currentTime);
      ganho.gain.linearRampToValueAtTime(volume * 0.18, contexto.currentTime + 0.02);
      osc.connect(ganho).connect(contexto.destination);
      osc.start();
      vozes.set(nome, { osc, ganho });
    } catch {
      return;
    }
  };

  const desligar = (nome: string): void => {
    for (const t of teclas) if (t.dataset.nota === nome) t.classList.remove('tocando');
    const voz = vozes.get(nome);
    if (!voz || !contexto) return;
    voz.ganho.gain.cancelScheduledValues(contexto.currentTime);
    voz.ganho.gain.setValueAtTime(voz.ganho.gain.value, contexto.currentTime);
    voz.ganho.gain.linearRampToValueAtTime(0, contexto.currentTime + 0.25);
    voz.osc.stop(contexto.currentTime + 0.3);
    vozes.delete(nome);
  };

  const teclas = NOTAS.map(([nome, f, preta, atalho]) => {
    const b = h('button', { class: `tecla${preta ? ' preta' : ''}`, type: 'button', 'data-nota': nome, 'aria-label': nome }, h('span', {}, nome), h('kbd', {}, atalho.toUpperCase()));
    b.addEventListener('pointerdown', (ev) => { b.setPointerCapture(ev.pointerId); ligar(nome, f); });
    b.addEventListener('pointerup', () => desligar(nome));
    b.addEventListener('pointercancel', () => desligar(nome));
    return b;
  });
  const vol = deslizador(L('volume', 'volume'), 0, 1, 0.05, volume, (v) => { volume = v; vol.saida.textContent = `${Math.round(v * 100)}%`; desenhar(); });
  vol.saida.textContent = '50%';
  const el = quadroSim(
    'synth · MAX98357A',
    abas([['sine', L('senoide', 'sine')], ['square', L('quadrada', 'square')], ['triangle', L('triângulo', 'triangle')], ['sawtooth', L('serra', 'saw')]] as const, 'sine', (v) => { onda = v; for (const x of vozes.values()) x.osc.type = v; desenhar(); }),
    tela,
    espectro,
    h('div', { class: 'teclado' }, ...teclas),
    vol.el,
    leitura,
  );
  el.tabIndex = 0;
  el.addEventListener('keydown', (ev) => {
    if (ev.repeat || ev.target instanceof HTMLInputElement) return;
    const nota = NOTAS.find((n) => n[3] === ev.key.toLowerCase());
    if (nota) { ev.preventDefault(); ligar(nota[0], nota[1]); }
  });
  el.addEventListener('keyup', (ev) => {
    const nota = NOTAS.find((n) => n[3] === ev.key.toLowerCase());
    if (nota) desligar(nota[0]);
  });
  desenhar();
  return {
    el,
    destruir: () => {
      for (const nome of [...vozes.keys()]) desligar(nome);
      void contexto?.close().catch(() => undefined);
    },
  };
};

type Som = 'palma' | 'duas' | 'fala' | 'assobio' | 'silencio';

const sinal = (som: Som, t: number): number => {
  const ciclo = t % 2.4;
  const ruido = (Math.random() - 0.5) * 0.04;
  if (som === 'silencio') return ruido;
  if (som === 'assobio') return Math.sin(2 * Math.PI * 1800 * t) * 0.55 + ruido;
  if (som === 'fala') return (Math.sin(2 * Math.PI * 180 * t) * 0.4 + Math.sin(2 * Math.PI * 540 * t) * 0.2) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 3 * t)) + ruido;
  const golpe = (inicio: number): number => (ciclo > inicio && ciclo < inicio + 0.12 ? Math.exp(-(ciclo - inicio) * 40) * (Math.random() - 0.5) * 2 : 0);
  return golpe(0.3) + (som === 'duas' ? golpe(0.6) : 0) + ruido;
};

export const simMicrofone = (): Simulador => {
  const relogio = new Relogio();
  let som: Som = 'palma';
  let vista: 'escopo' | 'bias' | 'comparador' = 'escopo';
  let limiar = 0.35;
  let disparos = 0;
  let acima = false;
  const canvas = h('canvas', { class: 'mic-canvas', width: 1040, height: 300 });
  const leitura = h('p', { class: 'sim-rodape mono' });
  const lampada = h('span', { class: 'mic-lampada', 'aria-hidden': 'true' });
  const lim = deslizador(L('limiar do comparador', 'comparator threshold'), 0.05, 0.9, 0.01, limiar, (v) => { limiar = v; lim.saida.textContent = `${Math.round(v * 3300)} mV`; });
  lim.saida.textContent = `${Math.round(limiar * 3300)} mV`;
  const historico: number[] = [];
  let t = 0;

  relogio.animar(() => {
    const g = canvas.getContext('2d');
    if (!g) return;
    for (let i = 0; i < 24; i++) {
      t += 1 / 4000;
      historico.push(sinal(som, t));
    }
    while (historico.length > 1040) historico.shift();
    const estilo = getComputedStyle(canvas);
    const corA = estilo.getPropertyValue('--c-oliva').trim() || '#9cc787';
    const corB = estilo.getPropertyValue('--c-brasa').trim() || '#e89a87';
    const corT = estilo.getPropertyValue('--texto-4').trim() || '#777';
    g.clearRect(0, 0, 1040, 300);
    g.strokeStyle = corT;
    g.globalAlpha = 0.4;
    g.beginPath();
    g.moveTo(0, 75); g.lineTo(1040, 75); g.moveTo(0, 225); g.lineTo(1040, 225);
    g.stroke();
    g.globalAlpha = 1;
    const traco = (cor: string, y0: number, escala: number, desloc: number): void => {
      g.strokeStyle = cor;
      g.lineWidth = 2;
      g.beginPath();
      historico.forEach((v, i) => (i ? g.lineTo(i, y0 - (v * escala + desloc)) : g.moveTo(i, y0 - (v * escala + desloc))));
      g.stroke();
    };
    const ultimo = Math.abs(historico[historico.length - 1] ?? 0);
    if (vista === 'escopo') {
      traco(corA, 75, 60, 0);
      traco(corB, 225, 40, 0);
      g.fillStyle = corT;
      g.font = '22px IBM Plex Mono, monospace';
      g.fillText('INMP441 · I²S 24 bit', 12, 26);
      g.fillText('KY-037 · AO (ADC)', 12, 176);
    } else if (vista === 'bias') {
      traco(corB, 260, 40, 140);
      g.fillStyle = corT;
      g.font = '22px IBM Plex Mono, monospace';
      g.fillText(L('nível contínuo ~1450 mV: o som oscila em volta dele', 'DC level ~1450 mV: sound swings around it'), 12, 30);
    } else {
      traco(corB, 150, 120, 0);
      g.strokeStyle = corA;
      g.setLineDash([10, 8]);
      g.beginPath();
      g.moveTo(0, 150 - limiar * 120); g.lineTo(1040, 150 - limiar * 120);
      g.moveTo(0, 150 + limiar * 120); g.lineTo(1040, 150 + limiar * 120);
      g.stroke();
      g.setLineDash([]);
    }
    const passou = ultimo > limiar;
    if (passou && !acima) disparos++;
    acima = passou;
    lampada.classList.toggle('acesa', passou);
    leitura.textContent = `inmp441:${Math.round(ultimo * 32767)}  ky037:${Math.round(1450 + ultimo * 900)} mV  DO:${passou ? 1 : 0}  ${L('disparos', 'triggers')}:${disparos}`;
  });

  const el = quadroSim(
    'microfones · I²S + ADC1',
    abas([['palma', L('palma', 'clap')], ['duas', L('duas palmas', 'two claps')], ['fala', L('fala', 'talk')], ['assobio', L('assobio', 'whistle')], ['silencio', L('silêncio', 'silence')]] as const, 'palma', (v) => { som = v; }),
    abas([['escopo', L('escopo', 'scope')], ['bias', 'bias'], ['comparador', L('comparador', 'comparator')]] as const, 'escopo', (v) => { vista = v; }),
    canvas,
    h('div', { class: 'mic-comparador' }, lampada, h('span', {}, 'DO (LM393)'), lim.el),
    leitura,
  );
  return { el, destruir: () => relogio.parar() };
};
