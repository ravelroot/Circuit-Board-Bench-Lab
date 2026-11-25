import type { Contexto, Pagina } from '../app/contexto';
import { gerarQuiz, pontuar, sorteio, type Pergunta } from '../app/quiz';
import { placaPorId, PLACAS } from '../dados/placas';
import { tr, ui } from '../i18n/textos';
import { h, trocar } from './dom';
import { icone } from './icones';

const CHAVE = 'rumo:quiz';
const TOTAL = 10;

const lerMelhor = (): number => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? '{}');
    const n = v && typeof v === 'object' ? (v as Record<string, unknown>).melhor : 0;
    return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= TOTAL ? n : 0;
  } catch {
    return 0;
  }
};

const gravarMelhor = (n: number): void => {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ melhor: n }));
  } catch {
    return;
  }
};

export const montarPaginaQuiz = (ctx: Contexto, idPlaca: string | null): Pagina => {
  const placa = placaPorId(idPlaca);
  let perguntas: Pergunta[] = [];
  let respostas: (number | null)[] = [];
  let atual = 0;
  const corpo = h('div', { class: 'quiz-corpo', 'aria-live': 'polite' });
  const escopo = h('div', { class: 'quiz-escopo', role: 'group', 'aria-label': ui('quizEscopo') });

  const novo = (): void => {
    const semente = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    perguntas = gerarQuiz(placa ? [placa] : [], PLACAS, placa ? Math.min(TOTAL, 6) : TOTAL, sorteio(semente));
    respostas = perguntas.map(() => null);
    atual = 0;
    desenhar();
  };

  const desenhar = (): void => {
    trocar(
      escopo,
      h('a', { class: 'chip', href: '#/quiz', 'aria-pressed': String(!placa), onclick: (ev: Event) => { ev.preventDefault(); ctx.navegar({ pagina: 'quiz', placa: null, lab: null }); } }, ui('quizTodas', { n: PLACAS.length })),
      placa ? h('span', { class: 'chip', 'aria-pressed': 'true' }, placa.nome) : null,
    );
    const q = perguntas[atual];
    if (!q) {
      const acertos = pontuar(perguntas, respostas);
      const melhor = lerMelhor();
      if (!placa && acertos > melhor) gravarMelhor(acertos);
      trocar(
        corpo,
        h('div', { class: 'quiz-fim' }, h('p', { class: 'quiz-placar mono' }, `${acertos}/${perguntas.length}`), h('p', {}, ui(acertos === perguntas.length ? 'quizPerfeito' : acertos >= perguntas.length / 2 ? 'quizBom' : 'quizContinue')), !placa ? h('p', { class: 'quiz-melhor' }, ui('quizMelhor', { n: Math.max(melhor, acertos), total: TOTAL })) : null),
        h('div', { class: 'quiz-botoes' }, h('button', { class: 'botao destaque', type: 'button', onclick: novo }, icone('girar', 'icone mini'), ui('jogarDeNovo'))),
      );
      return;
    }
    const resposta = respostas[atual] ?? null;
    const respondida = resposta !== null;
    const alvoPlaca = placaPorId(q.placa);
    trocar(
      corpo,
      h('div', { class: 'quiz-topo' }, h('span', { class: 'rotulo' }, ui('quizPergunta', { n: atual + 1, total: perguntas.length })), h('span', { class: 'mono' }, ui('quizAcertos', { n: pontuar(perguntas.slice(0, atual + (respondida ? 1 : 0)), respostas) }))),
      h('span', { class: 'quiz-barra' }, ...perguntas.map((p, i) => h('i', { class: respostas[i] === null ? (i === atual ? 'atual' : '') : respostas[i] === p.certa ? 'certa' : 'errada' }))),
      h('h2', { class: 'quiz-enunciado' }, tr(q.enunciado)),
      h(
        'div',
        { class: 'quiz-opcoes' },
        ...q.opcoes.map((o, i) =>
          h(
            'button',
            {
              class: `quiz-opcao${respondida && i === q.certa ? ' certa' : ''}${respondida && i === resposta && i !== q.certa ? ' errada' : ''}`,
              type: 'button',
              disabled: respondida,
              onclick: () => {
                respostas[atual] = i;
                desenhar();
              },
            },
            h('span', { class: 'quiz-letra mono' }, String.fromCharCode(65 + i)),
            h('span', {}, tr(o)),
          ),
        ),
      ),
      respondida
        ? h(
            'div',
            { class: `quiz-explica ${resposta === q.certa ? 'certa' : 'errada'}` },
            h('strong', {}, resposta === q.certa ? ui('quizCerto') : ui('quizErrado')),
            h('p', {}, tr(q.explicacao)),
            alvoPlaca ? h('a', { href: `#/${alvoPlaca.id}`, onclick: (ev: Event) => { ev.preventDefault(); ctx.navegar({ pagina: 'placa', placa: alvoPlaca.id, lab: null }); } }, ui('quizVerPlaca', { nome: alvoPlaca.nome })) : null,
          )
        : null,
      h('div', { class: 'quiz-botoes' }, respondida ? h('button', { class: 'botao destaque', type: 'button', onclick: () => { atual += 1; desenhar(); } }, atual + 1 < perguntas.length ? ui('quizProxima') : ui('quizResultado'), icone('direita', 'icone mini')) : null),
    );
    corpo.querySelector<HTMLButtonElement>(respondida ? '.quiz-botoes .botao' : '.quiz-opcao')?.focus({ preventScroll: true });
  };

  novo();
  const el = h(
    'div',
    { class: 'pagina-quiz' },
    h('header', { class: 'bancada3d-topo' }, h('p', { class: 'heroi-kicker mono' }, ui('kickerQuiz')), h('h1', { class: 'bancada3d-titulo' }, placa ? ui('quizDaPlaca', { nome: placa.nome }) : ui('tituloQuiz')), h('p', {}, ui('resumoQuiz'))),
    h('section', { class: 'secao quiz' }, escopo, corpo),
  );
  return { el, destruir: () => undefined };
};
