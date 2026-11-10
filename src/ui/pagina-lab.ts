import { conjuntos, vigiar, type Contexto, type Pagina } from '../app/contexto';
import { alternar } from '../app/progresso';
import { labPorId, labsDaPlaca } from '../dados/laboratorios';
import { pecaPorId } from '../dados/pecas';
import { placaPorId } from '../dados/placas';
import type { Laboratorio } from '../dados/tipos';
import { tr, ui, type ChaveTexto } from '../i18n/textos';
import { copiarTexto, h, trocar } from './dom';
import { montarFiacao } from './fiacao';
import { icone } from './icones';
import { montarPrevia } from './simuladores';

const dois = (n: number): string => String(n).padStart(2, '0');

const botaoCopiar = (texto: string): HTMLButtonElement => {
  const rotulo = h('span', {}, ui('copiar'));
  const b = h('button', { class: 'botao copiar', type: 'button' }, icone('copiar', 'icone mini'), rotulo);
  b.addEventListener('click', () => {
    void copiarTexto(texto).then((ok) => {
      rotulo.textContent = ok ? ui('copiado') : ui('copiar');
      window.setTimeout(() => (rotulo.textContent = ui('copiar')), 1400);
    });
  });
  return b;
};

const secao = (id: string, chave: ChaveTexto, ...filhos: (Node | null)[]): HTMLElement =>
  h('section', { class: 'lab-secao', id: `lab-${id}`, 'data-aba': id }, h('h2', { class: 'titulo-secao' }, ui(chave)), ...filhos);

