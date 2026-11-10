import type { CorFio, Fiacao } from '../dados/tipos';
import { tr, ui } from '../i18n/textos';
import { h, s, trocar } from './dom';
import { icone } from './icones';

export const COR_FIO: Record<CorFio, string> = {
  vermelho: '#e5484d',
  preto: '#8f8c8b',
  amarelo: '#f5c400',
  verde: '#30a46c',
  azul: '#3e8ef7',
  laranja: '#f76b15',
  branco: '#e8e8e8',
  roxo: '#8e4ec6',
  cinza: '#a0a0a0',
  marrom: '#a0613a',
};

const pesoPino = (nome: string): number => {
  const n = nome.toUpperCase();
  if (n.startsWith('GND')) return 0;
  if (n.startsWith('3V3') || n.startsWith('3.3')) return 1;
  if (n.startsWith('5V') || n.startsWith('VIN')) return 2;
  const numero = /(\d+)/.exec(n);
  return 10 + (numero ? Number(numero[1]) : 99);
};

export const montarFiacao = (fiacao: Fiacao): { el: HTMLElement; destruir: () => void } => {
  const fios = fiacao.ligacoes;
  const destinos = [...new Set(fios.map((f) => f.para))].sort((a, b) => pesoPino(a) - pesoPino(b) || a.localeCompare(b));
  const passoY = 34;
  const altura = Math.max(fios.length, destinos.length) * passoY + 50;
  const largura = 640;
  const svg = s('svg', { class: 'fiacao-svg', viewBox: `0 0 ${largura} ${altura}`, role: 'img', 'aria-label': fiacao.modulo });
  const yModulo = (i: number): number => 46 + i * passoY;
  const yPlaca = (i: number): number => 46 + i * passoY;
  let atual = -1;
  let tocando = false;
  let temporizador = 0;

  const status = h('p', { class: 'fiacao-status' });
  const botaoTocar = h('button', { class: 'botao', type: 'button' });

  const desenhar = (): void => {
    svg.replaceChildren();
    svg.append(
      s('rect', { class: 'fiacao-caixa', x: 8, y: 14, width: 200, height: altura - 24, rx: 8 }),
      s('rect', { class: 'fiacao-caixa', x: largura - 208, y: 14, width: 200, height: altura - 24, rx: 8 }),
      s('text', { class: 'fiacao-titulo', x: 20, y: 32 }, fiacao.modulo),
      s('text', { class: 'fiacao-titulo', x: largura - 196, y: 32 }, ui('pinoPlaca')),
    );
    fios.forEach((f, i) => {
      const j = destinos.indexOf(f.para);
      const visivel = atual < 0 || i <= atual;
      const foco = atual >= 0 && i === atual;
      const x1 = 208;
      const y1 = yModulo(i);
      const x2 = largura - 208;
      const y2 = yPlaca(j);
      if (visivel) {
        svg.append(
          s('path', {
            class: `fio${foco ? ' foco' : ''}`,
            d: `M${x1} ${y1} C${x1 + 110} ${y1}, ${x2 - 110} ${y2}, ${x2} ${y2}`,
            stroke: COR_FIO[f.cor],
          }),
        );
      }
      svg.append(
        s('circle', { class: 'fiacao-pino', cx: x1, cy: y1, r: 4, fill: visivel ? COR_FIO[f.cor] : 'none' }),
        s('text', { class: `fiacao-rotulo${foco ? ' foco' : ''}`, x: 196, y: y1 + 4, 'text-anchor': 'end' }, f.de),
      );
    });
    destinos.forEach((d, j) => {
      const usado = fios.some((f, i) => f.para === d && (atual < 0 || i <= atual));
      svg.append(
        s('circle', { class: 'fiacao-pino', cx: largura - 208, cy: yPlaca(j), r: 4, fill: usado ? 'currentColor' : 'none' }),
        s('text', { class: 'fiacao-rotulo', x: largura - 196, y: yPlaca(j) + 4 }, d),
      );
    });
    const f = fios[atual];
    status.textContent = f ? `${ui('fioDe', { a: atual + 1, b: fios.length })}: ${f.de} → ${f.para} · ${tr(f.nota)}` : ui('todosFios', { n: fios.length });
    trocar(botaoTocar, icone(tocando ? 'pausar' : 'tocar', 'icone mini'), tocando ? ui('pausar') : ui('tocar'));
  };

  const ir = (i: number): void => {
    atual = Math.max(-1, Math.min(fios.length - 1, i));
    desenhar();
  };

  const parar = (): void => {
    tocando = false;
    window.clearInterval(temporizador);
    desenhar();
  };

  botaoTocar.addEventListener('click', () => {
    if (tocando) {
      parar();
      return;
    }
    tocando = true;
    if (atual < 0 || atual >= fios.length - 1) atual = -1;
    ir(atual + 1);
    temporizador = window.setInterval(() => {
      if (atual >= fios.length - 1) {
        parar();
        return;
      }
      ir(atual + 1);
    }, 1300);
  });

  const controles = h(
    'div',
    { class: 'fiacao-controles' },
    h('button', { class: 'botao', type: 'button', onclick: () => { parar(); ir(atual <= 0 ? fios.length - 1 : atual - 1); } }, icone('esquerda', 'icone mini'), ui('anterior')),
    botaoTocar,
    h('button', { class: 'botao', type: 'button', onclick: () => { parar(); ir(atual >= fios.length - 1 ? 0 : atual + 1); } }, ui('proximo'), icone('direita', 'icone mini')),
    h('button', { class: 'botao', type: 'button', onclick: () => { parar(); ir(-1); } }, ui('mostrarTodos')),
    h('span', { class: 'fiacao-contagem mono' }, `${fios.length}`),
  );

  const tabela = h(
    'table',
    { class: 'tabela' },
    h('thead', {}, h('tr', {}, h('th', {}, ui('pinoModulo')), h('th', {}, ui('pinoPlaca')), h('th', {}, ui('notas')))),
    h(
      'tbody',
      {},
      ...fios.map((f, i) => {
        const cor = h('span', { class: 'fio-cor', 'aria-hidden': 'true' });
        cor.style.setProperty('--fio', COR_FIO[f.cor]);
        return h('tr', { onclick: () => { parar(); ir(i); } }, h('td', { class: 'mono' }, cor, f.de), h('td', {}, h('span', { class: 'pino-placa mono' }, f.para)), h('td', {}, tr(f.nota)));
      }),
    ),
  );

  desenhar();
  return { el: h('div', { class: 'fiacao' }, controles, svg, status, tabela), destruir: () => window.clearInterval(temporizador) };
};
