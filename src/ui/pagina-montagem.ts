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
import { estilo, h, trocar, zoomDaPagina } from './dom';
import { icone } from './icones';
import { construirCena } from './kicad/cena';
import { bandeja, carretel, em, ferroDeSolda, marcadorPulsante, tapete, tapeteAntiestatico } from './cena3d/objetos';
import { montarPalco } from './cena3d/palco';
import { criarRealce, parteNoPonto } from './cena3d/realce';

const CHAVE_RECORDES = 'rumo:montagem';
const TEMPO_SOLDA = 900;

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
  let mensagem: { texto: string; tipo: 'erro' | 'ok' } | null = null;
  let relogioId = 0;
  let segurando: { parte: string; t0: number; quadro: number } | null = null;

  const progresso = h('span', { class: 'montagem-progresso', role: 'progressbar', 'aria-valuemin': '0' }, h('span', {}));
  const contagem = h('span', { class: 'mono' });
  const tempo = h('span', { class: 'mono montagem-tempo' });
  const passoEl = h('div', { class: 'montagem-passo', 'aria-live': 'polite' });
  const sobre = h('div', { class: 'montagem-sobre' });
  const lista = h('ol', { class: 'montagem-lista' });
  const avisoEl = h('p', { class: 'montagem-aviso', role: 'status', hidden: true });
  const chaveDesafio = h('button', { class: 'chave-alternar', type: 'button', role: 'switch', 'aria-checked': 'false', onclick: () => reiniciar(!montagem.desafio) }, h('span', { class: 'chave-trilho' }), h('span', {}, ui('desafio')), h('small', { class: 'mono' }));
  const botaoDica = h('button', { class: 'botao', type: 'button', onclick: () => darDica() }, icone('lampada', 'icone mini'), ui('dica'));
  const botaoAuto = h('button', { class: 'botao destaque', type: 'button', onclick: () => automatico() }, ui('colocarProxima'));
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
    avisoEl,
    sobre,
    h('h2', { class: 'rotulo montagem-lista-titulo' }, ui('pecasDoKit')),
    lista,
    h('div', { class: 'montagem-botoes' }, botaoDica, botaoAuto),
    botaoAcao,
    chaveDesafio,
    h('div', { class: 'montagem-botoes' }, h('button', { class: 'botao', type: 'button', onclick: () => reiniciar(montagem.desafio) }, ui('recomecar')), h('button', { class: 'botao', type: 'button', onclick: sair }, ui('sair'))),
    h('p', { class: 'montagem-nota' }, ui('notaSmd')),
  );

  const palco = montarPalco({
    classe: 'montagem-palco',
    rotulo: `${placa.nome} · ${ui('kitMontagem')}`,
    pose: { inclinacao: 44, giro: -10, distancia: 320 },
    distancias: [70, 1600],
    extensao: 420,
    rodaLivre: true,
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

  const cena = construirCena(placa, palco.renderer, 2048, true);
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

  palco.cena.add(tapete({ largura: 1600, altura: 1000, cor: '#b3bac4', linha: '#a1a9b4', forte: '#8a94a1' }, palco.renderer));
  palco.cena.add(em(tapeteAntiestatico(L + 24, A + 24), 0, yPlaca, 0));
  palco.cena.add(em(bandeja(arrumacao.largura + 10, arrumacao.altura + 10), 0, yBandeja, 0));
  const spool = carretel();
  spool.scale.setScalar(0.75);
  spool.position.set(-Math.max(L, arrumacao.largura) / 2 - 55, yPlaca + A / 2, 0);
  palco.cena.add(spool);
  const ferro = ferroDeSolda();
  const repouso = new THREE.Vector3(Math.max(L, arrumacao.largura) / 2 + 26, yPlaca - A / 4, 10);
  ferro.grupo.position.copy(repouso);
  ferro.grupo.rotation.z = 1.05;
  palco.cena.add(ferro.grupo);

  const apoio = new THREE.Group();
  apoio.position.set(0, yPlaca, zPlaca);
  apoio.add(placa3d);
  palco.cena.add(apoio);
  palco.irPara({ distancia: Math.max(220, total * 2.1) }, 0);

  const marcador = marcadorPulsante(1, 1);
  marcador.visible = false;
  cena.conteudo.add(marcador);

  const vagas = new Map(arrumacao.vagas.map((v) => [v.parte, v]));
  const deslocamentos = new Map<string, { atual: THREE.Vector3; alvo: THREE.Vector3 }>();
  const centroLocal = (p: PecaKit): THREE.Vector3 => new THREE.Vector3(p.caixa.x + p.caixa.l / 2, -(p.caixa.y + p.caixa.a / 2), 0);
  const naBandeja = (p: PecaKit): THREE.Vector3 => {
    const v = vagas.get(p.parte);
    const mundo = new THREE.Vector3((v?.x ?? 0) - arrumacao.largura / 2, yBandeja + arrumacao.altura / 2 - (v?.y ?? 0), 3.4);
    const placaMundo = new THREE.Vector3(-L / 2, yPlaca + A / 2, zPlaca).add(centroLocal(p));
    return mundo.sub(placaMundo);
  };
  const alvoDe = (p: PecaKit, estado: EstadoPeca): THREE.Vector3 => {
    if (estado === 'bandeja') return naBandeja(p);
    if (estado === 'mao') return new THREE.Vector3(0, -6, 26 + p.altura);
    return new THREE.Vector3(0, 0, 0);
  };
  for (const p of pecas) {
    const inicio = alvoDe(p, 'bandeja');
    deslocamentos.set(p.parte, { atual: inicio.clone(), alvo: inicio.clone() });
  }
  const aplicarDeslocamentos = (): void => {
    for (const p of pecas) {
      const d = deslocamentos.get(p.parte);
      if (!d) continue;
      for (const i of p.indices) {
        const k = cena.projeto.footprints.findIndex((f) => f.indice === i);
        cena.modelos[k]?.position.copy(d.atual);
      }
    }
  };
  aplicarDeslocamentos();

  let pulso = 0;
  let ferroAlvo: THREE.Vector3 | null = null;
  palco.animar((dt, agora) => {
    let mais = false;
    for (const p of pecas) {
      const d = deslocamentos.get(p.parte);
      if (!d) continue;
      const estado = montagem.estados[p.parte];
      const alvo = d.alvo.clone();
      if (estado === 'mao') {
        alvo.z += Math.sin(agora / 320) * 1.6;
        mais = true;
      }
      if (d.atual.distanceTo(alvo) > 0.02) {
        d.atual.lerp(alvo, Math.min(1, dt / 110));
        mais = true;
      } else d.atual.copy(alvo);
    }
    aplicarDeslocamentos();
    if (marcador.visible) {
      pulso += dt;
      const m = marcador.material as THREE.MeshBasicMaterial;
      m.opacity = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(pulso / 180));
      mais = true;
    }
    const destino = ferroAlvo ?? repouso;
    if (ferro.grupo.position.distanceTo(destino) > 0.05) {
      ferro.grupo.position.lerp(destino, Math.min(1, dt / 140));
      mais = true;
    }
    const quente = segurando ? Math.min(1, (agora - segurando.t0) / TEMPO_SOLDA) : 0;
    ferro.brilho.intensity = quente * 900;
    if (segurando) mais = true;
    return mais;
  });

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
    mensagem = texto ? { texto, tipo } : null;
    avisoEl.hidden = !mensagem;
    avisoEl.textContent = mensagem?.texto ?? '';
    avisoEl.dataset.tipo = mensagem?.tipo ?? '';
  };

  const desenhar = (): void => {
    const feitas = soldadas(montagem);
    const totalPecas = montagem.pecas.length;
    estilo(progresso.firstElementChild as HTMLElement, { '--fracao': totalPecas ? (feitas / totalPecas).toFixed(4) : '0' });
    progresso.setAttribute('aria-valuemax', String(totalPecas));
    progresso.setAttribute('aria-valuenow', String(feitas));
    contagem.textContent = ui('soldadasDe', { n: feitas, total: totalPecas });
    atualizarRelogio();
    const passo = passoAtual(montagem);
    const forte = (t: string): HTMLElement => h('strong', {}, t);
    if (passo.tipo === 'fim') {
      const ms = (montagem.fim ?? 0) - (montagem.inicio ?? 0);
      trocar(
        passoEl,
        h('small', { class: 'rotulo' }, ui('montagemCompleta')),
        h('p', {}, ui('montadaEm', { t: relogio(ms) }), ' ', montagem.dicas === 1 ? ui('comUmaDica') : ui('comDicas', { n: montagem.dicas })),
        recordes() ? h('p', { class: 'montagem-recorde' }, recordes()) : null,
      );
      passoEl.dataset.tipo = 'fim';
    } else {
      const n = forte(nome(passo.peca.parte));
      const textos: Record<typeof passo.tipo, Node[]> = {
        pegar: montagem.desafio ? [document.createTextNode(ui('passoEscolha'))] : [document.createTextNode(ui('passoPegarA')), n, document.createTextNode(ui('passoPegarB'))],
        colocar: montagem.desafio ? [document.createTextNode(ui('passoColocarDesafioA')), n, document.createTextNode(ui('passoColocarDesafioB'))] : [document.createTextNode(ui('passoColocarA')), n, document.createTextNode(ui('passoColocarB'))],
        soldar: [document.createTextNode(ui('passoSoldarA')), n, document.createTextNode(ui('passoSoldarB'))],
      };
      trocar(passoEl, h('small', { class: 'rotulo' }, ui('passoDe', { n: passo.numero, total: passo.total })), h('p', {}, ...textos[passo.tipo]));
      passoEl.dataset.tipo = passo.tipo;
    }
    const foco = passo.tipo === 'fim' ? null : passo.tipo === 'pegar' && montagem.desafio ? null : passo.peca;
    const parte = foco ? placa.partes.find((p) => p.id === foco.parte) : undefined;
    sobre.hidden = !parte;
    if (parte) trocar(sobre, h('small', { class: 'rotulo' }, ui('oQueFaz')), h('strong', {}, tr(parte.nome)), h('p', {}, tr(parte.oque), ' ', tr(parte.funcao)));
    trocar(
      lista,
      ...montagem.pecas.map((p) => {
        const estado = montagem.estados[p.parte] ?? 'bandeja';
        return h(
          'li',
          {},
          h(
            'button',
            { class: `montagem-item est-${estado}`, type: 'button', 'data-parte': p.parte, 'aria-current': foco?.parte === p.parte ? 'step' : null, onclick: () => tentarPegar(p.parte) },
            h('span', { class: 'montagem-ponto', 'aria-hidden': 'true' }),
            h('span', { class: 'montagem-item-nome' }, nome(p.parte)),
            h('small', { class: 'mono' }, ui(ROTULO_ESTADO[estado])),
          ),
        );
      }),
    );
    lista.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest' });
    chaveDesafio.setAttribute('aria-checked', String(montagem.desafio));
    const valor = chaveDesafio.querySelector('small');
    if (valor) valor.textContent = montagem.desafio ? ui('ligado') : ui('desligado');
    botaoAuto.disabled = passo.tipo === 'fim';
    botaoDica.disabled = passo.tipo === 'fim';
    botaoAcao.hidden = passo.tipo === 'fim' || passo.tipo === 'pegar';
    if (passo.tipo === 'colocar') trocar(botaoAcao, icone('mao', 'icone mini'), ui('colocarNaPlaca'));
    if (passo.tipo === 'soldar') trocar(botaoAcao, icone('ferro', 'icone mini'), ui('soldarAgora'));
    const emMao = passo.tipo === 'colocar' ? passo.peca : null;
    marcador.visible = !!emMao && !montagem.desafio;
    if (emMao) {
      marcador.scale.set(emMao.caixa.l + 2, emMao.caixa.a + 2, 1);
      marcador.position.set(emMao.caixa.x + emMao.caixa.l / 2, -(emMao.caixa.y + emMao.caixa.a / 2), 0.06);
    }
    const ponteadas = montagem.pecas.filter((p) => montagem.estados[p.parte] === 'ponteada').map((p) => p.parte);
    if (ponteadas.length) realce.acender(ponteadas, '#ff9f43', 0.25);
    else realce.apagar();
    for (const p of pecas) {
      const d = deslocamentos.get(p.parte);
      if (d) d.alvo.copy(alvoDe(p, montagem.estados[p.parte] ?? 'bandeja'));
    }
    palco.pedir();
  };

  const terminouAgora = (antes: Montagem): void => {
    if (antes.fim !== null || montagem.fim === null || montagem.inicio === null) return;
    const novo = gravarRecorde(placa.id, montagem.desafio ? 'desafio' : 'normal', montagem.fim - montagem.inicio);
    avisar(novo ? ui('novoRecorde') : ui('placaPronta'), 'ok');
    window.clearInterval(relogioId);
  };

  const aplicar = (r: { ok: true; montagem: Montagem } | { ok: false; motivo: Recusa }): boolean => {
    if (!r.ok) {
      avisar(ui(RECUSA[r.motivo]));
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

  function tentarPegar(parte: string): void {
    const passo = passoAtual(montagem);
    if (passo.tipo === 'colocar' && passo.peca.parte === parte) return;
    aplicar(pegar(montagem, parte, performance.now()));
  }

  const pontoNaPlaca = (ev: PointerEvent): { x: number; y: number } | null => {
    const mundo = palco.noPlano(ev, zPlaca);
    if (!mundo) return null;
    const local = cena.conteudo.worldToLocal(mundo);
    return { x: local.x, y: -local.y };
  };

  const pecaNoPonteiro = (ev: PointerEvent): PecaKit | undefined => {
    const { parte } = parteNoPonto(cena, palco.raio(ev));
    return parte ? pecas.find((p) => p.parte === parte) : undefined;
  };

  function clicar(ev: PointerEvent): void {
    const passo = passoAtual(montagem);
    const peca = pecaNoPonteiro(ev);
    if (passo.tipo === 'colocar') {
      const ponto = pontoNaPlaca(ev);
      if (ponto && dentro(passo.peca, ponto.x, ponto.y)) aplicar(colocar(montagem, passo.peca.parte, performance.now()));
      else if (ponto && ponto.x >= 0 && ponto.x <= L && ponto.y >= 0 && ponto.y <= A) avisar(ui('naoEAi'));
      return;
    }
    if (peca && montagem.estados[peca.parte] === 'bandeja') tentarPegar(peca.parte);
  }

  function comecarSolda(ev: PointerEvent): boolean {
    const passo = passoAtual(montagem);
    if (passo.tipo !== 'soldar') return false;
    const ponto = pontoNaPlaca(ev);
    const peca = pecaNoPonteiro(ev);
    if (peca?.parte !== passo.peca.parte && !(ponto && dentro(passo.peca, ponto.x, ponto.y, 4))) return false;
    iniciarSolda(passo.peca);
    return true;
  }

  const iniciarSolda = (peca: PecaKit): void => {
    cancelarSolda();
    const c = cena.conteudo.localToWorld(centroLocal(peca).setZ(peca.altura + 1));
    ferroAlvo = c;
    const t0 = performance.now();
    const passo = (): void => {
      if (!segurando) return;
      const k = Math.min(1, (performance.now() - t0) / TEMPO_SOLDA);
      estilo(botaoAcao, { '--carga': k.toFixed(3) });
      if (k >= 1) {
        segurando = null;
        ferroAlvo = null;
        estilo(botaoAcao, { '--carga': '0' });
        aplicar(soldar(montagem, peca.parte, performance.now()));
        return;
      }
      segurando = { parte: peca.parte, t0, quadro: requestAnimationFrame(passo) };
    };
    segurando = { parte: peca.parte, t0, quadro: requestAnimationFrame(passo) };
    palco.pedir();
  };

  function cancelarSolda(): void {
    if (!segurando) return;
    cancelAnimationFrame(segurando.quadro);
    segurando = null;
    ferroAlvo = null;
    estilo(botaoAcao, { '--carga': '0' });
    palco?.pedir();
  }

  const dica = h('div', { class: 'vitrine-dica', hidden: true });
  palco.el.append(dica);
  function pairar(ev: PointerEvent | null): void {
    if (!palco) return;
    const peca = ev ? pecaNoPonteiro(ev) : undefined;
    if (!ev || !peca) {
      dica.hidden = true;
      palco.tela.style.cursor = '';
      return;
    }
    const r = palco.el.getBoundingClientRect();
    dica.hidden = false;
    dica.textContent = nome(peca.parte);
    const z = zoomDaPagina();
    estilo(dica, { transform: `translate(${((ev.clientX - r.left) / z + 14).toFixed(0)}px, ${((ev.clientY - r.top) / z + 12).toFixed(0)}px)` });
    palco.tela.style.cursor = 'pointer';
  }

  botaoAcao.addEventListener('pointerdown', (ev) => {
    const passo = passoAtual(montagem);
    if (passo.tipo !== 'soldar') return;
    ev.preventDefault();
    botaoAcao.setPointerCapture(ev.pointerId);
    iniciarSolda(passo.peca);
  });
  botaoAcao.addEventListener('pointerup', () => {
    if (passoAtual(montagem).tipo === 'soldar') cancelarSolda();
  });
  botaoAcao.addEventListener('keydown', (ev) => {
    const passo = passoAtual(montagem);
    if (passo.tipo === 'soldar' && (ev.key === ' ' || ev.key === 'Enter') && !segurando) {
      ev.preventDefault();
      iniciarSolda(passo.peca);
    }
  });
  botaoAcao.addEventListener('keyup', () => cancelarSolda());
  botaoAcao.addEventListener('click', () => {
    const passo = passoAtual(montagem);
    if (passo.tipo === 'colocar') aplicar(colocar(montagem, passo.peca.parte, performance.now()));
  });

  function darDica(): void {
    const passo = passoAtual(montagem);
    if (passo.tipo === 'fim') return;
    montagem = { ...montagem, dicas: montagem.dicas + 1 };
    const alvo = passo.peca;
    realce.acender([alvo.parte], '#4cc9f0', 0.7);
    avisar(passo.tipo === 'pegar' ? ui('dicaPegar', { nome: nome(alvo.parte) }) : passo.tipo === 'colocar' ? ui('dicaColocar') : ui('dicaSoldar'), 'ok');
    if (passo.tipo === 'colocar') {
      marcador.visible = true;
      marcador.scale.set(alvo.caixa.l + 2, alvo.caixa.a + 2, 1);
      marcador.position.set(alvo.caixa.x + alvo.caixa.l / 2, -(alvo.caixa.y + alvo.caixa.a / 2), 0.06);
    }
    palco?.pedir();
    window.setTimeout(() => {
      if (!palco) return;
      const p = passoAtual(montagem);
      if (p.tipo !== 'fim' && p.peca.parte === alvo.parte) desenhar();
    }, 1400);
  }

  let automatizando = false;
  function automatico(): void {
    if (automatizando) return;
    automatizando = true;
    cancelarSolda();
    const passoFinal = (): void => {
      const passo = passoAtual(montagem);
      if (passo.tipo === 'fim') {
        automatizando = false;
        return;
      }
      const antes = montagem;
      montagem = avancar(montagem, performance.now());
      if (antes.inicio === null && montagem.inicio !== null) relogioId = window.setInterval(atualizarRelogio, 500);
      if (passo.tipo === 'soldar') {
        ferroAlvo = cena.conteudo.localToWorld(centroLocal(passo.peca).setZ(passo.peca.altura + 1));
        window.setTimeout(() => {
          ferroAlvo = null;
          automatizando = false;
          terminouAgora(antes);
          desenhar();
        }, 520);
        desenhar();
        return;
      }
      avisar(null);
      desenhar();
      window.setTimeout(passoFinal, passo.tipo === 'pegar' ? 420 : 380);
    };
    passoFinal();
  }

  function reiniciar(desafio: boolean): void {
    cancelarSolda();
    window.clearInterval(relogioId);
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

  palco.el.append(h('button', { class: 'montagem-sair', type: 'button', onclick: sair }, icone('ferro', 'icone mini'), ui('sairMontagem')));
  desenhar();

  const el = h('div', { class: 'pagina-montagem', 'data-placa': placa.id }, palco.el, painel);
  return {
    el,
    destruir: () => {
      document.removeEventListener('keydown', teclas);
      cancelarSolda();
      window.clearInterval(relogioId);
      realce.apagar();
      palco.destruir();
      cena.descartar();
    },
  };
};
