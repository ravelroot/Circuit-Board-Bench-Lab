import { nomePaleta } from '../app/aparencia';
import type { Contexto } from '../app/contexto';
import { labPorId } from '../dados/laboratorios';
import { placaPorId, PLACAS } from '../dados/placas';
import { tr, ui } from '../i18n/textos';
import { MARCA } from '../marca';
import { h, trocar } from './dom';

export const montarBarraStatus = (ctx: Contexto): HTMLElement => {
  const { loja } = ctx;
  const esquerda = h('div', { class: 'barra-status-lado' });
  const direita = h('div', { class: 'barra-status-lado direita' });

  const atualizar = (): void => {
    const e = loja.atual;
    const placa = placaPorId(e.rota.placa);
    const lab = labPorId(e.rota.lab);
    const local = lab && placa ? `${placa.nome} · ${tr(lab.titulo)}` : placa ? placa.nome : ui('catalogoTitulo', { n: PLACAS.length });
    trocar(
      esquerda,
      h('span', {}, `${MARCA.nome} ${MARCA.versao}`),
      h('span', {}, local),
      h('span', {}, e.bancada.length === 1 ? ui('pecasNaBancadaUm') : ui('pecasNaBancada', { n: e.bancada.length })),
      h('span', {}, e.feitos.length === 1 ? ui('labsConcluidosUm') : ui('labsConcluidos', { n: e.feitos.length })),
    );
    trocar(
      direita,
      h('span', {}, e.tema === 'escuro' ? ui('temaEscuro') : ui('temaClaro')),
      h('span', {}, ui('paletaNome', { nome: nomePaleta(e.paleta) })),
      h('span', {}, ui('progressoSalvo')),
    );
  };

  atualizar();
  loja.assinar((e, a) => {
    if (e.idioma !== a.idioma || e.rota !== a.rota || e.bancada !== a.bancada || e.feitos !== a.feitos || e.tema !== a.tema || e.paleta !== a.paleta) {
      atualizar();
    }
  });
  return h('footer', { class: 'barra-status' }, esquerda, direita);
};
