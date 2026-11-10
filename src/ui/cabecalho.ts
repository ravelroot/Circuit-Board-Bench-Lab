import type { Contexto } from '../app/contexto';
import { placaPorId, PLACAS } from '../dados/placas';
import { ui } from '../i18n/textos';
import { MARCA } from '../marca';
import { h, trocar } from './dom';
import { icone, letreiro, logotipo } from './icones';

export const montarCabecalho = (ctx: Contexto): HTMLElement => {
  const { loja } = ctx;
  const slogan = h('small', { class: 'marca-slogan' });
  const rotuloPlaca = h('span', { class: 'rotulo' });
  const nomePlaca = h('span', { class: 'placa-atual-nome' });
  const contagem = h('span', { class: 'placa-atual-contagem mono' });
  const seletor = h('a', { class: 'placa-atual', href: '#/placas' }, icone('grade'), h('span', { class: 'placa-atual-texto' }, rotuloPlaca, nomePlaca), contagem);
  const textoBusca = h('span', { class: 'busca-texto' });
  const gatilhoBusca = h('button', { class: 'busca-gatilho', type: 'button', onclick: () => loja.alterar({ busca: true }) }, icone('busca'), textoBusca, h('kbd', {}, 'Ctrl K'));
  const ajuda = h('button', { class: 'botao-icone', type: 'button', onclick: () => loja.alterar({ ajuda: true }) }, icone('teclado'));
  const rotuloCodigo = h('span', { class: 'rotulo' });
  const credito = h('a', { class: 'credito', href: MARCA.repositorio, target: '_blank', rel: 'noopener noreferrer' }, rotuloCodigo, h('span', { class: 'credito-nome' }, icone('github'), MARCA.autor));
  const siglaIdioma = h('span', {});
  const idioma = h('button', { class: 'idioma', type: 'button', onclick: () => loja.alterar({ idioma: loja.atual.idioma === 'pt' ? 'en' : 'pt' }) }, icone('globo'), siglaIdioma);
  const tema = h('button', { class: 'botao-icone tema', type: 'button', onclick: () => loja.alterar({ tema: loja.atual.tema === 'escuro' ? 'claro' : 'escuro' }) });

  const cabecalho = h(
    'header',
    { class: 'cabecalho' },
    h('a', { class: 'marca', href: '#/placas' }, h('span', { class: 'marca-quadro' }, logotipo()), h('span', { class: 'marca-texto' }, h('strong', { class: 'marca-nome' }, letreiro(MARCA.nome)), slogan)),
    seletor,
    h('div', { class: 'espaco' }),
    gatilhoBusca,
    ajuda,
    credito,
    idioma,
    tema,
  );

  const atualizar = (): void => {
    const e = loja.atual;
    const placa = placaPorId(e.rota.placa);
    slogan.textContent = ui('slogan');
    rotuloPlaca.textContent = placa ? ui('placas') : ui('todasPlacas');
    nomePlaca.textContent = placa ? placa.nome : ui('catalogoTitulo', { n: PLACAS.length });
    contagem.textContent = placa ? `${PLACAS.indexOf(placa) + 1}/${PLACAS.length}` : String(PLACAS.length);
    seletor.title = ui('todasPlacas');
    textoBusca.textContent = ui('buscar');
    rotuloCodigo.textContent = ui('codigoFonte');
    siglaIdioma.textContent = e.idioma === 'pt' ? 'PT' : 'EN';
    idioma.setAttribute('aria-label', ui('idioma'));
    ajuda.setAttribute('aria-label', ui('atalhos'));
    ajuda.title = ui('atalhos');
    trocar(tema, icone(e.tema === 'escuro' ? 'lua' : 'sol'));
    tema.setAttribute('aria-label', ui('tema'));
    tema.title = ui('tema');
  };

  atualizar();
  loja.assinar((e, a) => {
    if (e.idioma !== a.idioma || e.tema !== a.tema || e.rota !== a.rota) atualizar();
  });
  return cabecalho;
};
