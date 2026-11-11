import { conjuntos, type Contexto } from '../app/contexto';
import type { Rota } from '../app/estado';
import { agruparPlacas, secaoAtiva, vizinhas } from '../app/navegador';
import { pecasUsadas, resumirBancada, situacao } from '../app/progresso';
import { LABORATORIOS, labPorId, labsDaPlaca } from '../dados/laboratorios';
import { placaPorId, PLACAS } from '../dados/placas';
import type { Categoria, Laboratorio, Placa } from '../dados/tipos';
import { nomeCategoria, ORDEM_CATEGORIAS, tr, ui, type ChaveTexto } from '../i18n/textos';
import { estilo, h, trocar } from './dom';
import { icone } from './icones';

export interface Laterais {
  readonly esquerda: HTMLElement;
  readonly direita: HTMLElement;
  readonly atualizar: () => void;
}

interface ItemIndice {
  readonly alvo: string;
  readonly rotulo: string;
  readonly extra?: string;
}

const dois = (n: number): string => String(n).padStart(2, '0');

const TOTAL_PARTES = PLACAS.reduce((soma, p) => soma + p.partes.length, 0);
const LIMITE_ESPIA = 180;

const visivel = (el: HTMLElement): boolean => el.offsetParent !== null || getComputedStyle(el).position === 'fixed';

const cartao = (rotulo: string, ...filhos: (Node | null)[]): HTMLElement =>
  h('section', { class: 'trilho-cartao' }, h('h2', { class: 'rotulo' }, rotulo), ...filhos);

const barra = (feitos: number, total: number): HTMLElement => {
  const trilha = h('span', { class: 'trilho-barra', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(feitos) }, h('span', {}));
  const preenchido = trilha.firstElementChild as HTMLElement;
  estilo(preenchido, { '--fracao': total ? (feitos / total).toFixed(4) : '0' });
  return trilha;
};

