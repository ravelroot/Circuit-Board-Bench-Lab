import { conjuntos, vigiar, type Contexto, type Pagina } from '../app/contexto';
import { alternar, pecasUsadas, resumirBancada, situacao, type Situacao } from '../app/progresso';
import { labsDaPlaca } from '../dados/laboratorios';
import { pecaPorId } from '../dados/pecas';
import { placaPorId, PLACAS } from '../dados/placas';
import type { Laboratorio, Placa } from '../dados/tipos';
import { tr, ui } from '../i18n/textos';
import { estilo, h, s, trocar } from './dom';
import { icone } from './icones';
import { montarJanela } from './kicad/janela';

const dois = (n: number): string => String(n).padStart(2, '0');

const CORES_TEMA = ['#9cc787', '#e2c288', '#99b3bf', '#e89a87', '#c9a8e8', '#8fd3c8', '#f0b37e'];

export const ladrilho = (ctx: Contexto, lab: Laboratorio, sit: Situacao, extra?: string): HTMLAnchorElement =>
  h(
    'a',
    {
      class: `ladrilho sit-${sit}`,
      href: `#/${lab.placa}/${lab.id}`,
      title: tr(lab.resumo),
      onclick: (ev: Event) => {
        ev.preventDefault();
        ctx.navegar({ pagina: 'lab', placa: lab.placa, lab: lab.id });
      },
    },
    h('span', { class: 'ladrilho-icone' }, icone(lab.icone)),
    h('span', { class: 'ladrilho-num mono' }, dois(lab.numero)),
    h('span', { class: 'ladrilho-titulo' }, tr(lab.titulo)),
    extra ? h('small', { class: 'ladrilho-extra' }, extra) : null,
  );

const montarHeroi = (ctx: Contexto, placa: Placa, labs: readonly Laboratorio[]): HTMLElement => {
  const vizinhas = PLACAS.filter((p) => p.categoria === placa.categoria);
  const troca = h(
    'nav',
    { class: 'troca-placa', 'aria-label': ui('placas') },
    ...vizinhas.map((p) =>
      h('a', { class: `chip-placa${p.id === placa.id ? ' atual' : ''}`, href: `#/${p.id}`, 'aria-current': p.id === placa.id ? 'page' : null, onclick: (ev: Event) => { ev.preventDefault(); ctx.navegar({ pagina: 'placa', placa: p.id, lab: null }); } }, p.sigla),
    ),
    h('a', { class: 'chip-placa todas', href: '#/placas', onclick: (ev: Event) => { ev.preventDefault(); ctx.navegar({ pagina: 'catalogo', placa: null, lab: null }); } }, icone('grade', 'icone mini'), ui('catalogoTitulo', { n: PLACAS.length })),
  );

  requestAnimationFrame(() => {
    const atual = troca.querySelector<HTMLElement>('.atual');
    if (!atual || !troca.isConnected) return;
    const caixa = troca.getBoundingClientRect();
    const chip = atual.getBoundingClientRect();
    troca.scrollLeft += chip.left - caixa.left - (caixa.width - chip.width) / 2;
  });

  const ficha = h(
    'aside',
    { class: 'ficha' },
    h('h2', { class: 'rotulo' }, ui('fichaTecnica')),
    h('dl', {}, ...placa.especificacoes.flatMap((e) => [h('dt', {}, tr(e.rotulo)), h('dd', {}, tr(e.valor))])),
    h('h2', { class: 'rotulo' }, ui('paraQueServe')),
    h('p', {}, tr(placa.usos)),
  );

  return h(
    'section',
    { class: 'heroi' },
    troca,
    h(
      'div',
      { class: 'heroi-corpo' },
      h(
        'div',
        { class: 'heroi-texto' },
        h('p', { class: 'heroi-kicker mono' }, `${tr(placa.fabricante)} · ${placa.nome} · ${ui('guiaBancada')}`),
        h('h1', { class: 'heroi-titulo' }, placa.sigla, labs.length ? h('span', { class: 'destaque' }, ' Labs') : null),
        h('p', { class: 'heroi-verbos' }, labs.length ? ui('verbos') : ui('verbosSemLab')),
        h('p', { class: 'heroi-resumo' }, tr(placa.resumo)),
        labs.length ? null : h('p', { class: 'aviso-sem-labs heroi-aviso' }, ui('semLabs')),
      ),
      ficha,
    ),
  );
};

