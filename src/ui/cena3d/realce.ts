import * as THREE from 'three';
import type { Cena } from '../kicad/cena';

export interface Realce {
  readonly acender: (partes: readonly string[], cor?: string, intensidade?: number) => void;
  readonly apagar: () => void;
}

export const criarRealce = (cena: Cena): Realce => {
  const originais = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const apagar = (): void => {
    for (const [mesh, original] of originais) {
      const atual = mesh.material;
      for (const m of Array.isArray(atual) ? atual : [atual]) m.dispose();
      mesh.material = original;
    }
    originais.clear();
  };
  const acender = (partes: readonly string[], cor = '#ffb703', intensidade = 0.4): void => {
    apagar();
    if (!partes.length) return;
    const alvo = new Set(partes);
    cena.modelos.forEach((m, i) => {
      const parte = cena.projeto.footprints[i]?.parte;
      if (!parte || !alvo.has(parte)) return;
      m.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        originais.set(o, o.material);
        const realcar = (mat: THREE.Material): THREE.Material => {
          if (!(mat instanceof THREE.MeshStandardMaterial)) return mat.clone();
          const copia = mat.clone();
          copia.emissive = new THREE.Color(cor);
          copia.emissiveIntensity = intensidade;
          return copia;
        };
        o.material = Array.isArray(o.material) ? o.material.map(realcar) : realcar(o.material);
      });
    });
  };
  return { acender, apagar };
};

export const parteNoPonto = (cena: Cena, raycaster: THREE.Raycaster): { parte: string | null; indice: number | null; ponto: THREE.Vector3 | null } => {
  const acerto = raycaster.intersectObjects([cena.componentes, cena.placa], true)[0];
  if (!acerto) return { parte: null, indice: null, ponto: null };
  let o: THREE.Object3D | null = acerto.object;
  while (o && o.userData.fp === undefined && o !== cena.conteudo) o = o.parent;
  const local = cena.conteudo.worldToLocal(acerto.point.clone());
  if (o && typeof o.userData.fp === 'number') {
    const f = cena.projeto.footprints.find((x) => x.indice === o?.userData.fp);
    return { parte: f?.parte ?? null, indice: f?.indice ?? null, ponto: local };
  }
  const x = local.x;
  const y = -local.y;
  const candidatos = cena.projeto.footprints.filter((f) => f.parte && x >= f.corpo.x && x <= f.corpo.x + f.corpo.l && y >= f.corpo.y && y <= f.corpo.y + f.corpo.a);
  candidatos.sort((a, b) => a.corpo.l * a.corpo.a - b.corpo.l * b.corpo.a);
  const f = candidatos[0];
  return { parte: f?.parte ?? null, indice: f?.indice ?? null, ponto: local };
};

export const centroDaParte = (cena: Cena, parte: string): THREE.Vector3 | null => {
  const caixa = new THREE.Box3();
  let achou = false;
  cena.modelos.forEach((m, i) => {
    if (cena.projeto.footprints[i]?.parte !== parte) return;
    caixa.expandByObject(m);
    achou = true;
  });
  if (!achou) return null;
  const centro = caixa.getCenter(new THREE.Vector3());
  centro.z = caixa.max.z;
  return centro;
};
