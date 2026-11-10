import { h, trocar } from '../dom';
import { abas, L, quadroSim, type Simulador } from './base';

const hex = (n: number): string => n.toString(16).toUpperCase().padStart(2, '0');

export const simRfid = (): Simulador => {
  let presente = false;
  let vista: 'cartao' | 'memoria' | 'creditos' = 'cartao';
  let saldo = 25;
  let leituras = 0;
  const uid = [0x9c, 0x4f, 0x2a, 0x1b];
  const corpo = h('div', { class: 'sim-corpo' });
  const cartao = h('div', { class: 'rfid-cartao', 'aria-hidden': 'true' }, h('span', { class: 'rfid-chip' }), h('span', { class: 'rfid-ondas' }));
  const botao = h('button', { class: 'botao', type: 'button' });

  const blocoValor = (v: number): number[] => {
    const b = [v & 0xff, (v >> 8) & 0xff, 0, 0];
    const inv = b.map((x) => ~x & 0xff);
    return [...b, ...inv, ...b, 4, 0xfb, 4, 0xfb];
  };

  const desenhar = (): void => {
    cartao.classList.toggle('perto', presente);
    trocar(botao, presente ? L('Afastar cartão', 'Remove card') : L('Aproximar cartão', 'Tap card'));
    if (!presente) {
      trocar(corpo, h('p', { class: 'vazio' }, L('Aproxime o cartão para ler.', 'Tap the card to read it.')));
      return;
    }
    if (vista === 'cartao') {
      trocar(
        corpo,
        h(
          'dl',
          { class: 'rfid-dados' },
          h('dt', {}, 'UID'), h('dd', { class: 'mono' }, uid.map(hex).join(' ')),
          h('dt', {}, 'ATQA'), h('dd', { class: 'mono' }, '00 04'),
          h('dt', {}, 'SAK'), h('dd', { class: 'mono' }, '08'),
          h('dt', {}, L('tipo', 'type')), h('dd', {}, 'MIFARE Classic 1K'),
          h('dt', {}, 'BCC'), h('dd', { class: 'mono' }, hex(uid.reduce((a, b) => a ^ b, 0))),
          h('dt', {}, L('leituras', 'reads')), h('dd', { class: 'mono' }, String(leituras)),
        ),
      );
    } else if (vista === 'memoria') {
      const celulas: HTMLElement[] = [];
      for (let setor = 0; setor < 16; setor++) {
        for (let bloco = 0; bloco < 4; bloco++) {
          const n = setor * 4 + bloco;
          const tipo = n === 0 ? 'fabricante' : bloco === 3 ? 'trailer' : n === 4 ? 'valor' : n === 1 || n === 2 || n === 8 ? 'dados' : 'vazio';
          celulas.push(h('span', { class: `rfid-bloco ${tipo}`, title: `${L('setor', 'sector')} ${setor} · ${L('bloco', 'block')} ${n} · ${tipo}` }));
        }
      }
      trocar(
        corpo,
        h('div', { class: 'rfid-memoria' }, ...celulas),
        h('ul', { class: 'legenda pequena' }, ...[['fabricante', L('fabricante (UID)', 'maker (UID)')], ['vazio', L('vazio', 'empty')], ['dados', L('dados', 'data')], ['valor', L('valor', 'value')], ['trailer', L('chaves e permissões', 'keys and access')]].map(([c, t]) => h('li', { class: `rfid-leg ${c}` }, t ?? ''))),
        h('p', { class: 'sim-nota' }, L('16 setores × 4 blocos × 16 bytes = 1 KB. Cada coluna aqui é um setor.', '16 sectors × 4 blocks × 16 bytes = 1 KB. Each column here is a sector.')),
      );
    } else {
      trocar(
        corpo,
        h('div', { class: 'rfid-saldo' }, h('span', { class: 'rotulo' }, L('saldo no bloco 4', 'balance in block 4')), h('strong', { class: 'mono' }, String(saldo))),
        h('div', { class: 'sim-chips' }, h('button', { class: 'chip', type: 'button', onclick: () => { saldo = Math.max(0, saldo - 1); desenhar(); } }, '− 1'), h('button', { class: 'chip', type: 'button', onclick: () => { saldo += 5; desenhar(); } }, '+ 5')),
        h('p', { class: 'mono rfid-hex' }, blocoValor(saldo).map(hex).join(' ')),
        h('p', { class: 'sim-nota' }, L('Bloco de valor: o número, o inverso e de novo o número, para o leitor detectar corrupção.', 'Value block: the number, its inverse and the number again, so the reader detects corruption.')),
      );
    }
  };

  botao.addEventListener('click', () => {
    presente = !presente;
    if (presente) leituras++;
    desenhar();
  });
  cartao.addEventListener('click', () => botao.click());
  desenhar();
  const el = quadroSim(
    'rc522 · SPI 10 MHz',
    h('div', { class: 'rfid-topo' }, cartao, botao),
    abas([['cartao', L('cartão', 'card')], ['memoria', L('memória', 'memory')], ['creditos', L('créditos', 'credits')]] as const, 'cartao', (v) => { vista = v; desenhar(); }),
    corpo,
  );
  return { el, destruir: () => undefined };
};
