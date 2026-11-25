import * as THREE from 'three';
import { ambienteDe } from '../kicad/cena';
import { h, zoomDaPagina } from '../dom';
import { densidadeDoPalco, renderizacaoLeve } from './qualidade';

export interface Pose3d {
  inclinacao: number;
  giro: number;
  distancia: number;
  readonly alvo: THREE.Vector3;
}

export interface Apontador {
  readonly pegar?: (ev: PointerEvent) => boolean;
  readonly arrastar?: (ev: PointerEvent) => void;
  readonly soltar?: (ev: PointerEvent, clique: boolean) => void;
  readonly pairar?: (ev: PointerEvent | null) => void;
  readonly clicar?: (ev: PointerEvent) => void;
}

export interface OpcoesPalco {
  readonly classe: string;
  readonly rotulo: string;
  readonly pose: { readonly inclinacao: number; readonly giro: number; readonly distancia: number; readonly alvo?: readonly [number, number, number] };
  readonly distancias: readonly [number, number];
  readonly extensao: number;
  readonly apontador?: Apontador;
  readonly rodaLivre?: boolean;
  readonly fundo?: string;
  readonly inclinacaoMax?: number;
}

export interface Palco3d {
  readonly el: HTMLElement;
  readonly tela: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly cena: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly pose: Pose3d;
  readonly irPara: (alvo: Partial<Omit<Pose3d, 'alvo'>> & { alvo?: THREE.Vector3 }, ms?: number) => void;
  readonly pedir: () => void;
  readonly animar: (fn: (dt: number, agora: number) => boolean) => () => void;
  readonly raio: (ev: { clientX: number; clientY: number }) => THREE.Raycaster;
  readonly noPlano: (ev: { clientX: number; clientY: number }, z?: number) => THREE.Vector3 | null;
  readonly projetar: (v: THREE.Vector3) => { x: number; y: number; frente: boolean };
  readonly aoDesenhar: (fn: () => void) => void;
  readonly ocioso: (ms: number) => boolean;
  readonly destruir: () => void;
}

const limitar = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);
export const amortecer = (dt: number, tau: number): number => 1 - Math.exp(-dt / Math.max(1, tau));
export const movimentoReduzido = (): boolean => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const grau = THREE.MathUtils.degToRad;

let compartilhado: { renderer: THREE.WebGLRenderer; ocupado: boolean } | null = null;
let liberar: (() => void) | null = null;

export const registrarLiberacao = (fn: () => void): void => {
  liberar = fn;
};

const novoRenderer = (): THREE.WebGLRenderer | null => {
  try {
    const r = new THREE.WebGLRenderer({ antialias: !renderizacaoLeve(), alpha: true, powerPreference: 'high-performance' });
    r.shadowMap.enabled = !renderizacaoLeve();
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.domElement.addEventListener('webglcontextlost', () => {
      if (compartilhado?.renderer === r) compartilhado = null;
    });
    return r;
  } catch {
    return null;
  }
};

const reservarRenderer = (): { renderer: THREE.WebGLRenderer; proprio: boolean } | null => {
  if (compartilhado?.ocupado) liberar?.();
  if (compartilhado && !compartilhado.ocupado) {
    compartilhado.ocupado = true;
    return { renderer: compartilhado.renderer, proprio: false };
  }
  const r = novoRenderer();
  if (!r) return null;
  if (!compartilhado) {
    compartilhado = { renderer: r, ocupado: true };
    return { renderer: r, proprio: false };
  }
  return { renderer: r, proprio: true };
};

export const criarRenderer = novoRenderer;

