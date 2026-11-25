import * as THREE from 'three';
import type { ModuloBancada, TipoModulo } from '../../dados/bancada3d';
import type { Saidas } from '../../app/circuito';
import { arredondada, caixa, cilindro, cor, em, texturaTexto } from './objetos';

export interface Modulo3d {
  readonly grupo: THREE.Group;
  readonly pinos: ReadonlyMap<string, THREE.Vector3>;
  readonly aplicar: (s: Saidas | null, entradas: { botao: boolean; pot: number }) => void;
}

const COR_PCB: Record<TipoModulo, string> = {
  led: '#1d1e22',
  rgb: '#b3322b',
  buzzer: '#b3322b',
  oled: '#1d4fa0',
  botao: '#1d4fa0',
  pot: '#1d4fa0',
  hcsr04: '#1d5bb3',
  dht11: '#1d4fa0',
  ldr: '#1d4fa0',
  servo: '#1d1e22',
  motor: '#b3322b',
};

const ESPESSURA = 1.6;
const PINO_ALTO = 8.5;

const brilhante = (c: string): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0, emissive: new THREE.Color(c), emissiveIntensity: 0, transparent: true, opacity: 0.92 });

export const construirModulo = (m: ModuloBancada, renderer: THREE.WebGLRenderer): Modulo3d => {
  const grupo = new THREE.Group();
  const L = m.largura;
  const P = m.profundidade;
  const pcb = arredondada(L, P, ESPESSURA, 0.8, cor(COR_PCB[m.tipo], 0, 0.55));
  pcb.position.z = ESPESSURA / 2;
  if (m.tipo !== 'servo') grupo.add(pcb);
  const pinos = new Map<string, THREE.Vector3>();
  const n = m.pinos.length;
  const yPinos = -P / 2 + 2.4;
  const plastico = cor('#141416', 0, 0.6);
  const ouro = cor('#e0bb5e', 1, 0.28);
  grupo.add(em(caixa(n * 2.54, 2.54, 2.5, plastico), 0, yPinos, ESPESSURA + 1.25));
  m.pinos.forEach((pino, i) => {
    const x = (i - (n - 1) / 2) * 2.54;
    grupo.add(em(caixa(0.64, 0.64, PINO_ALTO - ESPESSURA, ouro), x, yPinos, ESPESSURA + (PINO_ALTO - ESPESSURA) / 2));
    pinos.set(pino.nome, new THREE.Vector3(x, yPinos, PINO_ALTO));
  });
  const topo = ESPESSURA;
  let aplicar: Modulo3d['aplicar'] = () => undefined;

  switch (m.tipo) {
    case 'led':
    case 'rgb': {
      const material = brilhante(m.tipo === 'led' ? '#e8322b' : '#f4f2ee');
      const base = cilindro(2.9, 1, material);
      const corpo = cilindro(2.5, 5.4, material);
      const cupula = new THREE.Mesh(new THREE.SphereGeometry(2.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), material);
      cupula.rotation.x = Math.PI / 2;
      grupo.add(em(base, 0, 3, topo + 0.5), em(corpo, 0, 3, topo + 3.7), em(cupula, 0, 3, topo + 6.4));
      const luz = new THREE.PointLight(m.tipo === 'led' ? '#ff4433' : '#ffffff', 0, 40, 2);
      luz.position.set(0, 3, topo + 9);
      grupo.add(luz);
      aplicar = (s) => {
        if (m.tipo === 'led') {
          const k = s?.led ?? 0;
          material.emissiveIntensity = k * 2.2;
          luz.intensity = k * 120;
        } else {
          const [r, g, b] = s?.rgb ?? [0, 0, 0];
          const c = new THREE.Color(r / 255, g / 255, b / 255);
          material.emissive.copy(c);
          material.emissiveIntensity = s?.rgb ? 2 : 0;
          luz.color.copy(c);
          luz.intensity = s?.rgb ? 110 : 0;
        }
      };
      break;
    }
    case 'buzzer': {
      const corpo = cilindro(6, 9, cor('#141416', 0, 0.5));
      grupo.add(em(corpo, 0, 3, topo + 4.5));
      grupo.add(em(cilindro(1.1, 0.3, cor('#050506', 0, 0.9)), 0, 3, topo + 9.05));
      aplicar = (s) => {
        const f = s?.buzzer ?? 0;
        corpo.position.z = topo + 4.5 + (f ? Math.sin(performance.now() / 18) * 0.25 : 0);
      };
      break;
    }
    case 'oled': {
      const vidro = new THREE.MeshStandardMaterial({ color: '#050608', roughness: 0.08, metalness: 0.1 });
      const tela = caixa(25, 15, 1.2, [vidro, vidro, vidro, vidro, vidro, vidro]);
      grupo.add(em(tela, 0, 3.5, topo + 0.6));
      let ultimo = '';
      aplicar = (s) => {
        const linhas = s?.oled;
        const chave = linhas?.join('|') ?? '';
        if (chave === ultimo) return;
        ultimo = chave;
        const antigo = vidro.emissiveMap;
        if (linhas) {
          vidro.emissiveMap = texturaTexto(linhas, 256, 154, '#000000', '#9fe8ff', renderer);
          vidro.emissive = new THREE.Color('#ffffff');
          vidro.emissiveIntensity = 1.4;
          vidro.map = vidro.emissiveMap;
        } else {
          vidro.emissiveMap = null;
          vidro.map = null;
          vidro.emissiveIntensity = 0;
        }
        vidro.needsUpdate = true;
        antigo?.dispose();
      };
      break;
    }
    case 'botao': {
      grupo.add(em(caixa(6, 6, 3.4, cor('#1b1b1d', 0, 0.6)), 0, 3, topo + 1.7));
      const tampa = cilindro(1.8, 1.6, cor('#2a2a2e', 0, 0.45));
      grupo.add(em(tampa, 0, 3, topo + 4.1));
      tampa.userData.botao = true;
      aplicar = (_s, e) => {
        tampa.position.z = topo + (e.botao ? 3.5 : 4.1);
      };
      break;
    }
    case 'pot': {
      grupo.add(em(caixa(10, 10, 5, cor('#2d5fbf', 0, 0.5)), 0, 3, topo + 2.5));
      grupo.add(em(cilindro(3.4, 2.4, cor('#d8d8d6', 0.6, 0.4)), 0, 3, topo + 6.2));
      const botao = new THREE.Group();
      botao.add(em(cilindro(7.5, 8, cor('#202124', 0, 0.55)), 0, 0, 4));
      botao.add(em(caixa(1.2, 6, 0.4, cor('#f1efe9', 0, 0.5)), 0, 3, 8.2));
      botao.position.set(0, 3, topo + 7.4);
      grupo.add(botao);
      aplicar = (_s, e) => {
        botao.rotation.z = THREE.MathUtils.degToRad(135 - (e.pot / 1023) * 270);
      };
      break;
    }
    case 'hcsr04': {
      const metal = cor('#cfd3d8', 1, 0.32);
      const tela = cor('#2a2c30', 0.2, 0.8);
      for (const x of [-13, 13]) {
        grupo.add(em(cilindro(8, 12, metal), x, 2, topo + 6));
        grupo.add(em(cilindro(7, 0.4, tela), x, 2, topo + 12.1));
      }
      grupo.add(em(caixa(6, 3, 3, cor('#c9ced5', 1, 0.3)), 0, 6, topo + 1.5));
      break;
    }
    case 'dht11': {
      const azul = cor('#4a8fd6', 0, 0.5);
      grupo.add(em(caixa(12, 15.5, 5.5, azul), 0, 3.5, topo + 2.75));
      for (let i = 0; i < 4; i++) grupo.add(em(caixa(8, 1.2, 0.3, cor('#24507f', 0, 0.7)), 0, -0.8 + i * 3, topo + 5.6));
      break;
    }
    case 'ldr': {
      grupo.add(em(cilindro(2.6, 1.8, cor('#e2b04a', 0, 0.45)), 0, 3, topo + 3.4));
      grupo.add(em(caixa(3.6, 0.5, 0.1, cor('#8c3a1a', 0, 0.6)), 0, 3, topo + 4.35));
      break;
    }
    case 'servo': {
      const azul = cor('#2d63c8', 0, 0.45);
      grupo.add(em(caixa(23, 12.5, 22, azul), 0, 4, 11));
      grupo.add(em(caixa(32, 12.5, 2.4, azul), 0, 4, 16));
      grupo.add(em(cilindro(5.8, 4, azul), -5.8, 4, 24));
      const braco = new THREE.Group();
      braco.add(em(cilindro(3.5, 1.6, cor('#f3f1ec', 0, 0.5)), 0, 0, 0));
      braco.add(em(arredondada(16, 4, 1.6, 0.7, cor('#f3f1ec', 0, 0.5)), 7, 0, 0));
      braco.position.set(-5.8, 4, 26.8);
      grupo.add(braco);
      aplicar = (s) => {
        braco.rotation.z = THREE.MathUtils.degToRad((s?.servo ?? 90) - 90);
      };
      break;
    }
    case 'motor': {
      const amarelo = cor('#f2c230', 0, 0.45);
      grupo.add(em(caixa(52, 22, 18, amarelo), -6, 4, topo + 9));
      grupo.add(em(cilindro(10, 22, cor('#cfd3d8', 1, 0.35)), 28, 4, topo + 9));
      const roda = new THREE.Group();
      const pneu = new THREE.Mesh(new THREE.TorusGeometry(15, 5, 12, 32), cor('#1a1a1c', 0, 0.85));
      roda.add(pneu, cilindro(11, 6, amarelo));
      roda.rotation.x = Math.PI / 2;
      roda.position.set(-6, -13, topo + 9);
      const eixo = new THREE.Group();
      eixo.add(roda);
      grupo.add(eixo);
      aplicar = (s) => {
        if (s?.motor) roda.rotation.y += 0.25;
      };
      break;
    }
  }
  grupo.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { grupo, pinos, aplicar };
};
