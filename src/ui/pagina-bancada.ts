import * as THREE from 'three';
import type { Contexto, Pagina } from '../app/contexto';
import {
  capacidades,
  corAutomatica,
  descricaoPino,
  estadoModulo,
  existeFio,
  lerBancada,
  LIMITE_X,
  LIMITE_Y,
  mesmaPonta,
  posicaoLivre,
  programaDe,
  verificarMissao,
  type Bancada,
  type Capacidade,
  type Catalogo3d,
  type Entradas,
  type FioBancada,
  type ItemBancada,
  type Memoria,
  type Ponta,
  type Saidas,
} from '../app/circuito';
import { nomeBase, pinosDaPlaca, pinosDoModulo } from '../app/pinagem';
import { missaoPorId, MISSOES, moduloPorTipo, MODULOS, placaBancada, PLACAS_BANCADA, type GrupoModulo, type Missao, type TipoModulo } from '../dados/bancada3d';
import { placaPorId } from '../dados/placas';
import { idiomaAtual, tr, ui, type ChaveTexto } from '../i18n/textos';
import { copiarTexto, estilo, h, trocar, zoomDaPagina } from './dom';
import { icone, type NomeIcone } from './icones';
import { construirCena, type Cena } from './kicad/cena';
import { miniatura } from './kicad/miniaturas';
import { alternarLofi, lofiTocando, aoMudarLofi } from './lofi';
import { COR_FIO, fio3d, tapete, type Fio3d } from './cena3d/objetos';
import { construirModulo, type Modulo3d } from './cena3d/modulos';
import { miniaturaModulo } from './cena3d/miniatura-modulo';
import { amortecer, easeOut, montarPalco } from './cena3d/palco';

const CHAVE = 'rumo:bancada3d';
const MAX_SERIAL = 300;

const ICONE_MODULO: Record<TipoModulo, NomeIcone> = {
  led: 'led',
  rgb: 'led',
  buzzer: 'som',
  oled: 'tela',
  botao: 'botao',
  pot: 'chave',
  hcsr04: 'regua',
  dht11: 'termometro',
  ldr: 'onda',
  servo: 'servo',
  motor: 'motor',
};

const GRUPOS: readonly (readonly [GrupoModulo, ChaveTexto])[] = [
  ['saida', 'grupoSaidas'],
  ['entrada', 'grupoEntradas'],
  ['sensor', 'grupoSensores'],
  ['atuador', 'grupoAtuadores'],
];

const catalogo: Catalogo3d = {
  placa: (id) => placaBancada(id),
  modulo: (tipo) => moduloPorTipo(tipo),
  pinos: (item) => {
    if (item.tipo === 'placa') {
      const pb = placaBancada(item.ref);
      return pb ? pinosDaPlaca(pb).map((p) => p.chave) : [];
    }
    const m = moduloPorTipo(item.ref);
    return m ? pinosDoModulo(m) : [];
  },
};

const ler = (): { bancada: Bancada; som: boolean } => {
  try {
    const bruto: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? 'null');
    const som = !!bruto && typeof bruto === 'object' && (bruto as Record<string, unknown>).som === false ? false : true;
    return { bancada: lerBancada(bruto, catalogo), som };
  } catch {
    return { bancada: { itens: [], fios: [] }, som: true };
  }
};

let contador = 0;
const novoId = (prefixo: string): string => `${prefixo}${Date.now().toString(36)}${(contador++).toString(36)}`.slice(0, 24);

interface Item3d {
  readonly grupo: THREE.Group;
  readonly alvo: { x: number; y: number; rot: number };
  entrada: number;
  elevar: number;
  readonly pinos: ReadonlyMap<string, THREE.Vector3>;
  readonly alvos: readonly THREE.Mesh[];
  readonly modulo?: Modulo3d;
  readonly cena?: Cena;
  readonly led?: { material: THREE.MeshStandardMaterial; luz: THREE.PointLight };
}

const nomeItem = (item: ItemBancada): string => (item.tipo === 'placa' ? (placaPorId(item.ref)?.nome ?? item.ref) : tr(moduloPorTipo(item.ref)?.nome ?? { pt: item.ref, en: item.ref }));

