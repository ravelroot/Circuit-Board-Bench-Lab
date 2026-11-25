import * as THREE from 'three';
import type { Contexto } from '../app/contexto';
import { PLACAS } from '../dados/placas';
import type { Placa } from '../dados/tipos';
import { tr, ui, type ChaveTexto } from '../i18n/textos';
import { estilo, h, trocar, zoomDaPagina } from './dom';
import { icone } from './icones';
import { construirCena } from './kicad/cena';
import { miniatura } from './kicad/miniaturas';
import { carretel, pontasMultimetro, tapete } from './cena3d/objetos';
import { montarPalco } from './cena3d/palco';
import { centroDaParte, criarRealce, parteNoPonto } from './cena3d/realce';

export interface Vitrine {
  readonly el: HTMLElement;
  readonly destruir: () => void;
}

type Vista = 'iso' | 'topo' | 'base' | 'frente';

const VISTAS: readonly (readonly [Vista, ChaveTexto, number, number])[] = [
  ['iso', 'vista34', 52, -24],
  ['topo', 'vistaTopo', 2, 0],
  ['base', 'vistaBase', 2, 0],
  ['frente', 'vistaFrente', 76, 0],
];

const RODADAS = 5;

const embaralhar = <T>(lista: readonly T[]): T[] => {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
  }
  return copia;
};

export const montarCarrossel = (ctx: Contexto, placa: Placa, aoEscolher?: (p: Placa) => void): HTMLElement => {
  const vizinhas = PLACAS.filter((p) => p.categoria === placa.categoria);
  const trilho = h(
    'nav',
    { class: 'carrossel', 'aria-label': ui('placas') },
    ...vizinhas.map((p) =>
      h(
        'a',
        {
          class: 'carrossel-item',
          href: `#/${p.id}`,
          'data-placa': p.id,
          'aria-current': p.id === placa.id ? 'page' : null,
          title: p.nome,
          onclick: (ev: Event) => {
            ev.preventDefault();
            if (aoEscolher) aoEscolher(p);
            else ctx.navegar({ pagina: 'placa', placa: p.id, lab: null });
          },
        },
        miniatura(p),
        h('span', { class: 'carrossel-nome' }, p.nome),
      ),
    ),
  );
  requestAnimationFrame(() => {
    const atual = trilho.querySelector<HTMLElement>('[aria-current="page"]');
    if (!atual || !trilho.isConnected) return;
    trilho.scrollLeft += (atual.getBoundingClientRect().left - trilho.getBoundingClientRect().left) / zoomDaPagina() - (trilho.clientWidth - atual.clientWidth) / 2;
  });
  return trilho;
};

