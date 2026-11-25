import * as THREE from 'three';
import type { Contexto } from '../app/contexto';
import { PLACAS } from '../dados/placas';
import type { CorPlaca, Placa } from '../dados/tipos';
import { tr, ui, type ChaveTexto } from '../i18n/textos';
import { estilo, h, trocar, zoomDaPagina } from './dom';
import { icone } from './icones';
import { construirCena, type Cena } from './kicad/cena';
import { miniatura } from './kicad/miniaturas';
import { carretel, pontasMultimetro, tapete } from './cena3d/objetos';
import { amortecer, easeInOut, easeOut, montarPalco, movimentoReduzido, registrarLiberacao, type Palco3d } from './cena3d/palco';
import { centroDaParte, criarRealce, parteNoPonto, type Realce } from './cena3d/realce';

export interface Vitrine {
  readonly el: HTMLElement;
  readonly adotada: boolean;
  readonly destruir: () => void;
  readonly soltar: () => void;
}

type Vista = 'iso' | 'topo' | 'base' | 'frente';

const VISTAS: readonly (readonly [Vista, ChaveTexto, number, number])[] = [
  ['iso', 'vista34', 50, -24],
  ['topo', 'vistaTopo', 2, 0],
  ['base', 'vistaBase', 2, 0],
  ['frente', 'vistaFrente', 76, 0],
];

const ACENTO: Record<CorPlaca, string> = {
  verde: '#2f8a4e',
  azul: '#2563c9',
  preto: '#26231f',
  vermelho: '#c23a2b',
  roxo: '#6a3fb3',
  branco: '#26231f',
  amarelo: '#b07d0b',
  cinza: '#4b5563',
  marrom: '#8a5a2b',
};

export const acentoDaPlaca = (placa: Placa): string => ACENTO[placa.desenho.cor] ?? '#26231f';

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
  requestAnimationFrame(() => centralizarCarrossel(trilho, false));
  return trilho;
};

const centralizarCarrossel = (trilho: HTMLElement, suave: boolean): void => {
  const atual = trilho.querySelector<HTMLElement>('[aria-current="page"]');
  if (!atual || !trilho.isConnected) return;
  const destino = trilho.scrollLeft + (atual.getBoundingClientRect().left - trilho.getBoundingClientRect().left) / zoomDaPagina() - (trilho.clientWidth - atual.clientWidth) / 2;
  trilho.scrollTo({ left: destino, behavior: suave && !movimentoReduzido() ? 'smooth' : 'auto' });
};

interface PlacaNaVitrine {
  readonly placa: Placa;
  readonly cena: Cena;
  readonly apoio: THREE.Group;
  readonly placa3d: THREE.Group;
  readonly realce: Realce;
  readonly partes: Placa['partes'];
  readonly espessura: number;
  readonly alturaMax: number;
  readonly tamanho: number;
  readonly distancia: number;
  entrada: number;
  saida: number;
}

let reserva: { vitrine: { trocar: (p: Placa) => void; destruir: () => void; publica: Vitrine }; tempo: number } | null = null;

const liberarReserva = (): void => {
  if (!reserva) return;
  window.clearTimeout(reserva.tempo);
  const r = reserva;
  reserva = null;
  r.vitrine.destruir();
};
registrarLiberacao(liberarReserva);

export const obterVitrine = (ctx: Contexto, placa: Placa): Vitrine => {
  if (reserva) {
    window.clearTimeout(reserva.tempo);
    const { vitrine } = reserva;
    reserva = null;
    vitrine.trocar(placa);
    return { ...vitrine.publica, adotada: true };
  }
  return montarVitrine(ctx, placa);
};

