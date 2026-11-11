import { nomePaleta, PALETA_PADRAO, PALETAS } from '../app/aparencia';
import type { Contexto } from '../app/contexto';
import type { Rota } from '../app/estado';
import { caminho, mesmaRota } from '../app/rotas';
import { PLACA_INICIAL, placaPorId, PLACAS } from '../dados/placas';
import { ui } from '../i18n/textos';
import { MARCA } from '../marca';
import { h, trocar } from './dom';
import { icone, logotipo } from './icones';
import { abrirMenu } from './menu';

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

  const marca = h('a', { class: 'marca', href: caminho(INICIO), onclick: irParaInicio }, h('span', { class: 'marca-quadro' }, logotipo()), h('span', { class: 'marca-texto' }, h('strong', { class: 'marca-nome' }, MARCA.nome), slogan));

  const cabecalho = h(
    'header',
    { class: 'cabecalho' },
    marca,
    seletor,
    h('div', { class: 'espaco' }),
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
  };

  atualizar();
  loja.assinar((e, a) => {
    if (e.idioma !== a.idioma || e.tema !== a.tema || e.paleta !== a.paleta || e.rota !== a.rota) atualizar();
  });
  return cabecalho;
};