const montarBancada = (ctx: Contexto, placa: Placa, labs: readonly Laboratorio[]): HTMLElement => {
  const { loja } = ctx;
  const usos = pecasUsadas(labs);
  const busca = h('input', { class: 'campo', type: 'search', placeholder: ui('buscarPeca'), 'aria-label': ui('buscarPeca') });
  const botoesPecas = usos.map((u) => {
    const peca = pecaPorId(u.id);
    const nome = peca ? tr(peca.nome) : u.id;
    const b = h(
      'button',
      { class: 'peca-chip', type: 'button', 'data-peca': u.id, 'aria-pressed': 'false', onclick: () => loja.alterar({ bancada: alternar(loja.atual.bancada, u.id) }) },
      h('span', { class: 'peca-check' }, icone('check', 'icone mini')),
      h('span', { class: 'peca-nome' }, nome, h('small', {}, u.labs === 1 ? ui('usadaEmUm') : ui('usadaEm', { n: u.labs }))),
    );
    return { b, chave: nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(), id: u.id };
  });
  busca.addEventListener('input', () => {
    const termo = busca.value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    for (const { b, chave } of botoesPecas) b.hidden = termo !== '' && !chave.includes(termo);
  });
  const lista = h('div', { class: 'pecas-lista' }, ...botoesPecas.map((x) => x.b));
  const direita = h('div', { class: 'bancada-resultado' });

  const desenhar = (): void => {
    const { bancada, feitos } = conjuntos(loja.atual);
    for (const { b, id } of botoesPecas) b.setAttribute('aria-pressed', String(bancada.has(id)));
    const r = resumirBancada(labs, bancada, feitos);
    trocar(
      direita,
      h('p', { class: 'bancada-total' }, h('strong', { class: 'mono' }, String(r.prontos.length)), h('span', { class: 'mono' }, `/${r.total}`), h('span', {}, ui('podeMontar'))),
      h('p', { class: 'bancada-dica' }, ui('marqueAsPecas')),
      h('h3', { class: 'rotulo' }, ui('prontoParaMontar', { n: r.prontos.length })),
      r.prontos.length ? h('div', { class: 'ladrilhos' }, ...r.prontos.map((l) => ladrilho(ctx, l, situacao(l, bancada, feitos)))) : h('p', { class: 'vazio' }, ui('nenhumPronto')),
      r.umaPeca.length ? h('h3', { class: 'rotulo' }, ui('umaPecaLonge', { n: r.umaPeca.length })) : null,
      r.umaPeca.length
        ? h('div', { class: 'ladrilhos' }, ...r.umaPeca.map(({ lab, peca }) => ladrilho(ctx, lab, 'uma', ui('falta', { p: tr(pecaPorId(peca)?.nome ?? peca) }))))
        : null,
      r.mais ? h('p', { class: 'bancada-mais' }, ui('maisPecas', { n: r.mais })) : null,
    );
  };
  desenhar();
  vigiar(loja, direita, (e, a) => {
    if (e.bancada !== a.bancada || e.feitos !== a.feitos) desenhar();
  });

  return h(
    'section',
    { class: 'secao bancada', id: 'bancada' },
    h('h2', { class: 'titulo-secao grande' }, ui('oQueTemBancada')),
    h(
      'div',
      { class: 'bancada-corpo' },
      h(
        'div',
        { class: 'bancada-pecas' },
        h('p', { class: 'bancada-essencial' }, icone('raio', 'icone mini'), ui('todoLab', { texto: tr(placa.essenciais) })),
        h(
          'div',
          { class: 'bancada-ferramentas' },
          busca,
          h('button', { class: 'botao', type: 'button', onclick: () => loja.alterar({ bancada: [...new Set([...loja.atual.bancada, ...usos.map((u) => u.id)])] }) }, ui('tenhoTodas')),
          h('button', { class: 'botao', type: 'button', onclick: () => loja.alterar({ bancada: loja.atual.bancada.filter((id) => !usos.some((u) => u.id === id)) }) }, ui('limpar')),
        ),
        lista,
      ),
      direita,
    ),
  );
};

