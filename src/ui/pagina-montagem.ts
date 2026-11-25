import * as THREE from 'three';
import type { Contexto, Pagina } from '../app/contexto';
import {
  arrumarBandeja,
  avancar,
  colocar,
  dentro,
  iniciarMontagem,
  passoAtual,
  pecasDoKit,
  pegar,
  relogio,
  soldadas,
  soldar,
  type EstadoPeca,
  type Montagem,
  type PecaKit,
  type Recusa,
} from '../app/montagem';
import { placaPorId } from '../dados/placas';
import { tr, ui, type ChaveTexto } from '../i18n/textos';
import { estilo, h, s, trocar, zoomDaPagina } from './dom';
import { icone } from './icones';
import { construirCena } from './kicad/cena';
import { bandeja, carretel, em, ferroDeSolda, tapete, tapeteAntiestatico } from './cena3d/objetos';
import { criarContorno, criarFumaca, criarOnda, novoVoo, noVoo, type Voo } from './cena3d/movimento';
import { amortecer, montarPalco } from './cena3d/palco';
import { criarRealce, parteNoPonto } from './cena3d/realce';

const CHAVE_RECORDES = 'rumo:montagem';
const TEMPO_SOLDA = 950;

type Recordes = Record<string, { normal?: number; desafio?: number }>;

const lerRecordes = (): Recordes => {
  try {
    const bruto: unknown = JSON.parse(localStorage.getItem(CHAVE_RECORDES) ?? '{}');
    if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return {};
    const limpo: Recordes = {};
    for (const [id, v] of Object.entries(bruto as Record<string, unknown>)) {
      if (!placaPorId(id) || !v || typeof v !== 'object') continue;
      const r = v as Record<string, unknown>;
      const ok = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x > 0 && x < 36e6 ? x : undefined);
      const normal = ok(r.normal);
      const desafio = ok(r.desafio);
      limpo[id] = { ...(normal ? { normal } : {}), ...(desafio ? { desafio } : {}) };
    }
    return limpo;
  } catch {
    return {};
  }
};

const gravarRecorde = (placa: string, modo: 'normal' | 'desafio', ms: number): boolean => {
  const todos = lerRecordes();
  const atual = todos[placa]?.[modo];
  if (atual !== undefined && atual <= ms) return false;
  todos[placa] = { ...todos[placa], [modo]: ms };
  try {
    localStorage.setItem(CHAVE_RECORDES, JSON.stringify(todos));
  } catch {
    return true;
  }
  return true;
};

const ROTULO_ESTADO: Record<EstadoPeca, ChaveTexto> = { bandeja: 'estadoBandeja', mao: 'estadoMao', ponteada: 'estadoPonteada', soldada: 'estadoSoldada' };
const RECUSA: Record<Recusa, ChaveTexto> = { ordem: 'recusaOrdem', ocupado: 'recusaOcupado', estado: 'recusaEstado' };