export const montarLaterais = (ctx: Contexto): Laterais => {
  const { loja } = ctx;
  const ir = (rota: Rota) => (ev: Event): void => {
    ev.preventDefault();
    ctx.navegar(rota);
  };

  const campo = h('input', { class: 'campo trilho-busca', type: 'search', autocomplete: 'off', spellcheck: 'false' });
  const todas = h('a', { class: 'trilho-todas', href: '#/placas', onclick: ir({ pagina: 'catalogo', placa: null, lab: null }) });
  const lista = h('div', { class: 'trilho-lista' });
  const navegador = h('nav', { class: 'trilho-nav' }, lista);
  const esquerda = h('aside', { class: 'trilho trilho-placas' }, h('div', { class: 'trilho-topo' }, todas, campo), navegador);
  const direita = h('aside', { class: 'trilho trilho-contexto' });
  const abertas = new Set<Categoria>();
  let ultimaPlaca: string | null = null;

  const desenharLista = (): void => {
    const termo = campo.value;
    const filtrando = termo.trim() !== '';
    const grupos = agruparPlacas(PLACAS, ORDEM_CATEGORIAS, termo);
    const atual = loja.atual.rota.placa;
    if (grupos.length === 0) {
      trocar(lista, h('p', { class: 'trilho-vazio' }, ui('nenhumaPlaca')));
      return;
    }
    trocar(
      lista,
      ...grupos.map((g) => {
        const grupo = h(
          'details',
          { class: 'trilho-grupo', 'data-categoria': g.categoria },
          h('summary', {}, h('span', {}, nomeCategoria(g.categoria)), h('small', { class: 'mono' }, String(g.placas.length))),
          h(
            'ul',
            {},
            ...g.placas.map((p) => {
              const labs = labsDaPlaca(p.id).length;
              return h(
                'li',
                {},
                h(
                  'a',
                  {
                    class: 'trilho-placa',
                    href: `#/${p.id}`,
                    'data-placa': p.id,
                    title: labs ? `${p.nome} · ${ui('labsDaPlaca', { n: labs })}` : p.nome,
                    'aria-current': p.id === atual ? 'page' : null,
                    onclick: ir({ pagina: 'placa', placa: p.id, lab: null }),
                  },
                  h('span', { class: 'trilho-placa-nome' }, p.nome),
                  labs ? h('small', { class: 'trilho-placa-labs mono', 'aria-label': ui('labsDaPlaca', { n: labs }) }, String(labs)) : null,
                ),
              );
            }),
          ),
        );
        grupo.open = filtrando || abertas.has(g.categoria);
        grupo.addEventListener('toggle', () => {
          if (campo.value.trim() !== '') return;
          if (grupo.open) abertas.add(g.categoria);
          else abertas.delete(g.categoria);
        });
        return grupo;
      }),
    );
  };

  const mostrarAtual = (): void => {
    const item = lista.querySelector<HTMLElement>('.trilho-placa[aria-current="page"]');
    if (!item || !visivel(esquerda)) return;
    const caixa = navegador.getBoundingClientRect();
    const alvo = item.getBoundingClientRect();
    if (alvo.top < caixa.top + 8 || alvo.bottom > caixa.bottom - 8) navegador.scrollTop += alvo.top - caixa.top - caixa.height / 3;
  };

  campo.addEventListener('input', desenharLista);
  campo.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && campo.value) {
      ev.stopPropagation();
      campo.value = '';
      desenharLista();
    }
  });

  let alvos: readonly string[] = [];
  let botoes: HTMLButtonElement[] = [];
  let marca: HTMLElement | null = null;
  let progresso: HTMLElement | null = null;
  let quadro = 0;

  const espiar = (): void => {
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(() => {
      const raiz = document.documentElement;
      const max = raiz.scrollHeight - window.innerHeight;
      if (progresso) estilo(progresso, { '--fracao': max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : '0' });
      if (!alvos.length || !marca) return;
      const noFim = max > 0 && window.scrollY >= max - 4;
      const topos = alvos.map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY);
      const ativa = secaoAtiva(topos, Math.min(LIMITE_ESPIA, window.innerHeight * 0.4), noFim);
      botoes.forEach((b, i) => b.setAttribute('aria-current', i === ativa ? 'location' : 'false'));
      const botao = botoes[ativa];
      if (botao) estilo(marca, { '--y': `${botao.offsetTop}px`, '--altura': `${botao.offsetHeight}px` });
    });
  };

  window.addEventListener('scroll', espiar, { passive: true });
  window.addEventListener('resize', espiar);

  const indice = (rotulo: string, itens: readonly ItemIndice[]): HTMLElement => {
    alvos = itens.map((i) => i.alvo);
    botoes = itens.map((i) =>
      h(
        'button',
        { class: 'trilho-indice-item', type: 'button', 'aria-current': 'false', onclick: () => document.getElementById(i.alvo)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
        h('span', {}, i.rotulo),
        i.extra ? h('small', { class: 'mono' }, i.extra) : null,
      ),
    );
    marca = h('span', { class: 'trilho-indice-marca', 'aria-hidden': 'true' });
    progresso = h('span', { class: 'trilho-leitura', 'aria-hidden': 'true' });
    return cartao(rotulo, progresso, h('nav', { class: 'trilho-indice', 'aria-label': rotulo }, marca, ...botoes));
  };

  const vizinho = (classe: string, rotulo: string, tecla: string, nome: string, href: string, rota: Rota, seta: 'esquerda' | 'direita'): HTMLElement =>
    h(
      'a',
      { class: `trilho-vizinho ${classe}`, href, onclick: ir(rota) },
      h('small', { class: 'rotulo' }, seta === 'esquerda' ? icone('esquerda', 'icone mini') : null, rotulo, seta === 'direita' ? icone('direita', 'icone mini') : null, h('kbd', {}, tecla)),
      h('strong', {}, nome),
    );

  const cartaoVizinhas = (anterior: HTMLElement | null, proxima: HTMLElement | null): HTMLElement | null =>
    anterior || proxima ? h('div', { class: 'trilho-vizinhas' }, anterior, proxima) : null;

  const continuarCom = (labs: readonly Laboratorio[], bancada: ReadonlySet<string>, feitos: ReadonlySet<string>): Laboratorio | undefined => {
    const abertos = labs.filter((l) => !feitos.has(l.id));
    return abertos.find((l) => situacao(l, bancada, feitos) === 'pronto') ?? abertos[0];
  };

  const lateralPlaca = (placa: Placa): Node[] => {
    const labs = labsDaPlaca(placa.id);
    const { bancada, feitos } = conjuntos(loja.atual);
    const itens: ItemIndice[] = [
      { alvo: 'visao', rotulo: ui('visaoGeral') },
      ...(labs.length ? [{ alvo: 'bancada', rotulo: ui('bancadaCurta') }] : []),
      { alvo: 'conheca', rotulo: ui('conhecaPlaca'), extra: String(placa.partes.length) },
      ...(labs.length ? [{ alvo: 'labs', rotulo: ui('laboratorios'), extra: String(labs.length) }] : []),
    ];
    let progressoPlaca: HTMLElement;
    if (labs.length) {
      const r = resumirBancada(labs, bancada, feitos);
      const pecas = pecasUsadas(labs);
      const marcadas = pecas.filter((p) => bancada.has(p.id)).length;
      const seguinte = continuarCom(labs, bancada, feitos);
      progressoPlaca = cartao(
        ui('seuProgresso'),
        h('p', { class: 'trilho-numero' }, h('strong', { class: 'mono' }, String(r.feitos)), h('span', { class: 'mono' }, `/${r.total}`), h('span', {}, ui('labsFeitosCurto'))),
        barra(r.feitos, r.total),
        h(
          'ul',
          { class: 'trilho-dados' },
          h('li', {}, h('span', {}, ui('prontosCurto')), h('strong', { class: 'mono' }, String(r.prontos.length))),
          h('li', {}, h('span', {}, ui('pecasCurto')), h('strong', { class: 'mono' }, `${marcadas}/${pecas.length}`)),
        ),
        seguinte
          ? h(
              'a',
              { class: `trilho-seguir sit-${situacao(seguinte, bancada, feitos)}`, href: `#/${placa.id}/${seguinte.id}`, onclick: ir({ pagina: 'lab', placa: placa.id, lab: seguinte.id }) },
              h('small', { class: 'rotulo' }, ui('continuarCom')),
              h('strong', {}, `${dois(seguinte.numero)} · ${tr(seguinte.titulo)}`),
            )
          : h('p', { class: 'trilho-nota' }, icone('check', 'icone mini'), ui('todosFeitos')),
      );
    } else {
      progressoPlaca = cartao(
        ui('semLabsCurto'),
        h('p', { class: 'trilho-nota' }, ui('semLabsLateral')),
        h('ul', { class: 'trilho-dados' }, h('li', {}, h('span', {}, ui('partesParaConhecer')), h('strong', { class: 'mono' }, String(placa.partes.length)))),
      );
    }
    const { anterior, proxima } = vizinhas(PLACAS, placa.id);
    return [
      indice(ui('nestaPagina'), itens),
      progressoPlaca,
      cartaoVizinhas(
        anterior ? vizinho('anterior', ui('placaAnterior'), ',', anterior.nome, `#/${anterior.id}`, { pagina: 'placa', placa: anterior.id, lab: null }, 'esquerda') : null,
        proxima ? vizinho('proxima', ui('proximaPlaca'), '.', proxima.nome, `#/${proxima.id}`, { pagina: 'placa', placa: proxima.id, lab: null }, 'direita') : null,
      ),
    ].filter((x): x is HTMLElement => x !== null);
  };

  const lateralLab = (lab: Laboratorio): Node[] => {
    alvos = [];
    botoes = [];
    marca = null;
    progresso = null;
    const placa = placaPorId(lab.placa);
    const labs = labsDaPlaca(lab.placa);
    const { bancada, feitos } = conjuntos(loja.atual);
    const marcados = (loja.atual.passos[lab.id] ?? []).length;
    const feito = feitos.has(lab.id);
    const i = labs.findIndex((l) => l.id === lab.id);
    const anterior = i > 0 ? labs[i - 1] : undefined;
    const proximo = labs[i + 1];
    const estado = cartao(
      ui('passos'),
      h('p', { class: 'trilho-numero' }, h('strong', { class: 'mono' }, String(marcados)), h('span', { class: 'mono' }, `/${lab.passos.length}`), h('span', {}, ui('passosCurto'))),
      barra(marcados, lab.passos.length),
      feito ? h('p', { class: 'trilho-nota feito' }, icone('check', 'icone mini'), ui('labFeito')) : null,
    );
    const listaLabs = cartao(
      placa ? `${ui('labsDestaPlaca')} · ${placa.sigla}` : ui('labsDestaPlaca'),
      h(
        'ol',
        { class: 'trilho-labs' },
        ...labs.map((l) =>
          h(
            'li',
            {},
            h(
              'a',
              { class: `trilho-lab sit-${situacao(l, bancada, feitos)}`, href: `#/${l.placa}/${l.id}`, 'aria-current': l.id === lab.id ? 'page' : null, onclick: ir({ pagina: 'lab', placa: l.placa, lab: l.id }) },
              h('span', { class: 'trilho-lab-ponto', 'aria-hidden': 'true' }),
              h('span', { class: 'mono' }, dois(l.numero)),
              h('span', { class: 'trilho-lab-titulo' }, tr(l.titulo)),
            ),
          ),
        ),
      ),
    );
    return [
      estado,
      listaLabs,
      cartaoVizinhas(
        anterior ? vizinho('anterior', ui('labAnterior'), '[', `${dois(anterior.numero)} · ${tr(anterior.titulo)}`, `#/${anterior.placa}/${anterior.id}`, { pagina: 'lab', placa: anterior.placa, lab: anterior.id }, 'esquerda') : null,
        proximo ? vizinho('proxima', ui('proximoLab'), ']', `${dois(proximo.numero)} · ${tr(proximo.titulo)}`, `#/${proximo.placa}/${proximo.id}`, { pagina: 'lab', placa: proximo.placa, lab: proximo.id }, 'direita') : null,
      ),
    ].filter((x): x is HTMLElement => x !== null);
  };

  const lateralCatalogo = (): Node[] => {
    const { feitos } = conjuntos(loja.atual);
    const concluidos = LABORATORIOS.filter((l) => feitos.has(l.id)).length;
    const numero = (valor: number, chave: ChaveTexto): HTMLElement => h('li', {}, h('strong', { class: 'mono' }, valor.toLocaleString(loja.atual.idioma === 'pt' ? 'pt-BR' : 'en-US')), h('span', {}, ui(chave)));
    return [
      indice(
        ui('categorias'),
        ORDEM_CATEGORIAS.map((cat) => ({ alvo: `grupo-${cat}`, rotulo: nomeCategoria(cat), extra: String(PLACAS.filter((p) => p.categoria === cat).length) })),
      ),
      cartao(ui('emNumeros'), h('ul', { class: 'trilho-estatisticas' }, numero(PLACAS.length, 'placasCurto'), numero(TOTAL_PARTES, 'partesCurtas'), numero(LABORATORIOS.length, 'labsCurtos'))),
      cartao(
        ui('seuProgresso'),
        h('p', { class: 'trilho-numero' }, h('strong', { class: 'mono' }, String(concluidos)), h('span', { class: 'mono' }, `/${LABORATORIOS.length}`), h('span', {}, ui('labsFeitosCurto'))),
        barra(concluidos, LABORATORIOS.length),
        h('ul', { class: 'trilho-dados' }, h('li', {}, h('span', {}, ui('pecasCurto')), h('strong', { class: 'mono' }, String(loja.atual.bancada.length)))),
      ),
    ];
  };

  const desenharDireita = (): void => {
    const { rota } = loja.atual;
    const lab = rota.pagina === 'lab' ? labPorId(rota.lab) : undefined;
    const placa = rota.pagina === 'placa' ? placaPorId(rota.placa) : undefined;
    direita.setAttribute('aria-label', ui('nestaPagina'));
    trocar(direita, ...(lab ? lateralLab(lab) : placa ? lateralPlaca(placa) : lateralCatalogo()));
    espiar();
  };

  const atualizar = (): void => {
    const { rota } = loja.atual;
    campo.placeholder = ui('filtrarPlacas');
    campo.setAttribute('aria-label', ui('filtrarPlacas'));
    esquerda.setAttribute('aria-label', ui('placas'));
    navegador.setAttribute('aria-label', ui('placas'));
    trocar(todas, icone('grade', 'icone mini'), h('span', {}, ui('todasPlacas')), h('small', { class: 'mono' }, String(PLACAS.length)));
    todas.setAttribute('aria-current', rota.pagina === 'catalogo' ? 'page' : 'false');
    const placa = placaPorId(rota.placa);
    if (placa) abertas.add(placa.categoria);
    desenharLista();
    desenharDireita();
    if (rota.placa !== ultimaPlaca) {
      ultimaPlaca = rota.placa;
      requestAnimationFrame(mostrarAtual);
    }
  };

  loja.assinar((e, a) => {
    if (e.bancada !== a.bancada || e.feitos !== a.feitos || e.passos !== a.passos) desenharDireita();
  });

  return { esquerda, direita, atualizar };
};
