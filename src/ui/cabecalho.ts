import { nomePaleta, PALETA_PADRAO, PALETAS } from '../app/aparencia';
import type { Contexto } from '../app/contexto';
import type { Rota } from '../app/estado';
import { caminho, mesmaRota } from '../app/rotas';
import { labsDaPlaca } from '../dados/laboratorios';
import { PLACA_INICIAL, placaPorId, PLACAS } from '../dados/placas';
import { ui } from '../i18n/textos';
import { MARCA } from '../marca';
import { h, trocar } from './dom';
import { icone, logotipo } from './icones';
import { abrirMenu } from './menu';
import { alternarLofi, aoMudarLofi, lofiTocando } from './lofi';

const INICIO: Rota = { pagina: 'placa', placa: PLACA_INICIAL, lab: null };

export const montarCabecalho = (ctx: Contexto): HTMLElement => {
  const { loja } = ctx;
  const irParaInicio = (ev: Event): void => {
    ev.preventDefault();
    loja.alterar({ busca: false, ajuda: false });
    if (mesmaRota(loja.atual.rota, INICIO)) window.scrollTo({ top: 0, behavior: 'smooth' });
    else ctx.navegar(INICIO);
  };
  const slogan = h('small', { class: 'marca-slogan' });
  const rotuloPlaca = h('span', { class: 'rotulo' });
  const nomePlaca = h('span', { class: 'placa-atual-nome' });
  const contagem = h('span', { class: 'placa-atual-contagem mono' });
  const seletor = h('a', { class: 'placa-atual', href: '#/placas' }, icone('grade'), h('span', { class: 'placa-atual-texto' }, rotuloPlaca, nomePlaca), contagem);
  const textoBusca = h('span', { class: 'busca-texto' });
  const gatilhoBusca = h('button', { class: 'busca-gatilho', type: 'button', onclick: () => loja.alterar({ busca: true }) }, icone('busca'), textoBusca, h('kbd', {}, 'Ctrl K'));
  const ajuda = h('button', { class: 'botao-icone', type: 'button', onclick: () => loja.alterar({ ajuda: true }) }, icone('teclado'));
  const credito = h('a', { class: 'credito', href: MARCA.repositorio, target: '_blank', rel: 'noopener noreferrer' }, h('span', { class: 'credito-nome' }, icone('github'), MARCA.autor));
  const siglaIdioma = h('span', {});
  const idioma = h('button', { class: 'idioma', type: 'button', onclick: () => loja.alterar({ idioma: loja.atual.idioma === 'pt' ? 'en' : 'pt' }) }, icone('globo'), siglaIdioma);
  const tema = h('button', { class: 'botao-icone tema', type: 'button', onclick: () => loja.alterar({ tema: loja.atual.tema === 'escuro' ? 'claro' : 'escuro' }) });
  const paleta = h('button', { class: 'botao-icone paleta', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icone('paleta'));
  paleta.addEventListener('click', () =>
    abrirMenu(
      paleta,
      PALETAS.map((p) => ({
        rotulo: ui(p.id === PALETA_PADRAO ? 'paletaPadrao' : 'paletaNome', { nome: p.nome }),
        cores: p.cores,
        marcado: loja.atual.paleta === p.id,
        acao: () => loja.alterar({ paleta: p.id }),
      })),
    ),
  );

  const licao = (): Rota => {
    const lab = labsDaPlaca(loja.atual.rota.placa ?? '')[0] ?? labsDaPlaca(PLACA_INICIAL)[0];
    return lab ? { pagina: 'lab', placa: lab.placa, lab: lab.id } : { pagina: 'catalogo', placa: null, lab: null };
  };
  const destinos: readonly { readonly chave: 'navPlacas' | 'navBancada' | 'navLicao' | 'navQuiz' | 'navComparar'; readonly rota: () => Rota; readonly paginas: readonly Rota['pagina'][] }[] = [
    { chave: 'navPlacas', rota: () => ({ pagina: 'catalogo', placa: null, lab: null }), paginas: ['catalogo', 'placa', 'montagem'] },
    { chave: 'navBancada', rota: () => ({ pagina: 'bancada', placa: null, lab: null, extra: null }), paginas: ['bancada'] },
    { chave: 'navLicao', rota: licao, paginas: ['lab'] },
    { chave: 'navQuiz', rota: () => ({ pagina: 'quiz', placa: null, lab: null }), paginas: ['quiz'] },
    { chave: 'navComparar', rota: () => ({ pagina: 'comparar', placa: loja.atual.rota.placa, lab: null, extra: null }), paginas: ['comparar'] },
  ];
  const links = destinos.map((d) => {
    const a = h('a', { class: 'nav-link', href: caminho(d.rota()), onclick: (ev: Event) => { ev.preventDefault(); loja.alterar({ busca: false, ajuda: false }); ctx.navegar(d.rota()); } });
    return { a, d };
  });
  const navegacao = h('nav', { class: 'nav-principal' }, ...links.map((l) => l.a));
  const lofi = h('button', { class: 'lofi', type: 'button', 'aria-pressed': 'false', onclick: () => alternarLofi() }, h('span', { class: 'lofi-ondas', 'aria-hidden': 'true' }, h('i', {}), h('i', {}), h('i', {})), h('span', { class: 'lofi-texto' }));
  aoMudarLofi(() => atualizar());

  const marca = h('a', { class: 'marca', href: caminho(INICIO), onclick: irParaInicio }, h('span', { class: 'marca-quadro' }, logotipo()), h('span', { class: 'marca-texto' }, h('strong', { class: 'marca-nome' }, MARCA.nome), slogan));

  const cabecalho = h(
    'header',
    { class: 'cabecalho' },
    marca,
    seletor,
    navegacao,
    h('div', { class: 'espaco' }),
    lofi,
    gatilhoBusca,
    ajuda,
    credito,
    idioma,
    paleta,
    tema,
  );

  const atualizar = (): void => {
    const e = loja.atual;
    const placa = placaPorId(e.rota.placa);
    slogan.textContent = ui('slogan');
    marca.title = ui('paginaInicial');
    marca.setAttribute('aria-label', `${MARCA.nome} · ${ui('paginaInicial')}`);
    rotuloPlaca.textContent = placa ? ui('placas') : ui('todasPlacas');
    nomePlaca.textContent = placa ? placa.nome : ui('catalogoTitulo', { n: PLACAS.length });
    contagem.textContent = placa ? `${PLACAS.indexOf(placa) + 1}/${PLACAS.length}` : String(PLACAS.length);
    seletor.title = ui('todasPlacas');
    textoBusca.textContent = ui('buscar');
    credito.title = `${ui('codigoFonte')} · GitHub`;
    credito.setAttribute('aria-label', `${ui('codigoFonte')}: ${MARCA.autor}`);
    siglaIdioma.textContent = e.idioma === 'pt' ? 'PT' : 'EN';
    idioma.setAttribute('aria-label', ui('idioma'));
    ajuda.setAttribute('aria-label', ui('atalhos'));
    ajuda.title = ui('atalhos');
    trocar(tema, icone(e.tema === 'escuro' ? 'sol' : 'lua'));
    tema.setAttribute('aria-label', ui('tema'));
    tema.title = ui('tema');
    paleta.setAttribute('aria-label', ui('paleta'));
    paleta.title = `${ui('paleta')} · ${nomePaleta(e.paleta)}`;
    navegacao.setAttribute('aria-label', ui('navegacao'));
    for (const { a, d } of links) {
      a.textContent = ui(d.chave);
      a.href = caminho(d.rota());
      a.setAttribute('aria-current', d.paginas.includes(e.rota.pagina) ? 'page' : 'false');
    }
    const tocando = lofiTocando();
    lofi.setAttribute('aria-pressed', String(tocando));
    lofi.title = tocando ? ui('lofiParar') : ui('lofiTocar');
    lofi.setAttribute('aria-label', lofi.title);
    const textoLofi = lofi.querySelector('.lofi-texto');
    if (textoLofi) textoLofi.textContent = ui('lofi');
  };

  atualizar();
  loja.assinar((e, a) => {
    if (e.idioma !== a.idioma || e.tema !== a.tema || e.paleta !== a.paleta || e.rota !== a.rota) atualizar();
  });
  return cabecalho;
};