export const montarPalco = (opcoes: OpcoesPalco): Palco3d | null => {
  const reserva = reservarRenderer();
  if (!reserva) return null;
  const { renderer } = reserva;
  renderer.setPixelRatio(densidadeDoPalco(Math.max(1, Math.min((window.devicePixelRatio || 1) * zoomDaPagina() * 1.5, 2))));
  const tela = renderer.domElement;
  tela.className = 'palco3d-tela';
  tela.removeAttribute('style');
  const el = h('div', { class: `palco3d ${opcoes.classe}`, role: 'application', 'aria-label': opcoes.rotulo, tabindex: 0 }, tela);
  const sinal = new AbortController();
  const ouvir = { signal: sinal.signal };

  const cena = new THREE.Scene();
  cena.environment = ambienteDe(renderer);
  cena.environmentIntensity = 0.5;
  if (opcoes.fundo) cena.background = new THREE.Color(opcoes.fundo);
  const ext = opcoes.extensao;
  cena.add(new THREE.HemisphereLight('#ffffff', '#4f5560', 0.45));
  const sol = new THREE.DirectionalLight('#fff4e6', 1.8);
  sol.position.set(-0.55 * ext, -0.4 * ext, 1.3 * ext);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  const sc = sol.shadow.camera;
  sc.left = -ext;
  sc.right = ext;
  sc.top = ext;
  sc.bottom = -ext;
  sc.near = 1;
  sc.far = ext * 4;
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.04;
  sol.shadow.radius = 4;
  cena.add(sol);
  const contra = new THREE.DirectionalLight('#e3ebff', 0.4);
  contra.position.set(ext, ext * 0.8, ext);
  cena.add(contra);

  const camera = new THREE.PerspectiveCamera(32, 1, 1, ext * 20);
  camera.up.set(0, 0, 1);
  const incMax = opcoes.inclinacaoMax ?? 86;
  const pose: Pose3d = {
    inclinacao: opcoes.pose.inclinacao,
    giro: opcoes.pose.giro,
    distancia: opcoes.pose.distancia,
    alvo: new THREE.Vector3(...(opcoes.pose.alvo ?? [0, 0, 0])),
  };
  const vista: Pose3d = { inclinacao: pose.inclinacao, giro: pose.giro, distancia: pose.distancia, alvo: pose.alvo.clone() };

  const posicionar = (): void => {
    const inc = grau(limitar(vista.inclinacao, 1.5, incMax));
    const gi = grau(vista.giro);
    camera.position.set(
      vista.alvo.x + vista.distancia * Math.sin(inc) * Math.sin(gi),
      vista.alvo.y - vista.distancia * Math.sin(inc) * Math.cos(gi),
      vista.alvo.z + vista.distancia * Math.cos(inc),
    );
    camera.near = Math.max(0.5, vista.distancia / 40);
    camera.far = vista.distancia * 8 + ext * 4;
    camera.lookAt(vista.alvo);
    camera.updateProjectionMatrix();
  };

  let agendado = 0;
  let ultimo = 0;
  let vivo = true;
  let interacao = 0;
  let tween: { de: Pose3d; para: Pose3d; t0: number; ms: number } | null = null;
  const inercia = { giro: 0, inclinacao: 0 };
  const animacoes = new Set<(dt: number, agora: number) => boolean>();
  const depois = new Set<() => void>();

  const seguir = (dt: number): boolean => {
    const k = amortecer(dt, arrastando ? 45 : 85);
    const dGiro = pose.giro - vista.giro;
    const dInc = pose.inclinacao - vista.inclinacao;
    const dDist = pose.distancia - vista.distancia;
    const dAlvo = vista.alvo.distanceTo(pose.alvo);
    vista.giro += dGiro * k;
    vista.inclinacao += dInc * k;
    vista.distancia += dDist * amortecer(dt, 110);
    vista.alvo.lerp(pose.alvo, k);
    const parado = Math.abs(dGiro) < 0.01 && Math.abs(dInc) < 0.01 && Math.abs(dDist) < 0.02 * Math.max(1, pose.distancia / 100) && dAlvo < 0.01;
    if (parado) {
      vista.giro = pose.giro;
      vista.inclinacao = pose.inclinacao;
      vista.distancia = pose.distancia;
      vista.alvo.copy(pose.alvo);
    }
    return !parado;
  };

  const quadro = (agora: number): void => {
    agendado = 0;
    if (!vivo) return;
    const dt = ultimo ? Math.min(50, agora - ultimo) : 16;
    ultimo = agora;
    let continuar = false;
    if (tween) {
      const t = Math.min(1, (agora - tween.t0) / tween.ms);
      const k = easeInOut(t);
      pose.inclinacao = tween.de.inclinacao + (tween.para.inclinacao - tween.de.inclinacao) * k;
      pose.giro = tween.de.giro + (tween.para.giro - tween.de.giro) * k;
      pose.distancia = tween.de.distancia + (tween.para.distancia - tween.de.distancia) * k;
      pose.alvo.lerpVectors(tween.de.alvo, tween.para.alvo, k);
      if (t >= 1) tween = null;
      else continuar = true;
    }
    if (!arrastando && (Math.abs(inercia.giro) > 0.0005 || Math.abs(inercia.inclinacao) > 0.0005)) {
      pose.giro += inercia.giro * dt;
      pose.inclinacao = limitar(pose.inclinacao + inercia.inclinacao * dt, 1.5, incMax);
      const f = Math.exp(-dt / 260);
      inercia.giro *= f;
      inercia.inclinacao *= f;
      continuar = true;
    }
    for (const fn of animacoes) if (fn(dt, agora)) continuar = true;
    if (seguir(dt)) continuar = true;
    posicionar();
    renderer.render(cena, camera);
    for (const fn of depois) fn();
    if (continuar) pedir();
    else ultimo = 0;
  };

  const pedir = (): void => {
    if (agendado || !vivo) return;
    agendado = requestAnimationFrame(quadro);
  };

  const irPara: Palco3d['irPara'] = (alvo, ms = 900) => {
    const giroDestino = alvo.giro ?? pose.giro;
    const para: Pose3d = {
      inclinacao: limitar(alvo.inclinacao ?? pose.inclinacao, 1.5, incMax),
      giro: pose.giro + ((((giroDestino - pose.giro) % 360) + 540) % 360) - 180,
      distancia: limitar(alvo.distancia ?? pose.distancia, opcoes.distancias[0], opcoes.distancias[1]),
      alvo: (alvo.alvo ?? pose.alvo).clone(),
    };
    inercia.giro = 0;
    inercia.inclinacao = 0;
    if (ms <= 0 || movimentoReduzido()) {
      pose.inclinacao = para.inclinacao;
      pose.giro = para.giro;
      pose.distancia = para.distancia;
      pose.alvo.copy(para.alvo);
      if (ms <= 0) {
        vista.inclinacao = para.inclinacao;
        vista.giro = para.giro;
        vista.distancia = para.distancia;
        vista.alvo.copy(para.alvo);
      }
      tween = null;
    } else {
      tween = { de: { ...pose, alvo: pose.alvo.clone() }, para, t0: performance.now(), ms };
    }
    pedir();
  };

  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let retangulo: DOMRect | null = null;
  const caixaTela = (): DOMRect => (retangulo ??= tela.getBoundingClientRect());
  const raio: Palco3d['raio'] = (ev) => {
    const r = caixaTela();
    ndc.set(((ev.clientX - r.left) / Math.max(1, r.width)) * 2 - 1, -((ev.clientY - r.top) / Math.max(1, r.height)) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster;
  };
  const plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const noPlano: Palco3d['noPlano'] = (ev, z = 0) => {
    plano.constant = -z;
    const ponto = new THREE.Vector3();
    return raio(ev).ray.intersectPlane(plano, ponto) ? ponto : null;
  };
  const projetado = new THREE.Vector3();
  const projetar: Palco3d['projetar'] = (v) => {
    const p = projetado.copy(v).project(camera);
    const r = caixaTela();
    return { x: ((p.x + 1) / 2) * r.width, y: ((1 - p.y) / 2) * r.height, frente: p.z < 1 };
  };
  const invalidarCaixa = (): void => {
    retangulo = null;
  };
  window.addEventListener('scroll', invalidarCaixa, { passive: true, capture: true, signal: sinal.signal });
  window.addEventListener('resize', invalidarCaixa, ouvir);

  let modo: 'nada' | 'item' | 'orbita' | 'arrasto' = 'nada';
  let arrastando = false;
  let inicio = { x: 0, y: 0 };
  let anterior = { x: 0, y: 0, t: 0 };
  let moveu = false;
  let pairando = 0;
  const ponteiros = new Map<number, { x: number; y: number }>();
  let pinca = 0;

  tela.addEventListener(
    'pointerdown',
    (ev) => {
      if (ev.button > 2) return;
      invalidarCaixa();
      interacao = performance.now();
      ponteiros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      tela.setPointerCapture(ev.pointerId);
      inercia.giro = 0;
      inercia.inclinacao = 0;
      if (ponteiros.size === 2) {
        const [a, b] = [...ponteiros.values()];
        if (a && b) pinca = Math.hypot(a.x - b.x, a.y - b.y);
        modo = 'orbita';
        return;
      }
      inicio = { x: ev.clientX, y: ev.clientY };
      anterior = { x: ev.clientX, y: ev.clientY, t: performance.now() };
      moveu = false;
      tween = null;
      if (ev.button === 0 && !ev.shiftKey && opcoes.apontador?.pegar?.(ev)) modo = 'item';
      else modo = ev.button === 2 || ev.shiftKey ? 'arrasto' : 'orbita';
    },
    ouvir,
  );

  tela.addEventListener(
    'pointermove',
    (ev) => {
      if (!ponteiros.has(ev.pointerId)) {
        if (!opcoes.apontador?.pairar) return;
        cancelAnimationFrame(pairando);
        pairando = requestAnimationFrame(() => opcoes.apontador?.pairar?.(ev));
        return;
      }
      interacao = performance.now();
      ponteiros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y) > 4) moveu = true;
      const agora = performance.now();
      const dx = ev.clientX - anterior.x;
      const dy = ev.clientY - anterior.y;
      const dtm = Math.max(1, agora - anterior.t);
      anterior = { x: ev.clientX, y: ev.clientY, t: agora };
      if (ponteiros.size === 2) {
        const [a, b] = [...ponteiros.values()];
        if (a && b) {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinca > 0) pose.distancia = limitar(pose.distancia * (pinca / d), opcoes.distancias[0], opcoes.distancias[1]);
          pinca = d;
          pedir();
        }
        return;
      }
      if (!moveu) return;
      if (modo === 'item') {
        opcoes.apontador?.arrastar?.(ev);
        return;
      }
      arrastando = true;
      if (modo === 'orbita') {
        const g = -dx * 0.32;
        const i = -dy * 0.28;
        pose.giro += g;
        pose.inclinacao = limitar(pose.inclinacao + i, 1.5, incMax);
        inercia.giro = inercia.giro * 0.6 + (g / dtm) * 0.4;
        inercia.inclinacao = inercia.inclinacao * 0.6 + (i / dtm) * 0.4;
        pedir();
      } else if (modo === 'arrasto') {
        const escala = (pose.distancia / Math.max(300, tela.clientHeight)) * 1.1;
        const gi = grau(pose.giro);
        const direita = new THREE.Vector3(Math.cos(gi), Math.sin(gi), 0);
        const frente = new THREE.Vector3(-Math.sin(gi), Math.cos(gi), 0);
        pose.alvo.addScaledVector(direita, -dx * escala).addScaledVector(frente, dy * escala);
        pedir();
      }
    },
    ouvir,
  );

  const terminar = (ev: PointerEvent): void => {
    if (!ponteiros.has(ev.pointerId)) return;
    ponteiros.delete(ev.pointerId);
    if (ponteiros.size < 2) pinca = 0;
    if (ponteiros.size > 0) return;
    if (modo === 'item') opcoes.apontador?.soltar?.(ev, !moveu);
    else if (!moveu && ev.type === 'pointerup') opcoes.apontador?.clicar?.(ev);
    if (modo !== 'orbita' || performance.now() - anterior.t > 90) {
      inercia.giro = 0;
      inercia.inclinacao = 0;
    }
    inercia.giro = limitar(inercia.giro, -0.6, 0.6);
    inercia.inclinacao = limitar(inercia.inclinacao, -0.4, 0.4);
    arrastando = false;
    modo = 'nada';
    pedir();
  };
  tela.addEventListener('pointerup', terminar, ouvir);
  tela.addEventListener('pointercancel', terminar, ouvir);
  tela.addEventListener('pointerleave', () => opcoes.apontador?.pairar?.(null), ouvir);
  tela.addEventListener('contextmenu', (ev) => ev.preventDefault(), ouvir);
  tela.addEventListener(
    'wheel',
    (ev) => {
      if (!opcoes.rodaLivre && !ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      interacao = performance.now();
      tween = null;
      const fator = Math.exp(limitar(ev.deltaY, -120, 120) * 0.0016);
      pose.distancia = limitar(pose.distancia * fator, opcoes.distancias[0], opcoes.distancias[1]);
      pedir();
    },
    { passive: false, signal: sinal.signal },
  );

  const redimensionar = (): void => {
    const l = el.clientWidth;
    const a = el.clientHeight;
    invalidarCaixa();
    if (!l || !a) return;
    renderer.setSize(l, a, false);
    camera.aspect = l / a;
    camera.updateProjectionMatrix();
    pedir();
  };
  const observador = new ResizeObserver(redimensionar);
  observador.observe(el);
  posicionar();

  return {
    el,
    tela,
    renderer,
    cena,
    camera,
    pose,
    irPara,
    pedir,
    animar: (fn) => {
      animacoes.add(fn);
      pedir();
      return () => animacoes.delete(fn);
    },
    raio,
    noPlano,
    projetar,
    aoDesenhar: (fn) => {
      depois.add(fn);
    },
    ocioso: (ms) => !arrastando && ponteiros.size === 0 && performance.now() - interacao > ms,
    destruir: () => {
      vivo = false;
      sinal.abort();
      observador.disconnect();
      cancelAnimationFrame(pairando);
      cancelAnimationFrame(agendado);
      animacoes.clear();
      depois.clear();
      cena.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh || o instanceof THREE.Line || o instanceof THREE.Points || o instanceof THREE.Sprite) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            for (const valor of Object.values(m)) if (valor instanceof THREE.Texture && valor !== cena.environment) valor.dispose();
            m.dispose();
          }
        }
        if ((o instanceof THREE.DirectionalLight || o instanceof THREE.SpotLight || o instanceof THREE.PointLight) && o.shadow.map) o.shadow.map.dispose();
      });
      cena.clear();
      renderer.renderLists.dispose();
      tela.remove();
      if (reserva.proprio) {
        renderer.dispose();
        renderer.forceContextLoss();
      } else if (compartilhado?.renderer === renderer) compartilhado.ocupado = false;
    },
  };
};