export const montarVitrine = (ctx: Contexto, placa: Placa): Vitrine => {
  const carrossel = montarCarrossel(ctx, placa);
  const palco = montarPalco({
    classe: 'vitrine-palco',
    rotulo: `${placa.nome} · ${ui('vitrine')}`,
    pose: { inclinacao: 52, giro: -24, distancia: 260 },
    distancias: [60, 1600],
    extensao: 420,
    apontador: {
      pairar: (ev) => apontador(ev),
      clicar: (ev) => clicar(ev),
    },
  });
  if (!palco) {
    return { el: h('section', { class: 'vitrine sem-3d', id: 'vitrine' }, h('p', { class: 'aviso-sem-labs' }, ui('semWebgl3d')), carrossel), destruir: () => undefined };
  }

  const cena = construirCena(placa, palco.renderer, 2048, true);
  const placa3d = cena.grupo;
  cena.cena.remove(placa3d);
  const apoio = new THREE.Group();
  apoio.add(placa3d);
  palco.cena.add(apoio);
  const espessura = cena.projeto.espessura;
  const alturaMax = Math.max(2, ...cena.projeto.footprints.map((f) => f.comp.z));
  apoio.position.z = espessura + 0.3;
  const tamanho = cena.tamanho;
  const distanciaBase = Math.max(140, tamanho * 2.45);
  palco.irPara({ distancia: distanciaBase }, 0);

  palco.cena.add(tapete({ largura: 1400, altura: 900, cor: '#b6bec8', linha: '#a3acb8', forte: '#8b96a3', reguas: true }, palco.renderer));
  const spool = carretel();
  spool.position.set(-tamanho * 0.35 - 40, tamanho * 0.85 + 85, 0);
  const pontas = pontasMultimetro();
  pontas.position.set(tamanho * 0.75 + 55, tamanho * 0.35 + 50, 0);
  pontas.rotation.z = -0.9;
  palco.cena.add(spool, pontas);

  const realce = criarRealce(cena);
  const partes = placa.partes.filter((p) => cena.projeto.footprints.some((f) => f.parte === p.id));
  const nomeParte = (id: string | null): string => tr(placa.partes.find((p) => p.id === id)?.nome ?? '');

  let girando = false;
  let virada = 0;
  let viradaAlvo = 0;
  let escolhida: string | null = null;
  let rotulos = false;
  let jogo: { fila: string[]; acertos: number; rodada: number; erro: string | null } | null = null;

  const dica = h('div', { class: 'vitrine-dica', hidden: true });
  const camadaRotulos = h('div', { class: 'vitrine-rotulos', 'aria-hidden': 'true' });
  const cartao = h('div', { class: 'vitrine-cartao', hidden: true, role: 'status' });
  const aviso = h('div', { class: 'vitrine-jogo', hidden: true, role: 'status' });

  const centros = new Map<string, THREE.Vector3>();
  const recalcularCentros = (): void => {
    centros.clear();
    palco.cena.updateMatrixWorld(true);
    for (const p of partes) {
      const c = centroDaParte(cena, p.id);
      if (c) centros.set(p.id, placa3d.worldToLocal(c));
    }
  };
  const chips = new Map<string, HTMLButtonElement>();
  for (const p of partes) {
    const b = h('button', { class: 'vitrine-rotulo', type: 'button', 'data-parte': p.id, tabindex: -1, onclick: () => escolher(p.id) }, tr(p.nome));
    chips.set(p.id, b);
    camadaRotulos.append(b);
  }
  palco.aoDesenhar(() => {
    if (!rotulos || jogo) return;
    if (!centros.size) recalcularCentros();
    const z = zoomDaPagina();
    for (const [id, b] of chips) {
      const local = centros.get(id);
      if (!local) continue;
      const mundo = placa3d.localToWorld(local.clone());
      const p = palco.projetar(mundo);
      estilo(b, { transform: `translate(${(p.x / z).toFixed(1)}px, ${(p.y / z).toFixed(1)}px) translate(-50%, -130%)` });
      b.hidden = !p.frente;
    }
  });

  const mostrarCartao = (): void => {
    const parte = placa.partes.find((p) => p.id === escolhida);
    if (!parte) {
      cartao.hidden = true;
      return;
    }
    cartao.hidden = false;
    trocar(
      cartao,
      h('strong', {}, tr(parte.nome)),
      h('span', { class: 'vitrine-cartao-linha' }, h('em', {}, ui('oque')), tr(parte.oque)),
      h('span', { class: 'vitrine-cartao-linha' }, h('em', {}, ui('funcao')), tr(parte.funcao)),
    );
  };

  const escolher = (id: string | null): void => {
    escolhida = id;
    realce.acender(id ? [id] : []);
    for (const [pid, b] of chips) b.classList.toggle('ativo', pid === id);
    mostrarCartao();
    palco.pedir();
  };

  const desenharJogo = (): void => {
    if (!jogo) {
      aviso.hidden = true;
      botaoJogo.setAttribute('aria-pressed', 'false');
      return;
    }
    botaoJogo.setAttribute('aria-pressed', 'true');
    aviso.hidden = false;
    const alvo = jogo.fila[jogo.rodada];
    if (!alvo) {
      trocar(aviso, h('strong', {}, ui('acheFim', { n: jogo.acertos, total: RODADAS })), h('button', { class: 'botao pequeno', type: 'button', onclick: () => comecarJogo() }, ui('jogarDeNovo')));
      return;
    }
    trocar(
      aviso,
      h('small', { class: 'rotulo' }, ui('acheRodada', { n: jogo.rodada + 1, total: RODADAS })),
      h('strong', {}, ui('acheA', { nome: nomeParte(alvo) })),
      jogo.erro ? h('span', { class: 'vitrine-jogo-erro' }, ui('acheErrou', { nome: jogo.erro })) : h('span', {}, ui('acheDica')),
    );
  };

  const comecarJogo = (): void => {
    const fila = embaralhar(partes.map((p) => p.id)).slice(0, RODADAS);
    jogo = { fila, acertos: 0, rodada: 0, erro: null };
    escolher(null);
    camadaRotulos.hidden = true;
    desenharJogo();
  };

  const pararJogo = (): void => {
    jogo = null;
    camadaRotulos.hidden = !rotulos;
    realce.apagar();
    desenharJogo();
    palco.pedir();
  };

  const responder = (parte: string | null): void => {
    if (!jogo) return;
    const alvo = jogo.fila[jogo.rodada];
    if (!alvo || !parte) return;
    if (parte === alvo) {
      jogo.acertos += jogo.erro ? 0 : 1;
      jogo.rodada += 1;
      jogo.erro = null;
      realce.acender([parte], '#35c46a', 0.55);
      window.setTimeout(() => {
        if (jogo) realce.apagar();
        palco.pedir();
      }, 700);
    } else {
      jogo.erro = nomeParte(parte);
      realce.acender([parte], '#e5484d', 0.45);
    }
    desenharJogo();
    palco.pedir();
  };

  palco.animar((dt) => {
    let mais = false;
    if (girando) {
      palco.pose.giro += dt * 0.012;
      mais = true;
    }
    if (Math.abs(virada - viradaAlvo) > 0.001) {
      virada += Math.sign(viradaAlvo - virada) * Math.min(Math.abs(viradaAlvo - virada), dt / 600);
      const k = 1 - Math.pow(1 - virada, 3);
      placa3d.rotation.y = Math.PI * k;
      apoio.position.z = espessura + 0.3 + Math.sin(Math.PI * k) * tamanho * 0.35 + k * (alturaMax + espessura);
      centros.clear();
      mais = true;
    }
    return mais;
  });

  const botoesVista = VISTAS.map(([vista, chave, inc, giro]) =>
    h(
      'button',
      {
        class: 'vitrine-botao',
        type: 'button',
        'data-vista': vista,
        'aria-pressed': String(vista === 'iso'),
        onclick: () => {
          viradaAlvo = vista === 'base' ? 1 : 0;
          palco.irPara({ inclinacao: inc, giro, distancia: distanciaBase * (vista === 'frente' ? 0.85 : 1), alvo: new THREE.Vector3(0, 0, 0) });
          for (const b of botoesVista) b.setAttribute('aria-pressed', String(b.dataset.vista === vista));
          palco.pedir();
        },
      },
      ui(chave),
    ),
  );
  const botaoGiro = h('button', { class: 'vitrine-botao', type: 'button', 'aria-pressed': 'false', onclick: () => { girando = !girando; botaoGiro.setAttribute('aria-pressed', String(girando)); palco.pedir(); } }, icone('girar', 'icone mini'), ui('girar'));
  const botaoRotulos = h(
    'button',
    {
      class: 'vitrine-botao',
      type: 'button',
      'aria-pressed': 'false',
      onclick: () => {
        rotulos = !rotulos;
        botaoRotulos.setAttribute('aria-pressed', String(rotulos));
        camadaRotulos.hidden = !rotulos || !!jogo;
        palco.pedir();
      },
    },
    icone('etiqueta', 'icone mini'),
    ui('rotulos'),
  );
  const botaoJogo = h('button', { class: 'vitrine-botao', type: 'button', 'aria-pressed': 'false', onclick: () => (jogo ? pararJogo() : comecarJogo()) }, icone('alvo', 'icone mini'), ui('acheAPeca'));
  const botaoMontar = h(
    'a',
    { class: 'vitrine-botao destaque', href: `#/${placa.id}/montar`, onclick: (ev: Event) => { ev.preventDefault(); ctx.navegar({ pagina: 'montagem', placa: placa.id, lab: null }); } },
    icone('ferro', 'icone mini'),
    ui('monteAPlaca'),
  );
  camadaRotulos.hidden = true;

  const barra = h(
    'div',
    { class: 'vitrine-barra' },
    h('div', { class: 'vitrine-grupo' }, ...botoesVista),
    h('span', { class: 'vitrine-separador' }),
    h('div', { class: 'vitrine-grupo' }, botaoGiro, botaoRotulos),
    botaoJogo,
    botaoMontar,
  );

  const sobrepor = h('div', { class: 'vitrine-sobre' }, camadaRotulos, dica, cartao, aviso, barra);
  palco.el.append(sobrepor);

  function apontador(ev: PointerEvent | null): void {
    if (!palco) return;
    if (!ev) {
      dica.hidden = true;
      return;
    }
    const { parte } = parteNoPonto(cena, palco.raio(ev));
    if (!parte || jogo) {
      dica.hidden = true;
      palco.tela.style.cursor = '';
      return;
    }
    const r = palco.el.getBoundingClientRect();
    dica.hidden = false;
    dica.textContent = nomeParte(parte);
    const z = zoomDaPagina();
    estilo(dica, { transform: `translate(${((ev.clientX - r.left) / z + 14).toFixed(0)}px, ${((ev.clientY - r.top) / z + 12).toFixed(0)}px)` });
    palco.tela.style.cursor = 'pointer';
  }

  function clicar(ev: PointerEvent): void {
    const { parte } = parteNoPonto(cena, palco!.raio(ev));
    if (jogo) responder(parte);
    else escolher(parte === escolhida ? null : parte);
  }
  palco.el.addEventListener('keydown', (ev) => {
    if (ev.target !== palco.el) return;
    const passo = ev.shiftKey ? 3 : 12;
    const acoes: Record<string, () => void> = {
      ArrowLeft: () => { palco.pose.giro -= passo; },
      ArrowRight: () => { palco.pose.giro += passo; },
      ArrowUp: () => { palco.pose.inclinacao = Math.max(2, palco.pose.inclinacao - passo); },
      ArrowDown: () => { palco.pose.inclinacao = Math.min(86, palco.pose.inclinacao + passo); },
    };
    const acao = acoes[ev.key];
    if (!acao) return;
    ev.preventDefault();
    ev.stopPropagation();
    acao();
    palco.pedir();
  });

  palco.pedir();
  const el = h(
    'section',
    { class: 'vitrine', id: 'vitrine', 'data-placa': placa.id },
    palco.el,
    carrossel,
    h('p', { class: 'vitrine-legenda' }, ui('dicaVitrine')),
  );
  return {
    el,
    destruir: () => {
      realce.apagar();
      palco.destruir();
      cena.descartar();
    },
  };
};
