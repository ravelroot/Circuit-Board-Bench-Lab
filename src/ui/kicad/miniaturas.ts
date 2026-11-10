import * as THREE from 'three';
import type { Placa } from '../../dados/tipos';
import { h } from '../dom';
import { construirCena, poseParaRotacao } from './cena';
import { vistaEstatica } from './editor2d';
import { webglDisponivel } from './visor3d';

const LARGURA = 480;
const ALTURA = 280;
const prontas = new Map<string, string>();
const fila: { placa: Placa; img: HTMLImageElement }[] = [];
let renderer: THREE.WebGLRenderer | null | undefined;
let trabalhando = false;

const obterRenderer = (): THREE.WebGLRenderer | null => {
  if (renderer !== undefined) return renderer;
  if (!webglDisponivel()) {
    renderer = null;
    return null;
  }
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1.5);
    renderer.setSize(LARGURA, ALTURA, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } catch {
    renderer = null;
  }
  return renderer;
};

const renderizar = (placa: Placa): string | null => {
  const r = obterRenderer();
  if (!r) return null;
  const cena = construirCena(placa, r, 1400, false);
  cena.grupo.setRotationFromEuler(poseParaRotacao(50, 0, -22));
  const camera = new THREE.PerspectiveCamera(28, LARGURA / ALTURA, 1, cena.tamanho * 20);
  camera.position.set(0, 0, cena.tamanho * 1.6);
  r.render(cena.cena, camera);
  const url = r.domElement.toDataURL('image/png');
  cena.descartar();
  return url;
};

const processar = (): void => {
  if (trabalhando) return;
  const item = fila.shift();
  if (!item) return;
  trabalhando = true;
  setTimeout(() => {
    if (!item.img.isConnected) {
      trabalhando = false;
      processar();
      return;
    }
    const pronta = prontas.get(item.placa.id);
    const url = pronta ?? renderizar(item.placa);
    if (url) {
      prontas.set(item.placa.id, url);
      if (item.img.isConnected) item.img.src = url;
    }
    trabalhando = false;
    processar();
  }, 16);
};

export const miniatura = (placa: Placa): HTMLElement => {
  if (!webglDisponivel()) return h('div', { class: 'miniatura estatica', 'aria-hidden': 'true' }, vistaEstatica(placa));
  const img = h('img', { class: 'miniatura-img', alt: '', width: LARGURA, height: ALTURA, decoding: 'async' });
  const pronta = prontas.get(placa.id);
  if (pronta) img.src = pronta;
  else if (typeof IntersectionObserver === 'undefined') {
    fila.push({ placa, img });
    void document.fonts.ready.then(processar);
  } else {
    const observador = new IntersectionObserver((entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      observador.disconnect();
      fila.push({ placa, img });
      void document.fonts.ready.then(processar);
    }, { rootMargin: '200px' });
    observador.observe(img);
  }
  return h('div', { class: 'miniatura', 'aria-hidden': 'true' }, img);
};
