import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const cor = (c: string, metalness = 0, roughness = 0.55): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: c, metalness, roughness });

const sombrear = <T extends THREE.Mesh>(m: T): T => {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

export const caixa = (l: number, a: number, h: number, material: THREE.Material | THREE.Material[]): THREE.Mesh =>
  sombrear(new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.01, l), Math.max(0.01, a), Math.max(0.01, h)), material));

export const arredondada = (l: number, a: number, h: number, raio: number, material: THREE.Material): THREE.Mesh => {
  const r = Math.max(0.01, Math.min(raio, l / 2 - 0.01, a / 2 - 0.01, h / 2 - 0.01));
  return sombrear(new THREE.Mesh(new RoundedBoxGeometry(Math.max(0.02, l), Math.max(0.02, a), Math.max(0.02, h), 3, r), material));
};

export const cilindro = (r1: number, h: number, material: THREE.Material | THREE.Material[], r2 = r1, segmentos = 32): THREE.Mesh => {
  const g = new THREE.CylinderGeometry(Math.max(0.01, r2), Math.max(0.01, r1), Math.max(0.01, h), segmentos);
  g.rotateX(Math.PI / 2);
  return sombrear(new THREE.Mesh(g, material));
};

export const tubo = (curva: THREE.Curve<THREE.Vector3>, raio: number, material: THREE.Material, segmentos = 48): THREE.Mesh =>
  sombrear(new THREE.Mesh(new THREE.TubeGeometry(curva, segmentos, raio, 8, false), material));

export const em = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T => {
  o.position.set(x, y, z);
  return o;
};

const canvas = (l: number, a: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const c = document.createElement('canvas');
  c.width = l;
  c.height = a;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas');
  return [c, g];
};

export const texturaDe = (c: HTMLCanvasElement, renderer?: THREE.WebGLRenderer): THREE.CanvasTexture => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (renderer) t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
};

export interface OpcoesTapete {
  readonly largura: number;
  readonly altura: number;
  readonly cor: string;
  readonly linha: string;
  readonly forte: string;
  readonly reguas?: boolean;
}

export const tapete = (o: OpcoesTapete, renderer: THREE.WebGLRenderer): THREE.Mesh => {
  const px = Math.min(4, 2048 / Math.max(o.largura, o.altura));
  const [c, g] = canvas(Math.round(o.largura * px), Math.round(o.altura * px));
  g.fillStyle = o.cor;
  g.fillRect(0, 0, c.width, c.height);
  for (let mm = 0; mm <= Math.max(o.largura, o.altura); mm += 10) {
    const forte = mm % 50 === 0;
    g.strokeStyle = forte ? o.forte : o.linha;
    g.lineWidth = forte ? 1.6 : 0.8;
    g.beginPath();
    if (mm <= o.largura) {
      g.moveTo(mm * px, 0);
      g.lineTo(mm * px, c.height);
    }
    if (mm <= o.altura) {
      g.moveTo(0, mm * px);
      g.lineTo(c.width, mm * px);
    }
    g.stroke();
  }
  if (o.reguas) {
    g.fillStyle = o.forte;
    g.font = `${Math.round(3.2 * px)}px ui-monospace, monospace`;
    for (let mm = 50; mm < o.largura; mm += 50) g.fillText(String(mm / 10), mm * px + 4, c.height - 4 * px);
    for (let mm = 50; mm < o.altura; mm += 50) g.fillText(String(mm / 10), 4, c.height - mm * px - 4);
  }
  const topo = new THREE.MeshStandardMaterial({ map: texturaDe(c, renderer), roughness: 0.92, metalness: 0 });
  const lado = cor(o.cor, 0, 0.9);
  const m = new THREE.Mesh(new THREE.BoxGeometry(o.largura, o.altura, 2), [lado, lado, lado, lado, topo, lado]);
  m.position.z = -1;
  m.receiveShadow = true;
  return m;
};

export const tapeteAntiestatico = (l: number, a: number): THREE.Group => {
  const g = new THREE.Group();
  g.add(em(arredondada(l, a, 4, 3, cor('#1c1d20', 0, 0.86)), 0, 0, 2));
  g.add(em(arredondada(l - 8, a - 8, 0.4, 2, cor('#26282c', 0, 0.7)), 0, 0, 4.1));
  return g;
};

