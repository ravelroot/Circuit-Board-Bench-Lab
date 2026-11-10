import type { Contexto } from '../app/contexto';
import { LABORATORIOS } from '../dados/laboratorios';
import { placaPorId, PLACAS } from '../dados/placas';
import type { Rota } from '../app/estado';
import { nomeCategoria, tr, ui, type ChaveTexto } from '../i18n/textos';
import { h, trocar } from './dom';
import { icone } from './icones';

interface Resultado {
  readonly tipo: 'placa' | 'lab';
  readonly titulo: string;
  readonly detalhe: string;
  readonly alvo: string;
  readonly rota: Rota;
}

const normalizar = (v: string): string => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const indice = (): { r: Resultado; chave: string; titulo: string }[] => [
  ...PLACAS.map((p) => ({
    r: { tipo: 'placa' as const, titulo: p.nome, detalhe: tr(p.resumo), alvo: nomeCategoria(p.categoria), rota: { pagina: 'placa' as const, placa: p.id, lab: null } },
    chave: normalizar([p.nome, p.sigla, p.id, p.resumo.pt, p.resumo.en, ...p.partes.flatMap((x) => [x.nome.pt, x.nome.en])].join(' ')),
    titulo: normalizar([p.nome, p.sigla, p.id].join(' ')),
  })),
  ...LABORATORIOS.map((l) => ({
    r: { tipo: 'lab' as const, titulo: tr(l.titulo), detalhe: tr(l.resumo), alvo: placaPorId(l.placa)?.nome ?? l.placa, rota: { pagina: 'lab' as const, placa: l.placa, lab: l.id } },
    chave: normalizar([l.titulo.pt, l.titulo.en, l.resumo.pt, l.resumo.en, l.id, l.placa].join(' ')),
    titulo: normalizar([l.titulo.pt, l.titulo.en, l.id].join(' ')),
  })),
];

export const montarBusca = (ctx: Contexto): HTMLDialogElement => {
  const { loja } = ctx;
  const campo = h('input', { class: 'busca-campo', type: 'search', autocomplete: 'off', spellcheck: 'false' });
  const resultados = h('ul', { class: 'busca-resultados', role: 'listbox' });
  const rodape = h('div', { class: 'busca-rodape' });
  const dialogo = h('dialog', { class: 'dialogo busca' }, h('div', { class: 'busca-topo' }, icone('busca'), campo, h('kbd', {}, 'Esc')), resultados, rodape);
  let selecionado = 0;
  let encontrados: Resultado[] = [];
  let base = indice();

  const abrir = (r: Resultado): void => {
    loja.alterar({ busca: false });
    ctx.navegar(r.rota);
  };

  const desenhar = (): void => {
    const termos = normalizar(campo.value).split(/\s+/).filter(Boolean);
    const pontuar = (x: { titulo: string }): number => termos.reduce((soma, t) => soma + (x.titulo.includes(t) ? 2 : 0) + (x.titulo.startsWith(t) ? 1 : 0), 0);
    encontrados = base
      .filter((x) => termos.every((t) => x.chave.includes(t)))
      .map((x, i) => ({ x, i, nota: pontuar(x) }))
      .sort((a, b) => b.nota - a.nota || a.i - b.i)
      .map(({ x }) => x.r)
      .slice(0, 40);
    selecionado = Math.min(selecionado, Math.max(0, encontrados.length - 1));
    if (encontrados.length === 0) {
      trocar(resultados, h('li', { class: 'vazio' }, ui('nenhumResultado')));
      return;
    }
    trocar(
      resultados,
      ...encontrados.map((r, i) =>
        h(
          'li',
          { role: 'option', 'aria-selected': String(i === selecionado) },
          h(
            'button',
            { type: 'button', onclick: () => abrir(r), onmousemove: () => { if (selecionado !== i) { selecionado = i; desenhar(); } } },
            h('span', { class: `busca-tipo tipo-${r.tipo}` }, r.tipo === 'placa' ? ui('tipoPlaca') : ui('tipoLab')),
            h('b', {}, r.titulo),
            h('span', {}, r.detalhe),
            h('small', {}, r.alvo),
          ),
        ),
      ),
    );
    resultados.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };

  campo.addEventListener('input', () => {
    selecionado = 0;
    desenhar();
  });
  campo.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      selecionado = Math.min(encontrados.length - 1, selecionado + 1);
      desenhar();
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      selecionado = Math.max(0, selecionado - 1);
      desenhar();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const alvo = encontrados[selecionado];
      if (alvo) abrir(alvo);
    }
  });
  dialogo.addEventListener('close', () => loja.alterar({ busca: false }));
  dialogo.addEventListener('click', (ev) => {
    if (ev.target === dialogo) dialogo.close();
  });

  const sincronizar = (): void => {
    if (loja.atual.busca && !dialogo.open) {
      base = indice();
      campo.value = '';
      campo.placeholder = ui('buscar');
      trocar(rodape, h('span', {}, h('kbd', {}, '↑'), h('kbd', {}, '↓'), ' ', ui('navegar')), h('span', {}, h('kbd', {}, 'Enter'), ' ', ui('abrir')));
      selecionado = 0;
      desenhar();
      dialogo.showModal();
      campo.focus();
    } else if (!loja.atual.busca && dialogo.open) {
      dialogo.close();
    }
  };
  loja.assinar((e, a) => {
    if (e.busca !== a.busca) sincronizar();
  });
  return dialogo;
};

const ATALHOS: readonly (readonly [readonly string[], ChaveTexto])[] = [
  [['Ctrl', 'K'], 'atalhoBuscar'],
  [['/'], 'atalhoBuscar'],
  [['P'], 'atalhoCatalogo'],
  [[',', '.'], 'atalhoPlaca'],
  [['[', ']'], 'atalhoLab'],
  [['←', '→', '↑', '↓'], 'atalhoGiro'],
  [['E'], 'atalhoExplodir'],
  [['T'], 'atalhoTema'],
  [['C'], 'atalhoPaleta'],
  [['L'], 'atalhoIdioma'],
  [['Esc'], 'atalhoFechar'],
  [['?'], 'atalhoAjuda'],
];

export const montarAjuda = (ctx: Contexto): HTMLDialogElement => {
  const { loja } = ctx;
  const titulo = h('h2', { class: 'titulo-secao' });
  const lista = h('dl', { class: 'atalhos' });
  const fechar = h('button', { class: 'botao-icone', type: 'button', onclick: () => dialogo.close() }, icone('fechar'));
  const dialogo = h('dialog', { class: 'dialogo ajuda' }, h('div', { class: 'ajuda-topo' }, titulo, fechar), lista);

  const desenhar = (): void => {
    titulo.textContent = ui('atalhos');
    fechar.setAttribute('aria-label', ui('fechar'));
    trocar(lista, ...ATALHOS.flatMap(([teclas, chave]) => [h('dt', {}, ...teclas.map((k) => h('kbd', {}, k))), h('dd', {}, ui(chave))]));
  };

  dialogo.addEventListener('close', () => loja.alterar({ ajuda: false }));
  dialogo.addEventListener('click', (ev) => {
    if (ev.target === dialogo) dialogo.close();
  });
  loja.assinar((e, a) => {
    if (e.ajuda !== a.ajuda) {
      if (e.ajuda && !dialogo.open) {
        desenhar();
        dialogo.showModal();
      } else if (!e.ajuda && dialogo.open) {
        dialogo.close();
      }
    }
  });
  return dialogo;
};
