import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Footprint, ProjetoPcb } from '../../pcb/modelo';
import { COR_COBRE, corAcabamento, gradeFurosCanvas, listrasCanvas, luminancia, malhaCanvas, misturar, rotuloCanvas, submoduloCanvas, tampaCapacitorCanvas } from './texturas';

export interface Materiais {
  readonly epoxi: THREE.MeshStandardMaterial;
  readonly plastico: THREE.MeshStandardMaterial;
  readonly metal: THREE.MeshStandardMaterial;
  readonly aluminio: THREE.MeshStandardMaterial;
  readonly ouro: THREE.MeshStandardMaterial;
  readonly estanho: THREE.MeshStandardMaterial;
  readonly ceramica: THREE.MeshStandardMaterial;
  readonly branco: THREE.MeshStandardMaterial;
  readonly vidro: THREE.MeshPhysicalMaterial;
  readonly escuro: THREE.MeshStandardMaterial;
  readonly substrato: THREE.MeshStandardMaterial;
  readonly fita: THREE.MeshStandardMaterial;
  readonly borracha: THREE.MeshStandardMaterial;
  readonly fr4: THREE.MeshStandardMaterial;
}

export class Fabrica {
  readonly m: Materiais;
  private readonly descartaveis: { dispose: () => void }[] = [];
  private readonly cacheCor = new Map<string, THREE.MeshStandardMaterial>();
  private readonly cacheTextura = new Map<string, THREE.CanvasTexture>();

  constructor(
    private readonly projeto: ProjetoPcb,
    private readonly anisotropia: number,
  ) {
    const std = (cor: string, metalness: number, roughness: number): THREE.MeshStandardMaterial => this.guardar(new THREE.MeshStandardMaterial({ color: cor, metalness, roughness }));
    const metalAcabamento = corAcabamento(projeto);
    this.m = {
      epoxi: std('#141416', 0, 0.55),
      plastico: std('#1a1a1c', 0, 0.62),
      metal: std('#d4d7db', 1, 0.3),
      aluminio: std('#b7bcc2', 0.85, 0.42),
      ouro: std('#e0bb5e', 1, 0.26),
      estanho: std(metalAcabamento === '#d8b55c' ? '#d6d8db' : '#cfd2d6', 1, 0.34),
      ceramica: std('#b9956a', 0, 0.62),
      branco: std('#f1f1ef', 0, 0.42),
      vidro: this.guardar(new THREE.MeshPhysicalMaterial({ color: '#04060a', metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, reflectivity: 0.6 })),
      escuro: std('#050506', 0, 0.8),
      substrato: std('#203a2c', 0, 0.55),
      fita: std('#c98e3c', 0.1, 0.5),
      borracha: std('#131313', 0, 0.85),
      fr4: std('#b4a46e', 0, 0.8),
    };
  }

  guardar<T extends { dispose: () => void }>(item: T): T {
    this.descartaveis.push(item);
    return item;
  }

  cor(c: string, metalness = 0, roughness = 0.5): THREE.MeshStandardMaterial {
    const chave = `${c}:${metalness}:${roughness}`;
    const existente = this.cacheCor.get(chave);
    if (existente) return existente;
    const novo = this.guardar(new THREE.MeshStandardMaterial({ color: c, metalness, roughness }));
    this.cacheCor.set(chave, novo);
    return novo;
  }

  textura(chave: string, gerar: () => HTMLCanvasElement): THREE.CanvasTexture {
    const existente = this.cacheTextura.get(chave);
    if (existente) return existente;
    const t = this.guardar(new THREE.CanvasTexture(gerar()));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.anisotropia;
    this.cacheTextura.set(chave, t);
    return t;
  }

