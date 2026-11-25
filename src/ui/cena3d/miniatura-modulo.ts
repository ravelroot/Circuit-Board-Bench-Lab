import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ModuloBancada } from '../../dados/bancada3d';
import { h } from '../dom';
import { construirModulo } from './modulos';

const LARGURA = 240;
const ALTURA = 180;
const prontas = new Map<string, string>();
const fila: { modulo: ModuloBancada; img: HTMLImageElement }[] = [];
let estudio: { renderer: THREE.WebGLRenderer; ambiente: THREE.Texture } | null | undefined;
let trabalhando = false;

const obterEstudio = (): typeof estudio => {
  if (estudio !== undefined) return estudio;
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(2);
    renderer.setSize(LARGURA, ALTURA, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    estudio = { renderer, ambiente };
  } catch {
    estudio = null;
  }
  return estudio;
};

const renderizar = (modulo: ModuloBancada): string | null => {
  const e = obterEstudio();
  if (!e) return null;
  const cena = new THREE.Scene();
  cena.environment = e.ambiente;
  cena.add(new THREE.HemisphereLight('#ffffff', '#5b606b', 1.1));
  const sol = new THREE.DirectionalLight('#fff4e6', 2.2);
  sol.position.set(-40, -30, 90);
  cena.add(sol);
  const m3 = construirModulo(modulo, e.renderer);
  const caixa = new THREE.Box3().setFromObject(m3.grupo);
  const centro = caixa.getCenter(new THREE.Vector3());
  const tamanho = caixa.getSize(new THREE.Vector3()).length();
  m3.grupo.position.sub(centro);
  m3.grupo.rotation.z = -0.5;
  cena.add(m3.grupo);
  const camera = new THREE.PerspectiveCamera(26, LARGURA / ALTURA, 1, tamanho * 20);
  camera.up.set(0, 0, 1);
  camera.position.set(tamanho * 0.25, -tamanho * 1.55, tamanho * 1.35);
  camera.lookAt(0, 0, 0);
  e.renderer.render(cena, camera);
  const url = e.renderer.domElement.toDataURL('image/png');
  cena.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture && v !== e.ambiente) v.dispose();
        mat.dispose();
      }
    }
  });
  return url;
};

const processar = (): void => {
  if (trabalhando) return;
  const item = fila.shift();
  if (!item) return;
  trabalhando = true;
  const agendar = (fn: () => void): void => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => fn(), { timeout: 400 });
    else setTimeout(fn, 16);
  };
  agendar(() => {
    const url = prontas.get(item.modulo.tipo) ?? (item.img.isConnected ? renderizar(item.modulo) : null);
    if (url) {
      prontas.set(item.modulo.tipo, url);
      item.img.src = url;
      item.img.classList.add('pronta');
    }
    trabalhando = false;
    processar();
  });
};

export const miniaturaModulo = (modulo: ModuloBancada, reserva: Node): HTMLElement => {
  const img = h('img', { class: 'miniatura-modulo', alt: '', width: LARGURA, height: ALTURA, decoding: 'async' });
  const pronta = prontas.get(modulo.tipo);
  if (pronta) {
    img.src = pronta;
    img.classList.add('pronta');
    return img;
  }
  fila.push({ modulo, img });
  window.setTimeout(processar, 60);
  return h('span', { class: 'miniatura-modulo-caixa' }, img, h('span', { class: 'miniatura-modulo-reserva' }, reserva));
};
