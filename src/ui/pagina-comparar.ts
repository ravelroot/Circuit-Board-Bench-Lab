import type { Contexto, Pagina } from '../app/contexto';
import { placaBancada } from '../dados/bancada3d';
import { labsDaPlaca } from '../dados/laboratorios';
import { placaPorId, PLACAS } from '../dados/placas';
import type { Placa } from '../dados/tipos';
import { nomeCategoria, ORDEM_CATEGORIAS, tr, ui } from '../i18n/textos';
import { h } from './dom';
import { icone } from './icones';
import { miniatura } from './kicad/miniaturas';

export const montarPaginaComparar = (ctx: Contexto, idA: string | null, idB: string | null): Pagina => {
  const a = placaPorId(idA) ?? placaPorId('uno-r3') ?? PLACAS[0];
  const b = placaPorId(idB) ?? (a?.id === 'esp32-s3' ? placaPorId('uno-r3') : placaPorId('esp32-s3')) ?? PLACAS[1];
  if (!a || !b) return { el: h('p', {}, ui('naoEncontrada')), destruir: () => undefined };

  const ir = (novaA: string, novaB: string): void => ctx.navegar({ pagina: 'comparar', placa: novaA, lab: null, extra: novaB });

  const seletor = (atual: Placa, rotulo: string, mudar: (id: string) => void): HTMLSelectElement => {
    const s = h(
      'select',
      { class: 'campo', 'aria-label': rotulo },
      ...ORDEM_CATEGORIAS.map((cat) => h('optgroup', { label: nomeCategoria(cat) }, ...PLACAS.filter((p) => p.categoria === cat).map((p) => h('option', { value: p.id, selected: p.id === atual.id }, p.nome)))),
    );
    s.addEventListener('change', () => mudar(s.value));
    return s;
  };

  const coluna = (p: Placa, outra: Placa, lado: 'a' | 'b'): HTMLElement => {
    const pb = placaBancada(p.id);
    return h(
      'div',
      { class: 'comparar-coluna', 'data-placa': p.id },
      seletor(p, lado === 'a' ? ui('placaA') : ui('placaB'), (id) => (lado === 'a' ? ir(id, outra.id) : ir(outra.id, id))),
      miniatura(p),
      h('h2', { class: 'comparar-nome' }, p.nome),
      h('p', { class: 'comparar-meta mono' }, `${tr(p.fabricante)} · ${nomeCategoria(p.categoria)}${pb ? ` · ${pb.logica}` : ''}`),
      h('p', {}, tr(p.resumo)),
      h(
        'div',
        { class: 'comparar-acoes' },
        h('a', { class: 'botao', href: `#/${p.id}`, onclick: (ev: Event) => { ev.preventDefault(); ctx.navegar({ pagina: 'placa', placa: p.id, lab: null }); } }, ui('abrirPlaca')),
        h('a', { class: 'botao', href: `#/${p.id}/montar`, onclick: (ev: Event) => { ev.preventDefault(); ctx.navegar({ pagina: 'montagem', placa: p.id, lab: null }); } }, icone('ferro', 'icone mini'), ui('monteAPlaca')),
      ),
    );
  };

  const rotulos = [...new Map([...a.especificacoes, ...b.especificacoes].map((e) => [e.rotulo.pt, e.rotulo])).values()];
  const valor = (p: Placa, pt: string): string => {
    const e = p.especificacoes.find((x) => x.rotulo.pt === pt);
    return e ? tr(e.valor) : '—';
  };
  const linhas: [string, string, string][] = [
    ...rotulos.map((r): [string, string, string] => [tr(r), valor(a, r.pt), valor(b, r.pt)]),
    [ui('partesExplicadas'), String(a.partes.length), String(b.partes.length)],
    [ui('laboratorios'), String(labsDaPlaca(a.id).length), String(labsDaPlaca(b.id).length)],
    [ui('paraQueServe'), tr(a.usos), tr(b.usos)],
  ];
  const tabela = h(
    'table',
    { class: 'tabela comparar-tabela' },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, ''), h('th', { scope: 'col' }, a.nome), h('th', { scope: 'col' }, b.nome))),
    h('tbody', {}, ...linhas.map(([r, va, vb]) => h('tr', { class: va !== vb ? 'difere' : '' }, h('th', { scope: 'row' }, r), h('td', {}, va), h('td', {}, vb)))),
  );
  const partes = (p: Placa): HTMLElement => h('div', {}, h('h3', { class: 'rotulo' }, p.nome), h('ul', { class: 'comparar-partes' }, ...p.partes.map((x) => h('li', {}, h('strong', {}, tr(x.nome)), ' ', tr(x.funcao)))));

  const el = h(
    'div',
    { class: 'pagina-comparar' },
    h('header', { class: 'bancada3d-topo' }, h('p', { class: 'heroi-kicker mono' }, ui('kickerComparar')), h('h1', { class: 'bancada3d-titulo' }, ui('tituloComparar')), h('p', {}, ui('resumoComparar'))),
    h(
      'section',
      { class: 'secao comparar' },
      h('div', { class: 'comparar-colunas' }, coluna(a, b, 'a'), h('button', { class: 'botao-icone comparar-trocar', type: 'button', title: ui('trocarLados'), 'aria-label': ui('trocarLados'), onclick: () => ir(b.id, a.id) }, icone('trocar')), coluna(b, a, 'b')),
      tabela,
    ),
    h('section', { class: 'secao comparar-partes-grade' }, partes(a), partes(b)),
  );
  return { el, destruir: () => undefined };
};
