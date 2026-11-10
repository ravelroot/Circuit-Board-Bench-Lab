import * as THREE from 'three';
import type { Placa } from '../../dados/tipos';
import type { Footprint } from '../../pcb/modelo';
import { ui, type ChaveTexto } from '../../i18n/textos';
import { h, s, trocar } from '../dom';
import { icone } from '../icones';
import { construirCena, liberarAmbiente, poseParaRotacao, type Cena, type OpcoesFace } from './cena';

export interface Pose {
  x: number;
  y: number;
  z: number;
  zoom: number;
}

export const POSE_INICIAL: Readonly<Pose> = { x: 56, y: 0, z: -24, zoom: 1 };

const VISTAS: readonly (readonly [ChaveTexto, Readonly<Omit<Pose, 'zoom'>>])[] = [
  ['vistaTopo', { x: 0, y: 0, z: 0 }],
  ['vistaBase', { x: 0, y: 180, z: 0 }],
  ['vistaFrente', { x: 80, y: 0, z: 0 }],
  ['vistaTras', { x: 80, y: 0, z: 180 }],
  ['vistaEsquerda', { x: 80, y: 0, z: 90 }],
  ['vistaDireita', { x: 80, y: 0, z: -90 }],
  ['vistaIso', { x: 56, y: 0, z: -24 }],
];

export interface Visor3d {
  readonly el: HTMLElement;
  readonly acender: (parte: string | null) => void;
  readonly retangulo: (parte: string) => DOMRect | null;
  readonly aoMover: (fn: () => void) => void;
  readonly pose: () => Readonly<Pose>;
  readonly definirPose: (pose: Partial<Pose>) => void;
  readonly alternarGiro: (ligar?: boolean) => void;
  readonly alternarExplosao: (ligar?: boolean) => void;
  readonly redimensionar: () => void;
  readonly destruir: () => void;
}

export interface OpcoesVisor3d {
  readonly aoEscolher: (parte: string | null) => void;
}

const limitar = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
const normalizar = (v: number): number => Math.round((((v + 180) % 360 + 360) % 360 - 180) * 10) / 10;
const suavizar = (t: number): number => 1 - Math.pow(1 - t, 3);

export const webglDisponivel = (): boolean => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
};

