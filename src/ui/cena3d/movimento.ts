import * as THREE from 'three';
import { easeInOut, easeOut } from './palco';

export interface Voo {
  readonly de: THREE.Vector3;
  readonly para: THREE.Vector3;
  readonly t0: number;
  readonly ms: number;
  readonly arco: number;
  readonly pouso: boolean;
}

export const novoVoo = (de: THREE.Vector3, para: THREE.Vector3, agora: number, opcoes: { arco?: number; ms?: number; pouso?: boolean } = {}): Voo => {
  const d = de.distanceTo(para);
  return {
    de: de.clone(),
    para: para.clone(),
    t0: agora,
    ms: opcoes.ms ?? Math.min(900, Math.max(420, 360 + d * 2.4)),
    arco: opcoes.arco ?? Math.min(70, 8 + d * 0.32),
    pouso: opcoes.pouso ?? false,
  };
};

export const noVoo = (v: Voo, agora: number, saida: THREE.Vector3): number => {
  const t = Math.min(1, Math.max(0, (agora - v.t0) / v.ms));
  const k = v.pouso ? easeOut(t) : easeInOut(t);
  saida.lerpVectors(v.de, v.para, k);
  saida.z += v.arco * Math.sin(Math.PI * Math.min(1, v.pouso ? t * 0.85 + 0.15 : t)) * (v.pouso ? 1 - t : 1);
  return t;
};