interface Conheca {
  readonly el: HTMLElement;
  readonly destruir: () => void;
}

const montarConheca = (placa: Placa, labs: readonly Laboratorio[]): Conheca => {
  let escolhida: string | null = null;
  const visor = montarJanela(placa, {
    nomeParte: (id) => tr(placa.partes.find((p) => p.id === id)?.nome ?? id),
    aoEscolher: (id) => escolher(id === escolhida ? null : id),
  });
  const cartoes = new Map<string, HTMLElement>();
  const montarCartao = (indice: number): HTMLElement => {
    const parte = placa.partes[indice];
    if (!parte) return h('div', {});
    const usam = labs.filter((l) => l.partes.includes(parte.id));
    const cartao = h(
      'button',
      { class: 'cartao-parte', type: 'button', 'data-parte': parte.id, 'aria-pressed': 'false', onclick: () => escolher(escolhida === parte.id ? null : parte.id), onmouseenter: () => desenharLinhas(parte.id), onmouseleave: () => desenharLinhas(null) },
      h('span', { class: 'cartao-parte-topo' }, h('span', { class: 'cartao-parte-num mono' }, dois(indice + 1)), h('strong', {}, tr(parte.nome))),
      h('span', { class: 'cartao-parte-linha' }, h('em', {}, ui('oque')), tr(parte.oque)),
      h('span', { class: 'cartao-parte-linha' }, h('em', {}, ui('funcao')), tr(parte.funcao)),
      usam.length
        ? h('span', { class: 'cartao-parte-labs' }, ...usam.slice(0, 6).map((l) => h('span', { class: 'mini-lab mono' }, dois(l.numero))), h('small', {}, usam.length === 1 ? ui('labsComParteUm') : ui('labsComParte', { n: usam.length })))
        : null,
    );
    cartoes.set(parte.id, cartao);
    return cartao;
  };
  const metade = Math.ceil(placa.partes.length / 2);
  const esquerda = h('div', { class: 'conheca-coluna esquerda' }, ...placa.partes.slice(0, metade).map((_, i) => montarCartao(i)));
  const direita = h('div', { class: 'conheca-coluna direita' }, ...placa.partes.slice(metade).map((_, i) => montarCartao(metade + i)));
  const linhas = s('svg', { class: 'conheca-linhas', 'aria-hidden': 'true' });
  const grade = h('div', { class: 'conheca-grade' }, esquerda, h('div', { class: 'conheca-centro' }, visor.el), direita, linhas);
  let quadro = 0;
  let foco: string | null = null;

  const desenharLinhas = (realce: string | null = foco): void => {
    foco = realce;
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(() => {
      linhas.replaceChildren();
      if (getComputedStyle(linhas).display === 'none') return;
      const base = grade.getBoundingClientRect();
      estilo(linhas, { width: `${base.width}px`, height: `${base.height}px` });
      linhas.setAttribute('viewBox', `0 0 ${base.width} ${base.height}`);
      for (const [id, cartao] of cartoes) {
        const alvo = visor.retangulo(id);
        if (!alvo) continue;
        const r = cartao.getBoundingClientRect();
        const ativaAgora = id === escolhida || id === foco;
        if (!ativaAgora && (r.bottom < 70 || r.top > window.innerHeight)) continue;
        const daEsquerda = cartao.parentElement === esquerda;
        const x1 = (daEsquerda ? r.right : r.left) - base.left;
        const y1 = r.top + Math.min(22, r.height / 2) - base.top;
        const x2 = alvo.left + alvo.width / 2 - base.left;
        const y2 = alvo.top + alvo.height / 2 - base.top;
        const meio = x1 + (x2 - x1) * 0.45;
        const ativa = id === escolhida || id === foco;
        linhas.append(
          s('path', { class: `linha${ativa ? ' ativa' : ''}`, d: `M${x1.toFixed(1)} ${y1.toFixed(1)} C${meio.toFixed(1)} ${y1.toFixed(1)}, ${meio.toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}` }),
          s('circle', { class: `ponto${ativa ? ' ativo' : ''}`, cx: x2.toFixed(1), cy: y2.toFixed(1), r: ativa ? 4 : 2.5 }),
        );
      }
    });
  };

  const escolher = (id: string | null): void => {
    escolhida = id;
    visor.acender(id);
    for (const [pid, c] of cartoes) {
      c.setAttribute('aria-pressed', String(pid === id));
      c.classList.toggle('ativa', pid === id);
    }
    desenharLinhas();
  };

  visor.aoMover(() => desenharLinhas());
  const aoRolar = (): void => desenharLinhas();
  window.addEventListener('scroll', aoRolar, { passive: true });
  window.addEventListener('resize', aoRolar);
  const observador = new ResizeObserver(() => desenharLinhas());
  observador.observe(grade);

  const el = h(
    'section',
    { class: 'secao conheca', id: 'conheca' },
    h('header', { class: 'secao-topo' }, h('h2', { class: 'titulo-secao grande' }, ui('conhecaPlaca')), h('p', {}, ui('conhecaResumo', { n: placa.partes.length }))),
    grade,
  );
  return {
    el,
    destruir: () => {
      visor.destruir();
      observador.disconnect();
      window.removeEventListener('scroll', aoRolar);
      window.removeEventListener('resize', aoRolar);
      cancelAnimationFrame(quadro);
    },
  };
};