export const montarVisor3d = (placa: Placa, opcoes: OpcoesVisor3d): Visor3d | null => {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.classList.add('visor3d-canvas');

  const pose: Pose = { ...POSE_INICIAL };
  const face: OpcoesFace = { mascara: true, serigrafia: true };
  let cena: Cena | null = null;
  let girando = false;
  let explodido = false;
  let explosao = 0;
  let explosaoAlvo = 0;
  let ortografica = false;
  let agendado = false;
  let ultimo = 0;
  let escolhida: string | null = null;
  let caixaSelecao: THREE.Box3Helper | null = null;
  const ouvintes = new Set<() => void>();
  const originais = new Map<THREE.Mesh | THREE.InstancedMesh, THREE.Material | THREE.Material[]>();

  const perspectiva = new THREE.PerspectiveCamera(30, 1, 0.5, 5000);
  const orto = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 5000);
  const camera = (): THREE.Camera => (ortografica ? orto : perspectiva);

  const status = h('div', { class: 'visor3d-status mono' });
  const eixos = s('svg', { class: 'visor3d-eixos', viewBox: '0 0 84 84', 'aria-hidden': 'true' });
  const carregando = h('div', { class: 'visor3d-carregando mono' }, ui('carregando'));
  const palco = h('div', { class: 'visor3d-palco' }, renderer.domElement, eixos, status, carregando);

  const botao = (rotulo: string, nome: Parameters<typeof icone>[0] | null, acao: () => void, classe = ''): HTMLButtonElement =>
    h('button', { class: `kicad-botao ${classe}`, type: 'button', title: rotulo, 'aria-label': rotulo, onclick: acao }, nome ? icone(nome, 'icone mini') : null, nome ? null : rotulo);
  const botoesVista = VISTAS.map(([chave, alvo]) =>
    h('button', { class: 'kicad-botao texto', type: 'button', onclick: () => { pararGiro(); Object.assign(pose, alvo); aplicar(); } }, ui(chave)),
  );
  const alternador = (chave: ChaveTexto, inicial: boolean, aoMudar: (v: boolean) => void): HTMLButtonElement => {
    const b = h('button', { class: 'kicad-botao texto alternador', type: 'button', 'aria-pressed': String(inicial) }, ui(chave));
    b.addEventListener('click', () => {
      const v = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(v));
      aoMudar(v);
    });
    return b;
  };
  const botaoGiro = h('button', { class: 'botao-visor', type: 'button', 'aria-pressed': 'false', onclick: () => alternarGiro() }, icone('girar'), h('span', {}, ui('girar')));
  const botaoExplodir = h('button', { class: 'botao-visor botao-explodir', type: 'button', 'aria-pressed': 'false', onclick: () => alternarExplosao() }, icone('explodir'), h('span', {}, ui('explodir')));
  const barra = h(
    'div',
    { class: 'kicad-barra' },
    h('div', { class: 'kicad-grupo' }, ...botoesVista),
    h('span', { class: 'kicad-separador' }),
    h(
      'div',
      { class: 'kicad-grupo' },
      alternador('camadaComponentes', true, (v) => { if (cena) cena.componentes.visible = v; pedir(); }),
      alternador('camadaSerigrafia', true, (v) => { face.serigrafia = v; cena?.atualizarFace(face); pedir(); }),
      alternador('camadaMascara', true, (v) => { face.mascara = v; cena?.atualizarFace(face); pedir(); }),
      alternador('ortografica', false, (v) => { ortografica = v; ajustarCamera(); pedir(); }),
    ),
  );
  const deslizadores = (['x', 'y', 'z'] as const).map((eixo) => {
    const campo = h('input', { type: 'range', min: -180, max: 180, step: 1, value: pose[eixo], 'aria-label': ui('eixo', { e: eixo.toUpperCase() }) });
    const valor = h('output', { class: 'eixo-valor' });
    campo.addEventListener('input', () => {
      pararGiro();
      pose[eixo] = Number(campo.value);
      aplicar();
    });
    return { eixo, campo, valor, el: h('label', { class: 'eixo' }, h('span', { class: 'eixo-nome' }, eixo.toUpperCase()), campo, valor) };
  });
  const controles = h(
    'div',
    { class: 'visor-controles' },
    h(
      'div',
      { class: 'visor-botoes' },
      botaoGiro,
      botaoExplodir,
      h('span', { class: 'espaco' }),
      botao(ui('afastar'), 'menos', () => zoom(-0.15), 'botao-icone pequeno'),
      botao(ui('aproximar'), 'mais', () => zoom(0.15), 'botao-icone pequeno'),
      botao(ui('centralizar'), 'centralizar', () => { pararGiro(); Object.assign(pose, POSE_INICIAL); aplicar(); }, 'botao-icone pequeno'),
    ),
    h('div', { class: 'visor-eixos' }, ...deslizadores.map((d) => d.el)),
  );
  const el = h('div', { class: 'visor visor3d', tabindex: 0, role: 'application', 'aria-label': `${placa.nome} 3D`, 'data-explodido': 'false' }, barra, palco, controles, h('p', { class: 'visor-dica' }, ui('dicaGiro')));

  const ajustarCamera = (): void => {
    const largura = palco.clientWidth || 600;
    const altura = palco.clientHeight || 400;
    const tamanho = cena?.tamanho ?? 60;
    perspectiva.aspect = largura / altura;
    const fator = Math.max(1, 1.45 / perspectiva.aspect);
    const distancia = (tamanho * 1.72 * fator) / pose.zoom;
    perspectiva.position.set(0, 0, distancia);
    perspectiva.near = distancia / 50;
    perspectiva.far = distancia * 6;
    perspectiva.updateProjectionMatrix();
    const meia = (tamanho * 0.52 * fator) / pose.zoom;
    orto.left = (-meia * largura) / altura;
    orto.right = (meia * largura) / altura;
    orto.top = meia;
    orto.bottom = -meia;
    orto.position.set(0, 0, tamanho * 4);
    orto.near = 0.1;
    orto.far = tamanho * 10;
    orto.updateProjectionMatrix();
  };

  const desenharEixos = (): void => {
    if (!cena) return;
    const q = cena.grupo.quaternion;
    const linhas = ([['X', new THREE.Vector3(1, 0, 0), '#e5484d'], ['Y', new THREE.Vector3(0, 1, 0), '#30a46c'], ['Z', new THREE.Vector3(0, 0, 1), '#3e8ef7']] as const).map(([nome, v, cor]) => {
      const p = v.clone().applyQuaternion(q);
      return { nome, cor, x: 42 + p.x * 28, y: 42 - p.y * 28, z: p.z };
    });
    linhas.sort((a, b) => a.z - b.z);
    eixos.replaceChildren(
      s('circle', { cx: 42, cy: 42, r: 3, class: 'eixo-centro' }),
      ...linhas.flatMap((l) => [
        s('line', { x1: 42, y1: 42, x2: l.x, y2: l.y, stroke: l.cor, 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
        s('text', { x: 42 + (l.x - 42) * 1.25, y: 42 + (l.y - 42) * 1.25 + 4, fill: l.cor, 'text-anchor': 'middle' }, l.nome),
      ]),
    );
  };

  const atualizarSelecao = (): void => {
    if (!cena) return;
    if (caixaSelecao) {
      cena.conteudo.remove(caixaSelecao);
      caixaSelecao.geometry.dispose();
      caixaSelecao = null;
    }
    if (!escolhida) return;
    const caixa = new THREE.Box3();
    let algum = false;
    cena.modelos.forEach((m, i) => {
      const f = cena?.projeto.footprints[i];
      if (!f || f.parte !== escolhida) return;
      const lift = m.position.z;
      const alt = Math.max(0.3, Number(m.userData.altura ?? 0.3)) + (f.modelo === 'barra' ? 6 : 0);
      caixa.expandByPoint(new THREE.Vector3(f.corpo.x - 0.3, -(f.corpo.y + f.corpo.a) - 0.3, lift));
      caixa.expandByPoint(new THREE.Vector3(f.corpo.x + f.corpo.l + 0.3, -f.corpo.y + 0.3, lift + alt + 0.3));
      algum = true;
    });
    if (!algum) return;
    caixaSelecao = new THREE.Box3Helper(caixa, new THREE.Color('#ffd166'));
    const material = caixaSelecao.material as THREE.LineBasicMaterial;
    material.depthTest = false;
    material.transparent = true;
    caixaSelecao.renderOrder = 10;
    cena.conteudo.add(caixaSelecao);
  };

  const pintar = (): void => {
    if (!cena) return;
    for (const [mesh, material] of originais) mesh.material = material;
    originais.clear();
    if (!escolhida) return;
    cena.modelos.forEach((m, i) => {
      if (cena?.projeto.footprints[i]?.parte !== escolhida) return;
      m.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        originais.set(o, o.material);
        const realcar = (mat: THREE.Material): THREE.Material => {
          if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;
          const copia = mat.clone();
          copia.emissive = new THREE.Color('#ffb703');
          copia.emissiveIntensity = 0.35;
          return copia;
        };
        o.material = Array.isArray(o.material) ? o.material.map(realcar) : realcar(o.material);
      });
    });
  };

  const descartarRealces = (): void => {
    if (!cena) return;
    for (const [mesh] of originais) {
      const atual = mesh.material;
      for (const mat of Array.isArray(atual) ? atual : [atual]) mat.dispose();
    }
  };

  const desenhar = (agora: number): void => {
    agendado = false;
    if (!cena) return;
    const dt = ultimo ? Math.min(64, agora - ultimo) : 16;
    ultimo = agora;
    let animando = false;
    if (girando) {
      pose.z = normalizar(pose.z + dt * 0.03);
      sincronizarControles();
      animando = true;
    }
    if (Math.abs(explosao - explosaoAlvo) > 0.001) {
      explosao += Math.sign(explosaoAlvo - explosao) * Math.min(Math.abs(explosaoAlvo - explosao), dt / 700);
      const fator = suavizar(explosao);
      cena.modelos.forEach((m) => {
        const altura = Number(m.userData.altura ?? 1);
        m.position.z = fator * (2 * cena!.projeto.escala + altura * 1.3);
      });
      atualizarSelecao();
      animando = true;
    }
    cena.grupo.setRotationFromEuler(poseParaRotacao(pose.x, pose.y, pose.z));
    renderer.render(cena.cena, camera());
    desenharEixos();
    for (const fn of ouvintes) fn();
    if (animando) pedir();
    else ultimo = 0;
  };

  const pedir = (): void => {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(desenhar);
  };

  const sincronizarControles = (): void => {
    for (const d of deslizadores) {
      const v = Math.round(normalizar(pose[d.eixo]));
      d.campo.value = String(v);
      d.valor.textContent = `${v}°`;
    }
    el.dataset.pose = `${Math.round(normalizar(pose.x))},${Math.round(normalizar(pose.y))},${Math.round(normalizar(pose.z))}`;
  };

  const aplicar = (): void => {
    sincronizarControles();
    ajustarCamera();
    pedir();
  };

  const zoom = (delta: number): void => {
    pose.zoom = limitar(pose.zoom + delta, 0.4, 3);
    aplicar();
  };

  const pararGiro = (): void => {
    if (girando) alternarGiro(false);
  };

  const alternarGiro = (ligar = !girando): void => {
    girando = ligar;
    botaoGiro.setAttribute('aria-pressed', String(girando));
    if (girando) pedir();
  };

  const alternarExplosao = (ligar = !explodido): void => {
    explodido = ligar;
    explosaoAlvo = explodido ? 1 : 0;
    el.dataset.explodido = String(explodido);
    botaoExplodir.setAttribute('aria-pressed', String(explodido));
    pedir();
  };

  const raycaster = new THREE.Raycaster();
  const footprintEm = (ev: PointerEvent): Footprint | null => {
    if (!cena) return null;
    const r = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera());
    const alvos = cena.componentes.visible ? [cena.componentes, cena.placa] : [cena.placa];
    const acerto = raycaster.intersectObjects(alvos, true)[0];
    if (!acerto) return null;
    let o: THREE.Object3D | null = acerto.object;
    while (o && o.userData.fp === undefined && o !== cena.conteudo) o = o.parent;
    if (o && typeof o.userData.fp === 'number') return cena.projeto.footprints.find((f) => f.indice === o?.userData.fp) ?? null;
    const local = cena.conteudo.worldToLocal(acerto.point.clone());
    const x = local.x;
    const y = -local.y;
    const candidatos = cena.projeto.footprints.filter((f) => x >= f.corpo.x && x <= f.corpo.x + f.corpo.l && y >= f.corpo.y && y <= f.corpo.y + f.corpo.a);
    candidatos.sort((a, b) => a.corpo.l * a.corpo.a - b.corpo.l * b.corpo.a);
    return candidatos[0] ?? null;
  };

  const descrever = (f: Footprint | null): void => {
    if (!f) {
      trocar(status, `${placa.id}.kicad_pcb · ${cena?.projeto.footprints.length ?? 0} footprints`);
      return;
    }
    trocar(status, h('b', {}, f.ref), ` ${f.valor} · ${f.biblioteca}`);
  };

  const ponteiros = new Map<number, { x: number; y: number }>();
  let arrastou = false;
  let pinca = 0;
  let quadroHover = 0;
  palco.addEventListener('pointerdown', (ev) => {
    ponteiros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    palco.setPointerCapture(ev.pointerId);
    arrastou = false;
    if (ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()];
      if (a && b) pinca = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  palco.addEventListener('pointermove', (ev) => {
    const antes = ponteiros.get(ev.pointerId);
    if (!antes) {
      cancelAnimationFrame(quadroHover);
      quadroHover = requestAnimationFrame(() => {
        const f = footprintEm(ev);
        descrever(f);
        palco.classList.toggle('sobre-parte', !!f?.parte);
      });
      return;
    }
    const dx = ev.clientX - antes.x;
    const dy = ev.clientY - antes.y;
    ponteiros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (Math.abs(dx) + Math.abs(dy) > 1) arrastou = true;
    if (!arrastou) return;
    pararGiro();
    if (ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()];
      if (a && b) {
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinca > 0) pose.zoom = limitar(pose.zoom * (dist / pinca), 0.4, 3);
        pinca = dist;
      }
    } else if (ev.shiftKey) {
      pose.y = normalizar(pose.y + dx * 0.45);
      pose.x = normalizar(pose.x - dy * 0.45);
    } else {
      pose.z = normalizar(pose.z + dx * 0.45);
      pose.x = normalizar(pose.x - dy * 0.45);
    }
    aplicar();
  });
  palco.addEventListener('pointerup', (ev) => {
    const clique = !arrastou && ponteiros.size === 1;
    ponteiros.delete(ev.pointerId);
    if (ponteiros.size < 2) pinca = 0;
    if (!clique) return;
    const f = footprintEm(ev);
    opcoes.aoEscolher(f?.parte ?? null);
  });
  palco.addEventListener('pointercancel', (ev) => ponteiros.delete(ev.pointerId));
  palco.addEventListener('pointerleave', () => descrever(null));
  palco.addEventListener(
    'wheel',
    (ev) => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      pose.zoom = limitar(pose.zoom * (ev.deltaY > 0 ? 0.92 : 1.08), 0.4, 3);
      aplicar();
    },
    { passive: false },
  );
  el.addEventListener('keydown', (ev) => {
    if (ev.target !== el) return;
    const passo = ev.shiftKey ? 2 : 10;
    const acoes: Record<string, () => void> = {
      ArrowLeft: () => { pose.z -= passo; },
      ArrowRight: () => { pose.z += passo; },
      ArrowUp: () => { pose.x -= passo; },
      ArrowDown: () => { pose.x += passo; },
      PageUp: () => { pose.y -= passo; },
      PageDown: () => { pose.y += passo; },
      '+': () => { pose.zoom = limitar(pose.zoom + 0.1, 0.4, 3); },
      '=': () => { pose.zoom = limitar(pose.zoom + 0.1, 0.4, 3); },
      '-': () => { pose.zoom = limitar(pose.zoom - 0.1, 0.4, 3); },
      '0': () => { Object.assign(pose, POSE_INICIAL); },
    };
    const acao = acoes[ev.key];
    if (acao) {
      ev.preventDefault();
      ev.stopPropagation();
      pararGiro();
      acao();
      pose.x = normalizar(pose.x);
      pose.y = normalizar(pose.y);
      pose.z = normalizar(pose.z);
      aplicar();
      return;
    }
    const tecla = ev.key.toLowerCase();
    if ((tecla === 'e' || tecla === 'g') && !ev.ctrlKey && !ev.metaKey) {
      ev.preventDefault();
      ev.stopPropagation();
      if (tecla === 'e') alternarExplosao();
      else alternarGiro();
    }
  });

  const redimensionar = (): void => {
    const largura = palco.clientWidth;
    const altura = palco.clientHeight;
    if (!largura || !altura) return;
    renderer.setSize(largura, altura, false);
    ajustarCamera();
    pedir();
  };
  const observador = new ResizeObserver(() => redimensionar());
  observador.observe(palco);

  const montar = (): void => {
    cena = construirCena(placa, renderer, 3072, true);
    carregando.remove();
    descrever(null);
    redimensionar();
    aplicar();
    if (escolhida) {
      pintar();
      atualizarSelecao();
    }
  };
  const fontes = Promise.all([document.fonts.load('500 16px "IBM Plex Mono"'), document.fonts.load('700 16px "Bricolage Grotesque Variable"')]).catch(() => undefined);
  let vivo = true;
  void fontes.then(() => {
    if (vivo) requestAnimationFrame(montar);
  });
  sincronizarControles();

  const projetar = (v: THREE.Vector3, r: DOMRect): [number, number] => {
    const p = v.project(camera());
    return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height];
  };

  return {
    el,
    acender: (parte) => {
      escolhida = parte;
      if (parte) el.dataset.acesa = parte;
      else delete el.dataset.acesa;
      descartarRealces();
      pintar();
      atualizarSelecao();
      pedir();
    },
    retangulo: (parte) => {
      if (!cena) return null;
      const r = renderer.domElement.getBoundingClientRect();
      if (!r.width) return null;
      let caixa: { l: number; t: number; r: number; b: number } | null = null;
      cena.conteudo.updateMatrixWorld();
      cena.projeto.footprints.forEach((f, i) => {
        if (f.parte !== parte || !cena) return;
        const m = cena.modelos[i];
        const lift = m?.position.z ?? 0;
        const alt = Number(m?.userData.altura ?? 0.5);
        for (const [x, y, z] of [[f.corpo.x, f.corpo.y, lift], [f.corpo.x + f.corpo.l, f.corpo.y, lift], [f.corpo.x, f.corpo.y + f.corpo.a, lift], [f.corpo.x + f.corpo.l, f.corpo.y + f.corpo.a, lift], [f.corpo.x + f.corpo.l / 2, f.corpo.y + f.corpo.a / 2, lift + alt]] as const) {
          const [px, py] = projetar(cena.conteudo.localToWorld(new THREE.Vector3(x, -y, z)), r);
          caixa = caixa ? { l: Math.min(caixa.l, px), t: Math.min(caixa.t, py), r: Math.max(caixa.r, px), b: Math.max(caixa.b, py) } : { l: px, t: py, r: px, b: py };
        }
      });
      const final = caixa as { l: number; t: number; r: number; b: number } | null;
      return final ? new DOMRect(final.l, final.t, final.r - final.l, final.b - final.t) : null;
    },
    aoMover: (fn) => {
      ouvintes.add(fn);
    },
    pose: () => ({ ...pose }),
    definirPose: (nova) => {
      Object.assign(pose, nova);
      aplicar();
    },
    alternarGiro,
    alternarExplosao,
    redimensionar,
    destruir: () => {
      vivo = false;
      girando = false;
      observador.disconnect();
      ouvintes.clear();
      cancelAnimationFrame(quadroHover);
      descartarRealces();
      if (caixaSelecao) caixaSelecao.geometry.dispose();
      cena?.descartar();
      liberarAmbiente(renderer);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
};
