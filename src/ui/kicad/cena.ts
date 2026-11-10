import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Placa } from '../../dados/tipos';
import { projetoDe } from '../../pcb/gerador';
import type { ProjetoPcb } from '../../pcb/modelo';
import { construirModelo, Fabrica } from './modelos3d';
import { desenharFace, desenharPbr } from './texturas';

export interface OpcoesFace {
  mascara: boolean;
  serigrafia: boolean;
}

export interface Cena {
  readonly cena: THREE.Scene;
  readonly grupo: THREE.Group;
  readonly conteudo: THREE.Group;
  readonly componentes: THREE.Group;
  readonly placa: THREE.Mesh;
  readonly modelos: readonly THREE.Group[];
  readonly projeto: ProjetoPcb;
  readonly tamanho: number;
  readonly atualizarFace: (o: OpcoesFace) => void;
  readonly descartar: () => void;
}

export const pxmmPara = (p: ProjetoPcb, maximo: number): number => Math.min(28, maximo / Math.max(p.largura, p.altura));

const ambientes = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

const ambienteDe = (renderer: THREE.WebGLRenderer): THREE.Texture => {
  const pronto = ambientes.get(renderer);
  if (pronto) return pronto;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const mapa = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  ambientes.set(renderer, mapa);
  return mapa;
};

export const liberarAmbiente = (renderer: THREE.WebGLRenderer): void => {
  ambientes.get(renderer)?.dispose();
  ambientes.delete(renderer);
};

export const construirCena = (placa: Placa, renderer: THREE.WebGLRenderer, texturaMax: number, sombras: boolean): Cena => {
  const projeto = projetoDe(placa);
  const anisotropia = renderer.capabilities.getMaxAnisotropy();
  const fab = new Fabrica(projeto, anisotropia);
  const cena = new THREE.Scene();
  cena.environment = ambienteDe(renderer);
  cena.environmentIntensity = 0.9;

  const tamanho = Math.max(projeto.largura, projeto.altura);
  cena.add(new THREE.HemisphereLight('#ffffff', '#4a4a58', 1.1));
  const chave = new THREE.DirectionalLight('#ffffff', 2.6);
  chave.position.set(-0.55 * tamanho, 0.75 * tamanho, 1.6 * tamanho);
  if (sombras) {
    chave.castShadow = true;
    chave.shadow.mapSize.set(2048, 2048);
    const sc = chave.shadow.camera;
    sc.left = -tamanho * 0.8;
    sc.right = tamanho * 0.8;
    sc.top = tamanho * 0.8;
    sc.bottom = -tamanho * 0.8;
    sc.near = 0.1;
    sc.far = tamanho * 5;
    chave.shadow.bias = -0.0003;
    chave.shadow.normalBias = 0.02 * Math.max(1, tamanho / 80);
  }
  cena.add(chave);
  const preenchimento = new THREE.DirectionalLight('#dfe6ff', 0.55);
  preenchimento.position.set(tamanho, -0.6 * tamanho, 0.9 * tamanho);
  cena.add(preenchimento);

  const grupo = new THREE.Group();
  const conteudo = new THREE.Group();
  conteudo.position.set(-projeto.largura / 2, projeto.altura / 2, 0);
  grupo.add(conteudo);
  cena.add(grupo);

  const pxmm = pxmmPara(projeto, texturaMax);
  const texturaDe = (canvas: HTMLCanvasElement, cor: boolean): THREE.CanvasTexture => {
    const t = fab.guardar(new THREE.CanvasTexture(canvas));
    t.colorSpace = cor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = anisotropia;
    return t;
  };
  const pbr = texturaDe(desenharPbr(projeto, pxmm), false);
  const topo = fab.guardar(new THREE.MeshStandardMaterial({ map: texturaDe(desenharFace(projeto, { mascara: true, serigrafia: true, pxmm }), true), metalnessMap: pbr, roughnessMap: pbr, metalness: 1, roughness: 1 }));
  const verso = fab.guardar(new THREE.MeshStandardMaterial({ map: texturaDe(desenharFace(projeto, { mascara: true, serigrafia: false, pxmm: pxmm * 0.6 }, true), true), roughness: 0.5 }));
  const lado = fab.cor('#b4a46e', 0, 0.8);
  const geometria = fab.guardar(new THREE.BoxGeometry(projeto.largura, projeto.altura, projeto.espessura));
  const placaMesh = new THREE.Mesh(geometria, [lado, lado, lado, lado, topo, verso]);
  placaMesh.position.set(projeto.largura / 2, -projeto.altura / 2, -projeto.espessura / 2);
  placaMesh.receiveShadow = true;
  placaMesh.castShadow = true;
  conteudo.add(placaMesh);

  const componentes = new THREE.Group();
  const modelos = projeto.footprints.map((f) => construirModelo(f, projeto, fab));
  for (const m of modelos) componentes.add(m);
  conteudo.add(componentes);
  if (!sombras) cena.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });

  return {
    cena,
    grupo,
    conteudo,
    componentes,
    placa: placaMesh,
    modelos,
    projeto,
    tamanho,
    atualizarFace: (o) => {
      const antigo = topo.map;
      topo.map = texturaDe(desenharFace(projeto, { ...o, pxmm }), true);
      topo.needsUpdate = true;
      antigo?.dispose();
    },
    descartar: () => {
      fab.descartar();
      cena.clear();
    },
  };
};

export const poseParaRotacao = (x: number, y: number, z: number): THREE.Euler => new THREE.Euler(THREE.MathUtils.degToRad(-x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(-z), 'XYZ');