export const montarPaginaMontagem = (ctx: Contexto, id: string): Pagina => {
  const placa = placaPorId(id);
  if (!placa) return { el: h('p', {}, ui('naoEncontrada')), destruir: () => undefined };
  const sair = (): void => ctx.navegar({ pagina: 'placa', placa: placa.id, lab: null });

  let montagem: Montagem = iniciarMontagem([]);
  let relogioId = 0;
  let vivo = true;
  const temporizadores = new Set<number>();
  const depois = (fn: () => void, ms: number): void => {
    const t = window.setTimeout(() => {
      temporizadores.delete(t);
      if (vivo) fn();
    }, ms);
    temporizadores.add(t);
  };

  const progresso = h('span', { class: 'montagem-progresso', role: 'progressbar', 'aria-valuemin': '0' }, h('span', {}));
  const contagem = h('span', { class: 'mono' });
  const tempo = h('span', { class: 'mono montagem-tempo' });
  const passoEl = h('div', { class: 'montagem-passo', 'aria-live': 'polite' });
  const sobre = h('div', { class: 'montagem-sobre' });
  const lista = h('ol', { class: 'montagem-lista' });
  const chaveDesafio = h('button', { class: 'chave-alternar', type: 'button', role: 'switch', 'aria-checked': 'false', onclick: () => reiniciar(!montagem.desafio) }, h('span', { class: 'chave-trilho' }), h('span', {}, ui('desafio')), h('small', { class: 'mono' }));
  const botaoDica = h('button', { class: 'botao', type: 'button', onclick: () => darDica() }, icone('lampada', 'icone mini'), ui('dica'));
  const botaoAuto = h('button', { class: 'botao laranja', type: 'button', onclick: () => automatico() }, ui('colocarProxima'));
  const botaoAcao = h('button', { class: 'botao montagem-acao', type: 'button' });
  const painel = h(
    'aside',
    { class: 'montagem-painel', 'aria-label': ui('kitMontagem') },
    h(
      'header',
      { class: 'montagem-topo' },
      h('div', {}, h('p', { class: 'rotulo' }, ui('kitMontagem')), h('h1', { class: 'montagem-titulo' }, placa.nome)),
      h('button', { class: 'botao-icone', type: 'button', 'aria-label': ui('sairMontagem'), title: ui('sairMontagem'), onclick: sair }, icone('fechar')),
    ),
    progresso,
    h('p', { class: 'montagem-placar' }, contagem, tempo),
    passoEl,
    sobre,
    h('h2', { class: 'rotulo montagem-lista-titulo' }, ui('pecasDoKit')),
    lista,
    h(
      'div',
      { class: 'montagem-rodape' },
      botaoAcao,
      h('div', { class: 'montagem-botoes' }, botaoDica, botaoAuto),
      chaveDesafio,
      h('div', { class: 'montagem-botoes' }, h('button', { class: 'botao', type: 'button', onclick: () => reiniciar(montagem.desafio) }, ui('recomecar')), h('button', { class: 'botao', type: 'button', onclick: sair }, ui('sair'))),
      h('p', { class: 'montagem-nota' }, ui('notaSmd')),
    ),
  );

  const palco = montarPalco({
    classe: 'montagem-palco',
    rotulo: `${placa.nome} · ${ui('kitMontagem')}`,
    pose: { inclinacao: 40, giro: -12, distancia: 320 },
    distancias: [70, 1600],
    extensao: 420,
    rodaLivre: true,
    inclinacaoMax: 80,
    apontador: {
      pegar: (ev) => comecarSolda(ev),
      soltar: () => cancelarSolda(),
      clicar: (ev) => clicar(ev),
      pairar: (ev) => pairar(ev),
    },
  });

  if (!palco) {
    const el = h('div', { class: 'pagina-montagem sem-3d' }, h('p', { class: 'aviso-sem-labs' }, ui('semWebgl3d')), painel);
    return { el, destruir: () => undefined };
  }

  const cena = construirCena(placa, palco.renderer, 4096, true);
  const placa3d = cena.grupo;
  cena.cena.remove(placa3d);
  const { largura: L, altura: A, espessura } = cena.projeto;
  const pecas = pecasDoKit(cena.projeto);
  montagem = iniciarMontagem(pecas);
  const realce = criarRealce(cena);
  const arrumacao = arrumarBandeja(pecas, Math.max(L + 10, 120));
  const vao = 26;
  const total = A + 24 + vao + arrumacao.altura + 10;
  const yPlaca = total / 2 - (A + 24) / 2;
  const yBandeja = -total / 2 + (arrumacao.altura + 10) / 2;
  const zPlaca = 4.4 + espessura + 0.1;
  const maior = Math.max(L, arrumacao.largura);

  palco.cena.add(tapete({ largura: 1600, altura: 1000, cor: '#66768a', linha: '#7a8a9d', forte: '#93a2b3' }, palco.renderer));
  palco.cena.add(em(tapeteAntiestatico(L + 24, A + 24), 0, yPlaca, 0));
  palco.cena.add(em(bandeja(arrumacao.largura + 10, arrumacao.altura + 10), 0, yBandeja, 0));
  const spool = carretel();
  spool.scale.setScalar(0.75);
  spool.position.set(-maior / 2 - 55, yPlaca + A / 2, 0);
  palco.cena.add(spool);

  const apoio = new THREE.Group();
  apoio.position.set(0, yPlaca, zPlaca);
  apoio.add(placa3d);
  palco.cena.add(apoio);

  const ferro = ferroDeSolda();
  const garagem = new THREE.Vector3(maior / 2 + 140, yPlaca + A / 2 + 120, 150);
  ferro.grupo.position.copy(garagem);
  ferro.grupo.rotation.z = 0.62;
  palco.cena.add(ferro.grupo);

  const fumaca = criarFumaca();
  const onda = criarOnda();
  palco.cena.add(fumaca.grupo, onda.grupo);

  const contorno = criarContorno('#ff5a36');
  contorno.grupo.visible = false;
  cena.conteudo.add(contorno.grupo);

  const enquadrarBancada = (): { alvo: THREE.Vector3; distancia: number } => ({ alvo: new THREE.Vector3(0, (yPlaca + yBandeja) / 2 + 4, 0), distancia: Math.max(220, total * 1.7) });
  const enquadrarPlaca = (): { alvo: THREE.Vector3; distancia: number } => ({ alvo: new THREE.Vector3(0, yPlaca - 2, zPlaca), distancia: Math.max(140, Math.max(L * 1.15, A * 1.55) * 1.6) });
  const inicial = enquadrarBancada();
  palco.irPara({ ...inicial, inclinacao: 40, giro: -12 }, 0);

  const vagas = new Map(arrumacao.vagas.map((v) => [v.parte, v]));
  const centroLocal = (p: PecaKit): THREE.Vector3 => new THREE.Vector3(p.caixa.x + p.caixa.l / 2, -(p.caixa.y + p.caixa.a / 2), 0);
  const naBandeja = (p: PecaKit): THREE.Vector3 => {
    const v = vagas.get(p.parte);
    const mundo = new THREE.Vector3((v?.x ?? 0) - arrumacao.largura / 2, yBandeja + arrumacao.altura / 2 - (v?.y ?? 0), 3.4);
    const placaMundo = new THREE.Vector3(-L / 2, yPlaca + A / 2, zPlaca).add(centroLocal(p));
    return mundo.sub(placaMundo);
  };
  const ALTURA_MAO = (p: PecaKit): number => 16 + Math.min(14, p.altura * 0.6);

  interface Movel {
    readonly atual: THREE.Vector3;
    readonly velocidade: THREE.Vector3;
    voo: Voo | null;
    alvo: THREE.Vector3;
    elevar: number;
    tremor: number;
    pouso: number;
    readonly inclinacao: THREE.Quaternion;
  }
  const moveis = new Map<string, Movel>();
  for (const p of pecas) {
    const inicio = naBandeja(p);
    moveis.set(p.parte, { atual: inicio.clone(), velocidade: new THREE.Vector3(), voo: null, alvo: inicio.clone(), elevar: 0, tremor: 0, pouso: 0, inclinacao: new THREE.Quaternion() });
  }
  const indicesModelo = new Map(pecas.map((p) => [p.parte, p.indices.map((i) => cena.projeto.footprints.findIndex((f) => f.indice === i)).filter((k) => k >= 0)]));

  const centro3 = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const aplicar3d = (p: PecaKit, m: Movel, escala: number): void => {
    centro3.copy(centroLocal(p)).setZ(p.altura / 2);
    tmp.copy(centro3).multiplyScalar(escala).applyQuaternion(m.inclinacao);
    for (const k of indicesModelo.get(p.parte) ?? []) {
      const modelo = cena.modelos[k];
      if (!modelo) continue;
      modelo.quaternion.copy(m.inclinacao);
      modelo.scale.setScalar(escala);
      modelo.position.copy(m.atual).add(centro3).sub(tmp);
    }
  };

  let maoCursor: THREE.Vector3 | null = null;
  let maoMira: THREE.Vector3 | null = null;
  let ferroCursor: THREE.Vector3 | null = null;
  let ferroForcado: THREE.Vector3 | null = null;
  let pairandoParte: string | null = null;
  let segurando: { parte: string; t0: number; ultimaFumaca: number } | null = null;
  let girarFesta = 0;

  const alvoDaPeca = (p: PecaKit, estado: EstadoPeca): THREE.Vector3 => {
    if (estado === 'bandeja') return naBandeja(p);
    if (estado === 'mao') {
      if (maoCursor) {
        const c = centroLocal(p);
        const imantado = !!maoMira && dentro(p, maoMira.x, -maoMira.y, 3);
        return imantado && !montagem.desafio ? new THREE.Vector3(0, 0, ALTURA_MAO(p) * 0.55) : new THREE.Vector3(maoCursor.x - c.x, maoCursor.y - c.y, ALTURA_MAO(p));
      }
      return new THREE.Vector3(0, -Math.min(18, A * 0.18), ALTURA_MAO(p));
    }
    return new THREE.Vector3(0, 0, 0);
  };

  const redefinirAlvos = (agora: number): void => {
    for (const p of pecas) {
      const m = moveis.get(p.parte);
      if (!m) continue;
      const estado = montagem.estados[p.parte] ?? 'bandeja';
      const novo = alvoDaPeca(p, estado);
      const mudouEstado = m.alvo.distanceTo(novo) > 0.5 && estado !== 'mao';
      if (estado === 'mao' && !m.voo && m.atual.distanceTo(novo) > 40 && m.atual.z < 8) {
        m.voo = novoVoo(m.atual, novo, agora, { arco: 22 });
      } else if (mudouEstado) {
        const pousando = estado === 'ponteada' || estado === 'soldada';
        m.voo = novoVoo(m.atual, novo, agora, pousando ? { ms: 420, arco: 3, pouso: true } : {});
        if (pousando) m.pouso = agora + 420;
      }
      m.alvo = novo;
    }
  };

  const anteriorMao = new THREE.Vector3();
  const eixo = new THREE.Vector3();
  const qAlvo = new THREE.Quaternion();
  const ferroAlvo = new THREE.Vector3();
  const pontaMundo = new THREE.Vector3();

  palco.animar((dt, agora) => {
    let mais = false;
    const passo = passoAtual(montagem);
    for (const p of pecas) {
      const m = moveis.get(p.parte);
      if (!m) continue;
      const estado = montagem.estados[p.parte] ?? 'bandeja';
      anteriorMao.copy(m.atual);
      if (m.voo) {
        if (estado === 'mao') {
          (m.voo as { para: THREE.Vector3 }).para.copy(m.alvo);
        }
        const t = noVoo(m.voo, agora, m.atual);
        if (t >= 1) m.voo = null;
        mais = true;
      } else if (estado === 'mao') {
        const alvo = tmp.copy(m.alvo);
        alvo.z += Math.sin(agora / 340) * 1.2;
        m.atual.lerp(alvo, amortecer(dt, 70));
        mais = true;
      } else if (m.atual.distanceTo(m.alvo) > 0.01) {
        m.atual.lerp(m.alvo, amortecer(dt, 60));
        mais = true;
      } else m.atual.copy(m.alvo);
      const elevarAlvo = estado === 'bandeja' && pairandoParte === p.parte && passo.tipo === 'pegar' ? 4 : 0;
      m.elevar += (elevarAlvo - m.elevar) * amortecer(dt, 60);
      if (Math.abs(m.elevar - elevarAlvo) > 0.01) mais = true;
      let tremorX = 0;
      if (m.tremor > agora) {
        const t = 1 - (m.tremor - agora) / 420;
        tremorX = Math.sin(t * Math.PI * 7) * 1.6 * (1 - t);
        mais = true;
      }
      m.atual.z += m.elevar;
      m.atual.x += tremorX;
      m.velocidade.subVectors(m.atual, anteriorMao).divideScalar(Math.max(1, dt));
      if (estado === 'mao' || m.voo) {
        const v = m.velocidade;
        const intensidade = Math.min(0.32, Math.hypot(v.x, v.y) * 1.4);
        if (intensidade > 0.002) {
          eixo.set(-v.y, v.x, 0).normalize();
          qAlvo.setFromAxisAngle(eixo, intensidade);
        } else qAlvo.identity();
        m.inclinacao.slerp(qAlvo, amortecer(dt, 90));
        mais = true;
      } else if (m.inclinacao.w < 0.99999) {
        m.inclinacao.slerp(qAlvo.identity(), amortecer(dt, 80));
        mais = true;
      }
      let escala = 1;
      if (m.pouso > agora) {
        const t = 1 - (m.pouso - agora) / 420;
        escala = t < 0.75 ? 1 : 1 - Math.sin(((t - 0.75) / 0.25) * Math.PI) * 0.05;
        mais = true;
      }
      aplicar3d(p, m, escala);
      m.atual.z -= m.elevar;
      m.atual.x -= tremorX;
    }

    if (contorno.grupo.visible) {
      contorno.pulsar(agora, passo.tipo === 'colocar' && maoMira && dentro(passo.peca, maoMira.x, -maoMira.y, 3) ? 1.3 : 1);
      mais = true;
    }

    if (passo.tipo === 'soldar') {
      const p = passo.peca;
      const c = centroLocal(p);
      const topo = p.altura + 0.6;
      if (segurando) ferroAlvo.copy(ferroCursor && dentro(p, ferroCursor.x, -ferroCursor.y, 4) ? ferroCursor : c).setZ(topo);
      else if (ferroForcado) ferroAlvo.copy(ferroForcado);
      else if (ferroCursor) ferroAlvo.copy(ferroCursor).setZ(topo + 9);
      else ferroAlvo.set(c.x + Math.min(10, p.caixa.l), c.y - 4, topo + 12);
      cena.conteudo.localToWorld(ferroAlvo);
    } else if (ferroForcado) {
      ferroAlvo.copy(ferroForcado);
      cena.conteudo.localToWorld(ferroAlvo);
    } else ferroAlvo.copy(garagem);
    const distancia = ferro.grupo.position.distanceTo(ferroAlvo);
    if (distancia > 0.03) {
      ferro.grupo.position.lerp(ferroAlvo, amortecer(dt, distancia > 60 ? 130 : 55));
      mais = true;
    }
    const quente = segurando ? Math.min(1, (agora - segurando.t0) / TEMPO_SOLDA) : 0;
    ferro.brilho.intensity += (quente * 1100 - ferro.brilho.intensity) * amortecer(dt, 80);
    if (segurando) {
      mais = true;
      if (agora - segurando.ultimaFumaca > 55) {
        segurando.ultimaFumaca = agora;
        pontaMundo.copy(ferro.grupo.position);
        pontaMundo.z += 1.5;
        fumaca.emitir(pontaMundo, quente > 0.2 ? 2 : 1);
      }
    }
    if (fumaca.atualizar(dt)) mais = true;
    if (onda.atualizar(dt)) mais = true;
    if (girarFesta > agora) {
      palco.pose.giro += dt * 0.035;
      mais = true;
    }
    return mais;
  });

  const anelSolda = h('div', { class: 'montagem-anel', hidden: true, 'aria-hidden': 'true' }, s('svg', { viewBox: '0 0 40 40' }, s('circle', { class: 'fundo', cx: 20, cy: 20, r: 16 }), s('circle', { class: 'carga', cx: 20, cy: 20, r: 16, pathLength: 100 })));
  const toast = h('div', { class: 'montagem-toast', role: 'status', 'aria-live': 'polite' });
  let toastId = 0;
  palco.aoDesenhar(() => {
    const passo = passoAtual(montagem);
    if (passo.tipo !== 'soldar' && !ferroForcado) {
      anelSolda.hidden = true;
      return;
    }
    const p = palco.projetar(ferro.grupo.position);
    const z = zoomDaPagina();
    anelSolda.hidden = !p.frente;
    const carga = segurando ? Math.min(1, (performance.now() - segurando.t0) / TEMPO_SOLDA) : 0;
    estilo(anelSolda, { transform: `translate(${(p.x / z).toFixed(1)}px, ${(p.y / z).toFixed(1)}px) translate(-50%, -50%)`, '--carga': carga.toFixed(3) });
    anelSolda.dataset.ativo = String(!!segurando);
  });

  const enquadrar = (tipo: string): void => {
    if (!palco.ocioso(600)) return;
    const quadro = tipo === 'pegar' || tipo === 'fim' ? enquadrarBancada() : enquadrarPlaca();
    palco.irPara({ ...quadro, inclinacao: tipo === 'pegar' || tipo === 'fim' ? 40 : 44 }, 1100);
  };

  const nome = (parte: string): string => tr(placa.partes.find((p) => p.id === parte)?.nome ?? parte);
  const recordes = (): string => {
    const r = lerRecordes()[placa.id];
    const v = montagem.desafio ? r?.desafio : r?.normal;
    return v ? ui('melhorTempo', { t: relogio(v) }) : '';
  };

  const atualizarRelogio = (): void => {
    const fim = montagem.fim ?? performance.now();
    tempo.textContent = montagem.inicio === null ? '0:00' : relogio(fim - montagem.inicio);
  };

  const avisar = (texto: string | null, tipo: 'erro' | 'ok' = 'erro'): void => {
    window.clearTimeout(toastId);
    if (!texto) {
      toast.dataset.visivel = 'false';
      return;
    }
    toast.textContent = texto;
    toast.dataset.tipo = tipo;
    toast.dataset.visivel = 'true';
    toastId = window.setTimeout(() => (toast.dataset.visivel = 'false'), tipo === 'erro' ? 2600 : 3600);
  };

  let ultimoTipo = '';
  let ultimoTexto = '';
  const itens = new Map<string, { li: HTMLLIElement; botao: HTMLButtonElement; estado: HTMLElement }>();
  const montarLista = (): void => {
    itens.clear();
    trocar(
      lista,
      ...montagem.pecas.map((p) => {
        const estado = h('small', { class: 'mono' });
        const botao = h('button', { class: 'montagem-item', type: 'button', 'data-parte': p.parte, onclick: () => tentarPegar(p.parte) }, h('span', { class: 'montagem-ponto', 'aria-hidden': 'true' }), h('span', { class: 'montagem-item-nome' }, nome(p.parte)), estado);
        const li = h('li', {}, botao);
        itens.set(p.parte, { li, botao, estado });
        return li;
      }),
    );
  };

  const desenhar = (): void => {
    const agora = performance.now();
    const feitas = soldadas(montagem);
    const totalPecas = montagem.pecas.length;
    estilo(progresso.firstElementChild as HTMLElement, { '--fracao': totalPecas ? (feitas / totalPecas).toFixed(4) : '0' });
    progresso.setAttribute('aria-valuemax', String(totalPecas));
    progresso.setAttribute('aria-valuenow', String(feitas));
    contagem.textContent = ui('soldadasDe', { n: feitas, total: totalPecas });
    atualizarRelogio();
    const passo = passoAtual(montagem);
    const forte = (t: string): HTMLElement => h('strong', {}, t);
    let conteudo: Node[];
    if (passo.tipo === 'fim') {
      const ms = (montagem.fim ?? 0) - (montagem.inicio ?? 0);
      conteudo = [
        h('small', { class: 'rotulo' }, ui('montagemCompleta')),
        h('p', {}, ui('montadaEm', { t: relogio(ms) }), ' ', montagem.dicas === 1 ? ui('comUmaDica') : ui('comDicas', { n: montagem.dicas })),
        ...(recordes() ? [h('p', { class: 'montagem-recorde' }, recordes())] : []),
      ];
    } else {
      const n = forte(nome(passo.peca.parte));
      const textos: Record<typeof passo.tipo, Node[]> = {
        pegar: montagem.desafio ? [document.createTextNode(ui('passoEscolha'))] : [document.createTextNode(ui('passoPegarA')), n, document.createTextNode(ui('passoPegarB'))],
        colocar: montagem.desafio ? [document.createTextNode(ui('passoColocarDesafioA')), n, document.createTextNode(ui('passoColocarDesafioB'))] : [document.createTextNode(ui('passoColocarA')), n, document.createTextNode(ui('passoColocarB'))],
        soldar: [document.createTextNode(ui('passoSoldarA')), n, document.createTextNode(ui('passoSoldarB'))],
      };
      conteudo = [h('small', { class: 'rotulo' }, ui('passoDe', { n: passo.numero, total: passo.total })), h('p', {}, ...textos[passo.tipo])];
    }
    const chaveTexto = `${passo.tipo}:${passo.tipo === 'fim' ? '' : passo.peca.parte}:${montagem.desafio}`;
    if (chaveTexto !== ultimoTexto) {
      ultimoTexto = chaveTexto;
      trocar(passoEl, ...conteudo);
      passoEl.dataset.tipo = passo.tipo;
      passoEl.classList.remove('entrar');
      void passoEl.offsetWidth;
      passoEl.classList.add('entrar');
    }
    const foco = passo.tipo === 'fim' ? null : passo.tipo === 'pegar' && montagem.desafio ? null : passo.peca;
    const parte = foco ? placa.partes.find((p) => p.id === foco.parte) : undefined;
    sobre.hidden = !parte;
    if (parte) trocar(sobre, h('small', { class: 'rotulo' }, ui('oQueFaz')), h('strong', {}, tr(parte.nome)), h('p', {}, tr(parte.oque), ' ', tr(parte.funcao)));
    if (itens.size !== montagem.pecas.length) montarLista();
    for (const p of montagem.pecas) {
      const item = itens.get(p.parte);
      if (!item) continue;
      const estado = montagem.estados[p.parte] ?? 'bandeja';
      const classe = `montagem-item est-${estado}`;
      if (item.botao.className !== classe) {
        item.botao.className = classe;
        item.botao.classList.add('mudou');
      }
      item.estado.textContent = ui(ROTULO_ESTADO[estado]);
      if (foco?.parte === p.parte) item.botao.setAttribute('aria-current', 'step');
      else item.botao.removeAttribute('aria-current');
    }
    const atual = foco ? itens.get(foco.parte)?.li : undefined;
    if (atual) {
      const caixa = lista.getBoundingClientRect();
      const r = atual.getBoundingClientRect();
      if (r.top < caixa.top || r.bottom > caixa.bottom) lista.scrollTo({ top: lista.scrollTop + (r.top - caixa.top) / zoomDaPagina() - lista.clientHeight / 3, behavior: 'smooth' });
    }
    chaveDesafio.setAttribute('aria-checked', String(montagem.desafio));
    const valor = chaveDesafio.querySelector('small');
    if (valor) valor.textContent = montagem.desafio ? ui('ligado') : ui('desligado');
    botaoAuto.disabled = passo.tipo === 'fim';
    botaoDica.disabled = passo.tipo === 'fim';
    botaoAcao.hidden = passo.tipo === 'fim' || passo.tipo === 'pegar';
    if (passo.tipo === 'colocar') trocar(botaoAcao, icone('mao', 'icone mini'), ui('colocarNaPlaca'));
    if (passo.tipo === 'soldar') trocar(botaoAcao, icone('ferro', 'icone mini'), ui('soldarAgora'));
    const emMao = passo.tipo === 'colocar' ? passo.peca : null;
    contorno.grupo.visible = !!emMao && !montagem.desafio;
    if (emMao && chaveTexto.startsWith('colocar')) {
      contorno.moldar(emMao.caixa.l + 1.6, emMao.caixa.a + 1.6);
      contorno.grupo.position.set(emMao.caixa.x + emMao.caixa.l / 2, -(emMao.caixa.y + emMao.caixa.a / 2), 0.08);
    }
    if (passo.tipo !== 'colocar') {
      maoCursor = null;
      maoMira = null;
    }
    if (passo.tipo !== 'soldar') ferroCursor = null;
    redefinirAlvos(agora);
    if (passo.tipo !== ultimoTipo) {
      const anterior = ultimoTipo;
      ultimoTipo = passo.tipo;
      if (anterior) enquadrar(passo.tipo);
    }
    palco.pedir();
  };

  const terminouAgora = (antes: Montagem): void => {
    if (antes.fim !== null || montagem.fim === null || montagem.inicio === null) return;
    const novo = gravarRecorde(placa.id, montagem.desafio ? 'desafio' : 'normal', montagem.fim - montagem.inicio);
    avisar(novo ? ui('novoRecorde') : ui('placaPronta'), 'ok');
    window.clearInterval(relogioId);
    girarFesta = performance.now() + 2600;
    palco.irPara({ ...enquadrarPlaca(), inclinacao: 50 }, 1200);
    palco.pedir();
  };

  const aplicar = (r: { ok: true; montagem: Montagem } | { ok: false; motivo: Recusa }, parte?: string): boolean => {
    if (!r.ok) {
      avisar(ui(RECUSA[r.motivo]));
      const m = parte ? moveis.get(parte) : undefined;
      if (m) m.tremor = performance.now() + 420;
      palco.pedir();
      return false;
    }
    const antes = montagem;
    montagem = r.montagem;
    if (antes.inicio === null && montagem.inicio !== null) relogioId = window.setInterval(atualizarRelogio, 500);
    avisar(null);
    terminouAgora(antes);
    desenhar();
    return true;
  };

  function tentarPegar(parte: string, ev?: PointerEvent): void {
    if (automatizando) return;
    const passo = passoAtual(montagem);
    if (passo.tipo === 'colocar' && passo.peca.parte === parte) return;
    if (ev) atualizarMao(ev);
    aplicar(pegar(montagem, parte, performance.now()), parte);
  }

  const pontoNaPlaca = (ev: PointerEvent, altura = 0): THREE.Vector3 | null => {
    const mundo = palco.noPlano(ev, zPlaca + altura);
    return mundo ? cena.conteudo.worldToLocal(mundo) : null;
  };

  const pecaNoPonteiro = (ev: PointerEvent): PecaKit | undefined => {
    const { parte } = parteNoPonto(cena, palco.raio(ev));
    return parte ? pecas.find((p) => p.parte === parte) : undefined;
  };

  const atualizarMao = (ev: PointerEvent): void => {
    const passo = passoAtual(montagem);
    const peca = passo.tipo === 'colocar' ? passo.peca : null;
    maoCursor = pontoNaPlaca(ev, peca ? ALTURA_MAO(peca) : 18);
    maoMira = pontoNaPlaca(ev);
  };

  function clicar(ev: PointerEvent): void {
    if (automatizando) return;
    const passo = passoAtual(montagem);
    if (passo.tipo === 'colocar') {
      const ponto = pontoNaPlaca(ev);
      if (ponto && dentro(passo.peca, ponto.x, -ponto.y, 3)) aplicar(colocar(montagem, passo.peca.parte, performance.now()));
      else {
        avisar(ui('naoEAi'));
        const m = moveis.get(passo.peca.parte);
        if (m) m.tremor = performance.now() + 420;
        palco?.pedir();
      }
      return;
    }
    const peca = pecaNoPonteiro(ev);
    if (peca && montagem.estados[peca.parte] === 'bandeja') tentarPegar(peca.parte, ev);
  }

  function comecarSolda(ev: PointerEvent): boolean {
    if (automatizando) return false;
    const passo = passoAtual(montagem);
    if (passo.tipo !== 'soldar') return false;
    const ponto = pontoNaPlaca(ev);
    const peca = pecaNoPonteiro(ev);
    if (peca?.parte !== passo.peca.parte && !(ponto && dentro(passo.peca, ponto.x, -ponto.y, 4))) return false;
    ferroCursor = ponto;
    iniciarSolda(passo.peca);
    return true;
  }

  let quadroSolda = 0;
  const iniciarSolda = (peca: PecaKit, aoTerminar?: () => void): void => {
    cancelarSolda();
    const t0 = performance.now();
    segurando = { parte: peca.parte, t0, ultimaFumaca: 0 };
    const passo = (): void => {
      if (!segurando || !vivo) return;
      const k = Math.min(1, (performance.now() - t0) / TEMPO_SOLDA);
      estilo(botaoAcao, { '--carga': k.toFixed(3) });
      if (k >= 1) {
        segurando = null;
        estilo(botaoAcao, { '--carga': '0' });
        const c = cena.conteudo.localToWorld(centroLocal(peca).setZ(0.3));
        onda.disparar(c, Math.max(4, Math.max(peca.caixa.l, peca.caixa.a) * 0.75));
        realce.acender([peca.parte], '#ffd27a', 0.55);
        depois(() => {
          realce.apagar();
          palco.pedir();
        }, 320);
        aplicar(soldar(montagem, peca.parte, performance.now()));
        aoTerminar?.();
        return;
      }
      quadroSolda = requestAnimationFrame(passo);
    };
    quadroSolda = requestAnimationFrame(passo);
    palco.pedir();
  };

  function cancelarSolda(): void {
    if (!segurando) return;
    cancelAnimationFrame(quadroSolda);
    segurando = null;
    estilo(botaoAcao, { '--carga': '0' });
    palco?.pedir();
  }

  const dica = h('div', { class: 'vitrine-dica', hidden: true });
  function pairar(ev: PointerEvent | null): void {
    if (!palco) return;
    const passo = passoAtual(montagem);
    if (!ev) {
      dica.hidden = true;
      pairandoParte = null;
      palco.pedir();
      return;
    }
    if (passo.tipo === 'colocar') {
      atualizarMao(ev);
      dica.hidden = true;
      palco.tela.style.cursor = 'grabbing';
      redefinirAlvos(performance.now());
      palco.pedir();
      return;
    }
    if (passo.tipo === 'soldar') {
      ferroCursor = pontoNaPlaca(ev);
      dica.hidden = true;
      palco.tela.style.cursor = ferroCursor && dentro(passo.peca, ferroCursor.x, -ferroCursor.y, 4) ? 'none' : '';
      palco.pedir();
      return;
    }
    const peca = pecaNoPonteiro(ev);
    const naBandejaAgora = peca && montagem.estados[peca.parte] === 'bandeja' ? peca.parte : null;
    if (naBandejaAgora !== pairandoParte) {
      pairandoParte = naBandejaAgora;
      palco.pedir();
    }
    if (!peca) {
      dica.hidden = true;
      palco.tela.style.cursor = '';
      return;
    }
    const r = palco.el.getBoundingClientRect();
    dica.hidden = false;
    dica.textContent = nome(peca.parte);
    const z = zoomDaPagina();
    estilo(dica, { transform: `translate(${((ev.clientX - r.left) / z + 14).toFixed(0)}px, ${((ev.clientY - r.top) / z + 12).toFixed(0)}px)` });
    palco.tela.style.cursor = naBandejaAgora ? 'grab' : 'pointer';
  }

  botaoAcao.addEventListener('pointerdown', (ev) => {
    const passo = passoAtual(montagem);
    if (passo.tipo !== 'soldar' || automatizando) return;
    ev.preventDefault();
    botaoAcao.setPointerCapture(ev.pointerId);
    ferroCursor = null;
    iniciarSolda(passo.peca);
  });
  botaoAcao.addEventListener('pointerup', () => {
    if (passoAtual(montagem).tipo === 'soldar') cancelarSolda();
  });
  botaoAcao.addEventListener('keydown', (ev) => {
    const passo = passoAtual(montagem);
    if (passo.tipo === 'soldar' && (ev.key === ' ' || ev.key === 'Enter') && !segurando) {
      ev.preventDefault();
      ferroCursor = null;
      iniciarSolda(passo.peca);
    }
  });
  botaoAcao.addEventListener('keyup', () => cancelarSolda());
  botaoAcao.addEventListener('click', () => {
    const passo = passoAtual(montagem);
    if (passo.tipo === 'colocar' && !automatizando) {
      maoCursor = null;
      maoMira = null;
      aplicar(colocar(montagem, passo.peca.parte, performance.now()));
    }
  });

  function darDica(): void {
    const passo = passoAtual(montagem);
    if (passo.tipo === 'fim') return;
    montagem = { ...montagem, dicas: montagem.dicas + 1 };
    const alvo = passo.peca;
    realce.acender([alvo.parte], '#4cc9f0', 0.7);
    avisar(passo.tipo === 'pegar' ? ui('dicaPegar', { nome: nome(alvo.parte) }) : passo.tipo === 'colocar' ? ui('dicaColocar') : ui('dicaSoldar'), 'ok');
    if (passo.tipo === 'colocar') {
      contorno.grupo.visible = true;
      contorno.moldar(alvo.caixa.l + 1.6, alvo.caixa.a + 1.6);
      contorno.grupo.position.set(alvo.caixa.x + alvo.caixa.l / 2, -(alvo.caixa.y + alvo.caixa.a / 2), 0.08);
    }
    if (passo.tipo === 'pegar') {
      const m = moveis.get(alvo.parte);
      if (m) m.tremor = performance.now() + 420;
    }
    palco?.pedir();
    depois(() => {
      realce.apagar();
      const p = passoAtual(montagem);
      if (p.tipo !== 'fim' && p.peca.parte === alvo.parte) desenhar();
      palco?.pedir();
    }, 1400);
  }

  let automatizando = false;
  function automatico(): void {
    if (automatizando) return;
    cancelarSolda();
    const inicio = passoAtual(montagem);
    if (inicio.tipo === 'fim') return;
    automatizando = true;
    botaoAuto.disabled = true;
    const peca = inicio.peca;
    maoCursor = null;
    maoMira = null;
    const soldarAuto = (): void => {
      const c = centroLocal(peca);
      ferroForcado = new THREE.Vector3(c.x + 3, c.y - 2, peca.altura + 10);
      palco?.pedir();
      depois(() => {
        ferroForcado = new THREE.Vector3(c.x, c.y, peca.altura + 0.6);
        iniciarSolda(peca, () => {
          ferroForcado = null;
          automatizando = false;
          desenhar();
        });
      }, 420);
    };
    const colocarAuto = (): void => {
      aplicar(colocar(montagem, peca.parte, performance.now()));
      depois(soldarAuto, 520);
    };
    if (inicio.tipo === 'pegar') {
      const r = avancar(montagem, performance.now());
      const antes = montagem;
      montagem = r;
      if (antes.inicio === null && montagem.inicio !== null) relogioId = window.setInterval(atualizarRelogio, 500);
      desenhar();
      depois(colocarAuto, 820);
    } else if (inicio.tipo === 'colocar') colocarAuto();
    else soldarAuto();
  }

  function reiniciar(desafio: boolean): void {
    cancelarSolda();
    window.clearInterval(relogioId);
    for (const t of temporizadores) window.clearTimeout(t);
    temporizadores.clear();
    automatizando = false;
    ferroForcado = null;
    montagem = iniciarMontagem(pecas, desafio);
    avisar(desafio ? ui('desafioLigado') : null, 'ok');
    desenhar();
  }

  const teclas = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape' && !ctxBloqueado()) {
      if (segurando) cancelarSolda();
      else sair();
    }
  };
  const ctxBloqueado = (): boolean => ctx.loja.atual.busca || ctx.loja.atual.ajuda;
  document.addEventListener('keydown', teclas);

  palco.el.append(toast, anelSolda, dica, h('button', { class: 'montagem-sair', type: 'button', onclick: sair }, icone('ferro', 'icone mini'), ui('sairMontagem')));
  desenhar();
  ultimoTipo = passoAtual(montagem).tipo;

  const el = h('div', { class: 'pagina-montagem', 'data-placa': placa.id }, palco.el, painel);
  return {
    el,
    destruir: () => {
      vivo = false;
      document.removeEventListener('keydown', teclas);
      cancelarSolda();
      window.clearInterval(relogioId);
      window.clearTimeout(toastId);
      for (const t of temporizadores) window.clearTimeout(t);
      realce.apagar();
      palco.destruir();
      cena.descartar();
    },
  };
};
