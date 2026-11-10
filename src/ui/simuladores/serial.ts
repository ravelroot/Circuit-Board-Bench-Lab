import type { EstadoLed, Previa } from '../../dados/tipos';
import { ui } from '../../i18n/textos';
import { h } from '../dom';
import { quadroSim, Relogio, type Simulador } from './base';

type PreviaSerial = Extract<Previa, { tipo: 'serial' }>;

const hora = (): string => {
  const d = new Date();
  const p = (n: number, t = 2): string => String(n).padStart(t, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
};

export const simSerial = (p: PreviaSerial): Simulador => {
  const relogio = new Relogio();
  const log = h('ol', { class: 'serial-log', 'aria-live': 'polite' });
  const led = p.led ? h('span', { class: 'sim-led', role: 'img' }) : null;
  const definirLed = (estado: EstadoLed): void => {
    if (!led) return;
    led.dataset.modo = estado.modo;
    led.style.setProperty('--led', estado.cor);
    led.setAttribute('aria-label', estado.modo);
  };
  if (p.led) definirLed(p.led);

  const adicionar = (texto: string, tipo: 'saida' | 'entrada' | 'erro'): void => {
    log.append(h('li', { class: `serial-${tipo}` }, h('span', { class: 'serial-hora' }, hora()), h('span', {}, tipo === 'entrada' ? `> ${texto}` : texto)));
    while (log.childElementCount > 200) log.firstElementChild?.remove();
    log.scrollTop = log.scrollHeight;
  };

  const executar = (bruto: string): void => {
    const cmd = bruto.trim();
    if (!cmd) return;
    adicionar(cmd, 'entrada');
    const achado = p.comandos.find((c) => c.nome.toLowerCase() === cmd.toLowerCase()) ?? p.comandos.find((c) => cmd.toLowerCase().startsWith(c.nome.split(' ')[0]?.toLowerCase() ?? '\u0000'));
    if (!achado) {
      relogio.depois(() => adicionar(ui('comandoDesconhecido', { c: cmd }), 'erro'), 80);
      return;
    }
    achado.resposta.forEach((linha, i) => relogio.depois(() => adicionar(linha, 'saida'), 90 + i * 70));
    if (achado.led) definirLed(achado.led);
  };

  const campo = h('input', { class: 'serial-campo mono', type: 'text', placeholder: ui('digiteComando'), 'aria-label': ui('digiteComando'), autocomplete: 'off', spellcheck: 'false' });
  campo.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      executar(campo.value);
      campo.value = '';
    }
  });
  const chips = h(
    'div',
    { class: 'serial-chips' },
    ...p.comandos.map((c) => h('button', { class: 'chip mono', type: 'button', onclick: () => executar(c.nome) }, c.nome)),
    h('button', { class: 'chip fantasma', type: 'button', onclick: () => log.replaceChildren() }, ui('limparTela')),
  );

  p.inicio.forEach((linha, i) => relogio.depois(() => adicionar(linha, 'saida'), 150 + i * 160));
  if (p.periodico) {
    let i = 0;
    const linhas = p.periodico.linhas;
    relogio.intervalo(() => {
      const linha = linhas[i % linhas.length];
      if (linha) adicionar(linha, 'saida');
      i++;
    }, p.periodico.ms);
  }

  const el = quadroSim(
    p.titulo ?? ui('monitorSerial'),
    h('div', { class: 'serial-corpo' }, led ? h('div', { class: 'serial-placa' }, led) : null, log),
    h('div', { class: 'serial-entrada' }, campo, h('button', { class: 'botao', type: 'button', onclick: () => { executar(campo.value); campo.value = ''; } }, ui('enviar'))),
    chips,
  );
  return { el, destruir: () => relogio.parar() };
};