  caixa(l: number, a: number, h: number, material: THREE.Material | THREE.Material[]): THREE.Mesh {
    const g = this.guardar(new THREE.BoxGeometry(Math.max(0.01, l), Math.max(0.01, a), Math.max(0.01, h)));
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  arredondada(l: number, a: number, h: number, raio: number, material: THREE.Material): THREE.Mesh {
    const r = Math.max(0.01, Math.min(raio, l / 2 - 0.01, a / 2 - 0.01, h / 2 - 0.01));
    const g = this.guardar(new RoundedBoxGeometry(Math.max(0.02, l), Math.max(0.02, a), Math.max(0.02, h), 3, r));
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  cilindro(r: number, h: number, material: THREE.Material | THREE.Material[], segmentos = 32): THREE.Mesh {
    const g = this.guardar(new THREE.CylinderGeometry(Math.max(0.01, r), Math.max(0.01, r), Math.max(0.01, h), segmentos));
    g.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  rotulo(texto: string, cor: string, l: number, a: number): THREE.Mesh {
    const t = this.textura(`rot:${texto}:${cor}:${l.toFixed(1)}:${a.toFixed(1)}`, () => rotuloCanvas(texto, cor, l, a));
    const material = this.guardar(new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6, metalness: 0, depthWrite: false }));
    const g = this.guardar(new THREE.PlaneGeometry(l, a));
    return new THREE.Mesh(g, material);
  }

  instancias(geo: THREE.BufferGeometry, material: THREE.Material, posicoes: readonly (readonly [number, number, number])[]): THREE.InstancedMesh {
    this.guardar(geo);
    const inst = new THREE.InstancedMesh(geo, material, Math.max(1, posicoes.length));
    const m = new THREE.Matrix4();
    posicoes.forEach(([x, y, z], i) => {
      m.makeTranslation(x, y, z);
      inst.setMatrixAt(i, m);
    });
    inst.count = posicoes.length;
    inst.castShadow = true;
    inst.receiveShadow = true;
    return inst;
  }

  descartar(): void {
    for (const d of this.descartaveis) d.dispose();
    this.descartaveis.length = 0;
    this.cacheCor.clear();
    this.cacheTextura.clear();
  }

  get acabamento(): string {
    return corAcabamento(this.projeto);
  }
}

const em = (obj: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D => {
  obj.position.set(x, y, z);
  return obj;
};

const direcaoSaida = (f: Footprint, p: ProjetoPcb): [number, number] => {
  const c = f.corpo;
  const distancias: [number, [number, number]][] = [
    [c.x, [-1, 0]],
    [p.largura - (c.x + c.l), [1, 0]],
    [c.y, [0, 1]],
    [p.altura - (c.y + c.a), [0, -1]],
  ];
  distancias.sort((a, b) => a[0] - b[0]);
  return distancias[0]?.[1] ?? [1, 0];
};

export const construirModelo = (f: Footprint, p: ProjetoPcb, fab: Fabrica): THREE.Group => {
  const g = new THREE.Group();
  const c = f.comp;
  const { l, a } = c;
  const z = Math.max(0.05, c.z);
  const cx = c.x + l / 2;
  const cy = -(c.y + a / 2);
  const menor = Math.min(l, a);
  const maior = Math.max(l, a);
  const horizontal = l >= a;
  const m = fab.m;
  const adicionar = (obj: THREE.Object3D, x = cx, y = cy, zz = 0): void => {
    g.add(em(obj, x, y, zz));
  };
  const rotuloTopo = (texto: string | undefined, cor: string, altura: number, escala = 0.82): void => {
    if (!texto) return;
    const r = fab.rotulo(texto, cor, l * escala, a * escala);
    adicionar(r, cx, cy, altura + 0.012);
  };
  const pernas = (largura: number, altura: number, zc: number, material: THREE.Material): void => {
    const posicoes = f.pads.filter((pd) => pd.numero !== 'EP').map((pd) => [pd.x, -pd.y, zc] as const);
    if (posicoes.length) g.add(fab.instancias(new THREE.BoxGeometry(largura, largura, altura), material, posicoes));
  };

  switch (f.modelo) {
    case 'qfn':
    case 'qfp':
    case 'soic':
    case 'sot': {
      const corpo = fab.caixa(l, a, z, m.epoxi);
      adicionar(corpo, cx, cy, z / 2);
      const primeiro = f.pads[0];
      const tamanhoPerna = primeiro ? Math.min(primeiro.l, primeiro.a) * 0.62 : 0.25;
      if (f.modelo !== 'qfn') pernas(tamanhoPerna, Math.min(0.35, z * 0.4), Math.min(0.35, z * 0.4) / 2, m.estanho);
      else pernas(tamanhoPerna, 0.12, 0.06, m.estanho);
      rotuloTopo(c.rotulo, '#b9b9b9', z, 0.78);
      const ponto = fab.cilindro(Math.max(0.12, menor * 0.05), 0.02, m.escuro, 16);
      adicionar(ponto, c.x + Math.max(0.35, menor * 0.12), -(c.y + Math.max(0.35, menor * 0.12)), z + 0.012);
      break;
    }
    case 'dip': {
      const corpo = fab.arredondada(l, a, z * 0.82, 0.25, m.epoxi);
      adicionar(corpo, cx, cy, z * 0.18 + (z * 0.82) / 2);
      pernas(0.5, z * 0.5, z * 0.25, m.estanho);
      rotuloTopo(c.rotulo, '#c7c7c7', z, 0.72);
      const entalhe = fab.cilindro(menor * 0.12, 0.03, m.escuro, 20);
      adicionar(entalhe, horizontal ? c.x + 0.6 : cx, horizontal ? cy : -(c.y + 0.6), z + 0.012);
      break;
    }
    case 'bga': {
      const base = fab.caixa(l, a, z * 0.3, m.substrato);
      adicionar(base, cx, cy, (z * 0.3) / 2);
      const tampa = fab.arredondada(l * 0.86, a * 0.86, z * 0.7, 0.3, m.metal);
      adicionar(tampa, cx, cy, z * 0.3 + (z * 0.7) / 2);
      rotuloTopo(c.rotulo, '#3c3f44', z, 0.6);
      break;
    }
    case 'blindagem': {
      const tampa = fab.caixa(l, a, z, m.metal);
      adicionar(tampa, cx, cy, z / 2);
      rotuloTopo(c.rotulo, '#4a4d52', z, 0.7);
      break;
    }
    case 'caixa': {
      const corpo = fab.arredondada(l, a, z, 0.4, fab.cor(c.cor ?? '#2563c9', 0, 0.45));
      adicionar(corpo, cx, cy, z / 2);
      rotuloTopo(c.rotulo, '#ffffff', z, 0.7);
      break;
    }
    case 'conector': {
      const plastico = c.cor !== undefined && luminancia(c.cor) < 0.3;
      const material = plastico ? fab.cor(c.cor ?? '#1a1a1a', 0, 0.6) : c.cor ? fab.cor(c.cor, 0.6, 0.35) : m.metal;
      const corpo = fab.caixa(l, a, z, material);
      adicionar(corpo, cx, cy, z / 2);
      const [dx, dy] = direcaoSaida(f, p);
      const boca = fab.caixa(dx ? 0.05 : l * 0.78, dy ? 0.05 : a * 0.78, z * 0.62, m.escuro);
      adicionar(boca, cx + (dx * l) / 2 + dx * 0.02, cy + (dy * a) / 2 + dy * 0.02, z / 2);
      const lingua = fab.caixa(dx ? Math.min(l * 0.6, 4) : l * 0.5, dy ? Math.min(a * 0.6, 4) : a * 0.5, z * 0.12, plastico ? m.ouro : m.plastico);
      adicionar(lingua, cx + (dx * l) / 2 - dx * Math.min(l * 0.3, 2), cy + (dy * a) / 2 - dy * Math.min(a * 0.3, 2), z / 2);
      if (c.rotulo && !plastico) rotuloTopo(c.rotulo, '#5a5d61', z, 0.6);
      break;
    }
    case 'botao': {
      const base = fab.caixa(l, a, z * 0.45, m.metal);
      adicionar(base, cx, cy, (z * 0.45) / 2);
      const atuador = fab.cilindro(menor * 0.3, z * 0.55, c.cor ? fab.cor(c.cor, 0, 0.5) : m.plastico, 28);
      adicionar(atuador, cx, cy, z * 0.45 + (z * 0.55) / 2);
      pernas(0.45, 0.25, 0.125, m.estanho);
      if (c.rotulo) rotuloTopo(c.rotulo, '#ffffff', z, 0.5);
      break;
    }
    case 'led-smd': {
      const base = fab.caixa(l, a, z * 0.55, m.branco);
      adicionar(base, cx, cy, (z * 0.55) / 2);
      const corLed = c.cor ?? '#ff4d3d';
      const lente = fab.guardar(new THREE.MeshStandardMaterial({ color: corLed, emissive: corLed, emissiveIntensity: 0.9, roughness: 0.2, transparent: true, opacity: 0.92 }));
      const topo = fab.caixa(l * 0.86, a * 0.86, z * 0.45, lente);
      adicionar(topo, cx, cy, z * 0.55 + (z * 0.45) / 2);
      break;
    }
    case 'led-tht': {
      const corLed = c.cor ?? '#ff3b30';
      const lente = fab.guardar(new THREE.MeshPhysicalMaterial({ color: corLed, emissive: corLed, emissiveIntensity: 0.55, roughness: 0.15, transmission: 0.2, transparent: true, opacity: 0.88, clearcoat: 1 }));
      const r = menor * 0.45;
      const corpo = fab.cilindro(r, z - r, lente, 32);
      adicionar(corpo, cx, cy, (z - r) / 2 + 0.3);
      const cupula = new THREE.Mesh(fab.guardar(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)), lente);
      cupula.rotation.x = Math.PI / 2;
      adicionar(cupula, cx, cy, z - r + 0.3);
      const aba = fab.cilindro(r * 1.12, 0.6, lente, 32);
      adicionar(aba, cx, cy, 0.6);
      break;
    }
    case 'barra': {
      const corpo = fab.caixa(l, a, Math.min(z, 2.5), m.plastico);
      adicionar(corpo, cx, cy, Math.min(z, 2.5) / 2);
      const alto = Math.min(z, 2.5) + 6;
      const posicoes = f.pads.map((pd) => [pd.x, -pd.y, alto / 2] as const);
      g.add(fab.instancias(new THREE.BoxGeometry(0.64, 0.64, alto), m.ouro, posicoes));
      break;
    }
    case 'femea': {
      const cols = Math.max(1, Math.round(l / 2.54));
      const linhas = Math.max(1, Math.round(a / 2.54));
      const topo = fab.guardar(new THREE.MeshStandardMaterial({ map: fab.textura(`furos:${cols}:${linhas}`, () => gradeFurosCanvas(cols, linhas)), roughness: 0.6 }));
      const corpo = fab.caixa(l, a, z, [m.plastico, m.plastico, m.plastico, m.plastico, topo, m.plastico]);
      adicionar(corpo, cx, cy, z / 2);
      break;
    }
    case 'slot': {
      const corpo = fab.caixa(l, a, z, m.plastico);
      adicionar(corpo, cx, cy, z / 2);
      const ranhura = fab.caixa(horizontal ? l * 0.94 : a * 0.28, horizontal ? a * 0.28 : l * 0.94, 0.04, m.escuro);
      if (!horizontal) ranhura.rotation.z = Math.PI / 2;
      adicionar(ranhura, cx, cy, z + 0.02);
      const travaA = fab.caixa(horizontal ? 2.4 : l * 1.1, horizontal ? a * 1.1 : 2.4, z + 1.6, m.branco);
      const travaB = fab.caixa(horizontal ? 2.4 : l * 1.1, horizontal ? a * 1.1 : 2.4, z + 1.6, m.branco);
      adicionar(travaA, horizontal ? c.x + 1.2 : cx, horizontal ? cy : -(c.y + 1.2), (z + 1.6) / 2);
      adicionar(travaB, horizontal ? c.x + l - 1.2 : cx, horizontal ? cy : -(c.y + a - 1.2), (z + 1.6) / 2);
      if (c.rotulo) {
        const r = fab.rotulo(c.rotulo, '#8a8a8a', horizontal ? Math.min(l * 0.3, 40) : a * 0.25, horizontal ? a * 0.9 : Math.min(l * 0.9, 6));
        if (!horizontal) r.rotation.z = Math.PI / 2;
        adicionar(r, horizontal ? c.x + l * 0.2 : cx, horizontal ? cy : -(c.y + a * 0.2), z + 0.05);
      }
      break;
    }
    case 'eletrolitico': {
      const r = menor / 2;
      const manga = c.cor ?? '#1c2f6e';
      const lado = fab.guardar(new THREE.MeshStandardMaterial({ map: fab.textura(`manga:${manga}`, () => listrasCanvas(manga, [[0.08, 0.2, '#c9ccd1']])), roughness: 0.45 }));
      const tampa = fab.guardar(new THREE.MeshStandardMaterial({ map: fab.textura('tampa', tampaCapacitorCanvas), metalness: 0.8, roughness: 0.35 }));
      const corpo = fab.cilindro(r, z, [lado, tampa, m.plastico], 40);
      adicionar(corpo, cx, cy, z / 2);
      if (c.rotulo) {
        const rot = fab.rotulo(c.rotulo, '#e5e5e5', r * 1.1, r * 0.5);
        adicionar(rot, cx, cy - r * 0.55, z + 0.02);
      }
      break;
    }
    case 'mlcc': {
      const corpo = fab.caixa(l, a, z, m.ceramica);
      adicionar(corpo, cx, cy, z / 2);
      const ponta = horizontal ? l * 0.2 : a * 0.2;
      for (const s of [-1, 1]) {
        const tampa = fab.caixa(horizontal ? ponta : l * 1.02, horizontal ? a * 1.02 : ponta, z * 1.02, m.estanho);
        adicionar(tampa, cx + (horizontal ? s * (l / 2 - ponta / 2) : 0), cy + (horizontal ? 0 : s * (a / 2 - ponta / 2)), z / 2);
      }
      if (c.rotulo) rotuloTopo(c.rotulo, '#3a2a1a', z, 0.55);
      break;
    }
    case 'resistor-smd':
    case 'indutor': {
      const corpo = f.modelo === 'indutor' ? fab.arredondada(l, a, z, Math.min(l, a) * 0.15, fab.cor('#2d2d30', 0, 0.75)) : fab.caixa(l, a, z, m.epoxi);
      adicionar(corpo, cx, cy, z / 2);
      if (f.modelo === 'resistor-smd') {
        const ponta = maior * 0.18;
        for (const s of [-1, 1]) {
          const tampa = fab.caixa(horizontal ? ponta : l * 1.02, horizontal ? a * 1.02 : ponta, z * 1.02, m.estanho);
          adicionar(tampa, cx + (horizontal ? s * (l / 2 - ponta / 2) : 0), cy + (horizontal ? 0 : s * (a / 2 - ponta / 2)), z / 2);
        }
      }
      rotuloTopo(c.rotulo ?? (f.modelo === 'indutor' ? '101' : '103'), '#e8e8e8', z, 0.6);
      break;
    }
    case 'resistor-tht':
    case 'diodo-tht': {
      const r = Math.min(menor * 0.45, z / 2);
      const comprimento = maior * 0.7;
      const corpoCor = f.modelo === 'diodo-tht' ? '#141414' : '#d6c08f';
      const faixas: [number, number, string][] = f.modelo === 'diodo-tht' ? [[0.78, 0.9, '#c9ccd1']] : [[0.18, 0.26, '#6b3a1c'], [0.32, 0.4, '#111111'], [0.46, 0.54, '#c0392b'], [0.74, 0.8, '#c9a227']];
      const textura = fab.textura(`faixas:${f.modelo}`, () => listrasCanvas(corpoCor, faixas));
      const material = fab.guardar(new THREE.MeshStandardMaterial({ map: textura, roughness: 0.5 }));
      const geo = fab.guardar(new THREE.CapsuleGeometry(r, Math.max(0.1, comprimento - 2 * r), 8, 24));
      const corpo = new THREE.Mesh(geo, material);
      corpo.castShadow = true;
      corpo.rotation.z = horizontal ? Math.PI / 2 : 0;
      adicionar(corpo, cx, cy, r + 0.4);
      for (const pd of f.pads) {
        const perna = fab.cilindro(0.3, r + 0.4, m.estanho, 10);
        adicionar(perna, pd.x, -pd.y, (r + 0.4) / 2);
      }
      const fio = fab.cilindro(0.3, maior + 1.4, m.estanho, 10);
      fio.rotation.set(horizontal ? 0 : Math.PI / 2, horizontal ? Math.PI / 2 : 0, 0);
      adicionar(fio, cx, cy, r + 0.4);
      break;
    }
    case 'diodo-smd': {
      const corpo = fab.caixa(l, a, z, m.epoxi);
      adicionar(corpo, cx, cy, z / 2);
      const faixa = fab.caixa(horizontal ? l * 0.1 : l * 0.95, horizontal ? a * 0.95 : a * 0.1, 0.03, fab.cor('#c9ccd1', 0.3, 0.4));
      adicionar(faixa, horizontal ? c.x + l * 0.82 : cx, horizontal ? cy : -(c.y + a * 0.82), z + 0.015);
      if (c.rotulo) rotuloTopo(c.rotulo, '#bdbdbd', z, 0.55);
      break;
    }
    case 'cristal': {
      if (z >= 2.5) {
        const lata = fab.arredondada(l, a, z, menor * 0.48, m.metal);
        adicionar(lata, cx, cy, z / 2);
      } else {
        const base = fab.caixa(l, a, z * 0.35, m.ceramica);
        adicionar(base, cx, cy, (z * 0.35) / 2);
        const tampa = fab.caixa(l * 0.9, a * 0.9, z * 0.65, m.metal);
        adicionar(tampa, cx, cy, z * 0.35 + (z * 0.65) / 2);
      }
      rotuloTopo(c.rotulo, '#43464a', z, 0.7);
      break;
    }
    case 'dissipador': {
      const base = Math.min(1.6, z * 0.2);
      const placa = fab.caixa(l, a, base, m.aluminio);
      adicionar(placa, cx, cy, base / 2);
      const n = Math.max(3, Math.floor(maior / 1.8));
      const passo = maior / n;
      const posicoes: [number, number, number][] = [];
      for (let i = 0; i < n; i++) {
        const t = -maior / 2 + passo * (i + 0.5);
        posicoes.push(horizontal ? [cx + t, cy, base + (z - base) / 2] : [cx, cy + t, base + (z - base) / 2]);
      }
      g.add(fab.instancias(new THREE.BoxGeometry(horizontal ? Math.min(0.7, passo * 0.45) : l, horizontal ? a : Math.min(0.7, passo * 0.45), z - base), m.aluminio, posicoes));
      if (c.rotulo) {
        const r = fab.rotulo(c.rotulo, '#ffffff', Math.min(l * 0.7, 30), Math.min(a * 0.5, 8));
        adicionar(r, cx, cy, z + 0.05);
      }
      break;
    }
    case 'bateria': {
      const suporte = fab.caixa(l * 1.04, a * 1.04, z * 0.4, m.plastico);
      adicionar(suporte, cx, cy, (z * 0.4) / 2);
      const celula = fab.cilindro(menor / 2, z * 0.6, m.metal, 40);
      adicionar(celula, cx, cy, z * 0.4 + (z * 0.6) / 2);
      const mais = fab.rotulo('CR2032 +', '#5a5d61', menor * 0.8, menor * 0.35);
      adicionar(mais, cx, cy, z + 0.02);
      break;
    }
    case 'borne': {
      const corpo = fab.caixa(l, a, z, fab.cor(c.cor ?? '#1f5fbf', 0, 0.45));
      adicionar(corpo, cx, cy, z / 2);
      for (const pd of f.pads) {
        const parafuso = fab.cilindro(Math.min(menor, 5.08) * 0.28, 0.4, m.metal, 24);
        adicionar(parafuso, pd.x, -pd.y, z + 0.2);
        const fenda = fab.caixa(Math.min(menor, 5.08) * 0.5, 0.25, 0.1, m.escuro);
        adicionar(fenda, pd.x, -pd.y, z + 0.42);
      }
      break;
    }
    case 'trimpot': {
      const corpo = fab.caixa(l, a, z, fab.cor(c.cor ?? '#2b6cc4', 0, 0.45));
      adicionar(corpo, cx, cy, z / 2);
      const rotor = fab.cilindro(menor * 0.32, 0.5, m.branco, 28);
      adicionar(rotor, cx, cy, z + 0.25);
      const fenda = fab.caixa(menor * 0.5, 0.25, 0.08, m.escuro);
      adicionar(fenda, cx, cy, z + 0.52);
      break;
    }
    case 'soquete': {
      const espessura = Math.max(2, menor * 0.1);
      const borda = (bl: number, ba: number, x: number, y: number, h: number, mat: THREE.Material): void => adicionar(fab.caixa(bl, ba, h, mat), x, y, h / 2);
      borda(l, espessura, cx, -(c.y + espessura / 2), z * 0.6, m.plastico);
      borda(l, espessura, cx, -(c.y + a - espessura / 2), z * 0.6, m.plastico);
      borda(espessura, a, c.x + espessura / 2, cy, z * 0.6, m.plastico);
      borda(espessura, a, c.x + l - espessura / 2, cy, z * 0.6, m.plastico);
      borda(l * 1.02, espessura * 0.6, cx, -(c.y + espessura * 0.3), z, m.metal);
      borda(l * 1.02, espessura * 0.6, cx, -(c.y + a - espessura * 0.3), z, m.metal);
      const alavanca = fab.cilindro(0.7, a * 1.08, m.metal, 12);
      alavanca.rotation.set(Math.PI / 2, 0, 0);
      adicionar(alavanca, c.x - 1.6, cy, z * 0.4);
      break;
    }
    case 'ventoinha': {
      const moldura = fab.caixa(l, a, z * 0.3, m.plastico);
      adicionar(moldura, cx, cy, z * 0.15);
      const cubo = fab.cilindro(menor * 0.18, z, m.plastico, 24);
      adicionar(cubo, cx, cy, z / 2);
      break;
    }
    case 'transformador': {
      const nucleo = fab.caixa(l, a, z, fab.cor('#7b7f86', 0.7, 0.5));
      adicionar(nucleo, cx, cy, z / 2);
      const bobina = fab.caixa(horizontal ? l * 0.56 : l * 1.06, horizontal ? a * 1.06 : a * 0.56, z * 0.86, fab.cor('#e2c04a', 0, 0.5));
      adicionar(bobina, cx, cy, (z * 0.86) / 2 + z * 0.07);
      rotuloTopo(c.rotulo, '#3a3010', z, 0.4);
      break;
    }
    case 'camera': {
      const base = fab.caixa(l, a, z * 0.3, m.plastico);
      adicionar(base, cx, cy, z * 0.15);
      const cano = fab.cilindro(menor * 0.38, z * 0.7, m.plastico, 32);
      adicionar(cano, cx, cy, z * 0.3 + z * 0.35);
      const lente = fab.cilindro(menor * 0.25, 0.1, m.vidro, 32);
      adicionar(lente, cx, cy, z + 0.05);
      const reflexo = fab.cilindro(menor * 0.08, 0.12, fab.guardar(new THREE.MeshStandardMaterial({ color: '#2a5bd8', emissive: '#1b3a8a', emissiveIntensity: 0.6, roughness: 0.1 })), 16);
      adicionar(reflexo, cx - menor * 0.06, cy + menor * 0.06, z + 0.08);
      break;
    }
    case 'tela': {
      const moldura = fab.caixa(l, a, z * 0.5, m.plastico);
      adicionar(moldura, cx, cy, z * 0.25);
      const vidro = fab.caixa(l * 0.98, a * 0.96, z * 0.5, m.vidro);
      adicionar(vidro, cx, cy, z * 0.75);
      break;
    }
    case 'chave': {
      const corpo = fab.caixa(l, a, z * 0.7, m.metal);
      adicionar(corpo, cx, cy, z * 0.35);
      const alavanca = fab.caixa(horizontal ? l * 0.3 : l * 0.5, horizontal ? a * 0.5 : a * 0.3, z * 0.3, m.plastico);
      adicionar(alavanca, cx, cy, z * 0.85);
      break;
    }
    case 'transdutor': {
      const lata = fab.cilindro(menor / 2, z, [m.metal, fab.guardar(new THREE.MeshStandardMaterial({ map: fab.textura('malha', malhaCanvas), metalness: 0.6, roughness: 0.5 })), m.metal], 48);
      adicionar(lata, cx, cy, z / 2);
      if (c.rotulo) {
        const r = fab.rotulo(c.rotulo, '#111111', menor * 0.3, menor * 0.3);
        adicionar(r, cx + menor * 0.32, cy - menor * 0.32, z + 0.02);
      }
      break;
    }
    case 'submodulo': {
      const cor = c.cor ?? '#1c2533';
      const topo = fab.guardar(new THREE.MeshStandardMaterial({ map: fab.textura(`sub:${cor}:${l}:${a}`, () => submoduloCanvas(cor, fab.acabamento, l, a)), roughness: 0.42 }));
      const placa = fab.caixa(l, a, z, [m.fr4, m.fr4, m.fr4, m.fr4, topo, m.fr4]);
      adicionar(placa, cx, cy, z / 2);
      if (c.rotulo) rotuloTopo(c.rotulo, '#e8e8e8', z, 0.5);
      break;
    }
    case 'fpc': {
      const tira = fab.caixa(l, a, Math.max(0.15, z), c.cor ? fab.cor(c.cor, 0.1, 0.5) : m.fita);
      adicionar(tira, cx, cy, Math.max(0.15, z) / 2);
      break;
    }
    case 'cabo': {
      const n = 6;
      const r = Math.min(menor / (n + 1), z / 2);
      for (let i = 0; i < n; i++) {
        const fio = fab.cilindro(r, maior, m.borracha, 14);
        fio.rotation.set(horizontal ? 0 : Math.PI / 2, horizontal ? Math.PI / 2 : 0, 0);
        const desloc = -menor / 2 + r + (i * (menor - 2 * r)) / (n - 1);
        adicionar(fio, horizontal ? cx : cx + desloc, horizontal ? cy + desloc : cy, r + (i % 2) * r * 0.8);
      }
      break;
    }
    case 'antena': {
      const antena = p.antenas.find((x) => x.area.x === c.x && x.area.y === c.y);
      if (!antena || !antena.elevada) break;
      const pxmm = 24;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(l * pxmm);
      canvas.height = Math.round(a * pxmm);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(pxmm, pxmm);
        ctx.translate(-c.x, -c.y);
        ctx.strokeStyle = misturar('#1c2533', COR_COBRE, 0.32);
        ctx.lineWidth = antena.largura;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        antena.pontos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      const t = fab.guardar(new THREE.CanvasTexture(canvas));
      t.colorSpace = THREE.SRGBColorSpace;
      const plano = new THREE.Mesh(fab.guardar(new THREE.PlaneGeometry(l, a)), fab.guardar(new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.4, depthWrite: false })));
      adicionar(plano, cx, cy, antena.elevada + 0.015);
      break;
    }
    case 'pads':
    case 'texto':
      break;
  }
  g.userData = { fp: f.indice, parte: f.parte, altura: z };
  return g;
};
