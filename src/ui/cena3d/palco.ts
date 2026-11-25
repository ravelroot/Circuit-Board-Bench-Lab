import * as THREE from 'three';
import { ambienteDe, liberarAmbiente } from '../kicad/cena';
import { h, zoomDaPagina } from '../dom';

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
  readonly destruir: () => void;
}

const limitar = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
const suave = (t: number): number => 1 - Math.pow(1 - t, 3);
const grau = THREE.MathUtils.degToRad;

export const criarRenderer = (): THREE.WebGLRenderer | null => {
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.max(1, Math.min((window.devicePixelRatio || 1) * zoomDaPagina(), 2)));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.02;
    r.outputColorSpace = THREE.SRGBColorSpace;
    return r;
  } catch {
    return null;
  }
};

export const montarPalco = (opcoes: OpcoesPalco): Palco3d | null => {
  const renderer = criarRenderer();
  if (!renderer) return null;
  const tela = renderer.domElement;
  tela.classList.add('palco3d-tela');
  const el = h('div', { class: `palco3d ${opcoes.classe}`, role: 'application', 'aria-label': opcoes.rotulo, tabindex: 0 }, tela);

  const cena = new THREE.Scene();
  cena.environment = ambienteDe(renderer);
  cena.environmentIntensity = 0.75;
  if (opcoes.fundo) cena.background = new THREE.Color(opcoes.fundo);
  const ext = opcoes.extensao;
  cena.add(new THREE.HemisphereLight('#ffffff', '#545a66', 1.05));
  const sol = new THREE.DirectionalLight('#fff6ea', 2.4);
  sol.position.set(-0.5 * ext, -0.35 * ext, 1.3 * ext);
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
  cena.add(sol);
  const contra = new THREE.DirectionalLight('#dfe8ff', 0.5);
  contra.position.set(ext, ext * 0.8, ext);
  cena.add(contra);

  const camera = new THREE.PerspectiveCamera(32, 1, 1, ext * 20);
  camera.up.set(0, 0, 1);
  const pose: Pose3d = {
    inclinacao: opcoes.pose.inclinacao,
    giro: opcoes.pose.giro,
    distancia: opcoes.pose.distancia,
    alvo: new THREE.Vector3(...(opcoes.pose.alvo ?? [0, 0, 0])),
  };

  const posicionar = (): void => {
    const inc = grau(limitar(pose.inclinacao, 1.5, 86));
    const gi = grau(pose.giro);
    camera.position.set(
      pose.alvo.x + pose.distancia * Math.sin(inc) * Math.sin(gi),
      pose.alvo.y - pose.distancia * Math.sin(inc) * Math.cos(gi),
      pose.alvo.z + pose.distancia * Math.cos(inc),
    );
    camera.near = Math.max(0.5, pose.distancia / 40);
    camera.far = pose.distancia * 8 + ext * 4;
    camera.lookAt(pose.alvo);
    camera.updateProjectionMatrix();
  };

  let agendado = false;
  let ultimo = 0;
  let vivo = true;
  let tween: { de: Pose3d; para: Pose3d; t0: number; ms: number } | null = null;
  const animacoes = new Set<(dt: number, agora: number) => boolean>();
  const depois = new Set<() => void>();

  const quadro = (agora: number): void => {
    agendado = false;
    if (!vivo) return;
    const dt = ultimo ? Math.min(64, agora - ultimo) : 16;
    ultimo = agora;
    let continuar = false;
    if (tween) {
      const t = Math.min(1, (agora - tween.t0) / tween.ms);
      const k = suave(t);
      pose.inclinacao = tween.de.inclinacao + (tween.para.inclinacao - tween.de.inclinacao) * k;
      pose.giro = tween.de.giro + (tween.para.giro - tween.de.giro) * k;
      pose.distancia = tween.de.distancia + (tween.para.distancia - tween.de.distancia) * k;
      pose.alvo.lerpVectors(tween.de.alvo, tween.para.alvo, k);
      if (t >= 1) tween = null;
      else continuar = true;
    }
    for (const fn of animacoes) if (fn(dt, agora)) continuar = true;
    posicionar();
    renderer.render(cena, camera);
    for (const fn of depois) fn();
    if (continuar) pedir();
    else ultimo = 0;
  };

  const pedir = (): void => {
    if (agendado || !vivo) return;
    agendado = true;
    requestAnimationFrame(quadro);
  };

  const irPara: Palco3d['irPara'] = (alvo, ms = 650) => {
    const para: Pose3d = {
      inclinacao: alvo.inclinacao ?? pose.inclinacao,
      giro: alvo.giro ?? pose.giro,
      distancia: limitar(alvo.distancia ?? pose.distancia, opcoes.distancias[0], opcoes.distancias[1]),
      alvo: (alvo.alvo ?? pose.alvo).clone(),
    };
    const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (ms <= 0 || reduzido) {
      Object.assign(pose, { inclinacao: para.inclinacao, giro: para.giro, distancia: para.distancia });
      pose.alvo.copy(para.alvo);
      tween = null;
    } else {
      tween = { de: { ...pose, alvo: pose.alvo.clone() }, para, t0: performance.now(), ms };
    }
    pedir();
  };

  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const raio: Palco3d['raio'] = (ev) => {
    const r = tela.getBoundingClientRect();
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
  const projetar: Palco3d['projetar'] = (v) => {
    const p = v.clone().project(camera);
    const r = tela.getBoundingClientRect();
    return { x: ((p.x + 1) / 2) * r.width, y: ((1 - p.y) / 2) * r.height, frente: p.z < 1 };
  };

  let modo: 'nada' | 'item' | 'orbita' | 'arrasto' = 'nada';
  let inicio = { x: 0, y: 0 };
  let anterior = { x: 0, y: 0 };
  let moveu = false;
  let pairando = 0;
  const ponteiros = new Map<number, { x: number; y: number }>();
  let pinca = 0;

  tela.addEventListener('pointerdown', (ev) => {
    if (ev.button > 2) return;
    ponteiros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    tela.setPointerCapture(ev.pointerId);
    if (ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()];
      if (a && b) pinca = Math.hypot(a.x - b.x, a.y - b.y);
      modo = 'orbita';
      return;
    }
    inicio = { x: ev.clientX, y: ev.clientY };
    anterior = inicio;
    moveu = false;
    tween = null;
    if (ev.button === 0 && !ev.shiftKey && opcoes.apontador?.pegar?.(ev)) modo = 'item';
    else modo = ev.button === 2 || ev.shiftKey ? 'arrasto' : 'orbita';
  });

  tela.addEventListener('pointermove', (ev) => {
    if (!ponteiros.has(ev.pointerId)) {
      if (!opcoes.apontador?.pairar) return;
      cancelAnimationFrame(pairando);
      pairando = requestAnimationFrame(() => opcoes.apontador?.pairar?.(ev));
      return;
    }
    ponteiros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y) > 4) moveu = true;
    const dx = ev.clientX - anterior.x;
    const dy = ev.clientY - anterior.y;
    anterior = { x: ev.clientX, y: ev.clientY };
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
    if (modo === 'orbita') {
      pose.giro -= dx * 0.35;
      pose.inclinacao = limitar(pose.inclinacao - dy * 0.3, 1.5, 86);
      pedir();
    } else if (modo === 'arrasto') {
      const escala = pose.distancia / Math.max(300, tela.clientHeight) * 1.1;
      const gi = grau(pose.giro);
      const direita = new THREE.Vector3(Math.cos(gi), Math.sin(gi), 0);
      const frente = new THREE.Vector3(-Math.sin(gi), Math.cos(gi), 0);
      pose.alvo.addScaledVector(direita, -dx * escala).addScaledVector(frente, dy * escala);
      pedir();
    }
  });

  const terminar = (ev: PointerEvent): void => {
    if (!ponteiros.has(ev.pointerId)) return;
    ponteiros.delete(ev.pointerId);
    if (ponteiros.size < 2) pinca = 0;
    if (ponteiros.size > 0) return;
    if (modo === 'item') opcoes.apontador?.soltar?.(ev, !moveu);
    else if (!moveu && ev.type === 'pointerup') opcoes.apontador?.clicar?.(ev);
    modo = 'nada';
  };
  tela.addEventListener('pointerup', terminar);
  tela.addEventListener('pointercancel', terminar);
  tela.addEventListener('pointerleave', () => opcoes.apontador?.pairar?.(null));
  tela.addEventListener('contextmenu', (ev) => ev.preventDefault());
  tela.addEventListener(
    'wheel',
    (ev) => {
      if (!opcoes.rodaLivre && !ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      tween = null;
      pose.distancia = limitar(pose.distancia * (ev.deltaY > 0 ? 1.1 : 0.9), opcoes.distancias[0], opcoes.distancias[1]);
      pedir();
    },
    { passive: false },
  );

  const redimensionar = (): void => {
    const l = el.clientWidth;
    const a = el.clientHeight;
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
    destruir: () => {
      vivo = false;
      observador.disconnect();
      cancelAnimationFrame(pairando);
      animacoes.clear();
      depois.clear();
      cena.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            for (const valor of Object.values(m)) if (valor instanceof THREE.Texture && valor !== cena.environment) valor.dispose();
            m.dispose();
          }
        }
      });
      cena.clear();
      liberarAmbiente(renderer);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
};
