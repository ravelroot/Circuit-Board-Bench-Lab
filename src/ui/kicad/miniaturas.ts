import * as THREE from 'three';
import type { Placa } from '../../dados/tipos';
import { capturarPng, densidadeDaTela, quandoOcioso } from '../cena3d/captura';
import { renderizacaoLeve } from '../cena3d/qualidade';
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
    renderer = new THREE.WebGLRenderer({ antialias: !renderizacaoLeve(), alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(densidadeDaTela(1.5));
    renderer.setSize(LARGURA, ALTURA, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } catch {
    renderer = null;
  }
  return renderer;
};

const renderizar = (placa: Placa): Promise<string | null> => {
  const r = obterRenderer();
  if (!r) return Promise.resolve(null);
  const cena = construirCena(placa, r, 1400, false);
  cena.grupo.setRotationFromEuler(poseParaRotacao(50, 0, -22));
  const camera = new THREE.PerspectiveCamera(28, LARGURA / ALTURA, 1, cena.tamanho * 20);
  camera.position.set(0, 0, cena.tamanho * 1.6);
  r.render(cena.cena, camera);
  const captura = capturarPng(r.domElement);
  cena.descartar();
  return captura;
};

const naTela = (img: HTMLImageElement): boolean => {
  const r = img.getBoundingClientRect();
  return r.bottom > -100 && r.top < window.innerHeight + 100;
};

const proximo = (): { placa: Placa; img: HTMLImageElement } | undefined => {
  const i = fila.findIndex((item) => item.img.isConnected && naTela(item.img));
  return i > 0 ? fila.splice(i, 1)[0] : fila.shift();
};

const gerar = async ({ placa, img }: { placa: Placa; img: HTMLImageElement }): Promise<void> => {
  if (!img.isConnected) return;
  const url = prontas.get(placa.id) ?? (await renderizar(placa));
  if (!url) return;
  prontas.set(placa.id, url);
  if (img.isConnected) img.src = url;
};

const processar = (): void => {
  if (trabalhando) return;
  const item = proximo();
  if (!item) return;
  trabalhando = true;
  quandoOcioso(() => {
    void gerar(item).finally(() => {
      trabalhando = false;
      processar();
    });
  });
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