const texturaFumaca = (): THREE.CanvasTexture => {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    r.addColorStop(0, 'rgba(255,255,255,0.85)');
    r.addColorStop(0.45, 'rgba(235,235,235,0.35)');
    r.addColorStop(1, 'rgba(220,220,220,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

export interface Fumaca {
  readonly grupo: THREE.Group;
  readonly emitir: (ponto: THREE.Vector3, quantidade?: number) => void;
  readonly atualizar: (dt: number) => boolean;
}

export const criarFumaca = (tamanho = 1): Fumaca => {
  const grupo = new THREE.Group();
  const textura = texturaFumaca();
  const pool: { sprite: THREE.Sprite; vida: number; total: number; v: THREE.Vector3; base: number }[] = [];
  for (let i = 0; i < 28; i++) {
    const material = new THREE.SpriteMaterial({ map: textura, transparent: true, depthWrite: false, opacity: 0, color: '#f4f1ec' });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    sprite.renderOrder = 8;
    grupo.add(sprite);
    pool.push({ sprite, vida: 0, total: 1, v: new THREE.Vector3(), base: 1 });
  }
  let indice = 0;
  return {
    grupo,
    emitir: (ponto, quantidade = 1) => {
      for (let n = 0; n < quantidade; n++) {
        const p = pool[indice++ % pool.length];
        if (!p) continue;
        p.total = 900 + Math.random() * 700;
        p.vida = p.total;
        p.base = (2.2 + Math.random() * 2) * tamanho;
        p.v.set((Math.random() - 0.5) * 0.012, (Math.random() - 0.5) * 0.012, 0.018 + Math.random() * 0.014).multiplyScalar(tamanho);
        p.sprite.position.copy(ponto);
        p.sprite.visible = true;
      }
    },
    atualizar: (dt) => {
      let viva = false;
      for (const p of pool) {
        if (p.vida <= 0) continue;
        p.vida -= dt;
        if (p.vida <= 0) {
          p.sprite.visible = false;
          continue;
        }
        viva = true;
        const t = 1 - p.vida / p.total;
        p.sprite.position.addScaledVector(p.v, dt);
        p.v.x += Math.sin(p.vida * 0.01) * 0.00002 * dt;
        p.sprite.scale.setScalar(p.base * (1 + t * 3.2));
        (p.sprite.material as THREE.SpriteMaterial).opacity = Math.sin(Math.PI * Math.min(1, t * 1.4)) * 0.55 * (1 - t);
      }
      return viva;
    },
  };
};

export interface Onda {
  readonly grupo: THREE.Group;
  readonly disparar: (ponto: THREE.Vector3, raio: number, cor?: string) => void;
  readonly atualizar: (dt: number) => boolean;
}

export const criarOnda = (): Onda => {
  const grupo = new THREE.Group();
  const aneis: { mesh: THREE.Mesh; vida: number; raio: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    mesh.visible = false;
    mesh.renderOrder = 7;
    grupo.add(mesh);
    aneis.push({ mesh, vida: 0, raio: 1 });
  }
  let indice = 0;
  return {
    grupo,
    disparar: (ponto, raio, cor = '#ffd27a') => {
      const a = aneis[indice++ % aneis.length];
      if (!a) return;
      a.vida = 700;
      a.raio = raio;
      a.mesh.position.copy(ponto);
      (a.mesh.material as THREE.MeshBasicMaterial).color.set(cor);
      a.mesh.visible = true;
    },
    atualizar: (dt) => {
      let viva = false;
      for (const a of aneis) {
        if (a.vida <= 0) continue;
        a.vida -= dt;
        if (a.vida <= 0) {
          a.mesh.visible = false;
          continue;
        }
        viva = true;
        const t = 1 - a.vida / 700;
        a.mesh.scale.setScalar(a.raio * (0.4 + easeOut(t) * 1.2));
        (a.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
      }
      return viva;
    },
  };
};

const retanguloArredondado = (l: number, a: number, r: number): THREE.Shape => {
  const s = new THREE.Shape();
  const x = -l / 2;
  const y = -a / 2;
  const raio = Math.min(r, l / 2, a / 2);
  s.moveTo(x + raio, y);
  s.lineTo(x + l - raio, y);
  s.quadraticCurveTo(x + l, y, x + l, y + raio);
  s.lineTo(x + l, y + a - raio);
  s.quadraticCurveTo(x + l, y + a, x + l - raio, y + a);
  s.lineTo(x + raio, y + a);
  s.quadraticCurveTo(x, y + a, x, y + a - raio);
  s.lineTo(x, y + raio);
  s.quadraticCurveTo(x, y, x + raio, y);
  return s;
};

export interface Contorno {
  readonly grupo: THREE.Group;
  readonly moldar: (l: number, a: number) => void;
  readonly pulsar: (agora: number, intensidade?: number) => void;
}

export const criarContorno = (cor = '#ff5a36'): Contorno => {
  const grupo = new THREE.Group();
  const borda = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.9, depthWrite: false });
  const fundo = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.16, depthWrite: false });
  const halo = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.2, depthWrite: false });
  const anel = new THREE.Mesh(new THREE.BufferGeometry(), borda);
  const cheio = new THREE.Mesh(new THREE.BufferGeometry(), fundo);
  const fora = new THREE.Mesh(new THREE.BufferGeometry(), halo);
  for (const m of [anel, cheio, fora]) m.renderOrder = 6;
  grupo.add(fora, cheio, anel);
  return {
    grupo,
    moldar: (l, a) => {
      const espessura = Math.max(0.35, Math.min(0.9, Math.min(l, a) * 0.08));
      const raio = Math.min(1.6, Math.min(l, a) * 0.2);
      const externo = retanguloArredondado(l, a, raio);
      externo.holes.push(retanguloArredondado(l - espessura * 2, a - espessura * 2, Math.max(0.1, raio - espessura)));
      anel.geometry.dispose();
      anel.geometry = new THREE.ShapeGeometry(externo, 6);
      cheio.geometry.dispose();
      cheio.geometry = new THREE.ShapeGeometry(retanguloArredondado(l, a, raio), 6);
      const halos = retanguloArredondado(l + 3.2, a + 3.2, raio + 1.6);
      halos.holes.push(retanguloArredondado(l, a, raio));
      fora.geometry.dispose();
      fora.geometry = new THREE.ShapeGeometry(halos, 6);
    },
    pulsar: (agora, intensidade = 1) => {
      const s = 0.5 + 0.5 * Math.sin(agora / 210);
      borda.opacity = (0.55 + 0.45 * s) * intensidade;
      fundo.opacity = (0.1 + 0.14 * s) * intensidade;
      halo.opacity = 0.22 * (1 - s) * intensidade;
      fora.scale.setScalar(1 + s * 0.04);
    },
  };
};
