import type { Contexto, Pagina } from '../app/contexto';
import { labsDaPlaca } from '../dados/laboratorios';
import { PLACAS } from '../dados/placas';
import { nomeCategoria, ORDEM_CATEGORIAS, tr, ui } from '../i18n/textos';
import { h } from './dom';
import { miniatura } from './kicad/miniaturas';

export const montarCatalogo = (ctx: Contexto): Pagina => {
  const grupos = ORDEM_CATEGORIAS.map((cat) => {
    const placas = PLACAS.filter((p) => p.categoria === cat);
    return h(
      'section',
      { class: 'catalogo-grupo', id: `grupo-${cat}`, 'aria-labelledby': `cat-${cat}` },
      h('header', { class: 'catalogo-grupo-topo' }, h('h2', { class: 'titulo-secao', id: `cat-${cat}` }, nomeCategoria(cat)), h('span', { class: 'rotulo' }, String(placas.length))),
      h(
        'div',
        { class: 'catalogo-grade' },
        ...placas.map((p) => {
          const labs = labsDaPlaca(p.id).length;
          return h(
            'a',
            { class: 'cartao-placa', href: `#/${p.id}`, 'data-placa': p.id, onclick: (ev: Event) => { ev.preventDefault(); ctx.navegar({ pagina: 'placa', placa: p.id, lab: null }); } },
            miniatura(p),
            h('span', { class: 'cartao-placa-texto' }, h('strong', {}, p.nome), h('span', {}, tr(p.resumo))),
            h(
              'span',
              { class: 'cartao-placa-rodape' },
              h('span', { class: 'etiqueta' }, ui('partesCurto', { n: p.partes.length })),
              h('span', { class: `etiqueta${labs ? ' com-labs' : ''}` }, labs ? ui('labsDaPlaca', { n: labs }) : ui('semLabsCurto')),
            ),
          );
        }),
      ),
    );
  });
  const el = h(
    'div',
    { class: 'catalogo' },
    h('header', { class: 'catalogo-topo' }, h('h1', { class: 'catalogo-titulo' }, ui('catalogoTitulo', { n: PLACAS.length })), h('p', {}, ui('catalogoResumo'))),
    ...grupos,
  );
  return { el, destruir: () => undefined };
};
