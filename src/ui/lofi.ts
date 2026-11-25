const BPM = 74;
const BATIDA = 60 / BPM;
const ACORDES: readonly (readonly number[])[] = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
];
const BAIXOS = [41, 40, 38, 36];

interface Motor {
  readonly ctx: AudioContext;
  readonly mestre: GainNode;
  readonly ruido: AudioBuffer;
  readonly chiado: AudioBufferSourceNode;
  proximo: number;
  passo: number;
  intervalo: number;
}

let motor: Motor | null = null;
const ouvintes = new Set<() => void>();

const hz = (nota: number): number => 440 * Math.pow(2, (nota - 69) / 12);

const avisar = (): void => {
  for (const fn of ouvintes) fn();
};

const criarRuido = (ctx: AudioContext): AudioBuffer => {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;
  return buffer;
};

const criarChiado = (ctx: AudioContext, destino: AudioNode): AudioBufferSourceNode => {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < dados.length; i++) dados[i] = (Math.random() * 2 - 1) * 0.012 + (Math.random() < 0.0004 ? (Math.random() - 0.5) * 0.6 : 0);
  const fonte = ctx.createBufferSource();
  fonte.buffer = buffer;
  fonte.loop = true;
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.value = 2400;
  fonte.connect(filtro).connect(destino);
  fonte.start();
  return fonte;
};

const piano = (m: Motor, nota: number, t: number, duracao: number, volume: number): void => {
  const { ctx } = m;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(volume, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0008, t + duracao);
  g.connect(m.mestre);
  for (const [tipo, mult, nivel] of [['sine', 1, 1], ['triangle', 2, 0.18]] as const) {
    const o = ctx.createOscillator();
    o.type = tipo;
    o.frequency.value = hz(nota) * mult;
    o.detune.value = (Math.random() - 0.5) * 8;
    const n = ctx.createGain();
    n.gain.value = nivel;
    o.connect(n).connect(g);
    o.start(t);
    o.stop(t + duracao + 0.05);
  }
};

const bumbo = (m: Motor, t: number): void => {
  const { ctx } = m;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  g.gain.setValueAtTime(0.55, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  o.connect(g).connect(m.mestre);
  o.start(t);
  o.stop(t + 0.34);
};

const ruidoCurto = (m: Motor, t: number, tipo: BiquadFilterType, freq: number, volume: number, duracao: number): void => {
  const { ctx } = m;
  const fonte = ctx.createBufferSource();
  fonte.buffer = m.ruido;
  const filtro = ctx.createBiquadFilter();
  filtro.type = tipo;
  filtro.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duracao);
  fonte.connect(filtro).connect(g).connect(m.mestre);
  fonte.start(t, Math.random());
  fonte.stop(t + duracao + 0.02);
};

const agendar = (m: Motor): void => {
  const limite = m.ctx.currentTime + 0.35;
  while (m.proximo < limite) {
    const t = m.proximo;
    const oitavo = m.passo % 8;
    const compasso = Math.floor(m.passo / 8) % ACORDES.length;
    const acorde = ACORDES[compasso] ?? ACORDES[0] ?? [];
    if (oitavo === 0) {
      acorde.forEach((nota, i) => piano(m, nota, t + i * 0.018, BATIDA * 3.8, 0.055));
      piano(m, BAIXOS[compasso] ?? 36, t, BATIDA * 1.8, 0.09);
    }
    if (oitavo === 5) piano(m, BAIXOS[compasso] ?? 36, t, BATIDA, 0.06);
    if (oitavo === 0 || oitavo === 5) bumbo(m, t);
    if (oitavo === 2 || oitavo === 6) ruidoCurto(m, t, 'bandpass', 1800, 0.16, 0.16);
    ruidoCurto(m, t, 'highpass', 7000, oitavo % 2 ? 0.025 : 0.04, 0.05);
    if (oitavo === 3 && Math.random() < 0.5) piano(m, (acorde[3] ?? 64) + 12, t, BATIDA * 1.5, 0.025);
    const swing = oitavo % 2 === 0 ? 1.16 : 0.84;
    m.proximo += (BATIDA / 2) * swing;
    m.passo += 1;
  }
};

export const lofiTocando = (): boolean => motor !== null;

export const aoMudarLofi = (fn: () => void): (() => void) => {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
};

export const pararLofi = (): void => {
  if (!motor) return;
  const m = motor;
  motor = null;
  window.clearInterval(m.intervalo);
  m.mestre.gain.setTargetAtTime(0, m.ctx.currentTime, 0.15);
  window.setTimeout(() => void m.ctx.close(), 600);
  avisar();
};

export const tocarLofi = (): boolean => {
  if (motor) return true;
  let ctx: AudioContext;
  try {
    ctx = new AudioContext();
  } catch {
    return false;
  }
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 2600;
  filtro.Q.value = 0.4;
  const mestre = ctx.createGain();
  mestre.gain.setValueAtTime(0, ctx.currentTime);
  mestre.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 1.2);
  mestre.connect(filtro).connect(ctx.destination);
  const m: Motor = { ctx, mestre, ruido: criarRuido(ctx), chiado: criarChiado(ctx, mestre), proximo: ctx.currentTime + 0.1, passo: 0, intervalo: 0 };
  m.intervalo = window.setInterval(() => agendar(m), 90);
  agendar(m);
  motor = m;
  avisar();
  return true;
};

export const alternarLofi = (): boolean => {
  if (motor) {
    pararLofi();
    return false;
  }
  return tocarLofi();
};