export const bandeja = (l: number, a: number): THREE.Group => {
  const g = new THREE.Group();
  const creme = cor('#efe5d3', 0, 0.62);
  const fundo = cor('#f6efe3', 0, 0.7);
  g.add(em(arredondada(l, a, 3, 6, creme), 0, 0, 1.5));
  g.add(em(arredondada(l - 10, a - 10, 0.5, 4, fundo), 0, 0, 3.1));
  const parede = 5;
  const alto = 9;
  g.add(em(arredondada(l, parede, alto, 2.4, creme), 0, a / 2 - parede / 2, alto / 2));
  g.add(em(arredondada(l, parede, alto, 2.4, creme), 0, -a / 2 + parede / 2, alto / 2));
  g.add(em(arredondada(parede, a, alto, 2.4, creme), l / 2 - parede / 2, 0, alto / 2));
  g.add(em(arredondada(parede, a, alto, 2.4, creme), -l / 2 + parede / 2, 0, alto / 2));
  return g;
};

export const carretel = (): THREE.Group => {
  const g = new THREE.Group();
  const branco = cor('#f3efe6', 0, 0.5);
  g.add(em(cilindro(30, 4, branco), 0, 0, 2));
  g.add(em(cilindro(30, 4, branco), 0, 0, 36));
  g.add(em(cilindro(9, 34, cor('#d9d4ca', 0, 0.6)), 0, 0, 19));
  const fio = cor('#c9ccd1', 0.95, 0.32);
  for (let i = 0; i < 7; i++) {
    const anel = new THREE.Mesh(new THREE.TorusGeometry(22, 2.4, 10, 48), fio);
    anel.position.z = 7 + i * 4.3;
    anel.castShadow = true;
    g.add(anel);
  }
  const ponta = new THREE.CatmullRomCurve3([new THREE.Vector3(22, 0, 34), new THREE.Vector3(40, -14, 18), new THREE.Vector3(70, -10, 1.5), new THREE.Vector3(120, -40, 1.5)]);
  g.add(tubo(ponta, 0.8, fio, 64));
  return g;
};

const ponteira = (corCabo: string): THREE.Group => {
  const g = new THREE.Group();
  const material = cor(corCabo, 0, 0.45);
  const corpo = cilindro(5.5, 62, material, 4.6);
  corpo.rotation.y = Math.PI / 2;
  g.add(em(corpo, 31, 0, 6));
  const anel = cilindro(7.5, 5, material);
  anel.rotation.y = Math.PI / 2;
  g.add(em(anel, 63, 0, 6));
  const capa = cilindro(4.2, 30, material, 3.2);
  capa.rotation.y = Math.PI / 2;
  g.add(em(capa, 80, 0, 6));
  const agulha = cilindro(0.9, 16, cor('#d2d5da', 1, 0.28), 0.2, 12);
  agulha.rotation.y = Math.PI / 2;
  g.add(em(agulha, 103, 0, 6));
  const cabo = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 6), new THREE.Vector3(-40, 8, 3), new THREE.Vector3(-110, 30, 2), new THREE.Vector3(-220, 20, 2)]);
  g.add(tubo(cabo, 2.2, material, 48));
  return g;
};

export const pontasMultimetro = (): THREE.Group => {
  const g = new THREE.Group();
  const vermelha = ponteira('#c8342b');
  vermelha.rotation.z = 0.1;
  const preta = ponteira('#2a2a2d');
  preta.position.set(-6, 22, 0);
  preta.rotation.z = 0.18;
  g.add(vermelha, preta);
  return g;
};