export const montarPaginaLab = (ctx: Contexto, id: string): Pagina => {
  const { loja } = ctx;
  const lab = labPorId(id);
  const placa = placaPorId(lab?.placa);
  if (!lab || !placa) return { el: h('p', {}, ui('naoEncontrada')), destruir: () => undefined };
  const labs = labsDaPlaca(placa.id);
  const indice = labs.findIndex((l) => l.id === lab.id);
  const tema = placa.temas.find((x) => x.id === lab.tema);
  const ir = (destino: Laboratorio): void => ctx.navegar({ pagina: 'lab', placa: destino.placa, lab: destino.id });

  const pecas = h('div', { class: 'lab-pecas' });
  const desenharPecas = (): void => {
    const { bancada } = conjuntos(loja.atual);
    trocar(
      pecas,
      h('span', { class: 'rotulo' }, ui('pecasDoLab')),
      h('span', { class: 'chip-estatico essencial' }, tr(placa.essenciais)),
      ...lab.pecas.map((p) =>
        h(
          'button',
          { class: `chip-estatico${bancada.has(p) ? ' tem' : ' falta'}`, type: 'button', 'aria-pressed': String(bancada.has(p)), title: bancada.has(p) ? ui('tenho') : ui('naoTenho'), onclick: () => loja.alterar({ bancada: alternar(loja.atual.bancada, p) }) },
          icone(bancada.has(p) ? 'check' : 'mais', 'icone mini'),
          tr(pecaPorId(p)?.nome ?? p),
        ),
      ),
    );
  };
  desenharPecas();
  vigiar(loja, pecas, (e, a) => {
    if (e.bancada !== a.bancada) desenharPecas();
  });

  const partes = h(
    'div',
    { class: 'lab-pecas' },
    h('span', { class: 'rotulo' }, ui('partesUsadas')),
    ...lab.partes.map((p) => h('span', { class: 'chip-estatico parte' }, tr(placa.partes.find((x) => x.id === p)?.nome ?? p))),
  );

  const contadorPassos = h('span', { class: 'aba-contagem mono' });
  const abasDef: readonly [string, ChaveTexto, Node | null][] = [
    ['como', 'como', h('span', { class: 'aba-contagem mono' }, String(lab.como.length))],
    ['fiacao', 'fiacao', null],
    ['comandos', 'comandos', null],
    ['passos', 'passos', contadorPassos],
    ['previa', 'previa', null],
    ['codigo', 'codigo', null],
  ];
  const botoesAba = abasDef.map(([aba, chave, extra]) =>
    h('a', { class: 'lab-aba', href: `#lab-${aba}`, 'data-aba': aba, onclick: (ev: Event) => { ev.preventDefault(); document.getElementById(`lab-${aba}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, ui(chave), extra),
  );
  const nav = h('nav', { class: 'lab-abas', 'aria-label': tr(lab.titulo) }, ...botoesAba);

  const como = secao(
    'como',
    'comoFunciona',
    h('ol', { class: 'lab-como' }, ...lab.como.map((p, i) => h('li', {}, h('span', { class: 'lab-como-num mono' }, dois(i + 1)), h('p', {}, tr(p))))),
  );

  const fiacao = lab.fiacao ? montarFiacao(lab.fiacao) : null;
  const secFiacao = secao('fiacao', 'fiacao', fiacao ? fiacao.el : h('p', { class: 'vazio' }, ui('semFiacao')));

  const secComandos = secao(
    'comandos',
    'comandos',
    lab.comandos.length
      ? h('ul', { class: 'lab-comandos' }, ...lab.comandos.map((c) => h('li', {}, h('span', { class: 'rotulo' }, tr(c.rotulo)), h('div', { class: 'comando' }, h('code', { class: 'mono' }, c.linha), botaoCopiar(c.linha)))))
      : h('p', { class: 'vazio' }, ui('semCodigo')),
  );

  const listaPassos = h('ol', { class: 'lab-passos' });
  const resumoPassos = h('p', { class: 'lab-passos-resumo mono' });
  const botaoFeito = h('button', { class: 'botao destaque', type: 'button' });
  const desenharPassos = (): void => {
    const marcados = new Set(loja.atual.passos[lab.id] ?? []);
    const feito = loja.atual.feitos.includes(lab.id);
    trocar(
      listaPassos,
      ...lab.passos.map((p, i) => {
        const caixa = h('input', { type: 'checkbox', checked: marcados.has(i) });
        caixa.addEventListener('change', () => {
          const atual = loja.atual.passos[lab.id] ?? [];
          const novo = alternar(atual, i).sort((a, b) => a - b);
          const passos = { ...loja.atual.passos, [lab.id]: novo };
          const completo = novo.length === lab.passos.length;
          loja.alterar({ passos, feitos: completo && !loja.atual.feitos.includes(lab.id) ? [...loja.atual.feitos, lab.id] : loja.atual.feitos });
        });
        return h('li', { class: marcados.has(i) ? 'marcado' : '' }, h('label', {}, caixa, h('span', { class: 'mono' }, dois(i + 1)), h('span', {}, tr(p))));
      }),
    );
    resumoPassos.textContent = `${ui('passosMarcados', { a: marcados.size, b: lab.passos.length })} · ${ui('passosSalvos')}`;
    contadorPassos.textContent = `${marcados.size}/${lab.passos.length}`;
    trocar(botaoFeito, icone(feito ? 'fechar' : 'check', 'icone mini'), feito ? ui('desmarcarFeito') : ui('marcarFeito'));
    cabeca.classList.toggle('feito', feito);
  };
  botaoFeito.addEventListener('click', () => loja.alterar({ feitos: alternar(loja.atual.feitos, lab.id) }));
  const secPassos = secao('passos', 'passos', resumoPassos, listaPassos, botaoFeito);

  const previa = montarPrevia(lab.previa);
  const secPrevia = secao('previa', 'previaTitulo', h('p', { class: 'lab-explica' }, tr(lab.explicacaoPrevia)), previa.el);

  const secCodigo = secao(
    'codigo',
    'codigo',
    lab.codigo
      ? h('div', { class: 'codigo' }, h('div', { class: 'codigo-topo' }, h('span', { class: 'mono' }, lab.codigo.arquivo), botaoCopiar(lab.codigo.texto)), h('pre', { class: 'mono' }, h('code', {}, lab.codigo.texto)))
      : h('p', { class: 'vazio' }, ui('semCodigo')),
  );

  const proximo = labs[indice + 1];
  const anterior = labs[indice - 1];
  const temaProximo = proximo && proximo.tema !== lab.tema ? placa.temas.find((x) => x.id === proximo.tema) : undefined;
  const rodape = h(
    'footer',
    { class: 'lab-rodape' },
    proximo
      ? h(
          'a',
          { class: 'lab-proximo', href: `#/${proximo.placa}/${proximo.id}`, onclick: (ev: Event) => { ev.preventDefault(); ir(proximo); } },
          h('span', { class: 'ladrilho-icone' }, icone(proximo.icone)),
          h('span', {}, h('small', { class: 'rotulo' }, temaProximo ? `${ui('fimDoTema')}: ${tr(temaProximo.nome)}` : ui('proximoLab')), h('strong', {}, `${dois(proximo.numero)} · ${tr(proximo.titulo)}`)),
          icone('direita'),
        )
      : h('p', { class: 'lab-ultimo' }, ui('ultimoLab')),
    h(
      'div',
      { class: 'lab-rodape-links' },
      anterior ? h('a', { class: 'botao', href: `#/${anterior.placa}/${anterior.id}`, onclick: (ev: Event) => { ev.preventDefault(); ir(anterior); } }, icone('esquerda', 'icone mini'), `${dois(anterior.numero)} ${tr(anterior.titulo)}`) : null,
      h('a', { class: 'botao', href: `#/${placa.id}`, onclick: (ev: Event) => { ev.preventDefault(); ctx.navegar({ pagina: 'placa', placa: placa.id, lab: null }); } }, ui('voltarPlaca')),
      h('button', { class: 'botao', type: 'button', onclick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) }, icone('cima', 'icone mini'), ui('voltarTopo')),
    ),
  );

  const cabeca = h(
    'header',
    { class: 'lab-cabeca' },
    h(
      'p',
      { class: 'lab-trilha mono' },
      h('a', { href: `#/${placa.id}`, onclick: (ev: Event) => { ev.preventDefault(); ctx.navegar({ pagina: 'placa', placa: placa.id, lab: null }); } }, placa.nome),
      ' / ',
      tema ? tr(tema.nome) : lab.tema,
      ' / ',
      dois(lab.numero),
    ),
    h('div', { class: 'lab-titulo-linha' }, h('span', { class: 'lab-numero mono' }, dois(lab.numero)), h('div', {}, h('h1', { class: 'lab-titulo' }, tr(lab.titulo)), h('p', { class: 'lab-resumo' }, tr(lab.resumo))), h('span', { class: 'lab-selo' }, icone('check', 'icone mini'), ui('labFeito'))),
    pecas,
    partes,
  );

  desenharPassos();
  vigiar(loja, listaPassos, (e, a) => {
    if (e.passos !== a.passos || e.feitos !== a.feitos) desenharPassos();
  });

  const el = h('article', { class: 'pagina-lab', 'data-lab': lab.id }, cabeca, nav, h('div', { class: 'lab-corpo' }, como, secFiacao, secComandos, secPassos, secPrevia, secCodigo), rodape);

  const observador = new IntersectionObserver(
    (entradas) => {
      const visivel = entradas.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      const aba = (visivel?.target as HTMLElement | undefined)?.dataset.aba;
      if (!aba) return;
      for (const b of botoesAba) b.classList.toggle('atual', b.dataset.aba === aba);
    },
    { rootMargin: '-120px 0px -55% 0px' },
  );
  for (const sec of [como, secFiacao, secComandos, secPassos, secPrevia, secCodigo]) observador.observe(sec);

  return {
    el,
    destruir: () => {
      observador.disconnect();
      previa.destruir();
      fiacao?.destruir();
    },
  };
};