const montarMapa = (ctx: Contexto, placa: Placa, labs: readonly Laboratorio[]): HTMLElement => {
  const { loja } = ctx;
  const corpo = h('div', { class: 'mapa-temas' });
  const desenhar = (): void => {
    const { bancada, feitos } = conjuntos(loja.atual);
    trocar(
      corpo,
      ...placa.temas.map((tema, i) => {
        const doTema = labs.filter((l) => l.tema === tema.id);
        const prontos = doTema.filter((l) => situacao(l, bancada, feitos) !== 'mais').length;
        const linha = h(
          'div',
          { class: 'mapa-tema' },
          h('div', { class: 'mapa-tema-nome' }, h('span', { class: 'mapa-tema-anel', 'aria-hidden': 'true' }), h('strong', {}, tr(tema.nome)), h('span', {}, tr(tema.resumo)), h('small', { class: 'mono' }, `${prontos}/${doTema.length}`)),
          h('div', { class: 'ladrilhos' }, ...doTema.map((l) => ladrilho(ctx, l, situacao(l, bancada, feitos)))),
        );
        estilo(linha, { '--cor-tema': CORES_TEMA[i % CORES_TEMA.length] ?? '#fff' });
        return linha;
      }),
    );
  };
  desenhar();
  vigiar(loja, corpo, (e, a) => {
    if (e.bancada !== a.bancada || e.feitos !== a.feitos) desenhar();
  });
  return h(
    'section',
    { class: 'secao mapa', id: 'labs' },
    h(
      'header',
      { class: 'secao-topo' },
      h('h2', { class: 'titulo-secao grande' }, ui('todosLabs')),
      h(
        'ul',
        { class: 'legenda' },
        h('li', { class: 'sit-feito' }, ui('legendaFeito')),
        h('li', { class: 'sit-pronto' }, ui('legendaPronto')),
        h('li', { class: 'sit-uma' }, ui('legendaUma')),
        h('li', { class: 'sit-mais' }, ui('legendaMais')),
      ),
    ),
    corpo,
  );
};

export const montarPaginaPlaca = (ctx: Contexto, id: string): Pagina => {
  const placa = placaPorId(id);
  if (!placa) return { el: h('p', {}, ui('naoEncontrada')), destruir: () => undefined };
  const labs = labsDaPlaca(placa.id);
  const conheca = montarConheca(placa, labs);
  const el = h(
    'div',
    { class: 'pagina-placa', 'data-placa': placa.id },
    montarHeroi(ctx, placa, labs),
    labs.length ? montarBancada(ctx, placa, labs) : null,
    conheca.el,
    labs.length ? montarMapa(ctx, placa, labs) : null,
    h('footer', { class: 'rodape' }, h('button', { class: 'botao', type: 'button', onclick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) }, icone('cima', 'icone mini'), ui('voltarTopo'))),
  );
  return { el, destruir: conheca.destruir };
};