export const ferroDeSolda = (): { grupo: THREE.Group; ponta: THREE.Mesh; brilho: THREE.PointLight } => {
  const grupo = new THREE.Group();
  const eixo = new THREE.Group();
  const aco = cor('#cfd3d8', 1, 0.3);
  const ponta = cilindro(1.6, 14, cor('#9aa0a6', 1, 0.35), 0.35, 16);
  ponta.rotation.y = Math.PI / 2;
  eixo.add(em(ponta, 7, 0, 0));
  const haste = cilindro(2.4, 34, aco);
  haste.rotation.y = Math.PI / 2;
  eixo.add(em(haste, 31, 0, 0));
  const cortica = cilindro(6.4, 26, cor('#c99a5b', 0, 0.82), 5.4);
  cortica.rotation.y = Math.PI / 2;
  eixo.add(em(cortica, 60, 0, 0));
  const empunhadura = cilindro(7.2, 56, cor('#2f66c8', 0, 0.42), 6.6);
  empunhadura.rotation.y = Math.PI / 2;
  eixo.add(em(empunhadura, 101, 0, 0));
  const fim = cilindro(4.2, 12, cor('#25282e', 0, 0.5), 6.4);
  fim.rotation.y = Math.PI / 2;
  eixo.add(em(fim, 135, 0, 0));
  const cabo = new THREE.CatmullRomCurve3([new THREE.Vector3(140, 0, 0), new THREE.Vector3(190, 0, 6), new THREE.Vector3(260, 30, 40), new THREE.Vector3(380, 60, 30)]);
  eixo.add(tubo(cabo, 3, cor('#3b3e44', 0, 0.6), 48));
  eixo.rotation.y = -0.62;
  grupo.add(eixo);
  const brilho = new THREE.PointLight('#ff8a3d', 0, 60, 2);
  grupo.add(brilho);
  return { grupo, ponta, brilho };
};

export interface Fio3d {
  readonly grupo: THREE.Group;
  readonly material: THREE.MeshStandardMaterial;
  readonly atualizar: (a: THREE.Vector3, b: THREE.Vector3) => void;
  readonly descartar: () => void;
}

export const COR_FIO: Record<string, string> = {
  vermelho: '#d23a2c',
  preto: '#1f1f22',
  amarelo: '#f2c230',
  verde: '#2f9e55',
  azul: '#2d6fd6',
  laranja: '#ee7d2a',
  branco: '#eeeeea',
  roxo: '#8a4fd0',
};

export const fio3d = (corFio: string): Fio3d => {
  const grupo = new THREE.Group();
  const material = cor(corFio, 0, 0.4);
  const capa = cor('#18181a', 0, 0.55);
  const pontaA = caixa(2.6, 2.6, 13, capa);
  const pontaB = caixa(2.6, 2.6, 13, capa);
  let corpo: THREE.Mesh | null = null;
  grupo.add(pontaA, pontaB);
  const atualizar = (a: THREE.Vector3, b: THREE.Vector3): void => {
    const d = a.distanceTo(b);
    const alto = 14 + d * 0.32;
    const curva = new THREE.CubicBezierCurve3(
      a.clone().add(new THREE.Vector3(0, 0, 13)),
      a.clone().add(new THREE.Vector3(0, 0, 13 + alto)),
      b.clone().add(new THREE.Vector3(0, 0, 13 + alto)),
      b.clone().add(new THREE.Vector3(0, 0, 13)),
    );
    if (corpo) {
      grupo.remove(corpo);
      corpo.geometry.dispose();
    }
    corpo = tubo(curva, 0.75, material, Math.max(24, Math.round(d / 3)));
    grupo.add(corpo);
    pontaA.position.set(a.x, a.y, a.z + 6.5);
    pontaB.position.set(b.x, b.y, b.z + 6.5);
  };
  return {
    grupo,
    material,
    atualizar,
    descartar: () => {
      corpo?.geometry.dispose();
      pontaA.geometry.dispose();
      pontaB.geometry.dispose();
      material.dispose();
      capa.dispose();
    },
  };
};

export const marcadorPulsante = (l: number, a: number): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(l, a), new THREE.MeshBasicMaterial({ color: '#e4572e', transparent: true, opacity: 0.45, depthWrite: false }));
  m.renderOrder = 5;
  return m;
};

export const texturaTexto = (linhas: readonly string[], l: number, a: number, fundo: string, frente: string, renderer?: THREE.WebGLRenderer): THREE.CanvasTexture => {
  const [c, g] = canvas(l, a);
  g.fillStyle = fundo;
  g.fillRect(0, 0, l, a);
  g.fillStyle = frente;
  const tamanho = Math.floor(a / Math.max(4, linhas.length + 1));
  g.font = `600 ${tamanho}px ui-monospace, monospace`;
  g.textBaseline = 'top';
  linhas.forEach((linha, i) => g.fillText(linha, tamanho * 0.4, tamanho * 0.5 + i * tamanho * 1.15, l - tamanho * 0.8));
  return texturaDe(c, renderer);
};