export const montarPaginaBancada = (ctx: Contexto, idMissao: string | null): Pagina => {
  const salvo = ler();
  let bancada: Bancada = salvo.bancada;
  let som = salvo.som;
  let missao: Missao | undefined = missaoPorId(idMissao);
  let rodando = false;
  let pendente: Ponta | null = null;
  let selecionado: { tipo: 'item' | 'fio'; id: string } | null = null;
  let foco = 0;
  let aba: 'passos' | 'codigo' | 'serial' = 'passos';
  const serial: string[] = [];
  let inicioRodar = 0;
  let relogio = 0;
  let tique = 0;
  let memoria: Memoria = {};
  let ultimaSaida: Saidas | null = null;
  const entradas: Entradas = { botao: false, pot: 512, luz: 700, distancia: 23, temperatura: 24, umidade: 55 };
  let audio: { ctx: AudioContext; osc: OscillatorNode; ganho: GainNode } | null = null;
  let carregado = false;

  const gravar = (): void => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ itens: bancada.itens, fios: bancada.fios, som }));
    } catch {
      return;
    }
  };

  const aviso = h('div', { class: 'bancada3d-aviso', role: 'status', 'aria-live': 'polite', hidden: true });
  const dica = h('div', { class: 'vitrine-dica', hidden: true });
  const bandeiras = h('div', { class: 'bancada3d-bandeiras', 'aria-hidden': 'true' });
  let avisoId = 0;
  const avisar = (texto: string, ms = 4200): void => {
    aviso.hidden = false;
    aviso.textContent = texto;
    window.clearTimeout(avisoId);
    if (ms > 0) avisoId = window.setTimeout(() => (aviso.hidden = true), ms);
  };

  const palco = montarPalco({
    classe: 'bancada3d-palco',
    rotulo: ui('bancadaVirtual'),
    pose: { inclinacao: 50, giro: -14, distancia: 360 },
    distancias: [120, 1500],
    extensao: 360,
    rodaLivre: true,
    apontador: {
      pegar: (ev) => pegar(ev),
      arrastar: (ev) => arrastar(ev),
      soltar: (ev, clique) => soltar(ev, clique),
      clicar: (ev) => clicar(ev),
      pairar: (ev) => pairar(ev),
    },
  });

  const corpoPainel = h('div', { class: 'bancada3d-painel-corpo' });
  const abas = (['passos', 'codigo', 'serial'] as const).map((valor) =>
    h('button', { class: 'bancada3d-aba', type: 'button', role: 'tab', 'data-aba': valor, onclick: () => { aba = valor; desenharPainel(); } }, ui(valor === 'passos' ? 'abaPassos' : valor === 'codigo' ? 'abaCodigo' : 'abaSerial')),
  );
  const painel = h('aside', { class: 'bancada3d-painel' }, h('div', { class: 'bancada3d-abas', role: 'tablist' }, ...abas), corpoPainel);

  const seletor = h('select', { class: 'campo bancada3d-missoes', 'aria-label': ui('missoes') });
  const tituloMissao = h('div', { class: 'bancada3d-missao' });
  const botaoRodar = h('button', { class: 'botao destaque bancada3d-rodar', type: 'button', onclick: () => (rodando ? parar() : rodar()) });
  const botaoLigar = h('button', { class: 'botao', type: 'button', onclick: () => ligarParaMim() }, ui('ligarParaMim'));
  const botaoRemover = h('button', { class: 'botao', type: 'button', onclick: () => removerFios() }, ui('removerFios'));
  let deCima = false;
  const botaoVista = h('button', { class: 'botao', type: 'button', 'aria-pressed': 'false', onclick: () => alternarVista() }, ui('vistaDeCima'));
  const botaoSom = h('button', { class: 'botao', type: 'button', 'aria-pressed': String(som), onclick: () => { som = !som; gravar(); if (!som) silenciar(); desenharBarra(); } });
  const botaoLofi = h('button', { class: 'botao', type: 'button', onclick: () => alternarLofi() }, ui('lofi'));
  const botaoTela = h('button', { class: 'botao', type: 'button', onclick: () => alternarTelaCheia() }, icone('centralizar', 'icone mini'), ui('telaCheia'));
  const barra = h('div', { class: 'bancada3d-barra' }, seletor, tituloMissao, h('div', { class: 'bancada3d-acoes' }, botaoRodar, botaoLigar, botaoRemover, botaoVista, botaoSom, botaoLofi, botaoTela));

  const montarPecas = (): HTMLElement => {
    const adicionarBotao = (tipo: 'placa' | 'modulo', ref: string, visual: Node, nome: string, extra: string): HTMLButtonElement =>
      h('button', { class: 'bancada3d-peca', type: 'button', 'data-ref': ref, title: ui('adicionarNaBancada'), onclick: () => adicionar(tipo, ref) }, h('span', { class: 'bancada3d-peca-visual' }, visual), h('span', { class: 'bancada3d-peca-texto' }, h('strong', {}, nome), h('small', {}, extra)));
    const blocos: Node[] = [
      h('h3', { class: 'rotulo' }, ui('placas')),
      ...PLACAS_BANCADA.map((pb) => {
        const placa = placaPorId(pb.id);
        return placa ? adicionarBotao('placa', pb.id, miniatura(placa), placa.nome, ui('logica', { v: pb.logica })) : null;
      }).filter((x): x is HTMLButtonElement => x !== null),
    ];
    for (const [grupo, chave] of GRUPOS) {
      blocos.push(h('h3', { class: 'rotulo' }, ui(chave)));
      for (const m of MODULOS.filter((x) => x.grupo === grupo)) blocos.push(adicionarBotao('modulo', m.tipo, miniaturaModulo(m, icone(ICONE_MODULO[m.tipo])), tr(m.nome), tr(m.resumo)));
    }
    return h('aside', { class: 'bancada3d-pecas', 'aria-label': ui('pecasDisponiveis') }, ...blocos);
  };

  if (!palco) {
    const el = h('div', { class: 'pagina-bancada sem-3d' }, h('p', { class: 'aviso-sem-labs' }, ui('semWebgl3d')));
    return { el, destruir: () => undefined };
  }

  palco.cena.add(tapete({ largura: LIMITE_X * 2 + 40, altura: LIMITE_Y * 2 + 40, cor: '#5a6b7c', linha: '#6d7e8f', forte: '#8597a8', reguas: true }, palco.renderer));
  const itens3d = new Map<string, Item3d>();
  const fios3d = new Map<string, Fio3d>();
  const raiz = new THREE.Group();
  palco.cena.add(raiz);
  const anel = (cor: string): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.32, 10, 36), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.95, depthTest: false }));
    m.renderOrder = 9;
    m.visible = false;
    return m;
  };
  const marcaPendente = anel('#ff6a3d');
  const marcaPairar = anel('#ffffff');
  const previa = fio3d('#f2c230');
  previa.material.transparent = true;
  previa.material.opacity = 0.8;
  previa.grupo.visible = false;
  let previaDestino: THREE.Vector3 | null = null;
  palco.cena.add(marcaPendente, marcaPairar, previa.grupo);

  const capsDe = (ponta: Ponta): ReadonlySet<Capacidade> => {
    const item = bancada.itens.find((i) => i.id === ponta.item);
    if (!item) return new Set();
    if (item.tipo === 'placa') {
      const pb = placaBancada(item.ref);
      return pb ? capacidades(pb.familia, nomeBase(ponta.pino)) : new Set();
    }
    const req = moduloPorTipo(item.ref)?.pinos.find((p) => p.nome === ponta.pino)?.precisa;
    return new Set<Capacidade>(req === 'gnd' ? ['gnd'] : req === 'vcc' ? ['v5'] : ['digital']);
  };

  const mundoDoPino = (ponta: Ponta): THREE.Vector3 | null => {
    const i3 = itens3d.get(ponta.item);
    const local = i3?.pinos.get(ponta.pino);
    if (!i3 || !local) return null;
    i3.grupo.updateMatrixWorld(true);
    return i3.grupo.localToWorld(local.clone());
  };

  const posicionar = (item: ItemBancada, imediato = false): void => {
    const i3 = itens3d.get(item.id);
    if (!i3) return;
    const rot = (item.rot * Math.PI) / 2;
    let alvoRot = rot;
    const atualRot = i3.grupo.rotation.z;
    while (alvoRot - atualRot > Math.PI) alvoRot -= Math.PI * 2;
    while (alvoRot - atualRot < -Math.PI) alvoRot += Math.PI * 2;
    i3.alvo.x = item.x;
    i3.alvo.y = item.y;
    i3.alvo.rot = alvoRot;
    if (imediato) {
      i3.grupo.position.set(item.x, item.y, 0);
      i3.grupo.rotation.z = alvoRot;
    }
    palco.pedir();
  };

  const construirItem = (item: ItemBancada): void => {
    const grupo = new THREE.Group();
    grupo.userData.item = item.id;
    const pinos = new Map<string, THREE.Vector3>();
    let modulo: Modulo3d | undefined;
    let cena: Cena | undefined;
    let led: Item3d['led'];
    if (item.tipo === 'placa') {
      const placa = placaPorId(item.ref);
      const pb = placaBancada(item.ref);
      if (!placa || !pb) return;
      cena = construirCena(placa, palco.renderer, 2048, true);
      const g = cena.grupo;
      cena.cena.remove(g);
      const { largura, altura, espessura } = cena.projeto;
      g.position.z = espessura + 0.2;
      grupo.add(g);
      for (const p of pinosDaPlaca(pb)) pinos.set(p.chave, new THREE.Vector3(p.x - largura / 2, altura / 2 - p.y, p.z + espessura + 0.2));
      const fpLed = cena.projeto.footprints.find((f) => f.modelo === 'led-smd' && (f.parte === 'leds' || f.parte === 'led'));
      if (fpLed) {
        const material = new THREE.MeshStandardMaterial({ color: '#ffcf3a', emissive: new THREE.Color('#ffb000'), emissiveIntensity: 0, transparent: true, opacity: 0.9 });
        const brilho = new THREE.Mesh(new THREE.BoxGeometry(fpLed.corpo.l + 0.3, fpLed.corpo.a + 0.3, 1.1), material);
        brilho.position.set(fpLed.corpo.x + fpLed.corpo.l / 2 - largura / 2, altura / 2 - fpLed.corpo.y - fpLed.corpo.a / 2, espessura + 0.8);
        const luz = new THREE.PointLight('#ffb000', 0, 30, 2);
        luz.position.copy(brilho.position).setZ(espessura + 6);
        grupo.add(brilho, luz);
        led = { material, luz };
      }
    } else {
      const m = moduloPorTipo(item.ref);
      if (!m) return;
      modulo = construirModulo(m, palco.renderer);
      grupo.add(modulo.grupo);
      for (const [nome, v] of modulo.pinos) pinos.set(nome, v.clone());
    }
    const alvos: THREE.Mesh[] = [];
    const materialAlvo = new THREE.MeshBasicMaterial({ visible: false });
    for (const [chave, v] of pinos) {
      const alvo = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 6), materialAlvo);
      alvo.position.copy(v).setZ(v.z - 2);
      alvo.userData.pino = chave;
      alvo.userData.item = item.id;
      grupo.add(alvo);
      alvos.push(alvo);
    }
    raiz.add(grupo);
    itens3d.set(item.id, { grupo, alvo: { x: item.x, y: item.y, rot: 0 }, entrada: carregado ? performance.now() : 0, elevar: 0, pinos, alvos, ...(modulo ? { modulo } : {}), ...(cena ? { cena } : {}), ...(led ? { led } : {}) });
    posicionar(item, true);
  };

  const removerItem3d = (id: string): void => {
    const i3 = itens3d.get(id);
    if (!i3) return;
    raiz.remove(i3.grupo);
    i3.grupo.traverse((o) => {
      if (o instanceof THREE.Mesh && !i3.cena) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
      }
    });
    i3.cena?.descartar();
    itens3d.delete(id);
  };

  const nascimento = new Map<string, number>();
  const desenharFios = (so?: ReadonlySet<string>): void => {
    for (const [id, f] of fios3d) {
      if (!bancada.fios.some((x) => x.id === id)) {
        raiz.remove(f.grupo);
        f.descartar();
        fios3d.delete(id);
      }
    }
    for (const fio of bancada.fios) {
      if (so && !so.has(fio.a.item) && !so.has(fio.b.item) && fios3d.has(fio.id)) continue;
      const a = mundoDoPino(fio.a);
      const b = mundoDoPino(fio.b);
      if (!a || !b) continue;
      let f = fios3d.get(fio.id);
      if (!f) {
        f = fio3d(COR_FIO[fio.cor] ?? '#f2c230');
        f.grupo.userData.fio = fio.id;
        fios3d.set(fio.id, f);
        raiz.add(f.grupo);
        if (carregado) nascimento.set(fio.id, performance.now());
      }
      f.atualizar(a, b);
      const t0 = nascimento.get(fio.id);
      if (t0 !== undefined) f.crescer(easeOut(Math.min(1, (performance.now() - t0) / 420)));
      f.material.emissive = new THREE.Color(selecionado?.tipo === 'fio' && selecionado.id === fio.id ? '#ffb703' : '#000000');
      f.material.emissiveIntensity = 0.6;
    }
    palco.pedir();
  };

  const sincronizar = (): void => {
    for (const id of [...itens3d.keys()]) if (!bancada.itens.some((i) => i.id === id)) removerItem3d(id);
    for (const item of bancada.itens) {
      if (!itens3d.has(item.id)) construirItem(item);
      else posicionar(item);
    }
    desenharFios();
    desenharBandeiras();
  };

  const alterar = (nova: Bancada): void => {
    bancada = nova;
    gravar();
    sincronizar();
    desenharPainel();
  };

  const adicionar = (tipo: 'placa' | 'modulo', ref: string, pos?: { x: number; y: number }): ItemBancada => {
    const lugar = pos ?? posicaoLivre(bancada.itens, tipo === 'placa' ? 70 : 40);
    const item: ItemBancada = { id: novoId(tipo === 'placa' ? 'p' : 'm'), tipo, ref, x: lugar.x, y: lugar.y, rot: 0 };
    alterar({ ...bancada, itens: [...bancada.itens, item].slice(-24) });
    selecionado = { tipo: 'item', id: item.id };
    return item;
  };

  const removerSelecionado = (): void => {
    if (!selecionado) return;
    if (selecionado.tipo === 'fio') {
      const id = selecionado.id;
      selecionado = null;
      alterar({ ...bancada, fios: bancada.fios.filter((f) => f.id !== id) });
      return;
    }
    const id = selecionado.id;
    selecionado = null;
    alterar({ itens: bancada.itens.filter((i) => i.id !== id), fios: bancada.fios.filter((f) => f.a.item !== id && f.b.item !== id) });
  };

  const girarSelecionado = (): void => {
    if (selecionado?.tipo !== 'item') return;
    const id = selecionado.id;
    alterar({ ...bancada, itens: bancada.itens.map((i) => (i.id === id ? { ...i, rot: (i.rot + 1) % 4 } : i)) });
  };

  const removerFios = (): void => {
    if (!bancada.fios.length) return;
    alterar({ ...bancada, fios: [] });
    avisar(ui('fiosRemovidos'));
  };

  const ligar = (a: Ponta, b: Ponta, base = bancada): Bancada => {
    const cor = corAutomatica(capsDe(a), capsDe(b), base.fios.length);
    return { ...base, fios: [...base.fios, { id: novoId('f'), a, b, cor }].slice(-80) };
  };

  const garantirItens = (m: Missao): Bancada => {
    let nova = bancada;
    const arduino = nova.itens.find((i) => i.tipo === 'placa' && placaBancada(i.ref)?.familia === 'arduino');
    if (!arduino) {
      const pos = { x: 0, y: 55 };
      nova = { ...nova, itens: [...nova.itens, { id: novoId('p'), tipo: 'placa', ref: m.placa, x: pos.x, y: pos.y, rot: 0 }] };
    }
    const tipos = [...new Set(m.ligacoes.map((l) => l.modulo))];
    tipos.forEach((tipo, k) => {
      if (nova.itens.some((i) => i.tipo === 'modulo' && i.ref === tipo)) return;
      const x = (k - (tipos.length - 1) / 2) * 70;
      nova = { ...nova, itens: [...nova.itens, { id: novoId('m'), tipo: 'modulo', ref: tipo, x, y: -60, rot: 0 }] };
    });
    return nova;
  };

  const ligarParaMim = (): void => {
    if (!missao) {
      avisar(ui('escolhaMissao'));
      return;
    }
    let nova = garantirItens(missao);
    const placa = nova.itens.find((i) => i.tipo === 'placa' && placaBancada(i.ref)?.familia === 'arduino');
    if (!placa) return;
    const pb = placaBancada(placa.ref);
    if (!pb) return;
    const chaves = pinosDaPlaca(pb);
    const v = verificarMissao(missao, nova, catalogo);
    missao.ligacoes.forEach((lig, k) => {
      if (v.feitas[k]) return;
      const modulo = nova.itens.find((i) => i.tipo === 'modulo' && i.ref === lig.modulo);
      if (!modulo) return;
      const usos = (chave: string): number => nova.fios.filter((f) => (f.a.item === placa.id && f.a.pino === chave) || (f.b.item === placa.id && f.b.pino === chave)).length;
      const candidatos = chaves.filter((p) => (lig.alvo === 'GND' ? capacidades(pb.familia, p.nome).has('gnd') : lig.alvo === '5V' ? capacidades(pb.familia, p.nome).has('v5') : p.nome === lig.alvo)).sort((a, b) => usos(a.chave) - usos(b.chave) || a.y - b.y);
      const alvo = candidatos[0];
      if (!alvo) return;
      nova = ligar({ item: modulo.id, pino: lig.pino }, { item: placa.id, pino: alvo.chave }, nova);
    });
    alterar(nova);
    avisar(ui('ligadoParaVoce'));
  };

  const alternarVista = (): void => {
    deCima = !deCima;
    botaoVista.setAttribute('aria-pressed', String(deCima));
    palco.irPara(deCima ? { inclinacao: 2, giro: 0 } : { inclinacao: 50, giro: -14 });
  };

  const container = h('div', { class: 'bancada3d' });
  const alternarTelaCheia = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void container.requestFullscreen?.().catch(() => avisar(ui('semTelaCheia')));
  };

  const silenciar = (): void => {
    if (audio) audio.ganho.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.01);
  };

  const tocar = (f: number): void => {
    if (!som) return;
    if (!audio) {
      try {
        const ctxAudio = new AudioContext();
        const osc = ctxAudio.createOscillator();
        const ganho = ctxAudio.createGain();
        osc.type = 'square';
        ganho.gain.value = 0;
        osc.connect(ganho).connect(ctxAudio.destination);
        osc.start();
        audio = { ctx: ctxAudio, osc, ganho };
      } catch {
        return;
      }
    }
    const agora = audio.ctx.currentTime;
    if (f > 0) {
      audio.osc.frequency.setValueAtTime(f, agora);
      audio.ganho.gain.setTargetAtTime(0.035, agora, 0.005);
    } else audio.ganho.gain.setTargetAtTime(0, agora, 0.01);
  };

  const presentes = (): Set<TipoModulo> => new Set(bancada.itens.filter((i) => i.tipo === 'modulo').map((i) => i.ref as TipoModulo));

  const aplicarSaidas = (s: Saidas | null): void => {
    ultimaSaida = s;
    const tiposMissao = missao ? new Set(missao.ligacoes.map((l) => l.modulo)) : null;
    for (const item of bancada.itens) {
      const i3 = itens3d.get(item.id);
      if (!i3) continue;
      if (item.tipo === 'placa') {
        if (i3.led) {
          const on = !!s?.placaLed && placaBancada(item.ref)?.familia === 'arduino';
          i3.led.material.emissiveIntensity = on ? 3 : 0;
          i3.led.luz.intensity = on ? 60 : 0;
        }
        continue;
      }
      const ativo = !!s && (tiposMissao ? tiposMissao.has(item.ref as TipoModulo) : estadoModulo(bancada, item, catalogo).ligado);
      i3.modulo?.aplicar(ativo ? s : null, entradas);
    }
    palco.pedir();
  };

  const registrar = (linha: string): void => {
    const ms = performance.now() - inicioRodar;
    const s = Math.floor(ms / 1000);
    serial.push(`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(Math.floor(ms % 1000)).padStart(3, '0')}  ${linha}`);
    if (serial.length > MAX_SERIAL) serial.splice(0, serial.length - MAX_SERIAL);
    if (aba === 'serial') desenharSerial();
  };

  const passo = (): void => {
    if (missao && !verificarMissao(missao, bancada, catalogo).ok) {
      parar();
      avisar(ui('circuitoMudou'));
      return;
    }
    const programa = programaDe(missao?.id ?? null);
    const t = programa.passo(tique++, entradas, presentes(), memoria);
    aplicarSaidas(t.saidas);
    if (t.serial) registrar(t.serial);
    const buzzerLigado = bancada.itens.some((i) => i.ref === 'buzzer' && (missao ? true : estadoModulo(bancada, i, catalogo).ligado));
    tocar(buzzerLigado ? (t.saidas.buzzer ?? 0) : 0);
  };

  function rodar(): void {
    if (missao) {
      const v = verificarMissao(missao, bancada, catalogo);
      if (!v.ok) {
        aba = 'passos';
        desenharPainel();
        avisar(v.faltam === 1 ? ui('faltaUmaLigacao') : ui('faltamLigacoes', { n: v.faltam }));
        return;
      }
    } else if (!bancada.itens.some((i) => i.tipo === 'modulo' && estadoModulo(bancada, i, catalogo).ligado)) {
      avisar(ui('livreSemModulo'));
      return;
    }
    rodando = true;
    tique = 0;
    memoria = {};
    inicioRodar = performance.now();
    serial.length = 0;
    const programa = programaDe(missao?.id ?? null);
    passo();
    relogio = window.setInterval(passo, programa.periodo);
    avisar(missao ? tr(missao.dicaRodar) : ui('livreRodando'), 6000);
    desenharBarra();
    desenharPainel();
  }

  function parar(): void {
    rodando = false;
    window.clearInterval(relogio);
    silenciar();
    aplicarSaidas(null);
    desenharBarra();
    desenharPainel();
  }

  const previaAtual = new THREE.Vector3();
  const selecaoFlutua = h('div', { class: 'bancada3d-selecao-flutua', hidden: true });
  palco.animar((dt, agora) => {
    let mais = false;
    const movidos = new Set<string>();
    for (const [id, i3] of itens3d) {
      const k = amortecer(dt, arrasto?.id === id ? 40 : 70);
      const elevarAlvo = arrasto?.id === id && arrasto.moveu ? 7 : 0;
      i3.elevar += (elevarAlvo - i3.elevar) * amortecer(dt, 70);
      const dx = i3.alvo.x - i3.grupo.position.x;
      const dy = i3.alvo.y - i3.grupo.position.y;
      const dr = i3.alvo.rot - i3.grupo.rotation.z;
      let z = i3.elevar;
      let escala = 1;
      if (i3.entrada) {
        const t = Math.min(1, (agora - i3.entrada) / 620);
        const e = easeOut(t);
        z += (1 - e) * 70;
        escala = 0.9 + 0.1 * e + Math.sin(t * Math.PI) * 0.03;
        if (t >= 1) i3.entrada = 0;
        mais = true;
      }
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || Math.abs(dr) > 0.001 || Math.abs(i3.grupo.position.z - z) > 0.01 || i3.grupo.scale.x !== escala) {
        i3.grupo.position.x += dx * k;
        i3.grupo.position.y += dy * k;
        i3.grupo.rotation.z += dr * amortecer(dt, 90);
        i3.grupo.position.z = z;
        i3.grupo.scale.setScalar(escala);
        movidos.add(id);
        mais = true;
      }
    }
    if (movidos.size) {
      desenharFios(movidos);
      if (pendente && movidos.has(pendente.item)) {
        const w = mundoDoPino(pendente);
        if (w) marcaPendente.position.copy(w).setZ(w.z + 1);
      }
    }
    for (const [id, t0] of nascimento) {
      const f = fios3d.get(id);
      const t = Math.min(1, (agora - t0) / 420);
      f?.crescer(easeOut(t));
      if (t >= 1) nascimento.delete(id);
      mais = true;
    }
    if (marcaPendente.visible) {
      marcaPendente.scale.setScalar(1 + Math.sin(agora / 160) * 0.18);
      mais = true;
    }
    if (pendente && previa.grupo.visible && previaDestino) {
      const a = mundoDoPino(pendente);
      if (a) {
        if (previaAtual.lengthSq() === 0) previaAtual.copy(a);
        previaAtual.lerp(previaDestino, amortecer(dt, 45));
        previa.atualizar(a, previaAtual);
        mais = true;
      }
    } else previaAtual.set(0, 0, 0);
    if (rodando && palco.ocioso(1800)) {
      palco.pose.giro += dt * 0.006;
      mais = true;
    }
    if (rodando && ultimaSaida) {
      for (const item of bancada.itens) {
        const i3 = itens3d.get(item.id);
        if (item.tipo === 'modulo' && (item.ref === 'buzzer' || item.ref === 'motor')) i3?.modulo?.aplicar(ultimaSaida, entradas);
      }
      mais = true;
    }
    return mais;
  });

  palco.aoDesenhar(() => {
    const sel = selecionado?.tipo === 'item' ? selecionado.id : null;
    const i3 = sel ? itens3d.get(sel) : undefined;
    if (!sel || !i3 || arrasto?.moveu) {
      selecaoFlutua.hidden = true;
      return;
    }
    const caixa = new THREE.Box3().setFromObject(i3.grupo);
    const topo = new THREE.Vector3((caixa.min.x + caixa.max.x) / 2, caixa.max.y, caixa.max.z + 4);
    const p = palco.projetar(topo);
    const z = zoomDaPagina();
    selecaoFlutua.hidden = !p.frente;
    estilo(selecaoFlutua, { transform: `translate(${(p.x / z).toFixed(1)}px, ${(p.y / z).toFixed(1)}px) translate(-50%, -130%)` });
  });

  const raycastPino = (ev: PointerEvent): Ponta | null => {
    const alvos = [...itens3d.values()].flatMap((i) => i.alvos);
    const acerto = palco.raio(ev).intersectObjects(alvos, false)[0];
    if (!acerto) return null;
    const { item, pino } = acerto.object.userData as { item?: string; pino?: string };
    return item && pino ? { item, pino } : null;
  };

  const raycastItem = (ev: PointerEvent): { id: string; objeto: THREE.Object3D } | null => {
    const acertos = palco.raio(ev).intersectObjects([...itens3d.values()].map((i) => i.grupo), true);
    for (const a of acertos) {
      if (a.object.userData.pino) continue;
      let o: THREE.Object3D | null = a.object;
      while (o && o.userData.item === undefined) o = o.parent;
      if (o?.userData.item) return { id: String(o.userData.item), objeto: a.object };
    }
    return null;
  };

  const raycastFio = (ev: PointerEvent): string | null => {
    const acerto = palco.raio(ev).intersectObjects([...fios3d.values()].map((f) => f.grupo), true)[0];
    let o: THREE.Object3D | null = acerto?.object ?? null;
    while (o && o.userData.fio === undefined) o = o.parent;
    return o ? String(o.userData.fio) : null;
  };

  let arrasto: { id: string; dx: number; dy: number; moveu: boolean } | null = null;
  let segurandoBotao = false;

  function pegar(ev: PointerEvent): boolean {
    if (!palco) return false;
    if (raycastPino(ev)) return false;
    const alvo = raycastItem(ev);
    if (!alvo) return false;
    const item = bancada.itens.find((i) => i.id === alvo.id);
    if (!item) return false;
    if (rodando && item.ref === 'botao') {
      segurandoBotao = true;
      entradas.botao = true;
      passo();
      desenharControles();
      return true;
    }
    const ponto = palco.noPlano(ev, 0);
    if (!ponto) return false;
    arrasto = { id: item.id, dx: item.x - ponto.x, dy: item.y - ponto.y, moveu: false };
    return true;
  }

  function arrastar(ev: PointerEvent): void {
    if (!palco || !arrasto) return;
    const ponto = palco.noPlano(ev, 0);
    if (!ponto) return;
    const x = Math.max(-LIMITE_X, Math.min(LIMITE_X, ponto.x + arrasto.dx));
    const y = Math.max(-LIMITE_Y, Math.min(LIMITE_Y, ponto.y + arrasto.dy));
    const id = arrasto.id;
    arrasto.moveu = true;
    palco.tela.style.cursor = 'grabbing';
    bancada = { ...bancada, itens: bancada.itens.map((i) => (i.id === id ? { ...i, x, y } : i)) };
    const item = bancada.itens.find((i) => i.id === id);
    if (item) posicionar(item);
    desenharBandeiras();
  }

  function soltar(_ev: PointerEvent, clique: boolean): void {
    if (segurandoBotao) {
      segurandoBotao = false;
      entradas.botao = false;
      passo();
      desenharControles();
      return;
    }
    if (!arrasto) return;
    const id = arrasto.id;
    arrasto = null;
    if (clique) {
      selecionado = { tipo: 'item', id };
      desenharFios();
      desenharPainel();
      return;
    }
    gravar();
  }

  function clicar(ev: PointerEvent): void {
    if (!palco) return;
    const pino = raycastPino(ev);
    if (pino) {
      clicarPino(pino);
      return;
    }
    const fio = raycastFio(ev);
    selecionado = fio ? { tipo: 'fio', id: fio } : null;
    if (pendente) cancelarPendente();
    desenharFios();
    desenharPainel();
  }

  const nomePonta = (ponta: Ponta): string => {
    const item = bancada.itens.find((i) => i.id === ponta.item);
    return item ? `${nomeItem(item)} · ${nomeBase(ponta.pino)}` : nomeBase(ponta.pino);
  };

  const cancelarPendente = (): void => {
    pendente = null;
    marcaPendente.visible = false;
    previa.grupo.visible = false;
    previaDestino = null;
    aviso.hidden = true;
    palco.pedir();
  };

  const clicarPino = (ponta: Ponta): void => {
    if (!pendente) {
      pendente = ponta;
      const w = mundoDoPino(ponta);
      if (w) {
        marcaPendente.position.copy(w).setZ(w.z + 1);
        marcaPendente.visible = true;
      }
      avisar(ui('pinoSelecionado', { pino: nomePonta(ponta) }), 0);
      palco.pedir();
      return;
    }
    const a = pendente;
    cancelarPendente();
    if (mesmaPonta(a, ponta)) return;
    if (a.item === ponta.item) {
      avisar(ui('mesmoItem'));
      return;
    }
    if (existeFio(bancada, a, ponta)) {
      avisar(ui('fioJaExiste'));
      return;
    }
    alterar(ligar(a, ponta));
    avisar(ui('fioCriado', { a: nomePonta(a), b: nomePonta(ponta) }));
  };

  function pairar(ev: PointerEvent | null): void {
    if (!palco) return;
    const ponta = ev ? raycastPino(ev) : null;
    if (!ev || !ponta) {
      dica.hidden = true;
      marcaPairar.visible = false;
      palco.tela.style.cursor = ev && raycastItem(ev) ? 'grab' : '';
    } else {
      const item = bancada.itens.find((i) => i.id === ponta.item);
      const nome = nomeBase(ponta.pino);
      let descricao = '';
      if (item?.tipo === 'placa') {
        const pb = placaBancada(item.ref);
        descricao = pb ? descricaoPino(pb.familia, nome, idiomaAtual()) : '';
      } else {
        const req = moduloPorTipo(item?.ref ?? '')?.pinos.find((p) => p.nome === nome)?.precisa;
        descricao = req ? ui(`requisito_${req}` as ChaveTexto) : '';
      }
      trocar(dica, h('strong', {}, nome), h('span', {}, descricao), h('small', {}, item ? nomeItem(item) : ''));
      dica.hidden = false;
      const r = palco.el.getBoundingClientRect();
      const z = zoomDaPagina();
      estilo(dica, { transform: `translate(${((ev.clientX - r.left) / z + 14).toFixed(0)}px, ${((ev.clientY - r.top) / z + 12).toFixed(0)}px)` });
      const w = mundoDoPino(ponta);
      if (w) {
        marcaPairar.position.copy(w).setZ(w.z + 1);
        marcaPairar.visible = true;
      }
      palco.tela.style.cursor = 'crosshair';
    }
    if (pendente && ev) {
      const b = ponta ? mundoDoPino(ponta) : palco.noPlano(ev, 2);
      if (b) {
        if (!previaDestino) previaDestino = b.clone();
        previaDestino.copy(b);
        previa.grupo.visible = true;
      }
    }
    palco.pedir();
  }

  const desenharBandeiras = (): void => {
    if (!missao) {
      bandeiras.replaceChildren();
      return;
    }
    const v = verificarMissao(missao, bancada, catalogo);
    const indice = v.feitas[foco] === false ? foco : v.feitas.findIndex((f) => !f);
    const lig = missao.ligacoes[indice];
    if (!lig || rodando) {
      bandeiras.replaceChildren();
      return;
    }
    const modulo = bancada.itens.find((i) => i.tipo === 'modulo' && i.ref === lig.modulo);
    const placa = bancada.itens.find((i) => i.tipo === 'placa' && placaBancada(i.ref)?.familia === 'arduino');
    const pb = placa ? placaBancada(placa.ref) : undefined;
    const chave = pb ? pinosDaPlaca(pb).find((p) => (lig.alvo === 'GND' ? capacidades(pb.familia, p.nome).has('gnd') : lig.alvo === '5V' ? capacidades(pb.familia, p.nome).has('v5') : p.nome === lig.alvo))?.chave : undefined;
    const pontas: { ponta: Ponta; rotulo: string }[] = [];
    if (modulo) pontas.push({ ponta: { item: modulo.id, pino: lig.pino }, rotulo: lig.pino });
    if (placa && chave) pontas.push({ ponta: { item: placa.id, pino: chave }, rotulo: lig.alvo });
    trocar(bandeiras, ...pontas.map((p) => h('span', { class: 'bancada3d-bandeira', 'data-item': p.ponta.item, 'data-pino': p.ponta.pino }, p.rotulo)));
    palco.pedir();
  };

  palco.aoDesenhar(() => {
    const z = zoomDaPagina();
    for (const b of bandeiras.querySelectorAll<HTMLElement>('.bancada3d-bandeira')) {
      const w = mundoDoPino({ item: b.dataset.item ?? '', pino: b.dataset.pino ?? '' });
      if (!w) continue;
      const p = palco.projetar(w.setZ(w.z + 6));
      estilo(b, { transform: `translate(${(p.x / z).toFixed(1)}px, ${(p.y / z).toFixed(1)}px) translate(-50%, -100%)` });
    }
  });

  const desenharBarra = (): void => {
    trocar(botaoRodar, icone(rodando ? 'pausar' : 'tocar', 'icone mini'), rodando ? ui('parar') : ui('executar'));
    botaoRodar.classList.toggle('rodando', rodando);
    trocar(botaoSom, icone('som', 'icone mini'), som ? ui('somLigado') : ui('somDesligado'));
    botaoSom.setAttribute('aria-pressed', String(som));
    botaoLofi.setAttribute('aria-pressed', String(lofiTocando()));
    trocar(
      tituloMissao,
      h('strong', {}, missao ? tr(missao.titulo) : ui('construcaoLivre')),
      missao ? h('small', { class: 'mono' }, `${ui(missao.nivel === 'iniciante' ? 'nivelIniciante' : 'nivelIntermediario')} · ${ui('minutos', { n: missao.minutos })}`) : h('small', { class: 'mono' }, ui('livreCurto')),
    );
    for (const b of abas) b.setAttribute('aria-selected', String(b.dataset.aba === aba));
  };

  const controle = (rotulo: string, min: number, max: number, passoValor: number, valor: number, mudar: (v: number) => void, formato: (v: number) => string): HTMLElement => {
    const campo = h('input', { type: 'range', min, max, step: passoValor, value: valor, 'aria-label': rotulo });
    const saida = h('output', { class: 'mono' }, formato(valor));
    campo.addEventListener('input', () => {
      mudar(Number(campo.value));
      saida.textContent = formato(Number(campo.value));
      if (rodando) passo();
      i3Entradas();
    });
    return h('label', { class: 'bancada3d-controle' }, h('span', {}, rotulo), campo, saida);
  };

  const i3Entradas = (): void => {
    for (const item of bancada.itens) {
      if (item.tipo === 'modulo' && (item.ref === 'pot' || item.ref === 'botao')) itens3d.get(item.id)?.modulo?.aplicar(rodando ? ultimaSaida : null, entradas);
    }
    palco.pedir();
  };

  const controles = h('div', { class: 'bancada3d-controles' });
  const desenharControles = (): void => {
    const tipos = presentes();
    const lista: HTMLElement[] = [];
    if (tipos.has('botao')) {
      const b = h('button', { class: 'botao', type: 'button', 'aria-pressed': String(entradas.botao) }, ui('segureBotao'));
      const apertar = (v: boolean) => (): void => {
        entradas.botao = v;
        b.setAttribute('aria-pressed', String(v));
        if (rodando) passo();
        i3Entradas();
      };
      b.addEventListener('pointerdown', apertar(true));
      b.addEventListener('pointerup', apertar(false));
      b.addEventListener('pointerleave', apertar(false));
      b.addEventListener('keydown', (ev) => { if (ev.key === ' ' || ev.key === 'Enter') apertar(true)(); });
      b.addEventListener('keyup', apertar(false));
      lista.push(b);
    }
    if (tipos.has('pot')) lista.push(controle(ui('controlePot'), 0, 1023, 1, entradas.pot, (v) => (entradas.pot = v), (v) => String(v)));
    if (tipos.has('ldr')) lista.push(controle(ui('controleLuz'), 0, 1023, 1, entradas.luz, (v) => (entradas.luz = v), (v) => String(v)));
    if (tipos.has('hcsr04')) lista.push(controle(ui('controleDistancia'), 2, 400, 1, entradas.distancia, (v) => (entradas.distancia = v), (v) => `${v} cm`));
    if (tipos.has('dht11')) {
      lista.push(controle(ui('controleTemperatura'), 0, 50, 0.5, entradas.temperatura, (v) => (entradas.temperatura = v), (v) => `${v.toFixed(1)} °C`));
      lista.push(controle(ui('controleUmidade'), 20, 90, 1, entradas.umidade, (v) => (entradas.umidade = v), (v) => `${v} %`));
    }
    trocar(controles, ...(lista.length ? [h('h3', { class: 'rotulo' }, ui('controles')), ...lista] : []));
  };

  const desenharSerial = (): void => {
    if (aba !== 'serial') return;
    const log = corpoPainel.querySelector<HTMLElement>('.bancada3d-serial');
    if (!log) return;
    trocar(log, ...serial.map((l) => h('div', {}, l)));
    log.scrollTop = log.scrollHeight;
  };

  const linhaLigacao = (texto: string, feita: boolean, nota: string, k: number): HTMLElement =>
    h(
      'li',
      { class: `bancada3d-ligacao${feita ? ' feita' : ''}` },
      h('span', { class: 'bancada3d-ligacao-ponto', 'aria-hidden': 'true' }),
      h('div', {}, h('strong', {}, texto), h('p', {}, nota), feita ? null : h('button', { class: 'link', type: 'button', onclick: () => { foco = k; desenharBandeiras(); } }, ui('mostrarMe'))),
    );

  function desenharPainel(): void {
    desenharBarra();
    desenharControles();
    if (aba === 'codigo') {
      const codigo = missao?.codigo ?? ui('codigoLivre');
      const copiar = h('button', { class: 'botao pequeno', type: 'button', onclick: async () => { copiar.textContent = (await copiarTexto(codigo)) ? ui('copiado') : ui('copiar'); } }, ui('copiar'));
      trocar(corpoPainel, h('div', { class: 'codigo-topo' }, h('span', { class: 'mono' }, missao ? `${missao.id}.ino` : 'livre.ino'), copiar), h('pre', { class: 'bancada3d-codigo mono' }, h('code', {}, codigo)));
      return;
    }
    if (aba === 'serial') {
      trocar(
        corpoPainel,
        h('div', { class: 'codigo-topo' }, h('span', { class: 'mono' }, '9600 baud'), h('button', { class: 'botao pequeno', type: 'button', onclick: () => { serial.length = 0; desenharSerial(); } }, ui('limpar'))),
        h('div', { class: 'bancada3d-serial mono', role: 'log', 'aria-live': 'off' }),
        serial.length || rodando ? null : h('p', { class: 'vazio' }, ui('serialVazia')),
      );
      desenharSerial();
      return;
    }
    const sel = selecionado ? (selecionado.tipo === 'fio' ? bancada.fios.find((f) => f.id === selecionado?.id) : bancada.itens.find((i) => i.id === selecionado?.id)) : undefined;
    if (sel && !('a' in sel)) {
      trocar(
        selecaoFlutua,
        h('strong', {}, nomeItem(sel as ItemBancada)),
        h('button', { type: 'button', onclick: girarSelecionado }, icone('girar', 'icone mini'), ' ', ui('girar90')),
        h('button', { type: 'button', onclick: removerSelecionado }, icone('fechar', 'icone mini'), ' ', ui('remover')),
      );
    }
    palco?.pedir();
    const cartaoSel = sel
      ? h(
          'div',
          { class: 'bancada3d-selecao' },
          h('small', { class: 'rotulo' }, ui('selecionado')),
          h('strong', {}, 'a' in sel ? `${nomePonta((sel as FioBancada).a)} → ${nomePonta((sel as FioBancada).b)}` : nomeItem(sel as ItemBancada)),
          h(
            'div',
            { class: 'bancada3d-selecao-botoes' },
            'a' in sel ? null : h('button', { class: 'botao pequeno', type: 'button', onclick: girarSelecionado }, icone('girar', 'icone mini'), ui('girar90')),
            h('button', { class: 'botao pequeno', type: 'button', onclick: removerSelecionado }, icone('fechar', 'icone mini'), ui('remover')),
          ),
        )
      : null;
    if (missao) {
      const v = verificarMissao(missao, bancada, catalogo);
      const placa = placaPorId(missao.placa)?.nome ?? missao.placa;
      trocar(
        corpoPainel,
        h('h3', { class: 'bancada3d-painel-titulo' }, tr(missao.titulo)),
        h('p', {}, tr(missao.resumo)),
        h('p', { class: 'bancada3d-progresso mono' }, ui('ligacoesFeitas', { n: v.feitas.filter(Boolean).length, total: v.feitas.length })),
        h('ol', { class: 'bancada3d-ligacoes' }, ...missao.ligacoes.map((l, k) => linhaLigacao(`${placa} ${l.alvo} → ${tr(moduloPorTipo(l.modulo)?.nome ?? { pt: l.modulo, en: l.modulo })} ${l.pino}`, !!v.feitas[k], tr(l.nota), k))),
        controles,
        cartaoSel,
        h('h3', { class: 'rotulo' }, ui('oQueAprende')),
        h('ul', { class: 'bancada3d-aprende' }, ...missao.aprende.map((a) => h('li', {}, tr(a)))),
      );
    } else {
      const modulos = bancada.itens.filter((i) => i.tipo === 'modulo');
      trocar(
        corpoPainel,
        h('h3', { class: 'bancada3d-painel-titulo' }, ui('construcaoLivre')),
        h('p', {}, ui('livreResumo')),
        modulos.length
          ? h(
              'ul',
              { class: 'bancada3d-ligacoes' },
              ...modulos.map((m) => {
                const e = estadoModulo(bancada, m, catalogo);
                return h('li', { class: `bancada3d-ligacao${e.ligado ? ' feita' : ''}` }, h('span', { class: 'bancada3d-ligacao-ponto', 'aria-hidden': 'true' }), h('div', {}, h('strong', {}, nomeItem(m)), h('p', {}, e.ligado ? ui('moduloPronto') : ui('moduloFalta', { pinos: e.faltam.join(', ') }))));
              }),
            )
          : h('p', { class: 'vazio' }, ui('livreVazio')),
        controles,
        cartaoSel,
      );
    }
  }

  const preencherMissoes = (): void => {
    trocar(
      seletor,
      h('option', { value: '' }, ui('construcaoLivre')),
      ...MISSOES.map((m) => h('option', { value: m.id, selected: m.id === missao?.id }, `${tr(m.titulo)} · ${ui(m.nivel === 'iniciante' ? 'nivelIniciante' : 'nivelIntermediario')}`)),
    );
    seletor.value = missao?.id ?? '';
  };
  seletor.addEventListener('change', () => {
    ctx.navegar({ pagina: 'bancada', placa: null, lab: null, extra: seletor.value || null });
  });

  const teclas = (ev: KeyboardEvent): void => {
    if (ctx.loja.atual.busca || ctx.loja.atual.ajuda) return;
    const alvo = ev.target as HTMLElement | null;
    if (alvo?.closest('input, select, textarea')) return;
    if (ev.key === 'Escape') {
      if (pendente) cancelarPendente();
      else if (selecionado) {
        selecionado = null;
        desenharFios();
        desenharPainel();
      }
      return;
    }
    if (!container.contains(alvo) && alvo !== document.body) return;
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && selecionado) {
      ev.preventDefault();
      removerSelecionado();
    } else if (ev.key.toLowerCase() === 'r' && selecionado?.tipo === 'item' && !ev.ctrlKey && !ev.metaKey) {
      ev.preventDefault();
      ev.stopPropagation();
      girarSelecionado();
    }
  };
  document.addEventListener('keydown', teclas, true);
  const desligarLofi = aoMudarLofi(() => desenharBarra());

  if (missao) {
    const nova = garantirItens(missao);
    if (nova !== bancada) {
      bancada = nova;
      gravar();
    }
  } else if (!bancada.itens.length) {
    bancada = { itens: [{ id: novoId('p'), tipo: 'placa', ref: 'uno-r3', x: 0, y: 40, rot: 0 }], fios: [] };
  }
  sincronizar();
  carregado = true;
  preencherMissoes();
  desenharPainel();

  palco.el.append(aviso, dica, bandeiras, selecaoFlutua);
  container.append(barra, h('div', { class: 'bancada3d-corpo' }, montarPecas(), palco.el, painel));
  const el = h(
    'div',
    { class: 'pagina-bancada' },
    h(
      'header',
      { class: 'bancada3d-topo' },
      h('p', { class: 'heroi-kicker mono' }, ui('kickerBancada')),
      h('h1', { class: 'bancada3d-titulo' }, ui('tituloBancada')),
      h('p', {}, ui('resumoBancada')),
    ),
    container,
  );
  return {
    el,
    destruir: () => {
      document.removeEventListener('keydown', teclas, true);
      desligarLofi();
      window.clearInterval(relogio);
      window.clearTimeout(avisoId);
      if (audio) void audio.ctx.close();
      for (const f of fios3d.values()) f.descartar();
      for (const id of [...itens3d.keys()]) removerItem3d(id);
      palco.destruir();
    },
  };
};