export const montarVitrine = (ctx: Contexto, inicial: Placa): Vitrine => {
  let placaAtual = inicial;
  const base = h('div', { class: 'vitrine-base' });
  const palco = montarPalco({
    classe: 'vitrine-palco',
    rotulo: `${inicial.nome} · ${ui('vitrine')}`,
    pose: { inclinacao: 50, giro: -24, distancia: 260 },
    distancias: [60, 1600],
    extensao: 420,
    apontador: {
      pairar: (ev) => apontador(ev),
      clicar: (ev) => clicar(ev),
    },
  });
  if (!palco) {
    const el = h('section', { class: 'vitrine sem-3d', id: 'vitrine' }, h('p', { class: 'aviso-sem-labs' }, ui('semWebgl3d')), montarCarrossel(ctx, inicial));
    return { el, adotada: false, destruir: () => undefined, soltar: () => undefined };
  }
  const p3: Palco3d = palco;

  p3.cena.add(tapete({ largura: 1400, altura: 900, cor: '#66768a', linha: '#7a8a9d', forte: '#93a2b3', reguas: true }, p3.renderer));
  const spool = carretel();
  const pontas = pontasMultimetro();
  pontas.rotation.z = -0.9;
  p3.cena.add(spool, pontas);
  const spoolAlvo = new THREE.Vector3();
  const pontasAlvo = new THREE.Vector3();

  let atual: PlacaNaVitrine | null = null;
  let saindo: PlacaNaVitrine | null = null;
  let girando = false;
  let virada = 0;
  let viradaAlvo = 0;
  let vistaAtual: Vista = 'iso';
  let escolhida: string | null = null;
  let rotulos = false;
  let jogo: { fila: string[]; acertos: number; rodada: number; erro: string | null } | null = null;
  let vivo = true;
  let trocaId = 0;

  const dica = h('div', { class: 'vitrine-dica', hidden: true });
  const camadaRotulos = h('div', { class: 'vitrine-rotulos', 'aria-hidden': 'true' });
  const cartao = h('div', { class: 'vitrine-cartao', hidden: true, role: 'status' });
  const aviso = h('div', { class: 'vitrine-jogo', hidden: true, role: 'status' });
  const chips = new Map<string, HTMLButtonElement>();
  const centros = new Map<string, THREE.Vector3>();

  const montarPlaca = (placa: Placa, agora: number): PlacaNaVitrine => {
    const cena = construirCena(placa, p3.renderer, 4096, true);
    const placa3d = cena.grupo;
    cena.cena.remove(placa3d);
    const apoio = new THREE.Group();
    apoio.add(placa3d);
    p3.cena.add(apoio);
    const espessura = cena.projeto.espessura;
    const alturaMax = Math.max(2, ...cena.projeto.footprints.map((f) => f.comp.z));
    apoio.position.z = espessura + 0.3;
    const tamanho = cena.tamanho;
    const partes = placa.partes.filter((p) => cena.projeto.footprints.some((f) => f.parte === p.id));
    return { placa, cena, apoio, placa3d, realce: criarRealce(cena), partes, espessura, alturaMax, tamanho, distancia: Math.max(115, tamanho * 2.85), entrada: agora, saida: 0 };
  };

  const descartarPlaca = (p: PlacaNaVitrine): void => {
    p.realce.apagar();
    p3.cena.remove(p.apoio);
    p.cena.descartar();
  };

  const nomeParte = (id: string | null): string => tr(placaAtual.partes.find((p) => p.id === id)?.nome ?? '');

  const recalcularCentros = (): void => {
    centros.clear();
    if (!atual) return;
    p3.cena.updateMatrixWorld(true);
    for (const p of atual.partes) {
      const c = centroDaParte(atual.cena, p.id);
      if (c) centros.set(p.id, atual.placa3d.worldToLocal(c));
    }
  };

  const montarRotulos = (): void => {
    chips.clear();
    centros.clear();
    camadaRotulos.replaceChildren();
    if (!atual) return;
    for (const p of atual.partes) {
      const b = h('button', { class: 'vitrine-rotulo', type: 'button', 'data-parte': p.id, tabindex: -1, onclick: () => escolher(p.id) }, tr(p.nome));
      chips.set(p.id, b);
      camadaRotulos.append(b);
    }
  };

  const projetado = new THREE.Vector3();
  p3.aoDesenhar(() => {
    if (!rotulos || jogo || !atual) return;
    if (!centros.size) recalcularCentros();
    const z = zoomDaPagina();
    for (const [id, b] of chips) {
      const local = centros.get(id);
      if (!local) continue;
      const p = p3.projetar(atual.placa3d.localToWorld(projetado.copy(local)));
      estilo(b, { transform: `translate(${(p.x / z).toFixed(1)}px, ${(p.y / z).toFixed(1)}px) translate(-50%, -130%)` });
      b.hidden = !p.frente;
    }
  });

  const mostrarCartao = (): void => {
    const parte = placaAtual.partes.find((p) => p.id === escolhida);
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
    atual?.realce.acender(id ? [id] : []);
    for (const [pid, b] of chips) b.classList.toggle('ativo', pid === id);
    mostrarCartao();
    p3.pedir();
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
    if (!atual) return;
    const fila = embaralhar(atual.partes.map((p) => p.id)).slice(0, RODADAS);
    jogo = { fila, acertos: 0, rodada: 0, erro: null };
    escolher(null);
    camadaRotulos.hidden = true;
    desenharJogo();
  };

  const pararJogo = (): void => {
    jogo = null;
    camadaRotulos.hidden = !rotulos;
    atual?.realce.apagar();
    desenharJogo();
    p3.pedir();
  };

  const responder = (parte: string | null): void => {
    if (!jogo || !atual) return;
    const alvo = jogo.fila[jogo.rodada];
    if (!alvo || !parte) return;
    const realce = atual.realce;
    if (parte === alvo) {
      jogo.acertos += jogo.erro ? 0 : 1;
      jogo.rodada += 1;
      jogo.erro = null;
      realce.acender([parte], '#35c46a', 0.55);
      window.setTimeout(() => {
        if (jogo && vivo) realce.apagar();
        p3.pedir();
      }, 700);
    } else {
      jogo.erro = nomeParte(parte);
      realce.acender([parte], '#e5484d', 0.45);
    }
    desenharJogo();
    p3.pedir();
  };

  const posicionarAcessorios = (tamanho: number, imediato: boolean): void => {
    spoolAlvo.set(-tamanho * 0.35 - 40, tamanho * 0.85 + 85, 0);
    pontasAlvo.set(tamanho * 0.75 + 55, tamanho * 0.35 + 50, 0);
    if (imediato) {
      spool.position.copy(spoolAlvo);
      pontas.position.copy(pontasAlvo);
    }
  };

  const alvoVista = (): THREE.Vector3 => new THREE.Vector3(0, -(atual?.tamanho ?? 80) * (vistaAtual === 'topo' || vistaAtual === 'base' ? 0.12 : 0.2), 0);

  const ENTRADA = 720;
  const SAIDA = 340;

  p3.animar((dt, agora) => {
    let mais = false;
    if (girando && p3.ocioso(1200)) {
      p3.pose.giro += dt * 0.014;
      mais = true;
    }
    if (atual) {
      const p = atual;
      if (Math.abs(virada - viradaAlvo) > 0.001) {
        virada += Math.sign(viradaAlvo - virada) * Math.min(Math.abs(viradaAlvo - virada), dt / 700);
        centros.clear();
        mais = true;
      }
      const k = easeInOut(virada);
      p.placa3d.rotation.y = Math.PI * k;
      let z = p.espessura + 0.3 + Math.sin(Math.PI * k) * p.tamanho * 0.35 + k * (p.alturaMax + p.espessura);
      const te = Math.min(1, (agora - p.entrada) / ENTRADA);
      if (te < 1) {
        const e = easeOut(te);
        const salto = Math.sin(te * Math.PI) * 0.04;
        z += (1 - e) * Math.max(40, p.tamanho * 0.5);
        p.apoio.scale.setScalar(0.86 + 0.14 * e + salto);
        p.apoio.rotation.z = (1 - e) * -0.35;
        mais = true;
      } else if (p.apoio.scale.x !== 1) {
        p.apoio.scale.setScalar(1);
        p.apoio.rotation.z = 0;
      }
      p.apoio.position.z = z;
    }
    if (saindo) {
      const ts = Math.min(1, (agora - saindo.saida) / SAIDA);
      const e = ts * ts;
      saindo.apoio.position.z = saindo.espessura + 0.3 + e * Math.max(50, saindo.tamanho * 0.6);
      saindo.apoio.scale.setScalar(Math.max(0.001, 1 - e * 0.95));
      saindo.apoio.rotation.z = e * 0.4;
      mais = true;
    }
    const kp = amortecer(dt, 160);
    if (spool.position.distanceTo(spoolAlvo) > 0.05 || pontas.position.distanceTo(pontasAlvo) > 0.05) {
      spool.position.lerp(spoolAlvo, kp);
      pontas.position.lerp(pontasAlvo, kp);
      mais = true;
    }
    return mais;
  });

  const botoesVista = VISTAS.map(([vista, chave]) =>
    h(
      'button',
      {
        class: 'vitrine-botao',
        type: 'button',
        'data-vista': vista,
        'aria-pressed': String(vista === 'iso'),
        onclick: () => irParaVista(vista),
      },
      ui(chave),
    ),
  );
  function irParaVista(vista: Vista, ms = 1000): void {
    const def = VISTAS.find((v) => v[0] === vista);
    if (!def) return;
    vistaAtual = vista;
    viradaAlvo = vista === 'base' ? 1 : 0;
    const dist = (atual?.distancia ?? 260) * (vista === 'frente' ? 0.85 : 1);
    p3.irPara({ inclinacao: def[2], giro: def[3], distancia: dist, alvo: alvoVista() }, ms);
    for (const b of botoesVista) b.setAttribute('aria-pressed', String(b.dataset.vista === vista));
    p3.pedir();
  }
  const botaoGiro = h(
    'button',
    {
      class: 'vitrine-botao',
      type: 'button',
      'aria-pressed': 'false',
      onclick: () => {
        girando = !girando;
        botaoGiro.setAttribute('aria-pressed', String(girando));
        p3.pedir();
      },
    },
    icone('girar', 'icone mini'),
    ui('girar'),
  );
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
        p3.pedir();
      },
    },
    icone('etiqueta', 'icone mini'),
    ui('rotulos'),
  );
  const botaoJogo = h('button', { class: 'vitrine-botao', type: 'button', 'aria-pressed': 'false', onclick: () => (jogo ? pararJogo() : comecarJogo()) }, icone('alvo', 'icone mini'), ui('acheAPeca'));
  const botaoMontar = h(
    'a',
    {
      class: 'vitrine-botao destaque',
      href: `#/${inicial.id}/montar`,
      onclick: (ev: Event) => {
        ev.preventDefault();
        ctx.navegar({ pagina: 'montagem', placa: placaAtual.id, lab: null });
      },
    },
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

  let carrossel = montarCarrossel(ctx, inicial);
  base.append(barra, carrossel);
  const sobrepor = h('div', { class: 'vitrine-sobre' }, camadaRotulos, dica, cartao, aviso, base);
  p3.el.append(sobrepor);

  const el = h('section', { class: 'vitrine', id: 'vitrine', 'data-placa': inicial.id }, p3.el, h('p', { class: 'vitrine-legenda' }, ui('dicaVitrine')));

  const aplicarAcento = (placa: Placa): void => {
    estilo(el, { '--cor-placa': acentoDaPlaca(placa) });
  };

  const colocarPlaca = (placa: Placa, agora: number, primeira: boolean): void => {
    atual = montarPlaca(placa, primeira ? agora - (movimentoReduzido() ? ENTRADA : 140) : agora);
    montarRotulos();
    posicionarAcessorios(atual.tamanho, primeira);
    if (primeira) p3.irPara({ distancia: atual.distancia, alvo: alvoVista() }, 0);
    else p3.irPara({ distancia: atual.distancia * (vistaAtual === 'frente' ? 0.85 : 1), alvo: alvoVista() }, 900);
    p3.pedir();
  };

  const trocarPlaca = (placa: Placa): void => {
    const mesma = placa.id === placaAtual.id;
    placaAtual = placa;
    el.dataset.placa = placa.id;
    p3.el.setAttribute('aria-label', `${placa.nome} · ${ui('vitrine')}`);
    botaoMontar.setAttribute('href', `#/${placa.id}/montar`);
    aplicarAcento(placa);
    const novo = montarCarrossel(ctx, placa);
    const rolagem = carrossel.scrollLeft;
    carrossel.replaceWith(novo);
    carrossel = novo;
    if (novo.querySelector('[aria-current="page"]')) {
      novo.scrollLeft = rolagem;
      requestAnimationFrame(() => centralizarCarrossel(novo, true));
    }
    if (mesma) return;
    if (jogo) pararJogo();
    escolher(null);
    virada = 0;
    viradaAlvo = vistaAtual === 'base' ? 1 : 0;
    const id = ++trocaId;
    if (saindo) {
      descartarPlaca(saindo);
      saindo = null;
    }
    if (atual) {
      saindo = atual;
      saindo.saida = performance.now();
      atual = null;
      chips.clear();
      camadaRotulos.replaceChildren();
    }
    p3.pedir();
    const atraso = saindo && !movimentoReduzido() ? SAIDA : 0;
    window.setTimeout(() => {
      if (!vivo || id !== trocaId) return;
      if (saindo) {
        descartarPlaca(saindo);
        saindo = null;
      }
      colocarPlaca(placa, performance.now(), false);
    }, atraso);
  };

  function apontador(ev: PointerEvent | null): void {
    if (!ev || !atual) {
      dica.hidden = true;
      return;
    }
    const { parte } = parteNoPonto(atual.cena, p3.raio(ev));
    if (!parte || jogo) {
      dica.hidden = true;
      p3.tela.style.cursor = '';
      return;
    }
    const r = p3.el.getBoundingClientRect();
    dica.hidden = false;
    dica.textContent = nomeParte(parte);
    const z = zoomDaPagina();
    estilo(dica, { transform: `translate(${((ev.clientX - r.left) / z + 14).toFixed(0)}px, ${((ev.clientY - r.top) / z + 12).toFixed(0)}px)` });
    p3.tela.style.cursor = 'pointer';
  }

  function clicar(ev: PointerEvent): void {
    if (!atual) return;
    const { parte } = parteNoPonto(atual.cena, p3.raio(ev));
    if (jogo) responder(parte);
    else escolher(parte === escolhida ? null : parte);
  }

  p3.el.addEventListener('keydown', (ev) => {
    if (ev.target !== p3.el) return;
    const passo = ev.shiftKey ? 3 : 12;
    const acoes: Record<string, () => void> = {
      ArrowLeft: () => {
        p3.pose.giro -= passo;
      },
      ArrowRight: () => {
        p3.pose.giro += passo;
      },
      ArrowUp: () => {
        p3.pose.inclinacao = Math.max(2, p3.pose.inclinacao - passo);
      },
      ArrowDown: () => {
        p3.pose.inclinacao = Math.min(86, p3.pose.inclinacao + passo);
      },
    };
    const acao = acoes[ev.key];
    if (!acao) return;
    ev.preventDefault();
    ev.stopPropagation();
    acao();
    p3.pedir();
  });

  aplicarAcento(inicial);
  colocarPlaca(inicial, performance.now(), true);

  const destruir = (): void => {
    if (!vivo) return;
    vivo = false;
    if (saindo) descartarPlaca(saindo);
    if (atual) descartarPlaca(atual);
    saindo = null;
    atual = null;
    p3.destruir();
  };

  const publica: Vitrine = {
    el,
    adotada: false,
    destruir,
    soltar: () => {
      if (!vivo) return;
      liberarReserva();
      el.remove();
      reserva = { vitrine: { trocar: trocarPlaca, destruir, publica }, tempo: window.setTimeout(liberarReserva, 0) };
    },
  };
  return publica;
};
